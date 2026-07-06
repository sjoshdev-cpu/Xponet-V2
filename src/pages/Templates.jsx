import { useState, useMemo } from 'react';
import { Page, withLastEditedBy } from '@/api/firestoreClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import BlockRenderer from '@/components/editor/BlockRenderer';
import { cn } from '@/lib/utils';
import {
  Search, Sparkles, User, LayoutTemplate, Trash2, Braces
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import UseTemplateDialog from '@/components/templates/UseTemplateDialog';
import { toast } from 'sonner';

// ── Built-in templates ────────────────────────────────────────────────────────
const BUILTIN_TEMPLATES = [
  {
    name: 'Meeting Notes',
    icon: '📝',
    category: 'Work',
    description: 'Structured notes for meetings with agenda and action items',
    blocks: [
      { id: '1', type: 'heading2', content: 'Meeting Details' },
      { id: '2', type: 'bullet', content: 'Date: {{Date}}' },
      { id: '3', type: 'bullet', content: 'Attendees: {{Attendees}}' },
      { id: '4', type: 'bullet', content: 'Type: ' },
      { id: '5', type: 'divider' },
      { id: '6', type: 'heading2', content: 'Agenda' },
      { id: '7', type: 'numbered', content: '' },
      { id: '8', type: 'divider' },
      { id: '9', type: 'heading2', content: 'Notes' },
      { id: '10', type: 'paragraph', content: '' },
      { id: '11', type: 'divider' },
      { id: '12', type: 'heading2', content: 'Action Items' },
      { id: '13', type: 'todo', checked: false, content: '' },
    ],
  },
  {
    name: 'Project Brief',
    icon: '📊',
    category: 'Work',
    description: 'Outline for a new project with goals and timeline',
    blocks: [
      { id: '1', type: 'heading2', content: 'Overview' },
      { id: '2', type: 'paragraph', content: 'Project: {{ProjectName}}' },
      { id: '3', type: 'heading2', content: 'Goals' },
      { id: '4', type: 'bullet', content: '' },
      { id: '5', type: 'heading2', content: 'Timeline' },
      { id: '6', type: 'paragraph', content: 'Start: {{StartDate}} · End: {{EndDate}}' },
      { id: '7', type: 'heading2', content: 'Team' },
      { id: '8', type: 'bullet', content: 'Owner: {{Owner}}' },
      { id: '9', type: 'heading2', content: 'Success Metrics' },
      { id: '10', type: 'bullet', content: '' },
    ],
  },
  {
    name: 'Weekly Update',
    icon: '📅',
    category: 'Work',
    description: 'Weekly progress report template',
    blocks: [
      { id: '1', type: 'heading2', content: 'Highlights' },
      { id: '2', type: 'bullet', content: '' },
      { id: '3', type: 'heading2', content: 'Completed This Week' },
      { id: '4', type: 'todo', checked: true, content: '' },
      { id: '5', type: 'heading2', content: 'In Progress' },
      { id: '6', type: 'todo', checked: false, content: '' },
      { id: '7', type: 'heading2', content: 'Planned for Next Week' },
      { id: '8', type: 'bullet', content: '' },
      { id: '9', type: 'heading2', content: 'Blockers' },
      { id: '10', type: 'callout', emoji: '⚠️', color: 'yellow', content: '' },
    ],
  },
  {
    name: 'Decision Log',
    icon: '⚖️',
    category: 'Work',
    description: 'Record important decisions and their context',
    blocks: [
      { id: '1', type: 'heading2', content: 'Decision' },
      { id: '2', type: 'callout', emoji: '📌', color: 'blue', content: '' },
      { id: '3', type: 'heading2', content: 'Context' },
      { id: '4', type: 'paragraph', content: '' },
      { id: '5', type: 'heading2', content: 'Options Considered' },
      { id: '6', type: 'numbered', content: '' },
      { id: '7', type: 'heading2', content: 'Rationale' },
      { id: '8', type: 'paragraph', content: '' },
      { id: '9', type: 'heading2', content: 'Impact' },
      { id: '10', type: 'paragraph', content: '' },
    ],
  },
  {
    name: 'Bug Report',
    icon: '🐛',
    category: 'Engineering',
    description: 'Detailed bug report template',
    blocks: [
      { id: '1', type: 'heading2', content: 'Summary' },
      { id: '2', type: 'paragraph', content: '' },
      { id: '3', type: 'heading2', content: 'Steps to Reproduce' },
      { id: '4', type: 'numbered', content: '' },
      { id: '5', type: 'heading2', content: 'Expected Behavior' },
      { id: '6', type: 'paragraph', content: '' },
      { id: '7', type: 'heading2', content: 'Actual Behavior' },
      { id: '8', type: 'paragraph', content: '' },
      { id: '9', type: 'heading2', content: 'Environment' },
      { id: '10', type: 'bullet', content: 'OS: ' },
      { id: '11', type: 'bullet', content: 'Browser: ' },
      { id: '12', type: 'bullet', content: 'Version: ' },
    ],
  },
  {
    name: 'Retrospective',
    icon: '🔄',
    category: 'Engineering',
    description: 'Team retrospective with what worked and improvements',
    blocks: [
      { id: '1', type: 'heading2', content: 'What Went Well ✅' },
      { id: '2', type: 'bullet', content: '' },
      { id: '3', type: 'heading2', content: 'What Could Be Improved 🔧' },
      { id: '4', type: 'bullet', content: '' },
      { id: '5', type: 'heading2', content: 'Action Items' },
      { id: '6', type: 'todo', checked: false, content: '' },
      { id: '7', type: 'heading2', content: 'Shoutouts 🎉' },
      { id: '8', type: 'paragraph', content: '' },
    ],
  },
  {
    name: 'OKRs',
    icon: '🎯',
    category: 'Work',
    description: 'Track objectives and key results for a quarter',
    blocks: [
      { id: '1', type: 'heading2', content: 'Objective' },
      { id: '2', type: 'callout', emoji: '🎯', color: 'blue', content: '{{Objective}}' },
      { id: '3', type: 'heading2', content: 'Key Results' },
      { id: '4', type: 'todo', checked: false, content: 'KR1: ' },
      { id: '5', type: 'todo', checked: false, content: 'KR2: ' },
      { id: '6', type: 'todo', checked: false, content: 'KR3: ' },
      { id: '7', type: 'heading2', content: 'Initiatives' },
      { id: '8', type: 'bullet', content: '' },
    ],
  },
  {
    name: 'Client Onboarding',
    icon: '🤝',
    category: 'Marketing',
    description: 'Welcome a new client and outline next steps',
    blocks: [
      { id: '1', type: 'heading2', content: 'Welcome, {{ClientName}}!' },
      { id: '2', type: 'paragraph', content: "We're excited to work with you. Here's what to expect:" },
      { id: '3', type: 'heading2', content: 'Your Account Details' },
      { id: '4', type: 'bullet', content: 'Account Manager: {{AccountManager}}' },
      { id: '5', type: 'bullet', content: 'Start Date: {{StartDate}}' },
      { id: '6', type: 'heading2', content: 'Onboarding Checklist' },
      { id: '7', type: 'todo', checked: false, content: 'Kick-off call scheduled' },
      { id: '8', type: 'todo', checked: false, content: 'Access credentials sent' },
      { id: '9', type: 'todo', checked: false, content: 'Intro docs shared' },
    ],
  },
  {
    name: 'Team Handbook',
    icon: '📖',
    category: 'HR',
    description: 'Team culture, processes, and onboarding guide',
    blocks: [
      { id: '1', type: 'heading2', content: 'About {{TeamName}}' },
      { id: '2', type: 'paragraph', content: '' },
      { id: '3', type: 'heading2', content: 'Our Values' },
      { id: '4', type: 'bullet', content: '' },
      { id: '5', type: 'heading2', content: 'How We Work' },
      { id: '6', type: 'paragraph', content: '' },
      { id: '7', type: 'heading2', content: 'Communication Norms' },
      { id: '8', type: 'bullet', content: '' },
    ],
  },
  {
    name: 'Content Calendar',
    icon: '📆',
    category: 'Marketing',
    description: 'Plan and track content across channels',
    blocks: [
      { id: '1', type: 'heading2', content: 'Month: {{Month}}' },
      { id: '2', type: 'heading3', content: 'Blog Posts' },
      { id: '3', type: 'todo', checked: false, content: '' },
      { id: '4', type: 'heading3', content: 'Social Media' },
      { id: '5', type: 'todo', checked: false, content: '' },
      { id: '6', type: 'heading3', content: 'Email Newsletter' },
      { id: '7', type: 'paragraph', content: '' },
    ],
  },
  {
    name: 'Interview Notes',
    icon: '💼',
    category: 'HR',
    description: 'Structured interview scorecard and notes',
    blocks: [
      { id: '1', type: 'heading2', content: 'Candidate: {{CandidateName}}' },
      { id: '2', type: 'bullet', content: 'Role: {{Role}}' },
      { id: '3', type: 'bullet', content: 'Date: {{Date}}' },
      { id: '4', type: 'bullet', content: 'Interviewer: {{Interviewer}}' },
      { id: '5', type: 'divider' },
      { id: '6', type: 'heading2', content: 'Questions & Notes' },
      { id: '7', type: 'numbered', content: '' },
      { id: '8', type: 'heading2', content: 'Strengths' },
      { id: '9', type: 'bullet', content: '' },
      { id: '10', type: 'heading2', content: 'Concerns' },
      { id: '11', type: 'bullet', content: '' },
      { id: '12', type: 'heading2', content: 'Decision' },
      { id: '13', type: 'callout', emoji: '🤔', color: 'gray', content: '' },
    ],
  },
  {
    name: 'Personal Journal',
    icon: '📓',
    category: 'Personal',
    description: 'Daily journal with mood, gratitude, and intentions',
    blocks: [
      { id: '1', type: 'heading2', content: '{{Date}}' },
      { id: '2', type: 'heading3', content: 'How am I feeling?' },
      { id: '3', type: 'paragraph', content: '' },
      { id: '4', type: 'heading3', content: "Today I'm grateful for..." },
      { id: '5', type: 'bullet', content: '' },
      { id: '6', type: 'heading3', content: 'Intentions for today' },
      { id: '7', type: 'todo', checked: false, content: '' },
      { id: '8', type: 'heading3', content: 'Reflection' },
      { id: '9', type: 'paragraph', content: '' },
    ],
  },
];

const ALL_BUILTIN_CATEGORIES = [...new Set(BUILTIN_TEMPLATES.map((t) => t.category))].sort();

const VARIABLE_RE = /\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;

function getTemplateBlocks(template) {
  if (!template) return [];
  if (Array.isArray(template.blocks)) return template.blocks;
  try { return JSON.parse(template.content || '[]'); } catch { return []; }
}

function detectTemplateVariables(template) {
  const blocks = getTemplateBlocks(template);
  const found = new Set();
  for (const b of blocks) {
    let m;
    while ((m = VARIABLE_RE.exec(b.content || '')) !== null) found.add(m[1]);
  }
  return [...found];
}

function applyTemplateValues(text, values) {
  if (!text) return text;
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value || `{{${key}}}`),
    text
  );
}

