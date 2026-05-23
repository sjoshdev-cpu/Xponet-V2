import React, { useState, useRef, useEffect } from 'react';
import { GripVertical, ChevronRight, ChevronDown, Trash2, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const CALLOUT_COLORS = {
  blue: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800',
  red: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
  green: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
  purple: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800',
  gray: 'bg-muted border-border',
};

function EditableText({ value, onChange, placeholder, className, tag: Tag = 'div' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value || '';
    }
  }, []);

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={cn('outline-none', className)}
      data-placeholder={placeholder}
      onInput={(e) => onChange(e.currentTarget.innerText)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && Tag !== 'div') {
          e.preventDefault();
        }
      }}
    />
  );
}

export default function BlockRenderer({ block, onChange, onDelete, onAddAfter, onKeyDown, fontStyle }) {
  const [toggleOpen, setToggleOpen] = useState(false);

  const fontClass = fontStyle === 'serif' ? 'font-serif' : fontStyle === 'mono' ? 'font-mono' : 'font-sans';

  const updateContent = (content) => onChange({ ...block, content });

  const renderBlock = () => {
    switch (block.type) {
      case 'heading1':
        return (
          <EditableText
            value={block.content}
            onChange={updateContent}
            placeholder="Heading 1"
            className={cn('text-3xl font-bold tracking-tight', fontClass, !block.content && 'empty-placeholder')}
          />
        );
      case 'heading2':
        return (
          <EditableText
            value={block.content}
            onChange={updateContent}
            placeholder="Heading 2"
            className={cn('text-2xl font-semibold tracking-tight', fontClass, !block.content && 'empty-placeholder')}
          />
        );
      case 'heading3':
        return (
          <EditableText
            value={block.content}
            onChange={updateContent}
            placeholder="Heading 3"
            className={cn('text-xl font-semibold', fontClass, !block.content && 'empty-placeholder')}
          />
        );
      case 'bullet':
        return (
          <div className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />
            <EditableText
              value={block.content}
              onChange={updateContent}
              placeholder="List item"
              className={cn('flex-1', fontClass, !block.content && 'empty-placeholder')}
            />
          </div>
        );
      case 'numbered':
        return (
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground shrink-0 mt-0.5 min-w-[1.5em] text-right">{block.number || '1'}.</span>
            <EditableText
              value={block.content}
              onChange={updateContent}
              placeholder="List item"
              className={cn('flex-1', fontClass, !block.content && 'empty-placeholder')}
            />
          </div>
        );
      case 'todo':
        return (
          <div className="flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={block.checked || false}
              onChange={(e) => onChange({ ...block, checked: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-border accent-primary cursor-pointer"
            />
            <EditableText
              value={block.content}
              onChange={updateContent}
              placeholder="To-do"
              className={cn('flex-1', fontClass, block.checked && 'line-through text-muted-foreground', !block.content && 'empty-placeholder')}
            />
          </div>
        );
      case 'code':
        return (
          <div className="bg-muted rounded-lg p-4 font-mono text-sm border border-border">
            <EditableText
              value={block.content}
              onChange={updateContent}
              placeholder="// Code"
              className="outline-none whitespace-pre-wrap"
              tag="div"
            />
          </div>
        );
      case 'quote':
        return (
          <div className="border-l-[3px] border-foreground/20 pl-4 py-0.5">
            <EditableText
              value={block.content}
              onChange={updateContent}
              placeholder="Quote"
              className={cn('text-muted-foreground italic', fontClass, !block.content && 'empty-placeholder')}
            />
          </div>
        );
      case 'callout':
        return (
          <div className={cn('flex gap-3 p-4 rounded-lg border', CALLOUT_COLORS[block.color || 'blue'])}>
            <span className="text-xl shrink-0">{block.emoji || '💡'}</span>
            <EditableText
              value={block.content}
              onChange={updateContent}
              placeholder="Type something..."
              className={cn('flex-1', fontClass, !block.content && 'empty-placeholder')}
            />
          </div>
        );
      case 'toggle':
        return (
          <div>
            <button
              onClick={() => setToggleOpen(!toggleOpen)}
              className="flex items-center gap-1.5 font-medium hover:bg-accent/50 rounded px-1 py-0.5 -ml-1 transition-colors"
            >
              {toggleOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <EditableText
                value={block.content}
                onChange={updateContent}
                placeholder="Toggle"
                className={cn(fontClass, !block.content && 'empty-placeholder')}
              />
            </button>
            {toggleOpen && (
              <div className="ml-6 mt-1 pl-3 border-l-2 border-border">
                {(block.children || []).map((child, i) => (
                  <p key={i} className="text-muted-foreground text-sm py-0.5">{child.content}</p>
                ))}
                {(!block.children || block.children.length === 0) && (
                  <p className="text-muted-foreground text-sm py-0.5 italic">Empty toggle. Click to edit.</p>
                )}
              </div>
            )}
          </div>
        );
      case 'divider':
        return <hr className="border-border my-1" />;
      case 'image':
        return block.url ? (
          <div className="rounded-lg overflow-hidden">
            <img src={block.url} alt={block.caption || ''} className="max-w-full rounded-lg" />
            {block.caption && <p className="text-sm text-muted-foreground text-center mt-2">{block.caption}</p>}
          </div>
        ) : (
          <div className="border-2 border-dashed border-border rounded-lg p-4 flex gap-2">
            <input
              placeholder="Paste image URL and press Enter..."
              className="flex-1 text-sm bg-transparent outline-none text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onChange({ ...block, url: e.target.value });
              }}
            />
          </div>
        );
      case 'table': {
        const rows = block.rows || [['', '', ''], ['', '', ''], ['', '', '']];
        return (
          <div className="overflow-x-auto my-1">
            <table className="w-full border-collapse border border-border text-sm">
              {rows.map((row, ri) => (
                <tr key={ri} className={ri === 0 ? 'bg-muted/50 font-medium' : ''}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-border px-3 py-1.5 min-w-[100px]">
                      <EditableText
                        value={cell}
                        onChange={(v) => {
                          const newRows = rows.map((r, rIdx) => rIdx === ri ? r.map((c, cIdx) => cIdx === ci ? v : c) : r);
                          onChange({ ...block, rows: newRows });
                        }}
                        placeholder={ri === 0 ? `Header ${ci + 1}` : ''}
                        className="outline-none w-full"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </table>
          </div>
        );
      }
      case 'columns2':
      case 'columns3': {
        const colCount = block.type === 'columns2' ? 2 : 3;
        const cols = block.columns || Array(colCount).fill('');
        return (
          <div className={`grid gap-4 my-1 ${colCount === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {cols.map((col, i) => (
              <div key={i} className="border border-dashed border-border rounded-lg p-3 min-h-[80px]">
                <EditableText
                  value={col}
                  onChange={(v) => {
                    const newCols = cols.map((c, idx) => idx === i ? v : c);
                    onChange({ ...block, columns: newCols });
                  }}
                  placeholder={`Column ${i + 1}...`}
                  className={cn(fontClass, !col && 'empty-placeholder')}
                />
              </div>
            ))}
          </div>
        );
      }
      default:
        return (
          <EditableText
            value={block.content}
            onChange={updateContent}
            placeholder="Type '/' for commands..."
            className={cn(fontClass, 'leading-relaxed', !block.content && 'empty-placeholder')}
          />
        );
    }
  };

  return (
    <div className="block-wrapper group relative flex items-start gap-1 py-0.5" data-block-id={block.id}>
      {/* Drag handle + menu */}
      <div className="block-handle flex items-center gap-0.5 pt-1 -ml-8 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors cursor-grab">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const types = ['paragraph', 'heading1', 'heading2', 'heading3', 'bullet', 'numbered', 'todo', 'quote'];
              const idx = types.indexOf(block.type);
              const next = types[(idx + 1) % types.length];
              onChange({ ...block, type: next });
            }}>
              <ArrowUpDown className="h-3.5 w-3.5 mr-2" /> Turn into...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Block content */}
      <div className="flex-1 min-w-0" onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
          e.preventDefault();
          onAddAfter();
        }
        if (e.key === '/' && !block.content) {
          onKeyDown?.(e, block);
        }
        if (e.key === 'Backspace' && !block.content && block.type === 'paragraph') {
          e.preventDefault();
          onDelete();
        }
      }}>
        {renderBlock()}
      </div>
    </div>
  );
}