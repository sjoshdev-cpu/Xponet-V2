import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sheet, SheetContent, SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Trash2, X, ChevronRight, MoreHorizontal } from 'lucide-react';
import { DatabaseRecord, getDatabaseRowBody, setDatabaseRowBody } from '@/api/firestoreClient.js';
import CellEditor from './CellEditor.jsx';
import { CellRenderer } from './CellRenderer.jsx';
import BlockRenderer from '@/components/editor/BlockRenderer.jsx';
import { genId } from './db-utils.js';
import SaveRecordTemplateDialog from './SaveRecordTemplateDialog.jsx';

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
export default function RecordModal({ record, schema, database, allRecords = [], allDatabases = [], onClose, onDelete, onUpdateOption = null }) {
  const qc = useQueryClient();
  const [localProps, setLocalProps] = useState(record?.properties ?? {});
  const [bodyBlocks, setBodyBlocks] = useState([]);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);

  const { data: rowBodyData } = useQuery({
    queryKey: ['databaseRowBody', record?.database_id, record?.id],
    queryFn: () => getDatabaseRowBody(record.database_id, record.id),
    enabled: !!record?.database_id && !!record?.id,
  });

  useEffect(() => {
    setLocalProps(record?.properties ?? {});
  }, [record?.id]);

  useEffect(() => {
    if (!rowBodyData || !Array.isArray(rowBodyData.body)) {
      setBodyBlocks([]);
      return;
    }
    setBodyBlocks(rowBodyData.body);
  }, [rowBodyData]);

  const { mutate: saveRecord } = useMutation({
    mutationFn: (props) => DatabaseRecord.update(record.id, { properties: props }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['records', record?.database_id] }),
  });

  const { mutate: saveBody, isLoading: isSavingBody } = useMutation({
    mutationFn: (body) => setDatabaseRowBody(record.database_id, record.id, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['databaseRowBody', record?.database_id, record?.id] }),
  });

  const handleChange = useCallback((propId, val) => {
    setLocalProps(prev => {
      const next = { ...prev, [propId]: val };
      saveRecord(next);
      return next;
    });
  }, [saveRecord]);

  const titleProp = schema.find(p => p.type === 'title');
  const otherProps = schema.filter(p => p.id !== titleProp?.id);

  const handleBlockChange = useCallback((blockId, updates) => {
    setBodyBlocks(prev => prev.map(block => block.id === blockId ? { ...block, ...updates } : block));
  }, []);

  const handleBlockDelete = useCallback((blockId) => {
    setBodyBlocks(prev => prev.filter(block => block.id !== blockId));
  }, []);

  const handleAddAfter = useCallback((blockId) => {
    setBodyBlocks(prev => {
      const index = prev.findIndex(b => b.id === blockId);
      const next = [...prev];
      next.splice(index + 1, 0, { id: genId(), type: 'paragraph', content: '' });
      return next;
    });
  }, []);

  const handlePasteBlocks = useCallback((blockId, parsedBlocks) => {
    setBodyBlocks(prev => {
      const index = prev.findIndex(b => b.id === blockId);
      const next = [...prev];
      const items = parsedBlocks.map(block => ({ ...block, id: genId() }));
      next.splice(index + 1, 0, ...items);
      return next;
    });
  }, []);

  const saveAndClose = useCallback(() => {
    saveBody(bodyBlocks, {
      onSettled: () => onClose(),
    });
  }, [bodyBlocks, onClose, saveBody]);

  if (!record) return null;
  return (
    <Sheet open={!!record} onOpenChange={v => !v && saveAndClose()}>
      <SheetContent className="w-full max-w-full overflow-hidden p-0" side="right" showCloseButton={false}>
        <SheetTitle className="sr-only">Record details</SheetTitle>

        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-[0.2em]">{database?.name || 'Database'}</div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span className="font-medium truncate">{titleProp ? (localProps[titleProp.id] || 'Untitled') : 'Untitled record'}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground truncate">Row details</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-9 h-9">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSaveAsTemplateOpen(true)}>
                  Save as template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="w-9 h-9" onClick={() => saveAndClose()} disabled={isSavingBody}>
              <X className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 text-destructive hover:text-destructive"
              onClick={() => { onDelete(record.id); onClose(); }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid h-[calc(100vh-5.5rem)] grid-cols-[280px_minmax(0,1fr)] overflow-hidden">
          <div className="border-r border-border bg-muted/50 overflow-y-auto">
            <div className="p-6 space-y-4">
              {titleProp && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
                    Title
                  </div>
                  <Input
                    value={localProps[titleProp.id] ?? ''}
                    onChange={e => handleChange(titleProp.id, e.target.value)}
                    placeholder="Untitled"
                    className="w-full bg-background"
                  />
                </div>
              )}

              {otherProps.map(prop => {
                const isReadOnly = prop.type === 'rollup' || prop.type === 'formula';
                return (
                  <div key={prop.id} className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {prop.name}
                    </div>
                    <div className="bg-background rounded-xl border border-border p-3">
                      {isReadOnly ? (
                        <CellRenderer
                          prop={prop}
                          value={localProps[prop.id]}
                          record={{ ...record, properties: localProps }}
                          schema={schema}
                          allRecords={allRecords}
                        />
                      ) : (
                        <CellEditor
                          prop={prop}
                          value={localProps[prop.id]}
                          onChange={val => handleChange(prop.id, val)}
                          multiline={prop.type === 'text'}
                          allDatabases={allDatabases}
                          onUpdateOption={onUpdateOption
                            ? (optId, key, val) => onUpdateOption(prop.id, optId, key, val)
                            : null
                          }
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Body</div>
                <div className="text-sm text-muted-foreground">Edit row content as blocks.</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBodyBlocks(prev => [...prev, { id: genId(), type: 'paragraph', content: '' }])}
              >
                Add block
              </Button>
            </div>

            <div className="overflow-y-auto p-6 space-y-3">
              {bodyBlocks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-background/80 p-10 text-center text-muted-foreground">
                  No body content yet. Click Add block or press Enter while editing to create one.
                </div>
              ) : bodyBlocks.map(block => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  fontStyle="sans"
                  allBlocks={bodyBlocks}
                  onChange={(updated) => handleBlockChange(block.id, updated)}
                  onDelete={() => handleBlockDelete(block.id)}
                  onAddAfter={() => handleAddAfter(block.id)}
                  onPasteBlocks={(parsed) => handlePasteBlocks(block.id, parsed)}
                  onMoveUp={() => setBodyBlocks(prev => {
                    const idx = prev.findIndex(b => b.id === block.id);
                    if (idx <= 0) return prev;
                    const next = [...prev];
                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                    return next;
                  })}
                  onMoveDown={() => setBodyBlocks(prev => {
                    const idx = prev.findIndex(b => b.id === block.id);
                    if (idx < 0 || idx >= prev.length - 1) return prev;
                    const next = [...prev];
                    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                    return next;
                  })}
                  onDuplicate={() => setBodyBlocks(prev => {
                    const idx = prev.findIndex(b => b.id === block.id);
                    if (idx < 0) return prev;
                    const next = [...prev];
                    next.splice(idx + 1, 0, { ...block, id: genId() });
                    return next;
                  })}
                  onCommentClick={null}
                />
              ))}
            </div>
          </div>
        </div>
        <SaveRecordTemplateDialog
          open={saveAsTemplateOpen}
          onOpenChange={setSaveAsTemplateOpen}
          record={record}
          schema={schema}
          bodyBlocks={bodyBlocks}
          databaseId={record?.database_id}
        />
      </SheetContent>
    </Sheet>
  );
}
