import type { VercelRequest, VercelResponse } from '@vercel/node';
import { qbQuery, getSupabase } from './_qb-utils';

export const maxDuration = 30;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { project_id, qb_project_id, category } = req.body;
  if (!project_id || !qb_project_id) {
    return res.status(400).json({ error: 'project_id and qb_project_id required' });
  }

  try {
    const data = await qbQuery(
      `SELECT * FROM Purchase WHERE PaymentType = 'Check' AND CustomerRef = '${qb_project_id}' MAXRESULTS 1000`
    );
    const checks = data.QueryResponse?.Purchase || [];

    if (checks.length === 0) {
      return res.json({ imported: 0, total: 0 });
    }

    // Find which external_ids already exist so we don't overwrite user edits
    const externalIds = checks.map((c: any) => `qb_${c.Id}`);
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('payments')
      .select('external_id')
      .in('external_id', externalIds);
    const existingSet = new Set((existing || []).map((r: any) => r.external_id));

    const newChecks = checks.filter((c: any) => !existingSet.has(`qb_${c.Id}`));

    if (newChecks.length > 0) {
      const rows = newChecks.map((c: any) => ({
        project_id,
        date: c.TxnDate,
        name: c.EntityRef?.name || 'Unknown',
        amount: c.TotalAmt || 0,
        category: category || 'subcontractor',
        form: 'Check',
        check_number: c.DocNumber || null,
        external_id: `qb_${c.Id}`,
        source: 'qb',
      }));
      await supabase.from('payments').insert(rows);
    }

    // Update last synced timestamp on project
    await supabase
      .from('projects')
      .update({ qb_last_synced: new Date().toISOString() })
      .eq('id', project_id);

    res.json({ imported: newChecks.length, total: checks.length, skipped: checks.length - newChecks.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}
