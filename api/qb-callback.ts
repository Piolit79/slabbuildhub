import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getQBCredentials, getSupabase } from './_qb-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, realmId, error } = req.query;

  if (error || !code || !realmId) {
    return res.redirect('/settings?qb=error&msg=' + encodeURIComponent((error as string) || 'Missing params'));
  }

  try {
    const { clientId, clientSecret, redirectUri } = getQBCredentials();

    const tokenResp = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResp.ok) {
      const txt = await tokenResp.text();
      throw new Error(`Token exchange failed: ${txt.slice(0, 200)}`);
    }

    const tokens = await tokenResp.json();
    const supabase = getSupabase();

    await supabase.from('qb_tokens').upsert(
      {
        realm_id: realmId as string,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
      },
      { onConflict: 'realm_id' }
    );

    res.redirect('/settings?qb=connected');
  } catch (e: any) {
    res.redirect('/settings?qb=error&msg=' + encodeURIComponent(e.message));
  }
}
