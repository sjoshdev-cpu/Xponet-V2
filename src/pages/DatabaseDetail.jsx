import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tabs, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table2, Columns3, List, LayoutGrid, Plus, ChevronDown,
  Settings, MoreHorizontal, Trash2, ArrowLeft, Pencil, Copy,
} from 'lucide-react';
import { Database, DatabaseRecord, DatabaseView, setDatabaseRowBody } from '@/api/firestoreClient.js';
import { seedDatabaseViews } from '@/api/seedDocumentHub.js';
import { useWorkspace } from '@/contexts/WorkspaceContext.jsx';
import { logAuditEvent, AUDIT_ACTIONS } from '@/lib/auditLog';
import { usePresence } from '@/hooks/usePresence';
import { PresenceAvatars } from '@/components/PresenceAvatars';
import { applyFilters, applySorts, genId } from '@/components/database/db-utils.js';
import { VIEW_TYPES } from '@/components/database/db-constants.js';
import FilterSortBar from '@/components/database/FilterSortBar.jsx';
import PropertyEditor from '@/components/database/PropertyEditor.jsx';
import DatabaseTable from '@/components/database/DatabaseTable.jsx';
import DatabaseBoard from '@/components/database/DatabaseBoard.jsx';
import DatabaseGallery from '@/components/database/DatabaseGallery.jsx';
import DatabaseList from '@/components/database/DatabaseList.jsx';
import RowTemplatesModal from '@/components/database/RowTemplatesModal.jsx';
import RecordModal from '@/components/database/RecordModal.jsx';

const VIEW_ICONS = { table: Table2, board: Columns3, list: List, gallery: LayoutGrid };

