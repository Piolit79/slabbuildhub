import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/coi-tracker/integrations/supabase/client';

export function useContactEmails(coiId: string, initialEmail1 = '', initialEmail2 = '') {
  const qc = useQueryClient();
  const [emails, setEmailsLocal] = useState({ email1: initialEmail1, email2: initialEmail2 });

  // Sync when initial values change (DB refetch or fuzzy match resolves)
  useEffect(() => {
    setEmailsLocal({ email1: initialEmail1, email2: initialEmail2 });
  }, [initialEmail1, initialEmail2]);

  const { mutate } = useMutation({
    mutationFn: async ({ email1, email2 }: { email1: string; email2: string }) => {
      const { error } = await supabase
        .from('subcontractor_cois')
        .update({ contact_email1: email1 || null, contact_email2: email2 || null } as any)
        .eq('id', coiId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cois'] });
    },
  });

  const setEmails = useCallback(
    (email1: string, email2: string) => {
      setEmailsLocal({ email1, email2 });
      mutate({ email1, email2 });
    },
    [mutate],
  );

  return { emails, setEmails };
}
