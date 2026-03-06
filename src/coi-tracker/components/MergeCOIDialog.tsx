import { useState } from 'react';
import { supabase } from '@/coi-tracker/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { COI } from '@/coi-tracker/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Merge, ChevronRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Source = 'a' | 'b';

interface SectionSources {
  general: Source;
  gl: Source;
  wc: Source;
  umbrella: Source;
}

function pick<T>(a: T, b: T, source: Source): T {
  return source === 'a' ? a : b;
}

function hasGL(coi: COI) { return !!(coi.glPolicy?.policyNumber || coi.policyNumber); }
function hasWC(coi: COI) { return !!coi.wcPolicy?.policyNumber; }
function hasUmbrella(coi: COI) { return !!coi.umbrellaPolicy?.policyNumber; }

function toInputDate(d: string): string {
  if (!d) return '';
  const p = d.split('/');
  if (p.length !== 3) return '';
  return `${p[2]}-${p[0].padStart(2, '0')}-${p[1].padStart(2, '0')}`;
}

function SourceToggle({
  label, source, onToggle, aLabel, bLabel, aHint, bHint,
}: {
  label: string; source: Source; onToggle: (s: Source) => void;
  aLabel: string; bLabel: string; aHint?: string; bHint?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex flex-1 gap-2">
        {(['a', 'b'] as Source[]).map(s => {
          const isA = s === 'a';
          const active = source === s;
          return (
            <button
              key={s}
              onClick={() => onToggle(s)}
              className={cn(
                'flex-1 rounded-md border px-3 py-2 text-left transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider">{isA ? 'COI A' : 'COI B'}</span>
                {active && <CheckCircle2 className="h-3 w-3 text-primary" />}
              </div>
              <span className="text-xs font-medium truncate block">{isA ? aLabel : bLabel}</span>
              {(isA ? aHint : bHint) && (
                <span className="text-[10px] text-muted-foreground truncate block">{isA ? aHint : bHint}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  projectId: string;
  cois: COI[];
  open: boolean;
  onClose: () => void;
}

export function MergeCOIDialog({ projectId, cois, open, onClose }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [coiAId, setCoiAId] = useState<string>('');
  const [coiBId, setCoiBId] = useState<string>('');
  const [merging, setMerging] = useState(false);

  const coiA = cois.find(c => c.id === coiAId);
  const coiB = cois.find(c => c.id === coiBId);

  // Auto-pick the source with more data for each section
  const autoSource = (a: boolean, b: boolean): Source => (!a && b ? 'b' : 'a');
  const [sources, setSources] = useState<SectionSources>({ general: 'a', gl: 'a', wc: 'a', umbrella: 'a' });

  const handleNext = () => {
    if (!coiA || !coiB) return;
    setSources({
      general: 'a',
      gl: autoSource(hasGL(coiA), hasGL(coiB)),
      wc: autoSource(hasWC(coiA), hasWC(coiB)),
      umbrella: autoSource(hasUmbrella(coiA), hasUmbrella(coiB)),
    });
    setStep(2);
  };

  const handleMerge = async () => {
    if (!coiA || !coiB) return;
    setMerging(true);
    try {
      const gl = pick(coiA, coiB, sources.gl);
      const wc = pick(coiA, coiB, sources.wc);
      const umb = pick(coiA, coiB, sources.umbrella);
      const gen = pick(coiA, coiB, sources.general);

      const merged = {
        subcontractor: gen.subcontractor,
        additional_insured: gen.additional_insured || 'unknown',
        certificate_holder: gen.certificate_holder || null,
        // GL
        gl_policy_number: gl.glPolicy?.policyNumber || gl.policyNumber || null,
        gl_carrier: gl.glPolicy?.carrier || gl.carrier || null,
        gl_effective_date: toInputDate(gl.glPolicy?.effectiveDate || gl.effectiveDate || '') || null,
        gl_expiration_date: toInputDate(gl.glPolicy?.expirationDate || gl.expirationDate || '') || null,
        gl_per_occurrence_limit: gl.glPolicy?.perOccurrenceLimit || gl.glPolicy?.coverageLimit || null,
        gl_aggregate_limit: gl.glPolicy?.aggregateLimit || null,
        // WC
        wc_policy_number: wc.wcPolicy?.policyNumber || null,
        wc_carrier: wc.wcPolicy?.carrier || null,
        wc_effective_date: toInputDate(wc.wcPolicy?.effectiveDate || '') || null,
        wc_expiration_date: toInputDate(wc.wcPolicy?.expirationDate || '') || null,
        // Umbrella
        umbrella_policy_number: umb.umbrellaPolicy?.policyNumber || null,
        umbrella_carrier: umb.umbrellaPolicy?.carrier || null,
        umbrella_limit: umb.umbrellaPolicy?.limit || null,
        umbrella_effective_date: toInputDate(umb.umbrellaPolicy?.effectiveDate || '') || null,
        umbrella_expiration_date: toInputDate(umb.umbrellaPolicy?.expirationDate || '') || null,
        // Files — always keep both: prefer A, fallback to B for each independently
        coi_file_path: coiA.coi_file_path || coiB.coi_file_path || null,
        gl_policy_file_path: coiA.gl_policy_file_path || coiB.gl_policy_file_path || null,
      };

      const { error: updateErr } = await supabase
        .from('subcontractor_cois')
        .update(merged as any)
        .eq('id', coiA.id);
      if (updateErr) throw updateErr;

      const { error: deleteErr } = await supabase
        .from('subcontractor_cois')
        .delete()
        .eq('id', coiB.id);
      if (deleteErr) throw deleteErr;

      await qc.invalidateQueries({ queryKey: ['cois', projectId] });
      await qc.invalidateQueries({ queryKey: ['cois', 'all'] });
      await qc.invalidateQueries({ queryKey: ['projects'] });

      toast.success('COIs merged successfully');
      handleClose();
    } catch (e) {
      console.error(e);
      toast.error('Merge failed', { description: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setMerging(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setCoiAId('');
    setCoiBId('');
    onClose();
  };

  const canProceed = !!coiAId && !!coiBId && coiAId !== coiBId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-4 w-4 text-primary" />
            Merge COIs
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Select two COIs to merge into one record.'
              : 'Choose which record to use for each section. COI A is kept; COI B is deleted.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn('font-medium', step === 1 ? 'text-foreground' : '')}>1. Select</span>
          <ChevronRight className="h-3 w-3" />
          <span className={cn('font-medium', step === 2 ? 'text-foreground' : '')}>2. Review & Merge</span>
        </div>

        {step === 1 && (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">COI A — kept after merge</label>
              <Select value={coiAId} onValueChange={setCoiAId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select first COI…" />
                </SelectTrigger>
                <SelectContent>
                  {cois.filter(c => c.id !== coiBId).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.subcontractor} {c.expirationDate ? `— exp. ${c.expirationDate}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">COI B — deleted after merge</label>
              <Select value={coiBId} onValueChange={setCoiBId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select second COI…" />
                </SelectTrigger>
                <SelectContent>
                  {cois.filter(c => c.id !== coiAId).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.subcontractor} {c.expirationDate ? `— exp. ${c.expirationDate}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
              <Button size="sm" onClick={handleNext} disabled={!canProceed}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 2 && coiA && coiB && (
          <div className="space-y-3 mt-2">
            <SourceToggle
              label="Name"
              source={sources.general}
              onToggle={s => setSources(p => ({ ...p, general: s }))}
              aLabel={coiA.subcontractor}
              bLabel={coiB.subcontractor}
            />
            <SourceToggle
              label="GL Policy"
              source={sources.gl}
              onToggle={s => setSources(p => ({ ...p, gl: s }))}
              aLabel={coiA.glPolicy?.policyNumber || coiA.policyNumber || '—'}
              bLabel={coiB.glPolicy?.policyNumber || coiB.policyNumber || '—'}
              aHint={coiA.glPolicy?.expirationDate ? `Exp. ${coiA.glPolicy.expirationDate}` : undefined}
              bHint={coiB.glPolicy?.expirationDate ? `Exp. ${coiB.glPolicy.expirationDate}` : undefined}
            />
            <SourceToggle
              label="WC Policy"
              source={sources.wc}
              onToggle={s => setSources(p => ({ ...p, wc: s }))}
              aLabel={coiA.wcPolicy?.policyNumber || '—'}
              bLabel={coiB.wcPolicy?.policyNumber || '—'}
              aHint={coiA.wcPolicy?.expirationDate ? `Exp. ${coiA.wcPolicy.expirationDate}` : undefined}
              bHint={coiB.wcPolicy?.expirationDate ? `Exp. ${coiB.wcPolicy.expirationDate}` : undefined}
            />
            <SourceToggle
              label="Umbrella"
              source={sources.umbrella}
              onToggle={s => setSources(p => ({ ...p, umbrella: s }))}
              aLabel={coiA.umbrellaPolicy?.policyNumber || '—'}
              bLabel={coiB.umbrellaPolicy?.policyNumber || '—'}
              aHint={coiA.umbrellaPolicy?.expirationDate ? `Exp. ${coiA.umbrellaPolicy.expirationDate}` : undefined}
              bHint={coiB.umbrellaPolicy?.expirationDate ? `Exp. ${coiB.umbrellaPolicy.expirationDate}` : undefined}
            />
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              <span className="text-xs font-medium text-muted-foreground w-20 shrink-0">Files</span>
              <p className="text-xs text-muted-foreground">
                All uploaded files from both COIs will be kept — COI PDFs and GL policy PDFs are preserved independently.
              </p>
            </div>

            <p className="text-[11px] text-muted-foreground pt-1">
              The result will be saved to <span className="font-medium text-foreground">{coiA.subcontractor}</span>'s record. <span className="font-medium text-foreground">{coiB.subcontractor}</span>'s record will be permanently deleted.
            </p>

            <div className="flex justify-between gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClose} disabled={merging}>Cancel</Button>
                <Button size="sm" onClick={handleMerge} disabled={merging} className="gap-1.5">
                  {merging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Merge className="h-3.5 w-3.5" />}
                  Merge COIs
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
