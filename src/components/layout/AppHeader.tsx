import { useProject } from '@/contexts/ProjectContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function AppHeader() {
  const { projects, selectedProject, setSelectedProjectId } = useProject();

  return (
    <header className="h-14 md:h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-2 md:gap-4 ml-10 md:ml-0">
        <Select value={selectedProject.id} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-40 md:w-64 bg-background text-xs md:text-sm h-8 md:h-10">
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
          className={`text-[10px] md:text-xs ${selectedProject.status === 'active' ? 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]' : ''}`}
        >
          {selectedProject.status}
        </Badge>
      </div>
    </header>
  );
}
