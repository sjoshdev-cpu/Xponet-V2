import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ChevronDown, ChevronRight, Plus, Loader2, Settings2, Check,
  Trash2, ArrowUpDown, ListFilter, Zap, Snowflake, Search,
  SlidersHorizontal, Star, Share2, MoreHorizontal, Play, X, BookOpen, ExternalLink,
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Database, DatabaseRecord, DatabaseView, Page } from '@/api/firestoreClient.js';
import { useWorkspace } from '@/contexts/WorkspaceContext.jsx';
import { cn } from '@/lib/utils';
import { seedDocumentHub, seedHubViews, seedHubRecords, deleteSampleData } from '@/api/seedDocumentHub.js';
import AddPropertyModal from '@/components/database/AddPropertyModal';
import ColumnHeaderDropdown from '@/components/database/ColumnHeaderDropdown';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_VISIBLE_COLUMNS = [
  'category',
  'created_by',
  'created_time',
  'last_edited_by',
  'last_edited_time',
];

const COLUMN_META = {
  title:            { label: 'Doc name',          className: 'min-w-[14rem] w-64' },
  category:         { label: 'Category',           className: 'min-w-[9rem]  w-36' },
  reviewers:        { label: 'Reviewers',          className: 'min-w-[8rem]  w-32' },
  created_time:     { label: 'Created time',       className: 'min-w-[10rem] w-40' },
  created_by:       { label: 'Created by',         className: 'min-w-[9rem]  w-36' },
  last_edited_time: { label: 'Last updated time',  className: 'min-w-[10rem] w-40' },
  last_edited_by:   { label: 'Last edited by',     className: 'min-w-[9rem]  w-36' },
};

// Per spec: strategy doc=amber, proposal=blue, customer research=purple
const CATEGORY_COLORS = {
  'strategy doc':      'bg-amber-100  text-amber-700  dark:bg-amber-950/50  dark:text-amber-300',
  'proposal':          'bg-blue-100   text-blue-700   dark:bg-blue-950/50   dark:text-blue-300',
  'customer research': 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
};

const TOGGLEABLE_PROPS = [
  { key: 'created_time',     label: 'Created time' },
  { key: 'category',         label: 'Category' },
  { key: 'last_edited_by',   label: 'Last edited by' },
  { key: 'last_edited_time', label: 'Last updated time' },
  { key: 'reviewers',        label: 'Reviewers' },
];

// Columns that cannot be deleted (only hidden) — they are structural to the hub
const NON_DELETABLE_COLS = new Set([
  'title', 'category', 'reviewers',
  'created_time', 'created_by', 'last_edited_time', 'last_edited_by',
]);

