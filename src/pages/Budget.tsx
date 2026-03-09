import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Check, X, ChevronUp, ChevronDown, MessageSquare, Loader2 } from 'lucide-react';
import { BudgetItem } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';

const fmt = (n: number) => n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n) : '—';
const fmtN = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

const DEFAULT_CATEGORIES = ['Site', 'Exterior', 'Interior', 'Fixtures & Fittings', 'Landscape', 'Extras'];

type DbBudgetItem = {
  id: string; project_id: string; category: string; description: string;
  labor: number; material: number; optional: number; subcontractor: string;
  notes: string; status: string; sort_order: number;
};

export default function BudgetPage({ readOnly }: { readOnly?: boolean }) {
  const { selectedProject } = useProject();
  const isMobile = useIsMobile();

  const [items, setItems] = useState<DbBudgetItem[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [designFeePct, setDesignFeePct] = useState(0.10);
  const [buildFeePct, setBuildFeePct] = useState(0.15);
  const [loading, setLoading] = useState(true);

  // ── Load data from Supabase ────────────────────────────────────────────
  const loadData = useCallback(async (projectId: string) => {
    setLoading(true);
    const [{ data: itemsData }, { data: settingsData }] = await Promise.all([
      supabase.from('budget_items').select('*').eq('project_id', projectId).order('sort_order'),
      supabase.from('budget_settings').select('*').eq('project_id', projectId).maybeSingle(),
    ]);
    setItems((itemsData as DbBudgetItem[]) || []);
    if (settingsData) {
      setCategories((settingsData.category_order as string[])?.length ? settingsData.category_order as string[] : DEFAULT_CATEGORIES);
      setDesignFeePct(settingsData.design_fee_pct ?? 0.10);
      setBuildFeePct(settingsData.build_fee_pct ?? 0.15);
    } else {
      setCategories(DEFAULT_CATEGORIES);
      setDesignFeePct(0.10);
      setBuildFeePct(0.15);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(selectedProject.id); }, [selectedProject.id, loadData]);

  // ── Save settings to Supabase ──────────────────────────────────────────
  const saveSettings = useCallback(async (cats: string[], design: number, build: number) => {
    await supabase.from('budget_settings').upsert({
      project_id: selectedProject.id,
      category_order: cats,
      design_fee_pct: design,
      build_fee_pct: build,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id' });
  }, [selectedProject.id]);

  // ── Category actions ───────────────────────────────────────────────────
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const startRenameCat = (cat: string) => { setEditingCat(cat); setEditCatName(cat); };

  const saveRenameCat = async () => {
    const name = editCatName.trim();
    if (name && editingCat && name !== editingCat) {
      const newCats = categories.map(c => c === editingCat ? name : c);
      setCategories(newCats);
      // Update items with old category name
      const toUpdate = items.filter(b => b.category === editingCat);
      setItems(prev => prev.map(b => b.category === editingCat ? { ...b, category: name } : b));
      await Promise.all([
        saveSettings(newCats, designFeePct, buildFeePct),
        ...toUpdate.map(b => supabase.from('budget_items').update({ category: name }).eq('id', b.id)),
      ]);
    }
    setEditingCat(null);
  };

  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    const newCats = [...categories, name];
    setCategories(newCats);
    await saveSettings(newCats, designFeePct, buildFeePct);
    setNewCatName(''); setAddingCat(false);
  };

  const moveCat = async (cat: string, dir: 'up' | 'down') => {
    const idx = categories.indexOf(cat);
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === categories.length - 1) return;
    const next = [...categories];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setCategories(next);
    await saveSettings(next, designFeePct, buildFeePct);
  };

  // ── Item ordering ──────────────────────────────────────────────────────
  const orderedItems = useMemo(() => [...items].sort((a, b) => a.sort_order - b.sort_order), [items]);
  const descriptionSuggestions = useMemo(() => [...new Set(items.map(b => b.description).filter(Boolean))], [items]);
  const subcontractorSuggestions = useMemo(() => [...new Set(items.map(b => b.subcontractor).filter(Boolean))], [items]);

  const moveItem = async (itemId: string, dir: 'up' | 'down') => {
    const item = items.find(b => b.id === itemId);
    if (!item) return;
    const catItems = orderedItems.filter(b => b.category === item.category);
    const idx = catItems.findIndex(b => b.id === itemId);
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === catItems.length - 1) return;
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    const a = catItems[idx];
    const b = catItems[swap];
    // Swap sort_order values
    setItems(prev => prev.map(i => {
      if (i.id === a.id) return { ...i, sort_order: b.sort_order };
      if (i.id === b.id) return { ...i, sort_order: a.sort_order };
      return i;
    }));
    await Promise.all([
      supabase.from('budget_items').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('budget_items').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
  };

  // Build table rows
  const rows = useMemo(() => {
    const result: (DbBudgetItem | { _header: string })[] = [];
    const knownCatSet = new Set(categories);
    categories.forEach(cat => {
      result.push({ _header: cat });
      orderedItems.filter(b => b.category === cat).forEach(b => result.push(b));
    });
    const orphans = orderedItems.filter(b => !knownCatSet.has(b.category));
    if (orphans.length) {
      result.push({ _header: 'Other' });
      orphans.forEach(b => result.push(b));
    }
    return result;
  }, [orderedItems, categories]);

  // ── Row edit ───────────────────────────────────────────────────────────
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<DbBudgetItem>>({});
  const startEdit = (b: DbBudgetItem) => { setEditId(b.id); setEditData({ ...b }); };
  const cancelEdit = () => { setEditId(null); setEditData({}); };
  const saveEdit = async () => {
    setItems(prev => prev.map(b => b.id === editId ? { ...b, ...editData } as DbBudgetItem : b));
    await supabase.from('budget_items').update({
      category: editData.category, description: editData.description,
      labor: editData.labor, material: editData.material,
      status: editData.status,
    }).eq('id', editId!);
    cancelEdit();
  };

  // ── Add item ───────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newData, setNewData] = useState<Partial<DbBudgetItem>>({
    category: categories[0] || 'Site', description: '', labor: 0, material: 0, status: 'estimated',
  });

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const maxOrder = items.length ? Math.max(...items.map(b => b.sort_order)) : -1;
    const { data } = await supabase.from('budget_items').insert({
      project_id: selectedProject.id,
      category: fd.get('category') as string,
      description: fd.get('description') as string,
      labor: parseFloat(fd.get('labor') as string) || 0,
      material: parseFloat(fd.get('material') as string) || 0,
      optional: 0,
      subcontractor: fd.get('subcontractor') as string || '',
      notes: '',
      status: fd.get('status') as string,
      sort_order: maxOrder + 1,
    }).select().single();
    if (data) setItems(prev => [...prev, data as DbBudgetItem]);
    setAddOpen(false);
  };

  const handleAddInline = async () => {
    if (!newData.description) return;
    const maxOrder = items.length ? Math.max(...items.map(b => b.sort_order)) : -1;
    const { data } = await supabase.from('budget_items').insert({
      project_id: selectedProject.id,
      optional: 0, subcontractor: '', notes: '',
      ...newData,
      sort_order: maxOrder + 1,
    }).select().single();
    if (data) setItems(prev => [...prev, data as DbBudgetItem]);
    setAdding(false);
    setNewData({ category: categories[0] || 'Site', description: '', labor: 0, material: 0, status: 'estimated' });
  };

  // ── Notes / details ────────────────────────────────────────────────────
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteSub, setNoteSub] = useState('');
  const openNote = (b: DbBudgetItem) => { setNoteId(b.id); setNoteText(b.notes || ''); setNoteSub(b.subcontractor || ''); };
  const saveNote = async () => {
    if (noteId) {
      setItems(prev => prev.map(b => b.id === noteId ? { ...b, notes: noteText, subcontractor: noteSub } : b));
      await supabase.from('budget_items').update({ notes: noteText, subcontractor: noteSub }).eq('id', noteId);
    }
    setNoteId(null); setNoteText(''); setNoteSub('');
  };

  // ── Fee editing ────────────────────────────────────────────────────────
  const [editingFee, setEditingFee] = useState<'design' | 'build' | null>(null);
  const [feeInput, setFeeInput] = useState('');
  const openFeeEdit = (type: 'design' | 'build') => {
    setEditingFee(type);
    setFeeInput(String(Math.round((type === 'design' ? designFeePct : buildFeePct) * 100)));
  };
  const saveFee = async () => {
    const val = parseFloat(feeInput);
    if (!isNaN(val) && val >= 0) {
      const pct = val / 100;
      const newDesign = editingFee === 'design' ? pct : designFeePct;
      const newBuild = editingFee === 'build' ? pct : buildFeePct;
      if (editingFee === 'design') setDesignFeePct(pct);
      else setBuildFeePct(pct);
      await saveSettings(categories, newDesign, newBuild);
    }
    setEditingFee(null);
  };

  // ── Totals ─────────────────────────────────────────────────────────────
  const grandLabor = items.reduce((s, b) => s + b.labor, 0);
  const grandMaterial = items.reduce((s, b) => s + b.material, 0);
  const hardCostTotal = grandLabor + grandMaterial;
  const designFee = hardCostTotal * designFeePct;
  const buildFee = hardCostTotal * buildFeePct;
  const projectedGrandTotal = hardCostTotal + designFee + buildFee;

  const statusBadge = (s: string) => {
    const c: Record<string, string> = { contracted: '#c37e87', complete: '#7ba889', proposed: '#7b9ec3', estimated: '#c3a87b' };
    return <Badge className="text-[9px] px-1 py-0 capitalize text-white" style={{ backgroundColor: c[s] || '#c37e87' }}>{s}</Badge>;
  };

  const totalCols = isMobile ? 5 : 6;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground gap-2">
        <Loader2 size={16} className="animate-spin" /> Loading budget...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: '#7b7c81' }}>Budget</h1>
        {!readOnly && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAddingCat(true)}><Plus size={14} /> Subgroup</Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Add</Button>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Hard Cost Total</p>
          <p className="text-sm md:text-base font-bold tabular-nums">{fmtN(hardCostTotal)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Design Fee ({Math.round(designFeePct * 100)}%)</p>
            {!readOnly && <button onClick={() => openFeeEdit('design')} className="text-muted-foreground/40 hover:text-foreground ml-1"><Pencil size={10} /></button>}
          </div>
          <p className="text-sm md:text-base font-bold tabular-nums">{fmtN(designFee)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Build Fee ({Math.round(buildFeePct * 100)}%)</p>
            {!readOnly && <button onClick={() => openFeeEdit('build')} className="text-muted-foreground/40 hover:text-foreground ml-1"><Pencil size={10} /></button>}
          </div>
          <p className="text-sm md:text-base font-bold tabular-nums">{fmtN(buildFee)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Projected Grand Total</p>
          <p className="text-sm md:text-base font-bold tabular-nums">{fmtN(projectedGrandTotal)}</p>
        </CardContent></Card>
      </div>

      {/* Add item dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Budget Item</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Subgroup</Label>
              <Select name="category" defaultValue={categories[0] || 'Site'}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Description</Label><AutocompleteInput name="description" required suggestions={descriptionSuggestions} className="h-8 text-xs" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Labor</Label><CurrencyInput name="labor" defaultValue={0} className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Material</Label><CurrencyInput name="material" defaultValue={0} className="h-8 text-xs" /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Subcontractor</Label><AutocompleteInput name="subcontractor" suggestions={subcontractorSuggestions} className="h-8 text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Status</Label>
              <Select name="status" defaultValue="estimated">
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="estimated">Estimated</SelectItem>
                  <SelectItem value="proposed">Proposed</SelectItem>
                  <SelectItem value="contracted">Contracted</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" size="sm" className="w-full">Save</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add subgroup dialog */}
      <Dialog open={addingCat} onOpenChange={setAddingCat}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Add Subgroup</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input value={newCatName} onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') setAddingCat(false); }}
              className="h-8 text-xs" placeholder="Subgroup name..." autoFocus />
            <Button size="sm" onClick={addCategory}>Add</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notes dialog */}
      <Dialog open={noteId !== null} onOpenChange={(o) => { if (!o) { setNoteId(null); setNoteText(''); setNoteSub(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Edit Details</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="space-y-1"><Label className="text-xs">Subcontractor</Label><AutocompleteInput value={noteSub} onChange={v => setNoteSub(v)} suggestions={subcontractorSuggestions} className="h-8 text-xs" placeholder="Subcontractor name..." /></div>
            <div className="space-y-1"><Label className="text-xs">Notes</Label><Textarea value={noteText} onChange={e => setNoteText(e.target.value)} className="text-xs min-h-[80px]" placeholder="Add a note..." /></div>
          </div>
          <Button size="sm" onClick={saveNote} className="w-full">Save</Button>
        </DialogContent>
      </Dialog>

      {/* Fee edit dialog */}
      <Dialog open={editingFee !== null} onOpenChange={(o) => { if (!o) setEditingFee(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="text-sm">Edit {editingFee === 'design' ? 'Design' : 'Build'} Fee %</DialogTitle></DialogHeader>
          <div className="flex items-center gap-2">
            <Input value={feeInput} onChange={e => setFeeInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveFee(); if (e.key === 'Escape') setEditingFee(null); }}
              type="number" min="0" max="100" step="0.1" className="h-8 text-xs" autoFocus />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <Button size="sm" onClick={saveFee} className="w-full mt-2">Save</Button>
        </DialogContent>
      </Dialog>

      {/* Main table — column widths via colgroup for consistent spacing */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <colgroup>
              <col style={{ width: 24 }} />
              <col style={{ width: 180 }} />
              {!isMobile && <col style={{ width: 88 }} />}
              <col style={{ width: 100 }} />
              <col style={{ width: 116 }} />
              <col style={{ width: 48 }} />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="w-5 px-1" />
                <TableHead>Description</TableHead>
                {!isMobile && <TableHead className="text-right whitespace-nowrap px-4">Labor</TableHead>}
                <TableHead className="text-right whitespace-nowrap px-4 pr-6">{isMobile ? 'Total' : 'Material'}</TableHead>
                <TableHead className="whitespace-nowrap pl-6 pr-4">Status</TableHead>
                <TableHead className="text-right w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item, idx) => {
                if ('_header' in item) {
                  const cat = item._header;
                  const catIdx = categories.indexOf(cat);
                  const isOther = cat === 'Other';
                  return (
                    <TableRow key={`hdr-${cat}`} className="bg-accent/60">
                      <TableCell className="px-1 py-1 w-5">
                        {!readOnly && !isOther && (
                          <div className="flex flex-col">
                            <button onClick={() => moveCat(cat, 'up')} disabled={catIdx === 0} className="text-muted-foreground/50 hover:text-foreground disabled:opacity-20 leading-none"><ChevronUp size={10} /></button>
                            <button onClick={() => moveCat(cat, 'down')} disabled={catIdx === categories.length - 1} className="text-muted-foreground/50 hover:text-foreground disabled:opacity-20 leading-none"><ChevronDown size={10} /></button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell colSpan={isMobile ? 3 : 4} className="py-1.5">
                        {editingCat === cat ? (
                          <div className="flex items-center gap-1">
                            <Input value={editCatName} onChange={e => setEditCatName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveRenameCat(); if (e.key === 'Escape') setEditingCat(null); }}
                              className="h-6 text-xs font-bold uppercase tracking-wider w-40 px-1" autoFocus />
                            <button onClick={saveRenameCat} className="text-[hsl(var(--success))]"><Check size={13} /></button>
                            <button onClick={() => setEditingCat(null)} className="text-destructive"><X size={13} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs uppercase tracking-wider text-accent-foreground">{cat}</span>
                            {!readOnly && !isOther && <button onClick={() => startRenameCat(cat)} className="text-muted-foreground/30 hover:text-muted-foreground"><Pencil size={10} /></button>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-1" />
                    </TableRow>
                  );
                }

                const b = item as DbBudgetItem;
                const catItems = orderedItems.filter(x => x.category === b.category);
                const itemIdx = catItems.findIndex(x => x.id === b.id);
                const hasDetails = b.notes || b.subcontractor;

                return (
                  <TableRow key={b.id} style={idx % 2 === 0 ? { backgroundColor: 'rgba(195, 126, 135, 0.12)' } : undefined}>
                    <TableCell className="px-1 py-0 w-5">
                      {!readOnly && (
                        <div className="flex flex-col">
                          <button onClick={() => moveItem(b.id, 'up')} disabled={itemIdx === 0} className="text-muted-foreground/40 hover:text-foreground disabled:opacity-20 leading-none"><ChevronUp size={10} /></button>
                          <button onClick={() => moveItem(b.id, 'down')} disabled={itemIdx === catItems.length - 1} className="text-muted-foreground/40 hover:text-foreground disabled:opacity-20 leading-none"><ChevronDown size={10} /></button>
                        </div>
                      )}
                    </TableCell>
                    {editId === b.id ? (
                      isMobile ? (
                        <>
                          <TableCell><AutocompleteInput value={editData.description || ''} onChange={v => setEditData(d => ({ ...d, description: v }))} suggestions={descriptionSuggestions} className="h-6 text-[10px] px-1" /></TableCell>
                          <TableCell className="pr-6"><CurrencyInput value={(editData.labor || 0) + (editData.material || 0)} onChange={v => setEditData(d => ({ ...d, labor: v, material: 0 }))} className="h-6 text-[10px] w-full px-1" /></TableCell>
                          <TableCell className="pl-6">
                            <select value={editData.status} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))} className="h-5 text-[9px] border rounded px-0.5 bg-background">
                              <option value="estimated">est</option><option value="proposed">prop</option><option value="contracted">cont</option><option value="complete">done</option>
                            </select>
                          </TableCell>
                          <TableCell><div className="flex gap-1"><button onClick={saveEdit} className="text-[hsl(var(--success))]"><Check size={13} /></button><button onClick={cancelEdit} className="text-destructive"><X size={13} /></button></div></TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <div className="flex gap-1 items-center">
                              <Select value={editData.category || b.category} onValueChange={v => setEditData(d => ({ ...d, category: v }))}>
                                <SelectTrigger className="h-6 text-[10px] w-28"><SelectValue /></SelectTrigger>
                                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                              </Select>
                              <AutocompleteInput value={editData.description || ''} onChange={v => setEditData(d => ({ ...d, description: v }))} suggestions={descriptionSuggestions} className="h-6 text-xs px-1" />
                            </div>
                          </TableCell>
                          <TableCell><CurrencyInput value={editData.labor || 0} onChange={v => setEditData(d => ({ ...d, labor: v }))} className="h-6 text-xs w-24 px-1" /></TableCell>
                          <TableCell className="pr-6"><CurrencyInput value={editData.material || 0} onChange={v => setEditData(d => ({ ...d, material: v }))} className="h-6 text-xs w-24 px-1" /></TableCell>
                          <TableCell className="pl-6">
                            <select value={editData.status} onChange={e => setEditData(d => ({ ...d, status: e.target.value }))} className="h-6 text-[10px] border rounded px-1 bg-background">
                              <option value="estimated">estimated</option><option value="proposed">proposed</option><option value="contracted">contracted</option><option value="complete">complete</option>
                            </select>
                          </TableCell>
                          <TableCell><div className="flex gap-1 items-center"><button onClick={saveEdit} className="text-[hsl(var(--success))]"><Check size={14} /></button><button onClick={cancelEdit} className="text-destructive"><X size={14} /></button></div></TableCell>
                        </>
                      )
                    ) : (
                    <>
                        <TableCell className="text-[11px] md:text-sm truncate max-w-[120px] md:max-w-none">{b.description}</TableCell>
                        {!isMobile && <TableCell className="text-right tabular-nums text-[11px] md:text-sm px-4">{fmt(b.labor)}</TableCell>}
                        <TableCell className="text-right tabular-nums text-[11px] md:text-sm px-4 pr-6">{isMobile ? fmt(b.labor + b.material) : fmt(b.material)}</TableCell>
                        <TableCell className="pl-6 pr-4">{statusBadge(b.status)}</TableCell>
                        <TableCell className="text-right">
                          {!readOnly && (
                            <div className="flex gap-1.5 justify-end">
                              {!isMobile && (
                                <button onClick={() => openNote(b)} className={`hover:text-foreground ${hasDetails ? 'text-primary' : 'text-muted-foreground/40'}`} title={hasDetails ? `${b.subcontractor || ''}${b.subcontractor && b.notes ? ' | ' : ''}${b.notes || ''}` : 'Add details'}>
                                  <MessageSquare size={12} />
                                </button>
                              )}
                              <button onClick={() => startEdit(b)} className="text-muted-foreground hover:text-foreground"><Pencil size={12} /></button>
                            </div>
                          )}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}

              {!readOnly && (adding ? (
                <TableRow className="bg-muted/30">
                  <TableCell className="px-1 w-5" />
                  <TableCell>
                    {isMobile ? (
                      <AutocompleteInput value={newData.description || ''} onChange={v => setNewData(d => ({ ...d, description: v }))} suggestions={descriptionSuggestions} className="h-6 text-[10px] px-1" placeholder="Description" autoFocus />
                    ) : (
                      <div className="flex gap-1">
                        <select value={newData.category || categories[0]} onChange={e => setNewData(d => ({ ...d, category: e.target.value }))} className="h-6 text-[10px] border rounded px-1 bg-background w-28">
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <AutocompleteInput value={newData.description || ''} onChange={v => setNewData(d => ({ ...d, description: v }))} suggestions={descriptionSuggestions} className="h-6 text-xs px-1" placeholder="Description" autoFocus />
                      </div>
                    )}
                  </TableCell>
                  {!isMobile && <TableCell><CurrencyInput value={newData.labor || 0} onChange={v => setNewData(d => ({ ...d, labor: v }))} className="h-6 text-xs w-24 px-1" placeholder="0" /></TableCell>}
                  <TableCell className="pr-6"><CurrencyInput value={isMobile ? (newData.labor || 0) : (newData.material || 0)} onChange={v => { isMobile ? setNewData(d => ({ ...d, labor: v })) : setNewData(d => ({ ...d, material: v })); }} className="h-6 text-[10px] w-full md:w-24 px-1" placeholder="0" /></TableCell>
                  <TableCell className="pl-6">
                    <select value={newData.status || 'estimated'} onChange={e => setNewData(d => ({ ...d, status: e.target.value }))} className="h-5 md:h-6 text-[9px] md:text-[10px] border rounded px-0.5 md:px-1 bg-background">
                      <option value="estimated">{isMobile ? 'est' : 'estimated'}</option>
                      <option value="proposed">{isMobile ? 'prop' : 'proposed'}</option>
                      <option value="contracted">{isMobile ? 'cont' : 'contracted'}</option>
                      <option value="complete">{isMobile ? 'done' : 'complete'}</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <button onClick={handleAddInline} className="text-[hsl(var(--success))]"><Check size={13} /></button>
                      <button onClick={() => { setAdding(false); setNewData({ category: categories[0] || 'Site', description: '', labor: 0, material: 0, status: 'estimated' }); }} className="text-destructive"><X size={13} /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={totalCols}>
                    <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-0.5">
                      <Plus size={12} /> Add row
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>

            <TableFooter>
              <TableRow style={{ backgroundColor: 'rgba(195, 126, 135, 0.12)' }}>
                <TableCell /><TableCell className="font-semibold text-[11px]">{isMobile ? 'Labor / Material' : 'Labor / Material Totals'}</TableCell>
                {!isMobile && <TableCell className="text-right font-semibold tabular-nums">{fmtN(grandLabor)}</TableCell>}
                <TableCell className="text-right font-semibold tabular-nums pr-6">{isMobile ? fmtN(hardCostTotal) : fmtN(grandMaterial)}</TableCell>
                <TableCell colSpan={isMobile ? 1 : 2} />
              </TableRow>
              <TableRow style={{ backgroundColor: 'rgba(195, 126, 135, 0.12)' }}>
                <TableCell /><TableCell className="font-semibold text-[11px]">Hard Cost Total</TableCell>
                <TableCell colSpan={isMobile ? 1 : 2} className="text-right font-semibold tabular-nums">{fmtN(hardCostTotal)}</TableCell>
                <TableCell colSpan={isMobile ? 1 : 2} />
              </TableRow>
              <TableRow style={{ backgroundColor: 'rgba(195, 126, 135, 0.12)' }}>
                <TableCell />
                <TableCell className="font-semibold text-[11px]"><span className="flex items-center gap-1">Design Fee ({Math.round(designFeePct * 100)}%){!readOnly && <button onClick={() => openFeeEdit('design')} className="text-muted-foreground/40 hover:text-foreground"><Pencil size={9} /></button>}</span></TableCell>
                <TableCell colSpan={isMobile ? 1 : 2} className="text-right font-semibold tabular-nums">{fmtN(designFee)}</TableCell>
                <TableCell colSpan={isMobile ? 1 : 2} />
              </TableRow>
              <TableRow style={{ backgroundColor: 'rgba(195, 126, 135, 0.12)' }}>
                <TableCell />
                <TableCell className="font-semibold text-[11px]"><span className="flex items-center gap-1">Build Fee ({Math.round(buildFeePct * 100)}%){!readOnly && <button onClick={() => openFeeEdit('build')} className="text-muted-foreground/40 hover:text-foreground"><Pencil size={9} /></button>}</span></TableCell>
                <TableCell colSpan={isMobile ? 1 : 2} className="text-right font-semibold tabular-nums">{fmtN(buildFee)}</TableCell>
                <TableCell colSpan={isMobile ? 1 : 2} />
              </TableRow>
              <TableRow className="bg-accent/40">
                <TableCell /><TableCell className="font-bold text-[11px]">Projected Grand Total</TableCell>
                <TableCell colSpan={isMobile ? 1 : 2} className="text-right font-bold tabular-nums text-sm md:text-base">{fmtN(projectedGrandTotal)}</TableCell>
                <TableCell colSpan={isMobile ? 1 : 2} />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
