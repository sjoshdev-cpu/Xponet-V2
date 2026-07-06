/**
 * InsertTemplateDialog
 * Handles inserting template blocks into the current page with variable substitution.
 *
 * Props:
 *   open         — boolean
 *   onOpenChange — (bool) => void
 *   template     — template object with blocks array
 *   onInsert     — (blocks: array) => void  (called after variable substitution)
 */
import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wand2 } from 'lucide-react';

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

/** Detect variables from a blocks array */
function detectVars(blocks) {
  const found = new Set();
  const re = /\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;
  for (const b of blocks || []) {
    let m;
    while ((m = re.exec(b.content || '')) !== null) found.add(m[1]);
    if (b.caption) {
      const captionRe = /\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;
      while ((m = captionRe.exec(b.caption)) !== null) found.add(m[1]);
    }
  }
  return [...found];
}

export default function InsertTemplateDialog({ open, onOpenChange, template, onInsert }) {
  const [values, setValues] = useState({});
  const [inserting, setInserting] = useState(false);

  const templateBlocks = useMemo(() => {
    if (!template) return [];
    if (Array.isArray(template.blocks)) return template.blocks;
    try { return JSON.parse(template.content || '[]'); } catch { return []; }
  }, [template]);

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
  const hasVars = variables.length > 0;

  const handleInsert = async () => {
    setInserting(true);
    try {
      const finalBlocks = hasVars
        ? substituteBlocks(templateBlocks, values)
        : templateBlocks;

      const mapped = finalBlocks.map(b => ({
        ...b,
        id: `${Date.now()}-${Math.random()}`
      }));

      onInsert?.(mapped);
      onOpenChange(false);
    } finally {
      setInserting(false);
    }
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Insert template</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{templateName}</span>
          </DialogDescription>
        </DialogHeader>

        {hasVars ? (
          <div className="space-y-3 py-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Wand2 className="h-3.5 w-3.5" />
              Fill in the details — these will replace the placeholders.
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
                  autoFocus={v === variables[0]}
                />
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Leave a field empty to keep the placeholder in the content.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            This template will be inserted with its content.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={inserting}>
            Cancel
          </Button>
          <Button size="sm" disabled={inserting} onClick={handleInsert}>
            {inserting ? 'Inserting…' : 'Insert'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
