import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { getDatabaseRowTemplates, deleteDatabaseRowTemplate } from '@/api/firestoreClient.js';

export default function RowTemplatesModal({ open, onOpenChange, databaseId, onApply }) {
  const qc = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['db_row_templates', databaseId],
    queryFn: () => getDatabaseRowTemplates(databaseId),
    enabled: !!databaseId && open,
  });

  const { mutateAsync: removeTemplate } = useMutation({
    mutationFn: (templateId) => deleteDatabaseRowTemplate(databaseId, templateId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['db_row_templates', databaseId] }),
    onError: () => toast.error('Failed to delete template'),
  });

  const handleApply = async (template) => {
    if (!onApply) return;
    onOpenChange(false);
    onApply(template);
  };

  const handleDelete = async (templateId) => {
    try {
      await removeTemplate(templateId);
      toast.success('Template deleted');
    } catch (e) {
      // error toast already handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Row templates</DialogTitle>
          <DialogDescription>
            Select a saved row template to create a new record pre-filled with its values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background/80 p-8 text-center text-sm text-muted-foreground">
              No templates saved yet. Open a row and use "Save as template" to start.
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div key={template.id} className="rounded-2xl border border-border bg-background p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <span className="truncate">{template.template_name || 'Untitled template'}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{template.properties ? Object.keys(template.properties).length : 0} props</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{(template.body?.length ?? 0)} blocks</span>
                    </div>
                    {template.template_description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{template.template_description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleApply(template)}>
                      Use template
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
