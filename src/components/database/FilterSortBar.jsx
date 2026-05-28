import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Filter, ArrowUpDown, Plus, X, ChevronDown } from 'lucide-react';
import { OP_LABELS, FILTER_OPS_FOR } from './db-constants.js';
import { genId } from './db-utils.js';

const FILTERABLE_TYPES = ['title','text','number','select','multi_select','status','date','checkbox','person','email','url','phone','relation'];

export default function FilterSortBar({ schema, filters, sorts, onFiltersChange, onSortsChange }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen,   setSortOpen]   = useState(false);

  const editableSchema = schema.filter(p => FILTERABLE_TYPES.includes(p.type));

  // ── Filters ────────────────────────────────────────────────────────────────
  function addFilter() {
    const prop = editableSchema[0];
    if (!prop) return;
    const ops = FILTER_OPS_FOR[prop.type] ?? ['equals'];
    onFiltersChange([...filters, { id: genId(), property: prop.id, op: ops[0], value: '' }]);
  }
  function updateFilter(id, key, val) {
    onFiltersChange(filters.map(f => f.id === id ? { ...f, [key]: val } : f));
  }
  function removeFilter(id) {
    onFiltersChange(filters.filter(f => f.id !== id));
  }

  // ── Sorts ──────────────────────────────────────────────────────────────────
  function addSort() {
    const prop = editableSchema[0];
    if (!prop) return;
    onSortsChange([...sorts, { id: genId(), property: prop.id, dir: 'asc' }]);
  }
  function updateSort(id, key, val) {
    onSortsChange(sorts.map(s => s.id === id ? { ...s, [key]: val } : s));
  }
  function removeSort(id) {
    onSortsChange(sorts.filter(s => s.id !== id));
  }

  const activeFilters = filters.length;
  const activeSorts   = sorts.length;

  return (
    <div className="flex items-center gap-2">
      {/* Filter button */}
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button variant={activeFilters ? 'secondary' : 'ghost'} size="sm" className="gap-1.5 h-7 text-xs">
            <Filter className="w-3 h-3" />
            Filter
            {activeFilters > 0 && (
              <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                {activeFilters}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[480px] p-3 space-y-2" align="start">
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Filters</div>
          {filters.length === 0 && (
            <p className="text-xs text-muted-foreground">No filters applied.</p>
          )}
          {filters.map(f => {
            const prop = schema.find(p => p.id === f.property);
            const ops  = prop ? (FILTER_OPS_FOR[prop.type] ?? []) : [];
            const needsValue = !['is_empty','is_not_empty','is_checked','is_not_checked'].includes(f.op);
            return (
              <div key={f.id} className="flex items-center gap-2">
                {/* Property picker */}
                <Select value={f.property} onValueChange={val => updateFilter(f.id, 'property', val)}>
                  <SelectTrigger className="h-7 text-xs w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {editableSchema.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {/* Op picker */}
                <Select value={f.op} onValueChange={val => updateFilter(f.id, 'op', val)}>
                  <SelectTrigger className="h-7 text-xs w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ops.map(op => <SelectItem key={op} value={op}>{OP_LABELS[op] ?? op}</SelectItem>)}
                  </SelectContent>
                </Select>
                {/* Value */}
                {needsValue && (
                  prop?.type === 'select' || prop?.type === 'status' || prop?.type === 'multi_select' ? (
                    <Select value={f.value} onValueChange={val => updateFilter(f.id, 'value', val)}>
                      <SelectTrigger className="h-7 text-xs w-28">
                        <SelectValue placeholder="value" />
                      </SelectTrigger>
                      <SelectContent>
                        {(prop?.options ?? []).map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={f.value}
                      onChange={e => updateFilter(f.id, 'value', e.target.value)}
                      className="h-7 text-xs w-28"
                      placeholder="value"
                    />
                  )
                )}
                <button onClick={() => removeFilter(f.id)} className="text-muted-foreground hover:text-destructive ml-auto">
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          <Button variant="ghost" size="sm" onClick={addFilter} className="gap-1 text-xs h-7">
            <Plus className="w-3 h-3" /> Add filter
          </Button>
        </PopoverContent>
      </Popover>

      {/* Sort button */}
      <Popover open={sortOpen} onOpenChange={setSortOpen}>
        <PopoverTrigger asChild>
          <Button variant={activeSorts ? 'secondary' : 'ghost'} size="sm" className="gap-1.5 h-7 text-xs">
            <ArrowUpDown className="w-3 h-3" />
            Sort
            {activeSorts > 0 && (
              <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                {activeSorts}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 space-y-2" align="start">
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Sorts</div>
          {sorts.length === 0 && <p className="text-xs text-muted-foreground">No sorts applied.</p>}
          {sorts.map(s => (
            <div key={s.id} className="flex items-center gap-2">
              <Select value={s.property} onValueChange={val => updateSort(s.id, 'property', val)}>
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {editableSchema.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={s.dir} onValueChange={val => updateSort(s.id, 'dir', val)}>
                <SelectTrigger className="h-7 text-xs w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
              <button onClick={() => removeSort(s.id)} className="text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addSort} className="gap-1 text-xs h-7">
            <Plus className="w-3 h-3" /> Add sort
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
