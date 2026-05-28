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

const COLUMNS = [
  { key: 'title', label: 'Title', width: 'min-w-[240px]' },
  { key: 'status', label: 'Status', width: 'w-[120px]' },
  { key: 'priority', label: 'Priority', width: 'w-[100px]' },
  { key: 'assignee_name', label: 'Assignee', width: 'w-[130px]' },
  { key: 'due_date', label: 'Due Date', width: 'w-[110px]' },
  { key: 'effort', label: 'Effort', width: 'w-[80px]' },
];

export default function TaskTable({ tasks, onOpenTask, onCreateTask, onDeleteTask, emptyMessage }) {
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
      <div ref={scrollRef} className="overflow-auto flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background border-b border-border z-10">
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={cn('text-left px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none', col.width)}
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </div>
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody style={{ height: totalHeight, position: 'relative', display: 'block' }}>
            {virtualItems.map(virtualRow => {
              const task = sorted[virtualRow.index];
              return (
                <tr
                  key={task.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className="border-b border-border/50 hover:bg-accent/30 transition-colors group absolute w-full"
                  style={{ top: virtualRow.start, display: 'table', tableLayout: 'fixed' }}
                >
                  <td className="px-4 py-3 min-w-[240px]">
                    <button onClick={() => onOpenTask(task)} className="font-medium hover:text-primary transition-colors text-left">
                      {task.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 w-[120px]">
                    <span className={cn('text-[11px] font-semibold px-2 py-1 rounded-full', STATUS_BADGE[task.status])}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 w-[100px]">
                    <span className={cn('text-[11px] font-semibold px-2 py-1 rounded-full', PRIORITY_BADGE[task.priority])}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 w-[130px] text-muted-foreground">{task.assignee_name || '—'}</td>
                  <td className="px-4 py-3 w-[110px] text-muted-foreground">
                    {task.due_date ? format(safeDate(task.due_date), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 w-[80px] text-muted-foreground">{task.effort || '—'}</td>
                  <td className="px-4 py-3 w-10">
                    <button onClick={() => onDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

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