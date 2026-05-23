import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Page } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Plus, FileText, LayoutTemplate, BookOpen, Star, Clock } from 'lucide-react';
import { format } from 'date-fns';

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

  const { data: pages = [] } = useQuery({
    queryKey: ['pages', currentOrg?.id],
    queryFn: () => Page.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id
  });

  const activePages = pages.filter(p => !p.is_deleted && !p.is_template);
  const recentPages = [...activePages].sort((a, b) => safeDate(b.updated_date) - safeDate(a.updated_date)).slice(0, 8);
  const favoritePages = activePages.filter(p => p.is_favorite);

  const createPage = useMutation({
    mutationFn: () => Page.create({
      title: 'Untitled', icon: '📄', org_id: currentOrg?.id,
      content: JSON.stringify([{ id: '1', type: 'paragraph', content: '' }])
    }),
    onSuccess: (page) => { queryClient.invalidateQueries({ queryKey: ['pages'] }); navigate(`/page/${page.id}`); }
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
          const db = await Page.create({
            title: 'Knowledge Base', icon: '📚', org_id: currentOrg?.id,
            is_database: true, is_shared: true, database_preset: 'knowledge_base',
            database_config: JSON.stringify({
              properties: [
                { id: 'title', name: 'Title', type: 'title' },
                { id: 'cat', name: 'Category', type: 'select', options: [{ value: 'Guide', color: 'blue' }, { value: 'Reference', color: 'green' }, { value: 'FAQ', color: 'yellow' }] },
                { id: 'status', name: 'Status', type: 'select', options: [{ value: 'Draft', color: 'gray' }, { value: 'Published', color: 'green' }, { value: 'Archived', color: 'red' }] },
                { id: 'tags', name: 'Tags', type: 'multi_select', options: [] },
                { id: 'author', name: 'Author', type: 'person' }
              ],
              views: [{ id: 'table', name: 'All Articles', type: 'table' }],
              rows: []
            }),
            content: JSON.stringify([])
          });
          queryClient.invalidateQueries({ queryKey: ['pages'] });
          navigate(`/page/${db.id}`);
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

      {favoritePages.length > 0 && (
        <div className="mb-10">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            <Star className="h-3.5 w-3.5" /> Favorites
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {favoritePages.map(page => (
              <Link key={page.id} to={`/page/${page.id}`} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors shrink-0">
                <span>{page.icon || '📄'}</span>
                <span className="text-sm font-medium">{page.title || 'Untitled'}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          <Clock className="h-3.5 w-3.5" /> Recently edited
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {recentPages.map(page => (
            <Link key={page.id} to={`/page/${page.id}`} className="group p-4 rounded-xl border border-border bg-card hover:bg-accent/30 hover:border-primary/20 transition-all">
              <div className="text-2xl mb-3">{page.icon || '📄'}</div>
              <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{page.title || 'Untitled'}</p>
              <p className="text-xs text-muted-foreground mt-1">{format(safeDate(page.updated_date), 'MMM d, h:mm a')}</p>
            </Link>
          ))}
          {recentPages.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No pages yet. Create your first one!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}