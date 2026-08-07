'use client';

import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Clock,
  CheckSquare,
  ArrowUp,
  Bug,
  MessageSquare,
  Paperclip,
  Calendar,
} from 'lucide-react';
import { TaskActionsMenu } from './TaskActionsMenu';
import { getRelativeDateTime } from '@/utils/dateTime';
import { useMobile } from '@/hooks/useMobile';
import { colorForNumber } from '@/utils/idColor';

// Define Task type matching page.tsx
interface Task {
  id: string;
  title: string;
  // Shareable display number, scoped per board — see the migration in
  // supabase/supabase/migrations/20260807120000_add_scoped_display_numbers.sql.
  number?: number;
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
  columnId: string; // Add columnId prop to identify container
  // The board's own display number — see the matching comment on
  // ColumnContainerProps.boardNumber for why this is needed to make the
  // card's own badge unambiguous.
  boardNumber?: number;
  isBeingDragged?: boolean; // Whether this task is being dragged
  onDeleteTask?: (taskId: string) => Promise<boolean>;
  onMoveTask?: (taskId: string) => void;
  onOpenCard?: (taskId: string) => void; // Add callback for opening card modal
  // Quick-edit — title is editable in place here; dates/assignee open a
  // small focused popover (rendered by the board page) rather than the
  // full CardModal.
  onUpdateCardTitle?: (cardId: string, title: string) => Promise<boolean>;
  onEditDates?: (cardId: string) => void;
  onEditAssignee?: (cardId: string) => void;
}

