import { AppLayout } from '@/coi-tracker/components/AppLayout';
import { Card } from '@/coi-tracker/components/ui/card';
import { Button } from '@/coi-tracker/components/ui/button';
import { useProjects } from '@/coi-tracker/hooks/useProjects';
import { useAllCOIs } from '@/coi-tracker/hooks/useCOIs';
import { useGCSettings } from '@/coi-tracker/hooks/useGCSettings';
import { useInactiveCOIs } from '@/coi-tracker/hooks/useInactiveCOIs';
import { Switch } from '@/coi-tracker/components/ui/switch';
import { StatusBadge } from '@/coi-tracker/components/StatusBadge';
import { COIDetailContent, COIDetailHeader } from '@/coi-tracker/components/COIDetailContent';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/coi-tracker/components/ui/hover-card';
import { ScrollArea } from '@/coi-tracker/components/ui/scroll-area';

import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Shield,
  FolderKanban,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Loader2,
  Bell,
  CalendarDays,
  PowerOff } from
'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { COI } from '@/coi-tracker/types';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger } from
'@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle } from
'@/components/ui/dialog';
import { format, isValid } from 'date-fns';


const projectStatusStyles: Record<string, string> = {
  active: 'bg-status-valid-bg text-status-valid',
  completed: 'bg-muted text-muted-foreground',
  'on-hold': 'bg-status-warning-bg text-status-warning'
};

