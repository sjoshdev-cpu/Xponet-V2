import React, { useState, useEffect } from 'react';
import { Task } from '@/api/firestoreClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import { Plus, ClipboardList, AlertTriangle, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/layout/PageHeader';
import { isToday, isPast, isThisWeek } from 'date-fns';
import KanbanBoard from '@/components/tasks/KanbanBoard';
import TaskTable from '@/components/tasks/TaskTable';
import TaskModal from '@/components/tasks/TaskModal';
import WorkloadView from '@/components/tasks/WorkloadView';
import { isAssignedTo } from '@/lib/task-utils';
import { canViewAllTasks } from '@/lib/permissions';

const TABS = [
  { id: 'Board',      label: 'Board' },
  { id: 'Table',      label: 'Table' },
  { id: 'My Tasks',   label: 'My Tasks' },
  { id: 'Overdue',    label: 'Overdue',       icon: AlertTriangle },
  { id: 'Due Today',  label: 'Due Today',     icon: Calendar },
  { id: 'This Week',  label: 'Due This Week', icon: Calendar },
  { id: 'Team',       label: 'Team',          icon: Users },
];

export default function Tasks() {
  const { currentOrg, user, role } = useWorkspace();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Board');
  const [editingTask, setEditingTask] = useState(null);
  const [creatingStatus, setCreatingStatus] = useState(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', currentOrg?.id, role, user?.email],
    queryFn: () =>
      canViewAllTasks(role)
        ? Task.filter({ org_id: currentOrg?.id })
        : Task.filter({ org_id: currentOrg?.id, assignee_emails: { arrayContains: user?.email } }),
    enabled: !!currentOrg?.id && !!role,
    // The onSnapshot listener below is the live source of truth
    refetchInterval: false,
  });

  // Realtime collaboration: subscribe to the same query with onSnapshot and
  // push every change straight into the react-query cache, so edits made by
  // other members appear immediately without a refresh.
  useEffect(() => {
    if (!currentOrg?.id || !role) return;
    const filters = canViewAllTasks(role)
      ? { org_id: currentOrg.id }
      : { org_id: currentOrg.id, assignee_emails: { arrayContains: user?.email } };
    return Task.listen(filters, (docs) => {
      queryClient.setQueryData(['tasks', currentOrg.id, role, user?.email], docs);
    });
  }, [currentOrg?.id, role, user?.email, queryClient]);

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

  const myTasks = tasks.filter((t) => isAssignedTo(t, user?.email));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueTasks = tasks.filter(
    (t) =>
      t.due_date &&
      isPast(new Date(t.due_date)) &&
      !isToday(new Date(t.due_date)) &&
      t.status !== 'Done',
  );

  const dueTodayTasks = tasks.filter(
    (t) => t.due_date && isToday(new Date(t.due_date)),
  );

  const dueThisWeekTasks = tasks.filter(
    (t) =>
      t.due_date &&
      isThisWeek(new Date(t.due_date), { weekStartsOn: 1 }) &&
      t.status !== 'Done',
  );

  /** Map tab id → filtered task list (for table/list-based tabs) */
  const tabTasks = {
    'My Tasks': myTasks,
    Overdue: overdueTasks,
    'Due Today': dueTodayTasks,
    'This Week': dueThisWeekTasks,
    Team: tasks,
  };

  const tabEmptyMessages = {
    'My Tasks': 'No tasks assigned to you',
    Overdue: '🎉 No overdue tasks',
    'Due Today': 'Nothing due today',
    'This Week': 'Nothing due this week',
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon="✅"
        title="Tasks"
        badge={
          overdueTasks.length > 0 ? (
            <span className="flex items-center gap-1 text-xs text-red-600 font-semibold bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full">
              <AlertTriangle className="h-3 w-3" />
              {overdueTasks.length} overdue
            </span>
          ) : null
        }
        actions={
          <Button size="sm" onClick={() => handleOpenCreate()}>
            <Plus className="h-4 w-4 mr-1" /> New Task
          </Button>
        }
      />

      {/* Tabs */}
      <div className="border-b border-border px-6 flex gap-1 shrink-0 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const badgeCount =
            tab.id === 'Overdue' ? overdueTasks.length
            : tab.id === 'Due Today' ? dueTodayTasks.length
            : tab.id === 'This Week' ? dueThisWeekTasks.length
            : null;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {tab.label}
              {badgeCount > 0 && (
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                  tab.id === 'Overdue'
                    ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
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
        ) : activeTab === 'Team' ? (
          <WorkloadView
            tasks={tasks}
            onOpenTask={setEditingTask}
          />
        ) : (
          <TaskTable
            tasks={tabTasks[activeTab] || []}
            onUpdateTask={(id, data) => updateTask.mutate({ id, data })}
            onOpenTask={setEditingTask}
            onCreateTask={() => handleOpenCreate()}
            onDeleteTask={(id) => deleteTask.mutate(id)}
            emptyMessage={tabEmptyMessages[activeTab]}
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