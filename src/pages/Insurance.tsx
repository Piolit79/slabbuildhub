import { useState, useMemo } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { mockCOIs } from '@/data/mock-coi-data';
import { mockVendors } from '@/data/mock-data';
import { COI, getStatusFromDays } from '@/types';
import { COICard } from '@/components/coi/COICard';
import { COIStatusBadge } from '@/components/coi/COIStatusBadge';
import { COIDetailDialog } from '@/components/coi/COIDetailDialog';
import { CreateCOIDialog } from '@/components/coi/CreateCOIDialog';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Shield, AlertTriangle, XCircle, CheckCircle2, Search, Bell,
  CalendarDays, ChevronRight, ChevronDown, FolderKanban
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function InsurancePage() {
  const { selectedProject, projects } = useProject();
  const [selectedCOI, setSelectedCOI] = useState<COI | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // All COIs across all projects
  const allCois = mockCOIs.filter(c => c.is_active !== false);

  // COIs for the selected project
  const projectCois = useMemo(() =>
    mockCOIs.filter(c => c.project_id === selectedProject.id),
    [selectedProject.id]
  );

  const filteredCois = useMemo(() => {
    if (!searchQuery) return projectCois;
    const q = searchQuery.toLowerCase();
    return projectCois.filter(c =>
      c.insured_name.toLowerCase().includes(q) ||
      c.carrier.toLowerCase().includes(q) ||
      c.policyNumber.toLowerCase().includes(q)
    );
  }, [projectCois, searchQuery]);

  // Dashboard stats (across all projects)
  const activeCois = allCois;
  const validCount = activeCois.filter(c => c.status === 'valid').length;
  const expiringCount = activeCois.filter(c => c.status === 'expiring').length;
  const expiredCount = activeCois.filter(c => c.status === 'expired').length;
  const activeProjects = projects.filter(p => p.status !== 'archived');

  const alerts = activeCois
    .filter(c => c.status === 'expiring' || c.status === 'expired')
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  // Calendar
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const expirationsByMonth = useMemo(() => {
    const monthMap = new Map<string, { cois: COI[]; expired: number; expiring: number; valid: number }>();
    activeCois.forEach((coi) => {
      if (!coi.expirationDate) return;
      const d = new Date(coi.expirationDate);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(key) || { cois: [], expired: 0, expiring: 0, valid: 0 };
      existing.cois.push(coi);
      if (coi.status === 'expired') existing.expired++;
      else if (coi.status === 'expiring') existing.expiring++;
      else existing.valid++;
      monthMap.set(key, existing);
    });
    return monthMap;
  }, [activeCois]);

  const selectedMonthCois = useMemo(() => {
    if (!selectedMonth) return [];
    return expirationsByMonth.get(selectedMonth)?.cois || [];
  }, [selectedMonth, expirationsByMonth]);

  // Expandable projects on dashboard
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() =>
    new Set(activeProjects.map(p => p.id))
  );
  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Group COIs by project
  const coisByProject = allCois.reduce<Record<string, COI[]>>((acc, coi) => {
    (acc[coi.project_id] = acc[coi.project_id] || []).push(coi);
    return acc;
  }, {});

  const getVendorInfo = (coi: COI) => {
    if (!coi.vendor_id) return null;
    return mockVendors.find(v => v.id === coi.vendor_id);
  };

  const stats = [
    { label: 'Active Projects', value: activeProjects.length, icon: FolderKanban, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Current', value: validCount, icon: CheckCircle2, color: 'text-status-valid', bg: 'bg-status-valid-bg' },
    { label: 'Expiring Soon', value: expiringCount, icon: AlertTriangle, color: 'text-status-warning', bg: 'bg-status-warning-bg' },
    { label: 'Expired', value: expiredCount, icon: XCircle, color: 'text-status-expired', bg: 'bg-status-expired-bg' },
  ];

  return (
    <div className="max-w-7xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Insurance Tracker</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage certificates of insurance across all projects
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* =============== DASHBOARD TAB =============== */}
        <TabsContent value="dashboard">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat) => (
              <Card key={stat.label} className="flex items-center gap-4 border border-border p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Alerts & Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Alerts */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-4 w-4 text-status-warning" />
                <h2 className="text-sm font-semibold text-foreground">Expiration Alerts</h2>
                {alerts.length > 0 && (
                  <span className="rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-semibold text-status-warning">
                    {alerts.length}
                  </span>
                )}
              </div>
              {alerts.length > 0 ? (
                <div className="space-y-1 max-h-[279px] overflow-y-auto pr-1">
                  {alerts.map((coi) => {
                    const vendor = getVendorInfo(coi);
                    const projectName = projects.find(p => p.id === coi.project_id)?.name;
                    return (
                      <Card
                        key={coi.id}
                        className="flex items-center gap-2 border border-border px-2 py-[8.5px] cursor-pointer hover:shadow-sm transition-shadow"
                        onClick={() => setSelectedCOI(coi)}
                      >
                        <Bell className="h-3 w-3 text-status-warning shrink-0" />
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <p className="text-xs font-medium text-foreground truncate">{coi.insured_name}</p>
                          {projectName && (
                            <p className="text-[10px] text-primary truncate shrink-0">— {projectName}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-muted-foreground">{coi.expirationDate}</span>
                          <COIStatusBadge status={coi.status} daysUntilExpiry={coi.daysUntilExpiry} />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="flex items-center gap-3 border border-border p-6">
                  <CheckCircle2 className="h-5 w-5 text-status-valid" />
                  <p className="text-sm text-muted-foreground">All certificates are current. No alerts.</p>
                </Card>
              )}
            </div>

            {/* Calendar */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Expiration Calendar</h2>
              </div>
              <Card className="border border-border p-3">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => setCalendarYear(y => y - 1)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                    <ChevronRight className="h-4 w-4 rotate-180" />
                  </button>
                  <span className="text-sm font-semibold text-foreground">{calendarYear}</span>
                  <button onClick={() => setCalendarYear(y => y + 1)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {months.map((m, i) => {
                    const key = `${calendarYear}-${String(i + 1).padStart(2, '0')}`;
                    const data = expirationsByMonth.get(key);
                    const isSelected = selectedMonth === key;
                    const hasIssues = data && (data.expired > 0 || data.expiring > 0);
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedMonth(isSelected ? null : key)}
                        className={cn(
                          "rounded-md px-2 py-2 text-xs font-medium transition-colors text-center",
                          isSelected ? "bg-primary text-primary-foreground" :
                          hasIssues ? "bg-status-warning-bg text-status-warning hover:bg-status-warning-bg/80" :
                          data ? "bg-muted text-foreground hover:bg-muted/80" :
                          "text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        <span>{m}</span>
                        {data && (
                          <span className="block text-[10px] mt-0.5 font-normal">
                            {data.cois.length} COI{data.cois.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedMonthCois.length > 0 && (
                  <div className="border-t border-border mt-3 pt-2 space-y-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                      {months[parseInt(selectedMonth!.split('-')[1]) - 1]} {selectedMonth!.split('-')[0]} — {selectedMonthCois.length} expiring
                    </p>
                    {selectedMonthCois.map((coi) => (
                      <button
                        key={coi.id}
                        onClick={() => setSelectedCOI(coi)}
                        className="w-full flex items-start justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-foreground truncate block">{coi.insured_name}</span>
                          {projects.find(p => p.id === coi.project_id) && (
                            <span className="text-[10px] text-primary truncate block">
                              {projects.find(p => p.id === coi.project_id)?.name}
                            </span>
                          )}
                        </div>
                        <COIStatusBadge status={coi.status} daysUntilExpiry={coi.daysUntilExpiry} />
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* Projects breakdown */}
          <div className="flex items-center gap-2 mb-3">
            <FolderKanban className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Projects</h2>
          </div>
          {activeProjects.length === 0 ? (
            <Card className="border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeProjects.map((project) => {
                const isOpen = expandedProjects.has(project.id);
                const pCois = coisByProject[project.id] || [];
                const pValid = pCois.filter(c => c.status === 'valid').length;
                const pExpiring = pCois.filter(c => c.status === 'expiring').length;
                const pExpired = pCois.filter(c => c.status === 'expired').length;
                return (
                  <Collapsible key={project.id} open={isOpen} onOpenChange={() => toggleProject(project.id)}>
                    <Card className="border border-border overflow-hidden">
                      <CollapsibleTrigger className="w-full text-left">
                        <div className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors">
                          <div className="flex h-5 w-5 items-center justify-center">
                            {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-foreground truncate">{project.name}</h3>
                            {project.address && (
                              <p className="text-xs text-muted-foreground mt-0.5">{project.address}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-5 text-center shrink-0">
                            <div>
                              <p className="text-lg font-bold text-foreground">{pCois.length}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">COIs</p>
                            </div>
                            {pExpiring > 0 && (
                              <div>
                                <p className="text-lg font-bold text-status-warning">{pExpiring}</p>
                                <p className="text-[10px] text-status-warning uppercase tracking-wider">Expiring</p>
                              </div>
                            )}
                            {pExpired > 0 && (
                              <div>
                                <p className="text-lg font-bold text-status-expired">{pExpired}</p>
                                <p className="text-[10px] text-status-expired uppercase tracking-wider">Expired</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t border-border bg-muted/20">
                          {pCois.length > 0 ? (
                            <div className="divide-y divide-border">
                              {pCois.map((coi) => (
                                <button
                                  key={coi.id}
                                  onClick={() => setSelectedCOI(coi)}
                                  className="w-full flex items-center gap-4 px-6 py-3 text-left hover:bg-muted/40 transition-colors"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-sm font-medium text-foreground">{coi.insured_name}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{coi.carrier}</p>
                                  </div>
                                  <div className="flex items-center gap-5 shrink-0">
                                    <div className="text-center">
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">COI Exp</p>
                                      <p className="text-xs font-mono font-medium text-foreground">{coi.expirationDate}</p>
                                      <COIStatusBadge status={coi.status} daysUntilExpiry={coi.daysUntilExpiry} className="mt-1" />
                                    </div>
                                    <div className="text-center">
                                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">WC Exp</p>
                                      {coi.wcPolicy ? (
                                        <>
                                          <p className="text-xs font-mono font-medium text-foreground">{coi.wcPolicy.expirationDate}</p>
                                          <COIStatusBadge status={coi.wcPolicy.status} daysUntilExpiry={coi.wcPolicy.daysUntilExpiry} className="mt-1" />
                                        </>
                                      ) : (
                                        <p className="text-xs text-muted-foreground italic">N/A</p>
                                      )}
                                    </div>
                                    {coi.glPolicy && (
                                      <span title="GL Policy on file">
                                        <Shield className="h-3.5 w-3.5 text-primary" />
                                      </span>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="px-6 py-6 text-center">
                              <p className="text-sm text-muted-foreground">No COIs for this project yet.</p>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* =============== CERTIFICATES TAB =============== */}
        <TabsContent value="certificates">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, carrier, or policy..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {filteredCois.length} certificate{filteredCois.length !== 1 ? 's' : ''} for {selectedProject.name}
              </span>
              <CreateCOIDialog projectId={selectedProject.id} />
            </div>
          </div>

          {filteredCois.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredCois.map((coi) => (
                <COICard key={coi.id} coi={coi} onClick={setSelectedCOI} />
              ))}
            </div>
          ) : (
            <Card className="border border-dashed border-border p-8 text-center">
              <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No certificates match your search.' : 'No certificates of insurance yet for this project. Click "Add COI" to get started.'}
              </p>
            </Card>
          )}
        </TabsContent>

        {/* =============== SETTINGS TAB =============== */}
        <TabsContent value="settings">
          <div className="max-w-3xl space-y-6">
            <Card className="border border-border p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4">GC Identity (for COI Verification)</h2>
              <p className="text-xs text-muted-foreground mb-4">
                New COI uploads will be checked to confirm this company is listed as Additional Insured and Certificate Holder.
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name" className="text-xs">Company Name</Label>
                  <Input id="company-name" type="text" placeholder="e.g. SLAB Builders" defaultValue="SLAB Builders LLC" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property-address" className="text-xs">Property Address</Label>
                  <Input id="property-address" type="text" placeholder="e.g. 123 Main St, New York, NY" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner-info" className="text-xs">Owner Info</Label>
                  <Input id="owner-info" type="text" placeholder="e.g. ABC Development Corp" />
                </div>
              </div>
            </Card>

            <Card className="border border-border p-6">
              <h2 className="text-sm font-semibold text-foreground mb-4">Minimum Coverage Requirements</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="gl-limit" className="text-xs">Minimum GL Coverage Limit ($)</Label>
                  <Input id="gl-limit" type="text" placeholder="e.g. 1000000" defaultValue="1000000" />
                  <p className="text-[11px] text-muted-foreground">
                    Enter as a number (e.g. 1000000 for $1,000,000)
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Workers' Compensation Required</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Flag COIs that are missing WC coverage</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Additional Insured Required</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">GC must be listed as additional insured</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <COIDetailDialog coi={selectedCOI} onClose={() => setSelectedCOI(null)} />
    </div>
  );
}
