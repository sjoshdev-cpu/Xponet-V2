/**
 * UseTemplateDialog
 * Fill-in-the-blanks dialog before creating a page from a template.
 * Replaces {{VariableName}} placeholders in block content and title.
 *
 * Props:
 *   open         — boolean
 *   onOpenChange — (bool) => void
 *   template     — { name, icon, description, blocks, template_variables (JSON str) }
 *                  Can be a Page object (user template) or a plain object (built-in)
 *   orgId        — string
 *   parentId     — string | null  (parent page, if any)
 *   onCreated    — (pageId: string) => void
 */
import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Page } from '@/api/firestoreClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import { Braces, Wand2 } from 'lucide-react';

/** Apply variable substitutions to a string */
function applyVars(text, vars) {
  if (!text) return text;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{{${k}}}`, v || `{{${k}}}`),
    text
  );
}

/** Deep-replace variables in a blocks array */
function substituteBlocks(blocks, vars) {
  return blocks.map((b) => ({
    ...b,
    content: applyVars(b.content, vars),
    caption: b.caption ? applyVars(b.caption, vars) : b.caption,
  }));
}

/** Detect variables from a list of blocks (same logic as SaveAsTemplateDialog) */
function detectVars(blocks) {
  const found = new Set();
  const re = /\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;
  for (const b of blocks || []) {
    let m;
    while ((m = re.exec(b.content || '')) !== null) found.add(m[1]);
  }
  return [...found];
}

export default function UseTemplateDialog({ open, onOpenChange, template, orgId, parentId, onCreated }) {
  const { user } = useWorkspace();
  const [values, setValues] = useState({});
  const [creating, setCreating] = useState(false);

  // Parse blocks (template may be Firestore page with content string, or built-in with blocks array)
  const templateBlocks = useMemo(() => {
    if (!template) return [];
    if (Array.isArray(template.blocks)) return template.blocks;
    try { return JSON.parse(template.content || '[]'); } catch { return []; }
  }, [template]);

  // Variables list: from stored template_variables, or auto-detect from blocks
  const variables = useMemo(() => {
    if (template?.template_variables) {
      try {
        const parsed = JSON.parse(template.template_variables);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { /* fall through */ }
    }
    return detectVars(templateBlocks);
  }, [template, templateBlocks]);

  const templateName = template?.template_name || template?.name || 'Untitled';
  const templateIcon = template?.icon || '📄';
  const hasVars = variables.length > 0;

  const handleCreate = async () => {
    setCreating(true);
    try {
      const finalBlocks = hasVars
        ? substituteBlocks(templateBlocks, values)
        : templateBlocks;

      const titleWithVars = hasVars ? applyVars(templateName, values) : templateName;

      const newPage = await Page.create({
        title: titleWithVars,
        icon: templateIcon,
        org_id: orgId,
        parent_id: parentId || null,
        content: JSON.stringify(finalBlocks.map((b) => ({ ...b, id: Math.random().toString(36).slice(2) }))),
        is_template: false,
        created_by_email: user?.email || '',
        created_by_name: user?.full_name || user?.email || '',
        category: null,
        reviewers: [],
      });

      // Increment use count if it's a user template (has .id from Firestore)
      if (template?.id && template?.is_template) {
        await Page.update(template.id, {
          template_use_count: (template.template_use_count || 0) + 1,
        }).catch(() => {}); // non-critical
      }

      toast.success('Page created from template');
      onCreated?.(newPage.id);
      onOpenChange(false);
    } catch (e) {
      toast.error('Failed to create page');
    } finally {
      setCreating(false);
    }
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{templateIcon}</span>
            Use template
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{templateName}</span>
            {template?.template_description && (
              <span className="block mt-0.5 text-xs">{template.template_description}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {hasVars ? (
          <div className="space-y-3 py-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Wand2 className="h-3.5 w-3.5" />
              Fill in the blanks — these will replace the placeholders in the template.
            </p>
            {variables.map((v) => (
              <div key={v} className="space-y-1">
                <Label className="text-xs">
                  <code className="bg-muted px-1 rounded text-[11px] font-mono">{`{{${v}}}`}</code>
                </Label>
                <Input
                  placeholder={v}
                  value={values[v] || ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                  className="text-sm h-8"
                />
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Leave a field empty to keep the placeholder in the page.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            This template has no fill-in variables. A new page will be created with the template's content.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={creating} onClick={handleCreate}>
            {creating ? 'Creating…' : 'Create page'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
