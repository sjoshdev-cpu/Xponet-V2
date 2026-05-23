import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Notification } from '@/api/firestoreClient';

const STATUSES = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const EFFORTS = ['XS', 'S', 'M', 'L', 'XL'];

export default function TaskModal({ task, onSave, onClose, onDelete, currentUser }) {
  const [form, setForm] = useState({ ...task });
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    // Fire task_assigned notification if assignee email changed
    const prevEmail = task.assignee_email;
    const newEmail = form.assignee_email;
    if (newEmail && newEmail !== prevEmail && newEmail !== currentUser?.email) {
      Notification.create({
        recipient_email: newEmail,
        type: 'task_assigned',
        title: `${currentUser?.full_name || currentUser?.email || 'Someone'} assigned you a task`,
        body: form.title,
        org_id: form.org_id,
        sender_email: currentUser?.email,
        sender_name: currentUser?.full_name,
        is_read: false,
      });
    }
    await onSave(form);
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task.id ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5">Title</Label>
            <Input
              value={form.title || ''}
              onChange={e => set('title', e.target.value)}
              placeholder="Task title..."
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5">Description</Label>
            <textarea
              value={form.description || ''}
              onChange={e => set('description', e.target.value)}
              placeholder="Add a description..."
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Status</Label>
              <Select value={form.status || 'To Do'} onValueChange={v => set('status', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Priority</Label>
              <Select value={form.priority || 'Medium'} onValueChange={v => set('priority', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
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
                onChange={e => set('due_date', e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Effort</Label>
              <Select value={form.effort || ''} onValueChange={v => set('effort', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select effort" />
                </SelectTrigger>
                <SelectContent>
                  {EFFORTS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Assignee Name</Label>
              <Input
                value={form.assignee_name || ''}
                onChange={e => set('assignee_name', e.target.value)}
                placeholder="e.g. John Doe"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5">Assignee Email</Label>
              <Input
                value={form.assignee_email || ''}
                onChange={e => set('assignee_email', e.target.value)}
                placeholder="e.g. john@co.com"
                type="email"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          {onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive gap-1.5">
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