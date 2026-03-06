import { COI, getStatusFromDays } from '@/types';
import { COIStatusBadge } from './COIStatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface COIDetailDialogProps {
  coi: COI | null;
  onClose: () => void;
}

export function COIDetailDialog({ coi, onClose }: COIDetailDialogProps) {
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
          {/* Insured & Carrier */}
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
              {/* Provisions */}
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

          {/* Umbrella */}
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
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WC */}
          {coi.wcPolicy && (
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
