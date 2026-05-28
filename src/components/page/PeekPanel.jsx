/**
 * PeekPanel — Notion-style right-side slide-in panel for quick page preview/editing.
 *
 * Open via:  usePeek().openPeek(pageId)
 * Close via: usePeek().closePeek()   or the ✕ button
 * Full page: navigates to /page/:id  (Open in full page button)
 *
 * Modifier+click integration:
 *   Any element can call openPeek(pageId) instead of navigating.
 *   See Sidebar.jsx (PageRow) and BlockRenderer.jsx for wired-up examples.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, withLastEditedBy } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePeek } from '@/contexts/PeekContext';
import BlockRenderer from '@/components/editor/BlockRenderer';
import EmojiPicker from '@/components/editor/EmojiPicker';
import { Button } from '@/components/ui/button';
import { ExternalLink, X, Edit3, Eye, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import _ from 'lodash';

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export default function PeekPanel() {
  const { peekPageId, closePeek } = usePeek();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentOrg, user } = useWorkspace();

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('📄');
  const [blocks, setBlocks] = useState([]);
  const [visible, setVisible] = useState(false);

  // Animate in/out
  useEffect(() => {
    if (peekPageId) {
      // Small delay so the CSS transition fires
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [peekPageId]);

  const { data: page, isLoading } = useQuery({
    queryKey: ['page', peekPageId],
    queryFn: () => Page.get(peekPageId),
    enabled: !!peekPageId,
  });

  // Initialize local state from fetched page
  useEffect(() => {
    if (!page) return;
    setTitle(page.title || '');
    setIcon(page.icon || '📄');
    try {
      const parsed = JSON.parse(page.content || '[]');
      setBlocks(parsed.length > 0 ? parsed : [{ id: generateId(), type: 'paragraph', content: '' }]);
    } catch {
      setBlocks([{ id: generateId(), type: 'paragraph', content: '' }]);
    }
    setIsEditing(false);
  }, [page?.id]);

  const saveMutation = useMutation({
    mutationFn: (data) => Page.update(peekPageId, withLastEditedBy(data, user)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages'] }),
  });

  const debouncedSave = useCallback(
    _.debounce((data) => saveMutation.mutate(data), 800),
    [peekPageId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleTitleChange = (e) => {
    const v = e.target.value;
    setTitle(v);
    debouncedSave({ title: v, content: JSON.stringify(blocks), icon });
  };

  const handleIconSelect = (newIcon) => {
    setIcon(newIcon);
    debouncedSave({ icon: newIcon, title, content: JSON.stringify(blocks) });
  };

  const handleBlockChange = (updated) => {
    setBlocks((prev) => {
      const next = prev.map((b) => (b.id === updated.id ? updated : b));
      debouncedSave({ content: JSON.stringify(next), title, icon });
      return next;
    });
  };

  const handleBlockDelete = (blockId) => {
    setBlocks((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((b) => b.id !== blockId);
      debouncedSave({ content: JSON.stringify(next), title, icon });
      return next;
    });
  };

  const handleAddAfter = (blockId) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      const newBlock = { id: generateId(), type: 'paragraph', content: '' };
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock);
      debouncedSave({ content: JSON.stringify(next), title, icon });
      return next;
    });
  };

  const openFullPage = () => {
    closePeek();
    navigate(`/page/${peekPageId}`);
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') closePeek(); };
    if (peekPageId) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [peekPageId, closePeek]);

  if (!peekPageId) return null;

  const isViewer = !isEditing;
  const fontStyle = page?.font_style || 'sans';

  return (
    <>
      {/* Backdrop — click to close */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={closePeek}
      />

      {/* Panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full z-50 flex flex-col',
          'w-[520px] max-w-[90vw]',
          'bg-background border-l border-border shadow-2xl',
          'transition-transform duration-250 ease-out',
          visible ? 'translate-x-0' : 'translate-x-full',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0 gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closePeek} title="Close">
              <X className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openFullPage} title="Open full page">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>

          <span className="text-xs text-muted-foreground truncate flex-1 text-center">
            {title || 'Untitled'}
          </span>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs shrink-0"
            onClick={() => setIsEditing((v) => !v)}
          >
            {isEditing ? (
              <><Eye className="h-3.5 w-3.5" /> Read</>
            ) : (
              <><Edit3 className="h-3.5 w-3.5" /> Edit</>
            )}
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : !page ? (
            <p className="text-muted-foreground text-sm">Page not found.</p>
          ) : (
            <>
              {/* Icon + Title */}
              {isEditing ? (
                <EmojiPicker onSelect={handleIconSelect}>
                  <button className="text-4xl mb-2 hover:opacity-80 transition-opacity cursor-pointer">
                    {icon}
                  </button>
                </EmojiPicker>
              ) : (
                <div className="text-4xl mb-2">{icon}</div>
              )}

              {isEditing ? (
                <input
                  value={title}
                  onChange={handleTitleChange}
                  placeholder="Untitled"
                  className={cn(
                    'w-full text-3xl font-bold bg-transparent border-0 outline-none',
                    'placeholder:text-muted-foreground/40 mb-4',
                    fontStyle === 'serif' ? 'font-serif' : fontStyle === 'mono' ? 'font-mono' : 'font-sans',
                  )}
                />
              ) : (
                <h1
                  className={cn(
                    'text-3xl font-bold mb-4',
                    fontStyle === 'serif' ? 'font-serif' : fontStyle === 'mono' ? 'font-mono' : 'font-sans',
                  )}
                >
                  {title || 'Untitled'}
                </h1>
              )}

              {/* Last edited hint */}
              {page.last_edited_by_name && page.updated_at && (
                <p className="text-xs text-muted-foreground mb-4 -mt-2">
                  Last edited by {page.last_edited_by_name} ·{' '}
                  {formatDistanceToNow(
                    page.updated_at?.toDate ? page.updated_at.toDate() : new Date(page.updated_at),
                    { addSuffix: true },
                  )}
                </p>
              )}

              {/* Blocks */}
              <div className="space-y-0.5">
                {blocks.map((block) => (
                  <BlockRenderer
                    key={block.id}
                    block={block}
                    fontStyle={fontStyle}
                    allBlocks={blocks}
                    onChange={isEditing ? handleBlockChange : () => {}}
                    onDelete={isEditing ? () => handleBlockDelete(block.id) : () => {}}
                    onAddAfter={isEditing ? () => handleAddAfter(block.id) : () => {}}
                    commentCount={0}
                    onCommentClick={() => {}}
                  />
                ))}
              </div>

              {/* Open full page CTA */}
              <div className="mt-8 pt-4 border-t border-border/50 flex justify-center">
                <Button variant="outline" size="sm" onClick={openFullPage} className="gap-2">
                  <ExternalLink className="h-3.5 w-3.5" /> Open full page
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
