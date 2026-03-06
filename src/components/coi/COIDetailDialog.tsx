import { useState } from 'react';
import { COI } from '@/types';
import { COIStatusBadge } from './COIStatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, AlertTriangle, Mail, Pencil, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface COIDetailDialogProps {
  coi: COI | null;
  projectName?: string;
  onClose: () => void;
  onEmailsSaved?: () => void;
}

function ContactEmailsSection({ coi, onSaved }: { coi: COI; onSaved?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ email1: coi.contact_email1 || '', email2: coi.contact_email2 || '' });

  const hasEmails = coi.contact_email1 || coi.contact_email2;

  if (!editing && !hasEmails) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Mail className="h-3.5 w-3.5" />
        Add contact email
      </button>
    );
  }

  if (editing) {
    const handleSave = async () => {
      setSaving(true);
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase
        .from('cois')
        .update({ contact_email1: draft.email1 || null, contact_email2: draft.email2 || null })
        .eq('id', coi.id);
      setSaving(false);
      if (error) { toast.error('Error saving emails'); return; }
      toast.success('Contact emails saved');
      setEditing(false);
      onSaved?.();
    };

    return (
      <div className="rounded-lg border border-border p-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact Emails</h4>
        <div className="space-y-2">
          <Input
            type="email"
            placeholder="Contact email 1"
            value={draft.email1}
            onChange={e => setDraft(p => ({ ...p, email1: e.target.value }))}
            className="h-8 text-sm"
          />
          <Input
            type="email"
            placeholder="Contact email 2 (optional)"
            value={draft.email2}
            onChange={e => setDraft(p => ({ ...p, email2: e.target.value }))}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</h4>
        <button onClick={() => {
          setDraft({ email1: coi.contact_email1 || '', email2: coi.contact_email2 || '' });
          setEditing(true);
        }} className="text-muted-foreground hover:text-foreground transition-colors">
          <Pencil className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-2">
        {coi.contact_email1 && (
          <a href={`mailto:${coi.contact_email1}`} className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors">
            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {coi.contact_email1}
          </a>
        )}
        {coi.contact_email2 && (
          <a href={`mailto:${coi.contact_email2}`} className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors">
            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {coi.contact_email2}
          </a>
        )}
      </div>
    </div>
  );
}

