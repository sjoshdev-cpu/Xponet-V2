import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DatabaseRecord } from '@/api/firestoreClient.js';
import { CellRenderer } from './CellRenderer.jsx';
import { groupRecords, genId } from './db-utils.js';
import { OPTION_COLOR_CLASSES, getOptionBadgeClasses, getOptionBadgeStyle } from './db-constants.js';

/**
 * Kanban board view — groups records by a select/status property.
 */
export default function DatabaseBoard({
  schema,
  records,
  databaseId,
  onOpenRecord,
  allRecords = [],
  allDatabases = [],
}) {
  const qc = useQueryClient();

  // Find first select/status property to group by
  const groupProp = schema.find(p => p.type === 'select' || p.type === 'status');
  const titleProp  = schema.find(p => p.type === 'title');

  const { mutate: createRecord } = useMutation({
    mutationFn: (groupValue) => DatabaseRecord.create({
      database_id: databaseId,
      properties: {
        ...(titleProp ? { [titleProp.id]: 'Untitled' } : {}),
        ...(groupProp ? { [groupProp.id]: groupValue ?? null } : {}),
      },
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records', databaseId] }),
  });

  if (!groupProp) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Add a Select or Status property to use board view.
      </div>
    );
  }

  // Build column list: all options + uncategorized
  const columns = [
    { id: '', label: 'No status', color: 'gray' },
    ...(groupProp.options ?? []),
  ];

  const grouped = groupRecords(records, groupProp.id, schema);

  return (
    <div className="flex gap-3 h-full overflow-x-auto pb-4 px-4 pt-2">
      {columns.map(col => {
        const colRecords = grouped.get(col.id) ?? [];
        return (
          <div key={col.id} className="flex-shrink-0 w-64 flex flex-col gap-2">
            {/* Column header */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                {col.id ? (
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getOptionBadgeClasses(col.color)}`}
                    style={getOptionBadgeStyle(col.color)}
                  >
                    {col.label}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">{col.label}</span>
                )}
                <span className="text-xs text-muted-foreground">{colRecords.length}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6"
                onClick={() => createRecord(col.id || null)}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2">
              {colRecords.map(record => (
                <BoardCard
                  key={record.id}
                  record={record}
                  schema={schema}
                  titleProp={titleProp}
                  groupPropId={groupProp.id}
                  allRecords={allRecords}
                  onClick={() => onOpenRecord(record)}
                />
              ))}

              {/* Add card */}
              <button
                onClick={() => createRecord(col.id || null)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg px-2 py-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add record
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BoardCard({ record, schema, titleProp, groupPropId, allRecords, onClick }) {
  const title = titleProp ? record.properties?.[titleProp.id] : null;
  // Show up to 3 non-title, non-group properties
  const previewProps = schema
    .filter(p => p.id !== titleProp?.id && p.id !== groupPropId && !['rollup','formula'].includes(p.type))
    .slice(0, 3);

  return (
    <div
      className="bg-card border border-border rounded-lg p-3 shadow-sm cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
      onClick={onClick}
    >
      <p className="text-sm font-medium truncate mb-2">{title || 'Untitled'}</p>
      {previewProps.map(prop => {
        const val = record.properties?.[prop.id];
        if (!val && val !== false) return null;
        return (
          <div key={prop.id} className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] text-muted-foreground/60 w-16 flex-shrink-0 truncate">{prop.name}</span>
            <CellRenderer prop={prop} value={val} record={record} schema={schema} allRecords={allRecords} />
          </div>
        );
      })}
    </div>
  );
}
