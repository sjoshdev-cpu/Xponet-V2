import React, { useState } from 'react';
import { Task } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Plus, X, ClipboardList, Circle, CheckCircle2 } from 'lucide-react';
import TaskModal from '@/components/tasks/TaskModal';
import { getAssignees, getInitials } from '@/lib/task-utils';

const STATUS_DOT = {
  Backlog: <Circle className="h-3 w-3 text-slate-400" />,
  'To Do': <Circle className="h-3 w-3 text-blue-500" />,
  'In Progress': <Circle className="h-3 w-3 text-yellow-500" />,
  'In Review': <Circle className="h-3 w-3 text-purple-500" />,
  Done: <CheckCircle2 className="h-3 w-3 text-green-500" />,
};

export default function LinkedTasksPanel({ pageId, pageTitle, onClose }) {
  const { currentOrg, user } = useWorkspace();
  const queryClient = useQueryClient();
  const [editingTask, setEditingTask] = useState(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [addingQuick, setAddingQuick] = useState(false);

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', currentOrg?.id],
    queryFn: () => Task.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id,
  });

  const linkedTasks = tasks.filter((t) => t.page_id === pageId);

  const createTask = useMutation({
    mutationFn: (data) => Task.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => Task.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteTask = useMutation({
    mutationFn: (id) => Task.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const handleQuickAdd = async () => {
    if (!quickTitle.trim()) return;
    await createTask.mutateAsync({
      title: quickTitle.trim(),
      status: 'To Do',
      priority: 'Medium',
      org_id: currentOrg?.id,
      page_id: pageId,
      page_title: pageTitle || 'Untitled',
    });
    setQuickTitle('');
    setAddingQuick(false);
  };

  return (
    <div className="fixed top-14 right-4 z-40 w-72 bg-popover border border-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Linked Tasks
          </span>
          {linkedTasks.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {linkedTasks.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {linkedTasks.length === 0 && !addingQuick ? (
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <ClipboardList className="h-7 w-7 opacity-25" />
            <p className="text-xs text-center">No tasks linked to this page yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {linkedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-2 px-3 py-2.5 hover:bg-accent/30 cursor-pointer transition-colors group"
                onClick={() => setEditingTask(task)}
              >
                <div className="shrink-0">
                  {STATUS_DOT[task.status] || STATUS_DOT['To Do']}
                </div>
                <span
                  className={cn(
                    'flex-1 text-sm truncate',
                    task.status === 'Done' && 'line-through text-muted-foreground',
                  )}
                >
                  {task.title}
                </span>
                {(() => {
                  const assignees = getAssignees(task);
                  if (assignees.length === 0) return null;
                  return (
                    <div className="flex -space-x-1.5 shrink-0">
                      {assignees.slice(0, 3).map((a, i) => (
                        <div key={a.email || i} title={a.name || a.email}
                          className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary border-2 border-card">
                          {getInitials(a)}
                        </div>
                      ))}
                      {assignees.length > 3 && (
                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground border-2 border-card">
                          +{assignees.length - 3}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer quick-add */}
      <div className="px-3 py-2.5 border-t border-border shrink-0">
        {addingQuick ? (
          <div className="space-y-2">
            <Input
              autoFocus
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Task title…"
              className="h-7 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickAdd();
                if (e.key === 'Escape') setAddingQuick(false);
              }}
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="h-6 text-xs px-3"
                onClick={handleQuickAdd}
                disabled={!quickTitle.trim() || createTask.isPending}
              >
                Add
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs px-2"
                onClick={() => { setAddingQuick(false); setQuickTitle(''); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-0.5"
            onClick={() => setAddingQuick(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add linked task
          </button>
        )}
      </div>

      {/* Task edit modal */}
      {editingTask && (
        <TaskModal
          task={editingTask}
          onSave={async (data) => {
            if (data.id) await updateTask.mutateAsync({ id: data.id, data });
            setEditingTask(null);
          }}
          onClose={() => setEditingTask(null)}
          onDelete={
            editingTask.id
              ? () => {
                  deleteTask.mutate(editingTask.id);
                  setEditingTask(null);
                }
              : null
          }
          currentUser={user}
        />
      )}
    </div>
  );
}
