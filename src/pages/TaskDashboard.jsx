/**
 * TaskDashboard.jsx — Week-on-week task dashboard (/dashboard/tasks)
 *
 * Native replacement for the manual Master_Tracker / Trade_Task_Tracker
 * spreadsheet. Every number here is a LIVE query against the Task collection
 * filtered by `category` — there are no cross-sheet references, so there is no
 * #REF!-equivalent failure mode (the old sheet's Trade cells showed #REF!
 * because they pointed at a second sheet that drifted out of sync).
 *
 * Gated to admin/supervisor (canViewAllTasks) — members can only read their
 * own tasks, so an org-wide task rollup is a leadership view.
 */
import React, { useMemo } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { KpiTile, QueueCard } from '@/components/dashboard';
import PageHeader from '@/components/layout/PageHeader';
import { ownerOf, isOverdue, computeTaskDashboardStats } from '@/lib/task-dashboard';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  ListChecks, Circle, CheckCircle2, Percent, AlertTriangle,
  UserX, Trophy, Users, Info, Clock,
} from 'lucide-react';

const STATUS_BADGE = {
  Backlog: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  'To Do': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'In Progress': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  'In Review': 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  Done: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
};

function CategoryTable({ title, tasks }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs font-bold bg-foreground/10 px-1.5 py-0.5 rounded">{tasks.length}</span>
      </div>
      <div className="overflow-auto max-h-96">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No tasks</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-4 py-2 font-medium">Task</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Due Date</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-2 max-w-[240px]">
                    <span className={cn('block truncate', isOverdue(t) && 'text-red-600 dark:text-red-400')}>
                      {t.title}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{ownerOf(t).name}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap tabular-nums">
                    {t.due_date || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap', STATUS_BADGE[t.status])}>
                      {t.status || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function TaskDashboard() {
  const { currentOrg } = useWorkspace();

  const { data: stats, isLoading } = useDashboardStats({
    collections: ['tasks'],
    org_id: currentOrg?.id,
    computeFn: ({ tasks }) => ({
      ...computeTaskDashboardStats(tasks),
      lastRefresh: format(new Date(), 'yyyy-MM-dd HH:mm'),
    }),
  });

  const s = stats || {};
  const quick = s.quick || {};

  const quickRows = [
    ['General Pending', quick.generalPending],
    ['Trade Pending', quick.tradePending],
    ['General Completed', quick.generalCompleted],
    ['Trade Completed', quick.tradeCompleted],
    ['General Overdue', quick.generalOverdue],
    ['Trade Overdue', quick.tradeOverdue],
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader icon="✅" title="Week-on-Week Task Dashboard" />

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Single-source-of-truth reminder */}
        <div className="flex items-start gap-3 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-xs">
            <span className="font-semibold">Edit tasks in one place — the Tasks table.</span>{' '}
            Every KPI, table, and panel below is a live view derived from your tasks, filtered by
            category. Nothing here is a separately maintained sheet, so no value can ever go stale
            or show an error.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Top-row KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <KpiTile label="Overall Tasks" value={s.total} icon={ListChecks} />
              <KpiTile label="Overall Pending" value={s.pending} icon={Circle} href="/tasks" />
              <KpiTile label="Overall Completed" value={s.completed} icon={CheckCircle2} variant="success" />
              <KpiTile label="Completion Rate" value={`${s.completionRate}%`} icon={Percent} />
              <KpiTile
                label="Overall Overdue"
                value={s.overdue}
                icon={AlertTriangle}
                variant={s.overdue > 0 ? 'danger' : 'default'}
                href="/tasks"
              />
              <div className="rounded-xl border border-border bg-card p-5 flex flex-col justify-center">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Last Refresh</span>
                </div>
                <div className="text-sm font-semibold tabular-nums">{s.lastRefresh}</div>
              </div>
            </div>

            {/* Leaders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <KpiTile
                label="Top Defaulter (most overdue)"
                value={s.topDefaulter ? `${s.topDefaulter.name} · ${s.topDefaulter.count}` : '—'}
                icon={UserX}
                variant={s.topDefaulter ? 'danger' : 'default'}
              />
              <KpiTile
                label="Top Closer (done this week)"
                value={s.topCloser ? `${s.topCloser.name} · ${s.topCloser.count}` : '—'}
                icon={Trophy}
                variant={s.topCloser ? 'success' : 'default'}
              />
            </div>

            {/* Category tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CategoryTable title="General Tasks" tasks={s.generalTasks || []} />
              <CategoryTable title="Trade Tasks" tasks={s.tradeTasks || []} />
            </div>

            {/* Owner snapshot + Quick view */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <QueueCard
                title="Owner Snapshot — pending by owner"
                icon={Users}
                iconCls="text-blue-600"
                count={(s.ownerSnapshot || []).length}
                empty="No pending tasks"
              >
                {(s.ownerSnapshot || []).map((o) => (
                  <div key={o.name} className="border-b border-border/50 last:border-0">
                    {/* Owner header: name + how many pending tasks they have */}
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/20">
                      <span className="text-sm font-medium truncate">{o.name}</span>
                      <span className="text-xs font-semibold tabular-nums bg-foreground/10 px-1.5 py-0.5 rounded shrink-0">
                        {o.count} pending
                      </span>
                    </div>
                    {/* Their actual pending tasks */}
                    <ul>
                      {o.tasks.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center gap-2 px-4 py-1.5 text-sm border-t border-border/30"
                        >
                          <span className={cn('flex-1 truncate', isOverdue(t) && 'text-red-600 dark:text-red-400')}>
                            {t.title}
                          </span>
                          <span className={cn('text-[11px] font-semibold px-1.5 py-0.5 rounded-full shrink-0', STATUS_BADGE[t.status])}>
                            {t.status || '—'}
                          </span>
                          {t.due_date && (
                            <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">{t.due_date}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </QueueCard>

              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <span className="text-sm font-semibold">Quick View</span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {quickRows.map(([label, value]) => (
                      <tr key={label} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2.5 text-muted-foreground">{label}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{value ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
