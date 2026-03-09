import React, { useState, useMemo, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil, Check, X, ChevronUp, ChevronDown, ChevronsUpDown, Trash2, Undo2 } from 'lucide-react';
import { Vendor } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';

/** Dice coefficient — bigram similarity, 0..1 */
function nameSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim(), s2 = b.toLowerCase().trim();
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;
  const bg = new Map<string, number>();
  for (let i = 0; i < s1.length - 1; i++) { const k = s1.slice(i, i + 2); bg.set(k, (bg.get(k) || 0) + 1); }
  let hit = 0;
  for (let i = 0; i < s2.length - 1; i++) { const k = s2.slice(i, i + 2); const c = bg.get(k) || 0; if (c > 0) { bg.set(k, c - 1); hit++; } }
  return (2 * hit) / (s1.length - 1 + s2.length - 1);
}

function SortBtn({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: string; onClick: () => void; className?: string }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-0.5 hover:text-foreground ${className || ''}`}>{label}{active ? (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="opacity-30" />}</button>;
}

export default function VendorsPage() {
  const { selectedProject } = useProject();
  const isMobile = useIsMobile();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [directory, setDirectory] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      // Load full directory
      const { data: allVendors } = await supabase.from('vendors').select('*');
      setDirectory((allVendors || []) as Vendor[]);

      // Load project-specific vendors via junction
      const { data: links } = await supabase
        .from('project_vendors')
        .select('vendor_id')
        .eq('project_id', selectedProject.id);

      if (links && allVendors) {
        const linkedIds = new Set(links.map(l => l.vendor_id));
        setVendors((allVendors as Vendor[]).filter(v => linkedIds.has(v.id)));
      }
    };
    load();
  }, [selectedProject.id]);

  const [open, setOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Vendor>>({});
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Undo
  const [undoInfo, setUndoInfo] = useState<{ id: string; prev: Vendor } | null>(null);
  const undoTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showUndo = (id: string, prev: Vendor) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoInfo({ id, prev });
    undoTimerRef.current = setTimeout(() => setUndoInfo(null), 10000);
  };
  const handleUndo = async () => {
    if (!undoInfo) return;
    const { id, prev } = undoInfo;
    setVendors(p => p.map(v => v.id === id ? prev : v));
    await supabase.from('vendors').update(prev).eq('id', id);
    setUndoInfo(null);
  };

  // Delete (unlink from project)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const unlinkVendor = async (id: string) => {
    setVendors(prev => prev.filter(v => v.id !== id));
    await supabase.from('project_vendors').delete().eq('project_id', selectedProject.id).eq('vendor_id', id);
    setConfirmDeleteId(null);
  };

  const toggle = (k: string) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc'); } };

  const directorySuggestions = useMemo(() => directory.map(v => v.name), [directory]);

  const filtered = useMemo(() => {
    const f = vendors.filter(v => v.name.toLowerCase().includes(search.toLowerCase()) || v.detail.toLowerCase().includes(search.toLowerCase()) || v.type.toLowerCase().includes(search.toLowerCase()));
    return [...f].sort((a: any, b: any) => {
      const av = a[sortKey], bv = b[sortKey];
      return sortDir === 'asc' ? String(av ?? '').localeCompare(String(bv ?? '')) : String(bv ?? '').localeCompare(String(av ?? ''));
    });
  }, [vendors, search, sortKey, sortDir]);

  const startEdit = (v: Vendor) => { setEditId(v.id); setEditData({ ...v }); };
  const cancelEdit = () => { setEditId(null); setEditData({}); };
  const saveEdit = async () => {
    const prev = vendors.find(v => v.id === editId);
    await supabase.from('vendors').update(editData).eq('id', editId!);
    setVendors(p => p.map(v => v.id === editId ? { ...v, ...editData } as Vendor : v));
    // Also update directory cache
    setDirectory(p => p.map(v => v.id === editId ? { ...v, ...editData } as Vendor : v));
    if (prev) showUndo(editId!, prev);
    cancelEdit();
  };

  const linkExistingVendor = async (vendor: Vendor) => {
    const alreadyLinked = vendors.find(v => v.id === vendor.id);
    if (!alreadyLinked) {
      await supabase.from('project_vendors').insert({ project_id: selectedProject.id, vendor_id: vendor.id });
      setVendors(prev => [...prev, vendor]);
    }
    setOpen(false);
    setAddName('');
    setSkipFuzzy(false);
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get('name') as string;

    // Exact match in directory → link
    const existing = directory.find(v => v.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      await linkExistingVendor(existing);
      return;
    }

    // Fuzzy match found and user hasn't skipped → don't submit (UI shows suggestion)
    if (fuzzyDirVendor) return;

    // Create new vendor in directory + link to project
    const nv: Vendor = {
      id: Date.now().toString(), name,
      detail: fd.get('detail') as string,
      type: fd.get('type') as Vendor['type'],
      contact: fd.get('contact') as string,
      email: fd.get('email') as string,
      phone: fd.get('phone') as string,
    };
    await supabase.from('vendors').insert(nv);
    await supabase.from('project_vendors').insert({ project_id: selectedProject.id, vendor_id: nv.id });
    setVendors(prev => [...prev, nv]);
    setDirectory(prev => [...prev, nv]);
    setOpen(false);
    setAddName('');
    setSkipFuzzy(false);
  };

  const [skipFuzzy, setSkipFuzzy] = useState(false);

  // When user picks a name from directory, pre-fill the form (exact or fuzzy)
  const selectedDirVendor = useMemo(() => directory.find(v => v.name.toLowerCase() === addName.toLowerCase()), [addName, directory]);

  // Fuzzy match: find best match ≥80% similarity (but not exact)
  const fuzzyDirVendor = useMemo(() => {
    if (!addName.trim() || selectedDirVendor || skipFuzzy) return null;
    let best: Vendor | null = null, bestScore = 0;
    for (const v of directory) {
      const score = nameSimilarity(addName, v.name);
      if (score >= 0.8 && score > bestScore) { best = v; bestScore = score; }
    }
    return best;
  }, [addName, directory, selectedDirVendor, skipFuzzy]);

  const typeBadge = (type: string) => {
    return <Badge className="text-[9px] px-1 py-0 text-white" style={{ backgroundColor: '#c37e87' }}>{type}</Badge>;
  };

  const sh = (label: string, key: string) => <SortBtn label={label} active={sortKey === key} dir={sortDir} onClick={() => toggle(key)} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: '#7b7c81' }}>Vendors</h1>
        <Button size="sm" onClick={() => setOpen(true)}><Plus size={14} /> Add</Button>
      </div>

      {/* Add vendor dialog */}
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setAddName(''); setSkipFuzzy(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Vendor to Project</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <AutocompleteInput name="name" required suggestions={directorySuggestions} value={addName} onChange={v => { setAddName(v); setSkipFuzzy(false); }} className="h-8 text-xs" placeholder="Search directory or enter new..." />
              {selectedDirVendor && (
                <p className="text-[10px] text-muted-foreground">Found in directory: {selectedDirVendor.detail} ({selectedDirVendor.type})</p>
              )}
              {fuzzyDirVendor && (
                <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 space-y-1.5">
                  <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">Similar vendor found in directory:</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">{fuzzyDirVendor.name} — {fuzzyDirVendor.detail} ({fuzzyDirVendor.type})</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => linkExistingVendor(fuzzyDirVendor)}>Use This Vendor</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setSkipFuzzy(true)}>Create New Instead</Button>
                  </div>
                </div>
              )}
            </div>
            {!selectedDirVendor && !fuzzyDirVendor && (
              <>
                <div className="space-y-1"><Label className="text-xs">Detail / Trade</Label><Input name="detail" required className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Type</Label>
                  <Select name="type" defaultValue="Subcontractor"><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Subcontractor">Subcontractor</SelectItem><SelectItem value="Vendor">Vendor</SelectItem><SelectItem value="Consultant">Consultant</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Contact</Label><Input name="contact" className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Email</Label><Input name="email" type="email" className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Phone</Label><Input name="phone" className="h-8 text-xs" /></div>
              </>
            )}
            {!fuzzyDirVendor && <Button type="submit" size="sm" className="w-full">{selectedDirVendor ? 'Link to Project' : 'Save & Link'}</Button>}
          </form>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{sh('Name', 'name')}</TableHead>
                <TableHead>{sh('Detail', 'detail')}</TableHead>
                {!isMobile && <TableHead>{sh('Type', 'type')}</TableHead>}
                {!isMobile && <TableHead>{sh('Contact', 'contact')}</TableHead>}
                {!isMobile && <TableHead>{sh('Email', 'email')}</TableHead>}
                {!isMobile && <TableHead>{sh('Phone', 'phone')}</TableHead>}
                <TableHead className={isMobile ? 'w-8' : 'w-16'}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v, idx) => (
                <TableRow key={v.id} style={idx % 2 === 0 ? { backgroundColor: 'rgba(195, 126, 135, 0.12)' } : undefined} onKeyDown={editId === v.id ? (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(); } else if (e.key === 'Escape') cancelEdit(); } : undefined}>
                  {editId === v.id ? (
                    isMobile ? (
                      <>
                        <TableCell><Input value={editData.name || ''} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} className="h-6 text-[10px] px-1" /></TableCell>
                        <TableCell><Input value={editData.detail || ''} onChange={e => setEditData(d => ({ ...d, detail: e.target.value }))} className="h-6 text-[10px] px-1" /></TableCell>
                        <TableCell><div className="flex gap-1"><button onClick={saveEdit} className="text-[hsl(var(--success))]"><Check size={13} /></button><button onClick={cancelEdit} className="text-destructive"><X size={13} /></button></div></TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell><Input value={editData.name || ''} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} className="h-6 text-xs px-1" /></TableCell>
                        <TableCell><Input value={editData.detail || ''} onChange={e => setEditData(d => ({ ...d, detail: e.target.value }))} className="h-6 text-xs px-1" /></TableCell>
                        <TableCell>
                          <select value={editData.type} onChange={e => setEditData(d => ({ ...d, type: e.target.value as Vendor['type'] }))} className="h-6 text-[10px] border rounded px-1 bg-background">
                            <option>Subcontractor</option><option>Vendor</option><option>Consultant</option>
                          </select>
                        </TableCell>
                        <TableCell><Input value={editData.contact || ''} onChange={e => setEditData(d => ({ ...d, contact: e.target.value }))} className="h-6 text-xs px-1" /></TableCell>
                        <TableCell><Input value={editData.email || ''} onChange={e => setEditData(d => ({ ...d, email: e.target.value }))} className="h-6 text-xs px-1" /></TableCell>
                        <TableCell><Input value={editData.phone || ''} onChange={e => setEditData(d => ({ ...d, phone: e.target.value }))} className="h-6 text-xs px-1" /></TableCell>
                        <TableCell><div className="flex gap-1"><button onClick={saveEdit} className="text-[hsl(var(--success))]"><Check size={14} /></button><button onClick={cancelEdit} className="text-destructive"><X size={14} /></button></div></TableCell>
                      </>
                    )
                  ) : (
                  <>
                      <TableCell className="text-[11px] md:text-sm truncate max-w-[120px] md:max-w-none">{v.name}</TableCell>
                      <TableCell className="text-[11px] md:text-sm truncate max-w-[100px] md:max-w-none">{v.detail}</TableCell>
                      {!isMobile && <TableCell>{typeBadge(v.type)}</TableCell>}
                      {!isMobile && <TableCell className="text-[11px] md:text-sm">{v.contact || '—'}</TableCell>}
                      {!isMobile && <TableCell className="text-[11px] md:text-sm text-primary">{v.email || '—'}</TableCell>}
                      {!isMobile && <TableCell className="text-[11px] md:text-sm">{v.phone || '—'}</TableCell>}
                      <TableCell>
                        {undoInfo?.id === v.id ? (
                          <button onClick={handleUndo} className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline whitespace-nowrap"><Undo2 size={11} /> Undo</button>
                        ) : confirmDeleteId === v.id ? (
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <span className="text-[10px] text-muted-foreground">Remove?</span>
                            <button onClick={() => unlinkVendor(v.id)} className="text-destructive hover:opacity-70"><Check size={13} /></button>
                            <button onClick={() => setConfirmDeleteId(null)} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5">
                            <button onClick={() => startEdit(v)} className="text-muted-foreground hover:text-foreground"><Pencil size={12} /></button>
                            <button onClick={() => setConfirmDeleteId(v.id)} className="text-muted-foreground/40 hover:text-destructive"><Trash2 size={12} /></button>
                          </div>
                        )}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
              {filtered.length === 0 && !search && (
                <TableRow>
                  <TableCell colSpan={isMobile ? 3 : 7} className="text-center text-xs text-muted-foreground py-6">
                    No vendors linked to this project yet. Click "Add" to link vendors from the directory.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
