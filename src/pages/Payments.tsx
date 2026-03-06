import React, { useState, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { mockPayments } from '@/data/mock-data';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Check, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Payment, PaymentCategory } from '@/types';
import { format } from 'date-fns';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

function SortBtn({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: string; onClick: () => void; className?: string }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-0.5 hover:text-foreground ${className || ''}`}>{label}{active ? (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="opacity-30" />}</button>;
}

const tabs: { value: PaymentCategory; label: string }[] = [
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'materials', label: 'Materials & Vendors' },
  { value: 'soft_costs', label: 'Soft Costs' },
  { value: 'field_labor', label: 'Field Labor' },
];

export default function PaymentsPage() {
  const { selectedProject } = useProject();
  const [payments, setPayments] = useState<Payment[]>(mockPayments);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PaymentCategory>('subcontractor');
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Payment>>({});
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggle = (k: string) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc'); } };
  const filtered = payments.filter(p => p.project_id === selectedProject.id && p.category === activeTab);
  const sorted = useMemo(() => [...filtered].sort((a: any, b: any) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av ?? '').localeCompare(String(bv ?? '')) : String(bv ?? '').localeCompare(String(av ?? ''));
  }), [filtered, sortKey, sortDir]);
  const tabTotal = filtered.reduce((s, p) => s + p.amount, 0);

  const startEdit = (p: Payment) => { setEditId(p.id); setEditData({ ...p }); };
  const cancelEdit = () => { setEditId(null); setEditData({}); };
  const saveEdit = () => { setPayments(prev => prev.map(p => p.id === editId ? { ...p, ...editData } as Payment : p)); cancelEdit(); };

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPayments(prev => [...prev, {
      id: Date.now().toString(), project_id: selectedProject.id,
      date: fd.get('date') as string, name: fd.get('name') as string,
      amount: parseFloat(fd.get('amount') as string) || 0,
      category: fd.get('category') as PaymentCategory, form: fd.get('form') as string,
      check_number: (fd.get('check_number') as string) || undefined,
    }]);
    setOpen(false);
  };

  const sh = (label: string, key: string, cls?: string) => <SortBtn label={label} active={sortKey === key} dir={sortDir} onClick={() => toggle(key)} className={cls} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#7b7c81' }}>Payments</h1>
          <p className="text-muted-foreground text-xs">Payment logs by category</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus size={14} /> Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Payment</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Date</Label><Input name="date" type="date" required className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Name</Label><Input name="name" required className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Amount</Label><Input name="amount" type="number" step="0.01" required className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Category</Label>
                <Select name="category" defaultValue={activeTab}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{tabs.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Form</Label><Input name="form" placeholder="Check / ACH / Cash" required className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Check # (optional)</Label><Input name="check_number" className="h-8 text-xs" /></div>
              <Button type="submit" size="sm" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v as PaymentCategory); setSortKey('date'); setSortDir('asc'); setEditId(null); }}>
        <TabsList className="h-8">
          {tabs.map(t => <TabsTrigger key={t.value} value={t.value} className="text-xs px-3 py-1">{t.label}</TabsTrigger>)}
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
                  <TableHeader>
                    <TableRow>
                      <TableHead>{sh('Date', 'date')}</TableHead>
                      <TableHead>{sh('Name', 'name')}</TableHead>
                      <TableHead className="text-right">{sh('Amount', 'amount', 'justify-end')}</TableHead>
                      <TableHead>{sh('Form', 'form')}</TableHead>
                      <TableHead>{sh('Check #', 'check_number')}</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map(p => (
                      <TableRow key={p.id}>
                        {editId === p.id ? (
                          <>
                            <TableCell><Input value={editData.date || ''} onChange={e => setEditData(d => ({ ...d, date: e.target.value }))} type="date" className="h-6 text-xs w-28 px-1" /></TableCell>
                            <TableCell><Input value={editData.name || ''} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} className="h-6 text-xs px-1" /></TableCell>
                            <TableCell className="text-right"><Input value={editData.amount || ''} onChange={e => setEditData(d => ({ ...d, amount: parseFloat(e.target.value) || 0 }))} type="number" step="0.01" className="h-6 text-xs w-24 px-1 text-right" /></TableCell>
                            <TableCell><Input value={editData.form || ''} onChange={e => setEditData(d => ({ ...d, form: e.target.value }))} className="h-6 text-xs w-20 px-1" /></TableCell>
                            <TableCell><Input value={editData.check_number || ''} onChange={e => setEditData(d => ({ ...d, check_number: e.target.value }))} className="h-6 text-xs w-16 px-1" /></TableCell>
                            <TableCell className="flex gap-1"><button onClick={saveEdit} className="text-[hsl(var(--success))]"><Check size={14} /></button><button onClick={cancelEdit} className="text-destructive"><X size={14} /></button></TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="tabular-nums">{format(new Date(p.date), 'MM.dd.yy')}</TableCell>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{fmt(p.amount)}</TableCell>
                            <TableCell>{p.form}</TableCell>
                            <TableCell className="tabular-nums">{p.check_number || '—'}</TableCell>
                            <TableCell><button onClick={() => startEdit(p)} className="text-muted-foreground hover:text-foreground"><Pencil size={12} /></button></TableCell>
                          </>
                        )}
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
