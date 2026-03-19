import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { ensureVendors } from './_vendor-utils';

const SUPABASE_URL = 'https://nlusfndskgdcottasfdy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const maxDuration = 30;

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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { project_id, qb_project_id, category } = req.body;
  if (!project_id || !qb_project_id) {
    return res.status(400).json({ error: 'project_id and qb_project_id required' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { access_token, realm_id } = await getValidToken();

    // Helper to paginate any QB query
    const fetchAll = async (entity: string, whereClause: string): Promise<any[]> => {
      const results: any[] = [];
      let pos = 1;
      while (true) {
        const q = encodeURIComponent(`SELECT * FROM ${entity} WHERE ${whereClause} STARTPOSITION ${pos} MAXRESULTS 1000`);
        const r = await fetch(
          `https://quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=${q}&minorversion=65`,
          { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } }
        );
        if (!r.ok) { const t = await r.text(); throw new Error(`QB API ${r.status}: ${t.slice(0, 300)}`); }
        const d = await r.json();
        const page = d.QueryResponse?.[entity] || [];
        results.push(...page.map((x: any) => ({ ...x, _entity: entity })));
        if (page.length < 1000) break;
        pos += 1000;
      }
      return results;
    };

    // Fetch all Purchases (Check + Expense/Cash) and BillPayment checks
    // BillPayment doesn't support PayType in WHERE clause — fetch all and filter client-side
    const [allPurchases, allBillPayments] = await Promise.all([
      fetchAll('Purchase', `Id > '0'`),
      fetchAll('BillPayment', `Id > '0'`),
    ]);
    const billPayments = allBillPayments.filter((c: any) => c.PayType === 'Check');

    // Include a purchase if it's a real Check, OR if it has a numeric DocNumber
    // (catches expenses that were miscategorized but have real check numbers)
    const looksLikeCheck = (c: any) =>
      c.PaymentType === 'Check' || /^\d+$/.test((c.DocNumber || '').trim());

    const allChecks = [...allPurchases.filter(looksLikeCheck), ...billPayments];

    // Extract all CustomerRef values anywhere in a check object (recursive)
    const allCustomerRefs = (obj: any): string[] => {
      if (!obj || typeof obj !== 'object') return [];
      const refs: string[] = [];
      if (obj.CustomerRef?.value) refs.push(String(obj.CustomerRef.value));
      for (const val of Object.values(obj)) {
        if (Array.isArray(val)) val.forEach(v => refs.push(...allCustomerRefs(v)));
        else if (val && typeof val === 'object') refs.push(...allCustomerRefs(val));
      }
      return refs;
    };

    const matchesProject = (c: any) => {
      const id = String(qb_project_id);
      return allCustomerRefs(c).includes(id);
    };

    const checks = allChecks.filter(matchesProject);

    // Auto-match credit card account by project name
    const { data: projectRow } = await supabase.from('projects').select('name, qb_cc_account_id').eq('id', project_id).single();
    let ccAccountId: string | null = projectRow?.qb_cc_account_id || null;
    if (!ccAccountId && projectRow?.name) {
      const q = encodeURIComponent(`SELECT * FROM Account WHERE AccountType = 'Credit Card' MAXRESULTS 200`);
      const r = await fetch(`https://quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=${q}&minorversion=65`,
        { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } });
      if (r.ok) {
        const d = await r.json();
        const projName = projectRow.name.toLowerCase();
        const match = (d.QueryResponse?.Account || []).find((a: any) => {
          const aName = (a.FullyQualifiedName || a.Name || '').toLowerCase();
          return aName.includes(projName) || projName.includes(aName);
        });
        if (match) {
          ccAccountId = match.Id;
          await supabase.from('projects').update({ qb_cc_account_id: match.Id }).eq('id', project_id);
        }
      }
    }
    const creditCards = ccAccountId
      ? allPurchases.filter((c: any) => c.PaymentType === 'CreditCard' && String(c.AccountRef?.value) === String(ccAccountId))
      : [];

    // Fetch all existing payments for this project to dedup by external_id OR check_number
    const { data: existing } = await supabase
      .from('payments')
      .select('external_id, check_number')
      .eq('project_id', project_id);

    const existingExternalIds = new Set((existing || []).map((r: any) => r.external_id).filter(Boolean));
    const existingCheckNumbers = new Set((existing || []).map((r: any) => r.check_number).filter(Boolean));

    const newChecks = checks.filter((c: any) =>
      !existingExternalIds.has(`qb_${c._entity}_${c.Id}`) &&
      !existingExternalIds.has(`qb_${c.Id}`) &&
      !(c.DocNumber && existingCheckNumbers.has(c.DocNumber))
    );

    const newCC = creditCards.filter((c: any) =>
      !existingExternalIds.has(`qb_${c._entity}_${c.Id}`) &&
      !existingExternalIds.has(`qb_${c.Id}`)
    );

    if (newChecks.length > 0) {
      const rows = newChecks.map((c: any, i: number) => ({
        id: `${Date.now()}_${i}_${c.Id}`,
        project_id,
        date: c.TxnDate,
        name: c.EntityRef?.name || c.VendorRef?.name || 'Unknown',
        amount: c.TotalAmt || 0,
        category: category || 'subcontractor',
        form: 'Check',
        check_number: c.DocNumber || null,
        external_id: `qb_${c._entity}_${c.Id}`,
        source: 'qb',
      }));
      const { error: insertError } = await supabase.from('payments').insert(rows);
      if (insertError) throw new Error(`Insert failed: ${insertError.message}`);
    }

    if (newCC.length > 0) {
      const rows = newCC.map((c: any, i: number) => ({
        id: `cc_${Date.now()}_${i}_${c.Id}`,
        project_id,
        date: c.TxnDate,
        name: c.EntityRef?.name || c.VendorRef?.name || 'Unknown',
        amount: c.TotalAmt || 0,
        category: 'materials',
        form: 'Credit',
        check_number: null,
        external_id: `qb_${c._entity}_${c.Id}`,
        source: 'qb',
      }));
      const { error: insertError } = await supabase.from('payments').insert(rows);
      if (insertError) throw new Error(`CC insert failed: ${insertError.message}`);
    }

    // Sync vendors: add new names to directory + link to project
    if (newChecks.length > 0) {
      const names = [...new Set(newChecks.map((c: any) => c.EntityRef?.name || c.VendorRef?.name).filter(Boolean))];
      await ensureVendors(supabase, project_id, names, 'Subcontractor');
    }
    if (newCC.length > 0) {
      const names = [...new Set(newCC.map((c: any) => c.EntityRef?.name || c.VendorRef?.name).filter(Boolean))];
      await ensureVendors(supabase, project_id, names, 'Vendor');
    }

    // Remove duplicates: for any check_number with multiple rows, keep the QB-synced one
    const { data: allPayments } = await supabase
      .from('payments')
      .select('id, check_number, source')
      .eq('project_id', project_id)
      .not('check_number', 'is', null);

    const byCheckNumber = new Map<string, { id: string; source: string }[]>();
    for (const p of allPayments || []) {
      if (!p.check_number) continue;
      if (!byCheckNumber.has(p.check_number)) byCheckNumber.set(p.check_number, []);
      byCheckNumber.get(p.check_number)!.push(p);
    }

    const toDelete: string[] = [];
    for (const [, group] of byCheckNumber) {
      if (group.length < 2) continue;
      // Keep QB-synced row, delete the rest
      const qbRow = group.find(r => r.source === 'qb');
      const keepId = qbRow ? qbRow.id : group[0].id;
      group.forEach(r => { if (r.id !== keepId) toDelete.push(r.id); });
    }

    let removed = 0;
    if (toDelete.length > 0) {
      await supabase.from('payments').delete().in('id', toDelete);
      removed = toDelete.length;
    }

    await supabase
      .from('projects')
      .update({ qb_last_synced: new Date().toISOString() })
      .eq('id', project_id);

    res.json({ imported: newChecks.length, importedCC: newCC.length, total: checks.length, skipped: checks.length - newChecks.length, removed });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
