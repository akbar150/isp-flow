import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

export function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  variant = 'default',
  className 
}: StatCardProps) {
  const iconVariants = {
    default: 'metric-icon bg-secondary text-secondary-foreground',
    primary: 'metric-icon-primary',
    success: 'metric-icon-success',
    warning: 'metric-icon-warning',
    danger: 'metric-icon-danger'
  };

  return (
    <div className={cn('stat-card', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="stat-card-label">{title}</p>
          <p className="stat-card-value mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
          {trend && (
            <p className={cn(
              "text-sm font-medium mt-2",
              trend.isPositive ? "text-status-active" : "text-status-expired"
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              <span className="text-muted-foreground font-normal ml-1">vs last month</span>
            </p>
          )}
        </div>
        <div className={cn('metric-icon', iconVariants[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
