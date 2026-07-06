/**
 * InlineDatabaseEmbed — renders a full Firestore-backed database
 * inline inside the page editor.
 *
 * Block shape:
 *   { type: 'database-embed', databaseId: string|null, defaultView: 'table'|'board'|'gallery'|'list', content: '' }
 *
 * Props:
 *   block          — the current block object
 *   onChange       — fn(partialUpdates) — merges updates into the block
 *   onFocusNext    — fn() — called to focus the next block (for focus transitions)
 *   onFocusPrevious — fn() — called to focus the previous block or insert above
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Table2, Columns3, List, LayoutGrid, Plus, Settings2,
  Loader2, Sparkles, Link2,
} from 'lucide-react';
import { Database, DatabaseRecord, DatabaseView } from '@/api/firestoreClient.js';
import { seedDatabaseViews } from '@/api/seedDocumentHub.js';
import { useWorkspace } from '@/contexts/WorkspaceContext.jsx';
import { applyFilters, applySorts } from '@/components/database/db-utils.js';
import FilterSortBar from '@/components/database/FilterSortBar.jsx';
import PropertyEditor from '@/components/database/PropertyEditor.jsx';
import DatabaseTable from '@/components/database/DatabaseTable.jsx';
import DatabaseBoard from '@/components/database/DatabaseBoard.jsx';
import DatabaseGallery from '@/components/database/DatabaseGallery.jsx';
import DatabaseList from '@/components/database/DatabaseList.jsx';
import RecordModal from '@/components/database/RecordModal.jsx';

// ─── Setup templates ────────────────────────────────────────────────────────────
const SETUP_TEMPLATES = [
  {
    key: 'tasks',
    label: 'Tasks Tracker',
    icon: '✅',
    desc: 'Track tasks with status & priority',
    name: 'Tasks',
    schema: [
      { id: 'title',    name: 'Task',     type: 'title' },
      { id: 'status',   name: 'Status',   type: 'status', options: [
        { id: 'not_started', label: 'Not started', color: 'gray' },
        { id: 'in_progress', label: 'In progress', color: 'blue' },
        { id: 'done',        label: 'Done',        color: 'green' },
      ]},
      { id: 'priority', name: 'Priority', type: 'select', options: [
        { id: 'low',    label: 'Low',    color: 'gray' },
        { id: 'medium', label: 'Medium', color: 'yellow' },
        { id: 'high',   label: 'High',   color: 'red' },
      ]},
      { id: 'due_date', name: 'Due date', type: 'date' },
    ],
  },
  {
    key: 'projects',
    label: 'Projects',
    icon: '📁',
    desc: 'Manage projects with milestones',
    name: 'Projects',
    schema: [
      { id: 'title',    name: 'Project',  type: 'title' },
      { id: 'status',   name: 'Status',   type: 'status', options: [
        { id: 'planning', label: 'Planning',  color: 'gray' },
        { id: 'active',   label: 'Active',    color: 'blue' },
        { id: 'on_hold',  label: 'On hold',   color: 'yellow' },
        { id: 'done',     label: 'Complete',  color: 'green' },
      ]},
      { id: 'deadline', name: 'Deadline', type: 'date' },
    ],
  },
  {
    key: 'documents',
    label: 'Document Hub',
    icon: '📚',
    desc: 'Organize docs by category',
    name: 'Document Hub',
    schema: [
      { id: 'title',    name: 'Document',  type: 'title' },
      { id: 'category', name: 'Category',  type: 'select', options: [
        { id: 'strategy', label: 'Strategy', color: 'blue' },
        { id: 'proposal', label: 'Proposal', color: 'purple' },
        { id: 'report',   label: 'Report',   color: 'green' },
      ]},
      { id: 'status',   name: 'Status',    type: 'status', options: [
        { id: 'draft',    label: 'Draft',     color: 'gray' },
        { id: 'review',   label: 'In review', color: 'yellow' },
        { id: 'approved', label: 'Approved',  color: 'green' },
      ]},
    ],
  },
];

const VIEW_ICONS  = { table: Table2, board: Columns3, list: List, gallery: LayoutGrid };
const VIEW_LABELS = { table: 'Table', board: 'Board', list: 'List', gallery: 'Gallery' };

// Default schema applied when the user picks "New empty data source"
const DEFAULT_SCHEMA = [
  { id: 'title',  name: 'Name',   type: 'title' },
  { id: 'status', name: 'Status', type: 'status', options: [
    { id: 'todo',        label: 'To do',       color: 'gray'  },
    { id: 'in_progress', label: 'In progress', color: 'blue'  },
    { id: 'done',        label: 'Done',        color: 'green' },
  ]},
];

// ─── SetupPicker ────────────────────────────────────────────────────────────────
function SetupPicker({ block, onChange, orgId }) {
  const [aiPrompt, setAiPrompt] = useState('');
  const [linkMode, setLinkMode] = useState(false);
  const [creating, setCreating] = useState(false);

  // Guard against double-clicks via a ref so we never get stale-closure races
  const creatingRef = useRef(false);

  // Keep a stable ref to the latest onChange so the async callback always
  // calls the current version even if the prop was replaced mid-flight.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const { data: databases = [], isLoading: dbsLoading } = useQuery({
    queryKey: ['databases', orgId],
    queryFn: () => Database.filter({ org_id: orgId }),
    enabled: !!orgId && linkMode,
  });

  // createDb intentionally omits `creating` and `onChange` from deps.
  // - `creatingRef` provides the guard without causing stale captures.
  // - `onChangeRef.current` always points to the freshest onChange.
  const createDb = useCallback(async (e, template = null) => {
    // Support being called as (template) without an event too
    if (e && typeof e === 'object' && 'stopPropagation' in e) {
      e.stopPropagation();
      e.preventDefault();
    } else {
      // Called as createDb(template) — shift arg
      template = e ?? null;
      e = null;
    }
    if (!orgId) {
      toast.error('No workspace selected. Please reload the page.');
      return;
    }
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    try {
      const schema = template?.schema ?? DEFAULT_SCHEMA;
      const name   = aiPrompt.trim() || template?.name || 'New database';
      const icon   = template?.icon ?? '📋';
      const db     = await Database.create({ name, icon, schema, org_id: orgId });
      if (!db?.id) throw new Error('Database.create returned no id');
      // Use the ref so we get the latest onChange even if BlockRenderer re-rendered
      onChangeRef.current({ databaseId: db.id });
    } catch (err) {
      console.error('[InlineDatabaseEmbed] Failed to create database:', err);
      toast.error('Failed to create database — please try again.');
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }, [orgId, aiPrompt]); // no `creating` or `onChange` — handled via refs

  const defaultView = block.defaultView || 'table';
  const ViewIcon    = VIEW_ICONS[defaultView] || Table2;

  return (
    <div
      className="border-2 border-dashed border-border rounded-xl overflow-hidden my-2"
      // Prevent the block drag-handle from stealing focus when interacting with this picker
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border">
        <ViewIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          New {VIEW_LABELS[defaultView] || 'Database'} — choose a data source
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* AI describe */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
            <Input
              placeholder="Describe what you want to build…"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              className="pl-8 h-9 text-sm"
              onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); createDb(null, null); } }}
            />
          </div>
          {aiPrompt.trim() && (
            <Button type="button" size="sm" className="h-9 shrink-0" onClick={(e) => createDb(e, null)} disabled={creating}>
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create'}
            </Button>
          )}
        </div>

        {/* Empty data source */}
        <button
          type="button"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-accent transition-colors text-left"
          onClick={(e) => createDb(e, null)}
          disabled={creating}
        >
          <div className="h-8 w-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0 text-base">
            📋
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">New empty data source</p>
            <p className="text-xs text-muted-foreground">Start from a blank table</p>
          </div>
          {creating && <Loader2 className="h-4 w-4 animate-spin ml-auto shrink-0 text-muted-foreground" />}
        </button>

        {/* Templates */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
            Suggested templates
          </p>
          <div className="grid grid-cols-3 gap-2">
            {SETUP_TEMPLATES.map(tpl => (
              <button
                key={tpl.key}
                type="button"
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border border-border hover:bg-accent hover:border-primary/30 transition-colors text-center"
                onClick={(e) => createDb(e, tpl)}
                disabled={creating}
              >
                <span className="text-xl">{tpl.icon}</span>
                <p className="text-xs font-medium leading-tight">{tpl.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{tpl.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Link existing */}
        {!linkMode ? (
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={(e) => { e.stopPropagation(); setLinkMode(true); }}
          >
            <Link2 className="h-3.5 w-3.5" />
            Link to existing data source
          </button>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Existing databases
            </p>
            {dbsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : databases.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2">No databases found in this workspace</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {databases.map(db => (
                  <button
                    key={db.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-left"
                    onClick={(e) => { e.stopPropagation(); onChangeRef.current({ databaseId: db.id }); }}
                  >
                    <span className="text-base shrink-0">{db.icon || '📋'}</span>
                    <p className="text-sm font-medium truncate">{db.name || 'Untitled'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EmbeddedView ───────────────────────────────────────────────────────────────
function EmbeddedView({ block, onChange, orgId, onFocusNext, onFocusPrevious }) {
  const qc = useQueryClient();

  const [activeViewId,   setActiveViewId]   = useState(block.viewId ?? null);
  const [filters,        setFilters]        = useState([]);
  const [sorts,          setSorts]          = useState([]);
  const [showFilterBar,  setShowFilterBar]  = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [propEditorState, setPropEditorState] = useState(null); // null | { prop }
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft,     setTitleDraft]     = useState('');

  const focusSiblingEditable = useCallback((currentBlock, direction) => {
    if (!currentBlock) return false;
    const sibling = direction === 'next' ? currentBlock.nextElementSibling : currentBlock.previousElementSibling;
    if (!sibling) return false;
    const editableEl = sibling.querySelector('[contenteditable]');
    if (!editableEl) return false;
    editableEl.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    const pos = direction === 'next' ? 0 : (editableEl.textContent?.length || 0);
    range.setStart(editableEl, pos);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  }, []);

  const handleFocusPrevious = useCallback((e) => {
    e.stopPropagation();
    const dbContainer = e.currentTarget.closest('.block-wrapper');
    if (dbContainer && focusSiblingEditable(dbContainer, 'previous')) return;
    onFocusPrevious?.({ focus: true });
  }, [focusSiblingEditable, onFocusPrevious]);

  const handleFocusNext = useCallback((e) => {
    e.stopPropagation();
    const dbContainer = e.currentTarget.closest('.block-wrapper');
    if (dbContainer && focusSiblingEditable(dbContainer, 'next')) return;
    onFocusNext?.({ focus: true });
  }, [focusSiblingEditable, onFocusNext]);

  const databaseId = block.databaseId;

  const { data: database, isLoading: dbLoading } = useQuery({
    queryKey: ['database', databaseId],
    queryFn: () => Database.get(databaseId),
    enabled: !!databaseId,
  });

  const { data: records = [], isLoading: recLoading } = useQuery({
    queryKey: ['records', databaseId],
    queryFn: () => DatabaseRecord.filter({ database_id: databaseId }),
    enabled: !!databaseId,
  });

  const { data: views = [] } = useQuery({
    queryKey: ['db_views', databaseId],
    queryFn: async () => {
      let raw = await DatabaseView.filter({ database_id: databaseId });
      if (!raw.length) {
        await seedDatabaseViews(databaseId, orgId);
        raw = await DatabaseView.filter({ database_id: databaseId });
      }
      return [...raw].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },
    enabled: !!databaseId && !!orgId,
  });

  const { data: allDatabases = [] } = useQuery({
    queryKey: ['databases', orgId],
    queryFn: () => Database.filter({ org_id: orgId }),
    enabled: !!orgId,
  });

  const { mutate: updateDb } = useMutation({
    mutationFn: (data) => Database.update(databaseId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['database', databaseId] }),
  });

  const schema      = database?.schema ?? [];
  const titlePropId = schema.find(p => p.type === 'title')?.id;
  const activeView   = views.find(v => v.id === activeViewId);
  const activeViewType = activeView?.type ?? (block.defaultView || 'table');

  useEffect(() => {
    if (activeViewId || !views.length) return;
    const selected = views.find((v) => v.id === block.viewId)
      ?? views.find((v) => v.type === block.defaultView)
      ?? views[0];
    if (selected) setActiveViewId(selected.id);
  }, [views, activeViewId, block.viewId, block.defaultView]);

  const { mutate: createRecord, isPending: isCreating } = useMutation({
    mutationFn: () =>
      DatabaseRecord.create({
        database_id: databaseId,
        properties: titlePropId ? { [titlePropId]: 'Untitled' } : {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records', databaseId] }),
  });

  const { mutate: deleteRecord } = useMutation({
    mutationFn: (id) => DatabaseRecord.delete(id),
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries({ queryKey: ['records', databaseId] });
      if (selectedRecord?.id === deletedId) setSelectedRecord(null);
    },
  });

  useEffect(() => {
    if (!activeView) return;
    setFilters(activeView.filters ?? []);
    setSorts(activeView.sorts ?? []);
  }, [activeView?.id]);

  const filtered = applyFilters(records, schema, filters);
  const sorted   = applySorts(filtered, sorts);

  function handleSaveProperty(updatedProp) {
    const idx = schema.findIndex(p => p.id === updatedProp.id);
    const newSchema = idx < 0
      ? [...schema, updatedProp]
      : schema.map((p, i) => i === idx ? updatedProp : p);
    updateDb({ schema: newSchema });
  }

  function handleDeleteProperty(propId) {
    if (propId === titlePropId) return; // protect title column
    updateDb({ schema: schema.filter(p => p.id !== propId) });
  }

  function commitTitle() {
    const v = titleDraft.trim();
    if (v && v !== database?.name) updateDb({ name: v });
    setIsEditingTitle(false);
  }

  function switchView(vk) {
    const view = views.find(v => v.id === vk);
    if (!view) return;
    setActiveViewId(vk);
    onChange({ viewId: vk });
    setFilters(view.filters ?? []);
    setSorts(view.sorts ?? []);
  }

  if (dbLoading && !database) {
    return (
      <div className="flex items-center justify-center h-24 border border-border rounded-xl my-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className="border border-border rounded-xl overflow-hidden my-2 bg-background group"
      onMouseDown={e => e.stopPropagation()}
    >
      {onFocusPrevious && (
        <button
          type="button"
          onClick={handleFocusPrevious}
          className="w-full px-3 py-2 text-sm text-muted-foreground text-left transition-colors border-b border-border/30 opacity-0 group-hover:opacity-100 hover:bg-accent/10 focus:outline-none"
        >
          + Click to add text above this database
        </button>
      )}
      {/* ── Compact toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/20 min-h-[40px]">
        {/* Inline title */}
        {isEditingTitle ? (
          <input
            className="text-sm font-semibold bg-transparent border-b border-primary outline-none min-w-0 max-w-[180px]"
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitTitle(); }
              if (e.key === 'Escape') setIsEditingTitle(false);
            }}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="flex items-center gap-1 text-sm font-semibold hover:bg-accent px-1.5 py-0.5 rounded transition-colors max-w-[180px] truncate shrink-0"
            onClick={() => { setTitleDraft(database?.name || 'New database'); setIsEditingTitle(true); }}
            title="Click to rename"
          >
            {database?.icon && <span className="mr-0.5">{database.icon}</span>}
            <span className="truncate">{database?.name || 'New database'}</span>
          </button>
        )}

        {/* View switcher */}
        <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5 ml-1 shrink-0">
          {Object.entries(VIEW_LABELS).map(([vk, vl]) => {
            const VIcon = VIEW_ICONS[vk];
            const view = views.find((v) => v.type === vk);
            const isActive = view?.id === activeViewId || (!activeViewId && vk === block.defaultView);
            return (
              <button
                key={vk}
                type="button"
                onClick={() => view && switchView(view.id)}
                className={cn(
                  'flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors',
                  isActive
                    ? 'bg-background shadow-sm font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <VIcon className="h-3 w-3" />
                {vl}
              </button>
            );
          })}
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-0.5 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn('h-7 px-2 text-xs', showFilterBar && filters.length > 0 && 'bg-accent')}
            onClick={() => setShowFilterBar(v => !v)}
          >
            Filter{filters.length > 0 ? ` (${filters.length})` : ''}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn('h-7 px-2 text-xs', showFilterBar && sorts.length > 0 && 'bg-accent')}
            onClick={() => setShowFilterBar(v => !v)}
          >
            Sort{sorts.length > 0 ? ` (${sorts.length})` : ''}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => setPropEditorState({ prop: null })}
            title="Add / edit properties"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 px-2.5 text-xs ml-0.5"
            onClick={() => createRecord()}
            disabled={isCreating || !databaseId}
          >
            <Plus className="h-3.5 w-3.5 mr-0.5" /> New
          </Button>
        </div>
      </div>

      {/* ── Filter / sort bar ────────────────────────────────────────────────── */}
      {showFilterBar && (
        <div className="px-3 py-2 border-b border-border bg-muted/10">
          <FilterSortBar
            schema={schema}
            filters={filters}
            sorts={sorts}
            onFiltersChange={setFilters}
            onSortsChange={setSorts}
          />
        </div>
      )}

      {/* ── Database content ─────────────────────────────────────────────────── */}
      <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
        {recLoading && !records.length ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : activeView === 'table' ? (
          <DatabaseTable
            schema={schema}
            records={sorted}
            databaseId={databaseId}
            onOpenRecord={setSelectedRecord}
            onAddProperty={() => setPropEditorState({ prop: null })}
            onEditProperty={(prop) => setPropEditorState({ prop })}
            allRecords={records}
            allDatabases={allDatabases}
            onFocusNext={onFocusNext}
          />
        ) : activeView === 'board' ? (
          <DatabaseBoard
            schema={schema}
            records={sorted}
            databaseId={databaseId}
            onOpenRecord={setSelectedRecord}
            allRecords={records}
            allDatabases={allDatabases}
          />
        ) : activeView === 'list' ? (
          <DatabaseList
            schema={schema}
            records={sorted}
            databaseId={databaseId}
            onOpenRecord={setSelectedRecord}
            allRecords={records}
          />
        ) : (
          <DatabaseGallery
            schema={schema}
            records={sorted}
            databaseId={databaseId}
            onOpenRecord={setSelectedRecord}
            allRecords={records}
          />
        )}
      </div>

      {/* ── Click zone below database for text content ─────────────────────── */}
      {onFocusNext && (
        <button
          type="button"
          onClick={handleFocusNext}
          className="w-full px-3 py-2 text-sm text-muted-foreground text-left transition-colors border-t border-border/30 opacity-0 group-hover:opacity-100 hover:bg-accent/10 focus:outline-none"
          title="Click to add text content below this database"
        >
          + Click to add text below this database
        </button>
      )}

      {/* ── Property editor ──────────────────────────────────────────────────── */}
      {propEditorState !== null && (
        <PropertyEditor
          open
          property={propEditorState.prop ?? { id: '__new__' }}
          schema={schema}
          databases={allDatabases}
          onSave={handleSaveProperty}
          onDelete={handleDeleteProperty}
          onClose={() => setPropEditorState(null)}
        />
      )}

      {/* ── Record modal ─────────────────────────────────────────────────────── */}
      {selectedRecord && (
        <RecordModal
          record={selectedRecord}
          database={database}
          schema={schema}
          allRecords={records}
          allDatabases={allDatabases}
          onClose={() => setSelectedRecord(null)}
          onDelete={(id) => deleteRecord(id)}
        />
      )}
    </div>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────────
export default function InlineDatabaseEmbed({ block, onChange, onFocusNext, onFocusPrevious }) {
  const { currentOrg } = useWorkspace();
  const orgId = currentOrg?.id;

  if (!block.databaseId) {
    return <SetupPicker block={block} onChange={onChange} orgId={orgId} />;
  }

  return <EmbeddedView block={block} onChange={onChange} orgId={orgId} onFocusNext={onFocusNext} onFocusPrevious={onFocusPrevious} />;
}
