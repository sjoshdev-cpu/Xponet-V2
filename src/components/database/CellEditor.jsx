import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { OPTION_COLOR_CLASSES, OPTION_COLORS, OPTION_COLORS_HEX, COLOR_PALETTE, colorHex, getOptionBadgeClasses, getOptionBadgeStyle } from './db-constants.js';
import { genId } from './db-utils.js';
import { DatabaseRecord } from '@/api/firestoreClient.js';
import { Check, X, Plus } from 'lucide-react';

/**
 * Inline cell editor rendered inside the table or record modal.
 * Calls onChange(newValue) when the value changes.
 *
 * For textarea variant (multiline), pass multiline={true}.
 */
export default function CellEditor({ prop, value, onChange, multiline = false, allDatabases = [], onAddOption = null, onUpdateOption = null, onClose = null }) {
  if (!prop) return null;

  switch (prop.type) {
    case 'title':
    case 'text':
    case 'email':
    case 'url':
    case 'phone':
      return multiline ? (
        <Textarea
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          className="min-h-[60px] text-sm resize-none"
        />
      ) : (
        <Input
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          className="h-7 text-sm px-1 border-none shadow-none focus-visible:ring-0 bg-transparent w-full"
        />
      );

    case 'number':
      return (
        <Input
          type="number"
          value={value ?? ''}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          className="h-7 text-sm px-1 border-none shadow-none focus-visible:ring-0 bg-transparent w-full font-mono"
        />
      );

    case 'checkbox':
      return (
        <Checkbox
          checked={!!value}
          onCheckedChange={checked => onChange(checked)}
          className="mx-auto"
        />
      );

    case 'date':
      return (
        <Input
          type="date"
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          className="h-7 text-sm px-1 border-none shadow-none focus-visible:ring-0 bg-transparent w-full"
        />
      );

    case 'select':
    case 'status':
      return <SelectEditor prop={prop} value={value} onChange={onChange} onAddOption={onAddOption} onUpdateOption={onUpdateOption} onClose={onClose} />;

    case 'multi_select':
      return <MultiSelectEditor prop={prop} value={value} onChange={onChange} onAddOption={onAddOption} onUpdateOption={onUpdateOption} onClose={onClose} />;

    case 'person':
      return (
        <Input
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Email or name..."
          className="h-7 text-sm px-1 border-none shadow-none focus-visible:ring-0 bg-transparent w-full"
        />
      );

    case 'relation':
      return <RelationEditor prop={prop} value={value} onChange={onChange} allDatabases={allDatabases} />;

    case 'rollup':
    case 'formula':
      // Read-only — computed
      return <span className="text-sm text-muted-foreground italic">Computed</span>;

    default:
      return (
        <Input
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          className="h-7 text-sm px-1 border-none shadow-none focus-visible:ring-0 bg-transparent w-full"
        />
      );
  }
}

