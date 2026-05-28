import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Page, Notification, Database, withLastEditedBy } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { usePeek } from '@/contexts/PeekContext';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Home, Search, Inbox, Plus, Settings, FileText, Trash2,
  ChevronDown, ChevronRight, MoreHorizontal, ChevronsLeft,
  LayoutTemplate, Star, Lock, ClipboardList, Database as DbIcon,
  PanelRightOpen, Ticket, LayoutDashboard, BookOpen, Table2, Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getPageRoute } from '@/lib/pageRouter';

// Flat, non-recursive page row — rendered by the virtualizer
function PageRow({ page, level, hasChildren, isExpanded, activePath, onToggle, onCreateChild, onDelete, onRename, onFavorite, databases }) {
  const isDbPage = !!page.is_database;
  const pageHref = getPageRoute(page, databases);
  const isActive = isDbPage
    ? activePath.startsWith('/document-hub')
    : activePath === `/page/${page.id}`;

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef(null);
  const navigate = useNavigate();
  const { openPeek } = usePeek();

  // Focus + select all when rename mode activates
  useEffect(() => {
    if (isRenaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [isRenaming]);

  const startRename = () => {
    setRenameValue(page.title || '');
    setIsRenaming(true);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== page.title) onRename(page.id, trimmed);
    setIsRenaming(false);
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-1 py-1 rounded-md text-sm cursor-pointer transition-colors',
        isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
      )}
      style={{ paddingLeft: `${8 + level * 16}px`, paddingRight: '4px' }}
    >
      {/* Expand / collapse chevron */}
      {hasChildren ? (
        <button onClick={() => onToggle(page.id)} className="p-0.5 hover:bg-sidebar-accent rounded shrink-0">
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}

      {/* Title — link or inline rename input */}
      {isRenaming ? (
        <input
          ref={renameRef}
          value={renameValue}
          onChange={e => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
            if (e.key === 'Escape') { setIsRenaming(false); }
          }}
          className="flex-1 min-w-0 bg-background text-sm px-1.5 py-0.5 rounded border border-ring outline-none"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <Link to={pageHref} className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
          {isDbPage
            ? <Table2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            : <span className="text-sm leading-none shrink-0">{page.icon || '\uD83D\uDCC4'}</span>
          }
          <span className="truncate">{page.title || 'Untitled'}</span>
        </Link>
      )}

      {/* Hover action buttons */}
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 ml-auto">
        <button
          className="p-0.5 rounded hover:bg-sidebar-accent"
          title="Add child page"
          onClick={e => { e.preventDefault(); onCreateChild(page.id, page.org_id); }}
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-0.5 rounded hover:bg-sidebar-accent">
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-48">
            <DropdownMenuItem onSelect={() => navigate(pageHref)}>
              <FileText className="h-3.5 w-3.5 mr-2" />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={startRename}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onFavorite(page.id, !!page.is_favorite)}>
              <Star className="h-3.5 w-3.5 mr-2" />
              {page.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onDelete(page.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          className="p-0.5 rounded hover:bg-sidebar-accent"
          title="Open in peek panel"
          onClick={e => { e.preventDefault(); e.stopPropagation(); openPeek(page.id); }}
        >
          <PanelRightOpen className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ onOpenSearch }) {
  const { currentOrg, sidebarOpen, setSidebarOpen, user } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [privateOpen, setPrivateOpen] = useState(true);
  const [sharedOpen, setSharedOpen] = useState(true);
  // Lifted expand state for the page tree (replaces per-item useState)
  const [expandedIds, setExpandedIds] = useState(new Set());

  const { data: pages = [] } = useQuery({
    queryKey: ['pages', currentOrg?.id],
    queryFn: () => Page.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: () => Notification.filter({ recipient_email: user?.email, is_read: false }),
    enabled: !!user?.email
  });

  // Fetch all databases so page rows can route any database page correctly
  const { data: databases = [] } = useQuery({
    queryKey: ['databases', currentOrg?.id],
    queryFn: () => Database.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id,
    staleTime: 5 * 60 * 1000,
  });
  const hubDb = databases.find((db) => db.name === 'Document Hub');

  const activePages = pages.filter(p => !p.is_deleted && !p.is_template);
  const privatePages = activePages.filter(p => !p.is_shared && !p.parent_id && p.created_by === user?.email);
  const sharedPages = activePages.filter(p => p.is_shared && !p.parent_id);
  const trashedCount = pages.filter(p => p.is_deleted).length;
  const unreadCount = notifications.length;

  // Flatten the visible tree into a single list for virtualization.
  // Each item: { type: 'header'|'page', page?, label?, level, hasChildren, isExpanded, section }
  const flatItems = useMemo(() => {
    const items = [];

    const addTree = (roots, section) => {
      const addChildren = (parentId, level) => {
        const children = activePages.filter(p => p.parent_id === parentId);
        for (const page of children) {
          const hasChildren = activePages.some(p => p.parent_id === page.id);
          const isExpanded = expandedIds.has(page.id);
          items.push({ type: 'page', page, level, hasChildren, isExpanded, section });
          if (isExpanded) addChildren(page.id, level + 1);
        }
      };

      for (const page of roots) {
        const hasChildren = activePages.some(p => p.parent_id === page.id);
        const isExpanded = expandedIds.has(page.id);
        items.push({ type: 'page', page, level: 0, hasChildren, isExpanded, section });
        if (isExpanded) addChildren(page.id, 1);
      }
    };

    items.push({ type: 'header', label: 'Private', section: 'private', open: privateOpen });
    if (privateOpen) addTree(privatePages, 'private');

    items.push({ type: 'header', label: 'Shared', section: 'shared', open: sharedOpen });
    if (sharedOpen) addTree(sharedPages, 'shared');

    return items;
  }, [activePages, privatePages, sharedPages, expandedIds, privateOpen, sharedOpen]);

  const scrollRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    overscan: 8,
  });

  const toggleExpanded = useCallback((id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDelete = useCallback(async (pageId) => {
    await Page.update(pageId, withLastEditedBy({ is_deleted: true, deleted_at: new Date().toISOString() }, user));
    queryClient.invalidateQueries({ queryKey: ['pages'] });
  }, [queryClient, user]);

  const handleRename = useCallback(async (pageId, title) => {
    await Page.update(pageId, withLastEditedBy({ title }, user));
    queryClient.invalidateQueries({ queryKey: ['pages'] });
  }, [queryClient, user]);

  const handleFavorite = useCallback(async (pageId, isFavorite) => {
    await Page.update(pageId, { is_favorite: !isFavorite });
    queryClient.invalidateQueries({ queryKey: ['pages'] });
  }, [queryClient]);

  const handleCreateChild = useCallback(async (parentId, orgId) => {
    const newPage = await Page.create({
      title: 'Untitled', icon: '📄', org_id: orgId, parent_id: parentId,
      content: JSON.stringify([{ id: '1', type: 'paragraph', content: '' }]),
      created_by_email: user?.email || '',
      created_by_name: user?.full_name || user?.email || '',
      category: null,
      reviewers: [],
    });
    queryClient.invalidateQueries({ queryKey: ['pages'] });
    setExpandedIds(prev => new Set([...prev, parentId]));
    navigate(`/page/${newPage.id}`);
  }, [queryClient, navigate, user]);

  const createPage = useMutation({
    mutationFn: () => Page.create({
      title: 'Untitled',
      icon: '📄',
      org_id: currentOrg?.id,
      content: JSON.stringify([{ id: '1', type: 'paragraph', content: '' }]),
      created_by_email: user?.email || '',
      created_by_name: user?.full_name || user?.email || '',
      category: null,
      reviewers: [],
    }),
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      navigate(`/page/${page.id}`);
    }
  });

  if (!sidebarOpen) {
    return (
      <div className="fixed top-3 left-3 z-30">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="h-8 w-8 bg-background/80 backdrop-blur border shadow-sm">
          <ChevronsLeft className="h-4 w-4 rotate-180" />
        </Button>
      </div>
    );
  }

  return (
    <aside className="w-[240px] h-screen flex flex-col bg-sidebar border-r border-sidebar-border shrink-0 select-none">
      {/* Workspace header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-sidebar-border">
        <Link to="/settings" className="flex items-center gap-2 hover:bg-sidebar-accent rounded-md px-1.5 py-1 transition-colors min-w-0">
          <span className="text-lg">{currentOrg?.icon || '🏠'}</span>
          <span className="font-semibold text-sm truncate">{currentOrg?.name || 'Workspace'}</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0">
          <ChevronsLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <div className="px-2 py-2 space-y-0.5">
        <button onClick={onOpenSearch} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span>Search</span>
          <kbd className="ml-auto text-[10px] text-muted-foreground bg-sidebar-accent px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>
        <Link to="/" className={cn(
          'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors',
          location.pathname === '/' ? 'bg-sidebar-accent font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
        )}>
          <Home className="h-4 w-4 text-muted-foreground" />
          <span>Home</span>
        </Link>
        <Link to="/inbox" className={cn(
          'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors',
          location.pathname === '/inbox' ? 'bg-sidebar-accent font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
        )}>
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <span>Inbox</span>
          {unreadCount > 0 && (
            <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {unreadCount}
            </span>
          )}
        </Link>
        <Link to="/tasks" className={cn(
          'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors',
          location.pathname === '/tasks' ? 'bg-sidebar-accent font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
        )}>
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <span>Tasks</span>
        </Link>
        <Link to="/tickets" className={cn(
          'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors',
          location.pathname.startsWith('/ticket') ? 'bg-sidebar-accent font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
        )}>
          <Ticket className="h-4 w-4 text-muted-foreground" />
          <span>Tickets</span>
        </Link>
        <Link to="/command-center" className={cn(
          'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors',
          location.pathname === '/command-center' ? 'bg-sidebar-accent font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
        )}>
          <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
          <span>Command Center</span>
        </Link>
        <Link to="/databases" className={cn(
          'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors',
          location.pathname.startsWith('/database') ? 'bg-sidebar-accent font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
        )}>
          <DbIcon className="h-4 w-4 text-muted-foreground" />
          <span>Databases</span>
        </Link>
        <Link to={hubDb?.id ? `/document-hub/${hubDb.id}` : '/document-hub'} className={cn(
          'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors',
          location.pathname.startsWith('/document-hub') ? 'bg-sidebar-accent font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
        )}>
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span>Document Hub</span>
        </Link>
      </div>

      {/* Virtualized page tree */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-1">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const item = flatItems[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{ position: 'absolute', top: virtualRow.start, left: 0, right: 0 }}
              >
                {item.type === 'header' ? (
                  <button
                    onClick={() => item.section === 'private' ? setPrivateOpen(v => !v) : setSharedOpen(v => !v)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {item.label}
                  </button>
                ) : (
                  <PageRow
                    page={item.page}
                    level={item.level}
                    hasChildren={item.hasChildren}
                    isExpanded={item.isExpanded}
                    activePath={location.pathname}
                    onToggle={toggleExpanded}
                    onCreateChild={handleCreateChild}
                    onDelete={handleDelete}
                    onRename={handleRename}
                    onFavorite={handleFavorite}
                    databases={databases}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* New Page button */}
      <div className="px-3 py-2">
        <Button onClick={() => createPage.mutate()} className="w-full justify-start gap-2 bg-primary/10 text-primary hover:bg-primary/20 border-0" variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          New Page
        </Button>
      </div>

      {/* Bottom nav */}
      <div className="px-2 py-2 border-t border-sidebar-border space-y-0.5">
        <Link to="/settings" className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors">
          <Settings className="h-4 w-4 text-muted-foreground" /> Settings
        </Link>
        <Link to="/templates" className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors">
          <LayoutTemplate className="h-4 w-4 text-muted-foreground" /> Templates
        </Link>
        <Link to="/trash" className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors">
          <Trash2 className="h-4 w-4 text-muted-foreground" /> Trash
          {trashedCount > 0 && (
            <span className="ml-auto text-[10px] text-muted-foreground bg-sidebar-accent px-1.5 py-0.5 rounded-full">{trashedCount}</span>
          )}
        </Link>
      </div>
    </aside>
  );
}