import React, { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const safeDate = (val) => {
  if (!val) return new Date();
  if (val?.toDate) return val.toDate();
  return new Date(val);
};
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { getAssignees, getInitials } from '@/lib/task-utils';

const PRIORITY_BADGE = {
  Urgent: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  High: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  Medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  Low: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
};

const STATUS_BADGE = {
  Backlog: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  'To Do': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'In Progress': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  'In Review': 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  Done: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
};

const STATUSES = Object.keys(STATUS_BADGE);
const PRIORITIES = Object.keys(PRIORITY_BADGE);

const COLUMNS = [
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'assignee_name', label: 'Assignee' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'effort', label: 'Effort' },
];

// Header and every virtualized row share this exact template, so the columns
// always line up regardless of how the browser distributes leftover width.
const GRID_TEMPLATE = 'minmax(200px, 1fr) 130px 110px 160px 120px 80px 40px';

function BadgeSelect({ value, options, badgeClasses, onSelect, placeholder }) {
  return (
    <Select value={value || ''} onValueChange={onSelect}>
      <SelectTrigger className="h-auto w-fit border-none bg-transparent p-0 shadow-none focus-visible:ring-1 dark:bg-transparent dark:hover:bg-transparent [&>svg]:opacity-0 [&>svg]:w-3 [&>svg]:-ml-1 hover:[&>svg]:opacity-100">
        {value ? (
          <span className={cn('text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap', badgeClasses[value])}>
            {value}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">{placeholder}</span>
        )}
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', badgeClasses[opt])}>
              {opt}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function TaskTable({ tasks, onOpenTask, onCreateTask, onDeleteTask, onUpdateTask, emptyMessage }) {
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const scrollRef = useRef(null);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = [...tasks].sort((a, b) => {
    if (!sortKey) return 0;
    const va = a[sortKey] || '';
    const vb = b[sortKey] || '';
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="overflow-auto flex-1 text-sm">
        <div className="min-w-[840px]">
          <div
            className="grid sticky top-0 bg-background border-b border-border z-10"
            style={{ gridTemplateColumns: GRID_TEMPLATE }}
          >
            {COLUMNS.map(col => (
              <button
                key={col.key}
                type="button"
                className="flex items-center gap-1 text-left px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                onClick={() => handleSort(col.key)}
              >
                {col.label}
                {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
              </button>
            ))}
            <div />
          </div>

          <div style={{ height: totalHeight, position: 'relative' }}>
            {virtualItems.map(virtualRow => {
              const task = sorted[virtualRow.index];
              const assignees = getAssignees(task);
              return (
                <div
                  key={task.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className="grid items-center absolute w-full border-b border-border/50 hover:bg-accent/30 transition-colors group"
                  style={{ top: virtualRow.start, gridTemplateColumns: GRID_TEMPLATE }}
                >
                  <div className="px-4 py-3 overflow-hidden">
                    <button
                      onClick={() => onOpenTask(task)}
                      title={task.title}
                      className="font-medium hover:text-primary transition-colors text-left truncate block w-full"
                    >
                      {task.title}
                    </button>
                  </div>
                  <div className="px-4 py-3">
                    <BadgeSelect
                      value={task.status}
                      options={STATUSES}
                      badgeClasses={STATUS_BADGE}
                      placeholder="Set status"
                      onSelect={(v) => onUpdateTask?.(task.id, { status: v })}
                    />
                  </div>
                  <div className="px-4 py-3">
                    <BadgeSelect
                      value={task.priority}
                      options={PRIORITIES}
                      badgeClasses={PRIORITY_BADGE}
                      placeholder="Set priority"
                      onSelect={(v) => onUpdateTask?.(task.id, { priority: v })}
                    />
                  </div>
                  <div className="px-4 py-3 text-muted-foreground overflow-hidden">
                    {assignees.length === 0 ? '—' : (
                      <div className="flex items-center gap-1.5">
                        <div className="flex -space-x-1.5 shrink-0">
                          {assignees.slice(0, 3).map((a, i) => (
                            <div key={a.email || i} title={a.name || a.email}
                              className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary border-2 border-background">
                              {getInitials(a)}
                            </div>
                          ))}
                          {assignees.length > 3 && (
                            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground border-2 border-background">
                              +{assignees.length - 3}
                            </div>
                          )}
                        </div>
                        <span className="truncate text-xs">
                          {assignees.length === 1 ? (assignees[0].name || assignees[0].email) : `${assignees.length} people`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {task.due_date ? format(safeDate(task.due_date), 'MMM d, yyyy') : '—'}
                  </div>
                  <div className="px-4 py-3 text-muted-foreground">{task.effort || '—'}</div>
                  <div className="px-2 py-3">
                    <button onClick={() => onDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-sm">{emptyMessage || 'No tasks yet'}</p>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-border/50 shrink-0">
        <Button variant="ghost" size="sm" onClick={onCreateTask} className="text-muted-foreground hover:text-foreground gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New task
        </Button>
      </div>
    </div>
  );
}
