'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Paperclip,
  MessageSquare,
  Clock,
  CheckSquare,
  ArrowUp,
  Bug,
} from 'lucide-react';

// Define Task type matching page.tsx
interface Task {
  id: string;
  title: string;
  labels?: { color: string; text: string }[];
  assignees?: { initials: string; color: string }[];
  attachments?: number;
  comments?: number;
}

interface TaskCardProps {
  task: Task;
  labelColors: Record<string, string>; // Pass the color map
  columnId: string; // Add columnId prop to identify container
  isDragTarget?: boolean; // Whether this task is currently being dragged over
  isBeingDragged?: boolean; // Whether this task is being dragged
}

export function TaskCard({
  task,
  labelColors,
  columnId,
  isDragTarget = false,
  isBeingDragged = false,
}: TaskCardProps) {
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

  // Don't render card content in original position when dragging
  const cardContent = isDragging ? (
    // Just render an empty placeholder when dragging
    <div className="w-full h-full border-dashed border-2 border-primary/30 rounded-lg bg-primary/5 min-h-[80px]" />
  ) : (
    <>
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

      {/* Title */}
      <p className='text-sm font-medium text-white mb-3 leading-snug break-words'>
        {task.title}
      </p>

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

        <div className='flex items-center gap-2.5 text-white/60 text-xs'>
          {task.attachments && (
            <span className='flex items-center gap-0.5'>
              <Paperclip className='w-3.5 h-3.5' />
              {task.attachments}
            </span>
          )}
          {task.comments && (
            <span className='flex items-center gap-0.5'>
              <MessageSquare className='w-3.5 h-3.5' />
              {task.comments}
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 rounded-lg backdrop-blur-sm border shadow-lg shadow-black/10 cursor-grab active:cursor-grabbing min-h-[80px] h-auto mb-6 last:mb-0
        transition-all duration-300 ease-out transform
        ${!isDragging ? 'hover:-translate-y-1' : ''}
        ${
          isDragTarget
            ? 'border-primary/70 border-2 bg-primary/5'
            : 'border-white/10 hover:border-white/20 hover:bg-white/10'
        }
        ${isBeingDragged && !isDragging ? 'opacity-50' : ''}
        ${isDragging ? 'border-dashed border-primary/30 bg-primary/5' : 'bg-white/5'}
      `}
    >
      {cardContent}
    </div>
  );
}
