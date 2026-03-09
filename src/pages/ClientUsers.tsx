import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, Pencil, Check, X, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Profile } from '@/contexts/AuthContext';

export default function ClientUsers() {
  const { projects } = useProject();
  const [clients, setClients] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Profile>>({});

  // Undo
  const [undoInfo, setUndoInfo] = useState<{ id: string; prev: Profile } | null>(null);
  const undoTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const showUndo = (id: string, prev: Profile) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoInfo({ id, prev });
    undoTimerRef.current = setTimeout(() => setUndoInfo(null), 10000);
  };
  const handleUndo = async () => {
    if (!undoInfo) return;
    const { id, prev } = undoInfo;
    setClients(p => p.map(c => c.id === id ? prev : c));
    await supabase.from('profiles').update({ full_name: prev.full_name, project_id: prev.project_id }).eq('id', id);
    setUndoInfo(null);
  };

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_type', 'client')
      .order('created_at');
    setClients((data || []) as Profile[]);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string;
    const password = fd.get('password') as string;
    const fullName = fd.get('full_name') as string;
    const projectId = fd.get('project_id') as string;

    // Create auth user via signUp
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error('Failed to create user', { description: error.message });
      setCreating(false);
      return;
    }

    if (data.user) {
      // Create profile
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName,
        user_type: 'client',
        project_id: projectId || null,
      });

      // Sign back in as the current user (signUp auto-signs in the new user)
      // We need to restore the admin session
      const currentSession = localStorage.getItem('sb-nlusfndskgdcottasfdy-auth-token');
      if (currentSession) {
        const parsed = JSON.parse(currentSession);
        await supabase.auth.setSession({
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token,
        });
      }

      toast.success('Client user created');
      loadClients();
    }

    setCreating(false);
    setOpen(false);
  };

  const handleDelete = async (id: string) => {
    setClients(prev => prev.filter(c => c.id !== id));
    await supabase.from('profiles').delete().eq('id', id);
    setConfirmDeleteId(null);
  };

  const startEdit = (c: Profile) => { setEditId(c.id); setEditData({ ...c }); };
  const cancelEdit = () => { setEditId(null); setEditData({}); };
  const saveEdit = async () => {
    const prev = clients.find(c => c.id === editId);
    setClients(p => p.map(c => c.id === editId ? { ...c, ...editData } as Profile : c));
    await supabase.from('profiles').update({
      full_name: editData.full_name,
      project_id: editData.project_id,
    }).eq('id', editId!);
    if (prev) showUndo(editId!, prev);
    cancelEdit();
  };

  const activeProjects = projects.filter(p => p.status !== 'archived');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-bold" style={{ color: '#7b7c81' }}>Client Users</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus size={14} /> Add Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Client User</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Full Name</Label>
                <Input name="full_name" required className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input name="email" type="email" required className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Password</Label>
                <Input name="password" type="password" required minLength={6} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Assigned Project</Label>
                <Select name="project_id">
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {activeProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" size="sm" className="w-full" disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Client'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client Accounts</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c, idx) => {
                  const project = projects.find(p => p.id === c.project_id);
                  return (
                    <TableRow key={c.id} style={idx % 2 === 0 ? { backgroundColor: 'rgba(195, 126, 135, 0.12)' } : undefined} onKeyDown={editId === c.id ? (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(); } else if (e.key === 'Escape') cancelEdit(); } : undefined}>
                      {editId === c.id ? (
                        <>
                          <TableCell>
                            <Input value={editData.full_name || ''} onChange={e => setEditData(d => ({ ...d, full_name: e.target.value }))} className="h-6 text-xs px-1" autoFocus />
                          </TableCell>
                          <TableCell className="text-[11px] md:text-sm">{c.email}</TableCell>
                          <TableCell>
                            <Select value={editData.project_id || ''} onValueChange={v => setEditData(d => ({ ...d, project_id: v }))}>
                              <SelectTrigger className="h-6 text-[10px]"><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {activeProjects.map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <button onClick={saveEdit} className="text-[hsl(var(--success))]"><Check size={14} /></button>
                              <button onClick={cancelEdit} className="text-destructive"><X size={14} /></button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-[11px] md:text-sm">{c.full_name || '—'}</TableCell>
                          <TableCell className="text-[11px] md:text-sm">{c.email}</TableCell>
                          <TableCell className="text-[11px] md:text-sm">
                            {project ? <Badge variant="outline" className="text-[10px]">{project.name}</Badge> : '—'}
                          </TableCell>
                          <TableCell>
                            {undoInfo?.id === c.id ? (
                              <button onClick={handleUndo} className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline whitespace-nowrap"><Undo2 size={11} /> Undo</button>
                            ) : confirmDeleteId === c.id ? (
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <span className="text-[10px] text-muted-foreground">Delete?</span>
                                <button onClick={() => handleDelete(c.id)} className="text-destructive hover:opacity-70"><Check size={13} /></button>
                                <button onClick={() => setConfirmDeleteId(null)} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
                              </div>
                            ) : (
                              <div className="flex gap-1.5">
                                <button onClick={() => startEdit(c)} className="text-muted-foreground hover:text-foreground"><Pencil size={12} /></button>
                                <button onClick={() => setConfirmDeleteId(c.id)} className="text-muted-foreground/40 hover:text-destructive"><Trash2 size={12} /></button>
                              </div>
                            )}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
                {clients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-6">
                      No client users yet. Click "Add Client" to create one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
