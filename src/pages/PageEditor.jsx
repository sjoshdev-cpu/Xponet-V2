import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Page, Comment, DatabaseRecord, withLastEditedBy } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import BlockRenderer from '@/components/editor/BlockRenderer';
import SlashMenu from '@/components/editor/SlashMenu';
import EmojiPicker from '@/components/editor/EmojiPicker';
import PageOutline from '@/components/editor/PageOutline';
import LinkedTasksPanel from '@/components/tasks/LinkedTasksPanel';
import InlineCommentThread from '@/components/page/InlineCommentThread';
import { usePresence } from '@/hooks/usePresence';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Star, Share2, MoreHorizontal, Lock, Unlock, Maximize, Minimize,
  Copy, Trash2, Download, ChevronRight, Image as ImageIcon, FolderOpen,
  PanelRight, X, ArrowUp, ArrowDown, Type, ClipboardList, Shield, ExternalLink, Calendar, Eye, LayoutTemplate,
  Check, Loader2
} from 'lucide-react';

// Memoized BlockRenderer — only re-renders when the block itself, selection, or drag state changes.
// Stable per-block callbacks (keyed by ID) ensure unchanged blocks never re-render on keystrokes.
const MemoBlockRenderer = React.memo(BlockRenderer, (prev, next) => {
  if (prev.block !== next.block) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.commentCount !== next.commentCount) return false;
  if (prev.isDragging !== next.isDragging) return false;
  if (prev.fontStyle !== next.fontStyle) return false;
  // TOC blocks render a list of headings — re-render if allBlocks changes
  if (next.block.type === 'toc' && prev.allBlocks !== next.allBlocks) return false;
  return true;
});
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import _ from 'lodash';
import CoverImage from '@/components/editor/CoverImage';
import CommentsSection from '@/components/page/CommentsSection';
import FloatingToolbar from '@/components/editor/FloatingToolbar';
import FileUploadButton from '@/components/ui/FileUploadButton';
import UploadedFilePreview from '@/components/ui/UploadedFilePreview';
import PagePermissionsDialog, { resolvePageRole } from '@/components/page/PagePermissionsDialog';
import SaveAsTemplateDialog from '@/components/templates/SaveAsTemplateDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

