import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createDatabaseRowTemplate } from '@/api/firestoreClient.js';

export default function SaveRecordTemplateDialog({ open, onOpenChange, record, schema, bodyBlocks = [], databaseId, onSaved }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const titleProp = schema?.find((p) => p.type === 'title');
    const titleValue = titleProp ? record?.properties?.[titleProp.id] : '';
    setName(titleValue || 'Untitled row template');
  }, [open, record, schema]);

  const { mutateAsync: saveTemplate } = useMutation({
    mutationFn: ({ templateName, templateData }) => createDatabaseRowTemplate(databaseId, templateName, templateData),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['db_row_templates', databaseId] }),
    onError: () => toast.error('Failed to save row template'),
  });

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Please enter a template name');
      return;
    }

    const titleProp = schema?.find((p) => p.type === 'title');
    const props = { ...record?.properties };
    if (titleProp) {
      delete props[titleProp.id];
    }

    const templateData = {
      template_name: trimmed,
      template_description: `Saved from row ${titleProp ? record?.properties?.[titleProp.id] || 'untitled' : 'record'}`,
      properties: props,
      body: bodyBlocks,
    };

    setSaving(true);
    try {
      await saveTemplate({ templateName: trimmed, templateData });
      toast.success(`Saved "${trimmed}" as a row template`);
      onSaved?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save row as template</DialogTitle>
          <DialogDescription>
            Save this row so you can create future records with the same structure and default values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Template name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. New project kickoff"
              autoFocus
            />
          </div>
          <p className="text-sm text-muted-foreground">
            The row title will be left blank when this template is applied.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save template'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