function SelectEditor({ prop, value, onChange, onAddOption, onUpdateOption, onClose }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newOptName, setNewOptName] = useState('');
  const [openColorId, setOpenColorId] = useState(null);
  const searchRef = useRef(null);

  const options = prop.options ?? [];
  const selectedOpt = options.find(o => o.id === value);
  const filtered = search
    ? options.filter(o => (o.name ?? o.label ?? '').toLowerCase().includes(search.toLowerCase()))
    : options;

  function closePopover() {
    setOpen(false);
    setSearch('');
    setAddingNew(false);
    setNewOptName('');
  }

  function handleSelect(optId) {
    onChange(optId);
    closePopover();
    onClose?.();
  }

  function handleClear() {
    onChange(null);
    closePopover();
    onClose?.();
  }

  function handleCreateOption() {
    const name = newOptName.trim();
    if (!name || !onAddOption) return;
    const nextColor = OPTION_COLORS_HEX[options.length % OPTION_COLORS_HEX.length];
    const newOpt = { id: genId(), name, color: nextColor };
    onAddOption(newOpt);
    onChange(newOpt.id);
    closePopover();
    onClose?.();
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) { setSearch(''); setAddingNew(false); setNewOptName(''); }
      }}
    >
      <PopoverTrigger asChild>
        <button className="w-full flex items-center gap-1 text-sm h-full min-h-[1.5rem] text-left">
          {selectedOpt ? (
            <span
              className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getOptionBadgeClasses(selectedOpt.color)}`}
              style={getOptionBadgeStyle(selectedOpt.color)}
            >
              {selectedOpt.name ?? selectedOpt.label}
            </span>
          ) : (
            <span className="text-muted-foreground/50 text-sm">—</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-1.5"
        align="start"
        onOpenAutoFocus={e => { e.preventDefault(); searchRef.current?.focus(); }}
      >
        {/* Search */}
        <div className="pb-1 mb-0.5">
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search for an option..."
            className="w-full h-7 px-2 text-xs rounded border border-input bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Clear */}
        <button
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs text-muted-foreground hover:bg-accent"
          onClick={handleClear}
        >
          <X className="w-3 h-3" /> None
        </button>

        {/* Options list */}
        <div className="max-h-48 overflow-y-auto">
          {filtered.map(opt => {
            const isSelected = value === opt.id;
            return (
              <div
                key={opt.id}
                className={`flex items-center w-full rounded hover:bg-accent text-sm ${isSelected ? 'bg-accent/60' : ''}`}
              >
                {/* Color dot — opens 12-swatch palette when onUpdateOption is wired */}
                {onUpdateOption ? (
                  <Popover
                    open={openColorId === opt.id}
                    onOpenChange={v => setOpenColorId(v ? opt.id : null)}
                  >
                    <PopoverTrigger asChild>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Change color for ${opt.name ?? opt.label}`}
                        className="ml-2 w-3 h-3 rounded-full flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-ring hover:ring-offset-1 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                        style={{ backgroundColor: colorHex(opt.color) }}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2.5" align="start" side="right">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Color</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {COLOR_PALETTE.map(c => (
                          <button
                            key={c.key}
                            type="button"
                            title={c.label}
                            onClick={() => { onUpdateOption(opt.id, 'color', c.key); setOpenColorId(null); }}
                            className={`w-5 h-5 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${opt.color === c.key ? 'ring-2 ring-ring ring-offset-1' : ''}`}
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span
                    className="ml-2 w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: colorHex(opt.color) }}
                  />
                )}
                {/* Label — clicking selects this option */}
                <button
                  className="flex-1 flex items-center justify-between px-2 py-1.5 min-w-0"
                  onClick={() => handleSelect(opt.id)}
                >
                  <span className="truncate">{opt.name ?? opt.label}</span>
                  {isSelected && <Check className="w-3 h-3 flex-shrink-0 text-primary ml-1" />}
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-2">
              {search ? `No options match "${search}"` : 'No options defined'}
            </p>
          )}
        </div>

        {/* Add option */}
        {onAddOption && (
          <div className="border-t border-border mt-1 pt-1">
            {addingNew ? (
              <div className="flex items-center gap-1 px-1">
                <input
                  autoFocus
                  value={newOptName}
                  onChange={e => setNewOptName(e.target.value)}
                  placeholder="Option name..."
                  className="flex-1 h-7 px-2 text-xs rounded border border-input bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleCreateOption(); }
                    if (e.key === 'Escape') { setAddingNew(false); setNewOptName(''); }
                  }}
                />
                <button
                  className="shrink-0 px-2 py-1 text-xs text-primary hover:text-primary/80 font-medium"
                  onClick={handleCreateOption}
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setAddingNew(true)}
              >
                <Plus className="w-3 h-3" /> Add option
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function MultiSelectEditor({ prop, value, onChange, onAddOption, onUpdateOption }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newOptName, setNewOptName] = useState('');
  const [openColorId, setOpenColorId] = useState(null);
  const searchRef = useRef(null);

  const options = prop.options ?? [];
  const selected = Array.isArray(value) ? value : [];
  const filtered = search
    ? options.filter(o => (o.name ?? o.label ?? '').toLowerCase().includes(search.toLowerCase()))
    : options;

  function toggle(id) {
    if (selected.includes(id)) {
      onChange(selected.filter(v => v !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function handleCreateOption() {
    const name = newOptName.trim();
    if (!name || !onAddOption) return;
    const nextColor = OPTION_COLORS_HEX[options.length % OPTION_COLORS_HEX.length];
    const newOpt = { id: genId(), name, color: nextColor };
    onAddOption(newOpt);
    onChange([...selected, newOpt.id]);
    setNewOptName('');
    setAddingNew(false);
    setSearch('');
    // Keep popover open so user can add/toggle more options
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) { setSearch(''); setAddingNew(false); setNewOptName(''); }
      }}
    >
      <PopoverTrigger asChild>
        <button className="w-full flex flex-wrap items-center gap-1 text-sm min-h-[1.5rem] text-left">
          {selected.length === 0
            ? <span className="text-muted-foreground/50">—</span>
            : selected.map(id => {
                const opt = options.find(o => o.id === id);
                if (!opt) return null;
                return (
                  <span
                    key={id}
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getOptionBadgeClasses(opt.color)}`}
                    style={getOptionBadgeStyle(opt.color)}
                  >
                    {opt.name ?? opt.label}
                  </span>
                );
              })
          }
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-1.5"
        align="start"
        onOpenAutoFocus={e => { e.preventDefault(); searchRef.current?.focus(); }}
      >
        {/* Search */}
        <div className="pb-1 mb-0.5">
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search for an option..."
            className="w-full h-7 px-2 text-xs rounded border border-input bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Options list */}
        <div className="max-h-48 overflow-y-auto">
          {filtered.map(opt => {
            const isSelected = selected.includes(opt.id);
            return (
              <div
                key={opt.id}
                className={`flex items-center w-full rounded hover:bg-accent text-sm ${isSelected ? 'bg-accent/60' : ''}`}
              >
                {/* Color dot — opens 12-swatch palette when onUpdateOption is wired */}
                {onUpdateOption ? (
                  <Popover
                    open={openColorId === opt.id}
                    onOpenChange={v => setOpenColorId(v ? opt.id : null)}
                  >
                    <PopoverTrigger asChild>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Change color for ${opt.name ?? opt.label}`}
                        className="ml-2 w-3 h-3 rounded-full flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-ring hover:ring-offset-1 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                        style={{ backgroundColor: colorHex(opt.color) }}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2.5" align="start" side="right">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Color</p>
                      <div className="grid grid-cols-4 gap-1.5">
                        {COLOR_PALETTE.map(c => (
                          <button
                            key={c.key}
                            type="button"
                            title={c.label}
                            onClick={() => { onUpdateOption(opt.id, 'color', c.key); setOpenColorId(null); }}
                            className={`w-5 h-5 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${opt.color === c.key ? 'ring-2 ring-ring ring-offset-1' : ''}`}
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span
                    className="ml-2 w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: colorHex(opt.color) }}
                  />
                )}
                {/* Label — clicking toggles this option */}
                <button
                  className="flex-1 flex items-center justify-between px-2 py-1.5 min-w-0"
                  onClick={() => toggle(opt.id)}
                >
                  <span className="truncate">{opt.name ?? opt.label}</span>
                  {isSelected && <Check className="w-3 h-3 flex-shrink-0 text-primary ml-1" />}
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-2">
              {search ? `No options match "${search}"` : 'No options defined'}
            </p>
          )}
        </div>

        {/* Add option */}
        {onAddOption && (
          <div className="border-t border-border mt-1 pt-1">
            {addingNew ? (
              <div className="flex items-center gap-1 px-1">
                <input
                  autoFocus
                  value={newOptName}
                  onChange={e => setNewOptName(e.target.value)}
                  placeholder="Option name..."
                  className="flex-1 h-7 px-2 text-xs rounded border border-input bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleCreateOption(); }
                    if (e.key === 'Escape') { setAddingNew(false); setNewOptName(''); }
                  }}
                />
                <button
                  className="shrink-0 px-2 py-1 text-xs text-primary hover:text-primary/80 font-medium"
                  onClick={handleCreateOption}
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setAddingNew(true)}
              >
                <Plus className="w-3 h-3" /> Add option
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function RelationEditor({ prop, value, onChange, allDatabases }) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const selected = Array.isArray(value) ? value : [];
  const targetDb = allDatabases.find(d => d.id === prop.relation_database);
  const titleProp = targetDb?.schema?.find(p => p.type === 'title');

  const { data: relRecords = [] } = useQuery({
    queryKey: ['records', prop.relation_database],
    queryFn: () => DatabaseRecord.filter({ database_id: prop.relation_database }),
    enabled: !!prop.relation_database && open,
  });

  const filtered = search
    ? relRecords.filter(r => {
        const title = titleProp ? r.properties?.[titleProp.id] : r.id;
        return String(title ?? '').toLowerCase().includes(search.toLowerCase());
      })
    : relRecords;

  function toggle(id) {
    if (selected.includes(id)) {
      onChange(selected.filter(v => v !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex flex-wrap items-center gap-1 text-sm min-h-[1.75rem]">
          {selected.length === 0 && <span className="text-muted-foreground/50 text-sm">No relations</span>}
          {selected.map(id => {
            const rec = relRecords.find(r => r.id === id);
            const title = titleProp && rec ? rec.properties?.[titleProp.id] : id;
            return (
              <span key={id} className="inline-flex px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs font-medium">
                {title || id}
              </span>
            );
          })}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 space-y-1" align="start">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${targetDb?.name ?? 'records'}...`}
          className="h-7 text-xs"
        />
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {filtered.map(rec => {
            const title = titleProp ? rec.properties?.[titleProp.id] : rec.id;
            return (
              <button
                key={rec.id}
                className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-accent text-sm"
                onClick={() => toggle(rec.id)}
              >
                <span className="truncate">{title || '—'}</span>
                {selected.includes(rec.id) && <Check className="w-3 h-3 flex-shrink-0" />}
              </button>
            );
          })}
          {filtered.length === 0 && <p className="text-xs text-center text-muted-foreground py-2">No records found</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