export default function DatabaseDetail() {
  const { dbId }   = useParams();
  const navigate   = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc         = useQueryClient();
  const { currentOrganization, user } = useWorkspace();
  const orgId = currentOrganization?.id;
  const { viewers } = usePresence('database', dbId);

  // ── Data fetching ────────────────────────────────────────────────────────────
  const { data: database, isLoading: dbLoading } = useQuery({
    queryKey: ['database', dbId],
    queryFn: () => Database.get(dbId),
    enabled: !!dbId,
  });

  const { data: records = [], isLoading: recLoading } = useQuery({
    queryKey: ['records', dbId],
    queryFn: () => DatabaseRecord.filter({ database_id: dbId }),
    enabled: !!dbId,
  });

  const { data: views = [], isLoading: viewsLoading } = useQuery({
    queryKey: ['db_views', dbId],
    queryFn: async () => {
      let raw = await DatabaseView.filter({ database_id: dbId });
      if (!raw.length) {
        await seedDatabaseViews(dbId, orgId);
        raw = await DatabaseView.filter({ database_id: dbId });
      }
      return [...raw].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },
    enabled: !!dbId && !!orgId,
  });

  // All databases (for relation property)
  const { data: allDatabases = [] } = useQuery({
    queryKey: ['databases', orgId],
    queryFn: () => Database.filter({ organization_id: orgId }),
    enabled: !!orgId,
  });

  // ── Local state ──────────────────────────────────────────────────────────────
  const [activeViewId, setActiveViewId] = useState(null);
  const [localFilters, setLocalFilters] = useState([]);
  const [localSorts,   setLocalSorts]   = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [propEditorState, setPropEditorState] = useState(null); // null | { prop }
  const [addViewOpen, setAddViewOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue,     setNameValue]     = useState('');
  const [renamingViewId, setRenamingViewId] = useState(null);
  const [renameValue,    setRenameValue]    = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Activate first view when views load (respecting ?view= URL param)
  useEffect(() => {
    if (views.length && !activeViewId) {
      const paramViewId = searchParams.get('view');
      const target = paramViewId ? views.find(v => v.id === paramViewId) : null;
      const first = target ?? views[0];
      setActiveViewId(first.id);
      setLocalFilters(first.filters ?? []);
      setLocalSorts(first.sorts ?? []);
      setSearchParams({ view: first.id }, { replace: true });
    }
  }, [views, activeViewId]);

  // ── Active view ──────────────────────────────────────────────────────────────
  const activeView = views.find(v => v.id === activeViewId) ?? views[0];

  // When switching views, load saved filters/sorts and sync URL
  function switchView(viewId) {
    const v = views.find(v => v.id === viewId);
    if (!v) return;
    setActiveViewId(viewId);
    setLocalFilters(v.filters ?? []);
    setLocalSorts(v.sorts ?? []);
    setSearchParams({ view: viewId }, { replace: true });
  }

  // ── Computed records ─────────────────────────────────────────────────────────
  const schema = database?.schema ?? [];
  const filtered = applyFilters(records, schema, localFilters);
  const sorted   = applySorts(filtered, localSorts);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const { mutate: updateDb } = useMutation({
    mutationFn: (data) => Database.update(dbId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['database', dbId] }),
    onError: () => toast.error('Failed to update database'),
  });

  const { mutate: deleteRecord } = useMutation({
    mutationFn: (id) => DatabaseRecord.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['records', dbId] });
      if (selectedRecord?.id === id) setSelectedRecord(null);
    },
    onError: () => toast.error('Failed to delete record'),
  });

  const { mutate: saveView } = useMutation({
    mutationFn: ({ id, data }) => DatabaseView.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['db_views', dbId] }),
    onError: () => toast.error('Failed to save view'),
  });

  const { mutate: createView } = useMutation({
    mutationFn: (data) => DatabaseView.create({ database_id: dbId, ...data }),
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ['db_views', dbId] });
      setActiveViewId(v.id);
      setLocalFilters([]);
      setLocalSorts([]);
      setSearchParams({ view: v.id }, { replace: true });
    },
    onError: () => toast.error('Failed to create view'),
  });

  const { mutate: duplicateView } = useMutation({
    mutationFn: (sourceView) => DatabaseView.create({
      database_id: dbId,
      name: `${sourceView.name} (copy)`,
      type: sourceView.type,
      filters: sourceView.filters ?? [],
      sorts: sourceView.sorts ?? [],
      hidden_props: sourceView.hidden_props ?? [],
    }),
    onSuccess: (newView) => {
      qc.invalidateQueries({ queryKey: ['db_views', dbId] });
      setActiveViewId(newView.id);
      setLocalFilters(newView.filters ?? []);
      setLocalSorts(newView.sorts ?? []);
      setSearchParams({ view: newView.id }, { replace: true });
    },
    onError: () => toast.error('Failed to duplicate view'),
  });

  const { mutate: deleteView } = useMutation({
    mutationFn: (id) => DatabaseView.delete(id),
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries({ queryKey: ['db_views', dbId] });
      if (activeViewId === deletedId) {
        const remaining = views.filter(v => v.id !== deletedId);
        if (remaining.length) switchView(remaining[0].id);
      }
    },
    onError: () => toast.error('Failed to delete view'),
  });

  const { mutate: createRecordWithBody } = useMutation({
    mutationFn: async ({ properties, body }) => {
      const record = await DatabaseRecord.create({ database_id: dbId, properties });
      if (Array.isArray(body) && body.length > 0) {
        await setDatabaseRowBody(dbId, record.id, { body });
      }
      return record;
    },
    onSuccess: (record) => {
      qc.invalidateQueries({ queryKey: ['records', dbId] });
      qc.invalidateQueries({ queryKey: ['databaseRowBody', dbId, record.id] });
      setSelectedRecord(record);
    },
    onError: () => toast.error('Failed to create record'),
  });

  const handleApplyTemplate = (template) => {
    const titlePropId = schema.find((p) => p.type === 'title')?.id;
    const props = { ...(template.properties ?? {}) };
    if (titlePropId) delete props[titlePropId];
    createRecordWithBody({ properties: props, body: template.body ?? [] });
    setTemplatesOpen(false);
  };

  // Auto-save filters/sorts when they change
  const handleFiltersChange = useCallback((newFilters) => {
    setLocalFilters(newFilters);
    if (activeView?.id) saveView({ id: activeView.id, data: { filters: newFilters } });
  }, [activeView, saveView]);

  const handleSortsChange = useCallback((newSorts) => {
    setLocalSorts(newSorts);
    if (activeView?.id) saveView({ id: activeView.id, data: { sorts: newSorts } });
  }, [activeView, saveView]);

  function handleRenameSubmit(viewId) {
    const trimmed = renameValue.trim();
    if (trimmed) saveView({ id: viewId, data: { name: trimmed } });
    setRenamingViewId(null);
  }

  // ── Schema editing ───────────────────────────────────────────────────────────
  function handleSaveProperty(updatedProp) {
    const idx = schema.findIndex(p => p.id === updatedProp.id);
    let newSchema;
    const isNew = idx < 0;
    if (!isNew) {
      newSchema = schema.map((p, i) => i === idx ? updatedProp : p);
    } else {
      newSchema = [...schema, updatedProp];
    }
    updateDb({ schema: newSchema });
    const existingProp = !isNew ? schema[idx] : null;
    logAuditEvent(orgId, {
      actorUid:    user?.uid,
      actorName:   user?.full_name || user?.email,
      action:      isNew ? AUDIT_ACTIONS.DB_PROP_ADD : AUDIT_ACTIONS.DB_PROP_EDIT,
      entityType:  'database',
      entityId:    dbId,
      entityTitle: database?.name || 'Untitled database',
      metadata: isNew
        ? { propertyName: updatedProp.name, propertyType: updatedProp.type }
        : {
            propertyName: updatedProp.name,
            propertyType: updatedProp.type,
            renamedFrom: existingProp?.name !== updatedProp.name ? existingProp?.name : undefined,
          },
    });
  }

  function handleDeleteProperty(propId) {
    if (propId === schema.find(p => p.type === 'title')?.id) return; // Protect title
    const prop = schema.find(p => p.id === propId);
    updateDb({ schema: schema.filter(p => p.id !== propId) });
    logAuditEvent(orgId, {
      actorUid:    user?.uid,
      actorName:   user?.full_name || user?.email,
      action:      AUDIT_ACTIONS.DB_PROP_DELETE,
      entityType:  'database',
      entityId:    dbId,
      entityTitle: database?.name || 'Untitled database',
      metadata:    { propertyName: prop?.name, propertyType: prop?.type },
    });
  }

  function handleUpdateOptionColor(propId, optId, key, val) {
    const newSchema = schema.map(p =>
      p.id === propId
        ? { ...p, options: (p.options ?? []).map(o => o.id === optId ? { ...o, [key]: val } : o) }
        : p
    );
    updateDb({ schema: newSchema });
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (dbLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!database) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">Database not found.</p>
        <Button variant="outline" onClick={() => navigate('/databases')}>Back to databases</Button>
      </div>
    );
  }

  const viewType = activeView?.type ?? 'table';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-3 border-b border-border">
        {/* Back + breadcrumb */}
        <button
          onClick={() => navigate('/databases')}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Databases
        </button>

        {/* DB name + icon */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{database.icon ?? '📋'}</span>
          {isEditingName ? (
            <input
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={() => { updateDb({ name: nameValue }); setIsEditingName(false); }}
              onKeyDown={e => { if (e.key === 'Enter') { updateDb({ name: nameValue }); setIsEditingName(false); } }}
              className="text-2xl font-bold bg-transparent border-b border-primary outline-none"
              autoFocus
            />
          ) : (
            <h1
              className="text-2xl font-bold cursor-text hover:opacity-80"
              onClick={() => { setNameValue(database.name); setIsEditingName(true); }}
            >
              {database.name}
            </h1>
          )}
          <PresenceAvatars viewers={viewers} className="ml-2" />
        </div>

        {/* View tabs + filter/sort bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* View tabs */}
          <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5">
            {views.map((v, idx) => {
              const Icon = VIEW_ICONS[v.type] ?? Table2;
              const isActive = v.id === activeViewId;
              const isDefault = idx === 0;
              const isRenaming = renamingViewId === v.id;
              const hasFilters = isActive
                ? localFilters.length > 0
                : (v.filters ?? []).length > 0;
              return (
                <button
                  key={v.id}
                  onClick={() => !isRenaming && switchView(v.id)}
                  className={`group/tab relative flex items-center gap-1.5 px-3 py-1 rounded-md text-sm transition-colors ${
                    isActive
                      ? 'bg-background shadow-sm font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {isRenaming ? (
                    <input
                      autoFocus
                      className="w-24 bg-transparent outline-none border-b border-primary text-sm"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameSubmit(v.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameSubmit(v.id);
                        if (e.key === 'Escape') setRenamingViewId(null);
                        e.stopPropagation();
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span>{v.name}</span>
                  )}
                  {hasFilters && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <span
                        className="ml-0.5 opacity-0 group-hover/tab:opacity-100 transition-opacity inline-flex"
                        onClick={e => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-3 h-3" />
                      </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={e => {
                          e.stopPropagation();
                          setRenameValue(v.name);
                          setRenamingViewId(v.id);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={e => {
                          e.stopPropagation();
                          duplicateView(v);
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" /> Duplicate
                      </DropdownMenuItem>
                      {!isDefault && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 text-destructive focus:text-destructive"
                            onClick={e => {
                              e.stopPropagation();
                              deleteView(v.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </button>
              );
            })}
            {/* Add view */}
            <DropdownMenu open={addViewOpen} onOpenChange={setAddViewOpen}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-2 py-1 text-muted-foreground hover:text-foreground text-sm">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {VIEW_TYPES.map(vt => {
                  const Icon = VIEW_ICONS[vt.type] ?? Table2;
                  return (
                    <DropdownMenuItem
                      key={vt.type}
                      className="gap-2"
                      onClick={() => {
                        createView({ name: vt.label, type: vt.type, filters: [], sorts: [], hidden_props: [] });
                        setAddViewOpen(false);
                      }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {vt.label} view
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTemplatesOpen(true)}>
              Templates
            </Button>
          </div>

          {/* Filter / sort bar */}
          <FilterSortBar
            schema={schema}
            filters={localFilters}
            sorts={localSorts}
            onFiltersChange={handleFiltersChange}
            onSortsChange={handleSortsChange}
          />

          {/* Record count */}
          <span className="text-xs text-muted-foreground ml-auto">
            {sorted.length} record{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── View content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {recLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : viewType === 'table' ? (
          <DatabaseTable
            schema={schema}
            records={sorted}
            databaseId={dbId}
            onOpenRecord={setSelectedRecord}
            onAddProperty={() => setPropEditorState({ prop: null })}
            onEditProperty={(prop) => setPropEditorState({ prop })}
            allRecords={records}
            allDatabases={allDatabases}
          />
        ) : viewType === 'board' ? (
          <DatabaseBoard
            schema={schema}
            records={sorted}
            databaseId={dbId}
            onOpenRecord={setSelectedRecord}
            allRecords={records}
            allDatabases={allDatabases}
          />
        ) : viewType === 'list' ? (
          <DatabaseList
            schema={schema}
            records={sorted}
            databaseId={dbId}
            onOpenRecord={setSelectedRecord}
            allRecords={records}
          />
        ) : (
          <DatabaseGallery
            schema={schema}
            records={sorted}
            databaseId={dbId}
            onOpenRecord={setSelectedRecord}
            allRecords={records}
          />
        )}
      </div>

      {/* ── Property editor dialog ───────────────────────────────────────────── */}
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

      {/* ── Record modal (side peek) ─────────────────────────────────────────── */}
      {selectedRecord && (
        <RecordModal
          record={selectedRecord}
          database={database}
          schema={schema}
          allRecords={records}
          allDatabases={allDatabases}
          onClose={() => setSelectedRecord(null)}
          onDelete={(id) => deleteRecord(id)}
          onUpdateOption={(propId, optId, key, val) => handleUpdateOptionColor(propId, optId, key, val)}
        />
      )}

      <RowTemplatesModal
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        databaseId={dbId}
        onApply={handleApplyTemplate}
      />
    </div>
  );
}