const Index = () => {
  const { data: projects, isLoading: projLoading } = useProjects();
  const { data: allCoisRaw } = useAllCOIs();
  const { data: settings } = useGCSettings();
  const { toggleActive } = useInactiveCOIs();
  const allCois = (allCoisRaw || []).filter(c => c.is_active !== false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [projectsInitialized, setProjectsInitialized] = useState(false);
  const [selectedCOI, setSelectedCOI] = useState<(COI & {project_id?: string;}) | null>(null);

  useEffect(() => {
    if (projects && !projectsInitialized) {
      setExpandedProjects(new Set(projects.map((p) => p.id)));
      setProjectsInitialized(true);
    }
  }, [projects, projectsInitialized]);


  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else
      next.add(id);
      return next;
    });
  };

  const dashboardCois = useMemo(() => {
    const latestBySubcontractor = new Map<string, COI & {project_id: string;}>();

    // useAllCOIs is already ordered by created_at desc, so first seen = latest record
    (allCois || []).forEach((coi) => {
      const subcontractorKey = (coi.subcontractor || '').
      trim().
      toLowerCase().
      replace(/\s+/g, ' ');
      const key = `${coi.project_id}:${subcontractorKey}`;

      if (!latestBySubcontractor.has(key)) {
        latestBySubcontractor.set(key, coi);
      }
    });

    return Array.from(latestBySubcontractor.values());
  }, [allCois]);

  const validCount = dashboardCois.filter((c) => c.status === 'valid').length;
  const expiringCount = dashboardCois.filter((c) => c.status === 'expiring').length;
  const expiredCount = dashboardCois.filter((c) => c.status === 'expired').length;
  const activeProjects = (projects || []).filter((p) => p.status === 'active').length;
  const projectMap = new Map((projects || []).map((p) => [p.id, p.name]));
  const projectTemplateMap = new Map((projects || []).map((p) => [p.id, { subject: p.reminder_subject, body: p.reminder_body }]));

  // Alerts: expiring + expired COIs, sorted chronologically by expiration date
  const alerts = dashboardCois.
  filter((c) => c.status === 'expiring' || c.status === 'expired').
  sort((a, b) => {
    const toMs = (d: string) => {
      const p = (d || '').split('/');
      return p.length === 3 ? new Date(+p[2], +p[0] - 1, +p[1]).getTime() : 0;
    };
    return toMs(a.expirationDate) - toMs(b.expirationDate);
  });

  // Calendar: group expirations by month (key: 'YYYY-MM')
  const expirationsByMonth = useMemo(() => {
    const monthMap = new Map<string, {cois: (COI & {project_id: string;})[];expired: number;expiring: number;valid: number;}>();
    dashboardCois.forEach((coi) => {
      if (!coi.expirationDate) return;
      const parts = coi.expirationDate.split('/');
      if (parts.length !== 3) return;
      const d = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      if (!isValid(d)) return;
      const key = format(d, 'yyyy-MM');
      const existing = monthMap.get(key) || { cois: [], expired: 0, expiring: 0, valid: 0 };
      existing.cois.push(coi);
      if (coi.status === 'expired') existing.expired++;else
      if (coi.status === 'expiring') existing.expiring++;else
      existing.valid++;
      monthMap.set(key, existing);
    });
    return monthMap;
  }, [dashboardCois]);

  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const selectedMonthCois = useMemo(() => {
    if (!selectedMonth) return [];
    return expirationsByMonth.get(selectedMonth)?.cois || [];
  }, [selectedMonth, expirationsByMonth]);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const validCois = dashboardCois.filter((c) => c.status === 'valid');
  const expiringCois = dashboardCois.filter((c) => c.status === 'expiring');
  const expiredCois = dashboardCois.filter((c) => c.status === 'expired');
  const activeProjectsList = (projects || []).filter((p) => p.status === 'active');

  const stats = [
  { label: 'Active Projects', value: activeProjects, icon: FolderKanban, color: 'text-primary', bg: 'bg-primary/10', items: activeProjectsList.map((p) => p.name) },
  { label: 'Valid COIs', value: validCount, icon: CheckCircle2, color: 'text-status-valid', bg: 'bg-status-valid-bg', items: validCois.map((c) => `${c.subcontractor} — ${projectMap.get(c.project_id) || ''}`) },
  { label: 'Expiring Soon', value: expiringCount, icon: AlertTriangle, color: 'text-status-warning', bg: 'bg-status-warning-bg', items: expiringCois.map((c) => `${c.subcontractor} — ${projectMap.get(c.project_id) || ''} (${c.expirationDate})`) },
  { label: 'Expired', value: expiredCount, icon: XCircle, color: 'text-status-expired', bg: 'bg-status-expired-bg', items: expiredCois.map((c) => `${c.subcontractor} — ${projectMap.get(c.project_id) || ''} (${c.expirationDate})`) }];


  // Group all COIs by project (no dedup — matches what the Projects page shows)
  const coisByProject = (allCois || []).reduce<Record<string, (COI & {project_id: string;})[]>>((acc, coi) => {
    (acc[coi.project_id] = acc[coi.project_id] || []).push(coi);
    return acc;
  }, {});

  if (projLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>);

  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: '#7b7c81' }}>COI Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">

























































































































































































          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) =>
          <HoverCard key={stat.label} openDelay={200} closeDelay={100}>
              <HoverCardTrigger asChild>
                <Card className="flex items-center gap-4 border border-border p-4 cursor-default hover:shadow-md transition-shadow">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </Card>
              </HoverCardTrigger>
              <HoverCardContent className="w-80 p-0" align="start">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-semibold text-foreground">{stat.label} ({stat.value})</p>
                </div>
                {stat.items.length === 0 ?
              <p className="text-xs text-muted-foreground px-3 py-3">None</p> :

              <ScrollArea className={stat.items.length > 12 ? "max-h-72" : ""}>
                    <div className="px-3 py-2 space-y-1.5">
                      {stat.items.map((item, i) =>
                  <p key={i} className="text-xs text-muted-foreground">{item}</p>
                  )}
                    </div>
                  </ScrollArea>
              }
              </HoverCardContent>
            </HoverCard>
          )}
        </div>

        {/* Alerts & Calendar Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Alerts */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-status-warning" />
              <h2 className="text-sm font-semibold text-foreground">Expiration Alerts</h2>
              {alerts.length > 0 && <span className="rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-semibold text-status-warning">{alerts.length}</span>}
            </div>
            {alerts.length > 0 ? <div className="space-y-1 max-h-[279px] overflow-y-auto pr-1">
                {alerts.map((coi) => <Card key={coi.id} className="flex items-center gap-2 border border-border px-2 py-[8.5px] cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setSelectedCOI(coi)}>
                    <Bell className="h-3 w-3 text-status-warning shrink-0" />
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <p className="text-xs font-medium text-foreground truncate">{coi.subcontractor}</p>
                      {coi.project_id && projectMap.get(coi.project_id) && <p className="text-[10px] text-primary truncate shrink-0">— {projectMap.get(coi.project_id)}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{coi.expirationDate}</span>
                      <StatusBadge status={coi.status} daysUntilExpiry={coi.daysUntilExpiry} />
                    </div>
                  </Card>)}
              </div> : <Card className="flex items-center gap-3 border border-border p-6">
                <CheckCircle2 className="h-5 w-5 text-status-valid" />
                <p className="text-sm text-muted-foreground">All certificates are current. No alerts.</p>
              </Card>}
          </div>

          {/* Calendar */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Expiration Calendar</h2>
            </div>
            <Card className="border border-border p-3">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setCalendarYear((y) => y - 1)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </button>
                <span className="text-sm font-semibold text-foreground">{calendarYear}</span>
                <button onClick={() => setCalendarYear((y) => y + 1)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {months.map((m, i) => {const key = `${calendarYear}-${String(i + 1).padStart(2, '0')}`;const data = expirationsByMonth.get(key);const isSelected = selectedMonth === key;const hasIssues = data && (data.expired > 0 || data.expiring > 0);return <button key={key} onClick={() => setSelectedMonth(isSelected ? null : key)} className={cn("rounded-md px-2 py-2 text-xs font-medium transition-colors text-center", isSelected ? "bg-primary text-primary-foreground" : hasIssues ? "bg-status-warning-bg text-status-warning hover:bg-status-warning-bg/80" : data ? "bg-muted text-foreground hover:bg-muted/80" : "text-muted-foreground hover:bg-muted/50")}>
                      <span>{m}</span>
                      {data && <span className="block text-[10px] mt-0.5 font-normal">
                          {data.cois.length} COI{data.cois.length !== 1 ? 's' : ''}
                        </span>}
                    </button>;})}
              </div>
              {selectedMonthCois.length > 0 && <div className="border-t border-border mt-3 pt-2 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    {months[parseInt(selectedMonth!.split('-')[1]) - 1]} {selectedMonth!.split('-')[0]} — {selectedMonthCois.length} expiring
                  </p>
                  {selectedMonthCois.map((coi) => <button key={coi.id} onClick={() => setSelectedCOI(coi)} className="w-full flex items-start justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/50 transition-colors">
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-foreground truncate block">{coi.subcontractor}</span>
                        {coi.project_id && projectMap.get(coi.project_id) && <span className="text-[10px] text-primary truncate block">{projectMap.get(coi.project_id)}</span>}
                      </div>
                      <StatusBadge status={coi.status} daysUntilExpiry={coi.daysUntilExpiry} />
                    </button>)}
                </div>}
            </Card>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <FolderKanban className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Projects</h2>
        </div>
        {(projects || []).length === 0 ? <Card className="border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">No projects yet. Go to Projects to create one.</p>
          </Card> : <div className="space-y-3">
            {(projects || []).map((project) => {const isOpen = expandedProjects.has(project.id);const projectCois = coisByProject[project.id] || [];return <Collapsible key={project.id} open={isOpen} onOpenChange={() => toggleProject(project.id)}>
                  <Card className="border border-border overflow-hidden">
                    <CollapsibleTrigger className="w-full text-left">
                      <div className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors">
                        <div className="flex h-5 w-5 items-center justify-center">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5">
                            <h3 className="text-sm font-semibold text-foreground truncate">{project.name}</h3>
                            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", projectStatusStyles[project.status] || '')}>
                              {project.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-muted-foreground">{project.client}</span>
                            {project.address && <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />{project.address}
                              </span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-5 text-center shrink-0">
                          <div>
                            <p className="text-lg font-bold text-foreground">{project.coiCount}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">COIs</p>
                          </div>
                          {project.expiringCount > 0 && <div>
                              <p className="text-lg font-bold text-status-warning">{project.expiringCount}</p>
                              <p className="text-[10px] text-status-warning uppercase tracking-wider">Expiring</p>
                            </div>}
                          {project.expiredCount > 0 && <div>
                              <p className="text-lg font-bold text-status-expired">{project.expiredCount}</p>
                              <p className="text-[10px] text-status-expired uppercase tracking-wider">Expired</p>
                            </div>}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t border-border bg-muted/20">
                        {projectCois.length > 0 ? <div className="divide-y divide-border">
                            {projectCois.map((coi) => <button key={coi.id} onClick={() => setSelectedCOI(coi)} className="w-full flex items-center gap-4 px-6 py-3 text-left hover:bg-muted/40 transition-colors">
                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-sm font-medium text-foreground">{coi.subcontractor}</span>
                                                  </div>
                                                  <p className="text-xs text-muted-foreground">{coi.carrier}</p>
                                </div>
                                <div className="flex items-center gap-5 shrink-0">
                                  <div className="text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">COI Exp</p>
                                    <p className="text-xs font-mono font-medium text-foreground">{coi.expirationDate}</p>
                                    <StatusBadge status={coi.status} daysUntilExpiry={coi.daysUntilExpiry} className="mt-1" />
                                  </div>
                                  <div className="text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">WC Exp</p>
                                    {coi.wcPolicy ? <>
                                        <p className="text-xs font-mono font-medium text-foreground">{coi.wcPolicy.expirationDate}</p>
                                        <StatusBadge status={coi.wcPolicy.status} daysUntilExpiry={coi.wcPolicy.daysUntilExpiry} className="mt-1" />
                                      </> : <p className="text-xs text-muted-foreground italic">N/A</p>}
                                  </div>
                                  {coi.glPolicy && <span title="GL Policy on file"><Shield className="h-3.5 w-3.5 text-primary" /></span>}
                                </div>
                              </button>)}
                          </div> : <div className="px-6 py-6 text-center">
                            <p className="text-sm text-muted-foreground">No COIs uploaded yet.</p>
                            <Link to={`/insurance/projects/${project.id}`} className="text-xs text-primary hover:underline mt-1 inline-block">
                              Go to project to add COIs →
                            </Link>
                          </div>}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>;})}
          </div>}

        <Dialog open={!!selectedCOI} onOpenChange={() => setSelectedCOI(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            {selectedCOI && <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 flex-wrap">
                    <COIDetailHeader coi={selectedCOI} />
                  </DialogTitle>
                </DialogHeader>
                <COIDetailContent
                  coi={selectedCOI}
                  projectId={selectedCOI.project_id || ''}
                  projectName={projectMap.get(selectedCOI.project_id || '') || ''}
                  reminderSubject={projectTemplateMap.get(selectedCOI.project_id || '')?.subject}
                  reminderBody={projectTemplateMap.get(selectedCOI.project_id || '')?.body}
                  settings={settings}
                  footer={
                    <div className="pt-2 border-t border-border flex items-center justify-end gap-2">
                      <PowerOff className={cn('h-3.5 w-3.5', selectedCOI.is_active !== false ? 'text-status-valid' : 'text-muted-foreground')} />
                      <span className="text-xs text-muted-foreground">{selectedCOI.is_active !== false ? 'Active' : 'Inactive'}</span>
                      <Switch
                        checked={selectedCOI.is_active !== false}
                        onCheckedChange={(checked) => toggleActive(selectedCOI.id, checked)}
                      />
                    </div>
                  }
                />
              </>}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>);};export default Index;