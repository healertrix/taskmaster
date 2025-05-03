import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { SortableTask } from './sortable-task';
import type { Column as ColumnType, Task } from './types';

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  onAddTask?: (columnId: string) => void;
}

// Define column colors (can be expanded)
const columnColors = {
  todo: 'bg-secondary/20 border-secondary/50', // Electric Blue accent
  'in-progress': 'bg-accent/20 border-accent/50', // Gold accent
  review: 'bg-violet-500/20 border-violet-500/50', // Violet accent (example)
  done: 'bg-emerald-500/20 border-emerald-500/50' // Green accent (example)
};

export function Column({ column, tasks, onAddTask }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const columnStyle = columnColors[column.id] || 'bg-muted/20 border-muted/50'; // Default style

  return (
    <div
      className={`flex flex-col w-[360px] max-h-[calc(100vh-210px)] rounded-xl flex-shrink-0 bg-card/50 backdrop-blur-md border ${
        isOver ? 'border-primary' : 'border-transparent'
      } transition-colors duration-200 shadow-lg`}
    >
      {/* Column Header - Fixed */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${columnStyle} rounded-t-xl`}
      >
        <div className='flex items-center gap-2.5'>
          {/* Color dot can be derived from columnStyle or a specific color prop */}
          {/* <div className={`w-2.5 h-2.5 rounded-full ${columnStyle.split(' ')[0].replace('/20', '/80')}`}></div> */}
          <h3 className='text-sm font-semibold text-foreground'>
            {column.title}
          </h3>
          <span className='flex h-5 min-w-[22px] items-center justify-center rounded-full bg-primary/80 px-1.5 text-xs font-bold text-primary-foreground shadow-sm'>
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Tasks Container - Scrollable */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-3 pb-0 space-y-3 transition-colors duration-200 ${
          isOver ? 'bg-primary/5' : ''
        }`}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTask key={task.id} task={task} />
          ))}
        </SortableContext>

        {/* Empty State - More prominent */}
        {tasks.length === 0 && (
          <div
            className={`flex h-24 items-center justify-center rounded-lg border-2 border-dashed ${
              isOver ? 'border-primary' : 'border-border/40'
            } ${
              isOver ? 'bg-primary/10' : 'bg-muted/10'
            } transition-all duration-200`}
          >
            <p
              className={`text-sm font-medium ${
                isOver ? 'text-primary' : 'text-muted-foreground/70'
              }`}
            >
              Drop tasks here
            </p>
          </div>
        )}
      </div>

      {/* Add Task Button - Fixed at bottom */}
      <div className='p-3 pt-2 border-t border-border/30 mt-auto'>
        <button
          onClick={() => onAddTask?.(column.id)}
          className='w-full px-3 py-2 text-sm text-muted-foreground hover:text-primary bg-muted/20 hover:bg-primary/5 rounded-lg border border-dashed border-border/50 hover:border-primary/50 transition-colors flex items-center justify-center'
          aria-label={`Add task to ${column.title}`}
        >
          <Plus className='w-4 h-4 mr-1.5' />
          Add task
        </button>
      </div>
    </div>
  );
}
