import { useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { mockDraws } from '@/data/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { Draw } from '@/types';
import { format } from 'date-fns';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

export default function DrawsPage() {
  const { selectedProject } = useProject();
  const [draws, setDraws] = useState<Draw[]>(mockDraws);
  const [open, setOpen] = useState(false);

  const filtered = draws.filter(d => d.project_id === selectedProject.id).sort((a, b) => a.draw_number - b.draw_number);
  const total = filtered.reduce((s, d) => s + d.amount, 0);

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newDraw: Draw = {
      id: Date.now().toString(),
      project_id: selectedProject.id,
      date: fd.get('date') as string,
      draw_number: parseInt(fd.get('draw_number') as string) || filtered.length + 1,
      amount: parseFloat(fd.get('amount') as string) || 0,
    };
    setDraws(prev => [...prev, newDraw]);
    setOpen(false);
  };

  let runningTotal = 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Draws</h1>
          <p className="text-muted-foreground text-sm mt-1">Bank draw requests</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus size={16} /> Add Draw</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Draw Request</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draw_number">Draw #</Label>
                <Input id="draw_number" name="draw_number" type="number" defaultValue={filtered.length + 1} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" required />
              </div>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Drawn</p>
            <p className="text-xl font-bold">{fmt(total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Draw Count</p>
            <p className="text-xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Draw Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Draw #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Running Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(d => {
                runningTotal += d.amount;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">Draw {d.draw_number}</TableCell>
                    <TableCell>{format(new Date(d.date), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(d.amount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmt(runningTotal)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-semibold">{fmt(total)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
