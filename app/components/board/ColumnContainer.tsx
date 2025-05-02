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
      className={`flex flex-col w-80 flex-shrink-0 mr-4`} // Added fixed width and margin
    >
      <div
        className={`p-3 rounded-t-xl border-b-2 ${getColumnStyle(
          column.id
        )} glass-dark flex justify-between items-center`}
      >
        <h3 className='text-sm font-semibold text-foreground flex items-center'>
          <span className='mr-2'>{column.title}</span>
          <span className='text-xs text-muted-foreground bg-muted/50 rounded-full px-1.5 py-0.5'>
            {tasks.length}
          </span>
        </h3>
        <button
          className='p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
          aria-label='More column options'
        >
          <MoreHorizontal className='w-4 h-4' />
        </button>
      </div>
      {/* Make the content area scrollable */}
      <div
        className={`flex-1 overflow-y-auto p-3 rounded-b-xl glass-dark- DND-TARGET ${getColumnStyle(
          column.id
        )} border-l-2 border-r-2 border-b-2`} // Added border styles consistent with top
        style={{ maxHeight: 'calc(100vh - 200px)' }} // Adjust max height as needed
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
      <button className='mt-3 btn btn-ghost w-full text-sm justify-start px-3 py-2 flex items-center gap-2'>
        <Plus className='w-4 h-4' />
        Add a card
      </button>
    </div>
  );
}
