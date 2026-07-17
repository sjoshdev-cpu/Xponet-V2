/**
 * CommandCenter.jsx — Real-time ops console dashboard (F27)
 * KPI tiles: Open Tickets · Breached · Escalated · Overdue Tasks · Avg Severity · At Risk
 * Two-column queues: At-Risk Tickets | Escalations
 * Bottom row: Overdue Tasks | Recent Activity
 */
import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ticket, Task } from '@/api/firestoreClient';
import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import PageHeader from '@/components/layout/PageHeader';
import { KpiTile, QueueCard, CalloutBanner } from '@/components/dashboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertOctagon, ArrowUpCircle, Clock, CheckCircle2,
  ClipboardList, ChevronRight, Circle, Flame,
  AlertTriangle, RotateCcw, Timer, TrendingUp,
  BarChart3, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, isPast, differenceInHours, isAfter, subDays } from 'date-fns';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const SLA_TIERS = { Standard: 72, Priority: 24, Emergency: 4 };

function slaStatus(ticket) {
  if (!ticket.sla_due_at) return null;
  const due = new Date(ticket.sla_due_at);
  if (isPast(due)) return 'breached';
  const hrs = differenceInHours(due, new Date());
  return hrs <= (SLA_TIERS[ticket.sla_tier] || 72) * 0.25 ? 'at_risk' : 'ok';
}

const SEVERITY_WEIGHT = { Low: 1, Medium: 2, High: 3, Critical: 4 };

const SEVERITY_CFG = {
  Low:      { cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: Circle },
  Medium:   { cls: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300 border border-yellow-200', icon: AlertTriangle },
  High:     { cls: 'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200', icon: Flame },
  Critical: { cls: 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200', icon: AlertOctagon },
};

function SevBadge({ severity }) {
  const cfg = SEVERITY_CFG[severity] || SEVERITY_CFG.Medium;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', cfg.cls)}>
      <Icon className="h-3 w-3" />{severity}
    </span>
  );
}

// KpiTile, QueueCard, CalloutBanner now live in @/components/dashboard and are
// imported above so every dashboard page shares them.

// ─── Queue Row ────────────────────────────────────────────────────────────────

function TicketQueueRow({ ticket, index }) {
  const navigate = useNavigate();
  const due = ticket.sla_due_at ? new Date(ticket.sla_due_at) : null;
  const slaSt = slaStatus(ticket);
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors last:border-0',
        slaSt === 'breached' && 'bg-red-50/50 dark:bg-red-950/10',
      )}
      onClick={() => navigate(`/tickets/${ticket.id}`)}
    >
      <span className="text-xs font-mono text-muted-foreground w-10 shrink-0">
        T-{String(index + 1).padStart(3,'0')}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{ticket.title}</p>
        {ticket.client_name && (
          <p className="text-xs text-muted-foreground">{ticket.client_name}</p>
        )}
      </div>
      <SevBadge severity={ticket.severity} />
      {due && (
        <span className={cn('text-xs shrink-0', slaSt === 'breached' ? 'text-red-600 font-medium' : 'text-orange-600')}>
          {isPast(due) ? 'Breached' : formatDistanceToNow(due, { addSuffix: true })}
        </span>
      )}
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </div>
  );
}

