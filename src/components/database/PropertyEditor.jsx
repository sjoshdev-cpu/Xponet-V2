import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, GripVertical, X } from 'lucide-react';
import {
  PROPERTY_TYPES,
  OPTION_COLORS,
  OPTION_COLOR_CLASSES,
  OPTION_COLORS_HEX,
  ROLLUP_FUNS,
  colorHex,
} from './db-constants.js';
import { genId } from './db-utils.js';
import { DatabaseRecord } from '@/api/firestoreClient.js';

/**
 * Dialog for adding or editing a database property (schema column).
 * Props:
 *   open, onClose, property (null = new), schema, onSave, onDelete, databases
 */
export default function PropertyEditor({ open, onClose, property, schema, onSave, onDelete, databases = [] }) {
  const isNew = !property?.id || property.id === '__new__';

  const [name, setName] = useState(property?.name ?? '');
  const [type, setType] = useState(property?.type ?? 'text');
  const [options, setOptions] = useState(property?.options ?? []);
  // relation
  const [relDb, setRelDb]     = useState(property?.relation_database ?? '');
  // rollup
  const [rollupRel, setRollupRel]   = useState(property?.relation_property ?? '');
  const [rollupProp, setRollupProp] = useState(property?.rollup_property ?? '');
  const [rollupFn,   setRollupFn]   = useState(property?.rollup_fn ?? 'count');
  // formula
  const [formula, setFormula] = useState(property?.formula ?? '');

  // When editing existing, reset state if property changes
  const isEditing = !isNew;
  const titleProp = schema?.find(p => p.type === 'title');

  // Find relation props in current schema
  const relationProps = schema?.filter(p => p.type === 'relation') ?? [];

  // Find props from target rollup relation database
  const rollupRelProp = schema?.find(p => p.id === rollupRel && p.type === 'relation');
  const targetDbId = rollupRelProp?.relation_database;
  const { data: targetDbRecords } = useQuery({
    queryKey: ['records', targetDbId],
    queryFn: () => DatabaseRecord.filter({ database_id: targetDbId }),
    enabled: !!targetDbId,
  });
  // The schema of the target DB (we fetch a single record to peek at properties)
  // Better to get the databases data here
  const targetDb = databases.find(d => d.id === targetDbId);
  const targetSchema = targetDb?.schema ?? [];

  // Options management
  function addOption() {
    setOptions(prev => [...prev, { id: genId(), label: 'Option', color: OPTION_COLORS_HEX[prev.length % OPTION_COLORS_HEX.length] }]);
  }
  function updateOption(id, key, val) {
    setOptions(prev => prev.map(o => o.id === id ? { ...o, [key]: val } : o));
  }
  function removeOption(id) {
    setOptions(prev => prev.filter(o => o.id !== id));
  }

  function handleSave() {
    if (!name.trim()) return;
    const base = { name: name.trim(), type };
    if (type === 'select' || type === 'multi_select' || type === 'status') base.options = options;
    if (type === 'relation') base.relation_database = relDb;
    if (type === 'rollup') {
      base.relation_property = rollupRel;
      base.rollup_property   = rollupProp;
      base.rollup_fn         = rollupFn;
    }
    if (type === 'formula') base.formula = formula;
    onSave({ ...(isNew ? { id: genId() } : { id: property.id }), ...base });
    onClose();
  }

  const showOptions  = ['select', 'multi_select', 'status'].includes(type);
  const showRelation = type === 'relation';
  const showRollup   = type === 'rollup';
  const showFormula  = type === 'formula';

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add property' : 'Edit property'}</DialogTitle>
          <DialogDescription className="sr-only">Configure the property name, type, and options.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Property name</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Property name"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Type */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase">Type</label>
            <Select
              value={type}
              onValueChange={v => { setType(v); setOptions([]); }}
              disabled={isEditing && property?.type === 'title'}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROPERTY_TYPES)
                  .filter(([k]) => k !== 'title' || (isEditing && property?.type === 'title'))
                  .map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>

          {/* Options for select / status */}
          {showOptions && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase">Options</label>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {options.map(opt => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    {/* Color picker */}
                    <Select value={opt.color} onValueChange={v => updateOption(opt.id, 'color', v)}>
                      <SelectTrigger className="w-8 h-7 p-0 border-none shadow-none flex-shrink-0">
                        <div className="w-4 h-4 rounded-full mx-auto" style={{ backgroundColor: colorHex(opt.color) }} />
                      </SelectTrigger>
                      <SelectContent>
                        {OPTION_COLORS.map(c => (
                          <SelectItem key={c} value={c}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${OPTION_COLOR_CLASSES[c]?.split(' ')[0]}`} />
                              {c}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={opt.label}
                      onChange={e => updateOption(opt.id, 'label', e.target.value)}
                      className="h-7 flex-1 text-sm"
                    />
                    <button onClick={() => removeOption(opt.id)} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={addOption} className="gap-1">
                <Plus className="w-3 h-3" /> Add option
              </Button>
            </div>
          )}

          {/* Relation */}
          {showRelation && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase">Target database</label>
              <Select value={relDb} onValueChange={setRelDb}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select database..." />
                </SelectTrigger>
                <SelectContent>
                  {databases.filter(db => db?.id).map(db => (
                    <SelectItem key={db.id} value={db.id}>{db.icon ?? '📋'} {db.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Rollup */}
          {showRollup && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase">Relation property</label>
                <Select value={rollupRel} onValueChange={setRollupRel}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select relation..." />
                  </SelectTrigger>
                  <SelectContent>
                    {relationProps.filter(p => p?.id).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase">Target property</label>
                <Select value={rollupProp} onValueChange={setRollupProp} disabled={!targetSchema.length}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {targetSchema.filter(p => !['rollup','formula'].includes(p.type) && p?.id).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase">Function</label>
                <Select value={rollupFn} onValueChange={setRollupFn}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLLUP_FUNS.map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Formula */}
          {showFormula && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase">Formula</label>
              <Input
                value={formula}
                onChange={e => setFormula(e.target.value)}
                placeholder='concat({Name}, " - ", {Status})'
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">{'{Property Name}'}</code> to reference fields. Functions: concat(), if(), now(), dateDiff().
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div>
            {!isNew && property?.type !== 'title' && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1" onClick={() => { onDelete(property.id); onClose(); }}>
                <Trash2 className="w-4 h-4" /> Delete property
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
              {isNew ? 'Add' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
