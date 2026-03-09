import React, { useState, useMemo, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { Plus, Pencil, Check, X, ChevronUp, ChevronDown, ChevronsUpDown, Undo2, Trash2 } from 'lucide-react';
import { Contract } from '@/types';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

function SortBtn({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: string; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-0.5 hover:text-foreground ${className || ''}`}>
      {label}{active ? (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="opacity-30" />}
    </button>
  );
}

export default function ContractsPage({ readOnly }: { readOnly?: boolean }) {
  const { selectedProject } = useProject();
  const isMobile = useIsMobile();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.from('contracts').select('*').eq('project_id', selectedProject.id).then(({ data }) => {
      if (data) setContracts(data as Contract[]);
    });
  }, [selectedProject.id]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Contract>>({});
  const [adding, setAdding] = useState(false);
  const [newData, setNewData] = useState<Partial<Contract>>({ date: '', name: '', amount: 0, type: 'Contract' });
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggle = (k: string) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc'); } };
  const nameSuggestions = useMemo(() => [...new Set(contracts.map(c => c.name).filter(Boolean))], [contracts]);
  const filtered = contracts.filter(c => c.project_id === selectedProject.id);
  const sorted = useMemo(() => [...filtered].sort((a: any, b: any) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  }), [filtered, sortKey, sortDir]);

  const [undoInfo, setUndoInfo] = useState<{ id: string; prev: Contract } | null>(null);
  const undoTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const showUndo = (id: string, prev: Contract) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoInfo({ id, prev });
    undoTimerRef.current = setTimeout(() => setUndoInfo(null), 10000);
  };
  const handleUndo = async () => {
    if (!undoInfo) return;
    const { id, prev } = undoInfo;
    setContracts(p => p.map(x => x.id === id ? prev : x));
    await supabase.from('contracts').update(prev).eq('id', id);
    setUndoInfo(null);
  };

  const startEdit = (c: Contract) => { setEditId(c.id); setEditData({ ...c }); };
  const cancelEdit = () => { setEditId(null); setEditData({}); };
  const saveEdit = async () => {
    const prev = contracts.find(c => c.id === editId);
    const updated = { ...editData } as Contract;
    await supabase.from('contracts').update(updated).eq('id', editId!);
    setContracts(p => p.map(c => c.id === editId ? { ...c, ...editData } as Contract : c));
    if (prev) showUndo(editId!, prev);
    setEditId(null); setEditData({});
  };

  const deleteContract = async (id: string) => {
    setContracts(prev => prev.filter(c => c.id !== id));
    await supabase.from('contracts').delete().eq('id', id);
    setConfirmDeleteId(null);
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newContract: Contract = {
      id: Date.now().toString(), project_id: selectedProject.id,
      date: fd.get('date') as string, name: fd.get('name') as string,
      amount: parseFloat(fd.get('amount') as string) || 0, type: fd.get('type') as Contract['type'],
    };
    await supabase.from('contracts').insert(newContract);
    setContracts(prev => [...prev, newContract]);
    setOpen(false);
  };

  const total = filtered.reduce((s, c) => s + c.amount, 0);
  const sh = (label: string, key: string, cls?: string) => <SortBtn label={label} active={sortKey === key} dir={sortDir} onClick={() => toggle(key)} className={cls} />;

  const typeBadge = (type: string) => {
    return <Badge className="text-[10px] px-1.5 py-0 text-white" style={{ backgroundColor: '#c37e87' }}>{type}</Badge>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: '#7b7c81' }}>Contracts</h1>
        {!readOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus size={14} /> Add</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Contract Entry</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="space-y-1"><Label className="text-xs">Date</Label><SmartDateInput name="date" required className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Name</Label><AutocompleteInput name="name" required suggestions={nameSuggestions} className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Amount</Label><CurrencyInput name="amount" required className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Type</Label>
                  <Select name="type" defaultValue="Contract"><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Contract">Contract</SelectItem><SelectItem value="Change Order">Change Order</SelectItem><SelectItem value="Credit">Credit</SelectItem></SelectContent>
                  </Select>
                </div>
                <Button type="submit" size="sm" className="w-full">Save</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{sh('Date', 'date')}</TableHead>
                <TableHead>{sh('Name', 'name')}</TableHead>
                {!isMobile && <TableHead>{sh('Type', 'type')}</TableHead>}
                <TableHead className="text-right">{sh('Amt', 'amount', 'justify-end')}</TableHead>
                {!readOnly && <TableHead className={isMobile ? 'w-10' : 'w-16'}></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c, idx) => (
                <TableRow key={c.id} style={idx % 2 === 0 ? { backgroundColor: 'rgba(195, 126, 135, 0.12)' } : undefined}>
                  {editId === c.id ? (
                    isMobile ? (
                      <>
                        <TableCell><SmartDateInput value={editData.date || ''} onChange={v => setEditData(d => ({ ...d, date: v }))} className="h-6 text-[10px] w-full px-1" /></TableCell>
                        <TableCell><AutocompleteInput value={editData.name || ''} onChange={v => setEditData(d => ({ ...d, name: v }))} suggestions={nameSuggestions} className="h-6 text-[10px] px-1" /></TableCell>
                        <TableCell className="text-right"><CurrencyInput value={editData.amount || 0} onChange={v => setEditData(d => ({ ...d, amount: v }))} className="h-6 text-[10px] w-full px-1" /></TableCell>
                        <TableCell><div className="flex gap-1"><button onClick={saveEdit} className="text-[hsl(var(--success))]"><Check size={13} /></button><button onClick={cancelEdit} className="text-destructive"><X size={13} /></button></div></TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell><SmartDateInput value={editData.date || ''} onChange={v => setEditData(d => ({ ...d, date: v }))} className="h-6 text-xs w-32 px-1" /></TableCell>
                        <TableCell><AutocompleteInput value={editData.name || ''} onChange={v => setEditData(d => ({ ...d, name: v }))} suggestions={nameSuggestions} className="h-6 text-xs px-1" /></TableCell>
                        <TableCell>
                          <select value={editData.type || 'Contract'} onChange={e => setEditData(d => ({ ...d, type: e.target.value as Contract['type'] }))} className="h-6 text-xs border rounded px-1 bg-background">
                            <option>Contract</option><option>Change Order</option><option>Credit</option>
                          </select>
                        </TableCell>
                        <TableCell className="text-right"><CurrencyInput value={editData.amount || 0} onChange={v => setEditData(d => ({ ...d, amount: v }))} className="h-6 text-xs w-28 px-1" /></TableCell>
                        <TableCell className="flex gap-1">
                          <button onClick={saveEdit} className="text-[hsl(var(--success))] hover:opacity-70"><Check size={14} /></button>
                          <button onClick={cancelEdit} className="text-destructive hover:opacity-70"><X size={14} /></button>
                        </TableCell>
                      </>
                    )
                  ) : (
                  <>
                      <TableCell className="tabular-nums text-[11px] md:text-sm">{format(new Date(c.date), 'MM.dd.yy')}</TableCell>
                      <TableCell className="text-[11px] md:text-sm truncate max-w-[120px] md:max-w-none">{c.name}</TableCell>
                      {!isMobile && <TableCell>{typeBadge(c.type)}</TableCell>}
                      <TableCell className={`text-right tabular-nums text-[11px] md:text-sm ${c.amount < 0 ? 'text-[hsl(var(--success))]' : ''}`}>{fmt(c.amount)}</TableCell>
                      {!readOnly && (
                        <TableCell>
                          {undoInfo?.id === c.id ? (
                            <button onClick={handleUndo} className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline whitespace-nowrap"><Undo2 size={11} /> Undo</button>
                          ) : confirmDeleteId === c.id ? (
                            <div className="flex items-center gap-1 whitespace-nowrap">
                              <span className="text-[10px] text-muted-foreground">Delete?</span>
                              <button onClick={() => deleteContract(c.id)} className="text-destructive hover:opacity-70"><Check size={13} /></button>
                              <button onClick={() => setConfirmDeleteId(null)} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              <button onClick={() => startEdit(c)} className="text-muted-foreground hover:text-foreground"><Pencil size={12} /></button>
                              <button onClick={() => setConfirmDeleteId(c.id)} className="text-muted-foreground/40 hover:text-destructive"><Trash2 size={12} /></button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </>
                  )}
                </TableRow>
              ))}
              {!readOnly && (adding ? (
                <TableRow className="bg-muted/30">
                  <TableCell><SmartDateInput value={newData.date || ''} onChange={v => setNewData(d => ({ ...d, date: v }))} className="h-6 text-[10px] w-full md:w-32 px-1" autoFocus /></TableCell>
                  <TableCell><AutocompleteInput value={newData.name || ''} onChange={v => setNewData(d => ({ ...d, name: v }))} suggestions={nameSuggestions} className="h-6 text-[10px] px-1" placeholder="Name" /></TableCell>
                  {!isMobile && (
                    <TableCell>
                      <select value={newData.type || 'Contract'} onChange={e => setNewData(d => ({ ...d, type: e.target.value as Contract['type'] }))} className="h-6 text-xs border rounded px-1 bg-background">
                        <option>Contract</option><option>Change Order</option><option>Credit</option>
                      </select>
                    </TableCell>
                  )}
                  <TableCell className="text-right"><CurrencyInput value={newData.amount || 0} onChange={v => setNewData(d => ({ ...d, amount: v }))} className="h-6 text-[10px] w-full md:w-28 px-1" placeholder="0.00" /></TableCell>
                  <TableCell><div className="flex gap-1">
                    <button onClick={async () => { if (newData.date && newData.name) { const nc = { id: Date.now().toString(), project_id: selectedProject.id, ...newData } as Contract; await supabase.from('contracts').insert(nc); setContracts(prev => [...prev, nc]); setAdding(false); setNewData({ date: '', name: '', amount: 0, type: 'Contract' }); } }} className="text-[hsl(var(--success))] hover:opacity-70"><Check size={13} /></button>
                    <button onClick={() => { setAdding(false); setNewData({ date: '', name: '', amount: 0, type: 'Contract' }); }} className="text-destructive hover:opacity-70"><X size={13} /></button>
                  </div></TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={isMobile ? 4 : 5}>
                    <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-0.5"><Plus size={12} /> Add row</button>
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
