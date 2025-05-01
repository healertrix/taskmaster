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

export function Column({ column, tasks, onAddTask }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div className='flex flex-col w-[350px] h-[calc(100%-1rem)] bg-card rounded-lg flex-shrink-0'>
      {/* Column Header - Fixed */}
      <div className='flex items-center justify-between px-3 py-2 border-b border-accent/20'>
        <div className='flex items-center gap-2'>
          <h3 className='text-sm font-medium text-foreground'>
            {column.title}
          </h3>
          <span className='flex h-5 min-w-[20px] items-center justify-center rounded bg-accent px-1.5 text-2xs font-medium text-accent-foreground'>
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask?.(column.id)}
          className='flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent/50'
          aria-label={`Add task to ${column.title}`}
        >
          <Plus className='h-4 w-4 text-muted-foreground' />
        </button>
      </div>

      {/* Tasks Container - Scrollable */}
      <div
        ref={setNodeRef}
        className='flex-1 overflow-y-auto px-3 py-2 space-y-2'
      >
        <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTask key={task.id} task={task} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className='flex h-20 items-center justify-center rounded-md border border-dashed border-accent'>
            <p className='text-sm text-muted-foreground'>Drop tasks here</p>
          </div>
        )}
      </div>
    </div>
  );
}
