import React, { useState, useMemo, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingDown, Landmark, Calculator, FileText, Wallet, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Rectangle } from 'recharts';
import { Contract, Payment, Draw, Vendor } from '@/types';

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
  const isMobile = useIsMobile();
  const { selectedProject } = useProject();
  const pid = selectedProject.id;

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [budget, setBudget] = useState<{ labor: number; material: number }[]>([]);
  const [designFeePct, setDesignFeePct] = useState(0.10);
  const [buildFeePct, setBuildFeePct] = useState(0.15);

  useEffect(() => {
    const load = async () => {
      const [{ data: c }, { data: p }, { data: d }, { data: v }, { data: items }, { data: settings }] = await Promise.all([
        supabase.from('contracts').select('*').eq('project_id', pid),
        supabase.from('payments').select('*').eq('project_id', pid),
        supabase.from('draws').select('*').eq('project_id', pid),
        supabase.from('vendors').select('*'),
        supabase.from('budget_items').select('labor,material').eq('project_id', pid),
        supabase.from('budget_settings').select('design_fee_pct,build_fee_pct').eq('project_id', pid).maybeSingle(),
      ]);
      setContracts((c || []) as Contract[]);
      setPayments((p || []) as Payment[]);
      setDraws((d || []) as Draw[]);
      setVendors((v || []) as Vendor[]);
      setBudget(items || []);
      if (settings) {
        setDesignFeePct(settings.design_fee_pct ?? 0.10);
        setBuildFeePct(settings.build_fee_pct ?? 0.15);
      }
    };
    load();
  }, [pid]);

  // Compute totals from actual project data
  const contractOwed = contracts.reduce((s, c) => s + c.amount, 0);
  const contractPaid = payments.filter(p => p.category === 'subcontractor').reduce((s, p) => s + p.amount, 0);
  const contractBalance = contractOwed - contractPaid;
  const drawRequested = draws.reduce((s, d) => s + d.amount, 0);
  const allPaymentsExSoft = payments.filter(p => p.category !== 'soft_costs').reduce((s, p) => s + p.amount, 0);
  const drawBalance = drawRequested - allPaymentsExSoft;
  const softCostStudioLAB = payments.filter(p => p.name === 'StudioLAB' && p.category === 'soft_costs').reduce((s, p) => s + p.amount, 0);
  const softCostSLAB = payments.filter(p => p.name === 'SLAB Builders' && p.category === 'soft_costs').reduce((s, p) => s + p.amount, 0);
  const materialsVendorsTotal = payments.filter(p => p.category === 'materials').reduce((s, p) => s + p.amount, 0);
  const fixturesFittingsTotal = payments.filter(p => p.category === 'materials' && vendors.find(v => v.name === p.name)?.detail?.toLowerCase().includes('fixture')).reduce((s, p) => s + p.amount, 0);
  const fieldLaborTotal = payments.filter(p => p.category === 'field_labor').reduce((s, p) => s + p.amount, 0);
  const allPaymentsTotal = payments.reduce((s, p) => s + p.amount, 0);
  const otherSoftHardCosts = allPaymentsTotal - contractPaid;
  const totalPaidToDate = allPaymentsTotal;
  const hardCostBudget = budget.reduce((s, b) => s + b.labor + b.material, 0);
  const budgetFees = Math.round(hardCostBudget * (designFeePct + buildFeePct));
  const budgetTotal = hardCostBudget + budgetFees;
  const projectedTotal = totalPaidToDate + contractBalance;

  const [sortKey, setSortKey] = useState('balance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const toggle = (k: string) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc'); } };

  const summaryCards = [
    { label: 'Contract Owed', value: contractOwed, icon: FileText },
    { label: 'Contract Paid', value: contractPaid, icon: Wallet },
    { label: 'Contract Balance', value: contractBalance, icon: TrendingDown },
    { label: 'Draw Requested', value: drawRequested, icon: Landmark },
    { label: 'Draw Balance', value: drawBalance, icon: DollarSign },
    { label: 'Budget Total', value: budgetTotal, icon: Calculator },
  ];

  const subNames = [...new Set(contracts.map(c => c.name))];
  const subSummary = useMemo(() => {
    const rows = subNames.map(name => {
      const sC = contracts.filter(c => c.name === name && c.type === 'Contract').reduce((s, c) => s + c.amount, 0);
      const sCO = contracts.filter(c => c.name === name && c.type === 'Change Order').reduce((s, c) => s + c.amount, 0);
      const sCr = contracts.filter(c => c.name === name && c.type === 'Credit').reduce((s, c) => s + c.amount, 0);
      const owed = sC + sCO + sCr;
      const paid = payments.filter(p => p.name === name && p.category === 'subcontractor').reduce((s, p) => s + p.amount, 0);
      const vendor = vendors.find(v => v.name === name);
      return { name, detail: vendor?.detail || '', contract: sC, changeOrders: sCO, credits: sCr, owed, paid, balance: owed - paid };
    });
    return rows.sort((a: any, b: any) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [contracts, payments, vendors, sortKey, sortDir]);

  // Pie chart: Hard Cost vs Fees
  const hardCost = budget.reduce((s, b) => s + b.labor + b.material, 0);
  const designFee = Math.round(hardCost * designFeePct);
  const buildFee = Math.round(hardCost * buildFeePct);
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
        <div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight" style={{ color: '#7b7c81' }}>Dashboard</h1>
        </div>
        <div className="text-right">
          <p className="text-sm md:text-xl font-bold" style={{ color: '#7b7c81' }}>{selectedProject.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="order-2 lg:order-1">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Project Balances</CardTitle>
          </CardHeader>
          <CardContent className="px-2 md:px-4 pb-3">
            <div className="h-64 md:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Contract Owed', total: contractOwed },
                  { name: 'Contract Paid', total: contractPaid },
                  { name: 'Contract Balance', total: contractBalance },
                  { name: 'Draw Requested', total: drawRequested },
                  { name: 'Draw Balance', total: drawBalance },
                  { name: 'Other Hard & Soft Costs', total: otherSoftHardCosts },
                  { name: 'Total Paid to Date', total: totalPaidToDate },
                  { name: 'Current Projected Total', total: projectedTotal },
                ]} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 8%, 88%)" />
                  <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}k`} />
                   <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip formatter={(val: number) => fmt(val)} />
                  <Bar
                    dataKey="total"
                    fill="#c37e87"
                    radius={[0, 3, 3, 0]}
                    label={({ x, y, width, height, value }: any) => {
                      const textWidth = fmt(value).length * 7;
                      const inside = width > textWidth + 16;
                      return (
                        <text
                          x={inside ? x + width - 8 : x + width + 8}
                          y={y + height / 2}
                          dy={4}
                          textAnchor={inside ? 'end' : 'start'}
                          fontSize={12}
                          fill={inside ? '#fff' : 'hsl(var(--foreground))'}
                          fontWeight={600}
                        >
                          {fmt(value)}
                        </text>
                      );
                    }}
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
        <Card className="order-1 lg:order-2">
          <CardHeader className="pb-0 pt-3 px-4">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Projected Project Budget</CardTitle>
            <p className="text-xl font-bold tabular-nums text-muted-foreground text-center">{fmt(budgetChartData.reduce((s, d) => s + d.total, 0))}</p>
          </CardHeader>
          <CardContent className="px-2 md:px-4 pb-3">
            <div className="flex flex-col">
              <div className="h-56 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    {/* 3D depth layers */}
                    {[8, 6, 4, 2].map(offset => (
                      <Pie key={offset} data={budgetChartData} cx="50%" cy={`calc(50% + ${offset}px)`} innerRadius="30%" outerRadius="85%" paddingAngle={0} dataKey="total" isAnimationActive={false} labelLine={false}>
                        {budgetChartData.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? '#3a6190' : '#9c6068'} stroke="none" />
                        ))}
                      </Pie>
                    ))}
                    {/* Main pie */}
                    <Pie data={budgetChartData} cx="50%" cy="50%" innerRadius="30%" outerRadius="85%" paddingAngle={0} dataKey="total" stroke="hsl(var(--background))" strokeWidth={2} label={({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
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


      <Card>
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hard Costs - Contracted</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{sh('Name', 'name')}</TableHead>
                {!isMobile && <TableHead>{sh('Detail', 'detail')}</TableHead>}
                <TableHead className="text-right">{sh('Contract', 'contract', 'justify-end')}</TableHead>
                {!isMobile && <TableHead className="text-right">{sh('Change Order', 'changeOrders', 'justify-end')}</TableHead>}
                {!isMobile && <TableHead className="text-right">{sh('Credit', 'credits', 'justify-end')}</TableHead>}
                {!isMobile && <TableHead className="text-right">{sh('Total Owed', 'owed', 'justify-end')}</TableHead>}
                <TableHead className="text-right">{sh('Payments', 'paid', 'justify-end')}</TableHead>
                <TableHead className="text-right">{sh('Balance', 'balance', 'justify-end')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subSummary.map((row, idx) => (
                <TableRow key={row.name} className={`${row.balance === 0 ? 'text-muted-foreground/50' : ''}`} style={idx % 2 === 0 ? { backgroundColor: 'rgba(195, 126, 135, 0.12)' } : undefined}>
                  <TableCell className="font-medium text-[11px] md:text-sm">{row.name}</TableCell>
                  {!isMobile && <TableCell className="text-[11px] md:text-sm">{row.detail || '—'}</TableCell>}
                  <TableCell className="text-right tabular-nums text-[11px] md:text-sm">{fmt(row.contract)}</TableCell>
                  {!isMobile && <TableCell className="text-right tabular-nums text-[11px] md:text-sm">{row.changeOrders ? fmt(row.changeOrders) : '—'}</TableCell>}
                  {!isMobile && <TableCell className="text-right tabular-nums text-[11px] md:text-sm">{row.credits ? fmt(row.credits) : '—'}</TableCell>}
                  {!isMobile && <TableCell className="text-right tabular-nums text-[11px] md:text-sm">{fmt(row.owed)}</TableCell>}
                  <TableCell className="text-right tabular-nums text-[11px] md:text-sm">{fmt(row.paid)}</TableCell>
                  <TableCell className={`text-right tabular-nums font-semibold text-[11px] md:text-sm ${row.balance === 0 ? '' : 'text-[#c37e87]'}`}>
                    {row.balance === 0 ? '$0' : fmt(row.balance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Soft Costs</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow style={{ backgroundColor: 'rgba(195, 126, 135, 0.12)' }}>
                  <TableCell className="font-medium text-[11px] md:text-sm">StudioLAB</TableCell>
                  <TableCell className="text-[11px] md:text-sm">Designer</TableCell>
                  <TableCell className="text-right tabular-nums text-[11px] md:text-sm">{fmt(softCostStudioLAB)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-[11px] md:text-sm">SLAB Builders</TableCell>
                  <TableCell className="text-[11px] md:text-sm">Builder</TableCell>
                  <TableCell className="text-right tabular-nums text-[11px] md:text-sm">{fmt(softCostSLAB)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Other Hard Costs</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow style={{ backgroundColor: 'rgba(195, 126, 135, 0.12)' }}>
                  <TableCell className="font-medium text-[11px] md:text-sm">Materials & Vendors</TableCell>
                  <TableCell className="text-right tabular-nums text-[11px] md:text-sm">{fmt(materialsVendorsTotal)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-[11px] md:text-sm">Fixtures & Fittings</TableCell>
                  <TableCell className="text-right tabular-nums text-[11px] md:text-sm">{fmt(Math.abs(fixturesFittingsTotal))}</TableCell>
                </TableRow>
                <TableRow style={{ backgroundColor: 'rgba(195, 126, 135, 0.12)' }}>
                  <TableCell className="font-medium text-[11px] md:text-sm">Field Labor</TableCell>
                  <TableCell className="text-right tabular-nums text-[11px] md:text-sm">{fmt(fieldLaborTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
