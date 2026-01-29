import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: 'active' | 'expiring' | 'expired' | 'suspended';
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const statusConfig = {
    active: {
      label: label || 'Active',
      className: 'status-active'
    },
    expiring: {
      label: label || 'Expiring',
      className: 'status-expiring'
    },
    expired: {
      label: label || 'Expired',
      className: 'status-expired'
    },
    suspended: {
      label: label || 'Suspended',
      className: 'status-suspended'
    }
  };

  const config = statusConfig[status];

  return (
    <span className={cn('status-badge', config.className, className)}>
      {config.label}
    </span>
  );
}
