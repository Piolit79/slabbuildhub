import { useState } from 'react';
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
import { Plus } from 'lucide-react';
import { Contract } from '@/types';
import { format } from 'date-fns';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

export default function ContractsPage() {
  const { selectedProject } = useProject();
  const [contracts, setContracts] = useState<Contract[]>(mockContracts);
  const [open, setOpen] = useState(false);

  const filtered = contracts.filter(c => c.project_id === selectedProject.id);

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newContract: Contract = {
      id: Date.now().toString(),
      project_id: selectedProject.id,
      date: fd.get('date') as string,
      name: fd.get('name') as string,
      amount: parseFloat(fd.get('amount') as string) || 0,
      type: fd.get('type') as Contract['type'],
    };
    setContracts(prev => [...prev, newContract]);
    setOpen(false);
  };

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      'Contract': 'bg-primary text-primary-foreground',
      'Change Order': 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]',
      'Credit': 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]',
    };
    return <Badge className={colors[type] || ''}>{type}</Badge>;
  };

  const total = filtered.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contracts</h1>
          <p className="text-muted-foreground text-sm mt-1">Contracts, change orders & credits</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus size={16} /> Add Entry</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Contract Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="Vendor / Sub name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" required />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select name="type" defaultValue="Contract">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Change Order">Change Order</SelectItem>
                    <SelectItem value="Credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>All Entries</span>
            <span className="text-sm font-normal text-muted-foreground">Total: {fmt(total)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.sort((a, b) => a.date.localeCompare(b.date)).map(c => (
                <TableRow key={c.id}>
                  <TableCell>{format(new Date(c.date), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{typeBadge(c.type)}</TableCell>
                  <TableCell className={`text-right font-semibold ${c.amount < 0 ? 'text-[hsl(var(--success))]' : ''}`}>{fmt(c.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
