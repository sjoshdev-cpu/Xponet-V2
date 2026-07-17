import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

/**
 * QueueCard — a titled, scrollable list panel with a count badge and an
 * optional "View all" link. Extracted verbatim from CommandCenter.jsx; the
 * caller supplies the rows as children and an `empty` message.
 */
export default function QueueCard({ title, icon: Icon, iconCls, count, empty, children, viewHref }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={cn('h-4 w-4', iconCls)} />}
          <span className="text-sm font-semibold">{title}</span>
          {count > 0 && (
            <span className="text-xs font-bold bg-foreground/10 px-1.5 py-0.5 rounded">{count}</span>
          )}
        </div>
        {viewHref && (
          <button
            onClick={() => navigate(viewHref)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
          >
            View all <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto max-h-72">
        {count === 0
          ? <p className="text-sm text-muted-foreground text-center py-6">{empty}</p>
          : children
        }
      </div>
    </div>
  );
}
