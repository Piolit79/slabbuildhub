import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/coi-tracker/integrations/supabase/client';
import { COI, COIStatus, getStatusFromDays } from '@/coi-tracker/types';
import { differenceInDays, format, parseISO } from 'date-fns';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'MM/dd/yyyy');
  } catch {
    return dateStr;
  }
}

export interface DBCoi {
  id: string;
  project_id: string;
  subcontractor: string;
  company: string;
  gl_policy_number: string | null;
  gl_carrier: string | null;
  gl_effective_date: string | null;
  gl_expiration_date: string | null;
  gl_coverage_limit: string | null;
  labor_law_coverage: string;
  action_over: string;
  hammer_clause: string;
  wc_policy_number: string | null;
  wc_carrier: string | null;
  wc_effective_date: string | null;
  wc_expiration_date: string | null;
  coi_file_path: string | null;
  gl_policy_file_path: string | null;
  created_at: string;
}

function dbCoiToAppCoi(row: DBCoi): COI {
  const today = new Date();
  const glExpDate = row.gl_expiration_date ? new Date(row.gl_expiration_date) : null;
  const glDays = glExpDate ? differenceInDays(glExpDate, today) : -9999;

  const wcExpDate = row.wc_expiration_date ? new Date(row.wc_expiration_date) : null;
  const wcDays = wcExpDate ? differenceInDays(wcExpDate, today) : -9999;

  return {
    id: row.id,
    subcontractor: row.subcontractor,
    company: row.company,
    policyNumber: row.gl_policy_number || '',
    carrier: row.gl_carrier || '',
    effectiveDate: formatDate(row.gl_effective_date),
    expirationDate: formatDate(row.gl_expiration_date),
    status: glExpDate ? getStatusFromDays(glDays) : 'expired',
    daysUntilExpiry: glDays,
    glPolicy: row.gl_policy_number ? {
      policyNumber: row.gl_policy_number,
      carrier: row.gl_carrier || '',
      effectiveDate: formatDate(row.gl_effective_date),
      expirationDate: formatDate(row.gl_expiration_date),
      coverageLimit: row.gl_coverage_limit || '',
      perOccurrenceLimit: (row as any).gl_per_occurrence_limit || row.gl_coverage_limit || '',
      aggregateLimit: (row as any).gl_aggregate_limit || '',
      provisions: [
        { name: 'Labor Law Coverage', status: row.labor_law_coverage as any },
        { name: 'Action Over', status: row.action_over as any },
        { name: 'Hammer Clause', status: row.hammer_clause as any },
      ],
    } : undefined,
    wcPolicy: row.wc_policy_number ? {
      policyNumber: row.wc_policy_number,
      carrier: row.wc_carrier || '',
      effectiveDate: formatDate(row.wc_effective_date),
      expirationDate: formatDate(row.wc_expiration_date),
      status: wcExpDate ? getStatusFromDays(wcDays) : 'expired',
      daysUntilExpiry: wcDays,
    } : undefined,
    gl_policy_file_path: row.gl_policy_file_path,
    coi_file_path: row.coi_file_path,
    is_active: (row as any).is_active !== false,
    contact_email1: (row as any).contact_email1 || '',
    contact_email2: (row as any).contact_email2 || '',
    additional_insured: (row as any).additional_insured || 'unknown',
    certificate_holder: (row as any).certificate_holder || 'unknown',
    description_of_operations: (row as any).description_of_operations || '',
    umbrellaPolicy: (row as any).umbrella_policy_number ? {
      policyNumber: (row as any).umbrella_policy_number,
      carrier: (row as any).umbrella_carrier || '',
      limit: (row as any).umbrella_limit || '',
      effectiveDate: formatDate((row as any).umbrella_effective_date),
      expirationDate: formatDate((row as any).umbrella_expiration_date),
    } : undefined,
  };
}

export function useProjectCOIs(projectId: string | undefined) {
  return useQuery({
    queryKey: ['cois', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<COI[]> => {
      const { data, error } = await supabase
        .from('subcontractor_cois')
        .select('*')
        .eq('project_id', projectId!)
        .order('subcontractor', { ascending: true });
      if (error) throw error;
      return (data || []).map(dbCoiToAppCoi);
    },
  });
}

export function useAllCOIs() {
  return useQuery({
    queryKey: ['cois', 'all'],
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async (): Promise<(COI & { project_id: string })[]> => {
      const { data, error } = await supabase
        .from('subcontractor_cois')
        .select('*')
        .order('subcontractor', { ascending: true });
      if (error) throw error;
      return (data || []).map(row => ({ ...dbCoiToAppCoi(row), project_id: row.project_id }));
    },
  });
}

export interface CreateCOIInput {
  project_id: string;
  subcontractor: string;
  company: string;
  gl_policy_number?: string;
  gl_carrier?: string;
  gl_effective_date?: string;
  gl_expiration_date?: string;
  gl_coverage_limit?: string;
  labor_law_coverage?: string;
  action_over?: string;
  hammer_clause?: string;
  wc_policy_number?: string;
  wc_carrier?: string;
  wc_effective_date?: string;
  wc_expiration_date?: string;
}

export function useCreateCOI() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCOIInput) => {
      const { data, error } = await supabase
        .from('subcontractor_cois')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['cois', vars.project_id] });
      qc.invalidateQueries({ queryKey: ['cois', 'all'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteCOI() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase
        .from('subcontractor_cois')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { projectId };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['cois', vars.projectId] });
      qc.invalidateQueries({ queryKey: ['cois', 'all'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
