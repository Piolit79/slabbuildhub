import { useProject } from '@/contexts/ProjectContext';
import { mockBudgetItems } from '@/data/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

export default function BudgetPage() {
  const { selectedProject } = useProject();
  const items = mockBudgetItems.filter(b => b.project_id === selectedProject.id);
  const categories = [...new Set(items.map(b => b.category))];

  const grandLabor = items.reduce((s, b) => s + b.labor, 0);
  const grandMaterial = items.reduce((s, b) => s + b.material, 0);
  const grandOptional = items.reduce((s, b) => s + b.optional, 0);
  const hardCostTotal = grandLabor + grandMaterial;
  const designFee = hardCostTotal * 0.08;
  const buildFee = hardCostTotal * 0.15;
  const projectedGrandTotal = hardCostTotal + designFee + buildFee + grandOptional;

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      'complete': 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]',
      'in-progress': 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]',
      'pending': 'bg-secondary text-secondary-foreground',
    };
    return <Badge className={styles[status] || ''}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Budget</h1>
        <p className="text-muted-foreground text-sm mt-1">Line-item budget by category</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Hard Cost Total', value: hardCostTotal },
          { label: 'Design Fee (8%)', value: designFee },
          { label: 'Build Fee (15%)', value: buildFee },
          { label: 'Projected Grand Total', value: projectedGrandTotal },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
              <p className="text-xl font-bold">{fmt(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Budget by Category */}
      {categories.map(cat => {
        const catItems = items.filter(b => b.category === cat);
        const catLabor = catItems.reduce((s, b) => s + b.labor, 0);
        const catMaterial = catItems.reduce((s, b) => s + b.material, 0);
        const catOptional = catItems.reduce((s, b) => s + b.optional, 0);

        return (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{cat}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Labor</TableHead>
                    <TableHead className="text-right">Material</TableHead>
                    <TableHead className="text-right">Optional</TableHead>
                    <TableHead>Subcontractor</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catItems.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.description}</TableCell>
                      <TableCell className="text-right">{b.labor ? fmt(b.labor) : '—'}</TableCell>
                      <TableCell className="text-right">{b.material ? fmt(b.material) : '—'}</TableCell>
                      <TableCell className="text-right">{b.optional ? fmt(b.optional) : '—'}</TableCell>
                      <TableCell>{b.subcontractor || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{b.notes || '—'}</TableCell>
                      <TableCell>{statusBadge(b.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Subtotal</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(catLabor)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(catMaterial)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(catOptional)}</TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
