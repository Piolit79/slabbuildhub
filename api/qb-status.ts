import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './_qb-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('qb_tokens').select('realm_id, expires_at').single();
    if (!data) return res.json({ connected: false });
    res.json({ connected: true, realm_id: data.realm_id, expires_at: data.expires_at });
  } catch {
    res.json({ connected: false });
  }
}
