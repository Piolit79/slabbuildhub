import { useProject } from '@/contexts/ProjectContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function AppHeader() {
  const { projects, selectedProject, setSelectedProjectId } = useProject();

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <Select value={selectedProject.id} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-64 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge
          variant={selectedProject.status === 'active' ? 'default' : 'secondary'}
          className={selectedProject.status === 'active' ? 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]' : ''}
        >
          {selectedProject.status}
        </Badge>
      </div>
    </header>
  );
}
