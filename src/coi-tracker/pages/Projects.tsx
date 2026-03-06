import { AppLayout } from '@/coi-tracker/components/AppLayout';
import { Card } from '@/coi-tracker/components/ui/card';
import { useProjects } from '@/coi-tracker/hooks/useProjects';
import { CreateProjectDialog } from '@/coi-tracker/components/CreateProjectDialog';
import { Link } from 'react-router-dom';
import { MapPin, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const projectStatusStyles: Record<string, string> = {
  active: 'bg-status-valid-bg text-status-valid',
  completed: 'bg-muted text-muted-foreground',
  'on-hold': 'bg-status-warning-bg text-status-warning',
};

export default function Projects() {
  const { data: projects, isLoading } = useProjects();

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projects</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage COIs per project</p>
          </div>
          <CreateProjectDialog />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (projects || []).length === 0 ? (
          <Card className="border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">No projects yet. Click "New Project" to get started.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {(projects || []).map((project) => (
              <Link key={project.id} to={`/insurance/projects/${project.id}`}>
                <Card className="group flex items-center gap-4 border border-border p-5 transition-all hover:shadow-md hover:border-primary/20">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <h3 className="text-base font-semibold text-foreground truncate">{project.name}</h3>
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", projectStatusStyles[project.status] || '')}>
                        {project.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{project.client}</p>
                    {project.address && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                        <MapPin className="h-3 w-3" />{project.address}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-center shrink-0">
                    <div>
                      <p className="text-lg font-bold text-foreground">{project.coiCount}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">COIs</p>
                    </div>
                    {project.expiringCount > 0 && (
                      <div>
                        <p className="text-lg font-bold text-status-warning">{project.expiringCount}</p>
                        <p className="text-[10px] text-status-warning uppercase tracking-wider">Expiring</p>
                      </div>
                    )}
                    {project.expiredCount > 0 && (
                      <div>
                        <p className="text-lg font-bold text-status-expired">{project.expiredCount}</p>
                        <p className="text-[10px] text-status-expired uppercase tracking-wider">Expired</p>
                      </div>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
