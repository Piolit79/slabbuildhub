import { useProject } from '@/contexts/ProjectContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Archive, Trash2, RotateCcw } from 'lucide-react';

export default function Settings() {
  const { projects, archiveProject, deleteProject } = useProject();

  const active = projects.filter(p => p.status !== 'archived');
  const archived = projects.filter(p => p.status === 'archived');

  return (
    <div className="space-y-4">
      <h1 className="text-lg md:text-xl font-bold tracking-tight text-muted-foreground">Settings</h1>

      <Card>
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Active Projects</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.address || '—'}</TableCell>
                  <TableCell>{p.created_at}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => archiveProject(p.id)} title="Archive">
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteProject(p.id)} className="text-destructive hover:text-destructive" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {active.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No active projects</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {archived.length > 0 && (
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Archived Projects</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archived.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.address || '—'}</TableCell>
                    <TableCell>{p.created_at}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Badge variant="secondary" className="text-[10px]">Archived</Badge>
                      <Button variant="ghost" size="sm" onClick={() => deleteProject(p.id)} className="text-destructive hover:text-destructive" title="Delete permanently">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
