import { COIStatus } from '@/coi-tracker/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: COIStatus;
  daysUntilExpiry?: number;
  className?: string;
}

const statusConfig = {
  valid: { label: 'Current', className: 'bg-status-valid-bg text-status-valid' },
  expiring: { label: 'Expiring Soon', className: 'bg-status-warning-bg text-status-warning animate-pulse-warning' },
  expired: { label: 'Expired', className: 'bg-status-expired-bg text-status-expired' },
};

export function StatusBadge({ status, daysUntilExpiry, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
      config.className,
      className
    )}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        status === 'valid' && "bg-status-valid",
        status === 'expiring' && "bg-status-warning",
        status === 'expired' && "bg-status-expired",
      )} />
      {config.label}
      {status === 'expiring' && daysUntilExpiry !== undefined && (
        <span className="font-mono text-[10px]">({daysUntilExpiry}d)</span>
      )}
    </span>
  );
}
