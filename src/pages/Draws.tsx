import React, { useState, useMemo, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { Plus, Pencil, Check, X, ChevronUp, ChevronDown, ChevronsUpDown, Undo2, Trash2 } from 'lucide-react';
import { Draw } from '@/types';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

function SortBtn({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: string; onClick: () => void; className?: string }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-0.5 hover:text-foreground ${className || ''}`}>{label}{active ? (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="opacity-30" />}</button>;
}

export default function DrawsPage({ readOnly }: { readOnly?: boolean }) {
  const { selectedProject } = useProject();
  const isMobile = useIsMobile();
  const [draws, setDraws] = useState<Draw[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.from('draws').select('*').eq('project_id', selectedProject.id).then(({ data }) => {
      if (data) setDraws(data as Draw[]);
    });
  }, [selectedProject.id]);
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

  const [undoInfo, setUndoInfo] = useState<{ id: string; prev: Draw } | null>(null);
  const undoTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const showUndo = (id: string, prev: Draw) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoInfo({ id, prev });
    undoTimerRef.current = setTimeout(() => setUndoInfo(null), 10000);
  };
  const handleUndo = async () => {
    if (!undoInfo) return;
    const { id, prev } = undoInfo;
    setDraws(p => p.map(x => x.id === id ? prev : x));
    await supabase.from('draws').update(prev).eq('id', id);
    setUndoInfo(null);
  };

  const startEdit = (d: Draw) => { setEditId(d.id); setEditData({ ...d }); };
  const cancelEdit = () => { setEditId(null); setEditData({}); };
  const saveEdit = async () => {
    const prev = draws.find(d => d.id === editId);
    await supabase.from('draws').update(editData).eq('id', editId!);
    setDraws(p => p.map(d => d.id === editId ? { ...d, ...editData } as Draw : d));
    if (prev) showUndo(editId!, prev);
    cancelEdit();
  };

  const deleteDraw = async (id: string) => {
    setDraws(prev => prev.filter(d => d.id !== id));
    await supabase.from('draws').delete().eq('id', id);
    setConfirmDeleteId(null);
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nd: Draw = {
      id: Date.now().toString(), project_id: selectedProject.id,
      date: fd.get('date') as string, draw_number: parseInt(fd.get('draw_number') as string) || filtered.length + 1,
      amount: parseFloat(fd.get('amount') as string) || 0,
    };
    await supabase.from('draws').insert(nd);
    setDraws(prev => [...prev, nd]);
    setOpen(false);
  };

  const sh = (label: string, key: string, cls?: string) => <SortBtn label={label} active={sortKey === key} dir={sortDir} onClick={() => toggle(key)} className={cls} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: '#7b7c81' }}>Draws</h1>
        {!readOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus size={14} /> Add</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Draw Request</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="space-y-1"><Label className="text-xs">Date</Label><SmartDateInput name="date" required className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Draw #</Label><Input name="draw_number" type="number" defaultValue={filtered.length + 1} required className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Amount</Label><CurrencyInput name="amount" required className="h-8 text-xs" /></div>
                <Button type="submit" size="sm" className="w-full">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
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
                {!readOnly && <TableHead className={isMobile ? 'w-8' : 'w-10'}></TableHead>}
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
                          <TableCell><SmartDateInput value={editData.date || ''} onChange={v => setEditData(x => ({ ...x, date: v }))} className="h-6 text-[10px] w-full px-1" /></TableCell>
                          <TableCell className="text-right"><CurrencyInput value={editData.amount || 0} onChange={v => setEditData(x => ({ ...x, amount: v }))} className="h-6 text-[10px] w-full px-1" /></TableCell>
                          <TableCell><div className="flex gap-1"><button onClick={saveEdit} className="text-[hsl(var(--success))]"><Check size={13} /></button><button onClick={cancelEdit} className="text-destructive"><X size={13} /></button></div></TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell><Input value={editData.draw_number || ''} onChange={e => setEditData(x => ({ ...x, draw_number: parseInt(e.target.value) || 0 }))} type="number" className="h-6 text-xs w-16 px-1" /></TableCell>
                          <TableCell><SmartDateInput value={editData.date || ''} onChange={v => setEditData(x => ({ ...x, date: v }))} className="h-6 text-xs w-28 px-1" /></TableCell>
                          <TableCell className="text-right"><CurrencyInput value={editData.amount || 0} onChange={v => setEditData(x => ({ ...x, amount: v }))} className="h-6 text-xs w-28 px-1" /></TableCell>
                          <TableCell className="flex gap-1"><button onClick={saveEdit} className="text-[hsl(var(--success))]"><Check size={14} /></button><button onClick={cancelEdit} className="text-destructive"><X size={14} /></button></TableCell>
                        </>
                      )
                    ) : (
                    <>
                        <TableCell className="text-[11px] md:text-sm">Draw {d.draw_number.toString().padStart(3, '0')}</TableCell>
                        <TableCell className="tabular-nums text-[11px] md:text-sm">{format(new Date(d.date), 'MM.dd.yy')}</TableCell>
                        <TableCell className="text-right tabular-nums text-[11px] md:text-sm">{fmt(d.amount)}</TableCell>
                        {!readOnly && (
                          <TableCell>
                            {undoInfo?.id === d.id ? (
                              <button onClick={handleUndo} className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline whitespace-nowrap"><Undo2 size={11} /> Undo</button>
                            ) : confirmDeleteId === d.id ? (
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <span className="text-[10px] text-muted-foreground">Delete?</span>
                                <button onClick={() => deleteDraw(d.id)} className="text-destructive hover:opacity-70"><Check size={13} /></button>
                                <button onClick={() => setConfirmDeleteId(null)} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
                              </div>
                            ) : (
                              <div className="flex gap-1.5">
                                <button onClick={() => startEdit(d)} className="text-muted-foreground hover:text-foreground"><Pencil size={12} /></button>
                                <button onClick={() => setConfirmDeleteId(d.id)} className="text-muted-foreground/40 hover:text-destructive"><Trash2 size={12} /></button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </>
                    )}
                  </TableRow>
                );
              })}
              {!readOnly && (adding ? (
                <TableRow className="bg-muted/30">
                  <TableCell><Input value={newData.draw_number || ''} onChange={e => setNewData(x => ({ ...x, draw_number: parseInt(e.target.value) || 0 }))} type="number" className="h-6 text-[10px] w-full md:w-16 px-1" placeholder="#" autoFocus /></TableCell>
                  <TableCell><SmartDateInput value={newData.date || ''} onChange={v => setNewData(x => ({ ...x, date: v }))} className="h-6 text-[10px] w-full md:w-28 px-1" /></TableCell>
                  <TableCell className="text-right"><CurrencyInput value={newData.amount || 0} onChange={v => setNewData(x => ({ ...x, amount: v }))} className="h-6 text-[10px] w-full md:w-28 px-1" placeholder="0.00" /></TableCell>
                  <TableCell><div className="flex gap-1">
                    <button onClick={async () => { if (newData.date) { const nd: Draw = { id: Date.now().toString(), project_id: selectedProject.id, draw_number: newData.draw_number || filtered.length + 1, date: newData.date!, amount: newData.amount || 0 }; await supabase.from('draws').insert(nd); setDraws(prev => [...prev, nd]); setAdding(false); setNewData({ date: '', draw_number: 0, amount: 0 }); } }} className="text-[hsl(var(--success))]"><Check size={13} /></button>
                    <button onClick={() => { setAdding(false); setNewData({ date: '', draw_number: 0, amount: 0 }); }} className="text-destructive"><X size={13} /></button>
                  </div></TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={4}>
                    <button onClick={() => { setNewData(d => ({ ...d, draw_number: filtered.length + 1 })); setAdding(true); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-0.5"><Plus size={12} /> Add row</button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