function SendReminderButton({ coi, projectName }: { coi: COI; projectName?: string }) {
  const glNeedsAttention = coi.status === 'expired' || coi.status === 'expiring';
  const wcNeedsAttention = !!coi.wcPolicy && (coi.wcPolicy.status === 'expired' || coi.wcPolicy.status === 'expiring');

  if (!glNeedsAttention && !wcNeedsAttention) return null;
  if (!coi.contact_email1) return null;

  const policies: string[] = [];
  if (glNeedsAttention) policies.push('General Liability COI');
  if (wcNeedsAttention) policies.push("Workers' Compensation Certificate");

  const subject = `Action Required: Updated Insurance Certificate Needed – ${projectName || 'Project'}`;
  const body = `Dear ${coi.insured_name},\n\nWe are writing to inform you that your ${policies.join(' and your ')} on file for the ${projectName || ''} project is expiring soon or has already expired.\n\nPlease provide an updated certificate of insurance at your earliest convenience naming SLAB Builders LLC as Additional Insured and Certificate Holder.\n\nThank you for your prompt attention to this matter.\n\nBest regards,\nSLAB Builders`;

  const toAddresses = [coi.contact_email1, coi.contact_email2].filter(Boolean).join(',');
  const mailtoHref = `mailto:${toAddresses}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const handleClick = () => {
    window.location.href = mailtoHref;
    toast.success('Reminder email opened', { description: `Email drafted for ${coi.insured_name}` });
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 text-xs text-status-warning hover:text-status-warning/80 font-medium transition-colors"
    >
      <Send className="h-3.5 w-3.5" />
      Send reminder email
    </button>
  );
}

export function COIDetailDialog({ coi, projectName, onClose, onEmailsSaved }: COIDetailDialogProps) {
  if (!coi) return null;

  return (
    <Dialog open={!!coi} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {coi.insured_name}
            <COIStatusBadge status={coi.status} daysUntilExpiry={coi.daysUntilExpiry} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Insured</span>
              <p className="font-medium text-foreground">{coi.insured_name}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Carrier</span>
              <p className="font-medium text-foreground">{coi.carrier}</p>
            </div>
          </div>

          {coi.glPolicy && (
            <div className="rounded-lg border border-border p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">General Liability</h4>
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <span className="text-xs text-muted-foreground">Policy #</span>
                  <p className="font-mono text-xs font-medium text-foreground">{coi.glPolicy.policyNumber}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Expiration</span>
                  <p className="text-xs font-medium text-foreground">{coi.glPolicy.expirationDate}</p>
                </div>
              </div>
              <div className="space-y-2 rounded-md bg-muted/30 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Each Occurrence</span>
                  <span className="font-medium text-foreground">{coi.glPolicy.perOccurrenceLimit}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">General Aggregate</span>
                  <span className="font-medium text-foreground">{coi.glPolicy.aggregateLimit}</span>
                </div>
                {coi.additional_insured && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Additional Insured</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground capitalize">{coi.additional_insured}</span>
                      {coi.additional_insured === 'confirmed'
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-status-valid" />
                        : <XCircle className="h-3.5 w-3.5 text-status-expired" />}
                    </div>
                  </div>
                )}
                {coi.certificate_holder && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Certificate Holder</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{coi.certificate_holder}</span>
                      {coi.certificate_holder.toUpperCase().includes('SLAB')
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-status-valid" />
                        : <XCircle className="h-3.5 w-3.5 text-status-expired" />}
                    </div>
                  </div>
                )}
              </div>
              {coi.glPolicy.provisions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {coi.glPolicy.provisions.map((provision) => {
                    const Icon = provision.status === 'included' ? CheckCircle2 : provision.status === 'excluded' ? XCircle : AlertTriangle;
                    const color = provision.status === 'included' ? 'text-status-valid' : provision.status === 'excluded' ? 'text-status-expired' : 'text-status-warning';
                    return (
                      <div key={provision.name} className="flex items-start gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
                        <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', color)} />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-foreground">{provision.name}</span>
                          {provision.details && <p className="text-[11px] text-muted-foreground mt-0.5">{provision.details}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {coi.umbrellaPolicy && (
            <div className="rounded-lg border border-border p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Umbrella / Excess Liability</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-xs text-muted-foreground">Policy #</span><p className="font-mono text-xs font-medium text-foreground">{coi.umbrellaPolicy.policyNumber}</p></div>
                <div><span className="text-xs text-muted-foreground">Carrier</span><p className="text-xs font-medium text-foreground">{coi.umbrellaPolicy.carrier}</p></div>
                <div><span className="text-xs text-muted-foreground">Limit</span><p className="text-xs font-semibold text-foreground">{coi.umbrellaPolicy.limit}</p></div>
                <div>
                  <span className="text-xs text-muted-foreground">Expiration</span>
                  <p className="text-xs font-medium text-foreground">{coi.umbrellaPolicy.expirationDate}</p>
                </div>
              </div>
            </div>
          )}

          {coi.wcPolicy ? (
            <div className="rounded-lg border border-border p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Workers' Compensation</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-xs text-muted-foreground">Policy #</span><p className="font-mono text-xs font-medium text-foreground">{coi.wcPolicy.policyNumber}</p></div>
                <div><span className="text-xs text-muted-foreground">Carrier</span><p className="text-xs font-medium text-foreground">{coi.wcPolicy.carrier}</p></div>
                <div><span className="text-xs text-muted-foreground">Effective</span><p className="text-xs font-medium text-foreground">{coi.wcPolicy.effectiveDate}</p></div>
                <div>
                  <span className="text-xs text-muted-foreground">Expiration</span>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground">{coi.wcPolicy.expirationDate}</p>
                    <COIStatusBadge status={coi.wcPolicy.status} daysUntilExpiry={coi.wcPolicy.daysUntilExpiry} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-status-expired/30 bg-status-expired-bg p-4 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-status-expired shrink-0" />
              <p className="text-xs font-medium text-status-expired">Workers' Compensation policy not provided</p>
            </div>
          )}

          <ContactEmailsSection coi={coi} onSaved={onEmailsSaved} />
          <SendReminderButton coi={coi} projectName={projectName} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
