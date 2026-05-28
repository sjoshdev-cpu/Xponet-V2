import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Task } from '@/api/firestoreClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarDays, User, X } from 'lucide-react';
import {
  extractDateFromTitle,
  extractMentionFromTitle,
  parseNaturalDate,
  DATE_SHORTCUT_LABELS,
} from '@/utils/nlpDate';

const STATUSES = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

export default function QuickAddTask({ open, onClose }) {
  const { currentOrg } = useWorkspace();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeName, setAssigneeName] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('To Do');
  const [dateInput, setDateInput] = useState('');
  const [dateHints, setDateHints] = useState([]);

  // Reset state on open
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDueDate('');
    setAssigneeName('');
    setPriority('Medium');
    setStatus('To Do');
    setDateInput('');
    setDateHints([]);
  }, [open]);

  const handleTitleChange = (val) => {
    setTitle(val);
    // Live-parse NLP date + @mention from title
    const { dueDate: d } = extractDateFromTitle(val);
    if (d) setDueDate(d);
    const { assigneeName: a } = extractMentionFromTitle(extractDateFromTitle(val).cleanTitle);
    if (a && !assigneeName) setAssigneeName(a);
  };

  const handleDateInputChange = (val) => {
    setDateInput(val);
    const parsed = parseNaturalDate(val);
    if (parsed) setDueDate(parsed);
    const lower = val.toLowerCase();
    setDateHints(
      val.length > 0
        ? DATE_SHORTCUT_LABELS.filter((o) => o.startsWith(lower) && o !== lower)
        : []
    );
  };

  const applyDateShortcut = (shortcut) => {
    const d = parseNaturalDate(shortcut);
    if (d) {
      setDueDate(d);
      setDateInput('');
      setDateHints([]);
    }
  };

  const createTask = useMutation({
    mutationFn: (data) => Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created', {
        description: finalTitle(),
        action: { label: 'View task', onClick: () => navigate('/tasks') },
        duration: 5000,
      });
      onClose();
    },
  });

  const finalTitle = () => {
    let { cleanTitle } = extractDateFromTitle(title);
    ({ cleanTitle } = extractMentionFromTitle(cleanTitle));
    return cleanTitle || title;
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    createTask.mutate({
      title: finalTitle(),
      status,
      priority,
      due_date: dueDate || undefined,
      assignee_name: assigneeName || undefined,
      org_id: currentOrg?.id,
    });
  };

  const dueDateDisplay = dueDate
    ? (() => {
        try {
          return format(new Date(dueDate + 'T12:00:00'), 'MMM d, yyyy');
        } catch {
          return dueDate;
        }
      })()
    : '';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Add Task</DialogTitle>
          <DialogDescription className="sr-only">Quickly create a new task with a title and optional details.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Title — NLP-aware */}
          <div>
            <Input
              autoFocus
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder='Task title… add "tomorrow" or "@Name" to auto-fill'
              className="text-base"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim()) handleCreate();
                if (e.key === 'Escape') onClose();
              }}
            />
            {/* Parsed hints row */}
            {(dueDate || assigneeName) && (
              <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                {dueDate && (
                  <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                    <CalendarDays className="h-3 w-3" />
                    {dueDateDisplay}
                    <button
                      onClick={() => setDueDate('')}
                      className="ml-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
                {assigneeName && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <User className="h-3 w-3" />
                    {assigneeName}
                    <button
                      onClick={() => setAssigneeName('')}
                      className="ml-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due date — NLP input */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5">Due date</Label>
            <div className="relative">
              <Input
                value={dateInput || dueDateDisplay}
                onChange={(e) => handleDateInputChange(e.target.value)}
                onFocus={() => { if (dueDate) setDateInput(''); }}
                placeholder="today, tomorrow, next Monday…"
                className="h-8 text-sm pr-7"
              />
              {dueDate && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => { setDueDate(''); setDateInput(''); }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Quick shortcuts */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {['today', 'tomorrow', 'next monday', 'next friday'].map((d) => (
                <button
                  key={d}
                  onClick={() => applyDateShortcut(d)}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                    dueDate === parseNaturalDate(d)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted hover:bg-accent text-muted-foreground hover:text-foreground border-transparent'
                  )}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Autocomplete dropdown */}
            {dateHints.length > 0 && (
              <div className="mt-1 border border-border rounded-md overflow-hidden bg-popover shadow-md z-50">
                {dateHints.map((hint) => (
                  <button
                    key={hint}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                    onClick={() => applyDateShortcut(hint)}
                  >
                    {hint}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Assignee quick fill */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5">Assignee name</Label>
            <Input
              value={assigneeName}
              onChange={(e) => setAssigneeName(e.target.value)}
              placeholder="or type @Name in title above"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground italic">Tip: "Fix bug tomorrow @Alice" auto-fills date &amp; assignee</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!title.trim() || createTask.isPending}
            >
              {createTask.isPending ? 'Adding…' : 'Add task'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
