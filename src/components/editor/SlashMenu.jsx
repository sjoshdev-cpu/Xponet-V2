import React, { useState, useEffect, useRef } from 'react';
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Code, Quote, Image, Minus, Zap, ToggleLeft, Columns, LayoutGrid, Table2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const BLOCK_TYPES = [
  { type: 'paragraph', label: 'Text', icon: Type, description: 'Plain paragraph text' },
  { type: 'heading1', label: 'Heading 1', icon: Heading1, description: 'Large section heading' },
  { type: 'heading2', label: 'Heading 2', icon: Heading2, description: 'Medium sub-heading' },
  { type: 'heading3', label: 'Heading 3', icon: Heading3, description: 'Small sub-heading' },
  { type: 'bullet', label: 'Bullet List', icon: List, description: 'Unordered list items' },
  { type: 'numbered', label: 'Numbered List', icon: ListOrdered, description: 'Ordered numbered list' },
  { type: 'todo', label: 'To-do List', icon: CheckSquare, description: 'Checkbox task list' },
  { type: 'code', label: 'Code Block', icon: Code, description: 'Code snippet with syntax' },
  { type: 'quote', label: 'Quote', icon: Quote, description: 'Block quote or excerpt' },
  { type: 'callout', label: 'Callout', icon: Zap, description: 'Colored box with emoji' },
  { type: 'toggle', label: 'Toggle', icon: ToggleLeft, description: 'Collapsible section' },
  { type: 'divider', label: 'Divider', icon: Minus, description: 'Horizontal separator line' },
  { type: 'image', label: 'Image', icon: Image, description: 'Upload or paste image URL' },
  { type: 'table', label: 'Table', icon: Table2, description: '3×3 table grid' },
  { type: 'columns2', label: '2 Columns', icon: Columns, description: 'Two-column layout' },
  { type: 'columns3', label: '3 Columns', icon: LayoutGrid, description: 'Three-column layout' },
];

export default function SlashMenu({ position, onSelect, onClose }) {
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const ref = useRef(null);
  const itemRefs = useRef([]);

  const filtered = BLOCK_TYPES.filter(b =>
    b.label.toLowerCase().includes(filter.toLowerCase()) ||
    b.type.includes(filter.toLowerCase()) ||
    b.description.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => { setSelectedIndex(0); }, [filter]);

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' && filtered[selectedIndex]) { e.preventDefault(); onSelect(filtered[selectedIndex].type); return; }
      if (e.key === 'Backspace' && filter === '') { onClose(); return; }
      if (e.key === 'Backspace') { setFilter(f => f.slice(0, -1)); return; }
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) { setFilter(f => f + e.key); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [filter, filtered, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-popover border border-border rounded-xl shadow-2xl w-[300px] max-h-[360px] overflow-y-auto py-1.5"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest border-b border-border mb-1">
        {filter ? <>Blocks · "<span className="text-foreground">{filter}</span>"</> : 'Block types'}
      </div>
      {filtered.map((block, i) => {
        const Icon = block.icon;
        return (
          <button
            key={block.type}
            ref={el => itemRefs.current[i] = el}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors text-left',
              i === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
            )}
            onClick={() => onSelect(block.type)}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            <div className="h-8 w-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-medium leading-tight">{block.label}</p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{block.description}</p>
            </div>
          </button>
        );
      })}
      {filtered.length === 0 && (
        <p className="px-3 py-6 text-sm text-muted-foreground text-center">No matching blocks</p>
      )}
    </div>
  );
}