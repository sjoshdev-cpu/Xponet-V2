import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * KpiTile — a single dashboard metric tile.
 * Extracted verbatim from CommandCenter.jsx so every dashboard page can reuse
 * it. Behavior is unchanged; `delta` was added (optional) for dashboards that
 * show a week-over-week / day-over-day change indicator.
 *
 * Props:
 *   label, value, icon (lucide component), href (optional, makes it clickable),
 *   variant: 'default' | 'danger' | 'warning' | 'success',
 *   trend:  number — legacy % indicator (kept for CommandCenter parity),
 *   delta:  { value, label? } — signed change indicator (green up / red down).
 */
export default function KpiTile({ label, value, icon: Icon, trend, delta, href, variant = 'default' }) {
  const navigate = useNavigate();
  const variantCls = {
    default: 'bg-card border-border',
    danger:  'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
    warning: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800',
    success: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
  }[variant];
  const iconCls = {
    default: 'text-muted-foreground',
    danger:  'text-red-600 dark:text-red-400',
    warning: 'text-orange-600 dark:text-orange-400',
    success: 'text-green-600 dark:text-green-400',
  }[variant];
  const valueCls = {
    default: 'text-foreground',
    danger:  'text-red-700 dark:text-red-300',
    warning: 'text-orange-700 dark:text-orange-300',
    success: 'text-green-700 dark:text-green-300',
  }[variant];

  return (
    <button
      onClick={() => href && navigate(href)}
      className={cn(
        'rounded-xl border p-5 text-left transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer w-full',
        variantCls,
        !href && 'cursor-default hover:translate-y-0 hover:shadow-none',
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn('p-2 rounded-lg bg-background/60', iconCls)}>
          <Icon className="h-5 w-5" />
        </div>
        {trend !== undefined && (
          <span className={cn('text-xs font-medium', trend > 0 ? 'text-red-600' : 'text-green-600')}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
        {delta !== undefined && delta !== null && (
          <span
            className={cn(
              'text-xs font-medium',
              delta.value > 0 ? 'text-green-600' : delta.value < 0 ? 'text-red-600' : 'text-muted-foreground',
            )}
          >
            {delta.value > 0 ? '▲ ' : delta.value < 0 ? '▼ ' : ''}
            {delta.value > 0 ? '+' : ''}{delta.value}{delta.label ? ` ${delta.label}` : ''}
          </span>
        )}
      </div>
      <div className={cn('text-3xl font-bold', valueCls)}>{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </button>
  );
}
