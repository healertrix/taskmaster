'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, CheckSquare, ArrowUp, Bug } from 'lucide-react';
import { TaskActionsMenu } from './TaskActionsMenu';

// Define Task type matching page.tsx
interface Task {
  id: string;
  title: string;
  labels?: { color: string; text: string }[];
  assignees?: { initials: string; color: string }[];
  attachments?: number;
  comments?: number;
  start_date?: string;
  due_date?: string;
  due_status?: 'due_soon' | 'overdue' | 'complete' | null;
}

interface TaskCardProps {
  task: Task;
  labelColors: Record<string, string>; // Pass the color map
  columnId: string; // Add columnId prop to identify container
  isDragTarget?: boolean; // Whether this task is currently being dragged over
  isBeingDragged?: boolean; // Whether this task is being dragged
  onEditTask?: (taskId: string) => void;
  onCopyTask?: (taskId: string) => void;
  onArchiveTask?: (taskId: string) => Promise<boolean>;
  onDeleteTask?: (taskId: string) => Promise<boolean>;
  onManageLabels?: (taskId: string) => void;
  onManageAssignees?: (taskId: string) => void;
  onManageDueDate?: (taskId: string) => void;
  onOpenCard?: (taskId: string) => void; // Add callback for opening card modal
}

export function TaskCard({
  task,
  labelColors,
  columnId,
  isDragTarget = false,
  isBeingDragged = false,
  onEditTask,
  onCopyTask,
  onArchiveTask,
  onDeleteTask,
  onManageLabels,
  onManageAssignees,
  onManageDueDate,
  onOpenCard,
}: TaskCardProps) {
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1 && diffDays <= 7) return `${diffDays} days`;
    if (diffDays < -1 && diffDays >= -7)
      return `${Math.abs(diffDays)} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
      columnId, // Include the column ID in the data
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Don't make fully transparent when dragging, instead just reduce opacity
    // This will act as a placeholder in the original position
    opacity: isDragging ? 0.15 : 1, // Reduced opacity further during dragging
    zIndex: isDragging ? 10 : 'auto', // Ensure dragging card is on top
    // Don't apply transforms to the original card when being dragged
    // This prevents the dragged card from appearing in the original position
    pointerEvents: isDragging ? 'none' : 'auto',
  };

  // Helper to get label colors based on the map
  const getLabelClass = (colorKey: string) => {
    return labelColors[colorKey] || 'bg-muted text-muted-foreground'; // Default fallback
  };

  // Check if any action handlers are provided to show the menu
  const hasActions =
    onEditTask ||
    onCopyTask ||
    onArchiveTask ||
    onDeleteTask ||
    onManageLabels ||
    onManageAssignees ||
    onManageDueDate;

  // Don't render card content in original position when dragging
  const cardContent = isDragging ? (
    // Just render an empty placeholder when dragging
    <div className='w-full h-full border-dashed border-2 border-primary/30 rounded-lg bg-primary/5 min-h-[80px]' />
  ) : (
    <>
      {/* Header with Labels and Actions */}
      <div className='flex justify-between items-start mb-2'>
        <div className='flex-1'>
          {/* Labels */}
          {task.labels && task.labels.length > 0 && (
            <div className='flex flex-wrap gap-1.5 mb-2 overflow-hidden'>
              {task.labels.map((label, index) => (
                <span
                  key={index}
                  className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getLabelClass(
                    label.color
                  )} whitespace-nowrap`}
                >
                  {label.text}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Three-dot menu - Only show if there are actions */}
        {hasActions && (
          <div onClick={(e) => e.stopPropagation()}>
            <TaskActionsMenu
              task={task}
              onEditTask={onEditTask}
              onCopyTask={onCopyTask}
              onArchiveTask={onArchiveTask}
              onDeleteTask={onDeleteTask}
              onManageLabels={onManageLabels}
              onManageAssignees={onManageAssignees}
              onManageDueDate={onManageDueDate}
            />
          </div>
        )}
      </div>

      {/* Title */}
      <p className='text-sm font-medium text-foreground mb-3 leading-snug break-words'>
        {task.title}
      </p>

      {/* Dates Section */}
      {(task.start_date || task.due_date) && (
        <div className='mb-3 space-y-1.5'>
          {/* Start Date */}
          {task.start_date && (
            <div className='flex items-center gap-1.5 text-xs'>
              <div className='w-3 h-3 bg-green-100 text-green-600 rounded flex items-center justify-center dark:bg-green-900/40 dark:text-green-400'>
                <div className='w-1.5 h-1.5 bg-current rounded-full'></div>
              </div>
              <span className='text-green-700 dark:text-green-400 font-medium'>
                Start: {formatDate(task.start_date)}
              </span>
            </div>
          )}

          {/* Due Date */}
          {task.due_date && (
            <div
              className={`flex items-center gap-1.5 text-xs ${
                task.due_status === 'complete'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : task.due_status === 'overdue'
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              <div
                className={`w-3 h-3 rounded flex items-center justify-center ${
                  task.due_status === 'complete'
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
                    : task.due_status === 'overdue'
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
                }`}
              >
                <Clock className='w-2 h-2' />
              </div>
              <span className='font-medium'>
                Due: {formatDate(task.due_date)}
                {task.due_status && task.due_status !== 'complete' && (
                  <span className='ml-1 capitalize'>
                    ({task.due_status.replace('_', ' ')})
                  </span>
                )}
              </span>
              {task.due_status === 'complete' && (
                <div className='w-3 h-3 bg-emerald-500 text-white rounded-full flex items-center justify-center ml-auto'>
                  <CheckSquare className='w-2 h-2' />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer: Assignees & Stats */}
      <div className='flex justify-between items-center mt-auto'>
        <div className='flex -space-x-2'>
          {task.assignees?.map((assignee, index) => (
            <div
              key={index}
              className={`w-6 h-6 rounded-full ${assignee.color} flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-black/40`}
              title={assignee.initials} // Add tooltip later if needed
            >
              {assignee.initials}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open modal if dragging or if clicking edit button
    if (isDragging || e.defaultPrevented) return;

    if (onOpenCard) {
      onOpenCard(task.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={`group p-3 rounded-lg backdrop-blur-sm border shadow-lg shadow-black/10 cursor-pointer min-h-[80px] h-auto mb-6 last:mb-0
        transition-all duration-300 ease-out transform
        ${!isDragging ? 'hover:-translate-y-1' : ''}
        ${
          isDragTarget
            ? 'border-primary/70 border-2 bg-primary/5'
            : 'border-white/10 hover:border-white/20 hover:bg-white/10'
        }
        ${isBeingDragged && !isDragging ? 'opacity-50' : ''}
        ${
          isDragging
            ? 'border-dashed border-primary/30 bg-primary/5'
            : 'bg-white/5'
        }
      `}
    >
      {cardContent}
    </div>
  );
}
