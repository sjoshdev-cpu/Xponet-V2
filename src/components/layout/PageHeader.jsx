/**
 * PageHeader — consistent page-level header used across all top-level routes.
 *
 * Usage:
 *   <PageHeader
 *     icon="✅"
 *     title="Tasks"
 *     badge={<Badge>5 overdue</Badge>}
 *     actions={<Button>New Task</Button>}
 *     breadcrumbs={[{ id, icon, title }]}   // optional
 *     saveStatus="idle"                      // 'idle' | 'saving' | 'saved'
 *   />
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PageHeader({
  icon,
  title,
  badge,
  actions,
  breadcrumbs,  // [{ id, icon, title }]
  saveStatus,   // 'idle' | 'saving' | 'saved'
  className,
}) {
  return (
    <div
      className={cn(
        'h-[52px] border-b border-border shrink-0',
        'flex items-center justify-between gap-4 px-6',
        className,
      )}
    >
      {/* Left: breadcrumbs + icon + title + badge */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-sm text-muted-foreground shrink-0">
            {breadcrumbs.map((crumb) => (
              <React.Fragment key={crumb.id}>
                <Link
                  to={`/page/${crumb.id}`}
                  className="hover:text-foreground transition-colors truncate max-w-[120px]"
                >
                  {crumb.icon} {crumb.title || 'Untitled'}
                </Link>
                <ChevronRight className="h-3 w-3 shrink-0" />
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Icon */}
        {icon && (
          <span className="text-xl leading-none shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}

        {/* Title */}
        <h1 className="text-lg font-semibold tracking-tight truncate">{title}</h1>

        {/* Badge slot */}
        {badge && <span className="shrink-0">{badge}</span>}
      </div>

      {/* Right: save status + action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Save indicator */}
        {saveStatus === 'saving' && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <Check className="h-3 w-3" /> Saved
          </span>
        )}

        {/* Action buttons slot */}
        {actions}
      </div>
    </div>
  );
}
