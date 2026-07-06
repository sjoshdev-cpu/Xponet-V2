import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Floating dropdown shown when the user types "@" (mention) or "[[" (page link).
 *
 * Props
 *   type       'mention' | 'page-link'
 *   query      string — text typed after the trigger
 *   position   DOMRect — getBoundingClientRect() of the caret range
 *   pages      Page[]  — all workspace pages (pre-filtered to non-deleted)
 *   members    { email, name }[]
 *   onSelect   (item) => void
 *   onClose    () => void
 */
export function InlineRefDropdown({ type, query, position, pages, members, onSelect, onClose }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef(null);

  // ── Filter items ─────────────────────────────────────────────────────────
  const items = React.useMemo(() => {
    const q = (query || '').toLowerCase();
    if (type === 'mention') {
      return members
        .filter((m) => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
        .slice(0, 8);
    }
    return pages
      .filter((p) => !q || (p.title || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [type, query, pages, members]);

  // Reset active item when query / type changes
  useEffect(() => { setActiveIdx(0); }, [query, type]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx];
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIdx]);

  // ── Keyboard navigation (capture phase so it runs before block handlers) ─
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (items[activeIdx]) onSelect(items[activeIdx]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [items, activeIdx, onSelect, onClose]);

  if (!position || items.length === 0) return null;

  // Position below caret; clamp to viewport width
  const top = (position.bottom ?? position.top ?? 0) + 4;
  const left = Math.min(
    position.left ?? 0,
    typeof window !== 'undefined' ? window.innerWidth - 260 : 0
  );

  return (
    <div
      style={{ position: 'fixed', top, left, zIndex: 9999 }}
      className="w-60 bg-popover border border-border rounded-lg shadow-xl overflow-hidden"
      onMouseDown={(e) => e.preventDefault()} // keep focus in contentEditable
    >
      {/* Header label */}
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60 bg-muted/30">
        {type === 'mention' ? 'Mention a person' : 'Link a page'}
      </div>

      {/* Items */}
      <div ref={listRef} className="p-1 max-h-56 overflow-y-auto space-y-0.5">
        {items.map((item, idx) => (
          <button
            key={type === 'mention' ? item.email : item.id}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-colors',
              idx === activeIdx
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/60 text-foreground'
            )}
            onMouseEnter={() => setActiveIdx(idx)}
            onClick={() => onSelect(item)}
          >
            {type === 'mention' ? (
              <>
                {/* Avatar */}
                <span className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0 uppercase">
                  {(item.name || item.email).charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                </div>
              </>
            ) : (
              <>
                {/* Page icon */}
                <span className="text-lg shrink-0 leading-none">{item.icon || '📄'}</span>
                <p className="truncate text-sm">{item.title || 'Untitled'}</p>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
