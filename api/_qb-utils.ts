import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nlusfndskgdcottasfdy.supabase.co';

export function getSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return createClient(SUPABASE_URL, key);
}

export function getQBCredentials() {
  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('QB_CLIENT_ID / QB_CLIENT_SECRET not set');
  const redirectUri = process.env.QB_REDIRECT_URI || 'https://slabbuildhub.vercel.app/api/qb-callback';
  return { clientId, clientSecret, redirectUri };
}

export async function getValidToken() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('qb_tokens').select('*').single();
  if (error || !data) throw new Error('Not connected to QuickBooks');

  // Refresh access token if expiring within 5 minutes
  if (data.expires_at - Date.now() < 300_000) {
    const { clientId, clientSecret } = getQBCredentials();
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
      const updated = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
      };
      await supabase.from('qb_tokens').update(updated).eq('realm_id', data.realm_id);
      return { access_token: tokens.access_token, realm_id: data.realm_id };
    }
  }

  return { access_token: data.access_token, realm_id: data.realm_id };
}

export async function qbQuery(query: string) {
  const { access_token, realm_id } = await getValidToken();
  const resp = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=${encodeURIComponent(query)}&minorversion=65`,
    { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } }
  );
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`QB API ${resp.status}: ${txt.slice(0, 200)}`);
  }
  return resp.json();
}
