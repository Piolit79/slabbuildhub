import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nlusfndskgdcottasfdy.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sdXNmbmRza2dkY290dGFzZmR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc1NjQ0NiwiZXhwIjoyMDg4MzMyNDQ2fQ.rEeEZJJvZNKrqJ5DMMjPlOYuYmAnzzhwLvFqPcZNkwM';

export const maxDuration = 30;

async function getValidToken() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data, error } = await supabase.from('qb_tokens').select('*').single();
  if (error || !data) throw new Error('Not connected to QuickBooks');

  if (data.expires_at - Date.now() < 300_000) {
    const clientId = process.env.QB_CLIENT_ID!;
    const clientSecret = process.env.QB_CLIENT_SECRET!;
    const resp = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token }).toString(),
    });
    if (resp.ok) {
      const tokens = await resp.json();
      await supabase.from('qb_tokens').update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
      }).eq('realm_id', data.realm_id);
      return { access_token: tokens.access_token, realm_id: data.realm_id };
    }
  }

  return { access_token: data.access_token, realm_id: data.realm_id };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { project_id, qb_project_id, category } = req.body;
  if (!project_id || !qb_project_id) {
    return res.status(400).json({ error: 'project_id and qb_project_id required' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { access_token, realm_id } = await getValidToken();
    const query = encodeURIComponent(
      `SELECT * FROM Purchase WHERE PaymentType = 'Check' MAXRESULTS 1000`
    );
    const resp = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=${query}&minorversion=65`,
      { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } }
    );
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`QB API ${resp.status}: ${txt.slice(0, 300)}`);
    }
    const data = await resp.json();
    const allChecks = data.QueryResponse?.Purchase || [];

    // QB stores project on line items, not the check header — check both places
    const matchesProject = (c: any) => {
      const id = String(qb_project_id);
      if (c.CustomerRef?.value === id) return true;
      return (c.Line || []).some((l: any) =>
        l.AccountBasedExpenseLineDetail?.CustomerRef?.value === id ||
        l.ItemBasedExpenseLineDetail?.CustomerRef?.value === id
      );
    };

    const checks = allChecks.filter(matchesProject);

    const externalIds = checks.map((c: any) => `qb_${c.Id}`);
    const { data: existing } = await supabase
      .from('payments')
      .select('external_id')
      .in('external_id', externalIds);
    const existingSet = new Set((existing || []).map((r: any) => r.external_id));

    const newChecks = checks.filter((c: any) => !existingSet.has(`qb_${c.Id}`));

    if (newChecks.length > 0) {
      const rows = newChecks.map((c: any) => ({
        project_id,
        date: c.TxnDate,
        name: c.EntityRef?.name || 'Unknown',
        amount: c.TotalAmt || 0,
        category: category || 'subcontractor',
        form: 'Check',
        check_number: c.DocNumber || null,
        external_id: `qb_${c.Id}`,
        source: 'qb',
      }));
      await supabase.from('payments').insert(rows);
    }

    await supabase
      .from('projects')
      .update({ qb_last_synced: new Date().toISOString() })
      .eq('id', project_id);

    res.json({ imported: newChecks.length, total: checks.length, skipped: checks.length - newChecks.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
