import { useProject } from '@/contexts/ProjectContext';
import { mockContracts, mockPayments, mockDraws, mockBudgetItems, dashboardTotals } from '@/data/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingDown, Landmark, Calculator, FileText, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

export default function Dashboard() {
  const { selectedProject } = useProject();
  const pid = selectedProject.id;
  const t = dashboardTotals;

  const contracts = mockContracts.filter(c => c.project_id === pid);
  const payments = mockPayments.filter(p => p.project_id === pid);

  const summaryCards = [
    { label: 'Contract Owed', value: t.contractOwed, icon: FileText, color: 'bg-primary' },
    { label: 'Contract Paid', value: t.contractPaid, icon: Wallet, color: 'bg-[hsl(var(--success))]' },
    { label: 'Contract Balance', value: t.contractBalance, icon: TrendingDown, color: 'bg-[hsl(var(--warning))]' },
    { label: 'Draw Requested', value: t.drawRequested, icon: Landmark, color: 'bg-primary' },
    { label: 'Draw Balance', value: t.drawBalance, icon: DollarSign, color: 'bg-[hsl(var(--success))]' },
    { label: 'Budget Total', value: t.budgetTotal, icon: Calculator, color: 'bg-primary' },
  ];

  // Subcontractor summary from dashboard data
  const subNames = [...new Set(contracts.map(c => c.name))];
  const subSummary = subNames.map(name => {
    const sContracts = contracts.filter(c => c.name === name && c.type === 'Contract').reduce((s, c) => s + c.amount, 0);
    const sCO = contracts.filter(c => c.name === name && c.type === 'Change Order').reduce((s, c) => s + c.amount, 0);
    const sCr = contracts.filter(c => c.name === name && c.type === 'Credit').reduce((s, c) => s + c.amount, 0);
    const sOwed = sContracts + sCO + sCr;
    const sPaid = payments.filter(p => p.name === name && p.category === 'subcontractor').reduce((s, p) => s + p.amount, 0);
    return { name, contract: sContracts, changeOrders: sCO, credits: sCr, owed: sOwed, paid: sPaid, balance: sOwed - sPaid };
  }).sort((a, b) => a.balance - b.balance);

  // Spending breakdown
  const spendingData = [
    { name: 'Subcontractors', amount: t.contractPaid },
    { name: 'Materials & Vendors', amount: t.materialsVendorsTotal },
    { name: 'Fixtures & Fittings', amount: t.fixturesFittingsTotal },
    { name: 'Soft Costs', amount: t.softCostStudioLAB + t.softCostSLAB },
    { name: 'Field Labor', amount: t.fieldLaborTotal },
  ];

  const COLORS = ['hsl(215, 60%, 28%)', 'hsl(43, 96%, 56%)', 'hsl(160, 60%, 36%)', 'hsl(280, 50%, 45%)', 'hsl(15, 80%, 50%)'];

  // Budget by category
  const budget = mockBudgetItems.filter(b => b.project_id === pid);
  const budgetCategories = [...new Set(budget.map(b => b.category))];
  const budgetChartData = budgetCategories.map(cat => ({
    name: cat,
    total: budget.filter(b => b.category === cat).reduce((s, b) => s + b.labor + b.material + b.optional, 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">{selectedProject.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Projected Budget</p>
          <p className="text-2xl font-bold text-primary">{fmt(t.budgetTotal)}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {summaryCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`${color} p-1.5 rounded text-primary-foreground`}>
                  <Icon size={14} />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-lg font-bold tracking-tight">{fmt(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Other Soft & Hard Costs</p>
          <p className="text-lg font-bold">{fmt(t.otherSoftHardCosts)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Total Paid to Date</p>
          <p className="text-lg font-bold">{fmt(t.totalPaidToDate)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Projected Project Total</p>
          <p className="text-lg font-bold">{fmt(t.projectedTotal)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Budget Hard Cost</p>
          <p className="text-lg font-bold">{fmt(t.budgetHardCost)}</p>
        </CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Spending Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={spendingData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="amount" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={true}>
                    {spendingData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => fmt(val)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Budget by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetChartData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 20%, 88%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={(val: number) => fmt(val)} />
                  <Bar dataKey="total" fill="hsl(215, 60%, 28%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Soft Costs Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Soft Costs</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">StudioLAB</TableCell>
                  <TableCell>Designer</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(t.softCostStudioLAB)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">SLAB Builders</TableCell>
                  <TableCell>Builder</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(t.softCostSLAB)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Other Hard Costs</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Materials & Vendors</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(t.materialsVendorsTotal)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Fixtures & Fittings</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(t.fixturesFittingsTotal)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Field Labor</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(t.fieldLaborTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Subcontractor Summary Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Hard Costs - Contracted</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5">
                <TableHead>Name</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead className="text-right">Contract</TableHead>
                <TableHead className="text-right">Change Order</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Total Owed</TableHead>
                <TableHead className="text-right">Payments</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subSummary.map(row => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {contracts.find(c => c.name === row.name)?.type === 'Contract' ? '' : ''}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(row.contract)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.changeOrders ? fmt(row.changeOrders) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.credits ? fmt(row.credits) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{fmt(row.owed)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(row.paid)}</TableCell>
                  <TableCell className={`text-right tabular-nums font-semibold ${
                    row.balance === 0 ? 'text-[hsl(var(--success))]' : row.balance > 0 ? 'text-[hsl(var(--warning))]' : ''
                  }`}>
                    {row.balance === 0 ? '$0' : fmt(row.balance)}
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
