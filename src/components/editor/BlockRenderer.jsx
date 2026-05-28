import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { GripVertical, ChevronRight, ChevronDown, Trash2, Copy, ArrowUp, ArrowDown, Type, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CALLOUT_COLORS } from '@/lib/design-system';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent
} from '@/components/ui/dropdown-menu';
import LinkedDatabaseBlockImport from '@/components/database/LinkedDatabaseBlock.jsx';

// Avoid circular import issues — alias for use in renderBlock()
const _LinkedDatabaseBlock = LinkedDatabaseBlockImport;

const HEADING_TYPES = ['heading1', 'heading2', 'heading3'];

const TURN_INTO_TYPES = [
  { type: 'paragraph', label: 'Text' },
  { type: 'heading1', label: 'Heading 1' },
  { type: 'heading2', label: 'Heading 2' },
  { type: 'heading3', label: 'Heading 3' },
  { type: 'bullet', label: 'Bullet List' },
  { type: 'numbered', label: 'Numbered List' },
  { type: 'todo', label: 'To-do' },
  { type: 'quote', label: 'Quote' },
  { type: 'callout', label: 'Callout' },
];

// Lightweight sanitizer — strips scripts/on* handlers, keeps inline formatting tags
function sanitizeHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*\S+/gi, '')
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
}

function normalizeHtml(html) {
  if (!html || html === '<br>' || html === '<div><br></div>') return '';
  return html;
}

