import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAGE_TEMPLATES, TEMPLATE_CATEGORIES } from './page-templates';
import InsertTemplateDialog from './InsertTemplateDialog';

/**
 * Full-screen template picker shown when the user clicks "+ New Page".
 *
 * Props:
 *   open          boolean
 *   onClose       () => void
 *   onSelect      (template: { title, icon, blocks[] }) => Promise<void>  — for creating new pages
 *   onInsert      ((blocks: []) => void)?  — for inserting into existing page (if provided, shows insert flow instead)
 *   isCreating    boolean  — disables buttons while the page is being saved
 */
export function TemplatePickerModal({ open, onClose, onSelect, onInsert, isCreating }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [insertTemplate, setInsertTemplate] = useState(null);
  const [insertDialogOpen, setInsertDialogOpen] = useState(false);

  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();
    return PAGE_TEMPLATES.filter((t) => {
      const matchesCat =
        activeCategory === 'all' || t.category === activeCategory;
      const matchesSearch =
        !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [search, activeCategory]);

  const handleSelect = (template) => {
    if (isCreating) return;
    
    // If onInsert is provided, use the insert flow with variable substitution
    if (onInsert) {
      setInsertTemplate(template);
      setInsertDialogOpen(true);
      return;
    }

    // Otherwise, use the original flow for creating new pages
    const blocks = template.getBlocks();
    onSelect({
      title: template.title === 'Blank page' ? 'Untitled' : template.title,
      icon: template.icon,
      content: JSON.stringify(blocks),
    });
  };

  const handleInsertConfirm = (blocks) => {
    onInsert?.(blocks);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent
          className="mx-auto max-w-[90vw] min-w-[720px] w-full h-[88vh] p-0 gap-0 flex flex-col overflow-hidden"
          aria-describedby={undefined}
        >
          {/* ── Header ─────────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0">
            <DialogTitle className="text-base font-semibold">New page</DialogTitle>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search templates…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="ml-auto" />
          </div>

          {/* ── Body ───────────────────────────────────────────────────────────── */}
          <div className="flex flex-1 min-h-0 min-w-0">
            {/* Left: categories */}
            <nav className="w-[160px] min-w-[160px] shrink-0 border-r bg-muted/30 flex flex-col gap-0.5 p-2 overflow-y-auto">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                    activeCategory === cat.id
                      ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </nav>

            {/* Right: template cards */}
            <ScrollArea className="flex-1 min-h-0 min-w-0">
              {visible.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-24 gap-3">
                  <span className="text-4xl">🔍</span>
                  <p className="text-sm">No templates match "{search}"</p>
                </div>
              ) : (
                <div className="p-6 grid gap-5 content-start grid-cols-3">
                  {visible.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      disabled={isCreating}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Insert template dialog (if onInsert mode) */}
      {onInsert && (
        <InsertTemplateDialog
          open={insertDialogOpen}
          onOpenChange={setInsertDialogOpen}
          template={insertTemplate}
          onInsert={handleInsertConfirm}
        />
      )}
    </>
  );
}

// ─── TemplateCard ─────────────────────────────────────────────────────────────

function TemplateCard({ template, onSelect, disabled }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onSelect(template)}
      className={cn(
        'group flex flex-col items-start gap-3 rounded-xl border bg-background p-4 text-left min-w-[160px]',
        'transition-all hover:shadow-md hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'min-h-[180px]',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {/* Preview icon */}
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-2xl select-none">
        {template.previewIcon}
      </div>

      {/* Title + description */}
      <div className="space-y-1 min-w-0 flex-1">
        <p className="font-medium text-sm leading-tight break-words whitespace-normal line-clamp-2 group-hover:text-primary transition-colors">
          {template.title}
        </p>
        <p className="text-xs text-muted-foreground leading-snug line-clamp-1">
          {template.description}
        </p>
      </div>
    </button>
  );
}
