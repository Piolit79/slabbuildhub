import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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

function findFuzzyMatch(name: string, vendors: Vendor[]): Vendor | null {
  if (!name.trim()) return null;
  let best: Vendor | null = null, bestScore = 0;
  for (const v of vendors) {
    if (v.name.toLowerCase() === name.toLowerCase()) return null; // exact match = not fuzzy
    const score = nameSimilarity(name, v.name);
    if (score >= 0.8 && score > bestScore) { best = v; bestScore = score; }
  }
  return best;
}

function SortBtn({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: string; onClick: () => void; className?: string }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-0.5 hover:text-foreground ${className || ''}`}>{label}{active ? (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="opacity-30" />}</button>;
}

export default function VendorDirectoryPage() {
  const isMobile = useIsMobile();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('vendors').select('*').then(({ data }) => {
      if (data) setVendors(data as Vendor[]);
    });
  }, []);

  const [open, setOpen] = useState(false);
  const [dialogName, setDialogName] = useState('');
  const [dialogFuzzySkip, setDialogFuzzySkip] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Vendor>>({});
  const [adding, setAdding] = useState(false);
  const [newData, setNewData] = useState<Partial<Vendor>>({ name: '', detail: '', type: 'Subcontractor', contact: '', email: '', phone: '' });
  const [inlineFuzzyMatch, setInlineFuzzyMatch] = useState<Vendor | null>(null);
  const [inlineFuzzySkip, setInlineFuzzySkip] = useState(false);
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

  // Delete
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleteVendor = async (id: string) => {
    setVendors(prev => prev.filter(v => v.id !== id));
    await supabase.from('vendors').delete().eq('id', id);
    setConfirmDeleteId(null);
  };

  const toggle = (k: string) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc'); } };

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
    if (prev) showUndo(editId!, prev);
    cancelEdit();
  };

  const dialogFuzzyVendor = useMemo(() => {
    if (dialogFuzzySkip || !dialogName.trim()) return null;
    return findFuzzyMatch(dialogName, vendors);
  }, [dialogName, vendors, dialogFuzzySkip]);

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (dialogFuzzyVendor) return; // block submit while fuzzy suggestion is showing
    const fd = new FormData(e.currentTarget);
    const nv: Vendor = {
      id: Date.now().toString(), name: fd.get('name') as string, detail: fd.get('detail') as string,
      type: fd.get('type') as Vendor['type'], contact: fd.get('contact') as string,
      email: fd.get('email') as string, phone: fd.get('phone') as string,
    };
    await supabase.from('vendors').insert(nv);
    setVendors(prev => [...prev, nv]);
    setOpen(false);
    setDialogName('');
    setDialogFuzzySkip(false);
  };

  const typeBadge = (type: string) => {
    return <Badge className="text-[9px] px-1 py-0 text-white" style={{ backgroundColor: '#c37e87' }}>{type}</Badge>;
  };

  const sh = (label: string, key: string) => <SortBtn label={label} active={sortKey === key} dir={sortDir} onClick={() => toggle(key)} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: '#7b7c81' }}>Vendor Directory</h1>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setDialogName(''); setDialogFuzzySkip(false); } }}>
          <DialogTrigger asChild><Button size="sm"><Plus size={14} /> Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input name="name" required className="h-8 text-xs" value={dialogName} onChange={e => { setDialogName(e.target.value); setDialogFuzzySkip(false); }} />
                {dialogFuzzyVendor && (
                  <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 space-y-1.5">
                    <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">Similar vendor already exists:</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">{dialogFuzzyVendor.name} — {dialogFuzzyVendor.detail} ({dialogFuzzyVendor.type})</p>
                    <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setDialogFuzzySkip(true)}>Create Anyway</Button>
                  </div>
                )}
              </div>
              {!dialogFuzzyVendor && (
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
                  <Button type="submit" size="sm" className="w-full">Save</Button>
                </>
              )}
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
                            <span className="text-[10px] text-muted-foreground">Delete?</span>
                            <button onClick={() => deleteVendor(v.id)} className="text-destructive hover:opacity-70"><Check size={13} /></button>
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
              {adding ? (
                <>
                <TableRow className="bg-muted/30" onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); if (newData.name && !inlineFuzzyMatch) { const nv = { id: Date.now().toString(), ...newData } as Vendor; supabase.from('vendors').insert(nv); setVendors(prev => [...prev, nv]); setAdding(false); setNewData({ name: '', detail: '', type: 'Subcontractor', contact: '', email: '', phone: '' }); setInlineFuzzyMatch(null); setInlineFuzzySkip(false); } } else if (e.key === 'Escape') { setAdding(false); setNewData({ name: '', detail: '', type: 'Subcontractor', contact: '', email: '', phone: '' }); setInlineFuzzyMatch(null); setInlineFuzzySkip(false); } }}>
                  <TableCell><Input value={newData.name || ''} onChange={e => { setNewData(d => ({ ...d, name: e.target.value })); setInlineFuzzySkip(false); const m = findFuzzyMatch(e.target.value, vendors); setInlineFuzzyMatch(m); }} className="h-6 text-[10px] px-1" placeholder="Name" autoFocus /></TableCell>
                  <TableCell><Input value={newData.detail || ''} onChange={e => setNewData(d => ({ ...d, detail: e.target.value }))} className="h-6 text-[10px] px-1" placeholder="Detail" /></TableCell>
                  {!isMobile && (
                    <TableCell>
                      <select value={newData.type || 'Subcontractor'} onChange={e => setNewData(d => ({ ...d, type: e.target.value as Vendor['type'] }))} className="h-6 text-[10px] border rounded px-1 bg-background">
                        <option>Subcontractor</option><option>Vendor</option><option>Consultant</option>
                      </select>
                    </TableCell>
                  )}
                  {!isMobile && <TableCell><Input value={newData.contact || ''} onChange={e => setNewData(d => ({ ...d, contact: e.target.value }))} className="h-6 text-xs px-1" placeholder="Contact" /></TableCell>}
                  {!isMobile && <TableCell><Input value={newData.email || ''} onChange={e => setNewData(d => ({ ...d, email: e.target.value }))} className="h-6 text-xs px-1" placeholder="Email" /></TableCell>}
                  {!isMobile && <TableCell><Input value={newData.phone || ''} onChange={e => setNewData(d => ({ ...d, phone: e.target.value }))} className="h-6 text-xs px-1" placeholder="Phone" /></TableCell>}
                  <TableCell><div className="flex gap-1">
                    <button onClick={async () => { if (newData.name && (!inlineFuzzyMatch || inlineFuzzySkip)) { const nv = { id: Date.now().toString(), ...newData } as Vendor; await supabase.from('vendors').insert(nv); setVendors(prev => [...prev, nv]); setAdding(false); setNewData({ name: '', detail: '', type: 'Subcontractor', contact: '', email: '', phone: '' }); setInlineFuzzyMatch(null); setInlineFuzzySkip(false); } }} className="text-[hsl(var(--success))]"><Check size={13} /></button>
                    <button onClick={() => { setAdding(false); setNewData({ name: '', detail: '', type: 'Subcontractor', contact: '', email: '', phone: '' }); setInlineFuzzyMatch(null); setInlineFuzzySkip(false); }} className="text-destructive"><X size={13} /></button>
                  </div></TableCell>
                </TableRow>
                {inlineFuzzyMatch && !inlineFuzzySkip && (
                  <TableRow>
                    <TableCell colSpan={isMobile ? 3 : 7} className="py-1 px-2">
                      <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 flex items-center gap-3 text-[11px]">
                        <span className="text-amber-800 dark:text-amber-300">Similar vendor exists: <strong>{inlineFuzzyMatch.name}</strong> — {inlineFuzzyMatch.detail}</span>
                        <Button type="button" size="sm" variant="ghost" className="h-5 text-[10px] px-2" onClick={() => setInlineFuzzySkip(true)}>Create Anyway</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </>
              ) : (
                <TableRow>
                  <TableCell colSpan={isMobile ? 3 : 7}>
                    <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-0.5"><Plus size={12} /> Add row</button>
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
