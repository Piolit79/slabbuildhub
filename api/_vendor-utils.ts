/**
 * Ensures vendor names are in the global directory and linked to the project.
 * Creates missing directory entries; skips 'Unknown'.
 */
export async function ensureVendors(supabase: any, projectId: string, names: string[], defaultType: string) {
  const unique = [...new Set(names.filter(n => n && n !== 'Unknown'))];
  if (unique.length === 0) return;

  // Fetch entire vendor directory for case-insensitive matching
  const { data: allVendors } = await supabase.from('vendors').select('id, name');
  const byNameLower = new Map<string, string>((allVendors || []).map((v: any) => [v.name.toLowerCase(), v.id]));

  // Create vendors not in directory
  const toCreate = unique.filter(n => !byNameLower.has(n.toLowerCase()));
  if (toCreate.length > 0) {
    const rows = toCreate.map((name, i) => ({
      id: `qb_v_${Date.now()}_${i}`,
      name,
      detail: '',
      type: defaultType,
      contact: '',
      email: '',
      phone: '',
    }));
    const { data: created } = await supabase.from('vendors').insert(rows).select('id, name');
    for (const v of (created || [])) byNameLower.set(v.name.toLowerCase(), v.id);
  }

  const vendorIds = [...new Set(unique.map(n => byNameLower.get(n.toLowerCase())).filter(Boolean))] as string[];
  if (vendorIds.length === 0) return;

  // Fetch existing project links
  const { data: existingLinks } = await supabase
    .from('project_vendors').select('vendor_id')
    .eq('project_id', projectId).in('vendor_id', vendorIds);
  const linkedIds = new Set((existingLinks || []).map((l: any) => l.vendor_id));

  const newLinks = vendorIds.filter(id => !linkedIds.has(id)).map(vendor_id => ({ project_id: projectId, vendor_id }));
  if (newLinks.length > 0) await supabase.from('project_vendors').insert(newLinks);
}
