import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Page, Notification } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  Home, Search, Inbox, Plus, Settings, FileText, Trash2,
  ChevronDown, ChevronRight, MoreHorizontal, ChevronsLeft,
  LayoutTemplate, Star, Lock, ClipboardList
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

function PageTreeItem({ page, pages, level = 0, activePath }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const children = pages.filter(p => p.parent_id === page.id && !p.is_deleted && !p.is_template);
  const isActive = activePath === `/page/${page.id}`;

  const deleteMutation = useMutation({
    mutationFn: () => Page.update(page.id, { is_deleted: true, deleted_at: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages'] })
  });

  const createSubpage = useMutation({
    mutationFn: () => Page.create({
      title: 'Untitled',
      icon: '📄',
      org_id: page.org_id,
      parent_id: page.id,
      content: JSON.stringify([{ id: '1', type: 'paragraph', content: '' }])
    }),
    onSuccess: (newPage) => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      navigate(`/page/${newPage.id}`);
    }
  });

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1 rounded-md text-sm cursor-pointer transition-colors',
          isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
        )}
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        {children.length > 0 ? (
          <button onClick={() => setOpen(!open)} className="p-0.5 hover:bg-sidebar-accent rounded shrink-0">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <Link to={`/page/${page.id}`} className="flex items-center gap-1.5 flex-1 min-w-0 truncate">
          <span className="text-sm shrink-0">{page.icon || '📄'}</span>
          <span className="truncate">{page.title || 'Untitled'}</span>
        </Link>

        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-0.5 rounded hover:bg-sidebar-accent">
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => deleteMutation.mutate()}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                const dup = await Page.create({
                  ...page, id: undefined, created_date: undefined, updated_date: undefined, created_by: undefined,
                  title: `${page.title} (copy)`
                });
                queryClient.invalidateQueries({ queryKey: ['pages'] });
                navigate(`/page/${dup.id}`);
              }}>
                <FileText className="h-3.5 w-3.5 mr-2" /> Duplicate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button className="p-0.5 rounded hover:bg-sidebar-accent" onClick={() => createSubpage.mutate()}>
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {open && children.length > 0 && (
        <div>
          {children.map(child => (
            <PageTreeItem key={child.id} page={child} pages={pages} level={level + 1} activePath={activePath} />
          ))}
        </div>
      )}
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

  const activePages = pages.filter(p => !p.is_deleted && !p.is_template);
  const privatePages = activePages.filter(p => !p.is_shared && !p.parent_id && p.created_by === user?.email);
  const sharedPages = activePages.filter(p => p.is_shared && !p.parent_id);
  const trashedCount = pages.filter(p => p.is_deleted).length;
  const unreadCount = notifications.length;

  const createPage = useMutation({
    mutationFn: () => Page.create({
      title: 'Untitled',
      icon: '📄',
      org_id: currentOrg?.id,
      content: JSON.stringify([{ id: '1', type: 'paragraph', content: '' }])
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
    <aside className="w-[260px] h-screen flex flex-col bg-sidebar border-r border-sidebar-border shrink-0 select-none">
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
      </div>

      {/* Page trees */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {/* Private */}
        <Collapsible open={privateOpen} onOpenChange={setPrivateOpen}>
          <CollapsibleTrigger className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
            {privateOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Private
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-0.5">
            {privatePages.map(page => (
              <PageTreeItem key={page.id} page={page} pages={activePages} activePath={location.pathname} />
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* Shared */}
        <Collapsible open={sharedOpen} onOpenChange={setSharedOpen}>
          <CollapsibleTrigger className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
            {sharedOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Shared
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-0.5">
            {sharedPages.map(page => (
              <PageTreeItem key={page.id} page={page} pages={activePages} activePath={location.pathname} />
            ))}
          </CollapsibleContent>
        </Collapsible>
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