import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import TaskCard from './TaskCard';

const STATUSES = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Done'];

const STATUS_COLORS = {
  'Backlog': 'text-slate-500',
  'To Do': 'text-blue-500',
  'In Progress': 'text-yellow-500',
  'In Review': 'text-purple-500',
  'Done': 'text-green-500',
};

export default function KanbanBoard({ tasks, onUpdateTask, onOpenTask, onCreateTask }) {
  const grouped = STATUSES.reduce((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s);
    return acc;
  }, {});

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId;
    onUpdateTask(taskId, { status: newStatus });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 h-full overflow-x-auto p-6 pb-8">
        {STATUSES.map(status => (
          <div key={status} className="flex flex-col w-[280px] shrink-0">
            {/* Column header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-semibold uppercase tracking-wider', STATUS_COLORS[status])}>
                  {status}
                </span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {grouped[status].length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <Droppable droppableId={status}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'flex-1 rounded-xl p-2 space-y-2 min-h-[200px] transition-colors',
                    snapshot.isDraggingOver ? 'bg-accent/60' : 'bg-muted/40'
                  )}
                >
                  {grouped[status].map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <TaskCard
                            task={task}
                            onClick={() => onOpenTask(task)}
                            isDragging={snapshot.isDragging}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  <button
                    onClick={() => onCreateTask(status)}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-lg transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add task
                  </button>
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}