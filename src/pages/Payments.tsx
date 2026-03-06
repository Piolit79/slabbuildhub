import { useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { mockPayments } from '@/data/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { Payment, PaymentCategory } from '@/types';
import { format } from 'date-fns';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

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

  const filtered = payments.filter(p => p.project_id === selectedProject.id && p.category === activeTab);
  const tabTotal = filtered.reduce((s, p) => s + p.amount, 0);

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newPayment: Payment = {
      id: Date.now().toString(),
      project_id: selectedProject.id,
      date: fd.get('date') as string,
      name: fd.get('name') as string,
      amount: parseFloat(fd.get('amount') as string) || 0,
      category: fd.get('category') as PaymentCategory,
      form: fd.get('form') as string,
      check_number: (fd.get('check_number') as string) || undefined,
    };
    setPayments(prev => [...prev, newPayment]);
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground text-sm mt-1">All payment logs by category</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus size={16} /> Add Payment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Payment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="Payee name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" required />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select name="category" defaultValue={activeTab}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tabs.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="form">Form</Label>
                <Input id="form" name="form" placeholder="Check / ACH / Cash" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="check_number">Check # (optional)</Label>
                <Input id="check_number" name="check_number" placeholder="1001" />
              </div>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as PaymentCategory)}>
        <TabsList className="w-full justify-start">
          {tabs.map(t => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {tabs.map(t => (
          <TabsContent key={t.value} value={t.value}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{t.label} Payments</span>
                  <span className="text-sm font-normal text-muted-foreground">Total: {fmt(tabTotal)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Form</TableHead>
                      <TableHead>Check #</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.sort((a, b) => a.date.localeCompare(b.date)).map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{format(new Date(p.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.form}</TableCell>
                        <TableCell>{p.check_number || '—'}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(p.amount)}</TableCell>
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
