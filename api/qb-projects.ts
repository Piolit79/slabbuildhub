import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nlusfndskgdcottasfdy.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sdXNmbmRza2dkY290dGFzZmR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc1NjQ0NiwiZXhwIjoyMDg4MzMyNDQ2fQ.rEeEZJJvZNKrqJ5DMMjPlOYuYmAnzzhwLvFqPcZNkwM';

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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { access_token, realm_id } = await getValidToken();
    const query = encodeURIComponent('SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000');
    const resp = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=${query}&minorversion=65`,
      { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } }
    );
    if (!resp.ok) throw new Error(`QB API ${resp.status}`);
    const data = await resp.json();
    const projects = (data.QueryResponse?.Customer || [])
      .filter((c: any) => c.IsProject === true)
      .map((c: any) => {
        const full = c.FullyQualifiedName || c.DisplayName || '';
        const name = full.includes(':') ? full.split(':').pop()!.trim() : full;
        return { id: c.Id, name };
      });
    res.json({ projects });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