function formatPreviewContent(text) {
  if (!text) return text || '';
  return text.replace(VARIABLE_RE, (_, name) => `<span class="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">{{${name}}}</span>`);
}

function buildPreviewBlocks(template) {
  return getTemplateBlocks(template).map((block) => ({
    ...block,
    content: formatPreviewContent(block.content),
    caption: block.caption ? formatPreviewContent(block.caption) : block.caption,
  }));
}

function substituteBlocks(blocks, values) {
  return blocks.map((block) => ({
    ...block,
    content: applyTemplateValues(block.content, values),
    caption: block.caption ? applyTemplateValues(block.caption, values) : block.caption,
  }));
}

function createPagePayload(template, values, user, orgId, parentId) {
  const templateBlocks = getTemplateBlocks(template);
  const finalBlocks = substituteBlocks(templateBlocks, values || []).map((block) => ({
    ...block,
    id: block.id || Math.random().toString(36).slice(2),
  }));
  return {
    title: applyTemplateValues(template.template_name || template.name || 'Untitled', values || {}),
    icon: template.icon || '📄',
    org_id: orgId,
    parent_id: parentId || null,
    content: JSON.stringify(finalBlocks),
    is_template: false,
    created_by_email: user?.email || '',
    created_by_name: user?.full_name || user?.email || '',
    category: null,
    reviewers: [],
  };
}

