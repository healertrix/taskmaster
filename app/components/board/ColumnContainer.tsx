'use client';

import React from 'react';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus, MoreHorizontal } from 'lucide-react';
import { TaskCard } from './TaskCard'; // We will create this next

// Define Task type matching page.tsx
interface Task {
  id: string;
  title: string;
  labels?: { color: string; text: string }[];
  assignees?: { initials: string; color: string }[];
  attachments?: number;
  comments?: number;
}

interface Column {
  id: string;
  title: string;
  cards: Task[];
}

interface ColumnContainerProps {
  column: Column;
  tasks: Task[]; // Pass only the tasks for this column
  getColumnStyle: (id: string) => string; // Pass the style helper
  labelColors: Record<string, string>; // Pass the color map
}

export function ColumnContainer({
  column,
  tasks,
  getColumnStyle,
  labelColors,
}: ColumnContainerProps) {
  // Use useDroppable for the column to accept tasks
  const { setNodeRef: setColumnRef } = useDroppable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
  });

  // Get task IDs for SortableContext
  const taskIds = React.useMemo(() => tasks.map((task) => task.id), [tasks]);

  return (
    <div
      ref={setColumnRef}
      className='flex flex-col w-72 flex-shrink-0 mr-3 kanban-column rounded-xl overflow-hidden'
    >
      <div
        className={`p-3 rounded-t-xl kanban-column-header flex justify-between items-center ${getColumnStyle(
          column.id
        )}`}
      >
        <h3 className='text-sm font-semibold text-foreground flex items-center'>
          <span className='mr-2'>{column.title}</span>
          <span className='text-xs text-white/80 bg-black/20 rounded-full px-1.5 py-0.5 backdrop-blur-sm'>
            {tasks.length}
          </span>
        </h3>
        <button
          className='p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors'
          aria-label='More column options'
        >
          <MoreHorizontal className='w-4 h-4' />
        </button>
      </div>
      {/* Make the content area scrollable */}
      <div
        className={`flex-1 overflow-y-auto p-3 kanban-column-content rounded-b-xl ${getColumnStyle(
          column.id
        )}`}
        style={{ maxHeight: 'calc(100vh - 220px)' }} // Adjusted max height
      >
        <SortableContext items={taskIds}>
          <div className='space-y-3'>
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                labelColors={labelColors}
                columnId={column.id} // Pass the column ID to each task
              />
            ))}
          </div>
        </SortableContext>
      </div>
      <button className='mt-3 text-white/70 hover:text-white bg-white/5 hover:bg-white/10 w-full text-sm justify-start px-3 py-2.5 flex items-center gap-2 rounded-lg border border-white/5 transition-all duration-200'>
        <Plus className='w-4 h-4' />
        Add a card
      </button>
    </div>
  );
}
