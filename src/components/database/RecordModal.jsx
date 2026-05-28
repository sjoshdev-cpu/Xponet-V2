import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet, SheetContent, SheetHeader,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Trash2, ExternalLink, X } from 'lucide-react';
import { DatabaseRecord } from '@/api/firestoreClient.js';
import CellEditor from './CellEditor.jsx';
import { CellRenderer } from './CellRenderer.jsx';
import { computeRollup, evaluateFormula } from './db-utils.js';
import { PROPERTY_TYPES } from './db-constants.js';

/**
 * Side-peek modal for viewing / editing a single record.
 * Props:
 *   record        — the record object
 *   schema        — array of property definitions
 *   allRecords    — all records (for rollup / relation)
 *   allDatabases  — all databases (for relation editor)
 *   onClose       — close handler
 *   onDelete      — delete handler
 */
export default function RecordModal({ record, schema, allRecords = [], allDatabases = [], onClose, onDelete }) {
  const qc = useQueryClient();
  const [localProps, setLocalProps] = useState(record?.properties ?? {});

  const { mutate: saveRecord } = useMutation({
    mutationFn: (props) => DatabaseRecord.update(record.id, { properties: props }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records', record?.database_id] }),
  });

  const handleChange = useCallback((propId, val) => {
    setLocalProps(prev => {
      const next = { ...prev, [propId]: val };
      saveRecord(next);
      return next;
    });
  }, [saveRecord]);

  if (!record) return null;
  const titleProp = schema.find(p => p.type === 'title');
  const otherProps = schema.filter(p => p.id !== titleProp?.id);

  return (
    <Sheet open={!!record} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto p-0 flex flex-col" side="right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-destructive hover:text-destructive"
              onClick={() => { onDelete(record.id); onClose(); }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Title */}
        {titleProp && (
          <div className="px-6 py-2">
            <input
              value={localProps[titleProp.id] ?? ''}
              onChange={e => handleChange(titleProp.id, e.target.value)}
              className="w-full text-2xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/40 resize-none"
              placeholder="Untitled"
            />
          </div>
        )}

        <Separator />

        {/* Properties */}
        <div className="px-6 py-4 space-y-3 flex-1 overflow-y-auto">
          {otherProps.map(prop => {
            const isReadOnly = prop.type === 'rollup' || prop.type === 'formula';
            return (
              <div key={prop.id} className="flex items-start gap-3 min-h-[2rem]">
                <div className="w-36 flex-shrink-0 text-xs font-medium text-muted-foreground pt-1.5 truncate">
                  {prop.name}
                </div>
                <div className="flex-1">
                  {isReadOnly ? (
                    <div className="pt-1">
                      <CellRenderer
                        prop={prop}
                        value={localProps[prop.id]}
                        record={{ ...record, properties: localProps }}
                        schema={schema}
                        allRecords={allRecords}
                      />
                    </div>
                  ) : (
                    <CellEditor
                      prop={prop}
                      value={localProps[prop.id]}
                      onChange={val => handleChange(prop.id, val)}
                      multiline={prop.type === 'text'}
                      allDatabases={allDatabases}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
