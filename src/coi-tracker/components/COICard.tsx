import { COI } from '@/coi-tracker/types';
import { StatusBadge } from './StatusBadge';
import { ComplianceBadge } from './ComplianceBadge';
import { Card } from '@/components/ui/card';
import { Building2, Calendar, FileText, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface COICardProps {
  coi: COI;
  onClick?: (coi: COI) => void;
}

export function COICard({ coi, onClick }: COICardProps) {
  const isActive = coi.is_active !== false;

  return (
    <Card
      className={cn(
        'group cursor-pointer border border-border p-4 transition-all hover:shadow-md hover:border-primary/20',
        !isActive && 'opacity-50 bg-muted/30'
      )}
      onClick={() => onClick?.(coi)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={cn('text-sm font-semibold truncate', isActive ? 'text-foreground' : 'text-muted-foreground line-through')}>
              {coi.subcontractor}
            </h4>
            {isActive && <StatusBadge status={coi.status} daysUntilExpiry={coi.daysUntilExpiry} />}
            {isActive && <ComplianceBadge coi={coi} />}
            {!isActive && (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Inactive</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{coi.carrier}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {coi.policyNumber}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Exp: {coi.expirationDate}
        </span>
        {coi.wcPolicy && (
          <span className="flex items-center gap-1">
            <Building2 className="h-3 w-3" />
            WC: {coi.wcPolicy.expirationDate}
          </span>
        )}
      </div>
    </Card>
  );
}
