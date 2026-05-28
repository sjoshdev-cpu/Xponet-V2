import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { OPTION_COLOR_CLASSES } from './db-constants.js';
import { DatabaseRecord } from '@/api/firestoreClient.js';
import { Check, X } from 'lucide-react';

/**
 * Inline cell editor rendered inside the table or record modal.
 * Calls onChange(newValue) when the value changes.
 *
 * For textarea variant (multiline), pass multiline={true}.
 */
export default function CellEditor({ prop, value, onChange, multiline = false, allDatabases = [] }) {
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
      return <SelectEditor prop={prop} value={value} onChange={onChange} />;

    case 'multi_select':
      return <MultiSelectEditor prop={prop} value={value} onChange={onChange} />;

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

function SelectEditor({ prop, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selectedOpt = (prop.options ?? []).find(o => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center gap-1 text-sm">
          {selectedOpt ? (
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${OPTION_COLOR_CLASSES[selectedOpt.color] ?? OPTION_COLOR_CLASSES.gray}`}>
              {selectedOpt.label}
            </span>
          ) : (
            <span className="text-muted-foreground/50 text-sm">—</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <button
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover:bg-accent"
          onClick={() => { onChange(null); setOpen(false); }}
        >
          <X className="w-3 h-3 text-muted-foreground" /> None
        </button>
        {(prop.options ?? []).map(opt => (
          <button
            key={opt.id}
            className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-accent"
            onClick={() => { onChange(opt.id); setOpen(false); }}
          >
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${OPTION_COLOR_CLASSES[opt.color] ?? OPTION_COLOR_CLASSES.gray}`}>
              {opt.label}
            </span>
            {value === opt.id && <Check className="w-3 h-3" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function MultiSelectEditor({ prop, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = Array.isArray(value) ? value : [];

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
          {selected.length === 0 && <span className="text-muted-foreground/50 text-sm">—</span>}
          {selected.map(id => {
            const opt = (prop.options ?? []).find(o => o.id === id);
            if (!opt) return null;
            return (
              <span key={id} className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${OPTION_COLOR_CLASSES[opt.color] ?? OPTION_COLOR_CLASSES.gray}`}>
                {opt.label}
              </span>
            );
          })}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        {(prop.options ?? []).map(opt => (
          <button
            key={opt.id}
            className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-accent"
            onClick={() => toggle(opt.id)}
          >
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${OPTION_COLOR_CLASSES[opt.color] ?? OPTION_COLOR_CLASSES.gray}`}>
              {opt.label}
            </span>
            {selected.includes(opt.id) && <Check className="w-3 h-3" />}
          </button>
        ))}
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
