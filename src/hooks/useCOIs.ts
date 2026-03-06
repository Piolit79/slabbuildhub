import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { COI, getStatusFromDays } from '@/types';
import { Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type COIRow = Tables<'cois'>;

function computeDays(dateStr: string): number {
  const exp = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function rowToCOI(row: COIRow): COI {
  const days = computeDays(row.expiration_date);
  const status = getStatusFromDays(days);
  const wcDays = row.wc_expiration_date ? computeDays(row.wc_expiration_date) : null;
  const provisions = Array.isArray(row.gl_provisions) ? row.gl_provisions as any[] : [];

  return {
    id: row.id,
    project_id: row.project_id,
    vendor_id: row.vendor_id ?? undefined,
    insured_name: row.insured_name,
    company: row.company ?? '',
    policyNumber: row.policy_number ?? '',
    carrier: row.carrier ?? '',
    effectiveDate: row.effective_date ?? '',
    expirationDate: row.expiration_date,
    status,
    daysUntilExpiry: days,
    additional_insured: row.additional_insured ?? undefined,
    certificate_holder: row.certificate_holder ?? undefined,
    is_active: row.is_active ?? true,
    contact_email1: row.contact_email1 ?? undefined,
    contact_email2: row.contact_email2 ?? undefined,
    glPolicy: row.gl_expiration_date ? {
      policyNumber: row.gl_policy_number ?? '',
      carrier: row.gl_carrier ?? row.carrier ?? '',
      effectiveDate: row.gl_effective_date ?? '',
      expirationDate: row.gl_expiration_date,
      coverageLimit: row.gl_coverage_limit ?? '',
      perOccurrenceLimit: row.gl_per_occurrence_limit ?? '',
      aggregateLimit: row.gl_aggregate_limit ?? '',
      provisions,
    } : undefined,
    wcPolicy: row.wc_expiration_date ? {
      policyNumber: row.wc_policy_number ?? '',
      carrier: row.wc_carrier ?? '',
      effectiveDate: row.wc_effective_date ?? '',
      expirationDate: row.wc_expiration_date,
      status: getStatusFromDays(wcDays!),
      daysUntilExpiry: wcDays!,
    } : undefined,
  };
}

export function useCOIs() {
  const [cois, setCois] = useState<COI[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCOIs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('cois')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error loading COIs', description: error.message, variant: 'destructive' });
    } else {
      setCois((data ?? []).map(rowToCOI));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCOIs(); }, [fetchCOIs]);

  const addCOI = async (form: {
    project_id: string;
    subcontractor: string;
    company: string;
    gl_policy_number: string;
    gl_carrier: string;
    gl_effective_date: string;
    gl_expiration_date: string;
    gl_coverage_limit: string;
    labor_law_coverage: string;
    action_over: string;
    hammer_clause: string;
    wc_policy_number: string;
    wc_carrier: string;
    wc_effective_date: string;
    wc_expiration_date: string;
  }): Promise<boolean> => {
    const { error } = await supabase.from('cois').insert({
      project_id: form.project_id,
      insured_name: form.subcontractor,
      company: form.company,
      carrier: form.gl_carrier,
      policy_number: form.gl_policy_number,
      effective_date: form.gl_effective_date || null,
      expiration_date: form.gl_expiration_date,
      gl_policy_number: form.gl_policy_number,
      gl_carrier: form.gl_carrier,
      gl_effective_date: form.gl_effective_date || null,
      gl_expiration_date: form.gl_expiration_date || null,
      gl_coverage_limit: form.gl_coverage_limit,
      gl_provisions: [
        { name: 'Labor Law Coverage', status: form.labor_law_coverage },
        { name: 'Action Over', status: form.action_over },
        { name: 'Hammer Clause', status: form.hammer_clause },
      ],
      wc_policy_number: form.wc_policy_number || null,
      wc_carrier: form.wc_carrier || null,
      wc_effective_date: form.wc_effective_date || null,
      wc_expiration_date: form.wc_expiration_date || null,
      is_active: true,
    });

    if (error) {
      toast({ title: 'Error saving COI', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchCOIs();
    return true;
  };

  const updateCOIEmails = async (id: string, email1: string, email2: string): Promise<boolean> => {
    const { error } = await supabase
      .from('cois')
      .update({ contact_email1: email1 || null, contact_email2: email2 || null })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error saving emails', description: error.message, variant: 'destructive' });
      return false;
    }
    await fetchCOIs();
    return true;
  };

  return { cois, loading, addCOI, updateCOIEmails, refetch: fetchCOIs };
}