function parseMarkdownLine(line) {
  const t = line.trim();
  if (!t) return null;
  if (/^### /.test(t)) return { type: 'heading3', content: t.slice(4) };
  if (/^## /.test(t)) return { type: 'heading2', content: t.slice(3) };
  if (/^# /.test(t)) return { type: 'heading1', content: t.slice(2) };
  if (/^- \[x\] /i.test(t)) return { type: 'todo', content: t.slice(6), checked: true };
  if (/^- \[ \] /.test(t)) return { type: 'todo', content: t.slice(6), checked: false };
  if (/^\* \[x\] /i.test(t)) return { type: 'todo', content: t.slice(6), checked: true };
  if (/^\* \[ \] /.test(t)) return { type: 'todo', content: t.slice(6), checked: false };
  if (/^[-*] /.test(t)) return { type: 'bullet', content: t.slice(2) };
  if (/^\d+\. /.test(t)) return { type: 'numbered', content: t.replace(/^\d+\.\s+/, '') };
  if (/^> /.test(t)) return { type: 'quote', content: t.slice(2) };
  if (/^```/.test(t)) return { type: 'code', content: t.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim() };
  if (t === '---' || t === '***' || t === '___') return { type: 'divider', content: '' };
  return { type: 'paragraph', content: t };
}

// contentEditable component using innerHTML for formatting persistence
function EditableText({ value, onChange, onPasteBlocks, placeholder, className, tag: Tag = 'div', onKeyDown: onKeyDownProp }) {
  const ref = useRef(null);
  const isFocused = useRef(false);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitizeHtml(value || '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ref.current && !isFocused.current) {
      const current = normalizeHtml(ref.current.innerHTML);
      if (current !== value) {
        ref.current.innerHTML = sanitizeHtml(value || '');
      }
    }
  }, [value]);

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text/plain');
    const lines = text.split('\n').map(l => l.trimEnd());
    const nonEmpty = lines.filter(l => l.trim() !== '');
    if (nonEmpty.length > 1 && onPasteBlocks) {
      e.preventDefault();
      const parsed = nonEmpty.map(parseMarkdownLine).filter(Boolean);
      onPasteBlocks(parsed);
    }
    // Single-line: let browser handle (preserves inline HTML formatting)
  };

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={cn('outline-none', className)}
      data-placeholder={placeholder}
      onFocus={() => { isFocused.current = true; }}
      onBlur={() => { isFocused.current = false; }}
      onInput={(e) => onChange(normalizeHtml(e.currentTarget.innerHTML))}
      onPaste={handlePaste}
      onKeyDown={onKeyDownProp}
    />
  );
}

export default function BlockRenderer({
  block,
  onChange,
  onDelete,
  onAddAfter,
  onSlash,
  onKeyDown: onKeyDownLegacy,
  onPasteBlocks,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onBlockSelect,
  isSelected,
  fontStyle,
  allBlocks,
  innerRef,
  dragHandleProps,
  draggableProps,
  isDragging,
  commentCount = 0,
  onCommentClick,
}) {
  const [toggleOpen, setToggleOpen] = useState(false);

  const fontClass = fontStyle === 'serif' ? 'font-serif' : fontStyle === 'mono' ? 'font-mono' : 'font-sans';
  const isEmpty = (c) => !c || c === '<br>';

  const updateContent = (content) => onChange({ ...block, content });

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
      e.preventDefault();
      onAddAfter();
    }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      // Support both new onSlash and legacy onKeyDown prop names
      (onSlash || onKeyDownLegacy)?.(e, block);
    }
    if (e.key === 'Backspace' && isEmpty(block.content) && block.type === 'paragraph') {
      e.preventDefault();
      onDelete();
    }
  };

  const renderBlock = () => {
    switch (block.type) {
      case 'heading1':
        return (
          <EditableText
            value={block.content}
            onChange={updateContent}
            onPasteBlocks={onPasteBlocks}
            placeholder="Heading 1"
            className={cn('text-3xl font-bold tracking-tight', fontClass, isEmpty(block.content) && 'empty-placeholder')}
            onKeyDown={handleKeyDown}
          />
        );
      case 'heading2':
        return (
          <EditableText
            value={block.content}
            onChange={updateContent}
            onPasteBlocks={onPasteBlocks}
            placeholder="Heading 2"
            className={cn('text-2xl font-semibold tracking-tight', fontClass, isEmpty(block.content) && 'empty-placeholder')}
            onKeyDown={handleKeyDown}
          />
        );
      case 'heading3':
        return (
          <EditableText
            value={block.content}
            onChange={updateContent}
            onPasteBlocks={onPasteBlocks}
            placeholder="Heading 3"
            className={cn('text-xl font-semibold', fontClass, isEmpty(block.content) && 'empty-placeholder')}
            onKeyDown={handleKeyDown}
          />
        );
      case 'bullet':
        return (
          <div className="flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />
            <EditableText
              value={block.content}
              onChange={updateContent}
              onPasteBlocks={onPasteBlocks}
              placeholder="List item"
              className={cn('flex-1', fontClass, isEmpty(block.content) && 'empty-placeholder')}
              onKeyDown={handleKeyDown}
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
              onPasteBlocks={onPasteBlocks}
              placeholder="List item"
              className={cn('flex-1', fontClass, isEmpty(block.content) && 'empty-placeholder')}
              onKeyDown={handleKeyDown}
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
              onPasteBlocks={onPasteBlocks}
              placeholder="To-do"
              className={cn('flex-1', fontClass, block.checked && 'line-through text-muted-foreground', isEmpty(block.content) && 'empty-placeholder')}
              onKeyDown={handleKeyDown}
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
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && isEmpty(block.content)) { e.preventDefault(); onDelete(); }
              }}
            />
          </div>
        );
      case 'quote':
        return (
          <div className="border-l-[3px] border-foreground/20 pl-4 py-0.5">
            <EditableText
              value={block.content}
              onChange={updateContent}
              onPasteBlocks={onPasteBlocks}
              placeholder="Quote"
              className={cn('text-muted-foreground italic', fontClass, isEmpty(block.content) && 'empty-placeholder')}
              onKeyDown={handleKeyDown}
            />
          </div>
        );
      case 'callout':
        return (
          <div className={cn('flex gap-3 p-4 rounded-lg border', CALLOUT_COLORS[block.color || 'blue'])}>
            <button
              className="text-xl shrink-0 hover:opacity-70 transition-opacity"
              onClick={() => {
                const emojis = ['💡', '⚠️', '✅', '❌', '📌', '🔥', '💬', '🚀'];
                const idx = emojis.indexOf(block.emoji || '💡');
                onChange({ ...block, emoji: emojis[(idx + 1) % emojis.length] });
              }}
              title="Click to cycle emoji"
            >
              {block.emoji || '💡'}
            </button>
            <EditableText
              value={block.content}
              onChange={updateContent}
              onPasteBlocks={onPasteBlocks}
              placeholder="Type something..."
              className={cn('flex-1', fontClass, isEmpty(block.content) && 'empty-placeholder')}
              onKeyDown={handleKeyDown}
            />
          </div>
        );
      case 'toggle':
        return (
          <div>
            <button
              onClick={() => setToggleOpen(!toggleOpen)}
              className="flex items-center gap-1.5 font-medium hover:bg-accent/50 rounded px-1 py-0.5 -ml-1 transition-colors w-full text-left"
            >
              {toggleOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
              <EditableText
                value={block.content}
                onChange={updateContent}
                onPasteBlocks={onPasteBlocks}
                placeholder="Toggle"
                className={cn('flex-1', fontClass, isEmpty(block.content) && 'empty-placeholder')}
                onKeyDown={handleKeyDown}
              />
            </button>
            {toggleOpen && (
              <div className="ml-6 mt-1 pl-3 border-l-2 border-border">
                {(block.children || []).map((child, i) => (
                  <p key={i} className="text-muted-foreground text-sm py-0.5">{child.content}</p>
                ))}
                {(!block.children || block.children.length === 0) && (
                  <p className="text-muted-foreground text-sm py-0.5 italic">Empty toggle. Click to add content.</p>
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
                  className={cn(fontClass, isEmpty(col) && 'empty-placeholder')}
                />
              </div>
            ))}
          </div>
        );
      }
      case 'toc': {
        const headings = (allBlocks || []).filter(b => HEADING_TYPES.includes(b.type) && b.content?.trim());
        return (
          <div className="border border-border rounded-lg p-4 my-1 bg-muted/20">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Table of Contents</p>
            {headings.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No headings yet — add Heading blocks above.</p>
            ) : (
              <ul className="space-y-1">
                {headings.map(h => (
                  <li key={h.id}>
                    <button
                      onClick={() => {
                        const el = document.querySelector(`[data-block-id="${h.id}"]`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className={cn(
                        'text-sm hover:underline text-left transition-colors hover:text-primary',
                        h.type === 'heading1' && 'font-semibold',
                        h.type === 'heading2' && 'ml-4 text-muted-foreground',
                        h.type === 'heading3' && 'ml-8 text-muted-foreground text-xs',
                      )}
                    >
                      {h.content}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }
      case 'linked_db': {
        const LinkedDatabaseBlock = _LinkedDatabaseBlock;
        return (
          <LinkedDatabaseBlock
            block={block}
            onChange={(updates) => onChange({ ...block, ...updates })}
          />
        );
      }
      default:
        return (
          <EditableText
            value={block.content}
            onChange={updateContent}
            onPasteBlocks={onPasteBlocks}
            placeholder="Type '/' for commands..."
            className={cn(fontClass, 'leading-relaxed', isEmpty(block.content) && 'empty-placeholder')}
            onKeyDown={handleKeyDown}
          />
        );
    }
  };

  return (
    <div
      ref={innerRef}
      {...(draggableProps || {})}
      className={cn(
        'block-wrapper group relative flex items-start gap-1 py-0.5',
        isSelected && 'bg-primary/5 rounded-lg outline outline-1 outline-primary/20',
        isDragging && 'opacity-50 shadow-lg rounded-lg',
      )}
      data-block-id={block.id}
    >
      {/* Drag handle + block menu */}
      <div className="block-handle flex items-center gap-0.5 pt-1 -ml-8 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              {...(dragHandleProps || {})}
              onClick={(e) => onBlockSelect?.(block.id, e)}
              className={cn(
                'h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors cursor-grab active:cursor-grabbing',
                isSelected && 'bg-primary/10'
              )}
              title="Drag to reorder · Click to select"
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveUp}>
              <ArrowUp className="h-3.5 w-3.5 mr-2" /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveDown}>
              <ArrowDown className="h-3.5 w-3.5 mr-2" /> Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Type className="h-3.5 w-3.5 mr-2" /> Turn into...
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {TURN_INTO_TYPES.map(t => (
                  <DropdownMenuItem
                    key={t.type}
                    onClick={() => onChange({ ...block, type: t.type })}
                    className={block.type === t.type ? 'font-medium text-primary' : ''}
                  >
                    {t.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Block content */}
      <div className="flex-1 min-w-0">
        {renderBlock()}
      </div>

      {/* Inline comment indicator (visible on hover or when comments exist) */}
      {onCommentClick && (
        <button
          onClick={() => onCommentClick(block.id)}
          title={commentCount > 0 ? `${commentCount} comment${commentCount > 1 ? 's' : ''}` : 'Add comment'}
          className={cn(
            'absolute right-0 top-1/2 -translate-y-1/2 translate-x-full ml-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-all',
            commentCount > 0
              ? 'opacity-100 bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
              : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
        >
          <MessageSquare className="h-3 w-3" />
          {commentCount > 0 && commentCount}
        </button>
      )}
    </div>
  );
}