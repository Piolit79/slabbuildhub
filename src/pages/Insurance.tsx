import { useState, useMemo, useRef } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useCOIs } from '@/hooks/useCOIs';
import { supabase } from '@/integrations/supabase/client';
import { COI } from '@/types';
import { COICard } from '@/components/coi/COICard';
import { COIStatusBadge } from '@/components/coi/COIStatusBadge';
import { COIDetailDialog } from '@/components/coi/COIDetailDialog';
import { CreateCOIDialog } from '@/components/coi/CreateCOIDialog';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Shield, AlertTriangle, XCircle, CheckCircle2, Search, Bell,
  CalendarDays, ChevronRight, ChevronDown, FolderKanban,
  Upload, FileText, Trash2, Download, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Tables } from '@/integrations/supabase/types';

type COIFile = Tables<'coi_files'>;
type ProjectShape = { id: string; name: string; address?: string; status: string; created_at: string };

// ─── Files Tab ────────────────────────────────────────────────────────────────

function FilesTab({ projects }: { projects: ProjectShape[] }) {
  const [files, setFiles] = useState<COIFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filterProject, setFilterProject] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    setLoadingFiles(true);
    const { data, error } = await supabase.from('coi_files').select('*').order('uploaded_at', { ascending: false });
    if (error) toast.error('Error loading files');
    else setFiles(data ?? []);
    setLoadingFiles(false);
  };

  useState(() => { fetchFiles(); });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${filterProject}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('coi-documents').upload(path, file);
    if (uploadError) {
      toast.error('Upload failed', { description: uploadError.message });
      setUploading(false);
      return;
    }
    await supabase.from('coi_files').insert({
      project_id: filterProject,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
    });
    toast.success('File uploaded');
    setUploading(false);
    fetchFiles();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (file: COIFile) => {
    await supabase.storage.from('coi-documents').remove([file.file_path]);
    await supabase.from('coi_files').delete().eq('id', file.id);
    toast.success('File deleted');
    fetchFiles();
  };

  const handleDownload = async (file: COIFile) => {
    const { data } = await supabase.storage.from('coi-documents').createSignedUrl(file.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const filtered = filterProject === 'all' ? files : files.filter(f => f.project_id === filterProject);

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={uploading}
          onClick={() => {
            if (filterProject === 'all') { toast.error('Select a project first'); return; }
            fileInputRef.current?.click();
          }}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Uploading...' : 'Upload COI'}
        </Button>
        {filterProject === 'all' && (
          <p className="text-xs text-muted-foreground">Select a project to upload files</p>
        )}
      </div>

      {loadingFiles ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border border-dashed border-border p-10 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Select a project and upload a COI document (PDF or image).</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(file => {
            const projectName = projects.find(p => p.id === file.project_id)?.name;
            return (
              <Card key={file.id} className="flex items-center gap-4 border border-border px-4 py-3">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.file_name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {projectName && <span className="text-xs text-primary">{projectName}</span>}
                    {file.file_size && <span className="text-xs text-muted-foreground">{formatSize(file.file_size)}</span>}
                    <span className="text-xs text-muted-foreground">
                      {new Date(file.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDownload(file)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => handleDelete(file)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InsurancePage() {
  const { projects } = useProject();
  const { cois, loading, refetch } = useCOIs();
  const [selectedCOI, setSelectedCOI] = useState<COI | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const activeProjects = projects.filter(p => p.status !== 'archived');
  const allCois = cois.filter(c => c.is_active !== false);

  const filteredCois = useMemo(() => {
    if (!searchQuery) return allCois;
    const q = searchQuery.toLowerCase();
    return allCois.filter(c =>
      c.insured_name.toLowerCase().includes(q) ||
      c.carrier.toLowerCase().includes(q) ||
      c.policyNumber.toLowerCase().includes(q)
    );
  }, [allCois, searchQuery]);

  const validCount = allCois.filter(c => c.status === 'valid').length;
  const expiringCount = allCois.filter(c => c.status === 'expiring').length;
  const expiredCount = allCois.filter(c => c.status === 'expired').length;

  const alerts = allCois
    .filter(c => c.status === 'expiring' || c.status === 'expired')
    .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const expirationsByMonth = useMemo(() => {
    const monthMap = new Map<string, { cois: COI[]; expired: number; expiring: number; valid: number }>();
    allCois.forEach((coi) => {
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
  }, [allCois]);

  const selectedMonthCois = useMemo(() => {
    if (!selectedMonth) return [];
    return expirationsByMonth.get(selectedMonth)?.cois || [];
  }, [selectedMonth, expirationsByMonth]);

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

  const coisByProject = allCois.reduce<Record<string, COI[]>>((acc, coi) => {
    (acc[coi.project_id] = acc[coi.project_id] || []).push(coi);
    return acc;
  }, {});

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
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ═══════════ DASHBOARD TAB ═══════════ */}
        <TabsContent value="dashboard">
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              {loading ? (
                <Card className="flex items-center justify-center border border-border p-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </Card>
              ) : alerts.length > 0 ? (
                <div className="space-y-1 max-h-[279px] overflow-y-auto pr-1">
                  {alerts.map((coi) => {
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
                          'rounded-md px-2 py-2 text-xs font-medium transition-colors text-center',
                          isSelected ? 'bg-primary text-primary-foreground' :
                          hasIssues ? 'bg-status-warning-bg text-status-warning hover:bg-status-warning-bg/80' :
                          data ? 'bg-muted text-foreground hover:bg-muted/80' :
                          'text-muted-foreground hover:bg-muted/50'
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
        </TabsContent>

        {/* ═══════════ PROJECTS TAB ═══════════ */}
        <TabsContent value="projects">
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search certificates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {searchQuery ? (
            <div>
              <p className="text-xs text-muted-foreground mb-3">
                {filteredCois.length} result{filteredCois.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
              </p>
              {filteredCois.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredCois.map(coi => (
                    <COICard key={coi.id} coi={coi} onClick={setSelectedCOI} />
                  ))}
                </div>
              ) : (
                <Card className="border border-dashed border-border p-8 text-center">
                  <p className="text-sm text-muted-foreground">No certificates match your search.</p>
                </Card>
              )}
            </div>
          ) : (
            activeProjects.length === 0 ? (
              <Card className="border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">No active projects.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {activeProjects.map((project) => {
                  const isOpen = expandedProjects.has(project.id);
                  const pCois = coisByProject[project.id] || [];
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
                            <div className="flex items-center justify-end px-6 py-2 border-b border-border/50">
                              <CreateCOIDialog projectId={project.id} onSuccess={refetch} />
                            </div>
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
            )
          )}
        </TabsContent>

        {/* ═══════════ FILES TAB ═══════════ */}
        <TabsContent value="files">
          <FilesTab projects={activeProjects} />
        </TabsContent>

        {/* ═══════════ SETTINGS TAB ═══════════ */}
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
                  <p className="text-[11px] text-muted-foreground">Enter as a number (e.g. 1000000 for $1,000,000)</p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs">Workers&apos; Compensation Required</Label>
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

      <COIDetailDialog
        coi={selectedCOI}
        projectName={selectedCOI ? projects.find(p => p.id === selectedCOI.project_id)?.name : undefined}
        onClose={() => setSelectedCOI(null)}
        onEmailsSaved={refetch}
      />
    </div>
  );
}
