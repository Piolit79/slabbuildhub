import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Archive, Trash2, Plus, Loader2, FolderOpen, SlidersHorizontal, Database, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { Profile } from '@/contexts/AuthContext';

export default function Settings() {
  const { projects, archiveProject, deleteProject } = useProject();
  const [companyUsers, setCompanyUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [qbConnected, setQbConnected] = useState<boolean | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const active = projects.filter(p => p.status !== 'archived');
  const archived = projects.filter(p => p.status === 'archived');

  useEffect(() => {
    loadCompanyUsers();
    checkQBStatus();
    // Handle redirect back from QB OAuth
    const qb = searchParams.get('qb');
    if (qb === 'connected') {
      toast.success('QuickBooks connected');
      setQbConnected(true);
      setSearchParams({});
    } else if (qb === 'error') {
      toast.error('QuickBooks connection failed', { description: searchParams.get('msg') || undefined });
      setSearchParams({});
    }
  }, []);

  const checkQBStatus = async () => {
    try {
      const resp = await fetch('/api/qb-status');
      const data = await resp.json();
      setQbConnected(data.connected);
    } catch {
      setQbConnected(false);
    }
  };

  const disconnectQB = async () => {
    await supabase.from('qb_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setQbConnected(false);
    toast.success('QuickBooks disconnected');
  };

  const loadCompanyUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_type', 'company')
      .order('created_at');
    setCompanyUsers((data || []) as Profile[]);
    setLoadingUsers(false);
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string;
    const password = fd.get('password') as string;
    const fullName = fd.get('full_name') as string;

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      toast.error('Failed to create user', { description: error.message });
      setCreating(false);
      return;
    }

    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName,
        user_type: 'company',
      });

      // Restore current admin session
      const currentSession = localStorage.getItem('sb-nlusfndskgdcottasfdy-auth-token');
      if (currentSession) {
        const parsed = JSON.parse(currentSession);
        await supabase.auth.setSession({
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token,
        });
      }

      toast.success('Company user created');
      loadCompanyUsers();
    }

    setCreating(false);
    setOpen(false);
  };

  const handleDeleteUser = async (id: string) => {
    await supabase.from('profiles').delete().eq('id', id);
    setCompanyUsers(prev => prev.filter(u => u.id !== id));
    toast.success('User removed');
  };

  return (
    <div className="space-y-4">
      <h1 className="text-lg md:text-xl font-bold tracking-tight text-muted-foreground">Settings</h1>

      {/* QuickBooks Integration */}
      <Card>
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">QuickBooks Online</span>
              {qbConnected === null ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : qbConnected ? (
                <span className="flex items-center gap-1 text-[11px] text-green-600"><CheckCircle2 size={13} /> Connected</span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><XCircle size={13} /> Not connected</span>
              )}
            </div>
            {qbConnected ? (
              <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={disconnectQB}>Disconnect</Button>
            ) : (
              <a href="/api/qb-auth">
                <Button size="sm" className="h-7 text-xs">Connect to QuickBooks</Button>
              </a>
            )}
          </div>
          {qbConnected && (
            <p className="text-[11px] text-muted-foreground mt-2">Go to Payments on any project to sync QB checks.</p>
          )}
        </CardContent>
      </Card>

      {/* Admin Tools */}
      <Card>
        <CardHeader className="pb-1 pt-3 px-4">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Admin Tools</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 flex flex-wrap gap-2">
          <Link to="/insurance/files">
            <Button variant="outline" size="sm" className="flex items-center gap-2"><FolderOpen className="h-3.5 w-3.5" /> COI Files</Button>
          </Link>
          <Link to="/insurance/settings">
            <Button variant="outline" size="sm" className="flex items-center gap-2"><SlidersHorizontal className="h-3.5 w-3.5" /> COI Settings</Button>
          </Link>
          <Link to="/code/admin">
            <Button variant="outline" size="sm" className="flex items-center gap-2"><Database className="h-3.5 w-3.5" /> Manage Sources</Button>
          </Link>
        </CardContent>
      </Card>

      {/* Company Users */}
      <Card>
        <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Company Users</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs"><Plus size={12} /> Add User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Company User</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-3">
                <div className="space-y-1"><Label className="text-xs">Full Name</Label><Input name="full_name" required className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Email</Label><Input name="email" type="email" required className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Password</Label><Input name="password" type="password" required minLength={6} className="h-8 text-xs" /></div>
                <Button type="submit" size="sm" className="w-full" disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create User'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {loadingUsers ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyUsers.map((u, idx) => (
                  <TableRow key={u.id} style={idx % 2 === 0 ? { backgroundColor: 'rgba(195, 126, 135, 0.12)' } : undefined}>
                    <TableCell className="text-[11px] md:text-sm">{u.full_name || '—'}</TableCell>
                    <TableCell className="text-[11px] md:text-sm">{u.email}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(u.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {companyUsers.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-xs py-4">No company users yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Active Projects */}
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
                    {confirmDeleteId === p.id ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[11px] text-muted-foreground">Delete?</span>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 px-2 text-xs" onClick={() => { deleteProject(p.id); setConfirmDeleteId(null); }}>Yes</Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setConfirmDeleteId(null)}>No</Button>
                      </span>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(p.id)} className="text-destructive hover:text-destructive" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
                      {confirmDeleteId === p.id ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[11px] text-muted-foreground">Delete?</span>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 px-2 text-xs" onClick={() => { deleteProject(p.id); setConfirmDeleteId(null); }}>Yes</Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setConfirmDeleteId(null)}>No</Button>
                        </span>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(p.id)} className="text-destructive hover:text-destructive" title="Delete permanently">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
