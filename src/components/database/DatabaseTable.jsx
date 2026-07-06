import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Settings2 } from 'lucide-react';
import { DatabaseRecord, Database } from '@/api/firestoreClient.js';
import { CellRenderer } from './CellRenderer.jsx';
import CellEditor from './CellEditor.jsx';
import ColumnHeaderDropdown from './ColumnHeaderDropdown.jsx';
import { genId } from './db-utils.js';
import { PROPERTY_TYPES } from './db-constants.js';
import { cn } from '@/lib/utils.js';

const MIN_COL_WIDTH = 100;
const DEFAULT_COL_WIDTH = 180;
const TITLE_COL_WIDTH = 240;

/**
 * Spreadsheet-style table view for a database.
 * Props:
 *   schema         — array of property definitions
 *   records        — filtered+sorted record array
 *   databaseId     — string
 *   onOpenRecord   — fn(record)
 *   onAddProperty  — fn()
 *   onEditProperty — fn(prop)
 *   allRecords     — all records (for relation cells)
 *   allDatabases   — all databases (for relation editors)
 */
export default function DatabaseTable({
  schema,
  records,
  databaseId,
  onOpenRecord,
  onAddProperty,
  onEditProperty,
  allRecords = [],
  allDatabases = [],
  onFocusNext,
}) {
  const qc = useQueryClient();
  const [editingCell, setEditingCell] = useState(null); // { recordId, propId }
  const [colWidths, setColWidths] = useState({});
  const resizing = useRef(null);

  const { mutate: createRecord } = useMutation({
    mutationFn: () => DatabaseRecord.create({
      database_id: databaseId,
      properties: { [titleProp?.id]: 'Untitled' },
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records', databaseId] }),
  });

  const { mutate: updateRecord } = useMutation({
    mutationFn: ({ id, properties }) => DatabaseRecord.update(id, { properties }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records', databaseId] }),
  });

  const { mutate: updateSchema } = useMutation({
    mutationFn: (newSchema) => Database.update(databaseId, { schema: newSchema }),
    onMutate: async (newSchema) => {
      await qc.cancelQueries({ queryKey: ['database', databaseId] });
      const previous = qc.getQueryData(['database', databaseId]);
      qc.setQueryData(['database', databaseId], old => old ? { ...old, schema: newSchema } : old);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(['database', databaseId], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['database', databaseId] }),
  });

  const titleProp = schema.find(p => p.type === 'title');
  const otherProps = schema.filter(p => p.id !== titleProp?.id);
  const visibleProps = [titleProp, ...otherProps].filter(Boolean);

  function colWidth(prop) {
    if (colWidths[prop.id]) return colWidths[prop.id];
    return prop.type === 'title' ? TITLE_COL_WIDTH : DEFAULT_COL_WIDTH;
  }

  function handleCellChange(record, prop, val) {
    const next = { ...(record.properties ?? {}), [prop.id]: val };
    updateRecord({ id: record.id, properties: next });
  }

  function handleAddOption(prop, newOpt) {
    const updatedSchema = schema.map(p =>
      p.id === prop.id ? { ...p, options: [...(p.options ?? []), newOpt] } : p
    );
    updateSchema(updatedSchema);
  }

  function handleUpdateOption(prop, optId, key, val) {
    const updatedSchema = schema.map(p =>
      p.id === prop.id
        ? { ...p, options: (p.options ?? []).map(o => o.id === optId ? { ...o, [key]: val } : o) }
        : p
    );
    updateSchema(updatedSchema);
  }

  // Column resizing
  function startResize(e, propId) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[propId] ?? (propId === titleProp?.id ? TITLE_COL_WIDTH : DEFAULT_COL_WIDTH);
    resizing.current = { propId, startX, startW };

    function onMouseMove(ev) {
      const delta = ev.clientX - startX;
      const newW = Math.max(MIN_COL_WIDTH, startW + delta);
      setColWidths(prev => ({ ...prev, [propId]: newW }));
    }
    function onMouseUp() {
      resizing.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  return (
    <div className="relative overflow-auto h-full">
      <table className="border-collapse min-w-max">
        {/* Header */}
        <thead>
          <tr className="bg-muted/40 border-b border-border">
            {/* Row number / checkbox col */}
            <th className="w-8 min-w-[2rem] border-r border-border sticky left-0 bg-muted/40 z-10" />
            {visibleProps.map(prop => {
              const isTitleProp = prop.type === 'title';
              const isPickerProp = ['select', 'status', 'multi_select'].includes(prop.type);
              return (
                <th
                  key={prop.id}
                  className="border-r border-border relative group/th"
                  style={{ width: colWidth(prop), minWidth: colWidth(prop) }}
                >
                  <div className="flex items-center gap-1 px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground truncate flex-1">
                      {prop.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50 hidden group-hover/th:inline shrink-0">
                      {PROPERTY_TYPES[prop.type]?.label}
                    </span>
                    {!isTitleProp && (
                      <ColumnHeaderDropdown
                        onEditOptions={isPickerProp ? () => onEditProperty(prop) : undefined}
                      />
                    )}
                  </div>
                  {/* Resize handle */}
                  <div
                    className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/50 opacity-0 group-hover/th:opacity-100 transition-opacity"
                    onMouseDown={e => startResize(e, prop.id)}
                  />
                </th>
              );
            })}
            {/* Add property */}
            <th className="w-10 border-r border-border">
              <Button variant="ghost" size="icon" className="w-7 h-7 mx-auto" onClick={onAddProperty}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </th>
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {records.map((record, rowIdx) => (
            <tr
              key={record.id}
              className="border-b border-border hover:bg-muted/20 group"
            >
              {/* Row index + open button */}
              <td className="border-r border-border sticky left-0 bg-background group-hover:bg-muted/20 z-10 text-center w-8">
                <span
                  className="text-xs text-muted-foreground/50 group-hover:hidden px-1"
                >
                  {rowIdx + 1}
                </span>
                <button
                  className="hidden group-hover:block mx-auto"
                  onClick={() => onOpenRecord(record)}
                  title="Open record"
                >
                  <Settings2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </td>

              {/* Cells */}
              {visibleProps.map(prop => {
                const isEditing = editingCell?.recordId === record.id && editingCell?.propId === prop.id;
                const isReadOnly = prop.type === 'rollup' || prop.type === 'formula';
                const isPickerType = ['select', 'status', 'multi_select'].includes(prop.type);
                const val = record.properties?.[prop.id];

                // select / status / multi_select: always render inline picker,
                // bypassing the isEditing gate so the onBlur on the outer td
                // never races against the Radix Portal receiving focus.
                if (isPickerType) {
                  return (
                    <td
                      key={prop.id}
                      className="border-r border-border px-2 py-1 relative"
                      style={{ width: colWidth(prop), maxWidth: colWidth(prop) }}
                    >
                      <CellEditor
                        prop={prop}
                        value={val}
                        onChange={v => handleCellChange(record, prop, v)}
                        onAddOption={newOpt => handleAddOption(prop, newOpt)}
                        onUpdateOption={(optId, key, v) => handleUpdateOption(prop, optId, key, v)}
                        allDatabases={allDatabases}
                      />
                    </td>
                  );
                }

                return (
                  <td
                    key={prop.id}
                    className={cn(
                      'border-r border-border px-2 py-1 relative',
                      prop.type === 'title' && 'font-medium',
                      isEditing && 'ring-2 ring-primary ring-inset z-20',
                    )}
                    style={{ width: colWidth(prop), maxWidth: colWidth(prop) }}
                    onClick={() => !isReadOnly && setEditingCell({ recordId: record.id, propId: prop.id })}
                    onBlur={() => setEditingCell(null)}
                  >
                    {isEditing ? (
                      <CellEditor
                        prop={prop}
                        value={val}
                        onChange={v => handleCellChange(record, prop, v)}
                        allDatabases={allDatabases}
                      />
                    ) : (
                      <div className="min-h-[1.5rem] flex items-center justify-between gap-2 overflow-hidden">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onOpenRecord(record); }}
                          className="text-left text-sm font-medium truncate"
                        >
                          {val || 'Untitled'}
                        </button>
                        {prop.type === 'title' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenRecord(record); }}
                            className="text-muted-foreground hover:text-foreground"
                            title="Open record"
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
              <td />
            </tr>
          ))}

          {/* Add record row */}
          <tr className="border-b border-border">
            <td className="border-r border-border sticky left-0 bg-background" />
            <td colSpan={visibleProps.length} className="px-2 py-1">
              <button
                onClick={() => createRecord()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onFocusNext?.({ focus: true });
                  }
                }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New record
              </button>
            </td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
