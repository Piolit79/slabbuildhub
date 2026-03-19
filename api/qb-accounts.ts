import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nlusfndskgdcottasfdy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: tokenData } = await supabase.from('qb_tokens').select('*').single();
  if (!tokenData) return res.status(400).json({ error: 'Not connected to QuickBooks' });

  const { access_token, realm_id } = tokenData;

  const q = encodeURIComponent(`SELECT * FROM Account WHERE AccountType = 'Credit Card' MAXRESULTS 200`);
  const r = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=${q}&minorversion=65`,
    { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } }
  );
  if (!r.ok) return res.status(500).json({ error: `QB API ${r.status}` });

  const d = await r.json();
  const accounts = (d.QueryResponse?.Account || []).map((a: any) => ({
    id: a.Id,
    name: a.FullyQualifiedName || a.Name,
  }));

  res.json({ accounts });
}
