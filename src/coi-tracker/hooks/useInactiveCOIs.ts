import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/coi-tracker/integrations/supabase/client';

export function useInactiveCOIs() {
  const qc = useQueryClient();

  const { mutate } = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('subcontractor_cois')
        .update({ is_active: isActive } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cois'] });
    },
  });

  const toggleActive = useCallback(
    (id: string, isActive: boolean) => mutate({ id, isActive }),
    [mutate],
  );

  return { toggleActive };
}
