import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Page } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import BlockRenderer from '@/components/editor/BlockRenderer';
import SlashMenu from '@/components/editor/SlashMenu';
import EmojiPicker from '@/components/editor/EmojiPicker';
import {
  Star, Share2, MoreHorizontal, Lock, Unlock, Maximize, Minimize,
  Copy, Trash2, Download, ChevronRight, Image as ImageIcon, FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import _ from 'lodash';
import CoverImage from '@/components/editor/CoverImage';
import CommentsSection from '@/components/page/CommentsSection';
import FloatingToolbar from '@/components/editor/FloatingToolbar';

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export default function PageEditor() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentOrg, user } = useWorkspace();

  const [blocks, setBlocks] = useState([]);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('📄');
  const [slashMenu, setSlashMenu] = useState(null);
  const [slashBlockId, setSlashBlockId] = useState(null);
  const [shareDialog, setShareDialog] = useState(false);
  const [moveDialog, setMoveDialog] = useState(false);
  const [moveSearch, setMoveSearch] = useState('');
  const saveTimerRef = useRef(null);
  const titleRef = useRef(null);

  const { data: page, isLoading } = useQuery({
    queryKey: ['page', pageId],
    queryFn: () => Page.get(pageId),
    enabled: !!pageId
  });

  const { data: allPages = [] } = useQuery({
    queryKey: ['pages', currentOrg?.id],
    queryFn: () => Page.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id
  });

  // Build breadcrumbs
  const buildBreadcrumbs = useCallback(() => {
    if (!page) return [];
    const crumbs = [];
    let current = page;
    while (current?.parent_id) {
      const parent = allPages.find(p => p.id === current.parent_id);
      if (parent) {
        crumbs.unshift({ id: parent.id, title: parent.title, icon: parent.icon });
        current = parent;
      } else break;
    }
    return crumbs;
  }, [page, allPages]);

  useEffect(() => {
    if (page) {
      setTitle(page.title || '');
      setIcon(page.icon || '📄');
      try {
        const parsed = JSON.parse(page.content || '[]');
        setBlocks(parsed.length > 0 ? parsed : [{ id: generateId(), type: 'paragraph', content: '' }]);
      } catch {
        setBlocks([{ id: generateId(), type: 'paragraph', content: '' }]);
      }
    }
  }, [page]);

  const saveMutation = useMutation({
    mutationFn: (data) => Page.update(pageId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages'] })
  });

  const debouncedSave = useCallback(
    _.debounce((data) => {
      saveMutation.mutate(data);
    }, 800),
    [pageId]
  );

  const updateBlocks = (newBlocks) => {
    setBlocks(newBlocks);
    debouncedSave({ content: JSON.stringify(newBlocks), title, icon });
  };

  const updateTitle = (newTitle) => {
    setTitle(newTitle);
    debouncedSave({ title: newTitle, content: JSON.stringify(blocks), icon });
  };

  const updateIcon = (newIcon) => {
    setIcon(newIcon);
    debouncedSave({ title, content: JSON.stringify(blocks), icon: newIcon });
  };

  const updateCover = (coverData) => {
    saveMutation.mutate(coverData);
    queryClient.invalidateQueries({ queryKey: ['page', pageId] });
  };

  const handleBlockChange = (index, updated) => {
    const newBlocks = [...blocks];
    newBlocks[index] = updated;
    updateBlocks(newBlocks);
  };

  const handleDeleteBlock = (index) => {
    if (blocks.length <= 1) return;
    const newBlocks = blocks.filter((_, i) => i !== index);
    updateBlocks(newBlocks);
  };

  const handleAddAfter = (index) => {
    const newBlock = { id: generateId(), type: 'paragraph', content: '' };
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    updateBlocks(newBlocks);
  };

  const handleSlashCommand = (e, block) => {
    const rect = e.target.getBoundingClientRect();
    setSlashMenu({ top: rect.bottom + 4, left: rect.left });
    setSlashBlockId(block.id);
  };

  const handleSlashSelect = (type) => {
    const idx = blocks.findIndex(b => b.id === slashBlockId);
    if (idx >= 0) {
      const newBlocks = [...blocks];
      newBlocks[idx] = {
        ...newBlocks[idx],
        type,
        content: '',
        ...(type === 'callout' ? { emoji: '💡', color: 'blue' } : {}),
        ...(type === 'todo' ? { checked: false } : {}),
      };
      updateBlocks(newBlocks);
    }
    setSlashMenu(null);
    setSlashBlockId(null);
  };

  const toggleFavorite = () => {
    saveMutation.mutate({ is_favorite: !page?.is_favorite });
  };

  const toggleLock = () => {
    saveMutation.mutate({ is_locked: !page?.is_locked });
    toast(page?.is_locked ? 'Page unlocked' : 'Page locked');
  };

  const toggleFullWidth = () => {
    saveMutation.mutate({ is_full_width: !page?.is_full_width });
  };

  const handleDelete = () => {
    saveMutation.mutate({ is_deleted: true, deleted_at: new Date().toISOString() });
    navigate('/');
  };

  const handleShare = async () => {
    const token = page?.share_token || generateId() + generateId();
    await Page.update(pageId, { share_token: token, is_shared: true });
    queryClient.invalidateQueries({ queryKey: ['page', pageId] });
    queryClient.invalidateQueries({ queryKey: ['pages'] });
    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Share link copied to clipboard!');
    setShareDialog(false);
  };



  const breadcrumbs = buildBreadcrumbs();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-muted-foreground">
        <p>Page not found</p>
        <Link to="/" className="text-primary mt-2 text-sm hover:underline">Go home</Link>
      </div>
    );
  }

  const isFullWidth = page?.is_full_width;
  const fontStyle = page?.font_style || 'sans';

  return (
    <div className="min-h-screen">
      <FloatingToolbar />
      {/* Cover image */}
      {page.cover_url ? (
        <CoverImage
          coverUrl={page.cover_url}
          coverPosition={page.cover_position || 50}
          onUpdate={updateCover}
        />
      ) : null}

      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className={cn('flex items-center justify-between px-4 py-1.5', isFullWidth ? 'max-w-full' : 'max-w-[900px] mx-auto')}>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
            <Link to="/" className="hover:text-foreground transition-colors shrink-0">{currentOrg?.icon} {currentOrg?.name}</Link>
            {breadcrumbs.map(crumb => (
              <React.Fragment key={crumb.id}>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <Link to={`/page/${crumb.id}`} className="hover:text-foreground transition-colors truncate">
                  {crumb.icon} {crumb.title || 'Untitled'}
                </Link>
              </React.Fragment>
            ))}
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="truncate font-medium text-foreground">{title || 'Untitled'}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleFavorite}>
              <Star className={cn('h-4 w-4', page.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShareDialog(true)}>
              <Share2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={toggleLock}>
                  {page.is_locked ? <Unlock className="h-3.5 w-3.5 mr-2" /> : <Lock className="h-3.5 w-3.5 mr-2" />}
                  {page.is_locked ? 'Unlock page' : 'Lock page'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleFullWidth}>
                  {isFullWidth ? <Minimize className="h-3.5 w-3.5 mr-2" /> : <Maximize className="h-3.5 w-3.5 mr-2" />}
                  {isFullWidth ? 'Default width' : 'Full width'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => {
                  const dup = await Page.create({
                    title: `${title} (copy)`, icon, content: JSON.stringify(blocks),
                    org_id: currentOrg?.id, parent_id: page.parent_id
                  });
                  queryClient.invalidateQueries({ queryKey: ['pages'] });
                  navigate(`/page/${dup.id}`);
                }}>
                  <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setMoveDialog(true); setMoveSearch(''); }}>
                  <FolderOpen className="h-3.5 w-3.5 mr-2" /> Move to...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const md = blocks.map(b => {
                    if (b.type === 'heading1') return `# ${b.content}`;
                    if (b.type === 'heading2') return `## ${b.content}`;
                    if (b.type === 'heading3') return `### ${b.content}`;
                    if (b.type === 'bullet') return `- ${b.content}`;
                    if (b.type === 'numbered') return `1. ${b.content}`;
                    if (b.type === 'todo') return `- [${b.checked ? 'x' : ' '}] ${b.content}`;
                    if (b.type === 'quote') return `> ${b.content}`;
                    if (b.type === 'code') return `\`\`\`\n${b.content}\n\`\`\``;
                    if (b.type === 'divider') return '---';
                    return b.content || '';
                  }).join('\n\n');
                  const blob = new Blob([`# ${title}\n\n${md}`], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `${title || 'page'}.md`; a.click();
                }}>
                  <Download className="h-3.5 w-3.5 mr-2" /> Export as Markdown
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className={cn('px-6 py-8 page-content', isFullWidth ? 'max-w-full px-12' : 'max-w-[900px] mx-auto')}>
        {/* Add cover button */}
        {!page.cover_url && !page.is_locked && (
          <div className="flex gap-2 mb-2 group-hover:opacity-100 opacity-0 hover:opacity-100 transition-opacity">
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors"
              onClick={() => updateCover({ cover_url: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', cover_position: 50 })}
            >
              <ImageIcon className="h-3.5 w-3.5" /> Add cover
            </button>
          </div>
        )}
        {/* Icon */}
        <EmojiPicker onSelect={updateIcon}>
          <button className="text-5xl mb-2 hover:opacity-80 transition-opacity cursor-pointer">
            {icon}
          </button>
        </EmojiPicker>

        {/* Title */}
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder="Untitled"
          className={cn(
            'w-full text-4xl font-bold bg-transparent border-0 outline-none placeholder:text-muted-foreground/40 mb-6',
            fontStyle === 'serif' ? 'font-serif' : fontStyle === 'mono' ? 'font-mono' : 'font-sans'
          )}
          disabled={page.is_locked}
        />

        {/* Blocks */}
        {!page.is_locked && (
          <div className="pl-8 space-y-0.5">
            {blocks.map((block, index) => (
              <BlockRenderer
                key={block.id}
                block={block}
                fontStyle={fontStyle}
                onChange={(updated) => handleBlockChange(index, updated)}
                onDelete={() => handleDeleteBlock(index)}
                onAddAfter={() => handleAddAfter(index)}
                onKeyDown={handleSlashCommand}
              />
            ))}
          </div>
        )}

        {page.is_locked && (
          <div className="pl-8 space-y-0.5 opacity-80 pointer-events-none">
            {blocks.map((block, index) => (
              <BlockRenderer
                key={block.id}
                block={block}
                fontStyle={fontStyle}
                onChange={() => {}}
                onDelete={() => {}}
                onAddAfter={() => {}}
              />
            ))}
          </div>
        )}

        {/* Comments */}
        <CommentsSection pageId={pageId} orgId={currentOrg?.id} />
      </div>

      {/* Slash menu */}
      {slashMenu && (
        <SlashMenu
          position={slashMenu}
          onSelect={handleSlashSelect}
          onClose={() => { setSlashMenu(null); setSlashBlockId(null); }}
        />
      )}

      {/* Move to dialog */}
      <Dialog open={moveDialog} onOpenChange={setMoveDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Move to...</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Input
              placeholder="Search pages..."
              value={moveSearch}
              onChange={e => setMoveSearch(e.target.value)}
              autoFocus
            />
            <div className="max-h-[240px] overflow-y-auto space-y-0.5">
              {/* Option to move to root (no parent) */}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-accent/60 transition-colors text-left"
                onClick={async () => {
                  await Page.update(pageId, { parent_id: null });
                  queryClient.invalidateQueries({ queryKey: ['pages'] });
                  queryClient.invalidateQueries({ queryKey: ['page', pageId] });
                  setMoveDialog(false);
                  toast.success('Page moved to root');
                }}
              >
                🏠 <span className="font-medium">Root (no parent)</span>
              </button>
              {allPages
                .filter(p => !p.is_deleted && !p.is_template && p.id !== pageId)
                .filter(p => !moveSearch || (p.title || '').toLowerCase().includes(moveSearch.toLowerCase()))
                .map(p => (
                  <button
                    key={p.id}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-accent/60 transition-colors text-left"
                    onClick={async () => {
                      await Page.update(pageId, { parent_id: p.id });
                      queryClient.invalidateQueries({ queryKey: ['pages'] });
                      queryClient.invalidateQueries({ queryKey: ['page', pageId] });
                      setMoveDialog(false);
                      toast.success(`Moved under "${p.title || 'Untitled'}"`);
                    }}
                  >
                    <span>{p.icon || '📄'}</span>
                    <span className="truncate">{p.title || 'Untitled'}</span>
                  </button>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share dialog */}
      <Dialog open={shareDialog} onOpenChange={setShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share to web</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Public access</p>
                <p className="text-xs text-muted-foreground">Anyone with the link can view</p>
              </div>
              <Switch checked={!!page.share_token} onCheckedChange={async (checked) => {
                if (checked) {
                  await handleShare();
                } else {
                  await Page.update(pageId, { share_token: null, share_password: null });
                  queryClient.invalidateQueries({ queryKey: ['page', pageId] });
                  queryClient.invalidateQueries({ queryKey: ['pages'] });
                }
              }} />
            </div>

            {page.share_token && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Public link</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}/shared/${page.share_token}`}
                      className="text-sm bg-muted"
                    />
                    <Button onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/shared/${page.share_token}`);
                      toast.success('Link copied!');
                    }} size="sm" variant="outline">
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Optional password</Label>
                  <Input
                    type="password"
                    placeholder="Leave blank for no password"
                    defaultValue={page.share_password || ''}
                    onBlur={async (e) => {
                      await Page.update(pageId, { share_password: e.target.value || null });
                      queryClient.invalidateQueries({ queryKey: ['page', pageId] });
                    }}
                    className="text-sm"
                  />
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}