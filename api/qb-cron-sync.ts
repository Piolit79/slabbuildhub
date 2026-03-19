import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nlusfndskgdcottasfdy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const maxDuration = 60;

async function getValidToken(supabase: any) {
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

async function syncProject(supabase: any, access_token: string, realm_id: string, project_id: string, qb_project_id: string) {
  // Paginate through all checks (QB max per page is 1000)
  const allChecks: any[] = [];
  let startPosition = 1;
  while (true) {
    const query = encodeURIComponent(
      `SELECT * FROM Purchase WHERE PaymentType = 'Check' STARTPOSITION ${startPosition} MAXRESULTS 1000`
    );
    const resp = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=${query}&minorversion=65`,
      { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } }
    );
    if (!resp.ok) throw new Error(`QB API ${resp.status}`);
    const data = await resp.json();
    const page = data.QueryResponse?.Purchase || [];
    allChecks.push(...page);
    if (page.length < 1000) break;
    startPosition += 1000;
  }

  const matchesProject = (c: any) => {
    const id = String(qb_project_id);
    if (c.CustomerRef?.value === id) return true;
    return (c.Line || []).some((l: any) =>
      l.AccountBasedExpenseLineDetail?.CustomerRef?.value === id ||
      l.ItemBasedExpenseLineDetail?.CustomerRef?.value === id
    );
  };
  const checks = allChecks.filter(matchesProject);

  const { data: existing } = await supabase
    .from('payments').select('external_id, check_number').eq('project_id', project_id);
  const existingExternalIds = new Set((existing || []).map((r: any) => r.external_id).filter(Boolean));
  const existingCheckNumbers = new Set((existing || []).map((r: any) => r.check_number).filter(Boolean));

  const newChecks = checks.filter((c: any) =>
    !existingExternalIds.has(`qb_${c.Id}`) &&
    !(c.DocNumber && existingCheckNumbers.has(c.DocNumber))
  );

  if (newChecks.length > 0) {
    const rows = newChecks.map((c: any, i: number) => ({
      id: `${Date.now()}_${i}_${c.Id}`,
      project_id,
      date: c.TxnDate,
      name: c.EntityRef?.name || 'Unknown',
      amount: c.TotalAmt || 0,
      category: 'subcontractor',
      form: 'Check',
      check_number: c.DocNumber || null,
      external_id: `qb_${c.Id}`,
      source: 'qb',
    }));
    await supabase.from('payments').insert(rows);
  }

  // Remove duplicates
  const { data: allPayments } = await supabase
    .from('payments').select('id, check_number, source')
    .eq('project_id', project_id).not('check_number', 'is', null);
  const byCheckNumber = new Map<string, { id: string; source: string }[]>();
  for (const p of allPayments || []) {
    if (!p.check_number) continue;
    if (!byCheckNumber.has(p.check_number)) byCheckNumber.set(p.check_number, []);
    byCheckNumber.get(p.check_number)!.push(p);
  }
  const toDelete: string[] = [];
  for (const [, group] of byCheckNumber) {
    if (group.length < 2) continue;
    const keepId = (group.find(r => r.source === 'qb') || group[0]).id;
    group.forEach(r => { if (r.id !== keepId) toDelete.push(r.id); });
  }
  if (toDelete.length > 0) await supabase.from('payments').delete().in('id', toDelete);

  await supabase.from('projects').update({ qb_last_synced: new Date().toISOString() }).eq('id', project_id);

  return { imported: newChecks.length, removed: toDelete.length };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is called by Vercel cron
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { access_token, realm_id } = await getValidToken(supabase);

    // Get all projects with a QB mapping
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, qb_project_id')
      .not('qb_project_id', 'is', null);

    const results: any[] = [];
    for (const project of projects || []) {
      try {
        const result = await syncProject(supabase, access_token, realm_id, project.id, project.qb_project_id);
        results.push({ project: project.name, ...result });
      } catch (e: any) {
        results.push({ project: project.name, error: e.message });
      }
    }

    res.json({ synced: results.length, results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
