import React from 'react';
import { Page } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import { Trash2, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function Trash() {
  const { currentOrg } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: pages = [] } = useQuery({
    queryKey: ['pages', currentOrg?.id],
    queryFn: () => Page.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id
  });

  const trashedPages = pages.filter(p => p.is_deleted);

  const restoreMutation = useMutation({
    mutationFn: (id) => Page.update(id, { is_deleted: false, deleted_at: null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => Page.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pages'] })
  });

  return (
    <div className="max-w-[700px] mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-6">Trash</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Pages in trash will stay here until permanently deleted.
      </p>

      <div className="space-y-1">
        {trashedPages.map(page => (
          <div key={page.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group">
            <span className="text-lg">{page.icon || '📄'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{page.title || 'Untitled'}</p>
              <p className="text-xs text-muted-foreground">
                Deleted {page.deleted_at ? format(new Date(page.deleted_at), 'MMM d, h:mm a') : 'recently'}
              </p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                restoreMutation.mutate(page.id);
              }}>
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                deleteMutation.mutate(page.id);
              }}>
                <X className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {trashedPages.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Trash2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Trash is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}