import { useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function AppHeader() {
  const { projects, selectedProject, setSelectedProjectId, addProject } = useProject();
  const { isClient } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');

  const activeProjects = projects.filter(p => p.status !== 'archived');

  const handleAdd = () => {
    if (!newName.trim()) return;
    addProject(newName.trim(), newAddress.trim() || undefined);
    setNewName('');
    setNewAddress('');
    setAddOpen(false);
  };

  // Client users see project name only (no selector)
  if (isClient) {
    return (
      <header className="h-14 md:h-16 border-b border-border bg-card flex items-center px-4 md:px-6 sticky top-0 z-10">
        <div className="ml-10 md:ml-0">
          <span className="text-xs md:text-sm font-medium text-muted-foreground">{selectedProject.name}</span>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="h-14 md:h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-2 md:gap-4 ml-10 md:ml-0">
          <Select value={selectedProject.id} onValueChange={(val) => {
            if (val === '__add__') {
              setAddOpen(true);
            } else {
              setSelectedProjectId(val);
            }
          }}>
            <SelectTrigger className="w-40 md:w-64 bg-background text-xs md:text-sm h-8 md:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activeProjects.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
              <SelectItem value="__add__" className="text-primary font-medium">
                <span className="flex items-center gap-1"><Plus className="h-3 w-3" /> Add Project</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="proj-name">Project Name</Label>
              <Input id="proj-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Smith Residence" />
            </div>
            <div>
              <Label htmlFor="proj-addr">Address (optional)</Label>
              <Input id="proj-addr" value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="e.g. 123 Main St" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!newName.trim()}>Create Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
