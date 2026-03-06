import { useState } from 'react';
import { supabase } from '@/coi-tracker/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { COI } from '@/coi-tracker/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  coi: COI;
  projectId: string;
  open: boolean;
  onClose: () => void;
}

// Convert "MM/dd/yyyy" → "YYYY-MM-DD" for <input type="date">
function toInputDate(d: string): string {
  if (!d) return '';
  const parts = d.split('/');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
}

export function EditCOIDialog({ coi, projectId, open, onClose }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    subcontractor: coi.subcontractor || '',
    // GL
    gl_policy_number: coi.glPolicy?.policyNumber || coi.policyNumber || '',
    gl_carrier: coi.glPolicy?.carrier || coi.carrier || '',
    gl_effective_date: toInputDate(coi.glPolicy?.effectiveDate || coi.effectiveDate || ''),
    gl_expiration_date: toInputDate(coi.glPolicy?.expirationDate || coi.expirationDate || ''),
    gl_per_occurrence_limit: coi.glPolicy?.perOccurrenceLimit || coi.glPolicy?.coverageLimit || '',
    gl_aggregate_limit: coi.glPolicy?.aggregateLimit || '',
    additional_insured: coi.additional_insured || 'unknown',
    certificate_holder: coi.certificate_holder || '',
    // WC
    wc_policy_number: coi.wcPolicy?.policyNumber || '',
    wc_carrier: coi.wcPolicy?.carrier || '',
    wc_effective_date: toInputDate(coi.wcPolicy?.effectiveDate || ''),
    wc_expiration_date: toInputDate(coi.wcPolicy?.expirationDate || ''),
    // Umbrella
    umbrella_policy_number: coi.umbrellaPolicy?.policyNumber || '',
    umbrella_carrier: coi.umbrellaPolicy?.carrier || '',
    umbrella_limit: coi.umbrellaPolicy?.limit || '',
    umbrella_effective_date: toInputDate(coi.umbrellaPolicy?.effectiveDate || ''),
    umbrella_expiration_date: toInputDate(coi.umbrellaPolicy?.expirationDate || ''),
  });

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('subcontractor_cois')
        .update({
          subcontractor: form.subcontractor,
          gl_policy_number: form.gl_policy_number || null,
          gl_carrier: form.gl_carrier || null,
          gl_effective_date: form.gl_effective_date || null,
          gl_expiration_date: form.gl_expiration_date || null,
          gl_per_occurrence_limit: form.gl_per_occurrence_limit || null,
          gl_aggregate_limit: form.gl_aggregate_limit || null,
          additional_insured: form.additional_insured || null,
          certificate_holder: form.certificate_holder || null,
          wc_policy_number: form.wc_policy_number || null,
          wc_carrier: form.wc_carrier || null,
          wc_effective_date: form.wc_effective_date || null,
          wc_expiration_date: form.wc_expiration_date || null,
          umbrella_policy_number: form.umbrella_policy_number || null,
          umbrella_carrier: form.umbrella_carrier || null,
          umbrella_limit: form.umbrella_limit || null,
          umbrella_effective_date: form.umbrella_effective_date || null,
          umbrella_expiration_date: form.umbrella_expiration_date || null,
        } as any)
        .eq('id', coi.id);

      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ['cois', projectId] });
      await qc.invalidateQueries({ queryKey: ['cois', 'all'] });
      await qc.invalidateQueries({ queryKey: ['projects'] });

      toast.success('COI updated');
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit COI — {coi.subcontractor}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">

          {/* Insured */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Insured</h4>
            <div>
              <Label className="text-xs">Subcontractor / Company Name</Label>
              <Input className="mt-1 h-8 text-sm" value={form.subcontractor} onChange={set('subcontractor')} />
            </div>
          </section>

          {/* General Liability */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">General Liability</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Policy #</Label>
                <Input className="mt-1 h-8 text-sm font-mono" value={form.gl_policy_number} onChange={set('gl_policy_number')} />
              </div>
              <div>
                <Label className="text-xs">Carrier</Label>
                <Input className="mt-1 h-8 text-sm" value={form.gl_carrier} onChange={set('gl_carrier')} />
              </div>
              <div>
                <Label className="text-xs">Effective Date</Label>
                <Input type="date" className="mt-1 h-8 text-sm" value={form.gl_effective_date} onChange={set('gl_effective_date')} />
              </div>
              <div>
                <Label className="text-xs">Expiration Date</Label>
                <Input type="date" className="mt-1 h-8 text-sm" value={form.gl_expiration_date} onChange={set('gl_expiration_date')} />
              </div>
              <div>
                <Label className="text-xs">Each Occurrence</Label>
                <Input className="mt-1 h-8 text-sm" placeholder="e.g. $1,000,000" value={form.gl_per_occurrence_limit} onChange={set('gl_per_occurrence_limit')} />
              </div>
              <div>
                <Label className="text-xs">General Aggregate</Label>
                <Input className="mt-1 h-8 text-sm" placeholder="e.g. $2,000,000" value={form.gl_aggregate_limit} onChange={set('gl_aggregate_limit')} />
              </div>
              <div>
                <Label className="text-xs">Additional Insured</Label>
                <Select value={form.additional_insured} onValueChange={v => setForm(prev => ({ ...prev, additional_insured: v }))}>
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                    <SelectItem value="not_confirmed">Not Confirmed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Certificate Holder</Label>
                <Input className="mt-1 h-8 text-sm" value={form.certificate_holder} onChange={set('certificate_holder')} />
              </div>
            </div>
          </section>

          {/* Workers' Compensation */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Workers' Compensation</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Policy #</Label>
                <Input className="mt-1 h-8 text-sm font-mono" value={form.wc_policy_number} onChange={set('wc_policy_number')} />
              </div>
              <div>
                <Label className="text-xs">Carrier</Label>
                <Input className="mt-1 h-8 text-sm" value={form.wc_carrier} onChange={set('wc_carrier')} />
              </div>
              <div>
                <Label className="text-xs">Effective Date</Label>
                <Input type="date" className="mt-1 h-8 text-sm" value={form.wc_effective_date} onChange={set('wc_effective_date')} />
              </div>
              <div>
                <Label className="text-xs">Expiration Date</Label>
                <Input type="date" className="mt-1 h-8 text-sm" value={form.wc_expiration_date} onChange={set('wc_expiration_date')} />
              </div>
            </div>
          </section>

          {/* Umbrella / Excess */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Umbrella / Excess Liability</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Policy #</Label>
                <Input className="mt-1 h-8 text-sm font-mono" value={form.umbrella_policy_number} onChange={set('umbrella_policy_number')} />
              </div>
              <div>
                <Label className="text-xs">Carrier</Label>
                <Input className="mt-1 h-8 text-sm" value={form.umbrella_carrier} onChange={set('umbrella_carrier')} />
              </div>
              <div>
                <Label className="text-xs">Effective Date</Label>
                <Input type="date" className="mt-1 h-8 text-sm" value={form.umbrella_effective_date} onChange={set('umbrella_effective_date')} />
              </div>
              <div>
                <Label className="text-xs">Expiration Date</Label>
                <Input type="date" className="mt-1 h-8 text-sm" value={form.umbrella_expiration_date} onChange={set('umbrella_expiration_date')} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Limit</Label>
                <Input className="mt-1 h-8 text-sm" placeholder="e.g. $5,000,000" value={form.umbrella_limit} onChange={set('umbrella_limit')} />
              </div>
            </div>
          </section>

        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
