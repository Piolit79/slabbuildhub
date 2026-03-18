import React, { useState, useMemo, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { AutocompleteInput } from '@/components/ui/autocomplete-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SmartDateInput } from '@/components/ui/smart-date-input';
import { Plus, Pencil, Check, X, ChevronUp, ChevronDown, ChevronsUpDown, Undo2, Trash2, RefreshCw } from 'lucide-react';
import { Payment, PaymentCategory } from '@/types';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

function SortBtn({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: string; onClick: () => void; className?: string }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-0.5 hover:text-foreground ${className || ''}`}>{label}{active ? (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="opacity-30" />}</button>;
}

const tabs: { value: PaymentCategory; label: string }[] = [
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'materials', label: 'Materials' },
  { value: 'soft_costs', label: 'Soft Costs' },
  { value: 'field_labor', label: 'Field Labor' },
];

export default function PaymentsPage({ readOnly }: { readOnly?: boolean }) {
  const { selectedProject } = useProject();
  const isMobile = useIsMobile();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [open, setOpen] = useState(false);

  // QB sync state
  const [qbProjects, setQbProjects] = useState<{ id: string; name: string }[]>([]);
  const [qbProjectId, setQbProjectId] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [qbReady, setQbReady] = useState(false);

  useEffect(() => {
    supabase.from('payments').select('*').eq('project_id', selectedProject.id).then(({ data }) => {
      if (data) setPayments(data as Payment[]);
    });
  }, [selectedProject.id]);

  useEffect(() => {
    // Load QB projects list and saved mapping for this project
    fetch('/api/qb-status').then(r => r.json()).then(s => {
      if (!s.connected) return;
      setQbReady(true);
      fetch('/api/qb-projects').then(r => r.json()).then(d => {
        if (d.projects) setQbProjects(d.projects);
      });
    });
    supabase.from('projects').select('qb_project_id').eq('id', selectedProject.id).single().then(({ data }) => {
      if (data?.qb_project_id) setQbProjectId(data.qb_project_id);
    });
  }, [selectedProject.id]);

  const handleQbProjectChange = async (val: string) => {
    setQbProjectId(val);
    await supabase.from('projects').update({ qb_project_id: val }).eq('id', selectedProject.id);
  };

  const handleSync = async () => {
    if (!qbProjectId) return;
    setSyncing(true);
    try {
      const resp = await fetch('/api/qb-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: selectedProject.id, qb_project_id: qbProjectId }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      // Reload payments
      const { data } = await supabase.from('payments').select('*').eq('project_id', selectedProject.id);
      if (data) setPayments(data as Payment[]);
      if (result.imported > 0) {
        toast.success(`Synced ${result.imported} new check${result.imported !== 1 ? 's' : ''} from QuickBooks`);
      } else {
        toast.info('No new checks to import');
      }
    } catch (e: any) {
      toast.error('Sync failed', { description: e.message });
    } finally {
      setSyncing(false);
    }
  };
  const [activeTab, setActiveTab] = useState<PaymentCategory>('subcontractor');
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Payment>>({});
  const [adding, setAdding] = useState(false);
  const [newData, setNewData] = useState<Partial<Payment>>({ date: '', name: '', amount: 0, form: '', check_number: '' });
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggle = (k: string) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc'); } };
  const nameSuggestions = useMemo(() => [...new Set(payments.map(p => p.name).filter(Boolean))], [payments]);
  const filtered = payments.filter(p => p.project_id === selectedProject.id && p.category === activeTab);
  const sorted = useMemo(() => [...filtered].sort((a: any, b: any) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av ?? '').localeCompare(String(bv ?? '')) : String(bv ?? '').localeCompare(String(av ?? ''));
  }), [filtered, sortKey, sortDir]);
  const tabTotal = filtered.reduce((s, p) => s + p.amount, 0);

  const [undoInfo, setUndoInfo] = useState<{ id: string; prev: Payment } | null>(null);
  const undoTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const showUndo = (id: string, prev: Payment) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoInfo({ id, prev });
    undoTimerRef.current = setTimeout(() => setUndoInfo(null), 10000);
  };
  const handleUndo = async () => {
    if (!undoInfo) return;
    const { id, prev } = undoInfo;
    setPayments(p => p.map(x => x.id === id ? prev : x));
    await supabase.from('payments').update(prev).eq('id', id);
    setUndoInfo(null);
  };

  const startEdit = (p: Payment) => { setEditId(p.id); setEditData({ ...p }); };
  const cancelEdit = () => { setEditId(null); setEditData({}); };
  const saveEdit = async () => {
    const prev = payments.find(p => p.id === editId);
    await supabase.from('payments').update(editData).eq('id', editId!);
    setPayments(p => p.map(x => x.id === editId ? { ...x, ...editData } as Payment : x));
    if (prev) showUndo(editId!, prev);
    cancelEdit();
  };

  const deletePayment = async (id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
    await supabase.from('payments').delete().eq('id', id);
    setConfirmDeleteId(null);
  };

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const np: Payment = {
      id: Date.now().toString(), project_id: selectedProject.id,
      date: fd.get('date') as string, name: fd.get('name') as string,
      amount: parseFloat(fd.get('amount') as string) || 0,
      category: fd.get('category') as PaymentCategory, form: fd.get('form') as string,
      check_number: (fd.get('check_number') as string) || undefined,
    };
    await supabase.from('payments').insert(np);
    setPayments(prev => [...prev, np]);
    setOpen(false);
  };

  const sh = (label: string, key: string, cls?: string) => <SortBtn label={label} active={sortKey === key} dir={sortDir} onClick={() => toggle(key)} className={cls} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: '#7b7c81' }}>Payments</h1>
        {!readOnly && <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus size={14} /> Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Payment</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Date</Label><SmartDateInput name="date" required className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Name</Label><AutocompleteInput name="name" required suggestions={nameSuggestions} className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Amount</Label><CurrencyInput name="amount" required className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Category</Label>
                <Select name="category" defaultValue={activeTab}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{tabs.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Form</Label>
                <Select name="form" defaultValue="Check"><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Check">Check</SelectItem><SelectItem value="Credit">Credit</SelectItem><SelectItem value="Wire">Wire</SelectItem><SelectItem value="ACH">ACH</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Check # (optional)</Label><Input name="check_number" className="h-8 text-xs" /></div>
              <Button type="submit" size="sm" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>}
      </div>

      {qbReady && (
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={qbProjectId} onValueChange={handleQbProjectChange}>
            <SelectTrigger className="h-7 text-xs w-52">
              <SelectValue placeholder="Link QB project..." />
            </SelectTrigger>
            <SelectContent>
              {qbProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={!qbProjectId || syncing} onClick={handleSync}>
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync QB Checks'}
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as PaymentCategory); setSortKey('date'); setSortDir('asc'); setEditId(null); }}>
        <TabsList className="h-auto flex-wrap bg-[rgba(195,126,135,0.12)]">
          {tabs.map(t => <TabsTrigger key={t.value} value={t.value} className="text-[10px] md:text-xs px-2 md:px-3 py-1 data-[state=active]:bg-[#c37e87] data-[state=active]:text-white">{t.label}</TabsTrigger>)}
        </TabsList>
        {tabs.map(t => (
          <TabsContent key={t.value} value={t.value}>
            <Card>
              <CardContent className="p-0">
                <div className="px-3 py-2 border-b bg-secondary/30 flex justify-between items-center">
                  <span className="text-xs font-medium">{t.label} — {sorted.length} entries</span>
                  <span className="text-xs font-semibold tabular-nums">Total: {fmt(tabTotal)}</span>
                </div>
                <Table>
                  <colgroup>
                    <col style={{ width: 88 }} />
                    <col style={{ minWidth: 120 }} />
                    <col style={{ width: 116 }} />
                    {!isMobile && <col style={{ width: 116 }} />}
                    {!isMobile && <col style={{ width: 80 }} />}
                    <col style={{ width: 48 }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pr-6">{sh('Date', 'date')}</TableHead>
                      <TableHead className="pl-6">{sh('Name', 'name')}</TableHead>
                      <TableHead className="text-right pr-6">{sh('Amt', 'amount', 'justify-end')}</TableHead>
                      {!isMobile && <TableHead className="pl-6">{sh('Form', 'form')}</TableHead>}
                      {!isMobile && <TableHead>{sh('Check #', 'check_number')}</TableHead>}
                      {!readOnly && <TableHead className={isMobile ? 'w-10' : 'w-12'}></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((p, idx) => (
                      <TableRow key={p.id} style={idx % 2 === 0 ? { backgroundColor: 'rgba(195, 126, 135, 0.12)' } : undefined} onKeyDown={editId === p.id ? (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(); } else if (e.key === 'Escape') cancelEdit(); } : undefined}>
                        {editId === p.id ? (
                          isMobile ? (
                            <>
                              <TableCell className="pr-6"><SmartDateInput value={editData.date || ''} onChange={v => setEditData(d => ({ ...d, date: v }))} className="h-6 text-[10px] w-full px-1" /></TableCell>
                              <TableCell className="pl-6"><AutocompleteInput value={editData.name || ''} onChange={v => setEditData(d => ({ ...d, name: v }))} suggestions={nameSuggestions} className="h-6 text-[10px] px-1" /></TableCell>
                              <TableCell className="text-right"><CurrencyInput value={editData.amount || 0} onChange={v => setEditData(d => ({ ...d, amount: v }))} className="h-6 text-[10px] w-full px-1" /></TableCell>
                              <TableCell><div className="flex gap-1"><button onClick={saveEdit} className="text-[hsl(var(--success))]"><Check size={13} /></button><button onClick={cancelEdit} className="text-destructive"><X size={13} /></button></div></TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="pr-6"><SmartDateInput value={editData.date || ''} onChange={v => setEditData(d => ({ ...d, date: v }))} className="h-6 text-xs w-28 px-1" /></TableCell>
                              <TableCell className="pl-6"><AutocompleteInput value={editData.name || ''} onChange={v => setEditData(d => ({ ...d, name: v }))} suggestions={nameSuggestions} className="h-6 text-xs px-1" /></TableCell>
                              <TableCell className="text-right pr-6"><CurrencyInput value={editData.amount || 0} onChange={v => setEditData(d => ({ ...d, amount: v }))} className="h-6 text-xs w-28 px-1" /></TableCell>
                              <TableCell className="pl-6">
                                <select value={editData.form || 'Check'} onChange={e => setEditData(d => ({ ...d, form: e.target.value }))} className="h-6 text-xs border rounded px-1 bg-background w-20">
                                  <option>Check</option><option>Credit</option><option>Wire</option><option>ACH</option>
                                </select>
                              </TableCell>
                              <TableCell><Input value={editData.check_number || ''} onChange={e => setEditData(d => ({ ...d, check_number: e.target.value }))} className="h-6 text-xs w-16 px-1" /></TableCell>
                              <TableCell className="flex gap-1"><button onClick={saveEdit} className="text-[hsl(var(--success))]"><Check size={14} /></button><button onClick={cancelEdit} className="text-destructive"><X size={14} /></button></TableCell>
                            </>
                          )
                        ) : (
                          <>
                            <TableCell className="tabular-nums text-[11px] md:text-sm pr-6">{format(new Date(p.date), 'MM.dd.yy')}</TableCell>
                            <TableCell className="text-[11px] md:text-sm truncate max-w-[120px] md:max-w-none pl-6">
                              {p.name}
                              {p.source === 'qb' && <span className="ml-1.5 inline-block text-[9px] font-semibold px-1 py-0.5 rounded bg-[rgba(45,150,80,0.12)] text-green-700 align-middle">QB</span>}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-[11px] md:text-sm pr-6">{fmt(p.amount)}</TableCell>
                            {!isMobile && <TableCell className="text-[11px] md:text-sm pl-6">{p.form}</TableCell>}
                            {!isMobile && <TableCell className="tabular-nums text-[11px] md:text-sm">{p.check_number || '—'}</TableCell>}
                            {!readOnly && (
                              <TableCell>
                                {undoInfo?.id === p.id ? (
                                  <button onClick={handleUndo} className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline whitespace-nowrap"><Undo2 size={11} /> Undo</button>
                                ) : confirmDeleteId === p.id ? (
                                  <div className="flex items-center gap-1 whitespace-nowrap">
                                    <span className="text-[10px] text-muted-foreground">Delete?</span>
                                    <button onClick={() => deletePayment(p.id)} className="text-destructive hover:opacity-70"><Check size={13} /></button>
                                    <button onClick={() => setConfirmDeleteId(null)} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1.5">
                                    <button onClick={() => startEdit(p)} className="text-muted-foreground hover:text-foreground"><Pencil size={12} /></button>
                                    <button onClick={() => setConfirmDeleteId(p.id)} className="text-muted-foreground/40 hover:text-destructive"><Trash2 size={12} /></button>
                                  </div>
                                )}
                              </TableCell>
                            )}
                          </>
                        )}
                      </TableRow>
                    ))}
                    {!readOnly && (adding ? (
                      <TableRow className="bg-muted/30" onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); if (newData.date && newData.name) { const np = { id: Date.now().toString(), project_id: selectedProject.id, category: activeTab, ...newData } as Payment; supabase.from('payments').insert(np); setPayments(prev => [...prev, np]); setAdding(false); setNewData({ date: '', name: '', amount: 0, form: '', check_number: '' }); } } else if (e.key === 'Escape') { setAdding(false); setNewData({ date: '', name: '', amount: 0, form: '', check_number: '' }); } }}>
                        <TableCell className="pr-6"><SmartDateInput value={newData.date || ''} onChange={v => setNewData(d => ({ ...d, date: v }))} className="h-6 text-[10px] w-full md:w-28 px-1" autoFocus /></TableCell>
                        <TableCell className="pl-6"><AutocompleteInput value={newData.name || ''} onChange={v => setNewData(d => ({ ...d, name: v }))} suggestions={nameSuggestions} className="h-6 text-[10px] px-1" placeholder="Name" /></TableCell>
                        <TableCell className="text-right pr-6"><CurrencyInput value={newData.amount || 0} onChange={v => setNewData(d => ({ ...d, amount: v }))} className="h-6 text-[10px] w-full md:w-28 px-1" placeholder="0.00" /></TableCell>
                        {!isMobile && <TableCell className="pl-6">
                          <select value={newData.form || 'Check'} onChange={e => setNewData(d => ({ ...d, form: e.target.value }))} className="h-6 text-xs border rounded px-1 bg-background w-20">
                            <option>Check</option><option>Credit</option><option>Wire</option><option>ACH</option>
                          </select>
                        </TableCell>}
                        {!isMobile && <TableCell><Input value={newData.check_number || ''} onChange={e => setNewData(d => ({ ...d, check_number: e.target.value }))} className="h-6 text-xs w-16 px-1" placeholder="Check #" /></TableCell>}
                        <TableCell><div className="flex gap-1">
                          <button onClick={async () => { if (newData.date && newData.name) { const np = { id: Date.now().toString(), project_id: selectedProject.id, category: activeTab, ...newData } as Payment; await supabase.from('payments').insert(np); setPayments(prev => [...prev, np]); setAdding(false); setNewData({ date: '', name: '', amount: 0, form: '', check_number: '' }); } }} className="text-[hsl(var(--success))]"><Check size={13} /></button>
                          <button onClick={() => { setAdding(false); setNewData({ date: '', name: '', amount: 0, form: '', check_number: '' }); }} className="text-destructive"><X size={13} /></button>
                        </div></TableCell>
                      </TableRow>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={isMobile ? 4 : 6}>
                          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-0.5"><Plus size={12} /> Add row</button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
