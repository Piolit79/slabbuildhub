import { useParams, Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/coi-tracker/components/AppLayout';
import { useProject, useDeleteProject } from '@/coi-tracker/hooks/useProjects';
import { useProjectCOIs, useDeleteCOI } from '@/coi-tracker/hooks/useCOIs';
import { useInactiveCOIs } from '@/coi-tracker/hooks/useInactiveCOIs';
import { COICard } from '@/coi-tracker/components/COICard';
import { DropZone } from '@/coi-tracker/components/DropZone';
import { CreateCOIDialog } from '@/coi-tracker/components/CreateCOIDialog';
import { MergeCOIDialog } from '@/coi-tracker/components/MergeCOIDialog';
import { useGCSettings } from '@/coi-tracker/hooks/useGCSettings';
import { COIDetailContent, COIDetailHeader } from '@/coi-tracker/components/COIDetailContent';
import { ProjectEmailTemplate } from '@/coi-tracker/components/ProjectEmailTemplate';
import { Card } from '@/coi-tracker/components/ui/card';
import { Button } from '@/coi-tracker/components/ui/button';
import { ArrowLeft, MapPin, Loader2, Trash2, PowerOff, Merge } from 'lucide-react';
import { Switch } from '@/coi-tracker/components/ui/switch';
import { COI } from '@/coi-tracker/types';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/coi-tracker/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/coi-tracker/components/ui/alert-dialog';
import { EditCOIDialog } from '@/coi-tracker/components/EditCOIDialog';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading: projLoading } = useProject(id);
  const { data: cois, isLoading: coisLoading } = useProjectCOIs(id);
  const { data: settings } = useGCSettings();
  const [selectedCOI, setSelectedCOI] = useState<COI | null>(null);
  const [editingCOI, setEditingCOI] = useState<COI | null>(null);
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const deleteCOI = useDeleteCOI();
  const deleteProject = useDeleteProject();
  const { toggleActive } = useInactiveCOIs();

  if (projLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Project not found</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
        <Link to="/insurance/projects" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />Back to Projects
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{project.client}</p>
          {project.address && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <MapPin className="h-3 w-3" />{project.address}
            </div>
          )}
        </div>

        <DropZone className="mb-8" projectId={project.id} />

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Certificates of Insurance ({(cois || []).length})
          </h2>
          <div className="flex items-center gap-2">
            {(cois || []).length >= 2 && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setShowMerge(true)}>
                <Merge className="h-3.5 w-3.5" />
                Merge
              </Button>
            )}
            <CreateCOIDialog projectId={project.id} />
          </div>
        </div>

        {coisLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (cois || []).length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(cois || []).map((coi) => (
              <COICard
                key={coi.id}
                coi={coi}
                onClick={setSelectedCOI}
              />
            ))}
          </div>
        ) : (
          <Card className="border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">No COIs yet. Click "Add COI" or drag and drop certificates above.</p>
          </Card>
        )}

        <Dialog open={!!selectedCOI} onOpenChange={() => setSelectedCOI(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            {selectedCOI && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 flex-wrap">
                    <COIDetailHeader coi={selectedCOI} />
                  </DialogTitle>
                </DialogHeader>
                <COIDetailContent
                  coi={selectedCOI}
                  projectId={project.id}
                  projectName={project.name}
                  reminderSubject={project.reminder_subject}
                  reminderBody={project.reminder_body}
                  settings={settings}
                  footer={
                    <div className="pt-2 border-t border-border flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setEditingCOI(selectedCOI)}>
                        <Pencil className="h-3.5 w-3.5" />Edit COI Info
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs"
                        onClick={() => {
                          if (confirm(`Delete ${selectedCOI.subcontractor}? This cannot be undone.`)) {
                            deleteCOI.mutate({ id: selectedCOI.id, projectId: project.id });
                            setSelectedCOI(null);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />Delete COI
                      </Button>
                      <div className="ml-auto flex items-center gap-2">
                        {(() => {
                          const isActive = (cois || []).find(c => c.id === selectedCOI.id)?.is_active !== false;
                          return (
                            <>
                              <PowerOff className={cn('h-3.5 w-3.5', isActive ? 'text-status-valid' : 'text-muted-foreground')} />
                              <span className="text-xs text-muted-foreground">{isActive ? 'Active' : 'Inactive'}</span>
                              <Switch checked={isActive} onCheckedChange={(checked) => toggleActive(selectedCOI.id, checked)} />
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  }
                />
              </>
            )}
          </DialogContent>
        </Dialog>

        <MergeCOIDialog
          projectId={project.id}
          cois={cois || []}
          open={showMerge}
          onClose={() => setShowMerge(false)}
        />

        {editingCOI && (
          <EditCOIDialog
            coi={editingCOI}
            projectId={project.id}
            open={!!editingCOI}
            onClose={() => setEditingCOI(null)}
          />
        )}

        <div className="mt-10">
          <ProjectEmailTemplate
            projectId={project.id}
            subject={project.reminder_subject ?? null}
            body={project.reminder_body ?? null}
          />
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs"
            onClick={() => setShowDeleteProject(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Project
          </Button>
        </div>

        <AlertDialog open={showDeleteProject} onOpenChange={setShowDeleteProject}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{project.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the project and all associated COIs and uploaded files. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  deleteProject.mutate(project.id, {
                    onSuccess: () => navigate('/projects'),
                  });
                }}
              >
                {deleteProject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete Project'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
