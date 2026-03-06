import React, { useState, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { mockContracts } from '@/data/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Check, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Contract } from '@/types';
import { format } from 'date-fns';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

function SortBtn({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: string; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-0.5 hover:text-foreground ${className || ''}`}>
      {label}{active ? (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="opacity-30" />}
    </button>
  );
}

export default function ContractsPage() {
  const { selectedProject } = useProject();
  const [contracts, setContracts] = useState<Contract[]>(mockContracts);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Contract>>({});
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggle = (k: string) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc'); } };
  const filtered = contracts.filter(c => c.project_id === selectedProject.id);
  const sorted = useMemo(() => [...filtered].sort((a: any, b: any) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  }), [filtered, sortKey, sortDir]);

  const startEdit = (c: Contract) => { setEditId(c.id); setEditData({ ...c }); };
  const cancelEdit = () => { setEditId(null); setEditData({}); };
  const saveEdit = () => {
    setContracts(prev => prev.map(c => c.id === editId ? { ...c, ...editData } as Contract : c));
    setEditId(null); setEditData({});
  };

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setContracts(prev => [...prev, {
      id: Date.now().toString(), project_id: selectedProject.id,
      date: fd.get('date') as string, name: fd.get('name') as string,
      amount: parseFloat(fd.get('amount') as string) || 0, type: fd.get('type') as Contract['type'],
    }]);
    setOpen(false);
  };

  const total = filtered.reduce((s, c) => s + c.amount, 0);
  const sh = (label: string, key: string, cls?: string) => <SortBtn label={label} active={sortKey === key} dir={sortDir} onClick={() => toggle(key)} className={cls} />;

  const typeBadge = (type: string) => {
    const c: Record<string, string> = { 'Contract': 'bg-primary text-primary-foreground', 'Change Order': 'bg-secondary text-secondary-foreground', 'Credit': 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]' };
    return <Badge className={`text-[10px] px-1.5 py-0 ${c[type] || ''}`}>{type}</Badge>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#7b7c81' }}>Contracts</h1>
          <p className="text-muted-foreground text-xs">Contracts, change orders & credits • Total: {fmt(total)}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus size={14} /> Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Contract Entry</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Date</Label><Input name="date" type="date" required className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Name</Label><Input name="name" required className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Amount</Label><Input name="amount" type="number" step="0.01" required className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Type</Label>
                <Select name="type" defaultValue="Contract"><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Contract">Contract</SelectItem><SelectItem value="Change Order">Change Order</SelectItem><SelectItem value="Credit">Credit</SelectItem></SelectContent>
                </Select>
              </div>
              <Button type="submit" size="sm" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{sh('Date', 'date')}</TableHead>
                <TableHead>{sh('Name', 'name')}</TableHead>
                <TableHead>{sh('Type', 'type')}</TableHead>
                <TableHead className="text-right">{sh('Amount', 'amount', 'justify-end')}</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(c => (
                <TableRow key={c.id} className={c.type === 'Credit' ? 'bg-[hsl(var(--success))]/5' : c.type === 'Change Order' ? 'bg-[hsl(var(--highlight))]' : ''}>
                  {editId === c.id ? (
                    <>
                      <TableCell><Input value={editData.date || ''} onChange={e => setEditData(d => ({ ...d, date: e.target.value }))} type="date" className="h-6 text-xs w-32 px-1" /></TableCell>
                      <TableCell><Input value={editData.name || ''} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} className="h-6 text-xs px-1" /></TableCell>
                      <TableCell>
                        <select value={editData.type || 'Contract'} onChange={e => setEditData(d => ({ ...d, type: e.target.value as Contract['type'] }))} className="h-6 text-xs border rounded px-1 bg-background">
                          <option>Contract</option><option>Change Order</option><option>Credit</option>
                        </select>
                      </TableCell>
                      <TableCell className="text-right"><Input value={editData.amount || ''} onChange={e => setEditData(d => ({ ...d, amount: parseFloat(e.target.value) || 0 }))} type="number" step="0.01" className="h-6 text-xs w-28 px-1 text-right" /></TableCell>
                      <TableCell className="flex gap-1">
                        <button onClick={saveEdit} className="text-[hsl(var(--success))] hover:opacity-70"><Check size={14} /></button>
                        <button onClick={cancelEdit} className="text-destructive hover:opacity-70"><X size={14} /></button>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="tabular-nums">{format(new Date(c.date), 'MM.dd.yy')}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{typeBadge(c.type)}</TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${c.amount < 0 ? 'text-[hsl(var(--success))]' : ''}`}>{fmt(c.amount)}</TableCell>
                      <TableCell><button onClick={() => startEdit(c)} className="text-muted-foreground hover:text-foreground"><Pencil size={12} /></button></TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
