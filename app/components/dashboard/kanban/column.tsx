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
    <div className='flex h-full w-[350px] flex-col rounded-lg bg-card p-4'>
      <div className='mb-4 flex items-center justify-between'>
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
      <div
        ref={setNodeRef}
        className='flex flex-1 flex-col gap-2 overflow-y-auto rounded-md bg-accent/50 p-2'
      >
        <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTask key={task.id} task={task} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className='flex h-full min-h-[100px] items-center justify-center rounded-md border border-dashed border-accent'>
            <p className='text-sm text-muted-foreground'>Drop tasks here</p>
          </div>
        )}
      </div>
    </div>
  );
}
