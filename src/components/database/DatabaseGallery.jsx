import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { DatabaseRecord } from '@/api/firestoreClient.js';
import { CellRenderer } from './CellRenderer.jsx';

/**
 * Gallery / card grid view.
 */
export default function DatabaseGallery({
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
    .slice(0, 4);

  const { mutate: createRecord } = useMutation({
    mutationFn: () => DatabaseRecord.create({
      database_id: databaseId,
      properties: { ...(titleProp ? { [titleProp.id]: 'Untitled' } : {}) },
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records', databaseId] }),
  });

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {records.map(record => {
          const title = titleProp ? record.properties?.[titleProp.id] : null;
          return (
            <div
              key={record.id}
              className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all flex flex-col gap-2"
              onClick={() => onOpenRecord(record)}
            >
              <p className="text-sm font-semibold truncate">{title || 'Untitled'}</p>
              {previewProps.map(prop => {
                const val = record.properties?.[prop.id];
                if (!val && val !== false) return null;
                return (
                  <div key={prop.id} className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground/60">{prop.name}</span>
                    <CellRenderer prop={prop} value={val} record={record} schema={schema} allRecords={allRecords} />
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Add card */}
        <button
          onClick={() => createRecord()}
          className="border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors min-h-[100px]"
        >
          <Plus className="w-5 h-5" />
          <span className="text-sm">New record</span>
        </button>
      </div>
    </div>
  );
}
