import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/coi-tracker/integrations/supabase/client';

export interface GCSettings {
  id: string;
  agreement_file_path: string | null;
  min_gl_coverage_limit: string;
  wc_required: boolean;
  additional_insured_required: boolean;
  company_name: string;
  property_address: string | null;
  owner_info: string | null;
}

export function useGCSettings() {
  return useQuery({
    queryKey: ['gc_settings'],
    queryFn: async (): Promise<GCSettings> => {
      const { data, error } = await supabase
        .from('gc_settings')
        .select('*')
        .limit(1)
        .single();
      if (error) throw error;
      return data as GCSettings;
    },
  });
}

export function useUpdateGCSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<Omit<GCSettings, 'id'>>) => {
      // Get the single settings row
      const { data: existing } = await supabase
        .from('gc_settings')
        .select('id')
        .limit(1)
        .single();
      if (!existing) throw new Error('Settings not found');

      const { data, error } = await supabase
        .from('gc_settings')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gc_settings'] });
    },
  });
}
