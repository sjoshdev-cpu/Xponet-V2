/**
 * SaveAsTemplateDialog
 * Lets the user save the current page as a reusable template.
 * Detects {{VariableName}} placeholders in the page content automatically.
 *
 * Props:
 *   open         — boolean
 *   onOpenChange — (bool) => void
 *   page         — current page object { title, icon, content }
 *   blocks       — parsed blocks array
 *   orgId        — string
 *   onSaved      — () => void  (called after Firestore write)
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Page, withLastEditedBy } from '@/api/firestoreClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import { Braces, Tag, X } from 'lucide-react';

const BUILTIN_CATEGORIES = [
  'Work', 'Personal', 'Engineering', 'Design', 'Marketing', 'HR', 'Finance', 'Other'
];

/** Extract {{VarName}} placeholders from block content */
function extractVariables(blocks) {
  const found = new Set();
  const re = /\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;
  for (const b of blocks || []) {
    const text = b.content || '';
    let m;
    while ((m = re.exec(text)) !== null) found.add(m[1]);
  }
  return [...found];
}

export default function SaveAsTemplateDialog({ open, onOpenChange, page, blocks = [], orgId, onSaved }) {
  const { user } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Work');
  const [customCategory, setCustomCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const detectedVars = useMemo(() => extractVariables(blocks), [blocks]);

  useEffect(() => {
    if (open) {
      setName(page?.template_name || page?.title || '');
      setDescription(page?.template_description || '');
      setCategory(page?.template_category || 'Work');
      setCustomCategory('');
    }
  }, [open, page]);

  const finalCategory = category === 'Other (custom)' ? customCategory.trim() : category;

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Please enter a template name'); return; }
    setSaving(true);
    try {
      await Page.update(page.id, withLastEditedBy({
        is_template: true,
        template_name: name.trim(),
        template_description: description.trim(),
        template_category: finalCategory || 'Other',
        template_variables: JSON.stringify(detectedVars),
      }, user));
      toast.success(`"${name.trim()}" saved as a template`);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{page?.icon || '📄'}</span>
            Save as Template
          </DialogTitle>
          <DialogDescription>
            This page will appear in your org's template library. Anyone in the org can use it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Template name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Client Onboarding"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description <span className="font-normal">(optional)</span></Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this template for?"
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {BUILTIN_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    category === c
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  }`}
                >
                  {c}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCategory('Other (custom)')}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  category === 'Other (custom)'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                }`}
              >
                + Custom
              </button>
            </div>
            {category === 'Other (custom)' && (
              <Input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Category name..."
                className="mt-1.5 text-sm h-8"
              />
            )}
          </div>

          {/* Auto-detected template variables */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Braces className="h-3 w-3" /> Template variables detected
            </Label>
            {detectedVars.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {detectedVars.map((v) => (
                  <Badge key={v} variant="secondary" className="font-mono text-xs">
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No variables found. Add <code className="bg-muted px-1 rounded text-[11px]">{`{{VariableName}}`}</code> anywhere in the page content to create fill-in placeholders.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save template'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
