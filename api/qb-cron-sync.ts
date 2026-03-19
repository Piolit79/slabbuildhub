import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

async function ensureVendors(supabase: any, projectId: string, names: string[], defaultType: string) {
  const unique = [...new Set(names.filter(n => n && n !== 'Unknown'))];
  if (unique.length === 0) return;
  const { data: allVendors } = await supabase.from('vendors').select('id, name');
  const byNameLower = new Map<string, string>((allVendors || []).map((v: any) => [v.name.toLowerCase(), v.id]));
  const toCreate = unique.filter(n => !byNameLower.has(n.toLowerCase()));
  if (toCreate.length > 0) {
    const rows = toCreate.map((name, i) => ({ id: `qb_v_${Date.now()}_${i}`, name, detail: '', type: defaultType, contact: '', email: '', phone: '' }));
    const { data: created } = await supabase.from('vendors').insert(rows).select('id, name');
    for (const v of (created || [])) byNameLower.set(v.name.toLowerCase(), v.id);
  }
  const vendorIds = [...new Set(unique.map(n => byNameLower.get(n.toLowerCase())).filter(Boolean))] as string[];
  if (vendorIds.length === 0) return;
  const { data: existingLinks } = await supabase.from('project_vendors').select('vendor_id').eq('project_id', projectId).in('vendor_id', vendorIds);
  const linkedIds = new Set((existingLinks || []).map((l: any) => l.vendor_id));
  const newLinks = vendorIds.filter(id => !linkedIds.has(id)).map(vendor_id => ({ project_id: projectId, vendor_id }));
  if (newLinks.length > 0) await supabase.from('project_vendors').insert(newLinks);
}

const SUPABASE_URL = 'https://nlusfndskgdcottasfdy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const maxDuration = 60;

