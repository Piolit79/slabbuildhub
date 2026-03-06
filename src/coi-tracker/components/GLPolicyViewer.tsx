import { GLPolicy } from '@/coi-tracker/types';
import { Card } from '@/components/ui/card';
import { Shield, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GLPolicyViewerProps {
  policy: GLPolicy;
}

const statusIcons = {
  included: CheckCircle2,
  excluded: XCircle,
  unknown: HelpCircle,
};

const statusColors = {
  included: 'text-status-valid',
  excluded: 'text-status-expired',
  unknown: 'text-status-warning',
};

export function GLPolicyViewer({ policy, insuredName }: GLPolicyViewerProps & { insuredName?: string }) {
  return (
    <Card className="border border-border p-5">
      {insuredName && (
        <p className="text-sm font-semibold text-foreground mb-3">{insuredName}</p>
      )}
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">GL Policy Details</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm mb-5">
        <div>
          <span className="text-xs text-muted-foreground">Policy Number</span>
          <p className="font-mono text-xs font-medium text-foreground">{policy.policyNumber}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Carrier</span>
          <p className="text-xs font-medium text-foreground">{policy.carrier}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Each Occurrence</span>
          <p className="text-xs font-semibold text-foreground">{policy.perOccurrenceLimit || policy.coverageLimit}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">General Aggregate</span>
          <p className="text-xs font-semibold text-foreground">{policy.aggregateLimit || 'N/A'}</p>
        </div>
        <div className="col-span-2">
          <span className="text-xs text-muted-foreground">Period</span>
          <p className="text-xs font-medium text-foreground">{policy.effectiveDate} — {policy.expirationDate}</p>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Coverage Provisions</h4>
        <div className="space-y-2">
          {policy.provisions.map((provision) => {
            const Icon = statusIcons[provision.status];
            return (
              <div key={provision.name} className="flex items-start gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", statusColors[provision.status])} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-foreground">{provision.name}</span>
                  {provision.details && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{provision.details}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
