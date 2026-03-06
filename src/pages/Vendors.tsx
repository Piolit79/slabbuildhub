import { useState } from 'react';
import { mockVendors } from '@/data/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search } from 'lucide-react';
import { Vendor } from '@/types';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>(mockVendors);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.detail.toLowerCase().includes(search.toLowerCase()) ||
    v.type.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newVendor: Vendor = {
      id: Date.now().toString(),
      name: fd.get('name') as string,
      detail: fd.get('detail') as string,
      type: fd.get('type') as Vendor['type'],
      contact: fd.get('contact') as string,
      email: fd.get('email') as string,
      phone: fd.get('phone') as string,
    };
    setVendors(prev => [...prev, newVendor]);
    setOpen(false);
  };

  const typeBadge = (type: string) => {
    const styles: Record<string, string> = {
      'Subcontractor': 'bg-primary text-primary-foreground',
      'Vendor': 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]',
      'Consultant': 'bg-secondary text-secondary-foreground',
    };
    return <Badge className={styles[type] || ''}>{type}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendors</h1>
          <p className="text-muted-foreground text-sm mt-1">Subcontractors, vendors & consultants directory</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus size={16} /> Add Vendor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Vendor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="detail">Detail / Trade</Label>
                <Input id="detail" name="detail" required />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select name="type" defaultValue="Subcontractor">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Subcontractor">Subcontractor</SelectItem>
                    <SelectItem value="Vendor">Vendor</SelectItem>
                    <SelectItem value="Consultant">Consultant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Contact</Label>
                <Input id="contact" name="contact" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" />
              </div>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search vendors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Detail / Trade</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(v => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{v.detail}</TableCell>
                  <TableCell>{typeBadge(v.type)}</TableCell>
                  <TableCell>{v.contact}</TableCell>
                  <TableCell className="text-primary">{v.email}</TableCell>
                  <TableCell>{v.phone}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