export function TaskCard({
  task,
  columnId,
  boardNumber,
  isBeingDragged = false,
  onDeleteTask,
  onMoveTask,
  onOpenCard,
  onUpdateCardTitle,
  onEditDates,
  onEditAssignee,
}: TaskCardProps) {
  const { isMobile } = useMobile();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);

  const commitTitle = () => {
    const trimmed = titleDraft.trim();
    setIsEditingTitle(false);
    if (!trimmed || trimmed === task.title) {
      setTitleDraft(task.title);
      return;
    }
    onUpdateCardTitle?.(task.id, trimmed);
  };

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
    transition: isDragging ? 'none' : transition, // Disable transitions during drag
    // Don't make fully transparent when dragging, instead just reduce opacity
    // This will act as a placeholder in the original position
    opacity: isDragging ? 0.15 : 1, // Reduced opacity further during dragging
    zIndex: isDragging ? 10 : 'auto', // Ensure dragging card is on top
    // Don't apply transforms to the original card when being dragged
    // This prevents the dragged card from appearing in the original position
    pointerEvents: (isDragging ? 'none' : 'auto') as 'none' | 'auto',
  };

  // Label colors come from the database as hex and are rendered as-is
  // (DESIGN.md: "Real Label Color Rule"). This map only covers legacy
  // labels stored as Tailwind class names before colors were hex-based.
  const getLabelStyle = (colorKey: string) => {
    if (colorKey.startsWith('#')) {
      return { backgroundColor: colorKey };
    }

    const legacyClassColorMap: Record<string, string> = {
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
    };

    return {
      backgroundColor: legacyClassColorMap[colorKey] || 'hsl(240 6% 20%)',
    };
  };

  // Check if any action handlers are provided to show the menu
  const hasActions = onMoveTask || onDeleteTask;

  // Don't render card content in original position when dragging
  const cardContent = isDragging ? (
    // Just render an empty placeholder when dragging
    <div className='w-full h-full border-dashed border-2 border-primary/30 rounded-lg bg-primary/5 min-h-[80px]' />
  ) : (
    <>
      {/* Labels as elegant color bars at the top */}
      {task.labels && task.labels.length > 0 && (
        <div className='flex gap-1 mb-3'>
          {task.labels.map((label, index) => (
            <div
              key={`${label.color}-${index}`} // More stable key for transitions
              className='h-1.5 flex-1 rounded-full transition-all duration-300 ease-out hover:h-2 hover:shadow-sm'
              style={{
                ...getLabelStyle(label.color),
                animationDelay: `${index * 50}ms`,
              }}
              title={label.text || 'Label'} // Show label text on hover
            />
          ))}
        </div>
      )}

      {/* Header with Actions */}
      <div className='flex justify-between items-start mb-2'>
        <div className='flex-1'>
          {task.number != null && (
            <span
              className='inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground'
              title='Card id'
            >
              <span
                className='w-1.5 h-1.5 rounded-full flex-shrink-0'
                style={{ backgroundColor: colorForNumber(task.number) }}
              />
              #{boardNumber ?? '?'}-{task.number}
            </span>
          )}
        </div>
        {/* Three-dot menu - Only show if there are actions */}
        {hasActions && (
          <div onClick={(e) => e.stopPropagation()}>
            <TaskActionsMenu
              task={task}
              onMoveTask={onMoveTask}
              onDeleteTask={onDeleteTask}
            />
          </div>
        )}
      </div>

      {/* Title */}
      {isEditingTitle ? (
        <input
          type='text'
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitTitle();
            } else if (e.key === 'Escape') {
              setTitleDraft(task.title);
              setIsEditingTitle(false);
            }
          }}
          autoFocus
          className='w-full text-sm font-medium mb-3 bg-background border border-primary rounded px-1.5 py-1 text-foreground focus:outline-none'
        />
      ) : (
        <p
          onPointerDown={(e) => {
            if (onUpdateCardTitle) e.stopPropagation();
          }}
          onClick={(e) => {
            if (!onUpdateCardTitle) return;
            e.stopPropagation();
            e.preventDefault();
            setTitleDraft(task.title);
            setIsEditingTitle(true);
          }}
          className={`inline-block w-fit max-w-full text-sm font-medium text-foreground mb-3 leading-snug break-words ${
            onUpdateCardTitle ? 'hover:bg-muted/40 rounded px-1 -mx-1' : ''
          }`}
        >
          {task.title}
        </p>
      )}

      {/* Compact Dates Section — once a date exists. (When there's no date
          yet, the add-date trigger lives in the footer row instead, right
          next to the add-assignee "+" — see below — rather than as its own
          block up here, which was costing a full extra row of vertical
          space just for one small icon.) */}
      {(task.start_date || task.due_date) && (
        <div
          onPointerDown={(e) => {
            if (onEditDates) e.stopPropagation();
          }}
          onClick={(e) => {
            if (!onEditDates) return;
            e.stopPropagation();
            e.preventDefault();
            onEditDates(task.id);
          }}
          title={onEditDates ? 'Edit dates' : undefined}
          className={`mb-3 space-y-1 ${
            onEditDates ? 'hover:bg-muted/40 rounded px-1 -mx-1 py-0.5' : ''
          }`}
        >
          {/* Start Date */}
          {task.start_date && (
            <div className='flex items-center gap-1.5 text-xs text-success'>
              <div className='w-2 h-2 bg-success rounded-full' />
              <span className='font-medium'>{formatDate(task.start_date)}</span>
            </div>
          )}

          {/* Due Date */}
          {task.due_date && (
            <div
              className={`flex items-center gap-1.5 text-xs font-medium ${
                task.due_status === 'complete'
                  ? 'text-success'
                  : task.due_status === 'overdue'
                  ? 'text-destructive'
                  : 'text-amber-500'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  task.due_status === 'complete'
                    ? 'bg-success'
                    : task.due_status === 'overdue'
                    ? 'bg-destructive'
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

      {/* Footer: add-due-date + Assignees, side by side — both are small
          "add something" triggers, so they share one row instead of the
          date one eating a whole row by itself above. */}
      <div className='flex justify-between items-center mt-auto gap-2'>
        <div className='flex items-center gap-1.5'>
          {onEditDates && !task.start_date && !task.due_date && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onEditDates(task.id);
              }}
              title='Add due date'
              className='w-6 h-6 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors flex-shrink-0'
            >
              <Calendar className='w-3 h-3' />
            </button>
          )}

          <div
            onPointerDown={(e) => {
              if (onEditAssignee) e.stopPropagation();
            }}
            onClick={(e) => {
              if (!onEditAssignee) return;
              e.stopPropagation();
              e.preventDefault();
              onEditAssignee(task.id);
            }}
            title={onEditAssignee ? 'Edit assignees' : undefined}
            className={`flex -space-x-2 ${
              onEditAssignee ? 'hover:opacity-80 rounded' : ''
            }`}
          >
          {onEditAssignee &&
            (!task.assignees || task.assignees.length === 0) && (
              <div className='w-6 h-6 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground text-xs'>
                +
              </div>
            )}
          {task.assignees?.map((assignee, index) => (
            <div
              key={`${assignee.full_name}-${index}`} // More stable key for transitions
              className={`w-6 h-6 rounded-full ${
                assignee.avatar_url ? 'bg-gray-200' : assignee.color
              } flex items-center justify-center text-white text-xs font-bold ring-2 ring-white/20 overflow-hidden
              transition-all duration-300 ease-out ${
                !isMobile
                  ? 'hover:scale-110 hover:ring-4 hover:ring-primary/20 hover:shadow-lg'
                  : ''
              }`}
              style={{
                animationDelay: `${index * 75}ms`,
                zIndex: task.assignees.length - index, // Ensure proper stacking
              }}
              title={assignee.full_name || assignee.initials}
            >
              {assignee.avatar_url ? (
                <img
                  src={assignee.avatar_url}
                  alt={assignee.full_name || assignee.initials}
                  className='w-full h-full object-cover transition-transform duration-200 hover:scale-105'
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
                <span className='select-none font-semibold'>
                  {assignee.initials}
                </span>
              )}
            </div>
          ))}
          </div>
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
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={handleCardClick}
        className={`group bg-card/75 backdrop-blur-xl p-3 rounded-md border cursor-pointer min-h-[80px] h-auto mb-3 last:mb-0
          ${isDragging ? '' : 'transition-colors duration-200'}
          ${!isDragging && !isMobile ? 'hover:-translate-y-0.5 transition-transform' : ''}
          border-border hover:border-muted-foreground/40
          ${isBeingDragged && !isDragging ? 'opacity-50' : ''}
          ${isDragging ? 'border-dashed border-primary/30 bg-primary/5' : ''}
        `}
      >
        {cardContent}
      </div>

      {/* CSS for smooth label and member animations */}
      <style jsx>{`
        @keyframes labelSlideIn {
          from {
            opacity: 0;
            transform: scaleX(0);
          }
          to {
            opacity: 1;
            transform: scaleX(1);
          }
        }

        @keyframes memberPopIn {
          from {
            opacity: 0;
            transform: scale(0) rotate(180deg);
          }
          50% {
            transform: scale(1.2) rotate(90deg);
          }
          to {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }

        .flex > div[title]:not(img) {
          animation: labelSlideIn 0.4s ease-out forwards;
          transform-origin: left center;
        }

        /* Target member avatars specifically */
        .flex.-space-x-2 > div {
          animation: memberPopIn 0.5s ease-out forwards;
        }
      `}</style>
    </>
  );
}
