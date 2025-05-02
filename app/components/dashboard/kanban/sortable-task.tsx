import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  MoreHorizontal,
  MessageSquare,
  Paperclip,
  CheckSquare,
  Bug,
  Sparkles,
  ArrowUp,
  UserCircle,
  Clock,
} from 'lucide-react';
import type { Task, TaskType } from './types';

interface SortableTaskProps {
  task: Task;
}

// Helper to map task type to colors
const typeColors = {
  bug: 'text-red-400 bg-red-500/10',
  feature: 'text-violet-400 bg-violet-500/10',
  improvement: 'text-blue-400 bg-blue-500/10',
  task: 'text-emerald-400 bg-emerald-500/10',
};

const TaskTypeIcon = ({ type }: { type: TaskType }) => {
  const colorClass = typeColors[type] || typeColors.task; // Fallback to task color
  const Icon =
    type === 'bug'
      ? Bug
      : type === 'feature'
      ? Sparkles
      : type === 'improvement'
      ? ArrowUp
      : CheckSquare;

  return (
    <div
      className={`w-7 h-7 rounded-lg ${colorClass} flex items-center justify-center flex-shrink-0`}
    >
      <Icon className='w-4 h-4' />
    </div>
  );
};

export function SortableTask({ task }: SortableTaskProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1, // Slightly more transparent when dragging
    boxShadow: isDragging
      ? '0 10px 25px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.2)'
      : 'none',
    zIndex: isDragging ? 10 : 'auto',
  };

  const typeColorClass = typeColors[task.type] || typeColors.task;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className='bg-card p-4 rounded-lg shadow-md cursor-grab active:cursor-grabbing task-card-hover relative overflow-hidden'
    >
      {/* Subtle colored border accent */}
      <div
        className={`absolute top-0 left-0 bottom-0 w-1 ${typeColorClass
          .split(' ')[1]
          .replace('bg-', 'bg-')
          .replace('/10', '/30')}`}
      ></div>

      <div className='pl-3'>
        {' '}
        {/* Add padding to account for border */}
        <div className='flex items-start gap-3 mb-3'>
          <TaskTypeIcon type={task.type} />
          <div className='flex-1 min-w-0'>
            <h4 className='text-sm font-semibold text-foreground truncate'>
              {task.title}
            </h4>
            {task.description && (
              <p className='text-xs text-muted-foreground mt-1 line-clamp-2'>
                {task.description}
              </p>
            )}
          </div>
          <button
            className='p-1 text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 rounded-md transition-colors'
            aria-label={`More options for task: ${task.title}`}
            onClick={(e) => {
              e.stopPropagation(); /* Prevent drag start */
            }}
          >
            <MoreHorizontal className='w-4 h-4' />
          </button>
        </div>
        <div className='space-y-3.5'>
          {task.progress > 0 && (
            <div className='space-y-1.5'>
              <div className='flex items-center justify-between text-xs'>
                <span className='text-muted-foreground'>Progress</span>
                <span className='text-foreground font-medium'>
                  {task.progress}%
                </span>
              </div>
              <div className='progress-bar'>
                <div
                  className='progress-bar-fill'
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            </div>
          )}

          {task.subtasks && task.subtasks.total > 0 && (
            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <div className='w-5 h-5 rounded bg-muted/50 flex items-center justify-center'>
                <CheckSquare className='w-3 h-3 text-secondary' />
              </div>
              <span className='font-medium text-foreground'>
                {task.subtasks.completed}/{task.subtasks.total}
              </span>
              Subtasks
            </div>
          )}

          {task.dueDate && (
            <div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
              <div className='w-5 h-5 rounded bg-muted/50 flex items-center justify-center'>
                <Clock className='w-3 h-3 text-accent' />
              </div>
              Due:{' '}
              <span className='font-medium text-foreground'>
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            </div>
          )}

          {/* Footer section */}
          <div className='flex items-center justify-between pt-1 border-t border-border/50 mt-3'>
            <div className='flex items-center gap-2'>
              {/* Assignee Avatar */}
              {task.assignee.avatar ? (
                <img
                  src={task.assignee.avatar}
                  alt={task.assignee.name}
                  title={task.assignee.name}
                  className='w-6 h-6 rounded-full ring-2 ring-background'
                />
              ) : (
                <div
                  className='w-6 h-6 rounded-full bg-muted flex items-center justify-center ring-2 ring-background'
                  title='Unassigned'
                >
                  <UserCircle className='w-4 h-4 text-muted-foreground' />
                </div>
              )}

              {/* Labels */}
              {task.labels && task.labels.length > 0 && (
                <div className='flex gap-1'>
                  {task.labels.slice(0, 2).map(
                    (
                      label // Show max 2 labels
                    ) => (
                      <span
                        key={label}
                        className='px-2 py-0.5 bg-muted/50 rounded text-2xs text-muted-foreground font-medium'
                      >
                        {label}
                      </span>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Comments & Attachments */}
            <div className='flex items-center gap-3 text-muted-foreground'>
              {task.comments > 0 && (
                <div
                  className='flex items-center gap-1 text-xs'
                  title={`${task.comments} comments`}
                >
                  <MessageSquare className='w-3.5 h-3.5' />
                  <span className='font-medium'>{task.comments}</span>
                </div>
              )}
              {task.attachments > 0 && (
                <div
                  className='flex items-center gap-1 text-xs'
                  title={`${task.attachments} attachments`}
                >
                  <Paperclip className='w-3.5 h-3.5' />
                  <span className='font-medium'>{task.attachments}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
