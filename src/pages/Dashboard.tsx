import { useProject } from '@/contexts/ProjectContext';
import { mockContracts, mockPayments, mockDraws, mockBudgetItems } from '@/data/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingUp, TrendingDown, Landmark, Calculator, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

export default function Dashboard() {
  const { selectedProject } = useProject();
  const pid = selectedProject.id;

  const contracts = mockContracts.filter(c => c.project_id === pid);
  const payments = mockPayments.filter(p => p.project_id === pid);
  const draws = mockDraws.filter(d => d.project_id === pid);
  const budget = mockBudgetItems.filter(b => b.project_id === pid);

  const contractTotal = contracts.filter(c => c.type === 'Contract').reduce((s, c) => s + c.amount, 0);
  const changeOrders = contracts.filter(c => c.type === 'Change Order').reduce((s, c) => s + c.amount, 0);
  const credits = contracts.filter(c => c.type === 'Credit').reduce((s, c) => s + c.amount, 0);
  const totalOwed = contractTotal + changeOrders + credits;
  const totalPaid = payments.filter(p => p.category === 'subcontractor').reduce((s, p) => s + p.amount, 0);
  const contractBalance = totalOwed - totalPaid;

  const drawTotal = draws.reduce((s, d) => s + d.amount, 0);
  const totalSpent = payments.reduce((s, p) => s + p.amount, 0);
  const drawBalance = drawTotal - totalSpent;

  const budgetTotal = budget.reduce((s, b) => s + b.labor + b.material + b.optional, 0);

  const summaryCards = [
    { label: 'Contract Owed', value: totalOwed, icon: FileText, trend: 'neutral' },
    { label: 'Contract Paid', value: totalPaid, icon: TrendingUp, trend: 'up' },
    { label: 'Contract Balance', value: contractBalance, icon: TrendingDown, trend: contractBalance > 0 ? 'warning' : 'neutral' },
    { label: 'Draw Requested', value: drawTotal, icon: Landmark, trend: 'neutral' },
    { label: 'Draw Balance', value: drawBalance, icon: DollarSign, trend: drawBalance > 0 ? 'up' : 'warning' },
    { label: 'Budget Total', value: budgetTotal, icon: Calculator, trend: 'neutral' },
  ];

  // Subcontractor summary
  const subNames = [...new Set(contracts.map(c => c.name))];
  const subSummary = subNames.map(name => {
    const sContracts = contracts.filter(c => c.name === name && c.type === 'Contract').reduce((s, c) => s + c.amount, 0);
    const sCO = contracts.filter(c => c.name === name && c.type === 'Change Order').reduce((s, c) => s + c.amount, 0);
    const sCr = contracts.filter(c => c.name === name && c.type === 'Credit').reduce((s, c) => s + c.amount, 0);
    const sOwed = sContracts + sCO + sCr;
    const sPaid = payments.filter(p => p.name === name && p.category === 'subcontractor').reduce((s, p) => s + p.amount, 0);
    return { name, contract: sContracts, changeOrders: sCO, credits: sCr, owed: sOwed, paid: sPaid, balance: sOwed - sPaid };
  });

  // Category spending chart data
  const categories = ['subcontractor', 'materials', 'soft_costs', 'field_labor'] as const;
  const categoryLabels: Record<string, string> = { subcontractor: 'Subcontractor', materials: 'Materials', soft_costs: 'Soft Costs', field_labor: 'Field Labor' };
  const spendingData = categories.map(cat => ({
    name: categoryLabels[cat],
    amount: payments.filter(p => p.category === cat).reduce((s, p) => s + p.amount, 0),
  }));

  const COLORS = ['hsl(220, 70%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(152, 60%, 40%)', 'hsl(280, 60%, 50%)'];

  // Budget by category
  const budgetCategories = [...new Set(budget.map(b => b.category))];
  const budgetChartData = budgetCategories.map(cat => ({
    name: cat,
    total: budget.filter(b => b.category === cat).reduce((s, b) => s + b.labor + b.material + b.optional, 0),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">{selectedProject.name} — Project Overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                <Icon size={16} className="text-muted-foreground" />
              </div>
              <p className="text-xl font-bold tracking-tight">{fmt(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={spendingData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="amount" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
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
            <CardTitle className="text-base">Budget by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(val: number) => fmt(val)} />
                  <Bar dataKey="total" fill="hsl(220, 70%, 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subcontractor Summary Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Subcontractor Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Contract</TableHead>
                <TableHead className="text-right">Change Orders</TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead className="text-right">Total Owed</TableHead>
                <TableHead className="text-right">Payments</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subSummary.map(row => (
                <TableRow key={row.name}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right">{fmt(row.contract)}</TableCell>
                  <TableCell className="text-right">{fmt(row.changeOrders)}</TableCell>
                  <TableCell className="text-right">{fmt(row.credits)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(row.owed)}</TableCell>
                  <TableCell className="text-right">{fmt(row.paid)}</TableCell>
                  <TableCell className={`text-right font-semibold ${row.balance > 0 ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--success))]'}`}>
                    {fmt(row.balance)}
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
