import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/coi-tracker/integrations/supabase/client';

export interface DBProject {
  id: string;
  name: string;
  client: string;
  address: string;
  status: string;
  created_at: string;
  reminder_subject: string | null;
  reminder_body: string | null;
}

export interface DBProjectWithCounts extends DBProject {
  coiCount: number;
  expiringCount: number;
  expiredCount: number;
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async (): Promise<DBProjectWithCounts[]> => {
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      // Fetch COI counts per project
      const { data: cois, error: coiErr } = await supabase
        .from('subcontractor_cois')
        .select('id, project_id, gl_expiration_date, wc_expiration_date');

      if (coiErr) throw coiErr;

      const today = new Date();
      const thirtyDays = new Date(today);
      thirtyDays.setDate(thirtyDays.getDate() + 30);

      return (projects || []).map((p) => {
        const projectCois = (cois || []).filter(c => c.project_id === p.id);
        let expiringCount = 0;
        let expiredCount = 0;

        projectCois.forEach(c => {
          const glExp = c.gl_expiration_date ? new Date(c.gl_expiration_date) : null;
          if (glExp) {
            if (glExp < today) expiredCount++;
            else if (glExp <= thirtyDays) expiringCount++;
          }
        });

        return {
          ...p,
          coiCount: projectCois.length,
          expiringCount,
          expiredCount,
        };
      });
    },
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['projects', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as DBProject;
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      // Fetch file paths for all COIs in this project
      const { data: cois } = await supabase
        .from('subcontractor_cois')
        .select('coi_file_path, gl_policy_file_path')
        .eq('project_id', projectId);

      // Delete associated storage files
      const filePaths = (cois || []).flatMap(c => [c.coi_file_path, c.gl_policy_file_path].filter(Boolean) as string[]);
      if (filePaths.length > 0) {
        await supabase.storage.from('certificates').remove(filePaths);
      }

      // Delete project (cascade deletes COIs in DB)
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['cois'] });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DBProject> & { id: string }) => {
      const { error } = await supabase
        .from('projects')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['projects', vars.id] });
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (project: { name: string; client: string; address: string; status: string }) => {
      const { data, error } = await supabase
        .from('projects')
        .insert(project)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}
