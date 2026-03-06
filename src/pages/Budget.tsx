import React, { useState, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { mockBudgetItems } from '@/data/mock-data';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Check, X, ChevronUp, ChevronDown, ChevronsUpDown, MessageSquare } from 'lucide-react';
import { BudgetItem } from '@/types';

const fmt = (n: number) => n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n) : '—';

function SortBtn({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: string; onClick: () => void; className?: string }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-0.5 hover:text-foreground ${className || ''}`}>{label}{active ? (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="opacity-30" />}</button>;
}

export default function BudgetPage() {
  const { selectedProject } = useProject();
  const [items, setItems] = useState<BudgetItem[]>(mockBudgetItems);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<BudgetItem>>({});
  const [sortKey, setSortKey] = useState('category');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const toggle = (k: string) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc'); } };

  const filtered = items.filter(b => b.project_id === selectedProject.id);

  const sorted = useMemo(() => [...filtered].sort((a: any, b: any) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av ?? '').localeCompare(String(bv ?? '')) : String(bv ?? '').localeCompare(String(av ?? ''));
  }), [filtered, sortKey, sortDir]);

  const grandLabor = filtered.reduce((s, b) => s + b.labor, 0);
  const grandMaterial = filtered.reduce((s, b) => s + b.material, 0);
  const hardCostTotal = grandLabor + grandMaterial;
  const designFee = hardCostTotal * 0.10;
  const buildFee = hardCostTotal * 0.15;
  const projectedGrandTotal = hardCostTotal + designFee + buildFee;

  const startEdit = (b: BudgetItem) => { setEditId(b.id); setEditData({ ...b }); };
  const cancelEdit = () => { setEditId(null); setEditData({}); };
  const saveEdit = () => { setItems(prev => prev.map(b => b.id === editId ? { ...b, ...editData } as BudgetItem : b)); cancelEdit(); };

  const openNote = (b: BudgetItem) => { setNoteId(b.id); setNoteText(b.notes || ''); };
  const saveNote = () => {
    if (noteId) setItems(prev => prev.map(b => b.id === noteId ? { ...b, notes: noteText } : b));
    setNoteId(null); setNoteText('');
  };

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setItems(prev => [...prev, {
      id: Date.now().toString(), project_id: selectedProject.id,
      category: fd.get('category') as string, description: fd.get('description') as string,
      labor: parseFloat(fd.get('labor') as string) || 0, material: parseFloat(fd.get('material') as string) || 0,
      optional: 0, subcontractor: fd.get('subcontractor') as string,
      notes: '', status: fd.get('status') as BudgetItem['status'],
    }]);
    setOpen(false);
  };

  const statusBadge = (s: string) => {
    const c: Record<string, string> = { complete: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]', 'in-progress': 'bg-primary text-primary-foreground', pending: 'bg-secondary text-secondary-foreground' };
    return <Badge className={`text-[9px] px-1 py-0 ${c[s] || ''}`}>{s}</Badge>;
  };

  const sh = (label: string, key: string, cls?: string) => <SortBtn label={label} active={sortKey === key} dir={sortDir} onClick={() => toggle(key)} className={cls} />;
  const fmtN = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Budget</h1>
          <p className="text-muted-foreground text-xs">Line-item budget</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus size={14} /> Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Budget Item</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Category</Label>
                <Select name="category" defaultValue="Site"><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{['Site','Exterior','Interior','Owner Purchased','Landscape','Extras'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Description</Label><Input name="description" required className="h-8 text-xs" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Labor</Label><Input name="labor" type="number" step="0.01" defaultValue="0" className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Material</Label><Input name="material" type="number" step="0.01" defaultValue="0" className="h-8 text-xs" /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Subcontractor</Label><Input name="subcontractor" className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Status</Label>
                <Select name="status" defaultValue="pending"><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="in-progress">In Progress</SelectItem><SelectItem value="complete">Complete</SelectItem></SelectContent>
                </Select>
              </div>
              <Button type="submit" size="sm" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[['Hard Cost Total', hardCostTotal], ['Design Fee (10%)', designFee], ['Build Fee (15%)', buildFee], ['Projected Grand Total', projectedGrandTotal]].map(([l, v]) => (
          <Card key={l as string}><CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{l as string}</p>
            <p className="text-base font-bold tabular-nums">{fmtN(v as number)}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Note popover */}
      <Dialog open={noteId !== null} onOpenChange={(o) => { if (!o) { setNoteId(null); setNoteText(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Edit Note</DialogTitle></DialogHeader>
          <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} className="text-xs min-h-[80px]" placeholder="Add a note..." />
          <Button size="sm" onClick={saveNote} className="w-full">Save Note</Button>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{sh('Category', 'category')}</TableHead>
                <TableHead>{sh('Description', 'description')}</TableHead>
                <TableHead className="text-right">{sh('Labor', 'labor', 'justify-end')}</TableHead>
                <TableHead className="text-right">{sh('Material', 'material', 'justify-end')}</TableHead>
                <TableHead>{sh('Sub', 'subcontractor')}</TableHead>
                <TableHead>{sh('Status', 'status')}</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(b => (
                <TableRow key={b.id}>
                  {editId === b.id ? (
                    <>
                      <TableCell>
                        <select value={editData.category || ''} onChange={e => setEditData(d => ({ ...d, category: e.target.value }))} className="h-6 text-[10px] border rounded px-1 bg-background">
                          {['Site','Exterior','Interior','Owner Purchased','Landscape','Extras'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </TableCell>
                      <TableCell><Input value={editData.description || ''} onChange={e => setEditData(d => ({ ...d, description: e.target.value }))} className="h-6 text-xs px-1" /></TableCell>
                      <TableCell><Input value={editData.labor || 0} onChange={e => setEditData(d => ({ ...d, labor: parseFloat(e.target.value) || 0 }))} type="number" className="h-6 text-xs w-20 px-1 text-right" /></TableCell>
                      <TableCell><Input value={editData.material || 0} onChange={e => setEditData(d => ({ ...d, material: parseFloat(e.target.value) || 0 }))} type="number" className="h-6 text-xs w-20 px-1 text-right" /></TableCell>
                      <TableCell><Input value={editData.subcontractor || ''} onChange={e => setEditData(d => ({ ...d, subcontractor: e.target.value }))} className="h-6 text-xs px-1 w-24" /></TableCell>
                      <TableCell>
                        <select value={editData.status} onChange={e => setEditData(d => ({ ...d, status: e.target.value as BudgetItem['status'] }))} className="h-6 text-[10px] border rounded px-1 bg-background">
                          <option value="pending">pending</option><option value="in-progress">in-progress</option><option value="complete">complete</option>
                        </select>
                      </TableCell>
                      <TableCell className="flex gap-1">
                        <button onClick={saveEdit} className="text-[hsl(var(--success))]"><Check size={14} /></button>
                        <button onClick={cancelEdit} className="text-destructive"><X size={14} /></button>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-muted-foreground text-[11px]">{b.category}</TableCell>
                      <TableCell className="font-medium">{b.description}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(b.labor)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(b.material)}</TableCell>
                      <TableCell className="text-muted-foreground">{b.subcontractor || '—'}</TableCell>
                      <TableCell>{statusBadge(b.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1.5">
                          <button onClick={() => openNote(b)} className={`hover:text-foreground ${b.notes ? 'text-primary' : 'text-muted-foreground/40'}`} title={b.notes || 'Add note'}>
                            <MessageSquare size={12} />
                          </button>
                          <button onClick={() => startEdit(b)} className="text-muted-foreground hover:text-foreground"><Pencil size={12} /></button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{fmtN(grandLabor)}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{fmtN(grandMaterial)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
