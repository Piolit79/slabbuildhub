import { ReactNode, useState, useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, ExternalLink, Mail, Pencil, Send } from 'lucide-react';
import { useContactEmails } from '@/coi-tracker/hooks/useContactEmails';
import { useFuzzyContactEmail } from '@/coi-tracker/hooks/useFuzzyContactEmail';
import { useEmailReminders } from '@/coi-tracker/hooks/useEmailReminders';
import { toast } from 'sonner';
import { Button } from '@/coi-tracker/components/ui/button';
import { Input } from '@/coi-tracker/components/ui/input';
import { StatusBadge } from '@/coi-tracker/components/StatusBadge';
import { ComplianceBadge } from '@/coi-tracker/components/ComplianceBadge';
import { PolicyUploadButton } from '@/coi-tracker/components/PolicyUploadButton';
import { PolicyReviewDialog } from '@/coi-tracker/components/PolicyReviewDialog';
import { COI, getStatusFromDays } from '@/coi-tracker/types';
import { GCSettings } from '@/coi-tracker/hooks/useGCSettings';
import { createSignedFileUrl } from '@/coi-tracker/lib/storageFile';
import { cn } from '@/lib/utils';
import { DEFAULT_REMINDER_SUBJECT, DEFAULT_REMINDER_BODY, applyReminderTemplate } from '@/coi-tracker/lib/reminderTemplate';

function CoverageComplianceCheck({ label, value, minValue }: { label: string; value: string; minValue: string }) {
  const parse = (s: string) => parseFloat((s || '0').replace(/[^0-9.]/g, ''));
  const actual = parse(value);
  const min = parse(minValue);
  const compliant = min <= 0 || actual >= min;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-foreground">{value || 'N/A'}</span>
        {min > 0 && (compliant
          ? <CheckCircle2 className="h-3.5 w-3.5 text-status-valid" />
          : <AlertTriangle className="h-3.5 w-3.5 text-status-expired" />
        )}
      </div>
    </div>
  );
}

function FileViewButton({ filePath, label }: { filePath: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    createSignedFileUrl(filePath).then(({ url }) => setUrl(url)).catch(console.error);
  }, [filePath]);
  if (!url) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-1.5 text-xs h-7 px-2">
        <Loader2 className="h-3 w-3 animate-spin" />{label}
      </Button>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 px-2">
        <ExternalLink className="h-3 w-3" />{label}
      </Button>
    </a>
  );
}

interface COIDetailContentProps {
  coi: COI & { project_id?: string };
  projectId: string;
  projectName?: string;
  reminderSubject?: string | null;
  reminderBody?: string | null;
  settings: GCSettings | undefined;
  footer?: ReactNode;
}

