import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tabs, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table2, Columns3, List, LayoutGrid, Plus, ChevronDown,
  Settings, MoreHorizontal, Trash2, ArrowLeft,
} from 'lucide-react';
import { Database, DatabaseRecord, DatabaseView } from '@/api/firestoreClient.js';
import { useWorkspace } from '@/contexts/WorkspaceContext.jsx';
import { applyFilters, applySorts, genId } from '@/components/database/db-utils.js';
import { VIEW_TYPES } from '@/components/database/db-constants.js';
import FilterSortBar from '@/components/database/FilterSortBar.jsx';
import PropertyEditor from '@/components/database/PropertyEditor.jsx';
import DatabaseTable from '@/components/database/DatabaseTable.jsx';
import DatabaseBoard from '@/components/database/DatabaseBoard.jsx';
import DatabaseGallery from '@/components/database/DatabaseGallery.jsx';
import DatabaseList from '@/components/database/DatabaseList.jsx';
import RecordModal from '@/components/database/RecordModal.jsx';

const VIEW_ICONS = { table: Table2, board: Columns3, list: List, gallery: LayoutGrid };

export default function DatabaseDetail() {
  const { dbId }   = useParams();
  const navigate   = useNavigate();
  const qc         = useQueryClient();
  const { currentOrganization } = useWorkspace();
  const orgId = currentOrganization?.id;

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
    queryFn: () => DatabaseView.filter({ database_id: dbId }),
    enabled: !!dbId,
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

  // Activate first view when views load
  useEffect(() => {
    if (views.length && !activeViewId) {
      const first = views[0];
      setActiveViewId(first.id);
      setLocalFilters(first.filters ?? []);
      setLocalSorts(first.sorts ?? []);
    }
  }, [views, activeViewId]);

  // ── Active view ──────────────────────────────────────────────────────────────
  const activeView = views.find(v => v.id === activeViewId) ?? views[0];

  // When switching views, load saved filters/sorts
  function switchView(viewId) {
    const v = views.find(v => v.id === viewId);
    if (!v) return;
    setActiveViewId(viewId);
    setLocalFilters(v.filters ?? []);
    setLocalSorts(v.sorts ?? []);
  }

  // ── Computed records ─────────────────────────────────────────────────────────
  const schema = database?.schema ?? [];
  const filtered = applyFilters(records, schema, localFilters);
  const sorted   = applySorts(filtered, localSorts);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const { mutate: updateDb } = useMutation({
    mutationFn: (data) => Database.update(dbId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['database', dbId] }),
  });

  const { mutate: deleteRecord } = useMutation({
    mutationFn: (id) => DatabaseRecord.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['records', dbId] });
      if (selectedRecord?.id === id) setSelectedRecord(null);
    },
  });

  const { mutate: saveView } = useMutation({
    mutationFn: ({ id, data }) => DatabaseView.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['db_views', dbId] }),
  });

  const { mutate: createView } = useMutation({
    mutationFn: (data) => DatabaseView.create({ database_id: dbId, ...data }),
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ['db_views', dbId] });
      setActiveViewId(v.id);
    },
  });

  const { mutate: deleteView } = useMutation({
    mutationFn: (id) => DatabaseView.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['db_views', dbId] });
      if (activeViewId === id) {
        const remaining = views.filter(v => v.id !== id);
        if (remaining.length) switchView(remaining[0].id);
      }
    },
  });

  // Auto-save filters/sorts when they change
  const handleFiltersChange = useCallback((newFilters) => {
    setLocalFilters(newFilters);
    if (activeView?.id) saveView({ id: activeView.id, data: { filters: newFilters } });
  }, [activeView, saveView]);

  const handleSortsChange = useCallback((newSorts) => {
    setLocalSorts(newSorts);
    if (activeView?.id) saveView({ id: activeView.id, data: { sorts: newSorts } });
  }, [activeView, saveView]);

  // ── Schema editing ───────────────────────────────────────────────────────────
  function handleSaveProperty(updatedProp) {
    const idx = schema.findIndex(p => p.id === updatedProp.id);
    let newSchema;
    if (idx >= 0) {
      newSchema = schema.map((p, i) => i === idx ? updatedProp : p);
    } else {
      newSchema = [...schema, updatedProp];
    }
    updateDb({ schema: newSchema });
  }

  function handleDeleteProperty(propId) {
    if (propId === schema.find(p => p.type === 'title')?.id) return; // Protect title
    updateDb({ schema: schema.filter(p => p.id !== propId) });
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
        </div>

        {/* View tabs + filter/sort bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* View tabs */}
          <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5">
            {views.map(v => {
              const Icon = VIEW_ICONS[v.type] ?? Table2;
              return (
                <button
                  key={v.id}
                  onClick={() => switchView(v.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm transition-colors ${
                    v.id === activeViewId
                      ? 'bg-background shadow-sm font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {v.name}
                  {views.length > 1 && v.id === activeViewId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="ml-1 hover:text-muted-foreground"
                          onClick={e => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-3 h-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          className="text-destructive gap-2"
                          onClick={() => deleteView(v.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete view
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
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
