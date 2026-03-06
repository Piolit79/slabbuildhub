import React, { useState, useMemo } from 'react';
import { mockVendors } from '@/data/mock-data';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil, Check, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Vendor } from '@/types';

function SortBtn({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: string; onClick: () => void; className?: string }) {
  return <button onClick={onClick} className={`inline-flex items-center gap-0.5 hover:text-foreground ${className || ''}`}>{label}{active ? (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="opacity-30" />}</button>;
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>(mockVendors);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Vendor>>({});
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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
  const saveEdit = () => { setVendors(prev => prev.map(v => v.id === editId ? { ...v, ...editData } as Vendor : v)); cancelEdit(); };

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setVendors(prev => [...prev, {
      id: Date.now().toString(), name: fd.get('name') as string, detail: fd.get('detail') as string,
      type: fd.get('type') as Vendor['type'], contact: fd.get('contact') as string,
      email: fd.get('email') as string, phone: fd.get('phone') as string,
    }]);
    setOpen(false);
  };

  const typeBadge = (type: string) => {
    const c: Record<string, string> = { Subcontractor: 'bg-primary text-primary-foreground', Vendor: 'bg-secondary text-secondary-foreground', Consultant: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]' };
    return <Badge className={`text-[9px] px-1 py-0 ${c[type] || ''}`}>{type}</Badge>;
  };

  const sh = (label: string, key: string) => <SortBtn label={label} active={sortKey === key} dir={sortDir} onClick={() => toggle(key)} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: '#7b7c81' }}>Vendors</h1>
          <p className="text-muted-foreground text-xs">{filtered.length} vendors & subcontractors</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus size={14} /> Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="space-y-1"><Label className="text-xs">Name</Label><Input name="name" required className="h-8 text-xs" /></div>
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
                <TableHead>{sh('Type', 'type')}</TableHead>
                <TableHead>{sh('Contact', 'contact')}</TableHead>
                <TableHead>{sh('Email', 'email')}</TableHead>
                <TableHead>{sh('Phone', 'phone')}</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v, idx) => (
                <TableRow key={v.id} style={idx % 2 === 0 ? { backgroundColor: 'rgba(195, 126, 135, 0.12)' } : undefined}>
                  {editId === v.id ? (
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
                      <TableCell className="flex gap-1"><button onClick={saveEdit} className="text-[hsl(var(--success))]"><Check size={14} /></button><button onClick={cancelEdit} className="text-destructive"><X size={14} /></button></TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell>{v.detail}</TableCell>
                      <TableCell>{typeBadge(v.type)}</TableCell>
                      <TableCell>{v.contact || '—'}</TableCell>
                      <TableCell className="text-primary">{v.email || '—'}</TableCell>
                      <TableCell>{v.phone || '—'}</TableCell>
                      <TableCell><button onClick={() => startEdit(v)} className="text-muted-foreground hover:text-foreground"><Pencil size={12} /></button></TableCell>
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
