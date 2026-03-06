import { AppLayout } from '@/coi-tracker/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/coi-tracker/integrations/supabase/client';
import { downloadStorageFileBlob, createSignedFileUrl } from '@/coi-tracker/lib/storageFile';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, Loader2, FolderOpen, Shield, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useEmailReminders } from '@/coi-tracker/hooks/useEmailReminders';

interface StorageFile {
  path: string;
  id: string;
  insurer: string;
  fileType: 'coi' | 'gl-policy' | 'agreement';
  label: string;
  created_at: string;
  signedUrl: string | null;
  projectId: string | null;
  projectName: string | null;
}

function getOriginalFileName(path: string) {
  const fileName = path.split('/').pop() || path;
  return fileName.replace(/^\d+_/, '');
}

export default function Files() {
  const { data: files, isLoading } = useQuery({
    queryKey: ['storage-files'],
    queryFn: async (): Promise<StorageFile[]> => {
      const [{ data: cois }, { data: projects }, { data: settings }] = await Promise.all([
        supabase
          .from('subcontractor_cois')
          .select('coi_file_path, gl_policy_file_path, subcontractor, created_at, project_id')
          .order('subcontractor', { ascending: true }),
        supabase.from('projects').select('id, name'),
        supabase.from('gc_settings').select('agreement_file_path').limit(1).maybeSingle(),
      ]);

      const projectMap = new Map((projects || []).map(p => [p.id, p.name]));

      const entries: Omit<StorageFile, 'signedUrl'>[] = [];
      const seen = new Set<string>();

      (cois || []).forEach(c => {
        const insurer = c.subcontractor || 'Unknown';
        const projectId = c.project_id || null;
        const projectName = projectId ? (projectMap.get(projectId) || 'Unknown Project') : null;

        if (c.coi_file_path && !seen.has(c.coi_file_path)) {
          seen.add(c.coi_file_path);
          entries.push({
            path: c.coi_file_path,
            id: c.coi_file_path,
            insurer,
            fileType: 'coi',
            label: 'COI Certificate',
            created_at: c.created_at || '',
            projectId,
            projectName,
          });
        }

        if (c.gl_policy_file_path && !seen.has(c.gl_policy_file_path)) {
          seen.add(c.gl_policy_file_path);
          entries.push({
            path: c.gl_policy_file_path,
            id: c.gl_policy_file_path,
            insurer,
            fileType: 'gl-policy',
            label: 'GL Policy',
            created_at: c.created_at || '',
            projectId,
            projectName,
          });
        }
      });

      if (settings?.agreement_file_path && !seen.has(settings.agreement_file_path)) {
        entries.push({
          path: settings.agreement_file_path,
          id: settings.agreement_file_path,
          insurer: '',
          fileType: 'agreement',
          label: 'Agreement',
          created_at: '',
          projectId: null,
          projectName: null,
        });
      }

      // Pre-fetch all signed URLs in parallel
      return Promise.all(
        entries.map(async (entry) => {
          let signedUrl: string | null = null;
          try {
            const result = await createSignedFileUrl(entry.path);
            signedUrl = result.url;
          } catch { /* file may not be in storage yet */ }
          return { ...entry, signedUrl };
        })
      );
    },
  });

  const { reminders } = useEmailReminders();
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  const handleDownload = async (filePath: string, insurer: string, label: string) => {
    setDownloadingPath(filePath);
    try {
      const { blob } = await downloadStorageFileBlob(filePath);
      const ext = (filePath.split('.').pop() || 'pdf').toLowerCase();
      const safeName = insurer ? `${insurer} — ${label}.${ext}` : getOriginalFileName(filePath);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      a.remove();
    } catch (e) {
      console.error('Download failed', e);
      toast.error('Could not download file');
    } finally {
      setDownloadingPath(null);
    }
  };

  // Group by project name; agreements go in their own bucket
  const projectGroups: Record<string, StorageFile[]> = {};
  const agreements: StorageFile[] = [];

  (files || []).forEach(f => {
    if (f.fileType === 'agreement') {
      agreements.push(f);
    } else {
      const key = f.projectName || 'Unknown Project';
      (projectGroups[key] = projectGroups[key] || []).push(f);
    }
  });

  const sortedProjects = Object.keys(projectGroups).sort();

  const isEmpty = (files || []).length === 0;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Files</h1>
          <p className="text-sm text-muted-foreground mt-1">All uploaded certificates, policies, and agreements</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isEmpty ? (
          <Card className="flex flex-col items-center justify-center border border-dashed border-border p-12 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">No files yet</p>
            <p className="text-xs text-muted-foreground mt-1">Upload COI certificates from a project page to see them here.</p>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Project sections */}
            {sortedProjects.map(projectName => {
              const projectFiles = projectGroups[projectName];
              return (
                <div key={projectName}>
                  <div className="flex items-center gap-2 mb-3">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">{projectName}</h2>
                    <span className="text-xs text-muted-foreground">({projectFiles.length} file{projectFiles.length !== 1 ? 's' : ''})</span>
                  </div>
                  <div className="space-y-1.5">
                    {projectFiles.map(file => (
                      <Card
                        key={file.id}
                        className="flex items-center gap-3 border border-border px-4 py-3 hover:shadow-sm transition-shadow"
                      >
                        {file.fileType === 'gl-policy'
                          ? <Shield className="h-4 w-4 text-primary shrink-0" />
                          : <FileText className="h-4 w-4 text-primary shrink-0" />
                        }
                        <a
                          href={file.signedUrl ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={!file.signedUrl ? (e) => e.preventDefault() : undefined}
                        >
                          <p className="text-sm font-medium text-foreground truncate">
                            {file.insurer}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">— {file.label}</span>
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {getOriginalFileName(file.path)}
                            {file.created_at && ` · ${format(new Date(file.created_at), 'MMM d, yyyy')}`}
                          </p>
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 gap-1.5 text-xs h-7 px-2"
                          disabled={downloadingPath === file.path}
                          onClick={() => void handleDownload(file.path, file.insurer, file.label)}
                        >
                          {downloadingPath === file.path
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Download className="h-3 w-3" />}
                          Download
                        </Button>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Agreements section */}
            {agreements.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Agreements</h2>
                  <span className="text-xs text-muted-foreground">({agreements.length})</span>
                </div>
                <div className="space-y-1.5">
                  {agreements.map(file => (
                    <Card
                      key={file.id}
                      className="flex items-center gap-3 border border-border px-4 py-3 hover:shadow-sm transition-shadow"
                    >
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <a
                        href={file.signedUrl ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={!file.signedUrl ? (e) => e.preventDefault() : undefined}
                      >
                        <p className="text-sm font-medium text-foreground truncate">
                          {getOriginalFileName(file.path)}
                        </p>
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 gap-1.5 text-xs h-7 px-2"
                        disabled={downloadingPath === file.path}
                        onClick={() => void handleDownload(file.path, '', 'Agreement')}
                      >
                        {downloadingPath === file.path
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Download className="h-3 w-3" />}
                        Download
                      </Button>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Email Reminders Sent */}
            {reminders.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Mail className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Email Reminders Sent</h2>
                  <span className="text-xs text-muted-foreground">({reminders.length})</span>
                </div>
                <div className="space-y-1.5">
                  {reminders.map(reminder => (
                    <Card
                      key={reminder.id}
                      className="flex items-center gap-3 border border-border px-4 py-3"
                    >
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{reminder.subcontractor}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {reminder.projectName && <span className="text-primary">{reminder.projectName} · </span>}
                          To: {reminder.emailTo} · {format(new Date(reminder.sentAt), 'MMM d, yyyy h:mm a')}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{reminder.policies.join(', ')}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
