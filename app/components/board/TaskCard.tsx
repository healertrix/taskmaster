'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Clock,
  CheckSquare,
  ArrowUp,
  Bug,
  MessageSquare,
  Paperclip,
} from 'lucide-react';
import { TaskActionsMenu } from './TaskActionsMenu';
import { getRelativeDateTime } from '@/utils/dateTime';

// Define Task type matching page.tsx
interface Task {
  id: string;
  title: string;
  labels?: { color: string; text: string }[];
  assignees?: {
    initials: string;
    color: string;
    avatar_url?: string;
    full_name?: string;
  }[];
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
    // Check if the date has time (contains T)
    if (dateString.includes('T')) {
      // Import the utility function at the top of the file if not already imported
      return getRelativeDateTime(dateString);
    } else {
      // Fallback for date-only strings
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
    }
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
  const getLabelStyle = (colorKey: string) => {
    // If it's a hex color (starts with #), use it directly
    if (colorKey.startsWith('#')) {
      return { backgroundColor: colorKey };
    }

    // If it's a Tailwind class, convert to hex
    const colorMapping: Record<string, string> = {
      'bg-red-500': '#ef4444',
      'bg-purple-500': '#a855f7',
      'bg-green-500': '#22c55e',
      'bg-blue-500': '#3b82f6',
      'bg-gray-500': '#6b7280',
      'bg-red-600': '#dc2626',
      'bg-blue-600': '#2563eb',
      'bg-green-600': '#16a34a',
      'bg-purple-600': '#9333ea',
      'bg-yellow-600': '#ca8a04',
      'bg-pink-600': '#db2777',
      'bg-indigo-600': '#4f46e5',
      'bg-orange-600': '#ea580c',
      '#61bd4f': '#61bd4f', // Green
      '#f2d600': '#f2d600', // Yellow
      '#ff9f1a': '#ff9f1a', // Orange
      '#eb5a46': '#eb5a46', // Red
      '#c377e0': '#c377e0', // Purple
      '#0079bf': '#0079bf', // Blue
    };

    return { backgroundColor: colorMapping[colorKey] || '#6b7280' }; // Default gray
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
      {/* Labels as color bars at the top */}
      {task.labels && task.labels.length > 0 && (
        <div className='flex gap-0.5 mb-3'>
          {task.labels.map((label, index) => (
            <div
              key={index}
              className='h-1.5 flex-1 rounded-full'
              style={getLabelStyle(label.color)}
              title={label.text} // Show label text on hover
            />
          ))}
        </div>
      )}

      {/* Header with Actions */}
      <div className='flex justify-between items-start mb-2'>
        <div className='flex-1' />
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

      {/* Compact Dates Section */}
      {(task.start_date || task.due_date) && (
        <div className='mb-3 space-y-1'>
          {/* Start Date */}
          {task.start_date && (
            <div className='flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400'>
              <div className='w-2 h-2 bg-green-500 rounded-full' />
              <span className='font-medium'>{formatDate(task.start_date)}</span>
            </div>
          )}

          {/* Due Date */}
          {task.due_date && (
            <div
              className={`flex items-center gap-1.5 text-xs font-medium ${
                task.due_status === 'complete'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : task.due_status === 'overdue'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  task.due_status === 'complete'
                    ? 'bg-emerald-500'
                    : task.due_status === 'overdue'
                    ? 'bg-red-500'
                    : 'bg-amber-500'
                }`}
              />
              <span>
                {formatDate(task.due_date)}
                {task.due_status === 'overdue' && ' (overdue)'}
                {task.due_status === 'due_soon' && ' (due soon)'}
              </span>
              {task.due_status === 'complete' && (
                <CheckSquare className='w-3 h-3 ml-auto' />
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer: Assignees */}
      <div className='flex justify-between items-center mt-auto'>
        <div className='flex -space-x-2'>
          {task.assignees?.map((assignee, index) => (
            <div
              key={index}
              className={`w-6 h-6 rounded-full ${
                assignee.avatar_url ? 'bg-gray-200' : assignee.color
              } flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-white/20 overflow-hidden`}
              title={assignee.full_name || assignee.initials}
            >
              {assignee.avatar_url ? (
                <img
                  src={assignee.avatar_url}
                  alt={assignee.full_name || assignee.initials}
                  className='w-full h-full object-cover'
                  onError={(e) => {
                    // If image fails to load, hide it and show initials
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.className = parent.className.replace(
                        'bg-gray-200',
                        assignee.color
                      );
                      parent.innerHTML = assignee.initials;
                    }
                  }}
                />
              ) : (
                assignee.initials
              )}
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
