/**
 * TicketDetail.jsx — Full-page ticket detail (Linear-style)
 * Tabs: Overview · Activity · Linked Tasks · Linked SOPs
 * Header: escalation banner, severity + status badges, quick-action buttons
 */
import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Ticket, Task, Page } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePresence } from '@/hooks/usePresence';
import { PresenceAvatars } from '@/components/PresenceAvatars';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, ArrowUpCircle, CheckCircle2, Clock, User,
  AlertOctagon, Flame, AlertTriangle, Circle, Timer,
  RotateCcw, ExternalLink, Link2, FileText, Plus,
  MessageSquare, Activity, ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isPast, differenceInHours } from 'date-fns';
import { toast } from 'sonner';

// ── constants (same as Tickets.jsx) ──────────────────────────────────────────

const SEVERITY_CONFIG = {
  Low:      { cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: Circle },
  Medium:   { cls: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300 border border-yellow-200', icon: AlertTriangle },
  High:     { cls: 'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200', icon: Flame },
  Critical: { cls: 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200', icon: AlertOctagon },
};

const STATUS_OPTIONS = ['Open','In Progress','Waiting on Client','Resolved','Closed'];
const STATUS_CONFIG = {
  'Open':              { cls: 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300', icon: Circle },
  'In Progress':       { cls: 'bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300', icon: RotateCcw },
  'Waiting on Client': { cls: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300', icon: Timer },
  'Resolved':          { cls: 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300', icon: CheckCircle2 },
  'Closed':            { cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: CheckCircle2 },
};
const SLA_TIERS = { Standard: 72, Priority: 24, Emergency: 4 };

function slaStatus(ticket) {
  if (!ticket?.sla_due_at) return null;
  const due = new Date(ticket.sla_due_at);
  if (isPast(due)) return 'breached';
  const hrs = differenceInHours(due, new Date());
  const tier = SLA_TIERS[ticket.sla_tier] || 72;
  return hrs <= tier * 0.25 ? 'at_risk' : 'ok';
}

// ── sub-components ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.Medium;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', cfg.cls)}>
      <Icon className="h-3 w-3" />{severity}
    </span>
  );
}

function StatusSelect({ ticket, onUpdate }) {
  const cfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG['Open'];
  const Icon = cfg.icon;
  return (
    <Select value={ticket.status} onValueChange={(v) => onUpdate({ status: v })}>
      <SelectTrigger className={cn('h-7 text-xs font-medium border-0 shadow-none gap-1 w-auto px-2 rounded-full', cfg.cls)}>
        <Icon className="h-3 w-3" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function EscalationBanner({ ticket, onEscalate, onDeescalate }) {
  if (!ticket.escalated) return null;
  return (
    <div className="flex items-center gap-3 px-6 py-2.5 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-800 text-red-800 dark:text-red-300">
      <ArrowUpCircle className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium">
        Escalated{ticket.escalated_to_name ? ` to ${ticket.escalated_to_name}` : ''}{ticket.escalated_at ? ` · ${formatDistanceToNow(new Date(ticket.escalated_at), { addSuffix: true })}` : ''}
      </span>
      {ticket.escalation_reason && (
        <span className="text-xs text-red-700/80 dark:text-red-400 ml-1">— {ticket.escalation_reason}</span>
      )}
      <button onClick={onDeescalate} className="ml-auto text-xs underline underline-offset-2 opacity-70 hover:opacity-100">
        De-escalate
      </button>
    </div>
  );
}

function SlaBlock({ ticket }) {
  if (!ticket.sla_due_at) return null;
  const due = new Date(ticket.sla_due_at);
  const status = slaStatus(ticket);
  return (
    <div className={cn(
      'rounded-lg p-3 text-sm',
      status === 'breached' ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800' :
      status === 'at_risk'  ? 'bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800' :
                              'bg-muted/50 border border-border'
    )}>
      <div className="flex items-center gap-2 font-medium">
        <Clock className={cn('h-4 w-4',
          status === 'breached' ? 'text-red-600' :
          status === 'at_risk'  ? 'text-orange-600' : 'text-muted-foreground'
        )} />
        <span className={status === 'breached' ? 'text-red-700 dark:text-red-400' : status === 'at_risk' ? 'text-orange-700 dark:text-orange-400' : ''}>
          {status === 'breached' ? 'SLA Breached' : status === 'at_risk' ? 'SLA At Risk' : 'SLA On Track'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Due: {format(due, 'MMM d, yyyy HH:mm')} · {formatDistanceToNow(due, { addSuffix: true })}
      </p>
      <p className="text-xs text-muted-foreground">Tier: {ticket.sla_tier}</p>
    </div>
  );
}

function ActivityLog({ activity = [] }) {
  const icons = {
    created:   <Circle className="h-3 w-3 text-blue-500" />,
    escalated: <ArrowUpCircle className="h-3 w-3 text-red-500" />,
    status:    <RotateCcw className="h-3 w-3 text-violet-500" />,
    note:      <MessageSquare className="h-3 w-3 text-muted-foreground" />,
    assigned:  <User className="h-3 w-3 text-green-500" />,
  };
  const sorted = [...activity].sort((a, b) => new Date(b.at) - new Date(a.at));
  return (
    <div className="space-y-3">
      {sorted.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">No activity yet</p>
      )}
      {sorted.map((entry, i) => (
        <div key={i} className="flex gap-3 text-sm">
          <div className="mt-0.5 shrink-0">{icons[entry.type] || icons.note}</div>
          <div>
            <span className="font-medium">{entry.user}</span>
            <span className="text-muted-foreground ml-1">— {entry.note}</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              {entry.at ? formatDistanceToNow(new Date(entry.at), { addSuffix: true }) : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Escalate modal ────────────────────────────────────────────────────────────

function EscalateModal({ open, onClose, ticket, members, onConfirm }) {
  const [to, setTo]     = useState('');
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Escalate Ticket</DialogTitle><DialogDescription className="sr-only">Escalate this ticket to another team member.</DialogDescription></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Escalate to</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select team member" /></SelectTrigger>
              <SelectContent>
                {members.map(m => <SelectItem key={m.email} value={m.email}>{m.full_name || m.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea className="mt-1.5 resize-none" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this being escalated?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={!to} onClick={() => onConfirm(to, reason, members)}>Escalate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TicketDetail() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { currentOrg, user } = useWorkspace();
  const queryClient = useQueryClient();
  const members = currentOrg?.members || [];
  const { viewers } = usePresence('ticket', ticketId);

  const [showEscalate, setShowEscalate] = useState(false);
  const [noteText, setNoteText]         = useState('');

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => Ticket.get(ticketId),
    enabled: !!ticketId,
  });

  const { data: linkedTasks = [] } = useQuery({
    queryKey: ['linked-tasks', ticketId],
    queryFn: async () => {
      if (!ticket?.linked_tasks?.length) return [];
      return Promise.all(ticket.linked_tasks.map(id => Task.get(id)));
    },
    enabled: !!ticket?.linked_tasks?.length,
  });

  const { data: linkedPage } = useQuery({
    queryKey: ['linked-page', ticket?.linked_page_id],
    queryFn: () => Page.get(ticket.linked_page_id),
    enabled: !!ticket?.linked_page_id,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => Ticket.update(ticketId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets', currentOrg?.id] });
    },
  });

  const update = useCallback((data) => {
    updateMutation.mutate({
      ...data,
      activity: [
        ...(ticket?.activity || []),
        { type: data.status ? 'status' : 'note', user: user?.full_name || user?.email, at: new Date().toISOString(), note: data._note || `Status changed to ${data.status}` },
      ],
    });
  }, [ticket, user]);

  const handleEscalate = (toEmail, reason, members) => {
    const m = members.find(x => x.email === toEmail);
    updateMutation.mutate({
      escalated: true,
      escalated_at: new Date().toISOString(),
      escalated_to: toEmail,
      escalated_to_name: m?.full_name || toEmail,
      escalation_reason: reason,
      severity: ticket.severity === 'Critical' ? 'Critical' : 'High',
      activity: [...(ticket?.activity || []), {
        type: 'escalated', user: user?.full_name || user?.email,
        at: new Date().toISOString(),
        note: `Escalated to ${m?.full_name || toEmail}${reason ? ': ' + reason : ''}`,
      }],
    });
    setShowEscalate(false);
    toast.warning('Ticket escalated');
  };

  const handleDeescalate = () => {
    updateMutation.mutate({
      escalated: false,
      escalated_to: null,
      escalated_to_name: null,
      escalation_reason: null,
      activity: [...(ticket?.activity || []), {
        type: 'note', user: user?.full_name || user?.email,
        at: new Date().toISOString(), note: 'Ticket de-escalated',
      }],
    });
    toast.success('Ticket de-escalated');
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    updateMutation.mutate({
      activity: [...(ticket?.activity || []), {
        type: 'note', user: user?.full_name || user?.email,
        at: new Date().toISOString(), note: noteText.trim(),
      }],
    });
    setNoteText('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-muted-foreground">Ticket not found</p>
        <Button variant="outline" onClick={() => navigate('/tickets')}>Back to Tickets</Button>
      </div>
    );
  }

  const slaSt = slaStatus(ticket);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-2 border-b border-border shrink-0 bg-background">
        <button
          onClick={() => navigate('/tickets')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Tickets
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-mono text-muted-foreground">T-{ticketId.slice(-3).toUpperCase()}</span>
        <div className="ml-auto flex items-center gap-2">
          <PresenceAvatars viewers={viewers} />
          <StatusSelect ticket={ticket} onUpdate={update} />
          {!ticket.escalated && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400" onClick={() => setShowEscalate(true)}>
              <ArrowUpCircle className="h-3.5 w-3.5" /> Escalate
            </Button>
          )}
          {(ticket.status !== 'Resolved' && ticket.status !== 'Closed') && (
            <Button size="sm" className="gap-1.5 text-xs h-7" onClick={() => update({ status: 'Resolved', _note: 'Ticket resolved' })}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
            </Button>
          )}
        </div>
      </div>

      {/* Escalation banner */}
      <EscalationBanner ticket={ticket} onEscalate={() => setShowEscalate(true)} onDeescalate={handleDeescalate} />

      {/* Body: 2-col */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Title + badges */}
          <div className="mb-1 flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={ticket.severity} />
            {slaSt === 'breached' && (
              <span className="text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full">SLA Breached</span>
            )}
            {slaSt === 'at_risk' && (
              <span className="text-xs font-medium text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 px-2 py-0.5 rounded-full">At Risk</span>
            )}
          </div>
          <h1 className="text-2xl font-bold mb-4">{ticket.title}</h1>

          <Tabs defaultValue="overview">
            <TabsList className="mb-4">
              <TabsTrigger value="overview" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Overview</TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5"><Activity className="h-3.5 w-3.5" />Activity</TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" />Linked Tasks</TabsTrigger>
              <TabsTrigger value="sops" className="gap-1.5"><Link2 className="h-3.5 w-3.5" />Linked SOPs</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
                <p className="mt-1.5 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {ticket.description || <span className="text-muted-foreground/50 italic">No description provided</span>}
                </p>
              </div>
              {ticket.client_name && (
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client</Label>
                  <p className="mt-1 text-sm font-medium">{ticket.client_name}</p>
                </div>
              )}
              {ticket.tags?.length > 0 && (
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tags</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {ticket.tags.map(tag => (
                      <span key={tag} className="text-xs bg-muted px-2 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              <Separator />
              {/* Add note */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Add Note</Label>
                <div className="flex gap-2">
                  <Input
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Log a note or update…"
                    className="text-sm"
                    onKeyDown={e => e.key === 'Enter' && addNote()}
                  />
                  <Button size="sm" variant="outline" onClick={addNote} disabled={!noteText.trim()}>Add</Button>
                </div>
              </div>
            </TabsContent>

            {/* Activity */}
            <TabsContent value="activity">
              <ActivityLog activity={ticket.activity} />
            </TabsContent>

            {/* Linked Tasks */}
            <TabsContent value="tasks">
              {linkedTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No linked tasks</p>
              ) : (
                <div className="space-y-2">
                  {linkedTasks.filter(Boolean).map(task => (
                    <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <CheckCircle2 className={cn('h-4 w-4 shrink-0', task.status === 'Done' ? 'text-green-500' : 'text-muted-foreground/40')} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">{task.status} · {task.assignee_name || 'Unassigned'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Linked SOPs */}
            <TabsContent value="sops">
              {linkedPage ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                  <span className="text-xl">{linkedPage.icon || '📄'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{linkedPage.title || 'Untitled'}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/page/${linkedPage.id}`)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No linked SOPs or pages</p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right sidebar */}
        <div className="w-64 shrink-0 border-l border-border overflow-y-auto px-4 py-6 space-y-5">
          {/* Assignee */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Assignee</Label>
            <Select
              value={ticket.assigned_to || ''}
              onValueChange={(v) => {
                const m = members.find(x => x.email === v);
                update({ assigned_to: v, assigned_to_name: m?.full_name || v, _note: `Assigned to ${m?.full_name || v}` });
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                {members.map(m => <SelectItem key={m.email} value={m.email}>{m.full_name || m.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Severity</Label>
            <Select value={ticket.severity} onValueChange={v => update({ severity: v, _note: `Severity set to ${v}` })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Low','Medium','High','Critical'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* SLA */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">SLA</Label>
            <SlaBlock ticket={ticket} />
          </div>

          {/* Client */}
          {ticket.client_name && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Client</Label>
              <p className="text-sm font-medium">{ticket.client_name}</p>
            </div>
          )}

          {/* Created */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Created by</Label>
            <p className="text-sm">{ticket.created_by_name || ticket.created_by_email || '—'}</p>
            {ticket.created_at && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(ticket.created_at?.toDate ? ticket.created_at.toDate() : new Date(ticket.created_at), 'MMM d, yyyy')}
              </p>
            )}
          </div>
        </div>
      </div>

      <EscalateModal
        open={showEscalate}
        onClose={() => setShowEscalate(false)}
        ticket={ticket}
        members={members}
        onConfirm={handleEscalate}
      />
    </div>
  );
}
