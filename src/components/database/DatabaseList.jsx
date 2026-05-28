import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Settings2 } from 'lucide-react';
import { DatabaseRecord } from '@/api/firestoreClient.js';
import { CellRenderer } from './CellRenderer.jsx';

/**
 * Compact list view.
 */
export default function DatabaseList({
  schema,
  records,
  databaseId,
  onOpenRecord,
  allRecords = [],
}) {
  const qc = useQueryClient();
  const titleProp = schema.find(p => p.type === 'title');
  const previewProps = schema
    .filter(p => p.id !== titleProp?.id && !['rollup','formula'].includes(p.type))
    .slice(0, 3);

  const { mutate: createRecord } = useMutation({
    mutationFn: () => DatabaseRecord.create({
      database_id: databaseId,
      properties: { ...(titleProp ? { [titleProp.id]: 'Untitled' } : {}) },
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records', databaseId] }),
  });

  return (
    <div className="divide-y divide-border">
      {records.map(record => {
        const title = titleProp ? record.properties?.[titleProp.id] : null;
        return (
          <div
            key={record.id}
            className="flex items-center gap-4 px-4 py-2 hover:bg-muted/30 cursor-pointer group"
            onClick={() => onOpenRecord(record)}
          >
            <button
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
              onClick={e => { e.stopPropagation(); onOpenRecord(record); }}
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
            <span className="flex-1 text-sm font-medium truncate">{title || 'Untitled'}</span>
            {previewProps.map(prop => {
              const val = record.properties?.[prop.id];
              return (
                <div key={prop.id} className="flex items-center gap-1 text-muted-foreground">
                  <span className="text-xs hidden sm:block">{prop.name}:</span>
                  <CellRenderer prop={prop} value={val} record={record} schema={schema} allRecords={allRecords} />
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Add record */}
      <button
        onClick={() => createRecord()}
        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
      >
        <Plus className="w-4 h-4" />
        New record
      </button>
    </div>
  );
}
