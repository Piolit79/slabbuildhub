import React, { useState, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { mockDraws } from '@/data/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Check, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Draw } from '@/types';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

function SortBtn({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: string; onClick: () => void; className?: string }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-0.5 hover:text-foreground ${className || ''}`}>{label}{active ? (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="opacity-30" />}</button>;
}

export default function DrawsPage() {
  const { selectedProject } = useProject();
  const isMobile = useIsMobile();
  const [draws, setDraws] = useState<Draw[]>(mockDraws);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Draw>>({});
  const [adding, setAdding] = useState(false);
  const [newData, setNewData] = useState<Partial<Draw>>({ date: '', draw_number: 0, amount: 0 });
  const [sortKey, setSortKey] = useState('draw_number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggle = (k: string) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc'); } };

  const filtered = draws.filter(d => d.project_id === selectedProject.id);
  const sorted = useMemo(() => [...filtered].sort((a: any, b: any) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  }), [filtered, sortKey, sortDir]);
  const total = filtered.reduce((s, d) => s + d.amount, 0);

  const startEdit = (d: Draw) => { setEditId(d.id); setEditData({ ...d }); };
  const cancelEdit = () => { setEditId(null); setEditData({}); };
  const saveEdit = () => { setDraws(prev => prev.map(d => d.id === editId ? { ...d, ...editData } as Draw : d)); cancelEdit(); };

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setDraws(prev => [...prev, {
      id: Date.now().toString(), project_id: selectedProject.id,
      date: fd.get('date') as string, draw_number: parseInt(fd.get('draw_number') as string) || filtered.length + 1,
      amount: parseFloat(fd.get('amount') as string) || 0,
    }]);
    setOpen(false);
  };

  const sh = (label: string, key: string, cls?: string) => <SortBtn label={label} active={sortKey === key} dir={sortDir} onClick={() => toggle(key)} className={cls} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: '#7b7c81' }}>Draws</h1>
          <p className="text-muted-foreground text-xs">Bank draw requests</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus size={14} /> Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Draw Request</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Date</Label><Input name="date" type="date" required className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Draw #</Label><Input name="draw_number" type="number" defaultValue={filtered.length + 1} required className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Amount</Label><Input name="amount" type="number" step="0.01" required className="h-8 text-xs" /></div>
              <Button type="submit" size="sm" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-2 max-w-sm">
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Total Drawn</p>
          <p className="text-sm md:text-base font-bold tabular-nums">{fmt(total)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Draw Count</p>
          <p className="text-sm md:text-base font-bold">{filtered.length}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{sh('Draw #', 'draw_number')}</TableHead>
                <TableHead>{sh('Date', 'date')}</TableHead>
                <TableHead className="text-right">{sh('Amt', 'amount', 'justify-end')}</TableHead>
                <TableHead className={isMobile ? 'w-8' : 'w-10'}></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((d, idx) => {
                return (
                  <TableRow key={d.id} style={idx % 2 === 0 ? { backgroundColor: 'rgba(195, 126, 135, 0.12)' } : undefined}>
                    {editId === d.id ? (
                      isMobile ? (
                        <>
                          <TableCell><Input value={editData.draw_number || ''} onChange={e => setEditData(x => ({ ...x, draw_number: parseInt(e.target.value) || 0 }))} type="number" className="h-6 text-[10px] w-full px-1" /></TableCell>
                          <TableCell><Input value={editData.date || ''} onChange={e => setEditData(x => ({ ...x, date: e.target.value }))} type="date" className="h-6 text-[10px] w-full px-1" /></TableCell>
                          <TableCell className="text-right"><Input value={editData.amount || ''} onChange={e => setEditData(x => ({ ...x, amount: parseFloat(e.target.value) || 0 }))} type="number" step="0.01" className="h-6 text-[10px] w-full px-1 text-right" /></TableCell>
                          <TableCell><div className="flex gap-1"><button onClick={saveEdit} className="text-[hsl(var(--success))]"><Check size={13} /></button><button onClick={cancelEdit} className="text-destructive"><X size={13} /></button></div></TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell><Input value={editData.draw_number || ''} onChange={e => setEditData(x => ({ ...x, draw_number: parseInt(e.target.value) || 0 }))} type="number" className="h-6 text-xs w-16 px-1" /></TableCell>
                          <TableCell><Input value={editData.date || ''} onChange={e => setEditData(x => ({ ...x, date: e.target.value }))} type="date" className="h-6 text-xs w-28 px-1" /></TableCell>
                          <TableCell className="text-right"><Input value={editData.amount || ''} onChange={e => setEditData(x => ({ ...x, amount: parseFloat(e.target.value) || 0 }))} type="number" step="0.01" className="h-6 text-xs w-28 px-1 text-right" /></TableCell>
                          <TableCell className="flex gap-1"><button onClick={saveEdit} className="text-[hsl(var(--success))]"><Check size={14} /></button><button onClick={cancelEdit} className="text-destructive"><X size={14} /></button></TableCell>
                        </>
                      )
                    ) : (
                      <>
                        <TableCell className="font-medium text-[11px]">Draw {d.draw_number.toString().padStart(3, '0')}</TableCell>
                        <TableCell className="tabular-nums text-[11px]">{format(new Date(d.date), 'MM.dd.yy')}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-[11px]">{fmt(d.amount)}</TableCell>
                        <TableCell><button onClick={() => startEdit(d)} className="text-muted-foreground hover:text-foreground"><Pencil size={12} /></button></TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
              {adding ? (
                <TableRow className="bg-muted/30">
                  <TableCell><Input value={newData.draw_number || ''} onChange={e => setNewData(x => ({ ...x, draw_number: parseInt(e.target.value) || 0 }))} type="number" className="h-6 text-[10px] w-full md:w-16 px-1" placeholder="#" autoFocus /></TableCell>
                  <TableCell><Input value={newData.date || ''} onChange={e => setNewData(x => ({ ...x, date: e.target.value }))} type="date" className="h-6 text-[10px] w-full md:w-28 px-1" /></TableCell>
                  <TableCell className="text-right"><Input value={newData.amount || ''} onChange={e => setNewData(x => ({ ...x, amount: parseFloat(e.target.value) || 0 }))} type="number" step="0.01" className="h-6 text-[10px] w-full md:w-28 px-1 text-right" placeholder="0.00" /></TableCell>
                  <TableCell><div className="flex gap-1">
                    <button onClick={() => { if (newData.date) { setDraws(prev => [...prev, { id: Date.now().toString(), project_id: selectedProject.id, draw_number: newData.draw_number || filtered.length + 1, date: newData.date!, amount: newData.amount || 0 }]); setAdding(false); setNewData({ date: '', draw_number: 0, amount: 0 }); } }} className="text-[hsl(var(--success))]"><Check size={13} /></button>
                    <button onClick={() => { setAdding(false); setNewData({ date: '', draw_number: 0, amount: 0 }); }} className="text-destructive"><X size={13} /></button>
                  </div></TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={4}>
                    <button onClick={() => { setNewData(d => ({ ...d, draw_number: filtered.length + 1 })); setAdding(true); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-0.5"><Plus size={12} /> Add row</button>
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
