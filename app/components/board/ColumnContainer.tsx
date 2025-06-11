'use client';

import React from 'react';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus, MoreHorizontal } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { ListNameEditor } from './ListNameEditor';

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

// Interface for the drag over info
interface DragOverInfo {
  id: string | null;
  type: 'task' | 'column' | null;
  index: number | null;
  columnId: string | null;
}

interface ColumnContainerProps {
  column: Column;
  tasks: Task[]; // Pass only the tasks for this column
  getColumnStyle: (id: string) => string; // Pass the style helper
  labelColors: Record<string, string>; // Pass the color map
  dragOverInfo: DragOverInfo; // Add the dragOverInfo
  activeTaskId: string | undefined; // The ID of the task being dragged
  onUpdateListName?: (listId: string, newName: string) => Promise<boolean>; // Add update function
}

export function ColumnContainer({
  column,
  tasks,
  getColumnStyle,
  labelColors,
  dragOverInfo,
  activeTaskId,
  onUpdateListName,
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

  // Check if this column is the one being dragged over
  const isColumnBeingDraggedOver = dragOverInfo.columnId === column.id;

  // Function to render drop indicators between tasks
  const renderDropIndicator = (index: number) => {
    // Only show indicator if this is the column being dragged over
    // and the index matches where the task would be inserted
    const shouldShow =
      isColumnBeingDraggedOver &&
      dragOverInfo.index === index &&
      dragOverInfo.type === 'task';

    if (!shouldShow) return null;

    return (
      <div className='py-2 px-2'>
        <div
          className='h-1 bg-primary rounded-full w-full transition-all duration-200 animate-pulse'
          style={{ height: '4px' }}
        />
      </div>
    );
  };

  // Show empty column indicator
  const showEmptyColumnIndicator =
    isColumnBeingDraggedOver &&
    (!tasks.length ||
      (dragOverInfo.type === 'column' && dragOverInfo.id === column.id));

  return (
    <div
      ref={setColumnRef}
      className='flex flex-col w-80 flex-shrink-0 mr-5 kanban-column rounded-xl overflow-hidden max-h-[calc(100vh-250px)]'
    >
      <div
        className={`p-4 rounded-t-xl kanban-column-header flex justify-between items-center ${getColumnStyle(
          column.id
        )}`}
      >
        <div className='flex items-center gap-2 flex-1'>
          {onUpdateListName ? (
            <ListNameEditor
              listName={column.title}
              onSave={(newName) => onUpdateListName(column.id, newName)}
            />
          ) : (
            <span className='text-sm font-semibold text-foreground'>
              {column.title}
            </span>
          )}
          <span className='text-xs text-white/80 bg-black/20 rounded-full px-1.5 py-0.5 backdrop-blur-sm flex-shrink-0'>
            {tasks.length}
          </span>
        </div>
        <button
          className='p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors'
          aria-label='More column options'
        >
          <MoreHorizontal className='w-4 h-4' />
        </button>
      </div>
      {/* Make the content area scrollable */}
      <div
        className={`flex-1 overflow-y-auto p-4 kanban-column-content rounded-b-xl ${getColumnStyle(
          column.id
        )}`}
        style={{ maxHeight: 'calc(100vh - 350px)' }} // Increased height for bigger lists
      >
        <SortableContext items={taskIds}>
          <div className='space-y-2 transition-all duration-300 ease-in-out'>
            {/* Show indicator at the top if dropping at index 0 */}
            {renderDropIndicator(0)}

            {tasks.map((task, index) => (
              <div
                key={task.id}
                className='animate-slideUp'
                style={{
                  animationFillMode: 'both',
                  animationDelay: `${index * 50}ms`, // Stagger the animations
                }}
              >
                <TaskCard
                  task={task}
                  labelColors={labelColors}
                  columnId={column.id}
                  isDragTarget={dragOverInfo.id === task.id}
                  isBeingDragged={task.id === activeTaskId}
                />
                {/* Show drop indicator after each task */}
                {renderDropIndicator(index + 1)}
              </div>
            ))}

            {/* Empty Column Indicator */}
            {tasks.length === 0 && (
              <div
                className={`flex h-28 items-center justify-center rounded-lg border-2 border-dashed transition-all duration-300 ease-in-out animate-scaleIn ${
                  showEmptyColumnIndicator
                    ? 'border-primary bg-primary/10 animate-pulse'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    showEmptyColumnIndicator ? 'text-primary' : 'text-white/50'
                  }`}
                >
                  {showEmptyColumnIndicator ? 'Drop here' : 'No tasks'}
                </p>
              </div>
            )}
          </div>
        </SortableContext>
      </div>
      <div className='sticky bottom-0 p-2 bg-background/80 backdrop-blur-sm border-t border-white/5'>
        <button className='text-white/70 hover:text-white bg-white/5 hover:bg-white/10 w-full text-sm justify-start px-3 py-2 flex items-center gap-2 rounded-lg border border-white/5 transition-all duration-200'>
          <Plus className='w-4 h-4' />
          Add a card
        </button>
      </div>
    </div>
  );
}
