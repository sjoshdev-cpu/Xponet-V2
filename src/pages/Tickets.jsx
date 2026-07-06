/**
 * Tickets.jsx — Linear-style ticket list for BPO ops.
 * Views: All · Open · In Progress · Waiting on Client · Escalated · At Risk · Breached · Resolved
 * Keyboard: n → new ticket, / → search, Escape → close modal
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Search, AlertTriangle, Clock, ArrowUpCircle,
  CheckCircle2, Circle, Timer, User, ChevronRight,
  Flame, AlertOctagon, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, isPast, differenceInHours } from 'date-fns';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

const VIEWS = [
  { id: 'all',       label: 'All' },
  { id: 'open',      label: 'Open' },
  { id: 'progress',  label: 'In Progress' },
  { id: 'waiting',   label: 'Waiting on Client' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'at_risk',   label: 'At Risk' },
  { id: 'breached',  label: 'Breached' },
  { id: 'resolved',  label: 'Resolved' },
];

const SEVERITY_CONFIG = {
  Low:      { cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: Circle },
  Medium:   { cls: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800', icon: AlertTriangle },
  High:     { cls: 'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800', icon: Flame },
  Critical: { cls: 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800', icon: AlertOctagon },
};

const STATUS_CONFIG = {
  'Open':              { cls: 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300', icon: Circle },
  'In Progress':       { cls: 'bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300', icon: RotateCcw },
  'Waiting on Client': { cls: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300', icon: Timer },
  'Resolved':          { cls: 'bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300', icon: CheckCircle2 },
  'Closed':            { cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: CheckCircle2 },
};

const SLA_TIERS = { Standard: 72, Priority: 24, Emergency: 4 }; // hours

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slaStatus(ticket) {
  if (!ticket.sla_due_at) return null;
  const due = new Date(ticket.sla_due_at);
  if (isPast(due)) return 'breached';
  const hrs = differenceInHours(due, new Date());
  const tier = SLA_TIERS[ticket.sla_tier] || 72;
  if (hrs <= tier * 0.25) return 'at_risk';
  return 'ok';
}

function SlaTimer({ ticket }) {
  if (!ticket.sla_due_at) return null;
  const due = new Date(ticket.sla_due_at);
  const status = slaStatus(ticket);
  const label = isPast(due)
    ? `Breached ${formatDistanceToNow(due, { addSuffix: true })}`
    : `Due ${formatDistanceToNow(due, { addSuffix: true })}`;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded',
      status === 'breached' ? 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/30' :
      status === 'at_risk'  ? 'text-orange-700 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/30' :
                              'text-muted-foreground'
    )}>
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}

function SeverityBadge({ severity }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.Medium;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', cfg.cls)}>
      <Icon className="h-3 w-3" />
      {severity}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['Open'];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', cfg.cls)}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}

// ─── New Ticket Modal ─────────────────────────────────────────────────────────

function NewTicketModal({ open, onClose, orgId, members = [], user }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '', description: '', severity: 'Medium', sla_tier: 'Standard',
    assigned_to: '', assigned_to_name: '', client_name: '',
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const slaHours = SLA_TIERS[form.sla_tier] || 72;
      const sla_due_at = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();
      return Ticket.create({
        ...form,
        status: 'Open',
        escalated: false,
        org_id: orgId,
        created_by_email: user?.email,
        created_by_name: user?.full_name || user?.email,
        sla_due_at,
        activity: [{
          type: 'created', user: user?.full_name || user?.email,
          at: new Date().toISOString(), note: 'Ticket created',
        }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', orgId] });
      toast.success('Ticket created');
      onClose();
      setForm({ title: '', description: '', severity: 'Medium', sla_tier: 'Standard', assigned_to: '', assigned_to_name: '', client_name: '' });
    },
    onError: () => toast.error('Failed to create ticket — please try again'),
  });

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Ticket</DialogTitle>
          <DialogDescription className="sr-only">Fill in the details to create a new support ticket.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Title *</Label>
            <Input
              autoFocus
              className="mt-1.5"
              value={form.title}
              onChange={(e) => set('title')(e.target.value)}
              placeholder="Describe the issue…"
              onKeyDown={(e) => e.key === 'Enter' && form.title && createMutation.mutate()}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              className="mt-1.5 resize-none"
              rows={3}
              value={form.description}
              onChange={(e) => set('description')(e.target.value)}
              placeholder="Steps to reproduce, impact, context…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={set('severity')}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Low','Medium','High','Critical'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>SLA Tier</Label>
              <Select value={form.sla_tier} onValueChange={set('sla_tier')}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard">Standard (72 h)</SelectItem>
                  <SelectItem value="Priority">Priority (24 h)</SelectItem>
                  <SelectItem value="Emergency">Emergency (4 h)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Assign to</Label>
              <Select
                value={form.assigned_to}
                onValueChange={(v) => {
                  const m = members.find((x) => x.email === v);
                  setForm((f) => ({ ...f, assigned_to: v, assigned_to_name: m?.full_name || v }));
                }}
              >
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.email} value={m.email}>{m.full_name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Input
                className="mt-1.5"
                value={form.client_name}
                onChange={(e) => set('client_name')(e.target.value)}
                placeholder="Client / account name"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!form.title.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Ticket Row ───────────────────────────────────────────────────────────────

function TicketRow({ ticket, index }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => Ticket.update(ticket.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
    onError: () => toast.error('Failed to update ticket'),
  });

  const escalate = (e) => {
    e.stopPropagation();
    updateMutation.mutate({
      escalated: true,
      escalated_at: new Date().toISOString(),
      severity: ticket.severity === 'Critical' ? 'Critical' : 'High',
      activity: [...(ticket.activity || []), {
        type: 'escalated', user: 'System', at: new Date().toISOString(), note: 'Ticket escalated',
      }],
    });
    toast.warning('Ticket escalated');
  };

  const slaSt = slaStatus(ticket);

  return (
    <tr
      className={cn(
        'group border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors',
        slaSt === 'breached' && 'bg-red-50/50 dark:bg-red-950/10',
        slaSt === 'at_risk'  && 'bg-orange-50/40 dark:bg-orange-950/10',
      )}
      onClick={() => navigate(`/tickets/${ticket.id}`)}
    >
      <td className="py-2.5 pl-4 pr-2 w-[80px]">
        <span className="text-xs font-mono text-muted-foreground">T-{String(index + 1).padStart(3, '0')}</span>
      </td>
      <td className="py-2.5 pr-4 min-w-0">
        <div className="flex items-center gap-2">
          {ticket.escalated && (
            <ArrowUpCircle className="h-3.5 w-3.5 text-red-500 shrink-0" title="Escalated" />
          )}
          <span className="font-medium text-sm truncate">{ticket.title}</span>
          {ticket.client_name && (
            <span className="text-xs text-muted-foreground shrink-0">· {ticket.client_name}</span>
          )}
        </div>
      </td>
      <td className="py-2.5 pr-4 w-[120px]"><SeverityBadge severity={ticket.severity} /></td>
      <td className="py-2.5 pr-4 w-[160px]"><StatusBadge status={ticket.status} /></td>
      <td className="py-2.5 pr-4 w-[190px]"><SlaTimer ticket={ticket} /></td>
      <td className="py-2.5 pr-4 w-[140px]">
        {ticket.assigned_to_name ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />{ticket.assigned_to_name}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
      </td>
      <td className="py-2.5 pr-4 w-[80px]" onClick={(e) => e.stopPropagation()}>
        <div className="hidden group-hover:flex gap-1">
          {!ticket.escalated && (
            <button
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-600 transition-colors"
              title="Escalate"
              onClick={escalate}
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
            title="Open detail"
            onClick={() => navigate(`/tickets/${ticket.id}`)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Tickets() {
  const { currentOrg, user } = useWorkspace();
  const [activeView, setActiveView] = useState('all');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);

  // Keyboard shortcut: n → new, / → focus search
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'n') { e.preventDefault(); setShowNew(true); }
      if (e.key === '/') { e.preventDefault(); document.getElementById('ticket-search')?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', currentOrg?.id],
    queryFn: () => Ticket.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id,
  });

  const filtered = useMemo(() => {
    let list = tickets;

    // View filter
    if (activeView === 'open')      list = list.filter(t => t.status === 'Open');
    else if (activeView === 'progress') list = list.filter(t => t.status === 'In Progress');
    else if (activeView === 'waiting')  list = list.filter(t => t.status === 'Waiting on Client');
    else if (activeView === 'escalated') list = list.filter(t => t.escalated);
    else if (activeView === 'at_risk')   list = list.filter(t => slaStatus(t) === 'at_risk');
    else if (activeView === 'breached')  list = list.filter(t => slaStatus(t) === 'breached');
    else if (activeView === 'resolved')  list = list.filter(t => t.status === 'Resolved' || t.status === 'Closed');

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.client_name?.toLowerCase().includes(q) ||
        t.assigned_to_name?.toLowerCase().includes(q)
      );
    }

    // Sort: escalated + breached first, then by created_at desc
    return [...list].sort((a, b) => {
      const aWeight = (a.escalated ? 2 : 0) + (slaStatus(a) === 'breached' ? 1 : 0);
      const bWeight = (b.escalated ? 2 : 0) + (slaStatus(b) === 'breached' ? 1 : 0);
      if (bWeight !== aWeight) return bWeight - aWeight;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [tickets, activeView, search]);

  const counts = useMemo(() => ({
    escalated: tickets.filter(t => t.escalated).length,
    breached:  tickets.filter(t => slaStatus(t) === 'breached').length,
    at_risk:   tickets.filter(t => slaStatus(t) === 'at_risk').length,
  }), [tickets]);

  const members = currentOrg?.members || [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        icon="🎫"
        title="Tickets"
        badge={
          counts.breached > 0 ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full">
              <AlertOctagon className="h-3 w-3" />{counts.breached} breached
            </span>
          ) : counts.escalated > 0 ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 px-2 py-0.5 rounded-full">
              <ArrowUpCircle className="h-3 w-3" />{counts.escalated} escalated
            </span>
          ) : null
        }
        actions={
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Ticket
          </Button>
        }
      />

      {/* View tabs + search */}
      <div className="flex items-center gap-0 border-b border-border bg-background px-6 shrink-0 overflow-x-auto">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={cn(
              'relative px-3 py-2.5 text-sm whitespace-nowrap transition-colors',
              activeView === v.id
                ? 'text-foreground font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {v.label}
            {v.id === 'escalated' && counts.escalated > 0 && (
              <span className="ml-1.5 text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 font-bold px-1 py-0.5 rounded">
                {counts.escalated}
              </span>
            )}
            {v.id === 'breached' && counts.breached > 0 && (
              <span className="ml-1.5 text-[10px] bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-bold px-1 py-0.5 rounded">
                {counts.breached}
              </span>
            )}
            {v.id === 'at_risk' && counts.at_risk > 0 && (
              <span className="ml-1.5 text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 font-bold px-1 py-0.5 rounded">
                {counts.at_risk}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto pl-4 py-1.5 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              id="ticket-search"
              className="pl-8 h-8 w-48 text-sm"
              placeholder="Search… (/)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No tickets here</p>
            <Button size="sm" variant="outline" onClick={() => setShowNew(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New Ticket
            </Button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-background border-b border-border">
              <tr className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="py-2 pl-4 pr-2 w-[80px]">#</th>
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4 w-[120px]">Severity</th>
                <th className="py-2 pr-4 w-[160px]">Status</th>
                <th className="py-2 pr-4 w-[190px]">SLA</th>
                <th className="py-2 pr-4 w-[140px]">Assignee</th>
                <th className="py-2 pr-4 w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <TicketRow key={t.id} ticket={t} index={i} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <NewTicketModal
        open={showNew}
        onClose={() => setShowNew(false)}
        orgId={currentOrg?.id}
        members={members}
        user={user}
      />
    </div>
  );
}
