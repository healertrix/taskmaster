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
} from 'lucide-react';
import type { Task, TaskType } from './types';

interface SortableTaskProps {
  task: Task;
}

const TaskTypeIcon = ({ type }: { type: TaskType }) => {
  switch (type) {
    case 'bug':
      return <Bug className="w-4 h-4 text-red-500" />;
    case 'feature':
      return <Sparkles className="w-4 h-4 text-violet-500" />;
    case 'improvement':
      return <ArrowUp className="w-4 h-4 text-blue-500" />;
    default:
      return <CheckSquare className="w-4 h-4 text-emerald-500" />;
  }
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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-4 rounded-xl shadow-[0_2px_4px_rgba(0,0,0,0.04)] cursor-grab active:cursor-grabbing task-card-hover"
    >
      <div className="flex items-start gap-3 mb-3">
        <TaskTypeIcon type={task.type} />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">
            {task.title}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
            {task.description}
          </p>
        </div>
        <button
          className="p-1 hover:bg-gray-50 rounded-lg transition-colors"
          aria-label={`More options for task: ${task.title}`}
        >
          <MoreHorizontal className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="space-y-3">
        {task.progress > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Progress</span>
              <span className="text-gray-700">{task.progress}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
        )}

        {task.subtasks.total > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <CheckSquare className="w-4 h-4" />
            <span>
              {task.subtasks.completed}/{task.subtasks.total}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={task.assignee.avatar}
              alt={task.assignee.name}
              className="w-6 h-6 rounded-full ring-2 ring-white"
            />
            {task.labels.length > 0 && (
              <div className="flex gap-1">
                {task.labels.map((label) => (
                  <span
                    key={label}
                    className="px-1.5 py-0.5 bg-gray-50 rounded-md text-xs text-gray-600 font-medium"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-gray-400">
            {task.comments > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <MessageSquare className="w-4 h-4" />
                <span>{task.comments}</span>
              </div>
            )}
            {task.attachments > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <Paperclip className="w-4 h-4" />
                <span>{task.attachments}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
