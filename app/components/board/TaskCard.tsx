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
}

export function TaskCard({ task, labelColors, columnId }: TaskCardProps) {
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
    opacity: isDragging ? 0.5 : 1, // Make card semi-transparent when dragging
    zIndex: isDragging ? 10 : 'auto', // Ensure dragging card is on top
  };

  // Helper to get label colors based on the map
  const getLabelClass = (colorKey: string) => {
    return labelColors[colorKey] || 'bg-muted text-muted-foreground'; // Default fallback
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className='p-3 rounded-lg card card-hover cursor-grab active:cursor-grabbing shadow-sm' // Added cursor styles
    >
      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className='flex flex-wrap gap-1.5 mb-2'>
          {task.labels.map((label, index) => (
            <span
              key={index}
              className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${getLabelClass(
                label.color
              )}`}
            >
              {label.text}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <p className='text-sm font-medium text-foreground mb-3 leading-snug'>
        {task.title}
      </p>

      {/* Footer: Assignees & Stats */}
      <div className='flex justify-between items-center'>
        <div className='flex -space-x-2'>
          {task.assignees?.map((assignee, index) => (
            <div
              key={index}
              className={`w-6 h-6 rounded-full ${assignee.color} flex items-center justify-center text-white text-[10px] font-bold ring-2 ring-card`}
              title={assignee.initials} // Add tooltip later if needed
            >
              {assignee.initials}
            </div>
          ))}
        </div>

        <div className='flex items-center gap-2.5 text-muted-foreground text-xs'>
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
          {/* Add other potential icons/stats here */}
        </div>
      </div>
    </div>
  );
}
