import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nlusfndskgdcottasfdy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getValidToken() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data, error } = await supabase.from('qb_tokens').select('*').single();
  if (error || !data) throw new Error('Not connected to QuickBooks');
  if (data.expires_at - Date.now() < 300_000) {
    const resp = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString('base64')}`,
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
  // Simple auth check
  if (req.headers['x-debug-key'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Pass ?from=4001&to=4014 to look up a range of check numbers
  const from = parseInt(req.query.from as string) || 4001;
  const to = parseInt(req.query.to as string) || 4020;

  try {
    const { access_token, realm_id } = await getValidToken();

    const fetchEntity = async (entity: string, payTypeField: string): Promise<any[]> => {
      const results: any[] = [];
      let pos = 1;
      while (true) {
        const q = encodeURIComponent(
          `SELECT * FROM ${entity} WHERE ${payTypeField} = 'Check' STARTPOSITION ${pos} MAXRESULTS 1000`
        );
        const r = await fetch(
          `https://quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=${q}&minorversion=65`,
          { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } }
        );
        if (!r.ok) break;
        const d = await r.json();
        const page = d.QueryResponse?.[entity] || [];
        results.push(...page);
        if (page.length < 1000) break;
        pos += 1000;
      }
      return results;
    };

    const [purchases, billPayments] = await Promise.all([
      fetchEntity('Purchase', 'PaymentType'),
      fetchEntity('BillPayment', 'PayType'),
    ]);

    // Filter to the requested check number range
    const inRange = (docNum: string) => {
      const n = parseInt(docNum);
      return !isNaN(n) && n >= from && n <= to;
    };

    const extract = (txns: any[], entityType: string) =>
      txns
        .filter(c => c.DocNumber && inRange(c.DocNumber))
        .map(c => {
          // Collect all CustomerRef values recursively
          const refs: string[] = [];
          const walk = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            if (obj.CustomerRef?.value) refs.push(`${obj.CustomerRef.value} (${obj.CustomerRef.name || ''})`);
            for (const v of Object.values(obj)) {
              if (Array.isArray(v)) v.forEach(walk);
              else if (v && typeof v === 'object') walk(v);
            }
          };
          walk(c);

          return {
            entity: entityType,
            id: c.Id,
            check_number: c.DocNumber,
            date: c.TxnDate,
            amount: c.TotalAmt,
            payee: c.EntityRef?.name || c.VendorRef?.name || '—',
            customer_refs: refs.length ? refs : ['(none)'],
          };
        });

    const found = [
      ...extract(purchases, 'Purchase/Check'),
      ...extract(billPayments, 'BillPayment/Check'),
    ].sort((a, b) => parseInt(a.check_number) - parseInt(b.check_number));

    res.json({
      range: `${from}–${to}`,
      found: found.length,
      checks: found,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
