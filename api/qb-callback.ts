import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nlusfndskgdcottasfdy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, realmId, error } = req.query;

  if (error || !code || !realmId) {
    return res.redirect('/settings?qb=error&msg=' + encodeURIComponent((error as string) || 'Missing params'));
  }

  const clientId = process.env.QB_CLIENT_ID!;
  const clientSecret = process.env.QB_CLIENT_SECRET!;
  const redirectUri = process.env.QB_REDIRECT_URI || 'https://slabbuildhub-piolit-9204s-projects.vercel.app/api/qb-callback';

  try {
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

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error(`Unexpected token response: ${JSON.stringify(tokens).slice(0, 200)}`);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { error: upsertError } = await supabase.from('qb_tokens').upsert(
      {
        realm_id: realmId as string,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
      },
      { onConflict: 'realm_id' }
    );

    if (upsertError) {
      throw new Error(`DB save failed: ${upsertError.message}`);
    }

    res.redirect('/settings?qb=connected');
  } catch (e: any) {
    res.redirect('/settings?qb=error&msg=' + encodeURIComponent(e.message));
  }
}
