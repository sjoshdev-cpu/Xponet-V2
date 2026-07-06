import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Code, Quote, Image, Video, FileText, Globe, Minus, Zap, ToggleLeft,
  Columns, LayoutGrid, Table2, AlignLeft, Database as DbIcon,
  Columns3, GalleryHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const RECENT_KEY = 'xponet_recent_blocks';
const MAX_RECENT = 5;

const BLOCK_DEFS = [
  // ── Basic ─────────────────────────────────────────────────────────────────
  { type: 'paragraph',  label: 'Text',             icon: Type,              desc: 'Plain text paragraph',             shortcut: '/text',     cat: 'basic',    kw: ['p', 'paragraph', 'plain', 'text'] },
  { type: 'heading1',   label: 'Heading 1',         icon: Heading1,          desc: 'Large section heading',            shortcut: '/h1',       cat: 'basic',    kw: ['h1', 'title', 'header', 'big', 'heading', '1'] },
  { type: 'heading2',   label: 'Heading 2',         icon: Heading2,          desc: 'Medium sub-heading',               shortcut: '/h2',       cat: 'basic',    kw: ['h2', 'subtitle', 'medium', 'heading', '2'] },
  { type: 'heading3',   label: 'Heading 3',         icon: Heading3,          desc: 'Small sub-heading',                shortcut: '/h3',       cat: 'basic',    kw: ['h3', 'small', 'heading', '3'] },
  { type: 'bullet',     label: 'Bulleted List',     icon: List,              desc: 'Unordered bullet list',            shortcut: '/bullet',   cat: 'basic',    kw: ['ul', 'unordered', 'list', 'dash', '-', 'bullet', 'item'] },
  { type: 'numbered',   label: 'Numbered List',     icon: ListOrdered,       desc: 'Ordered numbered list',            shortcut: '/numbered', cat: 'basic',    kw: ['ol', 'ordered', 'number', 'numbered', '1.', 'num'] },
  { type: 'toggle',     label: 'Toggle List',       icon: ToggleLeft,        desc: 'Collapsible expandable section',   shortcut: '/toggle',   cat: 'basic',    kw: ['accordion', 'collapse', 'expand', 'toggle', 'dropdown'] },
  { type: 'todo',       label: 'To-do List',        icon: CheckSquare,       desc: 'Checkbox task items',              shortcut: '/todo',     cat: 'basic',    kw: ['task', 'checkbox', 'check', 'action', 'todo', 'done'] },
  { type: 'quote',      label: 'Quote',             icon: Quote,             desc: 'Block quote with left border',     shortcut: '/quote',    cat: 'basic',    kw: ['blockquote', 'cite', 'excerpt', 'quote'] },
  { type: 'divider',    label: 'Divider',           icon: Minus,             desc: 'Horizontal separator line',        shortcut: '/divider',  cat: 'basic',    kw: ['hr', 'separator', 'line', 'rule', '---', 'divider', 'break'] },
  { type: 'callout',    label: 'Callout',           icon: Zap,               desc: 'Colored callout box with icon',    shortcut: '/callout',  cat: 'basic',    kw: ['info', 'warning', 'tip', 'note', 'alert', 'callout', 'highlight'] },
  // ── Media ─────────────────────────────────────────────────────────────────
  { type: 'image',      label: 'Image',             icon: Image,             desc: 'Upload or embed an image',         shortcut: '/image',    cat: 'media',    kw: ['photo', 'picture', 'upload', 'img', 'image'] },
  { type: 'video',      label: 'Video',             icon: Video,             desc: 'Embed a video URL',                shortcut: '/video',    cat: 'media',    kw: ['youtube', 'vimeo', 'mp4', 'embed', 'media', 'video', 'watch'] },
  { type: 'file',       label: 'File',              icon: FileText,          desc: 'Upload a file attachment',         shortcut: '/file',     cat: 'media',    kw: ['attachment', 'document', 'upload', 'pdf', 'file', 'attach', 'download'] },
  { type: 'embed',      label: 'Embed',             icon: Globe,             desc: 'Embed any URL or website',         shortcut: '/embed',    cat: 'media',    kw: ['url', 'iframe', 'link', 'website', 'embed', 'external'] },
  // ── Database ──────────────────────────────────────────────────────────────
  { type: 'db-table',   label: 'Table',             icon: Table2,            desc: 'Inline database — table view',     shortcut: '/db-table',   cat: 'database', kw: ['database', 'table', 'inline', 'embed', 'grid', 'spreadsheet', 'data'] },
  { type: 'db-board',   label: 'Board',             icon: Columns3,          desc: 'Inline database — kanban view',    shortcut: '/db-board',   cat: 'database', kw: ['database', 'board', 'kanban', 'inline', 'embed', 'card', 'drag'] },
  { type: 'db-gallery', label: 'Gallery',           icon: GalleryHorizontal, desc: 'Inline database — gallery view',   shortcut: '/db-gallery', cat: 'database', kw: ['database', 'gallery', 'grid', 'photo', 'inline', 'embed', 'visual'] },
  { type: 'db-list',    label: 'List',              icon: List,              desc: 'Inline database — list view',      shortcut: '/db-list',    cat: 'database', kw: ['database', 'list', 'inline', 'embed', 'rows', 'flat'] },
  // ── Layout ────────────────────────────────────────────────────────────────
  { type: 'columns2',   label: '2 Columns',         icon: Columns,           desc: 'Two-column side-by-side layout',   shortcut: '/col2',     cat: 'layout',   kw: ['layout', 'split', 'side', 'col2', 'two', 'columns', '2'] },
  { type: 'columns3',   label: '3 Columns',         icon: LayoutGrid,        desc: 'Three-column layout',              shortcut: '/col3',     cat: 'layout',   kw: ['layout', 'triple', 'col3', 'three', 'columns', '3'] },
  // ── Advanced ──────────────────────────────────────────────────────────────
  { type: 'code',       label: 'Code',              icon: Code,              desc: 'Code block with syntax highlighting', shortcut: '/code',   cat: 'advanced', kw: ['snippet', 'pre', 'monospace', 'programming', 'syntax', 'code'] },
  { type: 'table',      label: 'Simple Table',      icon: Table2,            desc: 'Basic editable 3×3 table',         shortcut: '/table',    cat: 'advanced', kw: ['grid', 'spreadsheet', 'data', 'simple', 'table'] },
  { type: 'toc',        label: 'Table of Contents', icon: AlignLeft,         desc: 'Auto-generated heading outline',   shortcut: '/toc',      cat: 'advanced', kw: ['outline', 'contents', 'navigation', 'headings', 'toc'] },
  { type: 'linked_db',  label: 'Linked Database',   icon: DbIcon,            desc: 'Embed a view of an existing database', shortcut: '/db',   cat: 'advanced', kw: ['database', 'table', 'relation', 'embed', 'data', 'link'] },
];

