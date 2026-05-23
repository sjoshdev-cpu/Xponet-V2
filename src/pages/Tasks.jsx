import React, { useState } from 'react';
import { Task } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import { Plus, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KanbanBoard from '@/components/tasks/KanbanBoard';
import TaskTable from '@/components/tasks/TaskTable';
import TaskModal from '@/components/tasks/TaskModal';

const TABS = ['Board', 'Table', 'My Tasks'];

export default function Tasks() {
  const { currentOrg, user } = useWorkspace();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Board');
  const [editingTask, setEditingTask] = useState(null);
  const [creatingStatus, setCreatingStatus] = useState(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', currentOrg?.id],
    queryFn: () => Task.filter({ org_id: currentOrg?.id }),
    enabled: !!currentOrg?.id
  });

  const createTask = useMutation({
    mutationFn: (data) => Task.create({ ...data, org_id: currentOrg?.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] })
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }) => Task.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] })
  });

  const deleteTask = useMutation({
    mutationFn: (id) => Task.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] })
  });

  const handleOpenCreate = (status = 'To Do') => {
    setCreatingStatus(status);
    setEditingTask({ title: '', status, priority: 'Medium', org_id: currentOrg?.id });
  };

  const handleSave = async (taskData) => {
    if (taskData.id) {
      await updateTask.mutateAsync({ id: taskData.id, data: taskData });
    } else {
      await createTask.mutateAsync(taskData);
    }
    setEditingTask(null);
    setCreatingStatus(null);
  };

  const myTasks = tasks.filter(t => t.assignee_email === user?.email);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Tasks</h1>
        </div>
        <Button size="sm" onClick={() => handleOpenCreate()}>
          <Plus className="h-4 w-4 mr-1" /> New Task
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-6 flex gap-1 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : activeTab === 'Board' ? (
          <KanbanBoard
            tasks={tasks}
            onUpdateTask={(id, data) => updateTask.mutate({ id, data })}
            onOpenTask={setEditingTask}
            onCreateTask={handleOpenCreate}
          />
        ) : activeTab === 'Table' ? (
          <TaskTable
            tasks={tasks}
            onUpdateTask={(id, data) => updateTask.mutate({ id, data })}
            onOpenTask={setEditingTask}
            onCreateTask={() => handleOpenCreate()}
            onDeleteTask={(id) => deleteTask.mutate(id)}
          />
        ) : (
          <TaskTable
            tasks={myTasks}
            onUpdateTask={(id, data) => updateTask.mutate({ id, data })}
            onOpenTask={setEditingTask}
            onCreateTask={() => handleOpenCreate()}
            onDeleteTask={(id) => deleteTask.mutate(id)}
            emptyMessage="No tasks assigned to you"
          />
        )}
      </div>

      {/* Task Modal */}
      {editingTask !== null && (
        <TaskModal
          task={editingTask}
          onSave={handleSave}
          onClose={() => { setEditingTask(null); setCreatingStatus(null); }}
          onDelete={editingTask.id ? () => { deleteTask.mutate(editingTask.id); setEditingTask(null); } : null}
          currentUser={user}
        />
      )}
    </div>
  );
}