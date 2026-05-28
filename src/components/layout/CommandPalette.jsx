import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPageRoute } from '@/lib/pageRouter';
import { Page, Task, Database } from '@/api/firestoreClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  CommandDialog, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList, CommandSeparator
} from '@/components/ui/command';
import {
  FileText, Clock, Search, ClipboardList, Database as DbIcon,
  Plus, Star, Settings, Sun, Moon, CheckSquare, ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Extract a short plain-text snippet from a page's search_text or content. */
function snippet(text = '', query = '', maxLen = 60) {
  if (!text) return '';
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = qLower ? lower.indexOf(qLower) : -1;
  const start = idx > 20 ? idx - 20 : 0;
  const raw = text.slice(start, start + maxLen);
  return (start > 0 ? '…' : '') + raw + (raw.length === maxLen ? '…' : '');
}

/** Highlight matching substring with a <mark> span. */
function Highlight({ text = '', query = '' }) {
  if (!query) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary rounded-[2px] px-0">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  );
}

// Local storage helpers for recently opened items
const RECENT_KEY = 'cp_recent_v1';
const MAX_RECENT = 8;

function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function pushRecent(item) {
  const next = [item, ...getRecent().filter((r) => !(r.type === item.type && r.id === item.id))].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

// ─── component ──────────────────────────────────────────────────────────────

export default function CommandPalette({ open, onOpenChange, onNewTask, onNewPage }) {
  const { currentOrg } = useWorkspace();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [cmdHeld, setCmdHeld] = useState(false);
  const [theme, setTheme] = useState(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );

  // ── data ──
  const { data: pages = [] } = useQuery({
    queryKey: ['pages', currentOrg?.id],
    queryFn: () => Page.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id,
    staleTime: 30_000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', currentOrg?.id],
    queryFn: () => Task.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id,
    staleTime: 30_000,
  });

  const { data: databases = [] } = useQuery({
    queryKey: ['databases', currentOrg?.id],
    queryFn: () => Database.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id,
    staleTime: 5 * 60 * 1000,
  });

  const activePages = useMemo(
    () => pages.filter((p) => !p.is_deleted && !p.is_template),
    [pages],
  );
  const activeTasks = useMemo(
    () => tasks.filter((t) => !t.is_deleted && t.status !== 'done'),
    [tasks],
  );

  const favorites = useMemo(() => activePages.filter((p) => p.is_favorite), [activePages]);

  // ── search ──
  const q = search.trim().toLowerCase();

  const matchedPages = useMemo(() => {
    if (!q) return [];
    return activePages
      .filter((p) => {
        const haystack = [p.title, p.search_text].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 6);
  }, [activePages, q]);

  const matchedTasks = useMemo(() => {
    if (!q) return [];
    return activeTasks
      .filter((t) => {
        const haystack = [t.title, t.description].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 4);
  }, [activeTasks, q]);

  // ── recents (read on open) ──
  const [recents, setRecents] = useState([]);
  useEffect(() => {
    if (open) {
      setSearch('');
      setRecents(getRecent());
    }
  }, [open]);

  // ── keyboard shortcut ──
  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.metaKey || e.ctrlKey) setCmdHeld(true);
    };
    const up = (e) => {
      if (!e.metaKey && !e.ctrlKey) setCmdHeld(false);
    };
    document.addEventListener('keydown', down);
    document.addEventListener('keyup', up);
    return () => { document.removeEventListener('keydown', down); document.removeEventListener('keyup', up); };
  }, [open, onOpenChange]);

  // ── actions ──
  const go = useCallback(
    (path, item) => {
      if (item) pushRecent(item);
      onOpenChange(false);
      setSearch('');
      navigate(path);
    },
    [navigate, onOpenChange],
  );

  const openInNewTab = useCallback(
    (path, item) => {
      if (item) pushRecent(item);
      onOpenChange(false);
      setSearch('');
      window.open(path, '_blank');
    },
    [onOpenChange],
  );

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    setTheme(next);
    onOpenChange(false);
    setSearch('');
  };

  // ── quick actions list ──
  const ACTIONS = [
    {
      id: 'new-page',
      label: 'New Page',
      icon: <FileText className="h-4 w-4 text-primary" />,
      hint: '⌘ N',
      onSelect: () => { onNewPage?.(); onOpenChange(false); setSearch(''); },
    },
    {
      id: 'new-task',
      label: 'New Task',
      icon: <Plus className="h-4 w-4 text-primary" />,
      hint: '⌘ ⇧ T',
      onSelect: () => { onNewTask?.(); onOpenChange(false); setSearch(''); },
    },
    {
      id: 'settings',
      label: 'Go to Settings',
      icon: <Settings className="h-4 w-4 text-muted-foreground" />,
      onSelect: () => go('/settings'),
    },
    {
      id: 'tasks-page',
      label: 'Go to Tasks',
      icon: <ClipboardList className="h-4 w-4 text-muted-foreground" />,
      onSelect: () => go('/tasks'),
    },
    {
      id: 'toggle-theme',
      label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      icon: theme === 'dark'
        ? <Sun className="h-4 w-4 text-muted-foreground" />
        : <Moon className="h-4 w-4 text-muted-foreground" />,
      onSelect: toggleTheme,
    },
  ];

  const matchedActions = useMemo(() => {
    if (!q) return ACTIONS;
    return ACTIONS.filter((a) => a.label.toLowerCase().includes(q));
  }, [q, theme]);

  // ── resolve recent items into full objects ──
  const recentItems = useMemo(() => {
    return recents
      .map((r) => {
        if (r.type === 'page') {
          const page = activePages.find((p) => p.id === r.id);
          return page ? { ...r, title: page.title || r.title, icon: page.icon || r.icon } : null;
        }
        if (r.type === 'task') {
          const task = activeTasks.find((t) => t.id === r.id);
          return task ? { ...r, title: task.title || r.title } : null;
        }
        return r;
      })
      .filter(Boolean)
      .slice(0, 5);
  }, [recents, activePages, activeTasks]);

  const hasResults = matchedPages.length > 0 || matchedTasks.length > 0 || matchedActions.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-xl"
    >
      <CommandInput
        placeholder="Search pages, tasks, actions… (↑↓ navigate, ↵ open, ⌘↵ new tab)"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[480px]">
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <Search className="h-8 w-8 opacity-40" />
            <p className="text-sm">No results for "{search}"</p>
          </div>
        </CommandEmpty>

        {/* ── search results ── */}
        {q && (
          <>
            {matchedPages.length > 0 && (
              <CommandGroup heading="Pages">
                {matchedPages.map((page) => {
                  const snip = snippet(page.search_text || page.title, search);
                  const item = { type: 'page', id: page.id, title: page.title, icon: page.icon };
                  return (
                    <CommandItem
                      key={page.id}
                      value={`page-${page.id}-${page.title}`}
                      onSelect={() => {
                        if (cmdHeld) openInNewTab(getPageRoute(page, databases), item);
                        else go(getPageRoute(page, databases), item);
                      }}
                      className="flex items-start gap-2.5 py-2"
                    >
                      <span className="text-base mt-0.5 shrink-0">{page.icon || '📄'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            <Highlight text={page.title || 'Untitled'} query={search} />
                          </span>
                          {page.is_favorite && <Star className="h-3 w-3 text-yellow-400 fill-yellow-400 shrink-0" />}
                        </div>
                        {snip && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            <Highlight text={snip} query={search} />
                          </p>
                        )}
                      </div>
                      <kbd className="shrink-0 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        ⌘↵ new tab
                      </kbd>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {matchedTasks.length > 0 && (
              <>
                {matchedPages.length > 0 && <CommandSeparator />}
                <CommandGroup heading="Tasks">
                  {matchedTasks.map((task) => {
                    const item = { type: 'task', id: task.id, title: task.title };
                    return (
                      <CommandItem
                        key={task.id}
                        value={`task-${task.id}-${task.title}`}
                        onSelect={() => go('/tasks', item)}
                        className="flex items-center gap-2.5 py-2"
                      >
                        <CheckSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm truncate block">
                            <Highlight text={task.title || 'Untitled task'} query={search} />
                          </span>
                          {task.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {snippet(task.description, search, 55)}
                            </p>
                          )}
                        </div>
                        {task.priority === 'urgent' && (
                          <span className="text-[10px] bg-red-100 dark:bg-red-950/40 text-red-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                            urgent
                          </span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}

            {matchedActions.length > 0 && (
              <>
                {(matchedPages.length > 0 || matchedTasks.length > 0) && <CommandSeparator />}
                <CommandGroup heading="Actions">
                  {matchedActions.map((action) => (
                    <CommandItem
                      key={action.id}
                      value={`action-${action.id}`}
                      onSelect={action.onSelect}
                      className="flex items-center gap-2.5"
                    >
                      {action.icon}
                      <span className="flex-1">{action.label}</span>
                      {action.hint && (
                        <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                          {action.hint}
                        </kbd>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}

        {/* ── default (no search) ── */}
        {!q && (
          <>
            {/* Quick actions */}
            <CommandGroup heading="Actions">
              {ACTIONS.map((action) => (
                <CommandItem
                  key={action.id}
                  value={`action-${action.id}`}
                  onSelect={action.onSelect}
                  className="flex items-center gap-2.5"
                >
                  {action.icon}
                  <span className="flex-1">{action.label}</span>
                  {action.hint && (
                    <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                      {action.hint}
                    </kbd>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>

            {/* Favorites */}
            {favorites.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Favorites">
                  {favorites.slice(0, 5).map((page) => {
                    const item = { type: 'page', id: page.id, title: page.title, icon: page.icon };
                    return (
                      <CommandItem
                        key={page.id}
                        value={`fav-${page.id}`}
                        onSelect={() => go(getPageRoute(page, databases), item)}
                        className="flex items-center gap-2.5"
                      >
                        <span className="text-sm">{page.icon || '📄'}</span>
                        <span className="flex-1 truncate">{page.title || 'Untitled'}</span>
                        <Star className="h-3 w-3 text-yellow-400 fill-yellow-400 shrink-0" />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}

            {/* Recents */}
            {recentItems.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Recently opened">
                  {recentItems.map((r) => {
                    const page = r.type === 'page' ? activePages.find((p) => p.id === r.id) : null;
                    const path = r.type === 'page'
                      ? getPageRoute(page || { id: r.id }, databases)
                      : '/tasks';
                    return (
                      <CommandItem
                        key={`${r.type}-${r.id}`}
                        value={`recent-${r.type}-${r.id}`}
                        onSelect={() => go(path, r)}
                        className="flex items-center gap-2.5"
                      >
                        {r.type === 'page'
                          ? <span className="text-sm">{r.icon || '📄'}</span>
                          : <CheckSquare className="h-4 w-4 text-muted-foreground" />}
                        <span className="flex-1 truncate">{r.title || 'Untitled'}</span>
                        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}

            {/* All pages fallback when nothing else */}
            {favorites.length === 0 && recentItems.length === 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="All pages">
                  {activePages.slice(0, 6).map((page) => {
                    const item = { type: 'page', id: page.id, title: page.title, icon: page.icon };
                    return (
                      <CommandItem
                        key={page.id}
                        value={`page-${page.id}`}
                        onSelect={() => go(getPageRoute(page, databases), item)}
                        className="flex items-center gap-2.5"
                      >
                        <span className="text-sm">{page.icon || '📄'}</span>
                        <span className="flex-1 truncate">{page.title || 'Untitled'}</span>
                        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </>
        )}

        {/* Footer hint */}
        <div className="px-3 py-2 border-t border-border flex items-center gap-3 text-[11px] text-muted-foreground">
          <span><kbd className="bg-muted rounded px-1 font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="bg-muted rounded px-1 font-mono">↵</kbd> open</span>
          <span><kbd className="bg-muted rounded px-1 font-mono">⌘↵</kbd> new tab</span>
          <span className="ml-auto"><kbd className="bg-muted rounded px-1 font-mono">Esc</kbd> close</span>
        </div>
      </CommandList>
    </CommandDialog>
  );
}