function SendReminderButton({ coi, projectId, projectName, reminderSubject, reminderBody }: {
  coi: COI;
  projectId: string;
  projectName?: string;
  reminderSubject?: string | null;
  reminderBody?: string | null;
}) {
  const fuzzy = useFuzzyContactEmail(coi.id, coi.subcontractor);
  const effectiveEmail1 = coi.contact_email1 || fuzzy.email1;
  const effectiveEmail2 = coi.contact_email2 || fuzzy.email2;
  const { emails } = useContactEmails(coi.id, effectiveEmail1, effectiveEmail2);
  const { addReminder } = useEmailReminders();

  const glNeedsAttention = coi.status === 'expired' || coi.status === 'expiring';
  const wcNeedsAttention = !!coi.wcPolicy?.expirationDate && (coi.wcPolicy.status === 'expired' || coi.wcPolicy.status === 'expiring');

  if (!glNeedsAttention && !wcNeedsAttention) return null;
  if (!emails.email1) return null;

  const policies: string[] = [];
  if (glNeedsAttention) policies.push('General Liability COI');
  if (wcNeedsAttention) policies.push("Workers' Compensation Certificate");

  const templateVars = {
    subcontractor: coi.subcontractor,
    project: projectName || '',
    policies: policies.join(' and your '),
  };

  const subject = applyReminderTemplate(reminderSubject || DEFAULT_REMINDER_SUBJECT, templateVars);
  const body = applyReminderTemplate(reminderBody || DEFAULT_REMINDER_BODY, templateVars);

  const toAddresses = [emails.email1, emails.email2].filter(Boolean).join(',');
  const mailtoHref = `mailto:${toAddresses}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const handleClick = () => {
    window.location.href = mailtoHref;
    addReminder({
      coiId: coi.id,
      subcontractor: coi.subcontractor,
      projectId,
      projectName: projectName || '',
      emailTo: toAddresses,
      subject,
      policies,
    });
    toast.success('Reminder logged', { description: `Email opened for ${coi.subcontractor}` });
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

function COIContactEmails({ coiId, subcontractorName, initialEmail1 = '', initialEmail2 = '' }: { coiId: string; subcontractorName: string; initialEmail1?: string; initialEmail2?: string }) {
  const fuzzy = useFuzzyContactEmail(coiId, subcontractorName);
  const effectiveEmail1 = initialEmail1 || fuzzy.email1;
  const effectiveEmail2 = initialEmail2 || fuzzy.email2;
  const { emails, setEmails } = useContactEmails(coiId, effectiveEmail1, effectiveEmail2);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ email1: '', email2: '' });

  const hasEmails = emails.email1 || emails.email2;

  const openEdit = () => {
    setDraft({ email1: emails.email1, email2: emails.email2 });
    setEditing(true);
  };

  const save = () => {
    setEmails(draft.email1.trim(), draft.email2.trim());
    setEditing(false);
  };

  if (!editing && !hasEmails) {
    return (
      <button
        onClick={openEdit}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Mail className="h-3.5 w-3.5" />
        Add contact email
      </button>
    );
  }

  if (editing) {
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
          <Button size="sm" className="h-7 text-xs" onClick={save}>Save</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</h4>
        <button onClick={openEdit} className="text-muted-foreground hover:text-foreground transition-colors">
          <Pencil className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-2">
        {emails.email1 && (
          <a href={`mailto:${emails.email1}`} className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors">
            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {emails.email1}
          </a>
        )}
        {emails.email2 && (
          <a href={`mailto:${emails.email2}`} className="flex items-center gap-2 text-xs text-foreground hover:text-primary transition-colors">
            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {emails.email2}
          </a>
        )}
      </div>
    </div>
  );
}

export function COIDetailHeader({ coi }: { coi: COI }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {coi.subcontractor}
      <StatusBadge status={coi.status} daysUntilExpiry={coi.daysUntilExpiry} />
      <ComplianceBadge coi={coi} />
    </div>
  );
}

export function COIDetailContent({ coi, projectId, projectName, reminderSubject, reminderBody, settings, footer }: COIDetailContentProps) {
  return (
    <>
      <div className="space-y-4 mt-2">
        {/* Insured & Carrier */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs text-muted-foreground">Insured</span>
            <p className="font-medium text-foreground">{coi.subcontractor}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Carrier</span>
            <p className="font-medium text-foreground">{coi.carrier}</p>
          </div>
        </div>

        {/* GL Details */}
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
              <CoverageComplianceCheck
                label="Each Occurrence"
                value={coi.glPolicy.perOccurrenceLimit || coi.glPolicy.coverageLimit}
                minValue={settings?.min_gl_coverage_limit || ''}
              />
              <CoverageComplianceCheck
                label="General Aggregate"
                value={coi.glPolicy.aggregateLimit || 'N/A'}
                minValue={settings?.min_gl_coverage_limit || ''}
              />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Additional Insured</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground capitalize">{coi.additional_insured || 'unknown'}</span>
                  {settings?.additional_insured_required && (
                    coi.additional_insured === 'confirmed'
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-status-valid" />
                      : <XCircle className="h-3.5 w-3.5 text-status-expired" />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Certificate Holder</span>
                <div className="flex items-center gap-1.5">
                  {(coi.certificate_holder || '').toUpperCase().includes('SLAB') ? (
                    <>
                      <span className="font-medium text-foreground">SLAB Builders</span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-status-valid" />
                    </>
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-status-expired" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Umbrella / Excess */}
        {coi.umbrellaPolicy && (
          <div className="rounded-lg border border-border p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Umbrella / Excess Liability</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-xs text-muted-foreground">Policy #</span><p className="font-mono text-xs font-medium text-foreground">{coi.umbrellaPolicy.policyNumber}</p></div>
              <div><span className="text-xs text-muted-foreground">Carrier</span><p className="text-xs font-medium text-foreground">{coi.umbrellaPolicy.carrier}</p></div>
              <div><span className="text-xs text-muted-foreground">Limit</span><p className="text-xs font-semibold text-foreground">{coi.umbrellaPolicy.limit}</p></div>
              <div>
                <span className="text-xs text-muted-foreground">Expiration</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs font-medium text-foreground">{coi.umbrellaPolicy.expirationDate}</p>
                  {(() => {
                    const parts = (coi.umbrellaPolicy!.expirationDate || '').split('/');
                    if (parts.length !== 3) return null;
                    const exp = new Date(+parts[2], +parts[0] - 1, +parts[1]);
                    const days = Math.floor((exp.getTime() - Date.now()) / 86400000);
                    return <StatusBadge status={getStatusFromDays(days)} daysUntilExpiry={days} />;
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WC Coverage */}
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
                  <StatusBadge status={coi.wcPolicy.status} daysUntilExpiry={coi.wcPolicy.daysUntilExpiry} />
                </div>
              </div>
            </div>
          </div>
        ) : settings?.wc_required ? (
          <div className="rounded-lg border border-status-expired/30 bg-status-expired-bg p-4 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-status-expired shrink-0" />
            <p className="text-xs font-medium text-status-expired">Workers' Compensation policy required but not provided</p>
          </div>
        ) : null}

        {/* Contact Emails */}
        <COIContactEmails coiId={coi.id} subcontractorName={coi.subcontractor} initialEmail1={coi.contact_email1} initialEmail2={coi.contact_email2} />

        {/* Send Reminder Email */}
        <SendReminderButton coi={coi} projectId={projectId} projectName={projectName} reminderSubject={reminderSubject} reminderBody={reminderBody} />

        {/* Documents */}
        <div className="rounded-lg border border-border p-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Documents</h4>
          <div className="flex flex-wrap items-center gap-2">
            {coi.coi_file_path && <FileViewButton filePath={coi.coi_file_path} label="View COI PDF" />}
            {coi.gl_policy_file_path && <FileViewButton filePath={coi.gl_policy_file_path} label="View GL Policy PDF" />}
            <PolicyUploadButton coiId={coi.id} projectId={projectId} currentFilePath={coi.gl_policy_file_path} />
          </div>
          {!coi.gl_policy_file_path && (
            <p className="text-[11px] text-muted-foreground mt-2">Upload the GL policy PDF to enable in-depth AI review.</p>
          )}
        </div>

        {/* Coverage Provisions & Policy Review */}
        {coi.gl_policy_file_path && coi.glPolicy && coi.glPolicy.provisions.some(p => p.status !== 'unknown') && (
          <div className="rounded-lg border border-border p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Coverage Provisions & Policy Review</h4>
            <div className="space-y-2 mb-3">
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
            <PolicyReviewDialog coiId={coi.id} filePath={coi.gl_policy_file_path} subcontractorName={coi.subcontractor} />
          </div>
        )}
      </div>

      {footer}
    </>
  );
}
