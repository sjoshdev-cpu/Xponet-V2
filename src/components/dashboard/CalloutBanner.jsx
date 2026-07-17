import React from 'react';
import { cn } from '@/lib/utils';

/**
 * CalloutBanner — an alert strip for dashboard pages (breached SLA, high-risk
 * matter overdue, etc.). Extracted verbatim from CommandCenter.jsx.
 *
 * variant: 'danger' | 'warning' | 'info'
 */
export default function CalloutBanner({ variant, icon: Icon, title, body }) {
  const cls = {
    danger:  'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300',
    warning: 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300',
    info:    'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300',
  }[variant] || '';
  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-xl border', cls)}>
      {Icon && <Icon className="h-5 w-5 shrink-0 mt-0.5" />}
      <div>
        <p className="font-semibold text-sm">{title}</p>
        {body && <p className="text-xs opacity-80 mt-0.5">{body}</p>}
      </div>
    </div>
  );
}