function TaskQueueRow({ task }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{task.title}</p>
        <p className="text-xs text-muted-foreground">
          {task.assignee_name || 'Unassigned'}
          {task.due_date ? ` · due ${formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}` : ''}
        </p>
      </div>
      <span className={cn(
        'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
        task.priority === 'Urgent' ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400' :
        task.priority === 'High'   ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400' :
                                     'bg-muted text-muted-foreground'
      )}>
        {task.priority}
      </span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CommandCenter() {
  const { currentOrg } = useWorkspace();
  const navigate = useNavigate();

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets', currentOrg?.id],
    queryFn: () => Ticket.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', currentOrg?.id],
    queryFn: () => Task.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id,
  });

  const stats = useMemo(() => {
    const openTickets   = tickets.filter(t => !['Resolved','Closed'].includes(t.status));
    const breached      = tickets.filter(t => slaStatus(t) === 'breached');
    const escalated     = tickets.filter(t => t.escalated);
    const atRisk        = tickets.filter(t => slaStatus(t) === 'at_risk');

    // Avg severity score among open tickets
    const sevScores = openTickets.map(t => SEVERITY_WEIGHT[t.severity] || 2);
    const avgSev = sevScores.length
      ? (sevScores.reduce((a, b) => a + b, 0) / sevScores.length).toFixed(1)
      : '—';

    // Overdue tasks = status !== Done and due_date < today
    const overdueTasks = tasks.filter(t =>
      t.status !== 'Done' && t.due_date && isPast(new Date(t.due_date))
    );

    // Recent activity: last 7 days of tickets
    const since7d = subDays(new Date(), 7);
    const recentActivity = [...tickets]
      .filter(t => t.activity?.length)
      .flatMap(t => (t.activity || []).map(a => ({ ...a, ticketId: t.id, ticketTitle: t.title })))
      .filter(a => a.at && isAfter(new Date(a.at), since7d))
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 12);

    return { openTickets, breached, escalated, atRisk, overdueTasks, avgSev, recentActivity };
  }, [tickets, tasks]);

  // Critical banners
  const showBreachedBanner  = stats.breached.length > 0;
  const showEscalatedBanner = stats.escalated.length > 0 && !showBreachedBanner;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader icon="🖥️" title="Command Center" />

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

        {/* Alert banners */}
        {showBreachedBanner && (
          <CalloutBanner
            variant="danger"
            icon={AlertOctagon}
            title={`${stats.breached.length} ticket${stats.breached.length > 1 ? 's' : ''} have breached SLA`}
            body="Immediate action required. Click Tickets → Breached to review."
          />
        )}
        {showEscalatedBanner && (
          <CalloutBanner
            variant="warning"
            icon={ArrowUpCircle}
            title={`${stats.escalated.length} escalated ticket${stats.escalated.length > 1 ? 's' : ''} need attention`}
            body="Review escalations and update resolution plans."
          />
        )}

        {/* KPI tiles */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Overview</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiTile
              label="Open Tickets"
              value={stats.openTickets.length}
              icon={Circle}
              href="/tickets?view=open"
            />
            <KpiTile
              label="Breached SLA"
              value={stats.breached.length}
              icon={AlertOctagon}
              variant={stats.breached.length > 0 ? 'danger' : 'default'}
              href="/tickets?view=breached"
            />
            <KpiTile
              label="Escalated"
              value={stats.escalated.length}
              icon={ArrowUpCircle}
              variant={stats.escalated.length > 0 ? 'warning' : 'default'}
              href="/tickets?view=escalated"
            />
            <KpiTile
              label="Overdue Tasks"
              value={stats.overdueTasks.length}
              icon={ClipboardList}
              variant={stats.overdueTasks.length > 0 ? 'warning' : 'default'}
              href="/tasks"
            />
            <KpiTile
              label="At Risk"
              value={stats.atRisk.length}
              icon={Flame}
              variant={stats.atRisk.length > 0 ? 'warning' : 'default'}
              href="/tickets?view=at_risk"
            />
            <KpiTile
              label="Avg Severity"
              value={stats.avgSev}
              icon={BarChart3}
              variant="default"
            />
          </div>
        </div>

        <Separator />

        {/* Two-column queues */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Live Queues</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* At-Risk Tickets */}
            <QueueCard
              title="At Risk / Breached"
              icon={Clock}
              iconCls="text-orange-600"
              count={stats.atRisk.length + stats.breached.length}
              empty="No tickets at risk right now"
              viewHref="/tickets"
            >
              {[...stats.breached, ...stats.atRisk].slice(0, 8).map((t, i) => (
                <TicketQueueRow key={t.id} ticket={t} index={i} />
              ))}
            </QueueCard>

            {/* Escalations */}
            <QueueCard
              title="Escalations"
              icon={ArrowUpCircle}
              iconCls="text-red-600"
              count={stats.escalated.length}
              empty="No active escalations"
              viewHref="/tickets"
            >
              {stats.escalated.slice(0, 8).map((t, i) => (
                <TicketQueueRow key={t.id} ticket={t} index={i} />
              ))}
            </QueueCard>
          </div>
        </div>

        <Separator />

        {/* Bottom row */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Secondary Queues</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Overdue Tasks */}
            <QueueCard
              title="Overdue Tasks"
              icon={ClipboardList}
              iconCls="text-yellow-600"
              count={stats.overdueTasks.length}
              empty="No overdue tasks"
              viewHref="/tasks"
            >
              {stats.overdueTasks.slice(0, 8).map((task) => (
                <TaskQueueRow key={task.id} task={task} />
              ))}
            </QueueCard>

            {/* Recent Activity (last 7 days) */}
            <QueueCard
              title="Activity · Last 7 Days"
              icon={Activity}
              iconCls="text-blue-600"
              count={stats.recentActivity.length}
              empty="No activity in the last 7 days"
            >
              {stats.recentActivity.map((entry, i) => {
                const typeIcon = {
                  escalated: <ArrowUpCircle className="h-3 w-3 text-red-500" />,
                  status:    <RotateCcw className="h-3 w-3 text-violet-500" />,
                  created:   <Circle className="h-3 w-3 text-blue-500" />,
                  note:      <Timer className="h-3 w-3 text-muted-foreground" />,
                }[entry.type] || <Timer className="h-3 w-3 text-muted-foreground" />;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer last:border-0"
                    onClick={() => navigate(`/tickets/${entry.ticketId}`)}
                  >
                    <div className="mt-0.5 shrink-0">{typeIcon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground truncate">{entry.ticketTitle}</p>
                      <p className="text-sm truncate">{entry.note}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {entry.at ? formatDistanceToNow(new Date(entry.at), { addSuffix: true }) : ''}
                    </span>
                  </div>
                );
              })}
            </QueueCard>
          </div>
        </div>

      </div>
    </div>
  );
}
