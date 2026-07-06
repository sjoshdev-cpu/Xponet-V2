import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw, ExternalLink, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import {
  fetchAuditPage,
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
} from '@/lib/auditLog';

// ─── helpers ──────────────────────────────────────────────────────────────────

function MemberAvatar({ name }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary shrink-0">
      {initial}
    </span>
  );
}

const ACTION_COLORS = {
  'page.lock':                 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'page.unlock':               'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'page.delete':               'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'page.permissions_updated':  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'db.schema.property_add':    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'db.schema.property_edit':   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'db.schema.property_delete': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'member.invite':             'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'member.remove':             'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'member.role_change':        'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

function ActionBadge({ action }) {
  const label = AUDIT_ACTION_LABELS[action] ?? action;
  const color = ACTION_COLORS[action] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function EntityLink({ entityType, entityId, entityTitle }) {
  if (!entityId) return <span className="text-sm text-muted-foreground">{entityTitle || '—'}</span>;

  const href =
    entityType === 'page'     ? `/page/${entityId}` :
    entityType === 'database' ? `/database/${entityId}` :
    null;

  if (href) {
    return (
      <Link to={href} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        {entityTitle || entityId}
        <ExternalLink className="h-3 w-3" />
      </Link>
    );
  }
  return <span className="text-sm">{entityTitle || entityId}</span>;
}

function MetaDetail({ metadata, action }) {
  if (!metadata || Object.keys(metadata).length === 0) return null;

  // Render context-aware detail strings
  const parts = [];
  if (metadata.propertyName) parts.push(`"${metadata.propertyName}"`);
  if (metadata.propertyType) parts.push(`(${metadata.propertyType})`);
  if (metadata.renamedFrom)  parts.push(`← was "${metadata.renamedFrom}"`);
  if (metadata.targetEmail)  parts.push(metadata.targetEmail);
  if (metadata.fromRole && metadata.toRole) parts.push(`${metadata.fromRole} → ${metadata.toRole}`);
  if (metadata.permSummary)  parts.push(metadata.permSummary);

  if (parts.length === 0) return null;
  return <span className="text-xs text-muted-foreground ml-1">{parts.join(' ')}</span>;
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function AuditLogTab({ orgId }) {
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [pages, setPages]               = useState([]);       // array of event arrays
  const [cursors, setCursors]           = useState([null]);   // cursors[i] = cursor to fetch page i
  const [nextCursor, setNextCursor]     = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  // ── fetch helpers ──────────────────────────────────────────────────────────

  const doFetch = useCallback(async (cursor, append = false) => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const { events, nextCursor: next } = await fetchAuditPage(orgId, {
        actionFilter: (actionFilter && actionFilter !== 'all') ? actionFilter : undefined,
        dateFrom:     dateFrom ? new Date(dateFrom) : undefined,
        dateTo:       dateTo   ? new Date(dateTo)   : undefined,
        cursor,
      });
      setPages((prev) => append ? [...prev, events] : [events]);
      setNextCursor(next);
    } catch (err) {
      setError('Failed to load audit log. You may not have permission.');
      console.error('[AuditLog]', err);
    } finally {
      setLoading(false);
    }
  }, [orgId, actionFilter, dateFrom, dateTo]);

  // Initial load + on filter change
  const handleSearch = () => {
    setPages([]);
    setNextCursor(null);
    doFetch(null, false);
  };

  const handleLoadMore = () => {
    doFetch(nextCursor, true);
  };

  // Flatten all loaded pages
  const allEvents = pages.flat();
  const hasLoaded = pages.length > 0;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Audit Log
          </CardTitle>
          <CardDescription>
            Track who did what in your workspace. Admin-only view.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Filters ──────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Action type</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-8 w-52 text-xs">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {Object.entries(AUDIT_ACTION_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                className="h-8 text-xs w-36"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                className="h-8 text-xs w-36"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <Button size="sm" className="h-8" onClick={handleSearch} disabled={loading}>
              {loading && !hasLoaded
                ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Search
            </Button>
          </div>

          {/* ── Results ──────────────────────────────────────────────────── */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {!hasLoaded && !loading && !error && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Press Search to load the audit log.
            </p>
          )}

          {hasLoaded && allEvents.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No events match your filters.
            </p>
          )}

          {allEvents.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground w-36">When</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground w-36">Who</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Action</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {allEvents.map((ev, i) => (
                    <tr
                      key={ev.id}
                      className={`border-b border-border last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}
                    >
                      <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                        {ev.timestamp
                          ? <time dateTime={ev.timestamp.toISOString()} title={format(ev.timestamp, 'PPpp')}>
                              {format(ev.timestamp, 'MMM d, HH:mm')}
                            </time>
                          : '—'}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <MemberAvatar name={ev.actorName} />
                          <span className="text-xs truncate max-w-[120px]">{ev.actorName || ev.actorUid || '—'}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center flex-wrap gap-1">
                          <ActionBadge action={ev.action} />
                          <MetaDetail metadata={ev.metadata} action={ev.action} />
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <EntityLink
                          entityType={ev.entityType}
                          entityId={ev.entityId}
                          entityTitle={ev.entityTitle}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Load more ────────────────────────────────────────────────── */}
          {nextCursor && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loading}>
                {loading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Loading…</>
                  : 'Load more'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
