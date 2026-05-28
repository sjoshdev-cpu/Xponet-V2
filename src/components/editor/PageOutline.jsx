import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const HEADING_TYPES = ['heading1', 'heading2', 'heading3'];

function getHeadings(blocks) {
  return blocks.filter(b => HEADING_TYPES.includes(b.type) && b.content?.trim());
}

export default function PageOutline({ blocks, isOpen, onClose }) {
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleScroll = () => {
      const headings = getHeadings(blocks);
      let current = null;
      for (const h of headings) {
        const el = document.querySelector(`[data-block-id="${h.id}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 130) current = h.id;
        }
      }
      if (current) setActiveId(current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isOpen, blocks]);

  const scrollTo = (id) => {
    const el = document.querySelector(`[data-block-id="${id}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  };

  const headings = getHeadings(blocks);

  if (!isOpen) return null;

  return (
    <div className="fixed top-14 right-4 z-40 w-56 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">On this page</span>
        <button onClick={onClose} className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto py-1.5">
        {headings.length === 0 ? (
          <p className="text-xs text-muted-foreground px-3 py-3 italic">No headings yet</p>
        ) : (
          headings.map(h => (
            <button
              key={h.id}
              onClick={() => scrollTo(h.id)}
              className={cn(
                'w-full text-left text-xs py-1.5 px-3 hover:bg-accent/50 transition-colors truncate rounded-sm mx-0.5',
                h.type === 'heading1' && 'font-semibold',
                h.type === 'heading2' && 'pl-5',
                h.type === 'heading3' && 'pl-7 text-muted-foreground',
                activeId === h.id && 'text-primary bg-primary/8 font-medium'
              )}
            >
              {h.content}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