// ── Template card ──────────────────────────────────────────────────────────
function TemplateCard({ template, isUser, selected, onSelect, onUse, onPreview, onUntemplate }) {
  const vars = useMemo(() => {
    if (template.template_variables) {
      try { return JSON.parse(template.template_variables); } catch { return []; }
    }
    const re = /\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;
    const blocks = Array.isArray(template.blocks) ? template.blocks : [];
    const found = new Set();
    for (const b of blocks) { let m; while ((m = re.exec(b.content || '')) !== null) found.add(m[1]); }
    return [...found];
  }, [template]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(template)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(template)}
      className={cn(
        'group text-left w-full p-4 rounded-xl border transition-all cursor-pointer',
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl shrink-0">{template.icon || '📄'}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{template.template_name || template.name}</p>
            {(template.template_description || template.description) && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                {template.template_description || template.description}
              </p>
            )}
          </div>
        </div>
        {isUser && (
          <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
            <User className="h-2.5 w-2.5 mr-0.5" /> Mine
          </Badge>
        )}
      </div>

      {vars.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-2">
          {vars.slice(0, 3).map((v) => (
            <span key={v} className="font-mono text-[10px] bg-muted px-1 rounded text-muted-foreground">{`{{${v}}}`}</span>
          ))}
          {vars.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{vars.length - 3} more</span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={(e) => { e.stopPropagation(); onUse(template); }}
        >
          Use template
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs"
          onClick={(e) => { e.stopPropagation(); onPreview(template); }}
        >
          Preview
        </Button>
        {isUser && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onUntemplate(template); }}
            title="Remove from templates"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Preview panel ──────────────────────────────────────────────────────────
function PreviewPanel({ template, onUse }) {
  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-16">
        <LayoutTemplate className="h-10 w-10 opacity-30" />
        <p className="text-sm">Select a template to preview</p>
      </div>
    );
  }

  const previewBlocks = buildPreviewBlocks(template);
  const vars = detectTemplateVariables(template);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-3xl">{template.icon || '📄'}</span>
            <div>
              <h2 className="font-bold text-base">{template.template_name || template.name}</h2>
              {(template.template_category || template.category) && (
                <Badge variant="outline" className="mt-0.5 text-[10px] h-4">
                  {template.template_category || template.category}
                </Badge>
              )}
            </div>
          </div>
          {(template.template_description || template.description) && (
            <p className="text-sm text-muted-foreground mt-2">
              {template.template_description || template.description}
            </p>
          )}
          {vars.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
                <Braces className="h-3 w-3" /> Variables:
              </span>
              {vars.map((v) => (
                <span key={v} className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          )}
        </div>
        <Button size="sm" onClick={() => onUse(template)}>
          Use template
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1 pb-4">
        {previewBlocks.map((block, i) => (
          <BlockRenderer
            key={block.id || i}
            block={block}
            onChange={() => {}}
            onDelete={() => {}}
            onAddAfter={() => {}}
            onSlash={() => {}}
            onPasteBlocks={() => {}}
            onMoveUp={() => {}}
            onMoveDown={() => {}}
            onDuplicate={() => {}}
            readOnly
          />
        ))}
        {previewBlocks.length === 0 && (
          <p className="text-xs text-muted-foreground">No blocks in this template.</p>
        )}
      </div>
    </div>
  );
}

// ── Main Templates page ───────────────────────────────────────────────────
export default function Templates() {
  const { currentOrg, user } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [useDialog, setUseDialog] = useState(false);
  const [targetTemplate, setTargetTemplate] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);

  // Fetch user-created templates for this org
  const { data: userTemplates = [] } = useQuery({
    queryKey: ['templates', currentOrg?.id],
    queryFn: () => Page.filter({ org_id: currentOrg?.id, is_template: true }),
    enabled: !!currentOrg?.id,
    select: (data) => data.filter((p) => !p.is_deleted),
  });

  const userCategories = useMemo(
    () => [...new Set(userTemplates.map((t) => t.template_category).filter(Boolean))].sort(),
    [userTemplates]
  );

  const allCategories = useMemo(
    () => ['All', ...new Set([...ALL_BUILTIN_CATEGORIES, ...userCategories])],
    [userCategories]
  );

  const filteredBuiltin = useMemo(() => {
    const q = search.toLowerCase();
    return BUILTIN_TEMPLATES.filter((t) => {
      const matchCat = activeCategory === 'All' || t.category === activeCategory;
      const matchQ = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [search, activeCategory]);

  const filteredUser = useMemo(() => {
    const q = search.toLowerCase();
    return userTemplates.filter((t) => {
      const matchCat = activeCategory === 'All' || t.template_category === activeCategory;
      const name = (t.template_name || t.title || '').toLowerCase();
      const desc = (t.template_description || '').toLowerCase();
      return (!q || name.includes(q) || desc.includes(q)) && matchCat;
    });
  }, [search, activeCategory, userTemplates]);

  const handleUse = async (template) => {
    const vars = detectTemplateVariables(template);
    if (vars.length === 0) {
      try {
        const payload = createPagePayload(template, {}, user, currentOrg?.id, null);
        const newPage = await Page.create(payload);
        toast.success('Page created from template');
        navigate(`/page/${newPage.id}`);
      } catch {
        toast.error('Failed to create page');
      }
      return;
    }

    setTargetTemplate(template);
    setUseDialog(true);
  };

  const handlePreview = (template) => {
    setPreviewTemplate(template);
    setPreviewDialogOpen(true);
  };

  const handleUntemplate = async (template) => {
    await Page.update(template.id, withLastEditedBy({ is_template: false, template_name: null }, user));
    queryClient.invalidateQueries({ queryKey: ['templates', currentOrg?.id] });
    if (selectedTemplate?.id === template.id) setSelectedTemplate(null);
    toast.success('Removed from templates');
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar — categories */}
      <aside className="w-48 shrink-0 border-r border-border flex flex-col py-4 px-2 gap-0.5 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold px-2 mb-1">Categories</p>
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'text-left px-2 py-1.5 rounded-md text-sm transition-colors',
              activeCategory === cat
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {cat}
          </button>
        ))}
      </aside>

      {/* Center — template list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <PageHeader
          icon="📝"
          title="Templates"
          actions={
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates…"
                className="pl-8 h-8 text-sm"
              />
            </div>
          }
        />

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredUser.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1">
                <User className="h-3 w-3" /> Your templates
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredUser.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    isUser
                    selected={selectedTemplate?.id === t.id}
                    onSelect={setSelectedTemplate}
                    onUse={handleUse}
                    onPreview={handlePreview}
                    onUntemplate={handleUntemplate}
                  />
                ))}
              </div>
            </section>
          )}

          {filteredBuiltin.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Built-in templates
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredBuiltin.map((t) => (
                  <TemplateCard
                    key={t.name}
                    template={t}
                    isUser={false}
                    selected={!selectedTemplate?.id && selectedTemplate?.name === t.name}
                    onSelect={setSelectedTemplate}
                    onUse={handleUse}
                    onPreview={handlePreview}
                    onUntemplate={() => {}}
                  />
                ))}
              </div>
            </section>
          )}

          {filteredUser.length === 0 && filteredBuiltin.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <LayoutTemplate className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No templates match "{search}"</p>
              <p className="text-xs mt-1">Try a different search or category.</p>
            </div>
          )}

          {/* Save-as-template tip */}
          <div className="mt-8 p-4 rounded-xl border border-dashed border-border bg-muted/30 text-center">
            <p className="text-sm font-medium mb-1">Create your own template</p>
            <p className="text-xs text-muted-foreground">
              Open any page &rarr; <code className="bg-muted px-1 rounded text-[11px]">···</code> menu &rarr; <strong>Save as template</strong>.
              Use <code className="bg-muted px-1 rounded font-mono text-[11px]">{`{{VariableName}}`}</code> in content to add fill-in placeholders.
            </p>
          </div>
        </div>
      </div>

      {/* Right — preview panel (visible on lg+) */}
      <aside className="w-72 shrink-0 border-l border-border px-5 py-4 overflow-y-auto hidden lg:flex flex-col">
        <PreviewPanel template={selectedTemplate} onUse={handleUse} />
      </aside>

      <UseTemplateDialog
        open={useDialog}
        onOpenChange={setUseDialog}
        template={targetTemplate}
        orgId={currentOrg?.id}
        parentId={null}
        onCreated={(pageId) => navigate(`/page/${pageId}`)}
      />

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="sm:max-w-3xl lg:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{previewTemplate?.icon || '📄'}</span>
              Preview template
            </DialogTitle>
            <DialogDescription>
              {previewTemplate?.template_name || previewTemplate?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 max-h-[70vh] overflow-y-auto space-y-2">
            {previewTemplate ? (
              buildPreviewBlocks(previewTemplate).map((block, i) => (
                <BlockRenderer
                  key={block.id || i}
                  block={block}
                  onChange={() => {}}
                  onDelete={() => {}}
                  onAddAfter={() => {}}
                  onSlash={() => {}}
                  onPasteBlocks={() => {}}
                  onMoveUp={() => {}}
                  onMoveDown={() => {}}
                  onDuplicate={() => {}}
                  readOnly
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No preview available.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}