const CAT_ORDER  = ['basic', 'media', 'database', 'layout', 'advanced'];
const CAT_LABELS = { basic: 'Basic', media: 'Media', database: 'Database', layout: 'Layout', advanced: 'Advanced' };

function getRecent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } }
function saveRecent(type) {
  try {
    const r = getRecent().filter(t => t !== type);
    localStorage.setItem(RECENT_KEY, JSON.stringify([type, ...r].slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

function fuzzyScore(q, s) {
  if (!q) return 1;
  const lq = q.toLowerCase(), ls = s.toLowerCase();
  if (ls === lq) return 100;
  if (ls.startsWith(lq)) return 50;
  if (ls.includes(lq)) return 20;
  let qi = 0;
  for (let i = 0; i < ls.length && qi < lq.length; i++) if (ls[i] === lq[qi]) qi++;
  return qi === lq.length ? 5 : 0;
}

function scoreBlock(b, q) {
  if (!q) return 1;
  return Math.max(
    fuzzyScore(q, b.type) * 2,
    fuzzyScore(q, b.label) * 3,
    fuzzyScore(q, b.desc),
    fuzzyScore(q, b.shortcut || ''),
    ...(b.kw || []).map(k => fuzzyScore(q, k) * 1.5),
  );
}

export default function SlashMenu({ position, onSelect, onClose }) {
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const ref = useRef(null);
  const itemRefs = useRef([]);

  const recentTypes = useMemo(() => getRecent(), []);

  const allItems = useMemo(() => {
    if (filter) {
      return BLOCK_DEFS
        .map(b => ({ ...b, _score: scoreBlock(b, filter) }))
        .filter(b => b._score > 0)
        .sort((a, b) => b._score - a._score);
    }
    const items = [];
    const recentBlocks = recentTypes.map(t => BLOCK_DEFS.find(b => b.type === t)).filter(Boolean).map(b => ({ ...b, _cat: 'recent' }));
    if (recentBlocks.length) {
      items.push({ _header: true, _id: 'h-recent', label: 'Recent' });
      items.push(...recentBlocks);
    }
    CAT_ORDER.forEach(cat => {
      const blocks = BLOCK_DEFS.filter(b => b.cat === cat);
      if (blocks.length) {
        items.push({ _header: true, _id: `h-${cat}`, label: CAT_LABELS[cat] });
        items.push(...blocks);
      }
    });
    return items;
  }, [filter, recentTypes]);

  // Assign selectable indices
  let _si = 0;
  const renderedItems = allItems.map(item => item._header ? item : { ...item, _si: _si++ });
  const selectableCount = _si;

  useEffect(() => { setSelectedIndex(0); }, [filter]);

  const handleSelect = useCallback((type) => { saveRecent(type); onSelect(type); }, [onSelect]);

  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, selectableCount - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = renderedItems.find(r => !r._header && r._si === selectedIndex);
        if (item) handleSelect(item.type);
        return;
      }
      if (e.key === 'Backspace' && filter === '') { e.preventDefault(); onClose(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); setFilter(f => f.slice(0, -1)); return; }
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); setFilter(f => f + e.key); }
    };
    // Capture phase so we intercept before contentEditable receives keys
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [filter, selectedIndex, selectableCount, renderedItems, onClose, handleSelect]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-popover border border-border rounded-xl shadow-2xl w-[320px] max-h-[420px] overflow-y-auto py-1.5"
      style={{ top: position.top, left: position.left }}
    >
      <div className="sticky top-0 bg-popover z-10 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest border-b border-border mb-1 flex items-center justify-between">
        <span>
          {filter ? <><span className="text-muted-foreground">Filter:</span> <span className="text-foreground font-mono ml-1">{filter}</span></> : 'Add block'}
        </span>
        {filter && selectableCount === 0 && <span className="normal-case font-normal text-destructive/70">No results</span>}
      </div>

      {renderedItems.map((item) => {
        if (item._header) {
          return (
            <div key={item._id} className="px-3 pt-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {item.label}
            </div>
          );
        }
        const Icon = item.icon;
        const isSelected = item._si === selectedIndex;
        return (
          <button
            key={`${item.type}-${item._cat || item.cat}`}
            ref={el => itemRefs.current[item._si] = el}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors text-left',
              isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
            )}
            onClick={() => handleSelect(item.type)}
            onMouseEnter={() => setSelectedIndex(item._si)}
          >
            <div className="h-8 w-8 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium leading-tight">{item.label}</p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{item.desc}</p>
            </div>
            {item.shortcut && (
              <span className="text-[10px] text-muted-foreground/50 shrink-0 font-mono">{item.shortcut}</span>
            )}
          </button>
        );
      })}
      {filter && selectableCount === 0 && (
        <p className="px-3 py-6 text-sm text-muted-foreground text-center">
          No blocks match "<strong>{filter}</strong>"
        </p>
      )}
    </div>
  );
}