async function getValidToken(supabase: any) {
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

async function syncProject(supabase: any, access_token: string, realm_id: string, project_id: string, qb_project_id: string, project_name: string, qb_cc_account_id?: string, qb_labor_account_id?: string) {
  const fetchAll = async (entity: string, whereClause: string): Promise<any[]> => {
    const results: any[] = [];
    let pos = 1;
    while (true) {
      const q = encodeURIComponent(`SELECT * FROM ${entity} WHERE ${whereClause} STARTPOSITION ${pos} MAXRESULTS 1000`);
      const r = await fetch(
        `https://quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=${q}&minorversion=65`,
        { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } }
      );
      if (!r.ok) throw new Error(`QB API ${r.status}`);
      const d = await r.json();
      const page = d.QueryResponse?.[entity] || [];
      results.push(...page.map((x: any) => ({ ...x, _entity: entity })));
      if (page.length < 1000) break;
      pos += 1000;
    }
    return results;
  };

  const [allPurchases, allBillPayments] = await Promise.all([
    fetchAll('Purchase', `Id > '0'`),
    fetchAll('BillPayment', `Id > '0'`),
  ]);
  const FIELD_LABOR_VENDORS = ['francisco'];
  const isFieldLaborVendor = (c: any) => {
    const name = (c.EntityRef?.name || c.VendorRef?.name || '').toLowerCase();
    return FIELD_LABOR_VENDORS.some(n => name.includes(n));
  };

  const billPayments = allBillPayments.filter((c: any) => c.PayType === 'Check');
  const looksLikeCheck = (c: any) =>
    (c.PaymentType === 'Check' || /^\d+$/.test((c.DocNumber || '').trim())) &&
    !isFieldLaborVendor(c);
  const allChecks = [...allPurchases.filter(looksLikeCheck), ...billPayments.filter(c => !isFieldLaborVendor(c))];

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

  const matchesProject = (c: any) => allCustomerRefs(c).includes(String(qb_project_id));
  const checks = allChecks.filter(matchesProject);

  // Auto-match CC account by project name if not already saved
  let ccAccountId: string | null = qb_cc_account_id || null;
  if (!ccAccountId && project_name) {
    const q = encodeURIComponent(`SELECT * FROM Account WHERE AccountType = 'Credit Card' MAXRESULTS 200`);
    const r = await fetch(`https://quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=${q}&minorversion=65`,
      { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } });
    if (r.ok) {
      const d = await r.json();
      const projName = project_name.toLowerCase();
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

  // Field labor: expense (Cash/ACH) purchases to field labor vendors, matched by per-project bank account
  let laborAccountId: string | null = qb_labor_account_id || null;
  if (!laborAccountId && project_name) {
    const q = encodeURIComponent(`SELECT * FROM Account WHERE AccountType = 'Bank' MAXRESULTS 200`);
    const r = await fetch(`https://quickbooks.api.intuit.com/v3/company/${realm_id}/query?query=${q}&minorversion=65`,
      { headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' } });
    if (r.ok) {
      const d = await r.json();
      const projName = project_name.toLowerCase();
      const match = (d.QueryResponse?.Account || []).find((a: any) => {
        const aName = (a.FullyQualifiedName || a.Name || '').toLowerCase();
        return aName.includes(projName) || projName.includes(aName);
      });
      if (match) {
        laborAccountId = match.Id;
        await supabase.from('projects').update({ qb_labor_account_id: match.Id }).eq('id', project_id);
      }
    }
  }
  const fieldLaborPurchases = laborAccountId
    ? allPurchases.filter((c: any) => isFieldLaborVendor(c) && String(c.AccountRef?.value) === String(laborAccountId))
    : allPurchases.filter((c: any) => isFieldLaborVendor(c) && matchesProject(c));

  const { data: existing } = await supabase
    .from('payments').select('external_id, check_number').eq('project_id', project_id);
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

  const newFieldLabor = fieldLaborPurchases.filter((c: any) =>
    !existingExternalIds.has(`qb_${c._entity}_${c.Id}`) &&
    !existingExternalIds.has(`qb_${c.Id}`)
  );

  if (newChecks.length > 0) {
    const rows = newChecks.map((c: any, i: number) => {
      const name = c.EntityRef?.name || c.VendorRef?.name || 'Unknown';
      const cat = /francisco/i.test(name) ? 'field_labor' : 'subcontractor';
      return {
        id: `${Date.now()}_${i}_${c.Id}`,
        project_id,
        date: c.TxnDate,
        name,
        amount: c.TotalAmt || 0,
        category: cat,
        form: 'Check',
        check_number: c.DocNumber || null,
        external_id: `qb_${c._entity}_${c.Id}`,
        source: 'qb',
      };
    });
    await supabase.from('payments').insert(rows);
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
    await supabase.from('payments').insert(rows);
  }

  if (newFieldLabor.length > 0) {
    const rows = newFieldLabor.map((c: any, i: number) => ({
      id: `fl_${Date.now()}_${i}_${c.Id}`,
      project_id,
      date: c.TxnDate,
      name: c.EntityRef?.name || c.VendorRef?.name || 'Unknown',
      amount: c.TotalAmt || 0,
      category: 'field_labor',
      form: c.PaymentType === 'Check' ? 'Check' : 'ACH',
      check_number: c.DocNumber || null,
      external_id: `qb_${c._entity}_${c.Id}`,
      source: 'qb',
    }));
    await supabase.from('payments').insert(rows);
  }

  // Sync vendors from ALL project payments (not just new ones — catches backfill on resync)
  const { data: allProjectPayments } = await supabase
    .from('payments').select('name, category').eq('project_id', project_id);
  const subNames = [...new Set((allProjectPayments || []).filter((p: any) => p.category === 'subcontractor').map((p: any) => p.name).filter(Boolean))];
  const matNames = [...new Set((allProjectPayments || []).filter((p: any) => p.category === 'materials').map((p: any) => p.name).filter(Boolean))];
  const laborNames = [...new Set((allProjectPayments || []).filter((p: any) => p.category === 'field_labor').map((p: any) => p.name).filter(Boolean))];
  if (subNames.length > 0) await ensureVendors(supabase, project_id, subNames, 'Subcontractor');
  if (matNames.length > 0) await ensureVendors(supabase, project_id, matNames, 'Vendor');
  if (laborNames.length > 0) await ensureVendors(supabase, project_id, laborNames, 'Subcontractor');

  // Remove duplicates
  const { data: allPayments } = await supabase
    .from('payments').select('id, check_number, source')
    .eq('project_id', project_id).not('check_number', 'is', null);
  const byCheckNumber = new Map<string, { id: string; source: string }[]>();
  for (const p of allPayments || []) {
    if (!p.check_number) continue;
    if (!byCheckNumber.has(p.check_number)) byCheckNumber.set(p.check_number, []);
    byCheckNumber.get(p.check_number)!.push(p);
  }
  const toDelete: string[] = [];
  for (const [, group] of byCheckNumber) {
    if (group.length < 2) continue;
    const keepId = (group.find(r => r.source === 'qb') || group[0]).id;
    group.forEach(r => { if (r.id !== keepId) toDelete.push(r.id); });
  }
  if (toDelete.length > 0) await supabase.from('payments').delete().in('id', toDelete);

  await supabase.from('projects').update({ qb_last_synced: new Date().toISOString() }).eq('id', project_id);

  return { imported: newChecks.length, importedCC: newCC.length, importedFL: newFieldLabor.length, removed: toDelete.length };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is called by Vercel cron
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { access_token, realm_id } = await getValidToken(supabase);

    // Get all projects with a QB mapping
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, qb_project_id, qb_cc_account_id, qb_labor_account_id')
      .not('qb_project_id', 'is', null);

    const results: any[] = [];
    for (const project of projects || []) {
      try {
        const result = await syncProject(supabase, access_token, realm_id, project.id, project.qb_project_id, project.name, project.qb_cc_account_id, project.qb_labor_account_id);
        results.push({ project: project.name, ...result });
      } catch (e: any) {
        results.push({ project: project.name, error: e.message });
      }
    }

    res.json({ synced: results.length, results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
