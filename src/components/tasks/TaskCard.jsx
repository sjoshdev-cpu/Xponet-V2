import React from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getAssignees, getInitials } from '@/lib/task-utils';

const safeDate = (val) => {
  if (!val) return new Date();
  if (val?.toDate) return val.toDate();
  return new Date(val);
};
import { Calendar } from 'lucide-react';

const PRIORITY_BORDER = {
  Urgent: 'border-l-red-500',
  High: 'border-l-orange-500',
  Medium: 'border-l-yellow-400',
  Low: 'border-l-green-500',
};

const PRIORITY_BADGE = {
  Urgent: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  High: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  Medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  Low: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
};

export default function TaskCard({ task, onClick, isDragging }) {
  const assignees = getAssignees(task);
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card border border-border rounded-lg p-3 cursor-pointer border-l-4 shadow-sm transition-all',
        PRIORITY_BORDER[task.priority] || 'border-l-border',
        isDragging ? 'shadow-lg rotate-1 scale-[1.02]' : 'hover:shadow-md hover:border-primary/20'
      )}
    >
      <p className="text-sm font-medium leading-snug mb-2 line-clamp-2">{task.title}</p>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', PRIORITY_BADGE[task.priority])}>
          {task.priority}
        </span>
        <div className="flex items-center gap-2">
          {task.due_date && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="h-2.5 w-2.5" />
              {format(safeDate(task.due_date), 'MMM d')}
            </span>
          )}
          {assignees.length > 0 && (
            <div className="flex -space-x-1.5 shrink-0">
              {assignees.slice(0, 3).map((a, i) => (
                <div key={a.email || i} title={a.name || a.email}
                  className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary border-2 border-card">
                  {getInitials(a)}
                </div>
              ))}
              {assignees.length > 3 && (
                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground border-2 border-card">
                  +{assignees.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}