// Resolve display label for a column key (falls back through schema name/label → key)
function getSchemaLabel(key, schema) {
  const field = schema?.find((f) => f.key === key);
  return field?.label ?? field?.name ?? key;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRecordValue(record, key) {
  switch (key) {
    case 'created_time':     return record.created_at;
    case 'last_edited_time': return record.updated_at;
    case 'created_by':       return record.created_by_email;
    case 'last_edited_by':   return record.last_edited_by_email;
    default:                 return record.properties?.[key];
  }
}

function applyHubFilters(records, filters, currentUserEmail) {
  if (!filters?.length) return records;
  return records.filter((record) =>
    filters.every((f) => {
      const resolvedValue = f.propertyKey === 'created_by' ? currentUserEmail : f.value;
      const val = getRecordValue(record, f.propertyKey);
      switch (f.op) {
        case 'eq':           return String(val ?? '').toLowerCase() === String(resolvedValue ?? '').toLowerCase();
        case 'neq':          return String(val ?? '').toLowerCase() !== String(resolvedValue ?? '').toLowerCase();
        case 'contains':     return String(val ?? '').toLowerCase().includes(String(resolvedValue ?? '').toLowerCase());
        case 'not_contains': return !String(val ?? '').toLowerCase().includes(String(resolvedValue ?? '').toLowerCase());
        case 'is_empty':     return !val || val === '' || (Array.isArray(val) && val.length === 0);
        case 'is_not_empty': return !!val && val !== '' && !(Array.isArray(val) && val.length === 0);
        default:             return true;
      }
    })
  );
}

function applyHubSorts(records, sorts) {
  if (!sorts?.length) return records;
  return [...records].sort((a, b) => {
    for (const s of sorts) {
      const va = getRecordValue(a, s.propertyKey);
      const vb = getRecordValue(b, s.propertyKey);
      let cmp;
      if (va instanceof Date && vb instanceof Date) {
        cmp = va.getTime() - vb.getTime();
      } else if (va == null && vb == null) {
        cmp = 0;
      } else if (va == null) {
        cmp = 1;
      } else if (vb == null) {
        cmp = -1;
      } else {
        cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      }
      if (cmp !== 0) return s.direction === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

// ─── Shared mutation helper ───────────────────────────────────────────────────

export async function updateRecordProperty(recordId, patch, currentUser) {
  const dotPatch = Object.fromEntries(
    Object.entries(patch).map(([k, v]) => [`properties.${k}`, v])
  );
  await DatabaseRecord.update(recordId, {
    ...dotPatch,
    last_edited_by_email: currentUser?.email ?? '',
    last_edited_by_name:  currentUser?.full_name ?? '',
  });
}

// ─── PropertyCell ────────────────────────────────────────────────────────────

export function PropertyCell({ propKey, record }) {
  const empty = <span className="text-muted-foreground/40 text-sm select-none">—</span>;

  switch (propKey) {
    case 'title': {
      const value = record.properties?.title ?? '';
      return (
        <span className="font-medium text-sm truncate text-foreground">
          {record.icon && <span className="mr-1.5">{record.icon}</span>}
          {value || 'Untitled'}
        </span>
      );
    }

    case 'category': {
      const value = record.properties?.category ?? '';
      if (!value) return empty;
      const colorClass = CATEGORY_COLORS[value] ?? 'bg-muted text-muted-foreground';
      return (
        <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize', colorClass)}>
          {value}
        </span>
      );
    }

    case 'reviewers': {
      const value = record.properties?.reviewers;
      if (!Array.isArray(value) || !value.length) return empty;
      return (
        <div className="flex -space-x-1.5">
          {value.slice(0, 3).map((person, i) => {
            const label = String(person);
            const initials = label.includes('@')
              ? label.charAt(0).toUpperCase()
              : label.split(' ').slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
            return (
              <div key={i} title={label}
                className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-semibold flex items-center justify-center border-2 border-background">
                {initials || '?'}
              </div>
            );
          })}
          {value.length > 3 && (
            <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium flex items-center justify-center border-2 border-background">
              +{value.length - 3}
            </div>
          )}
        </div>
      );
    }

    case 'created_time':
    case 'last_edited_time': {
      const raw = propKey === 'created_time' ? record.created_at : record.updated_at;
      if (!raw) return empty;
      try {
        return (
          <span className="text-sm text-muted-foreground tabular-nums">
            {format(new Date(raw), 'MMM d, yyyy h:mm a')}
          </span>
        );
      } catch { return empty; }
    }

    case 'created_by': {
      const display = record.created_by_name || record.created_by_email;
      if (!display) return empty;
      return <span className="text-sm text-muted-foreground truncate">{display}</span>;
    }

    case 'last_edited_by': {
      const display = record.last_edited_by_name || record.last_edited_by_email;
      if (!display) return empty;
      return <span className="text-sm text-muted-foreground truncate">{display}</span>;
    }

    default: {
      const val = record.properties?.[propKey];
      if (val == null || val === '') return empty;
      return <span className="text-sm truncate">{String(val)}</span>;
    }
  }
}

// ─── CategoryCell ─────────────────────────────────────────────────────────────

export function CategoryCell({ record, schema, dbId, currentUser }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const categoryField = schema?.find((f) => f.key === 'category');
  const options = categoryField?.options ?? [];
  const currentValue = record.properties?.category ?? '';

  const { mutate } = useMutation({
    mutationFn: (value) => updateRecordProperty(record.id, { category: value }, currentUser),
    onMutate: async (value) => {
      await qc.cancelQueries({ queryKey: ['hub-records', dbId] });
      const prev = qc.getQueryData(['hub-records', dbId]);
      qc.setQueryData(['hub-records', dbId], (old) =>
        (old ?? []).map((r) =>
          r.id === record.id ? { ...r, properties: { ...r.properties, category: value } } : r
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['hub-records', dbId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['hub-records', dbId] }),
  });

  const pill = currentValue ? (
    <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize',
      CATEGORY_COLORS[currentValue] ?? 'bg-muted text-muted-foreground')}>
      {currentValue}
    </span>
  ) : (
    <span className="text-muted-foreground/40 text-sm select-none">—</span>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button className="flex items-center rounded hover:ring-1 hover:ring-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all">
          {pill}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-0.5">
          <button
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted/60 text-muted-foreground"
            onClick={() => { mutate(''); setOpen(false); }}>
            <Check className={cn('w-3.5 h-3.5 shrink-0', currentValue === '' ? 'text-primary' : 'opacity-0')} />
            None
          </button>
          {options.map((opt) => (
            <button key={opt}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted/60"
              onClick={() => { mutate(opt); setOpen(false); }}>
              <Check className={cn('w-3.5 h-3.5 shrink-0', currentValue === opt ? 'text-primary' : 'opacity-0')} />
              <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize',
                CATEGORY_COLORS[opt] ?? 'bg-muted text-muted-foreground')}>
                {opt}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── ReviewersCell ────────────────────────────────────────────────────────────

export function ReviewersCell({ record, orgMembers, dbId, currentUser }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const raw = record.properties?.reviewers;
  const currentReviewers = (Array.isArray(raw) ? raw : []).map((r) =>
    typeof r === 'string' ? { email: r, name: r } : r
  );
  const currentEmails = new Set(currentReviewers.map((r) => r.email));

  const { mutate } = useMutation({
    mutationFn: (next) => updateRecordProperty(record.id, { reviewers: next }, currentUser),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ['hub-records', dbId] });
      const prev = qc.getQueryData(['hub-records', dbId]);
      qc.setQueryData(['hub-records', dbId], (old) =>
        (old ?? []).map((r) =>
          r.id === record.id ? { ...r, properties: { ...r.properties, reviewers: next } } : r
        )
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['hub-records', dbId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['hub-records', dbId] }),
  });

  const toggleMember = (member) => {
    const next = currentEmails.has(member.email)
      ? currentReviewers.filter((r) => r.email !== member.email)
      : [...currentReviewers, { email: member.email, name: member.name }];
    mutate(next);
  };

  const getInitials = (r) => {
    const label = r.name || r.email || '';
    if (label.includes('@')) return label.charAt(0).toUpperCase();
    return label.split(' ').slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
  };

  const MAX_SHOWN = 3;
  const shown = currentReviewers.slice(0, MAX_SHOWN);
  const extra = currentReviewers.length - MAX_SHOWN;

  const avatarStack = currentReviewers.length === 0 ? (
    <span className="text-muted-foreground/40 text-sm select-none">—</span>
  ) : (
    <div className="flex -space-x-1.5">
      {shown.map((r, i) => (
        <div key={i} title={r.name || r.email}
          className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-semibold flex items-center justify-center border-2 border-background">
          {getInitials(r) || '?'}
        </div>
      ))}
      {extra > 0 && (
        <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium flex items-center justify-center border-2 border-background">
          +{extra}
        </div>
      )}
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button className="flex items-center rounded hover:ring-1 hover:ring-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all">
          {avatarStack}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start" onClick={(e) => e.stopPropagation()}>
        {!orgMembers?.length ? (
          <p className="text-xs text-muted-foreground px-2 py-1.5">No members found.</p>
        ) : (
          <div className="space-y-0.5 max-h-56 overflow-y-auto">
            {orgMembers.map((m) => {
              const isSelected = currentEmails.has(m.email);
              const initials = (m.full_name || m.email || '').split(' ').slice(0, 2)
                .map((w) => w.charAt(0).toUpperCase()).join('') || '?';
              return (
                <button key={m.email}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted/60"
                  onClick={() => toggleMember({ email: m.email, name: m.full_name || '' })}>
                  <Check className={cn('w-3.5 h-3.5 shrink-0', isSelected ? 'text-primary' : 'opacity-0')} />
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="truncate text-xs font-medium leading-tight">{m.full_name || m.email}</span>
                    {m.full_name && (
                      <span className="truncate text-[10px] text-muted-foreground leading-tight">{m.email}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── PendingTitleInput ──────────────────────────────────────────────────────
// Bare inline title input used by the grouped ("By Category") view — commits
// on Enter/blur, cancels on Escape.

export function PendingTitleInput({ onCommit, onCancel }) {
  const [value, setValue] = useState('');

  return (
    <input
      autoFocus
      value={value}
      placeholder="New document title…"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); onCommit(value); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      }}
      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
    />
  );
}

// ─── PendingRow ───────────────────────────────────────────────────────────────
// Inline "new document" row for the flat (non-grouped) table view. Renders a
// title input in the title cell and empty placeholders across the rest of the
// row so it lines up with real records, then creates the record on commit.

export function PendingRow({ allCols, onCommit, onCancel, creating }) {
  const [value, setValue] = useState('');

  const commit = () => {
    if (creating) return;
    onCommit(value);
  };

  return (
    <tr className="bg-primary/5">
      {allCols.map((col) => (
        <td key={col} className="px-3 py-2.5 align-middle">
          {col === 'title' ? (
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-sm">📄</span>
              {creating ? (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating…
                </span>
              ) : (
                <input
                  autoFocus
                  value={value}
                  placeholder="New document title…"
                  onChange={(e) => setValue(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commit(); }
                    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
                  }}
                  className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/60 placeholder:font-normal"
                />
              )}
            </div>
          ) : (
            <span className="text-muted-foreground/30 text-sm select-none">—</span>
          )}
        </td>
      ))}
      <td />
    </tr>
  );
}

// ─── RecordsTable ─────────────────────────────────────────────────────────────

export function RecordsTable({
  records, visibleCols, schema, orgMembers, dbId, currentUser,
  pendingRow, onPendingCommit, onPendingCancel, creating,
  onAddProperty, onHideProperty, onDeleteProperty, onSortProperty,
}) {
  const allCols = ['title', ...visibleCols.filter((c) => c !== 'title')];

  if (!records.length && !pendingRow) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No documents here yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            {allCols.map((col) => (
              <th key={col}
                className={cn(
                  'group/th text-left px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30',
                  'border-b border-border sticky top-0 z-10',
                  COLUMN_META[col]?.className ?? 'min-w-[7rem]'
                )}>
                <div className="flex items-center justify-between gap-1">
                  <span>{COLUMN_META[col]?.label ?? getSchemaLabel(col, schema)}</span>
                  {col !== 'title' && onHideProperty && (
                    <ColumnHeaderDropdown
                      onHide={() => onHideProperty(col)}
                      onDelete={onDeleteProperty && !NON_DELETABLE_COLS.has(col)
                        ? () => onDeleteProperty(col)
                        : undefined}
                      onSortAsc={onSortProperty ? () => onSortProperty(col, 'asc') : undefined}
                      onSortDesc={onSortProperty ? () => onSortProperty(col, 'desc') : undefined}
                    />
                  )}
                </div>
              </th>
            ))}
            {onAddProperty && (
              <th className="w-10 bg-muted/30 border-b border-border sticky top-0 z-10">
                <button
                  onClick={onAddProperty}
                  className="w-full h-full flex items-center justify-center py-2 px-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Add property"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {records.map((record, idx) => (
            <tr key={record.id}
              className={cn(
                'group transition-colors hover:bg-muted/30',
                (idx !== records.length - 1 || pendingRow) && 'border-b border-border/50'
              )}>
              {allCols.map((col) => (
                <td key={col} className="px-3 py-2.5 align-middle overflow-hidden">
                  {col === 'title' ? (
                    // Title cell — click to open the page editor; ↗ icon appears on hover
                    <Link
                      to={record.page_id ? `/page/${record.page_id}` : '#'}
                      className="group/title flex items-center gap-1.5 font-medium text-sm text-foreground hover:underline underline-offset-2 max-w-full">
                      {record.icon && <span className="shrink-0">{record.icon}</span>}
                      <span className="truncate">{record.properties?.title || 'Untitled'}</span>
                      <ExternalLink className="w-3 h-3 ml-1 shrink-0 text-muted-foreground opacity-0 group-hover/title:opacity-60 transition-opacity" />
                    </Link>
                  ) : col === 'category' ? (
                    <CategoryCell record={record} schema={schema} dbId={dbId} currentUser={currentUser} />
                  ) : col === 'reviewers' ? (
                    <ReviewersCell record={record} orgMembers={orgMembers} dbId={dbId} currentUser={currentUser} />
                  ) : (
                    <PropertyCell propKey={col} record={record} />
                  )}
                </td>
              ))}
              {onAddProperty && <td />}
            </tr>
          ))}
          {pendingRow && (
            <PendingRow
              allCols={allCols}
              onCommit={onPendingCommit}
              onCancel={onPendingCancel}
              creating={creating}
            />
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── GroupSection ─────────────────────────────────────────────────────────────

export function GroupSection({
  groupKey, records, visibleCols, schema, orgMembers, dbId, currentUser,
  onAddProperty, onHideProperty, onDeleteProperty, onSortProperty,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const displayLabel = groupKey || 'No category';
  const colorClass = CATEGORY_COLORS[groupKey] ?? 'bg-muted text-muted-foreground';

  return (
    <div className="mb-1">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-muted/30 rounded-md transition-colors">
        {collapsed
          ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          : <ChevronDown  className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        }
        <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize', colorClass)}>
          {displayLabel}
        </span>
        <span className="text-xs text-muted-foreground ml-0.5">
          {records.length} {records.length === 1 ? 'doc' : 'docs'}
        </span>
      </button>
      {!collapsed && (
        <div className="ml-4 mt-0.5 border-l border-border/60 pl-2">
          <RecordsTable
            records={records}
            visibleCols={visibleCols}
            schema={schema}
            orgMembers={orgMembers}
            dbId={dbId}
            currentUser={currentUser}
            onAddProperty={onAddProperty}
            onHideProperty={onHideProperty}
            onDeleteProperty={onDeleteProperty}
            onSortProperty={onSortProperty}
          />
        </div>
      )}
    </div>
  );
}

// ─── ViewTabs ─────────────────────────────────────────────────────────────────
// Segmented tab bar — active tab shows a filled star icon (Notion-style).

function ViewTabs({ views, activeViewId, onSwitch }) {
  return (
    <div className="flex gap-0 border-b border-border overflow-x-auto scrollbar-none">
      {views.map((view) => {
        const isActive = view.id === activeViewId;
        return (
          <button
            key={view.id}
            onClick={() => onSwitch(view.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors',
              'border-b-2 -mb-px whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-ring',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}>
            {isActive && (
              <Star className="w-3 h-3 fill-primary text-primary shrink-0" />
            )}
            {view.name}
          </button>
        );
      })}
    </div>
  );
}

// ─── HubToolbar ───────────────────────────────────────────────────────────────
// Notion-style toolbar row: Filter | Sort | ⚡ | ❄ | 🔍 | Sliders ‖ New ▾

function HubToolbar({ onNew, creating, disabled }) {
  const iconBtn =
    'p-1.5 rounded hover:bg-muted/60 text-muted-foreground transition-colors';
  return (
    <div className="flex-shrink-0 flex items-center gap-0.5 px-8 py-1.5 border-b border-border">
      <button className={iconBtn} title="Filter">     <ListFilter        className="w-4 h-4" /></button>
      <button className={iconBtn} title="Sort">       <ArrowUpDown       className="w-4 h-4" /></button>
      <div className="w-px h-4 bg-border mx-1.5" />
      <button className={iconBtn} title="Automate">   <Zap               className="w-4 h-4" /></button>
      <button className={iconBtn} title="Freeze">     <Snowflake         className="w-4 h-4" /></button>
      <div className="w-px h-4 bg-border mx-1.5" />
      <button className={iconBtn} title="Search">     <Search            className="w-4 h-4" /></button>
      <button className={iconBtn} title="Properties"> <SlidersHorizontal className="w-4 h-4" /></button>

      {/* New ▾ split button (right-aligned) */}
      <div className="ml-auto flex items-center">
        <Button
          size="sm"
          className="gap-1.5 rounded-r-none px-3 h-7"
          onClick={onNew}
          disabled={creating || disabled}>
          {creating
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Plus    className="w-3.5 h-3.5" />
          }
          New
        </Button>
        <Button
          size="sm"
          className="rounded-l-none px-1.5 h-7 border-l border-primary-foreground/20"
          disabled={disabled}>
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── CustomizeDrawer ──────────────────────────────────────────────────────────
// Right-side Sheet with chip toggles (blue = ON, gray = OFF) and Continue button.

function CustomizeDrawer({ open, onOpenChange, activeView, viewsQueryKey, schema }) {
  const qc = useQueryClient();
  const visibleColumns = activeView?.visibleColumns ?? [];

  // Build toggleable list from schema (excluding the title/fixed column),
  // falling back to the hardcoded list when schema isn't loaded yet.
  const toggleableProps = schema?.length
    ? schema
        .filter((f) => f.key !== 'title' && f.type !== 'title')
        .map((f) => ({ key: f.key, label: f.label ?? f.name ?? f.key }))
    : TOGGLEABLE_PROPS;

  const { mutate: persistColumns } = useMutation({
    mutationFn: ({ viewId, columns }) => DatabaseView.update(viewId, { visibleColumns: columns }),
    onMutate: async ({ columns }) => {
      await qc.cancelQueries({ queryKey: viewsQueryKey });
      const previous = qc.getQueryData(viewsQueryKey);
      qc.setQueryData(viewsQueryKey, (old) =>
        (old ?? []).map((v) =>
          v.id === activeView?.id ? { ...v, visibleColumns: columns } : v
        )
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(viewsQueryKey, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: viewsQueryKey }),
  });

  function handleToggle(key) {
    if (!activeView?.id) return;
    const isOn = visibleColumns.includes(key);
    const nextColumns = isOn
      ? visibleColumns.filter((c) => c !== key)
      : [...visibleColumns, key];
    persistColumns({ viewId: activeView.id, columns: nextColumns });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 sm:max-w-80 flex flex-col p-0">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <h2 className="text-sm font-semibold">Customize Document Hub</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Select features to turn on or off</p>
        </div>

        {/* Chip toggles */}
        <div className="flex-1 px-5 py-5 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {toggleableProps.map(({ key, label }) => {
              const isOn = visibleColumns.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => handleToggle(key)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
                    isOn
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:border-blue-500'
                      : 'bg-muted text-muted-foreground border-border hover:bg-muted/70'
                  )}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Continue
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── DocumentHub (page) ───────────────────────────────────────────────────────

export default function DocumentHub() {
  const navigate = useNavigate();
  const { databaseId: urlDatabaseId } = useParams();
  const qc = useQueryClient();
  const { currentOrg, user } = useWorkspace();
  const orgId = currentOrg?.id;

  const [activeViewId, setActiveViewId]               = useState(null);
  const [customizeOpen, setCustomizeOpen]             = useState(false);
  const [tourOpen, setTourOpen]                       = useState(false);
  const [getStartedDismissed, setGetStartedDismissed] = useState(false);
  const [isFavorite, setIsFavorite]                   = useState(false);
  const [showAddProp, setShowAddProp]                 = useState(false);

  // ── 1. Find (or seed) the Document Hub database ───────────────────────────
  const { data: database, isLoading: dbLoading } = useQuery({
    queryKey: ['document-hub', orgId],
    queryFn: async () => {
      if (urlDatabaseId) {
        const direct = await Database.get(urlDatabaseId);
        if (direct) return direct;
      }
      const all = await Database.filter({ org_id: orgId });
      const found = all.find((db) => db.name === 'Document Hub') ?? null;
      if (found) return found;
      await seedDocumentHub(orgId, user?.email ?? '');
      const refreshed = await Database.filter({ org_id: orgId });
      return refreshed.find((db) => db.name === 'Document Hub') ?? null;
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  const dbId = database?.id;

  // ── 2. Records (seed samples on first load) ───────────────────────────────
  const { data: records = [], isLoading: recLoading } = useQuery({
    queryKey: ['hub-records', dbId],
    queryFn: async () => {
      const raw = await DatabaseRecord.filter({ database_id: dbId });
      if (!raw.length) {
        await seedHubRecords(dbId, orgId, user?.email ?? '');
        return DatabaseRecord.filter({ database_id: dbId });
      }
      return raw;
    },
    enabled: !!dbId,
  });

  // ── 3. Views (seed defaults on first load) ────────────────────────────────
  const { data: views = [], isLoading: viewsLoading } = useQuery({
    queryKey: ['hub-views', dbId],
    queryFn: async () => {
      let raw = await DatabaseView.filter({ database_id: dbId });
      if (!raw.length) {
        await seedHubViews(dbId, orgId, user?.email ?? '');
        raw = await DatabaseView.filter({ database_id: dbId });
      }
      return [...raw].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },
    enabled: !!dbId,
  });

  // ── 4. Default active view ────────────────────────────────────────────────
  useEffect(() => {
    if (views.length && !activeViewId) setActiveViewId(views[0].id);
  }, [views, activeViewId]);

  const activeView  = views.find((v) => v.id === activeViewId) ?? views[0] ?? null;
  const visibleCols = activeView?.visibleColumns ?? DEFAULT_VISIBLE_COLUMNS;

  // ── 5. Client-side filter + sort ──────────────────────────────────────────
  const processedRecords = useMemo(() => {
    const filtered = applyHubFilters(records, activeView?.filters, user?.email);
    return applyHubSorts(filtered, activeView?.sorts);
  }, [records, activeView, user?.email]);

  // ── 6. Optional grouping (By Category view) ───────────────────────────────
  const groupedData = useMemo(() => {
    const groupPropKey = activeView?.groupBy?.propertyKey;
    if (!groupPropKey) return null;
    const groups = new Map();
    processedRecords.forEach((record) => {
      const key = getRecordValue(record, groupPropKey) ?? '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    });
    return groups;
  }, [processedRecords, activeView]);

  // ── 7. Inline new-document row (Notion-style) ────────────────────────────
  const [pendingRow, setPendingRow] = useState(null);

  const { mutate: createRecord, isPending: creating } = useMutation({
    mutationFn: async (title) => {
      const page = await Page.create({
        title,
        icon:                 '📄',
        org_id:               orgId,
        database_id:          dbId,
        record_id:            null,
        content:              JSON.stringify([
          { id: '1', type: 'heading1',  content: title },
          { id: '2', type: 'paragraph', content: '' },
        ]),
        category:             null,
        reviewers:            [],
        is_deleted:           false,
        is_template:          false,
        created_by_email:     user?.email ?? '',
        created_by_name:      user?.full_name ?? user?.email ?? '',
        last_edited_by_email: user?.email ?? '',
        last_edited_by_name:  user?.full_name ?? user?.email ?? '',
      });
      const record = await DatabaseRecord.create({
        database_id:          dbId,
        page_id:              page.id,
        org_id:               orgId,
        properties:           { title, category: null, reviewers: [] },
        created_by_email:     user?.email ?? '',
        created_by_name:      user?.full_name ?? user?.email ?? '',
        last_edited_by_email: user?.email ?? '',
        last_edited_by_name:  user?.full_name ?? user?.email ?? '',
      });
      await Page.update(page.id, { record_id: record.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hub-records', dbId] });
      setPendingRow(null);
    },
  });

  const handleNewClick = useCallback(() => {
    setPendingRow({ id: 'pending', title: '' });
  }, []);

  const handlePendingCommit = useCallback((title) => {
    if (!title.trim()) { setPendingRow(null); return; }
    createRecord(title.trim());
  }, [createRecord]);

  const handlePendingCancel = useCallback(() => {
    setPendingRow(null);
  }, []);

  // ── 8. Delete sample data ─────────────────────────────────────────────────
  const hasSampleRecords = records.some((r) => r.is_sample);

  const { mutate: deleteSamples, isPending: deletingSamples } = useMutation({
    mutationFn: () => deleteSampleData(orgId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['hub-records', dbId] }),
  });

  // ── 9. Column management ──────────────────────────────────────────────────

  const { mutate: addProperty } = useMutation({
    mutationFn: async (col) => {
      const currentSchema = database?.schema ?? [];
      await Database.update(dbId, { schema: [...currentSchema, col] });
      // Make the new column visible in every view
      await Promise.all(
        (views ?? []).map((v) =>
          DatabaseView.update(v.id, {
            visibleColumns: [...(v.visibleColumns ?? DEFAULT_VISIBLE_COLUMNS), col.key],
          })
        )
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-hub', orgId] });
      qc.invalidateQueries({ queryKey: ['hub-views', dbId] });
    },
  });

  const { mutate: hideProperty } = useMutation({
    mutationFn: async (colKey) => {
      if (!activeView?.id) return;
      const current = activeView.visibleColumns ?? DEFAULT_VISIBLE_COLUMNS;
      await DatabaseView.update(activeView.id, {
        visibleColumns: current.filter((c) => c !== colKey),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hub-views', dbId] }),
  });

  const { mutate: deleteProperty } = useMutation({
    mutationFn: async (colKey) => {
      const currentSchema = database?.schema ?? [];
      await Database.update(dbId, {
        schema: currentSchema.filter((f) => f.key !== colKey),
      });
      await Promise.all(
        (views ?? []).map((v) =>
          DatabaseView.update(v.id, {
            visibleColumns: (v.visibleColumns ?? DEFAULT_VISIBLE_COLUMNS).filter((c) => c !== colKey),
          })
        )
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-hub', orgId] });
      qc.invalidateQueries({ queryKey: ['hub-views', dbId] });
    },
  });

  function sortProperty(colKey, direction) {
    if (!activeView?.id) return;
    DatabaseView.update(activeView.id, {
      sorts: [{ propertyKey: colKey, direction }],
    }).then(() => qc.invalidateQueries({ queryKey: ['hub-views', dbId] }));
  }

  // ── Loading / not-found states ────────────────────────────────────────────
  if (dbLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!database) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
        <BookOpen className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-muted-foreground text-sm">Setting up Document Hub…</p>
        <p className="text-xs text-muted-foreground/60">Refresh the page if this takes too long.</p>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="flex-shrink-0 px-8 pt-8 pb-4">
        <div className="flex items-start justify-between">

          {/* Left: icon + title + subtitle */}
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl leading-none" role="img" aria-label="Document Hub">📄</span>
              <h1 className="text-2xl font-bold tracking-tight">Document Hub</h1>
            </div>
            <p className="text-sm text-muted-foreground pl-[2.875rem]">
              {database.description ?? 'Create and collaborate on documents in one place.'}
            </p>
          </div>

          {/* Right: Share | ★ | … */}
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <Button variant="outline" size="sm" className="gap-1.5 h-8">
              <Share2 className="w-3.5 h-3.5" />
              Share
            </Button>

            <button
              onClick={() => setIsFavorite((f) => !f)}
              className={cn(
                'p-1.5 rounded hover:bg-muted/60 transition-colors',
                isFavorite ? 'text-yellow-500' : 'text-muted-foreground'
              )}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
              <Star className={cn('w-4 h-4', isFavorite && 'fill-yellow-500')} />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded hover:bg-muted/60 text-muted-foreground transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => setCustomizeOpen(true)}>
                  <Settings2 className="w-3.5 h-3.5 mr-2" /> Customize
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTourOpen(true)}>
                  <Play className="w-3.5 h-3.5 mr-2" /> Tour
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => deleteSamples()}
                  disabled={deletingSamples || !hasSampleRecords}
                  className="text-destructive focus:text-destructive">
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Delete sample pages
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* View tabs */}
        {views.length > 0 && (
          <div className="mt-5">
            <ViewTabs
              views={views}
              activeViewId={activeView?.id ?? null}
              onSwitch={setActiveViewId}
            />
          </div>
        )}
      </div>

      {/* ══ TOOLBAR ═════════════════════════════════════════════════════════ */}
      <HubToolbar
        onNew={handleNewClick}
        creating={creating}
        disabled={!dbId}
      />

      {/* ══ TABLE AREA ══════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-auto px-8 py-4">
        {recLoading || viewsLoading ? (
          /* Loading skeleton */
          <div className="space-y-2 pt-2">
            {[...Array(5)].map((_, i) => (
              <div key={i}
                className="h-10 bg-muted/40 rounded animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>

        ) : groupedData ? (
          /* Grouped view (By Category) */
          <div>
            {groupedData.size === 0 && !pendingRow && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No documents here yet.
              </p>
            )}
            {[...groupedData.entries()].map(([key, rows]) => (
              <GroupSection
                key={key || '__empty__'}
                groupKey={key}
                records={rows}
                visibleCols={visibleCols}
                schema={database?.schema}
                orgMembers={currentOrg?.members}
                dbId={dbId}
                currentUser={user}
                onAddProperty={() => setShowAddProp(true)}
                onHideProperty={hideProperty}
                onDeleteProperty={deleteProperty}
                onSortProperty={sortProperty}
              />
            ))}
            {pendingRow && (
              <div className="flex items-center gap-1.5 px-3 py-2.5 border-t border-border/50 bg-primary/5">
                <span className="text-sm shrink-0">📄</span>
                {creating ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Creating…
                  </div>
                ) : (
                  <PendingTitleInput onCommit={handlePendingCommit} onCancel={handlePendingCancel} />
                )}
              </div>
            )}
          </div>

        ) : (
          /* Flat table view (All Docs / My Docs) */
          <RecordsTable
            records={processedRecords}
            visibleCols={visibleCols}
            schema={database?.schema}
            orgMembers={currentOrg?.members}
            dbId={dbId}
            currentUser={user}
            pendingRow={pendingRow}
            onPendingCommit={handlePendingCommit}
            onPendingCancel={handlePendingCancel}
            creating={creating}
            onAddProperty={() => setShowAddProp(true)}
            onHideProperty={hideProperty}
            onDeleteProperty={deleteProperty}
            onSortProperty={sortProperty}
          />
        )}
      </div>

      {/* ══ GET STARTED BAR (dismissible) ════════════════════════════════════ */}
      {!getStartedDismissed && (
        <div className="flex-shrink-0 border-t border-border bg-muted/20 px-8 py-2 flex items-center gap-3">
          {/* ✕ Get started */}
          <button
            onClick={() => setGetStartedDismissed(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <X className="w-3 h-3" />
            Get started
          </button>

          <div className="h-4 w-px bg-border" />

          {/* Action buttons */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
              onClick={() => deleteSamples()}
              disabled={deletingSamples || !hasSampleRecords}>
              {deletingSamples
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <span className="text-[11px] leading-none select-none">✦</span>
              }
              Delete sample pages
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground"
              onClick={() => setTourOpen(true)}>
              <Play className="w-3 h-3" />
              Tour
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground"
              onClick={() => setCustomizeOpen(true)}
              disabled={!activeView}>
              <Settings2 className="w-3 h-3" />
              Customize
            </Button>
          </div>
        </div>
      )}

      {/* ══ CUSTOMIZE DRAWER ════════════════════════════════════════════════ */}
      <CustomizeDrawer
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        activeView={activeView}
        viewsQueryKey={['hub-views', dbId]}
        schema={database?.schema}
      />

      {/* ══ ADD PROPERTY MODAL ══════════════════════════════════════════════ */}
      <AddPropertyModal
        open={showAddProp}
        onClose={() => setShowAddProp(false)}
        onAdd={(col) =>
          addProperty({ key: col.id, label: col.label, type: col.type, options: col.options })
        }
      />

      {/* ══ TOUR MODAL ══════════════════════════════════════════════════════ */}
      <Dialog open={tourOpen} onOpenChange={setTourOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span role="img" aria-label="Document Hub">📄</span>
              Document Hub
            </DialogTitle>
            <DialogDescription>
              A collaborative document workspace for your team.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold mb-1.5">Three views, zero friction</p>
              <ul className="space-y-1.5 text-muted-foreground pl-3 border-l border-border">
                <li>
                  <span className="font-medium text-foreground">All Docs</span>
                  {' — every document your team has created, sorted by most recently edited.'}
                </li>
                <li>
                  <span className="font-medium text-foreground">My Docs</span>
                  {' — only documents you created.'}
                </li>
                <li>
                  <span className="font-medium text-foreground">By Category</span>
                  {' — grouped by tag: Strategy doc, Proposal, or Customer research.'}
                </li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-1.5">Creating documents</p>
              <p className="text-muted-foreground">
                Click <strong>New</strong> to create a document. It opens in the page editor
                where you can write, add blocks, and assign a category and reviewers.
              </p>
            </div>

            <div>
              <p className="font-semibold mb-1.5">Customizing columns</p>
              <p className="text-muted-foreground">
                Click <strong>Customize</strong> to show or hide columns per view.
                Changes are saved automatically.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => setTourOpen(false)}>Got it</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
