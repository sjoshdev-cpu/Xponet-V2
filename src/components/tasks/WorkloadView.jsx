import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { format, isPast, isToday } from 'date-fns';
import { AlertTriangle, ChevronDown, ChevronRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getAssignees } from '@/lib/task-utils';

/** Converts effort strings to numeric points for workload calculation. */
const EFFORT_POINTS = { XS: 0.5, S: 1, M: 2, L: 3, XL: 5 };

const STATUS_BADGE = {
  Backlog: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  'To Do': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'In Progress': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  'In Review': 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  Done: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
};

const PRIORITY_BADGE = {
  Urgent: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  High: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  Medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  Low: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
};

function loadCapacities() {
  try { return JSON.parse(localStorage.getItem('xponet_capacities') || '{}'); } catch { return {}; }
}

function saveCapacities(caps) {
  try { localStorage.setItem('xponet_capacities', JSON.stringify(caps)); } catch { /* ignore */ }
}

export default function WorkloadView({ tasks, onOpenTask }) {
  const [expanded, setExpanded] = useState({});
  const [caps, setCaps] = useState(loadCapacities);

  const setCapacity = (email, val) => {
    const next = { ...caps, [email]: Math.max(1, Number(val) || 5) };
    setCaps(next);
    saveCapacities(next);
  };

  // Group by each assignee (or __unassigned__) — a task with multiple
  // assignees is counted once per person, since it's real work on their plate.
  const groupMap = {};
  tasks.forEach((t) => {
    const assignees = getAssignees(t);
    if (assignees.length === 0) {
      const key = '__unassigned__';
      if (!groupMap[key]) groupMap[key] = { email: key, name: 'Unassigned', tasks: [] };
      groupMap[key].tasks.push(t);
      return;
    }
    assignees.forEach(({ email, name }) => {
      const key = email || '__unassigned__';
      const label = name || (email ? email.split('@')[0] : 'Unassigned');
      if (!groupMap[key]) groupMap[key] = { email: key, name: label, tasks: [] };
      groupMap[key].tasks.push(t);
    });
  });

  const groups = Object.values(groupMap).sort((a, b) => {
    if (a.email === '__unassigned__') return 1;
    if (b.email === '__unassigned__') return -1;
    return a.name.localeCompare(b.name);
  });

  const toggle = (email) =>
    setExpanded((e) => ({ ...e, [email]: e[email] === false ? true : false }));

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">No tasks found</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full p-4 space-y-4">
      {groups.map((group) => {
        const isOpen = expanded[group.email] !== false; // default open
        const openTasks = group.tasks.filter((t) => t.status !== 'Done');
        const doneTasks = group.tasks.filter((t) => t.status === 'Done');
        const inProgress = group.tasks.filter((t) => t.status === 'In Progress').length;
        const overdue = group.tasks.filter(
          (t) =>
            t.due_date &&
            isPast(new Date(t.due_date)) &&
            !isToday(new Date(t.due_date)) &&
            t.status !== 'Done'
        ).length;
        const capacity = caps[group.email] || 5;
        const pct = Math.min((openTasks.length / capacity) * 100, 100);
        const isOverCapacity =
          group.email !== '__unassigned__' && openTasks.length > capacity;

        return (
          <div key={group.email} className="border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <div
              className={cn(
                'flex items-center gap-3 px-4 py-3 cursor-pointer select-none',
                isOverCapacity
                  ? 'bg-red-50 dark:bg-red-950/20'
                  : 'bg-muted/30 hover:bg-muted/50',
              )}
              onClick={() => toggle(group.email)}
            >
              <span className="shrink-0 text-muted-foreground">
                {isOpen
                  ? <ChevronDown className="h-4 w-4" />
                  : <ChevronRight className="h-4 w-4" />}
              </span>

              {/* Avatar */}
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                {group.name.charAt(0).toUpperCase()}
              </div>

              {/* Name + stats */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{group.name}</span>
                  {group.email !== '__unassigned__' && (
                    <span className="text-xs text-muted-foreground truncate max-w-[160px]">
                      {group.email}
                    </span>
                  )}
                  {isOverCapacity && (
                    <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-semibold">
                      <AlertTriangle className="h-3 w-3" />
                      Over capacity
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                  <span>{openTasks.length} open</span>
                  {inProgress > 0 && <span className="text-yellow-600 dark:text-yellow-400">{inProgress} in progress</span>}
                  {doneTasks.length > 0 && <span className="text-green-600 dark:text-green-400">{doneTasks.length} done</span>}
                  {overdue > 0 && <span className="text-red-500 font-semibold">{overdue} overdue</span>}
                </div>
              </div>

              {/* Capacity workload bar + settings — stop propagation so click doesn't toggle */}
              {group.email !== '__unassigned__' && (
                <div
                  className="flex items-center gap-3 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] text-muted-foreground mb-0.5">Workload</div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            isOverCapacity ? 'bg-red-500' : pct > 75 ? 'bg-yellow-500' : 'bg-primary',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {openTasks.length}/{capacity}
                      </span>
                    </div>
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Set capacity">
                        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-52 p-3" align="end">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        Capacity (max open tasks)
                      </p>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={capacity}
                        onChange={(e) => setCapacity(group.email, e.target.value)}
                        className="h-8 text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        Shows warning when open tasks exceed this limit.
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Task rows */}
            {isOpen && (
              <div className="divide-y divide-border/40">
                {group.tasks.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-muted-foreground italic">No tasks</p>
                ) : (
                  group.tasks.map((task) => {
                    const isOverdue =
                      task.due_date &&
                      isPast(new Date(task.due_date)) &&
                      !isToday(new Date(task.due_date)) &&
                      task.status !== 'Done';

                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 px-6 py-2.5 hover:bg-accent/30 cursor-pointer transition-colors"
                        onClick={() => onOpenTask(task)}
                      >
                        <span
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0',
                            STATUS_BADGE[task.status],
                          )}
                        >
                          {task.status}
                        </span>
                        <span
                          className={cn(
                            'flex-1 text-sm truncate',
                            task.status === 'Done' && 'line-through text-muted-foreground',
                          )}
                        >
                          {task.title}
                        </span>
                        {task.priority && (
                          <span
                            className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0',
                              PRIORITY_BADGE[task.priority],
                            )}
                          >
                            {task.priority}
                          </span>
                        )}
                        {task.due_date && (
                          <span
                            className={cn(
                              'text-[10px] shrink-0',
                              isOverdue
                                ? 'text-red-500 font-semibold'
                                : 'text-muted-foreground',
                            )}
                          >
                            {format(new Date(task.due_date), 'MMM d')}
                          </span>
                        )}
                        {task.effort && (
                          <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                            {task.effort}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