/** Extract plain text from blocks array for full-text search indexing. */
function blocksToSearchText(title, blocksArr) {
  const parts = [title || ''];
  for (const b of blocksArr) {
    if (!b) continue;
    // Strip HTML tags and add content
    const raw = (b.content || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
    if (raw.trim()) parts.push(raw.trim());
    // Also include todo content, callout emoji, etc.
    if (b.caption) parts.push(b.caption);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
}

export default function PageEditor() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentOrg, user } = useWorkspace();

  // Members list for @mention picker in comments
  const members = (currentOrg?.members || []).map((m) => ({
    email: m.email,
    name: m.full_name || m.email,
  }));
  const { viewers } = usePresence(pageId);

  // Inline comments: fetch all page comments for block indicators
  const { data: pageComments = [] } = useQuery({
    queryKey: ['comments', pageId],
    queryFn: () => Comment.filter({ page_id: pageId }),
    enabled: !!pageId,
  });

  // Build block_id → count map for comment indicators
  const blockCommentCounts = pageComments.reduce((acc, c) => {
    if (c.block_id && !c.parent_comment_id) {
      acc[c.block_id] = (acc[c.block_id] || 0) + 1;
    }
    return acc;
  }, {});

  const [blocks, setBlocks] = useState([]);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('📄');
  const [slashMenu, setSlashMenu] = useState(null);
  const [slashBlockId, setSlashBlockId] = useState(null);
  const [shareDialog, setShareDialog] = useState(false);
  const [moveDialog, setMoveDialog] = useState(false);
  const [moveSearch, setMoveSearch] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [selectedBlocks, setSelectedBlocks] = useState(new Set());
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [linkedTasksOpen, setLinkedTasksOpen] = useState(false);
  const [activeBlockComment, setActiveBlockComment] = useState(null); // blockId or null
  const [permissionsDialog, setPermissionsDialog] = useState(false);
  const [saveAsTemplateDialog, setSaveAsTemplateDialog] = useState(false);
  const [shareExpiry, setShareExpiry] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [sharePasswordChanged, setSharePasswordChanged] = useState(false);
  const titleRef = useRef(null);
  const slashBlockWasEmptyRef = useRef(false);
  const lastSelectedRef = useRef(null);

  // --- F21: Save status & performance refs ---
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const [conflictDetected, setConflictDetected] = useState(false);
  // Track whether user has unsaved local edits (prevents remote refetch from overwriting them)
  const isDirtyRef = useRef(false);
  // Last page ID we initialized for — detects navigation to a different page
  const pageIdInitRef = useRef(null);
  // Timestamp of last server sync — used to detect remote edits
  const lastSyncedAtRef = useRef(null);
  // Timer to auto-clear 'saved' status after 2 s
  const savedTimerRef = useRef(null);
  // Refs to current values — allow stable callbacks to read latest without capturing stale closures
  const blocksRef = useRef([]);
  const titleValRef = useRef('');
  const iconValRef = useRef('📄');
  const userValRef = useRef(null);
  const debouncedSaveRef = useRef(null);
  // Per-block stable callback cache keyed by block ID
  const blockCallbacksRef = useRef({});
  // Ref to current slashBlockId so handleSlashSelect can be fully stable
  const slashBlockIdRef = useRef(null);

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

  // Permissions: resolve current user's role for this page
  const isOrgAdmin = (currentOrg?.members || []).some(
    (m) => m.email === user?.email && (m.role === 'owner' || m.role === 'admin')
  );
  const parentPage = page?.parent_id ? allPages.find((p) => p.id === page.parent_id) : null;
  const myRole = isOrgAdmin ? 'owner' : (resolvePageRole(page, user?.email, parentPage) || 'editor');
  const isViewer = myRole === 'viewer';

  // Sync value refs so stable callbacks always read the latest values
  useEffect(() => { blocksRef.current = blocks; });
  useEffect(() => { titleValRef.current = title; });
  useEffect(() => { iconValRef.current = icon; });
  useEffect(() => { userValRef.current = user; });
  useEffect(() => { slashBlockIdRef.current = slashBlockId; }, [slashBlockId]);

  useEffect(() => {
    if (!page) return;
    const isNewPage = page.id !== pageIdInitRef.current;
    if (isNewPage) {
      // Navigation — always re-initialize, clear dirty state & callback cache
      pageIdInitRef.current = page.id;
      isDirtyRef.current = false;
      blockCallbacksRef.current = {};
      setConflictDetected(false);
      setSaveStatus('idle');
    } else if (isDirtyRef.current) {
      // Same page, user has local edits — check for remote conflict
      const remoteAt = page.updated_at?.toDate
        ? page.updated_at.toDate()
        : page.updated_at ? new Date(page.updated_at) : null;
      if (remoteAt && lastSyncedAtRef.current && remoteAt > lastSyncedAtRef.current) {
        setConflictDetected(true);
      }
      return; // don't overwrite local edits
    }
    // Safe to initialize / refresh from server
    setTitle(page.title || '');
    setIcon(page.icon || '📄');
    try {
      const parsed = JSON.parse(page.content || '[]');
      setBlocks(parsed.length > 0 ? parsed : [{ id: generateId(), type: 'paragraph', content: '' }]);
    } catch {
      setBlocks([{ id: generateId(), type: 'paragraph', content: '' }]);
    }
    const remoteAt = page.updated_at?.toDate
      ? page.updated_at.toDate()
      : page.updated_at ? new Date(page.updated_at) : null;
    lastSyncedAtRef.current = remoteAt;
  }, [page]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      await Page.update(pageId, data);
      // When saving content, sync title + last_edited_by to the linked record.
      // Uses dot-notation so only properties.title is merged; other properties untouched.
      // (created_at / created_by are never touched here — write-once semantics)
      if (page?.record_id && 'content' in data) {
        await DatabaseRecord.update(page.record_id, {
          'properties.title': data.title ?? page?.title ?? '',
          last_edited_by_email: data.last_edited_by_email ?? user?.email ?? '',
          last_edited_by_name: data.last_edited_by_name ?? user?.full_name ?? user?.email ?? '',
        });
      }
    },
    onSuccess: () => {
      isDirtyRef.current = false;
      clearTimeout(savedTimerRef.current);
      setSaveStatus('saved');
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
    onError: () => {
      setSaveStatus('idle');
      toast.error('Failed to save changes. Please try again.');
    },
  });

  const debouncedSave = useCallback(
    _.debounce((data) => {
      setSaveStatus('saving');
      saveMutation.mutate(data);
    }, 800),
    [pageId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Sync debouncedSave into a ref so stable callbacks can call it without capturing stale closure
  useEffect(() => { debouncedSaveRef.current = debouncedSave; }, [debouncedSave]);

  // Helper: build save payload from current refs + an optional blocks override
  const getSaveData = useCallback((newBlocks) => {
    const b = newBlocks ?? blocksRef.current;
    const t = titleValRef.current;
    const ic = iconValRef.current;
    const u = userValRef.current;
    return withLastEditedBy({
      content: JSON.stringify(b),
      title: t,
      icon: ic,
      search_text: blocksToSearchText(t, b),
    }, u);
  }, []);

  // Stable updateBlocks — used by bulk operations
  const updateBlocks = useCallback((newBlocks) => {
    isDirtyRef.current = true;
    blocksRef.current = newBlocks;
    setBlocks(newBlocks);
    debouncedSaveRef.current(getSaveData(newBlocks));
  }, [getSaveData]);

  // Stable updateTitle
  const updateTitle = useCallback((newTitle) => {
    isDirtyRef.current = true;
    titleValRef.current = newTitle;
    setTitle(newTitle);
    debouncedSaveRef.current({
      title: newTitle,
      content: JSON.stringify(blocksRef.current),
      icon: iconValRef.current,
      search_text: blocksToSearchText(newTitle, blocksRef.current),
      last_edited_by_name: userValRef.current?.full_name || userValRef.current?.email || '',
      last_edited_by_email: userValRef.current?.email || '',
    });
  }, []);

  // Stable updateIcon
  const updateIcon = useCallback((newIcon) => {
    isDirtyRef.current = true;
    iconValRef.current = newIcon;
    setIcon(newIcon);
    debouncedSaveRef.current(withLastEditedBy({
      title: titleValRef.current,
      content: JSON.stringify(blocksRef.current),
      icon: newIcon,
    }, userValRef.current));
  }, []);

  const updateCover = (coverData) => {
    saveMutation.mutate(coverData);
    queryClient.invalidateQueries({ queryKey: ['page', pageId] });
  };

  // Per-block stable callback factory — creates callbacks once per blockId and caches them.
  // Callbacks read current values via refs, so they never go stale.
  const getBlockCallbacks = useCallback((blockId) => {
    if (!blockCallbacksRef.current[blockId]) {
      blockCallbacksRef.current[blockId] = {
        onChange: (updated) => {
          isDirtyRef.current = true;
          const prev = blocksRef.current;
          const idx = prev.findIndex(b => b.id === blockId);
          if (idx < 0) return;
          const next = [...prev];
          next[idx] = updated;
          blocksRef.current = next;
          setBlocks(next);
          debouncedSaveRef.current({
            content: JSON.stringify(next),
            title: titleValRef.current,
            icon: iconValRef.current,
            search_text: blocksToSearchText(titleValRef.current, next),
            last_edited_by_name: userValRef.current?.full_name || userValRef.current?.email || '',
            last_edited_by_email: userValRef.current?.email || '',
          });
        },
        onDelete: () => {
          isDirtyRef.current = true;
          const prev = blocksRef.current;
          if (prev.length <= 1) return;
          const next = prev.filter(b => b.id !== blockId);
          blocksRef.current = next;
          setBlocks(next);
          debouncedSaveRef.current({
            content: JSON.stringify(next),
            title: titleValRef.current,
            icon: iconValRef.current,
            search_text: blocksToSearchText(titleValRef.current, next),
            last_edited_by_name: userValRef.current?.full_name || userValRef.current?.email || '',
            last_edited_by_email: userValRef.current?.email || '',
          });
        },
        onAddAfter: () => {
          isDirtyRef.current = true;
          const prev = blocksRef.current;
          const idx = prev.findIndex(b => b.id === blockId);
          const newBlock = { id: generateId(), type: 'paragraph', content: '' };
          const next = [...prev];
          next.splice(idx + 1, 0, newBlock);
          blocksRef.current = next;
          setBlocks(next);
          debouncedSaveRef.current({
            content: JSON.stringify(next),
            title: titleValRef.current,
            icon: iconValRef.current,
            search_text: blocksToSearchText(titleValRef.current, next),
            last_edited_by_name: userValRef.current?.full_name || userValRef.current?.email || '',
            last_edited_by_email: userValRef.current?.email || '',
          });
        },
        onMoveUp: () => {
          isDirtyRef.current = true;
          const prev = blocksRef.current;
          const idx = prev.findIndex(b => b.id === blockId);
          if (idx <= 0) return;
          const next = [...prev];
          [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
          blocksRef.current = next;
          setBlocks(next);
          debouncedSaveRef.current({
            content: JSON.stringify(next),
            title: titleValRef.current,
            icon: iconValRef.current,
            search_text: blocksToSearchText(titleValRef.current, next),
            last_edited_by_name: userValRef.current?.full_name || userValRef.current?.email || '',
            last_edited_by_email: userValRef.current?.email || '',
          });
        },
        onMoveDown: () => {
          isDirtyRef.current = true;
          const prev = blocksRef.current;
          const idx = prev.findIndex(b => b.id === blockId);
          if (idx >= prev.length - 1) return;
          const next = [...prev];
          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
          blocksRef.current = next;
          setBlocks(next);
          debouncedSaveRef.current({
            content: JSON.stringify(next),
            title: titleValRef.current,
            icon: iconValRef.current,
            search_text: blocksToSearchText(titleValRef.current, next),
            last_edited_by_name: userValRef.current?.full_name || userValRef.current?.email || '',
            last_edited_by_email: userValRef.current?.email || '',
          });
        },
        onDuplicate: () => {
          isDirtyRef.current = true;
          const prev = blocksRef.current;
          const idx = prev.findIndex(b => b.id === blockId);
          const next = [...prev];
          next.splice(idx + 1, 0, { ...prev[idx], id: generateId() });
          blocksRef.current = next;
          setBlocks(next);
          debouncedSaveRef.current({
            content: JSON.stringify(next),
            title: titleValRef.current,
            icon: iconValRef.current,
            search_text: blocksToSearchText(titleValRef.current, next),
            last_edited_by_name: userValRef.current?.full_name || userValRef.current?.email || '',
            last_edited_by_email: userValRef.current?.email || '',
          });
        },
        onPasteBlocks: (parsedBlocks) => {
          isDirtyRef.current = true;
          const prev = blocksRef.current;
          const idx = prev.findIndex(b => b.id === blockId);
          const items = parsedBlocks.map(b => ({ ...b, id: generateId() }));
          const next = [...prev];
          next.splice(idx + 1, 0, ...items);
          blocksRef.current = next;
          setBlocks(next);
          debouncedSaveRef.current({
            content: JSON.stringify(next),
            title: titleValRef.current,
            icon: iconValRef.current,
            search_text: blocksToSearchText(titleValRef.current, next),
            last_edited_by_name: userValRef.current?.full_name || userValRef.current?.email || '',
            last_edited_by_email: userValRef.current?.email || '',
          });
        },
      };
    }
    return blockCallbacksRef.current[blockId];
  }, []); // stable — all reads are through refs

  // Stable shared handlers
  const handleSlashCommand = useCallback((e, block) => {
    const rect = e.target.getBoundingClientRect();
    slashBlockWasEmptyRef.current = !block.content || block.content === '<br>';
    setSlashMenu({ top: rect.bottom + 4, left: rect.left });
    setSlashBlockId(block.id);
  }, []);

  const handleSlashSelect = useCallback((type) => {
    const blockId = slashBlockIdRef.current;
    if (!blockId) return;
    isDirtyRef.current = true;
    const prev = blocksRef.current;
    const idx = prev.findIndex(b => b.id === blockId);
    if (idx < 0) { setSlashMenu(null); setSlashBlockId(null); return; }
    const extras = {
      ...(type === 'callout' ? { emoji: '💡', color: 'blue' } : {}),
      ...(type === 'todo' ? { checked: false } : {}),
    };
    const next = [...prev];
    if (slashBlockWasEmptyRef.current) {
      next[idx] = { ...next[idx], type, content: '', ...extras };
    } else {
      next.splice(idx + 1, 0, { id: generateId(), type, content: '', ...extras });
    }
    blocksRef.current = next;
    setBlocks(next);
    debouncedSaveRef.current({
      content: JSON.stringify(next),
      title: titleValRef.current,
      icon: iconValRef.current,
      search_text: blocksToSearchText(titleValRef.current, next),
      last_edited_by_name: userValRef.current?.full_name || userValRef.current?.email || '',
      last_edited_by_email: userValRef.current?.email || '',
    });
    setSlashMenu(null);
    setSlashBlockId(null);
  }, []);

  const clearSelection = useCallback(() => setSelectedBlocks(new Set()), []);

  const handleBlockSelectClick = useCallback((blockId, e) => {
    e.stopPropagation();
    setSelectedBlocks(prev => {
      const next = new Set(prev);
      if (e.shiftKey && lastSelectedRef.current) {
        const ids = blocksRef.current.map(b => b.id);
        const a = ids.indexOf(lastSelectedRef.current);
        const bIdx = ids.indexOf(blockId);
        const [start, end] = a < bIdx ? [a, bIdx] : [bIdx, a];
        ids.slice(start, end + 1).forEach(id => next.add(id));
      } else if (e.ctrlKey || e.metaKey) {
        if (next.has(blockId)) next.delete(blockId);
        else next.add(blockId);
      } else {
        if (next.has(blockId) && next.size === 1) next.clear();
        else { next.clear(); next.add(blockId); }
      }
      lastSelectedRef.current = blockId;
      return next;
    });
  }, []);

  const handleDragEnd = useCallback((result) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;
    isDirtyRef.current = true;
    const prev = blocksRef.current;
    const next = [...prev];
    const [moved] = next.splice(source.index, 1);
    next.splice(destination.index, 0, moved);
    blocksRef.current = next;
    setBlocks(next);
    debouncedSaveRef.current({
      content: JSON.stringify(next),
      title: titleValRef.current,
      icon: iconValRef.current,
      search_text: blocksToSearchText(titleValRef.current, next),
      last_edited_by_name: userValRef.current?.full_name || userValRef.current?.email || '',
      last_edited_by_email: userValRef.current?.email || '',
    });
  }, []);

  const handleCommentClick = useCallback((id) => setActiveBlockComment(id), []);

  const handleBulkDelete = () => {
    const remaining = blocks.filter(b => !selectedBlocks.has(b.id));
    updateBlocks(remaining.length > 0 ? remaining : [{ id: generateId(), type: 'paragraph', content: '' }]);
    clearSelection();
  };

  const handleBulkDuplicate = () => {
    const newBlocks = [];
    blocks.forEach(b => {
      newBlocks.push(b);
      if (selectedBlocks.has(b.id)) newBlocks.push({ ...b, id: generateId() });
    });
    updateBlocks(newBlocks);
    clearSelection();
  };

  const handleBulkMoveUp = () => {
    const selectedIds = blocks.filter(b => selectedBlocks.has(b.id)).map(b => b.id);
    if (!selectedIds.length) return;
    const firstIdx = blocks.findIndex(b => b.id === selectedIds[0]);
    if (firstIdx === 0) return;
    const newBlocks = [...blocks];
    const selected = newBlocks.splice(firstIdx, selectedIds.length);
    newBlocks.splice(firstIdx - 1, 0, ...selected);
    updateBlocks(newBlocks);
  };

  const handleBulkMoveDown = () => {
    const selectedIds = blocks.filter(b => selectedBlocks.has(b.id)).map(b => b.id);
    if (!selectedIds.length) return;
    const lastIdx = blocks.findIndex(b => b.id === selectedIds[selectedIds.length - 1]);
    if (lastIdx >= blocks.length - 1) return;
    const newBlocks = [...blocks];
    const firstIdx = blocks.findIndex(b => b.id === selectedIds[0]);
    const selected = newBlocks.splice(firstIdx, selectedIds.length);
    newBlocks.splice(firstIdx + 1, 0, ...selected);
    updateBlocks(newBlocks);
  };

  const handleBulkConvert = (type) => {
    updateBlocks(blocks.map(b => selectedBlocks.has(b.id) ? { ...b, type } : b));
    clearSelection();
  };

  const toggleFavorite = () => {
    saveMutation.mutate(withLastEditedBy({ is_favorite: !page?.is_favorite }, user));
  };

  const toggleLock = () => {
    saveMutation.mutate(withLastEditedBy({ is_locked: !page?.is_locked }, user));
    toast(page?.is_locked ? 'Page unlocked' : 'Page locked');
  };

  const toggleFullWidth = () => {
    saveMutation.mutate(withLastEditedBy({ is_full_width: !page?.is_full_width }, user));
  };

  const handleDelete = () => {
    saveMutation.mutate(withLastEditedBy({ is_deleted: true, deleted_at: new Date().toISOString() }, user));
    navigate('/');
  };

  const handleShare = async () => {
    const token = page?.share_token || generateId() + generateId();
    await Page.update(pageId, withLastEditedBy({ share_token: token, is_shared: true }, user));
    queryClient.invalidateQueries({ queryKey: ['page', pageId] });
    queryClient.invalidateQueries({ queryKey: ['pages'] });
    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Share link copied to clipboard!');
    setShareDialog(false);
  };



  const handleUpload = (result) => {
    setAttachments(prev => [...prev, result]);
    if (result.resourceType === 'image') {
      const imageBlock = {
        id: generateId(),
        type: 'image',
        url: result.url,
        content: '',
      };
      setBlocks(prev => {
        const updated = [...prev, imageBlock];
        debouncedSave({ content: JSON.stringify(updated), title, icon });
        return updated;
      });
    }
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
      <PageOutline blocks={blocks} isOpen={outlineOpen} onClose={() => setOutlineOpen(false)} />
      {linkedTasksOpen && (
        <LinkedTasksPanel
          pageId={pageId}
          pageTitle={title}
          onClose={() => setLinkedTasksOpen(false)}
        />
      )}
      {activeBlockComment && (
        <InlineCommentThread
          blockId={activeBlockComment}
          pageId={pageId}
          orgId={currentOrg?.id}
          members={members}
          onClose={() => setActiveBlockComment(null)}
        />
      )}
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

          {/* Save status indicator */}
          <div className="flex items-center gap-1 ml-3 shrink-0">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Viewer presence avatars */}
            {viewers.length > 0 && (
              <div className="flex items-center -space-x-2 mr-1">
                {viewers.slice(0, 4).map((v) => (
                  <span
                    key={v.uid}
                    title={`${v.name || v.email} is viewing`}
                    className="h-6 w-6 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-[10px] font-bold text-primary"
                  >
                    {(v.name || v.email || '?').charAt(0).toUpperCase()}
                  </span>
                ))}
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleFavorite}>
              <Star className={cn('h-4 w-4', page.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShareDialog(true)} title="Share page">
              <Share2 className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPermissionsDialog(true)} title="Page permissions">
              <Shield className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7', linkedTasksOpen && 'bg-accent')}
              onClick={() => setLinkedTasksOpen((v) => !v)}
              title="Linked tasks"
            >
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7', outlineOpen && 'bg-accent')}
              onClick={() => setOutlineOpen(v => !v)}
              title="Page outline"
            >
              <PanelRight className="h-4 w-4 text-muted-foreground" />
            </Button>
            {!page?.is_locked && (
              <FileUploadButton
                folder="xponet/pages"
                onUpload={handleUpload}
                label="Upload"
                accept="image/*,application/pdf,.doc,.docx,.txt,.mp4,.mov"
                size="sm"
                variant="ghost"
              />
            )}
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
                    org_id: currentOrg?.id, parent_id: page.parent_id,
                    created_by_email: user?.email || '',
                    created_by_name: user?.full_name || user?.email || '',
                    category: null,
                    reviewers: [],
                  });
                  queryClient.invalidateQueries({ queryKey: ['pages'] });
                  navigate(`/page/${dup.id}`);
                }}>
                  <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSaveAsTemplateDialog(true)}>
                  <LayoutTemplate className="h-3.5 w-3.5 mr-2" /> Save as template
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
        {/* Conflict banner */}
        {conflictDetected && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg text-sm text-orange-700 dark:text-orange-400">
            <span className="font-medium shrink-0">⚠️ Remote changes detected.</span>
            <span className="flex-1 text-xs">Someone else may have edited this page since you started.</span>
            <div className="flex gap-3 shrink-0">
              <button
                className="text-xs font-medium underline hover:no-underline"
                onClick={() => {
                  isDirtyRef.current = false;
                  setConflictDetected(false);
                  queryClient.invalidateQueries({ queryKey: ['page', pageId] });
                }}
              >Load latest</button>
              <button
                className="text-xs font-medium underline hover:no-underline"
                onClick={() => setConflictDetected(false)}
              >Keep mine</button>
            </div>
          </div>
        )}

        {/* Viewer-access banner */}
        {isViewer && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
            <Eye className="h-4 w-4 shrink-0" />
            <span>You have <strong>viewer access</strong> to this page — editing is disabled.</span>
          </div>
        )}

        {/* Add cover button */}
        {!page.cover_url && !page.is_locked && !isViewer && (
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
          disabled={page.is_locked || isViewer}
        />

        {/* Last edited by hint */}
        {page.last_edited_by_name && page.updated_at && (
          <p className="text-xs text-muted-foreground mb-4 -mt-4">
            Last edited by {page.last_edited_by_name} · {formatDistanceToNow(
              page.updated_at?.toDate ? page.updated_at.toDate() : new Date(page.updated_at),
              { addSuffix: true }
            )}
          </p>
        )}

        {/* Blocks */}
        {!page.is_locked && !isViewer && (
          <>
            {/* Bulk selection toolbar */}
            {selectedBlocks.size > 0 && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                <span className="text-muted-foreground">{selectedBlocks.size} block{selectedBlocks.size > 1 ? 's' : ''} selected</span>
                <div className="flex items-center gap-1 ml-auto">
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleBulkMoveUp} title="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleBulkMoveDown} title="Move down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleBulkDuplicate} title="Duplicate">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 px-2" title="Convert type">
                        <Type className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {['paragraph','heading1','heading2','heading3','bullet','numbered','todo','quote'].map(t => (
                        <DropdownMenuItem key={t} onClick={() => handleBulkConvert(t)}>{t}</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" onClick={handleBulkDelete} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={clearSelection} title="Clear selection">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="blocks">
                {(droppableProvided) => (
                  <div
                    ref={droppableProvided.innerRef}
                    {...droppableProvided.droppableProps}
                    className="pl-8 space-y-0.5"
                    onClick={() => clearSelection()}
                  >
                    {blocks.map((block, index) => {
                      const cbs = getBlockCallbacks(block.id);
                      return (
                        <Draggable key={block.id} draggableId={block.id} index={index}>
                          {(draggableProvided, draggableSnapshot) => (
                            <MemoBlockRenderer
                              block={block}
                              fontStyle={fontStyle}
                              allBlocks={blocks}
                              onChange={cbs.onChange}
                              onDelete={cbs.onDelete}
                              onAddAfter={cbs.onAddAfter}
                              onSlash={handleSlashCommand}
                              onPasteBlocks={cbs.onPasteBlocks}
                              onMoveUp={cbs.onMoveUp}
                              onMoveDown={cbs.onMoveDown}
                              onDuplicate={cbs.onDuplicate}
                              onBlockSelect={handleBlockSelectClick}
                              isSelected={selectedBlocks.has(block.id)}
                              innerRef={draggableProvided.innerRef}
                              draggableProps={draggableProvided.draggableProps}
                              dragHandleProps={draggableProvided.dragHandleProps}
                              isDragging={draggableSnapshot.isDragging}
                              commentCount={blockCommentCounts[block.id] || 0}
                              onCommentClick={handleCommentClick}
                            />
                          )}
                        </Draggable>
                      );
                    })}
                    {droppableProvided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </>
        )}

        {(page.is_locked || isViewer) && (
          <div className="pl-8 space-y-0.5 opacity-80 pointer-events-none">
            {blocks.map((block) => (
              <BlockRenderer
                key={block.id}
                block={block}
                fontStyle={fontStyle}
                allBlocks={blocks}
                onChange={() => {}}
                onDelete={() => {}}
                onAddAfter={() => {}}
                commentCount={blockCommentCounts[block.id] || 0}
                onCommentClick={(id) => setActiveBlockComment(id)}
              />
            ))}
          </div>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="mt-6 px-4 border-t pt-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">
              Attachments ({attachments.length})
            </p>
            <div className="flex flex-wrap gap-3">
              {attachments.map((file, i) => (
                <UploadedFilePreview
                  key={i}
                  file={file}
                  onRemove={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        <CommentsSection pageId={pageId} orgId={currentOrg?.id} members={members} />
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
            <DialogDescription className="sr-only">Select a page to move this page under.</DialogDescription>
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
                  await Page.update(pageId, withLastEditedBy({ parent_id: null }, user));
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
                      await Page.update(pageId, withLastEditedBy({ parent_id: p.id }, user));
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

      {/* Share dialog — upgraded */}
      <Dialog open={shareDialog} onOpenChange={(v) => {
        if (!v) { setSharePasswordChanged(false); setSharePassword(''); }
        setShareDialog(v);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              Share to web
            </DialogTitle>
            <DialogDescription className="sr-only">Share this page publicly via a link.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Enable sharing toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Public access</p>
                <p className="text-xs text-muted-foreground">Anyone with the link can view</p>
              </div>
              <Switch checked={!!page.share_token} onCheckedChange={async (checked) => {
                if (checked) {
                  const token = page?.share_token || generateId() + generateId();
                  await Page.update(pageId, withLastEditedBy({ share_token: token, is_shared: true }, user));
                  queryClient.invalidateQueries({ queryKey: ['page', pageId] });
                  queryClient.invalidateQueries({ queryKey: ['pages'] });
                } else {
                  await Page.update(pageId, withLastEditedBy({ share_token: null, share_password: null, share_expires_at: null, is_shared: false }, user));
                  queryClient.invalidateQueries({ queryKey: ['page', pageId] });
                  queryClient.invalidateQueries({ queryKey: ['pages'] });
                }
              }} />
            </div>

            {page.share_token && (
              <>
                {/* Copy link */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Public link</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}/shared/${page.share_token}`}
                      className="text-sm bg-muted"
                    />
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/shared/${page.share_token}`);
                        toast.success('Link copied!');
                      }}
                      size="sm" variant="outline"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                    </Button>
                  </div>
                  <button
                    className="text-xs text-primary flex items-center gap-1 hover:underline"
                    onClick={() => window.open(`/shared/${page.share_token}`, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3" /> Preview as visitor
                  </button>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Password <span className="font-normal">(optional)</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder={page.share_password ? '••••••••' : 'No password set'}
                      value={sharePasswordChanged ? sharePassword : ''}
                      onChange={(e) => { setSharePassword(e.target.value); setSharePasswordChanged(true); }}
                      className="text-sm"
                    />
                    <Button
                      size="sm" variant="outline"
                      onClick={async () => {
                        const pw = sharePasswordChanged ? sharePassword : page.share_password;
                        await Page.update(pageId, withLastEditedBy({ share_password: pw || null }, user));
                        queryClient.invalidateQueries({ queryKey: ['page', pageId] });
                        setSharePasswordChanged(false);
                        setSharePassword('');
                        toast.success(pw ? 'Password saved' : 'Password cleared');
                      }}
                    >
                      Save
                    </Button>
                    {page.share_password && (
                      <Button
                        size="sm" variant="ghost"
                        onClick={async () => {
                          await Page.update(pageId, withLastEditedBy({ share_password: null }, user));
                          queryClient.invalidateQueries({ queryKey: ['page', pageId] });
                          setSharePasswordChanged(false);
                          setSharePassword('');
                          toast.success('Password cleared');
                        }}
                        title="Clear password"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Link expiry */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Link expires <span className="font-normal">(optional)</span>
                  </Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="datetime-local"
                      value={shareExpiry || (page.share_expires_at ? new Date(page.share_expires_at).toISOString().slice(0, 16) : '')}
                      onChange={(e) => setShareExpiry(e.target.value)}
                      className="text-sm"
                    />
                    <Button
                      size="sm" variant="outline"
                      onClick={async () => {
                        const expiryVal = shareExpiry;
                        await Page.update(pageId, withLastEditedBy({ share_expires_at: expiryVal ? new Date(expiryVal).toISOString() : null }, user));
                        queryClient.invalidateQueries({ queryKey: ['page', pageId] });
                        setShareExpiry('');
                        toast.success(expiryVal ? `Link expires ${format(new Date(expiryVal), 'MMM d, yyyy h:mm a')}` : 'Expiry removed');
                      }}
                    >
                      Set
                    </Button>
                    {page.share_expires_at && (
                      <Button
                        size="sm" variant="ghost"
                        onClick={async () => {
                          await Page.update(pageId, withLastEditedBy({ share_expires_at: null }, user));
                          queryClient.invalidateQueries({ queryKey: ['page', pageId] });
                          setShareExpiry('');
                          toast.success('Expiry removed');
                        }}
                        title="Remove expiry"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {page.share_expires_at && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Expires {format(new Date(page.share_expires_at), 'MMM d, yyyy · h:mm a')}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions dialog */}
      <PagePermissionsDialog
        open={permissionsDialog}
        onOpenChange={setPermissionsDialog}
        page={page}
        orgMembers={currentOrg?.members || []}
        onSave={async (updates) => {
          await Page.update(pageId, withLastEditedBy(updates, user));
          queryClient.invalidateQueries({ queryKey: ['page', pageId] });
          queryClient.invalidateQueries({ queryKey: ['pages'] });
          toast.success('Permissions saved');
        }}
      />

      {/* Save as template dialog */}
      <SaveAsTemplateDialog
        open={saveAsTemplateDialog}
        onOpenChange={setSaveAsTemplateDialog}
        page={page}
        blocks={blocks}
        orgId={currentOrg?.id}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['templates', currentOrg?.id] })}
      />
    </div>
  );
}