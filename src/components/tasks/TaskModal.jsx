import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trash2, Link as LinkIcon, X, Search, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Notification, Page } from '@/api/firestoreClient';
import { useQuery } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { parseNaturalDate, DATE_SHORTCUT_LABELS } from '@/utils/nlpDate';
import { format } from 'date-fns';
import { getAssignees, buildAssigneeFields, getInitials, TASK_CATEGORIES } from '@/lib/task-utils';

const STATUSES = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const EFFORTS = ['XS', 'S', 'M', 'L', 'XL'];

/** Compact NLP date row shown below the date input */
function DateShortcuts({ onSelect }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {['today', 'tomorrow', 'next monday', 'next friday'].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onSelect(parseNaturalDate(d))}
          className="text-[10px] px-2 py-0.5 rounded-full bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors border border-transparent"
        >
          {d}
        </button>
      ))}
    </div>
  );
}

/** Multi-select assignee picker — avatar stack + popover checklist of org members */
function AssigneePicker({ assignees, onChange, orgMembers }) {
  const [open, setOpen] = useState(false);
  const currentEmails = new Set(assignees.map((a) => a.email));

  const toggleMember = (member) => {
    const next = currentEmails.has(member.email)
      ? assignees.filter((a) => a.email !== member.email)
      : [...assignees, { email: member.email, name: member.name }];
    onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 w-full px-3 py-2 border border-input rounded-md text-sm hover:border-border-hover transition-colors min-h-9"
        >
          {assignees.length === 0 ? (
            <span className="text-muted-foreground">Unassigned</span>
          ) : (
            <div className="flex -space-x-1.5">
              {assignees.map((a, i) => (
                <div key={a.email || i} title={a.name || a.email}
                  className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-semibold flex items-center justify-center border-2 border-background">
                  {getInitials(a)}
                </div>
              ))}
            </div>
          )}
          <span className="flex-1 text-left truncate text-muted-foreground text-xs">
            {assignees.length > 0 && (assignees.length === 1 ? assignees[0].name || assignees[0].email : `${assignees.length} assignees`)}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        {!orgMembers?.length ? (
          <p className="text-xs text-muted-foreground px-2 py-1.5">No members found.</p>
        ) : (
          <div className="space-y-0.5 max-h-56 overflow-y-auto">
            {orgMembers.map((m) => {
              const isSelected = currentEmails.has(m.email);
              return (
                <button key={m.email} type="button"
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted/60"
                  onClick={() => toggleMember({ email: m.email, name: m.full_name || '' })}>
                  <Check className={cn('w-3.5 h-3.5 shrink-0', isSelected ? 'text-primary' : 'opacity-0')} />
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                    {getInitials({ name: m.full_name, email: m.email })}
                  </div>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="truncate text-xs font-medium leading-tight">{m.full_name || m.email}</span>
                    {m.full_name && (
                      <span className="truncate text-[10px] text-muted-foreground leading-tight">{m.email}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function TaskModal({ task, onSave, onClose, onDelete, currentUser }) {
  const [form, setForm] = useState({ ...task, assignees: getAssignees(task) });
  const [saving, setSaving] = useState(false);
  const [pageSearch, setPageSearch] = useState('');
  const [pagePickerOpen, setPagePickerOpen] = useState(false);

  const { currentOrg } = useWorkspace();

  const { data: pages = [] } = useQuery({
    queryKey: ['pages', currentOrg?.id],
    queryFn: () => Page.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id && pagePickerOpen,
  });

  const activePages = pages.filter((p) => !p.is_deleted && !p.is_template);
  const filteredPages = pageSearch
    ? activePages.filter((p) =>
        (p.title || '').toLowerCase().includes(pageSearch.toLowerCase()),
      )
    : activePages.slice(0, 8);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    const prevAssignees = getAssignees(task);
    const prevEmails = new Set(prevAssignees.map((a) => a.email));
    const newlyAdded = (form.assignees || []).filter((a) => a.email && !prevEmails.has(a.email));

    newlyAdded
      .filter((a) => a.email !== currentUser?.email)
      .forEach((a) => {
        Notification.create({
          recipient_email: a.email,
          type: 'task_assigned',
          title: `${currentUser?.full_name || currentUser?.email || 'Someone'} assigned you a task`,
          body: form.title,
          org_id: form.org_id,
          sender_email: currentUser?.email,
          sender_name: currentUser?.full_name,
          is_read: false,
        });
      });

    await onSave({ ...form, ...buildAssigneeFields(form.assignees) });
    setSaving(false);
  };

  const dueDateDisplay = form.due_date
    ? (() => {
        try { return format(new Date(form.due_date + 'T12:00:00'), 'MMM d, yyyy'); }
        catch { return form.due_date; }
      })()
    : '';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task.id ? 'Edit Task' : 'New Task'}</DialogTitle>
          <DialogDescription className="sr-only">Fill in the task details below.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5">Title</Label>
            <Input
              value={form.title || ''}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Task title..."
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5">Description</Label>
            <textarea
              value={form.description || ''}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Add a description..."
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Status</Label>
              <Select value={form.status || 'To Do'} onValueChange={(v) => set('status', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Priority</Label>
              <Select value={form.priority || 'Medium'} onValueChange={(v) => set('priority', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Due Date</Label>
              <Input
                type="date"
                value={form.due_date || ''}
                onChange={(e) => set('due_date', e.target.value)}
                className="h-9"
              />
              <DateShortcuts onSelect={(d) => set('due_date', d)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Effort</Label>
              <Select value={form.effort || ''} onValueChange={(v) => set('effort', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select effort" />
                </SelectTrigger>
                <SelectContent>
                  {EFFORTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Category</Label>
              <Select value={form.category || 'General'} onValueChange={(v) => set('category', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5">Assignees</Label>
            <AssigneePicker
              assignees={form.assignees || []}
              onChange={(next) => set('assignees', next)}
              orgMembers={currentOrg?.members}
            />
          </div>

          {/* Linked Page */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5">Linked Page</Label>
            {form.page_id ? (
              <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-md bg-muted/30">
                <span className="text-sm">{form.page_icon || '📄'}</span>
                <span className="flex-1 text-sm truncate">{form.page_title || 'Untitled'}</span>
                <button
                  type="button"
                  onClick={() => set('page_id', null) || set('page_title', null) || set('page_icon', null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Popover open={pagePickerOpen} onOpenChange={setPagePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 w-full px-3 py-2 border border-dashed border-border rounded-md text-sm text-muted-foreground hover:text-foreground hover:border-border-hover transition-colors"
                  >
                    <LinkIcon className="h-4 w-4" />
                    Link to a page…
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="start">
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      autoFocus
                      value={pageSearch}
                      onChange={(e) => setPageSearch(e.target.value)}
                      placeholder="Search pages…"
                      className="h-8 text-sm pl-7"
                    />
                  </div>
                  <div className="max-h-[220px] overflow-y-auto space-y-0.5">
                    {filteredPages.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No pages found</p>
                    ) : (
                      filteredPages.map((page) => (
                        <button
                          key={page.id}
                          type="button"
                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-accent transition-colors text-left"
                          onClick={() => {
                            set('page_id', page.id);
                            set('page_title', page.title || 'Untitled');
                            set('page_icon', page.icon || '📄');
                            setPagePickerOpen(false);
                            setPageSearch('');
                          }}
                        >
                          <span className="text-sm shrink-0">{page.icon || '📄'}</span>
                          <span className="text-sm truncate">{page.title || 'Untitled'}</span>
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:text-destructive gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.title}>
              {saving ? 'Saving...' : task.id ? 'Save changes' : 'Create task'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
