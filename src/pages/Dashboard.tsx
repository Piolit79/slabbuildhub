import React, { useState, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { mockContracts, mockPayments, mockDraws, mockBudgetItems, dashboardTotals } from '@/data/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingDown, Landmark, Calculator, FileText, Wallet, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Rectangle } from 'recharts';

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

function SortBtn({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: string; onClick: () => void; className?: string }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-0.5 hover:text-foreground ${className || ''}`}>
      {label}
      {active ? (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="opacity-30" />}
    </button>
  );
}

export default function Dashboard() {
  const { selectedProject } = useProject();
  const pid = selectedProject.id;
  const t = dashboardTotals;

  const contracts = mockContracts.filter(c => c.project_id === pid);
  const payments = mockPayments.filter(p => p.project_id === pid);
  const budget = mockBudgetItems.filter(b => b.project_id === pid);

  const [sortKey, setSortKey] = useState('balance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const toggle = (k: string) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc'); } };

  const summaryCards = [
    { label: 'Contract Owed', value: t.contractOwed, icon: FileText },
    { label: 'Contract Paid', value: t.contractPaid, icon: Wallet },
    { label: 'Contract Balance', value: t.contractBalance, icon: TrendingDown },
    { label: 'Draw Requested', value: t.drawRequested, icon: Landmark },
    { label: 'Draw Balance', value: t.drawBalance, icon: DollarSign },
    { label: 'Budget Total', value: t.budgetTotal, icon: Calculator },
  ];

  const subNames = [...new Set(contracts.map(c => c.name))];
  const subSummary = useMemo(() => {
    const rows = subNames.map(name => {
      const sC = contracts.filter(c => c.name === name && c.type === 'Contract').reduce((s, c) => s + c.amount, 0);
      const sCO = contracts.filter(c => c.name === name && c.type === 'Change Order').reduce((s, c) => s + c.amount, 0);
      const sCr = contracts.filter(c => c.name === name && c.type === 'Credit').reduce((s, c) => s + c.amount, 0);
      const owed = sC + sCO + sCr;
      const paid = payments.filter(p => p.name === name && p.category === 'subcontractor').reduce((s, p) => s + p.amount, 0);
      return { name, contract: sC, changeOrders: sCO, credits: sCr, owed, paid, balance: owed - paid };
    });
    return rows.sort((a: any, b: any) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [contracts, payments, sortKey, sortDir]);

  // Pie chart: Hard Cost vs Fees
  const hardCost = budget.reduce((s, b) => s + b.labor + b.material, 0);
  const designFee = Math.round(hardCost * 0.10);
  const buildFee = Math.round(hardCost * 0.15);
  const budgetChartData = [
    { name: 'Budget Hard Cost', total: hardCost },
    { name: 'Budget Fees', total: designFee + buildFee },
  ];
  const COLORS = ['#4f81bd', '#c37e87'];

  const sh = (label: string, key: string, cls?: string) => (
    <SortBtn label={label} active={sortKey === key} dir={sortDir} onClick={() => toggle(key)} className={cls} />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Project Dashboard</h1>
          <p className="text-muted-foreground text-xs mt-0.5">{selectedProject.name}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Projected Budget</p>
          <p className="text-xl font-bold text-primary">{fmt(t.budgetTotal)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 xl:grid-cols-6 gap-2">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={12} className="text-primary" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-base font-bold tabular-nums">{fmt(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          ['Projected Project Total', t.projectedTotal],
          ['Budget Hard Cost', t.budgetHardCost],
        ].map(([l, v]) => (
          <Card key={l as string}><CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{l as string}</p>
            <p className="text-base font-bold tabular-nums">{fmt(v as number)}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Project Balances</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Contract Owed', total: t.contractOwed },
                  { name: 'Contract Paid', total: t.contractPaid },
                  { name: 'Contract Balance', total: t.contractBalance },
                  { name: 'Draw Requested', total: t.drawRequested },
                  { name: 'Draw Balance', total: t.drawBalance },
                  { name: 'Other Hard & Soft Costs', total: t.otherSoftHardCosts },
                  { name: 'Total Paid to Date', total: t.totalPaidToDate },
                  { name: 'Current Projected Total', total: t.projectedTotal },
                ]} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 8%, 88%)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={130} />
                  <Tooltip formatter={(val: number) => fmt(val)} />
                  <Bar
                    dataKey="total"
                    fill="#c37e87"
                    radius={[0, 3, 3, 0]}
                    label={({ x, y, width, height, value }: any) => (
                      <text x={x + width - 8} y={y + height / 2} dy={4} textAnchor="end" fontSize={9} fill="#fff" fontWeight={600}>
                        {fmt(value)}
                      </text>
                    )}
                    shape={(props: any) => {
                      const { x, y, width, height, index } = props;
                      const depth = 6;
                      const isBlue = index % 2 === 1;
                      const face = isBlue ? '#4f81bd' : '#c37e87';
                      const side = isBlue ? '#3d6594' : '#a6636b';
                      const top = isBlue ? '#7aa3d4' : '#d49aa1';
                      return (
                        <g>
                          <rect x={x} y={y} width={width} height={height} fill={face} rx={2} />
                          <polygon
                            points={`${x + width},${y} ${x + width + depth},${y - depth} ${x + width + depth},${y + height - depth} ${x + width},${y + height}`}
                            fill={side}
                          />
                          <polygon
                            points={`${x},${y} ${x + depth},${y - depth} ${x + width + depth},${y - depth} ${x + width},${y}`}
                            fill={top}
                          />
                        </g>
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Projected Project Budget</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex flex-col">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={budgetChartData} cx="50%" cy="50%" innerRadius="28%" outerRadius="85%" paddingAngle={3} dataKey="total" label={({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
                      const RADIAN = Math.PI / 180;
                      const radius = (innerRadius + outerRadius) / 2;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12} fill="#fff" fontWeight={600}>
                          {fmt(value)}
                        </text>
                      );
                    }} labelLine={false}>
                      {budgetChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(val: number) => fmt(val)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-6 pt-2">
                {budgetChartData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-xs text-muted-foreground">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Soft Costs</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Detail</TableHead><TableHead className="text-right">Payments</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell className="font-medium">StudioLAB</TableCell><TableCell>Designer</TableCell><TableCell className="text-right font-semibold tabular-nums">{fmt(t.softCostStudioLAB)}</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">SLAB Builders</TableCell><TableCell>Builder</TableCell><TableCell className="text-right font-semibold tabular-nums">{fmt(t.softCostSLAB)}</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Other Hard Costs</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3">
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                <TableRow><TableCell className="font-medium">Materials & Vendors</TableCell><TableCell className="text-right font-semibold tabular-nums">{fmt(t.materialsVendorsTotal)}</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">Fixtures & Fittings</TableCell><TableCell className="text-right font-semibold tabular-nums">{fmt(t.fixturesFittingsTotal)}</TableCell></TableRow>
                <TableRow><TableCell className="font-medium">Field Labor</TableCell><TableCell className="text-right font-semibold tabular-nums">{fmt(t.fieldLaborTotal)}</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hard Costs - Contracted</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{sh('Name', 'name')}</TableHead>
                <TableHead className="text-right">{sh('Contract', 'contract', 'justify-end')}</TableHead>
                <TableHead className="text-right">{sh('Change Order', 'changeOrders', 'justify-end')}</TableHead>
                <TableHead className="text-right">{sh('Credit', 'credits', 'justify-end')}</TableHead>
                <TableHead className="text-right">{sh('Total Owed', 'owed', 'justify-end')}</TableHead>
                <TableHead className="text-right">{sh('Payments', 'paid', 'justify-end')}</TableHead>
                <TableHead className="text-right">{sh('Balance', 'balance', 'justify-end')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subSummary.map(row => (
                <TableRow key={row.name} className={row.balance === 0 ? 'bg-[hsl(var(--success))]/5' : row.balance > 20000 ? 'bg-[hsl(var(--highlight))]' : ''}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(row.contract)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.changeOrders ? fmt(row.changeOrders) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.credits ? fmt(row.credits) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{fmt(row.owed)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(row.paid)}</TableCell>
                  <TableCell className={`text-right tabular-nums font-semibold ${row.balance === 0 ? 'text-[hsl(var(--success))]' : row.balance > 0 ? 'text-[hsl(var(--warning))]' : ''}`}>
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
