import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Page, Database, DatabaseRecord, getUserProfile, toggleUserPinnedPage } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getPageRoute } from '@/lib/pageRouter';
import { Plus, FileText, LayoutTemplate, BookOpen, Star, Clock, Pin, ArrowUpRight } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import DatabaseTable from '@/components/database/DatabaseTable.jsx';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const safeDate = (val) => {
  if (!val) return new Date();
  if (val?.toDate) return val.toDate();
  return new Date(val);
};

export default function Home() {
  const { user, currentOrg } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: userMeta = {} } = useQuery({
    queryKey: ['userProfile', user?.uid],
    queryFn: () => getUserProfile(user.uid),
    enabled: !!user?.uid,
    staleTime: 5 * 60 * 1000,
  });

  const { data: pages = [] } = useQuery({
    queryKey: ['pages', currentOrg?.id],
    queryFn: () => Page.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id,
  });

  const { data: databases = [] } = useQuery({
    queryKey: ['databases', currentOrg?.id],
    queryFn: () => Database.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id,
    staleTime: 5 * 60 * 1000,
  });

  const pinnedPageIds = Array.isArray(userMeta.pinnedPages) ? userMeta.pinnedPages : [];
  const recentPageIds = Array.isArray(userMeta.recentPages) ? userMeta.recentPages : [];
  const activePages = pages.filter((p) => !p.is_deleted && !p.is_template);

  const pinnedPages = useMemo(() => {
    return pinnedPageIds
      .map((id) => activePages.find((page) => page.id === id))
      .filter(Boolean);
  }, [activePages, pinnedPageIds]);

  const recentPages = useMemo(() => {
    const ordered = recentPageIds
      .map((id) => activePages.find((page) => page.id === id))
      .filter(Boolean);
    if (ordered.length > 0) return ordered.slice(0, 8);
    return [...activePages]
      .sort((a, b) => safeDate(b.updated_date) - safeDate(a.updated_date))
      .slice(0, 8);
  }, [activePages, recentPageIds]);

  const favoritePages = activePages.filter((p) => p.is_favorite);

  const taskDatabase = useMemo(() => {
    return databases.find((db) => {
      const schema = db.schema || [];
      return schema.some((prop) => prop.type === 'date') && schema.some((prop) => prop.type === 'person');
    });
  }, [databases]);

  const dateProperty = taskDatabase?.schema?.find((prop) => prop.type === 'date');
  const assigneeProperty = taskDatabase?.schema?.find((prop) => prop.type === 'person');

  const { data: taskRecords = [] } = useQuery({
    queryKey: ['records', taskDatabase?.id],
    queryFn: () => taskDatabase ? DatabaseRecord.filter({ database_id: taskDatabase.id }) : [],
    enabled: !!taskDatabase?.id,
  });

  const dueTodayRecords = useMemo(() => {
    if (!taskDatabase || !dateProperty || !assigneeProperty || !taskRecords.length || !user) return [];
    const email = user.email?.toLowerCase();
    const name = user.full_name?.toLowerCase();
    return taskRecords.filter((record) => {
      const dueValue = record.properties?.[dateProperty.id];
      const assigneeValue = record.properties?.[assigneeProperty.id];
      if (!dueValue || !assigneeValue) return false;
      const dueDate = safeDate(dueValue);
      if (!isSameDay(dueDate, new Date())) return false;
      if (typeof assigneeValue === 'string') {
        return [email, name].includes(assigneeValue.toLowerCase());
      }
      if (Array.isArray(assigneeValue)) {
        return assigneeValue.some((value) => String(value).toLowerCase() === email || String(value).toLowerCase() === name);
      }
      return false;
    });
  }, [taskDatabase, dateProperty, assigneeProperty, taskRecords, user]);

  const createPage = useMutation({
    mutationFn: () => Page.create({
      title: 'Untitled', icon: '📄', org_id: currentOrg?.id,
      content: JSON.stringify([{ id: '1', type: 'paragraph', content: '' }]),
    }),
    onSuccess: (page) => { queryClient.invalidateQueries({ queryKey: ['pages'] }); navigate(`/page/${page.id}`); }
  });

  const togglePinned = useMutation({
    mutationFn: (pageId) => toggleUserPinnedPage(user.uid, pageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userProfile', user?.uid] }),
  });

  return (
    <div className="max-w-[900px] mx-auto px-6 py-12 md:py-16">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {getGreeting()}, {user?.full_name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12">
        <button onClick={() => createPage.mutate()} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left group">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">New page</p>
            <p className="text-xs text-muted-foreground">Create a blank page</p>
          </div>
        </button>
        <Link to="/templates" className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors group">
          <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center group-hover:bg-chart-2/20 transition-colors">
            <LayoutTemplate className="h-5 w-5 text-chart-2" />
          </div>
          <div>
            <p className="font-medium text-sm">Templates</p>
            <p className="text-xs text-muted-foreground">Browse templates</p>
          </div>
        </Link>
        <button onClick={async () => {
          const hub = databases.find(db => db.name === 'Document Hub');
          navigate(hub ? `/document-hub/${hub.id}` : '/document-hub');
        }} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-left group">
          <div className="h-10 w-10 rounded-lg bg-chart-4/10 flex items-center justify-center group-hover:bg-chart-4/20 transition-colors">
            <BookOpen className="h-5 w-5 text-chart-4" />
          </div>
          <div>
            <p className="font-medium text-sm">Knowledge Base</p>
            <p className="text-xs text-muted-foreground">Create a database</p>
          </div>
        </button>
      </div>

      {pinnedPages.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              <Pin className="h-3.5 w-3.5" /> Pinned pages
            </h2>
            <span className="text-xs text-muted-foreground">Pinned pages remain on your Home screen</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pinnedPages.map((page) => (
              <div key={page.id} className="group relative p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-all">
                <Link to={getPageRoute(page, databases)} className="block">
                  <div className="text-2xl mb-3">{page.icon || '📄'}</div>
                  <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{page.title || 'Untitled'}</p>
                  <p className="text-xs text-muted-foreground mt-1">{format(safeDate(page.updated_date), 'MMM d, h:mm a')}</p>
                </Link>
                <button
                  type="button"
                  onClick={() => togglePinned.mutate(page.id)}
                  className="absolute top-3 right-3 rounded-full border border-border bg-background p-1 hover:border-primary hover:text-primary transition"
                  title="Unpin from home"
                >
                  <Star className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {favoritePages.length > 0 && (
        <div className="mb-10">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            <Star className="h-3.5 w-3.5" /> Favorites
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {favoritePages.map(page => (
              <div key={page.id} className="relative shrink-0">
                <Link to={getPageRoute(page, databases)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors">
                  <span>{page.icon || '📄'}</span>
                  <span className="text-sm font-medium">{page.title || 'Untitled'}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => togglePinned.mutate(page.id)}
                  className="absolute top-1 right-1 rounded-full border border-border bg-background p-1 hover:border-primary hover:text-primary transition"
                  title={pinnedPageIds.includes(page.id) ? 'Unpin from home' : 'Pin to home'}
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          <Clock className="h-3.5 w-3.5" /> Recently edited
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {recentPages.map((page) => (
            <div key={page.id} className="group relative p-4 rounded-xl border border-border bg-card hover:bg-accent/30 hover:border-primary/20 transition-all">
              <Link to={getPageRoute(page, databases)} className="block">
                <div className="text-2xl mb-3">{page.icon || '📄'}</div>
                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{page.title || 'Untitled'}</p>
                <p className="text-xs text-muted-foreground mt-1">{format(safeDate(page.updated_date), 'MMM d, h:mm a')}</p>
              </Link>
              <button
                type="button"
                onClick={() => togglePinned.mutate(page.id)}
                className="absolute top-3 right-3 rounded-full border border-border bg-background p-1 hover:border-primary hover:text-primary transition"
                title={pinnedPageIds.includes(page.id) ? 'Unpin from home' : 'Pin to home'}
              >
                <Pin className="h-4 w-4" />
              </button>
            </div>
          ))}
          {recentPages.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No pages yet. Create your first one!</p>
            </div>
          )}
        </div>
      </div>

      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">My tasks due today</h2>
            <p className="text-xs text-muted-foreground">From a task database with a date and person property</p>
          </div>
          {taskDatabase && (
            <button
              type="button"
              onClick={() => navigate(`/database/${taskDatabase.id}`)}
              className="inline-flex items-center gap-2 text-xs font-medium text-primary"
            >
              Open database <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="rounded-3xl border border-border bg-card p-4">
          {taskDatabase ? (
            dueTodayRecords.length > 0 ? (
              <DatabaseTable
                schema={taskDatabase.schema || []}
                records={dueTodayRecords}
                databaseId={taskDatabase.id}
                onOpenRecord={() => navigate(`/database/${taskDatabase.id}`)}
                allRecords={taskRecords}
                allDatabases={databases}
              />
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No tasks due today for your assignments in {taskDatabase.name}.
              </div>
            )
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No task database found. Add a database with a date property and a person property to surface tasks here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}