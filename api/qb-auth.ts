import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getQBCredentials } from './_qb-utils';

export default function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { clientId, redirectUri } = getQBCredentials();
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      redirect_uri: redirectUri,
      state: Math.random().toString(36).slice(2),
    });
    res.redirect(`https://appcenter.intuit.com/connect/oauth2?${params.toString()}`);
  } catch (e: any) {
    res.redirect('/settings?qb=error&msg=' + encodeURIComponent(e.message));
  }
}
