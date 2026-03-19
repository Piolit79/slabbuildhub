import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.QB_CLIENT_ID;
  const redirectUri = process.env.QB_REDIRECT_URI || 'https://slabbuildhub-piolit-9204s-projects.vercel.app/api/qb-callback';

  if (!clientId) {
    return res.status(500).send('QB_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: redirectUri,
    state: Math.random().toString(36).slice(2),
  });

  res.redirect(`https://appcenter.intuit.com/connect/oauth2?${params.toString()}`);
}
