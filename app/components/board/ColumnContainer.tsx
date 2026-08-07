'use client';

import React, { useRef } from 'react';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { ListNameEditor } from './ListNameEditor';
import { ListActionsMenu } from './ListActionsMenu';
import { AddCardForm } from './AddCardForm';

// Define Task type matching page.tsx
interface Task {
  id: string;
  title: string;
  labels?: { color: string; text: string }[];
  assignees?: { initials: string; color: string }[];
  attachments?: number;
  comments?: number;
}

interface Column {
  id: string;
  title: string;
  cards: Task[];
}

// Interface for the drag over info
interface DragOverInfo {
  id: string | null;
  type: 'task' | 'column' | null;
  index: number | null;
  columnId: string | null;
}

interface ColumnContainerProps {
  column: Column;
  tasks: Task[];
  getColumnStyle: (columnId: string) => string;
  dragOverInfo: DragOverInfo;
  activeTaskId?: string;
  onUpdateListName?: (listId: string, newName: string) => Promise<boolean>;
  onArchiveList?: (listId: string) => Promise<boolean>;
  onDeleteList?: (listId: string) => Promise<boolean>;
  onAddCard?: (columnId: string, cardTitle: string) => Promise<boolean>;
  onDeleteTask?: (taskId: string) => Promise<boolean>;
  onMoveTask?: (taskId: string) => void;
  onOpenCard?: (taskId: string) => void;
  onUpdateCardTitle?: (cardId: string, title: string) => Promise<boolean>;
  onEditDates?: (cardId: string) => void;
  onEditAssignee?: (cardId: string) => void;
}

export function ColumnContainer({
  column,
  tasks,
  getColumnStyle,
  dragOverInfo,
  activeTaskId,
  onUpdateListName,
  onArchiveList,
  onDeleteList,
  onAddCard,
  onDeleteTask,
  onMoveTask,
  onOpenCard,
  onUpdateCardTitle,
  onEditDates,
  onEditAssignee,
}: ColumnContainerProps) {
  // Use useDroppable for the column to accept tasks
  const { setNodeRef: setColumnRef } = useDroppable({
    id: column.id,
    data: {
      type: 'Column',
      column,
    },
  });

  // Get task IDs for SortableContext
  const taskIds = React.useMemo(() => tasks.map((task) => task.id), [tasks]);

  // Task ids that have already played their entrance animation. `tasks` is
  // rebuilt into a new array/objects on every board data change (title
  // edits, checklist updates, etc.), not just when a card is actually
  // added — without this, every card would replay its slide-up animation
  // on every unrelated update instead of only when it's genuinely new.
  const animatedTaskIdsRef = useRef<Set<string>>(new Set());

  // Check if this column is the one being dragged over
  const isColumnBeingDraggedOver = dragOverInfo.columnId === column.id;

  // Function to render drop indicators between tasks
  const renderDropIndicator = (index: number) => {
    // Only show indicator if this is the column being dragged over
    // and the index matches where the task would be inserted
    const shouldShow =
      isColumnBeingDraggedOver &&
      dragOverInfo.index === index &&
      dragOverInfo.type === 'task';

    if (!shouldShow) return null;

    return (
      <div className='py-1.5 px-2'>
        <div className='h-0.5 bg-primary rounded-full w-full animate-in fade-in-0 zoom-in-95 duration-100' />
      </div>
    );
  };

  // Show empty column indicator
  const showEmptyColumnIndicator =
    isColumnBeingDraggedOver &&
    (!tasks.length ||
      (dragOverInfo.type === 'column' && dragOverInfo.id === column.id));

  return (
    <div
      ref={setColumnRef}
      className='flex flex-col w-80 flex-shrink-0 mr-5 kanban-column rounded-2xl overflow-hidden max-h-[calc(100vh-180px)]'
    >
      <div className='p-4 rounded-t-2xl kanban-column-header flex justify-between items-center relative z-10'>
        <div className='flex items-center gap-2 flex-1 min-w-0'>
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${getColumnStyle(
              column.id
            )}`}
          />
          {onUpdateListName ? (
            <ListNameEditor
              listName={column.title}
              onSave={(newName) => onUpdateListName(column.id, newName)}
            />
          ) : (
            <span className='text-sm font-semibold text-foreground'>
              {column.title}
            </span>
          )}
          <span className='text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 flex-shrink-0'>
            {tasks.length}
          </span>
        </div>
        <ListActionsMenu
          listId={column.id}
          listName={column.title}
          cardCount={tasks.length}
          onArchiveList={onArchiveList || (() => Promise.resolve(false))}
          onDeleteList={onDeleteList || (() => Promise.resolve(false))}
        />
      </div>
      {/* Make the content area scrollable */}
      <div
        className='flex-1 overflow-y-auto p-4 kanban-column-content rounded-b-2xl'
        style={{ maxHeight: 'calc(100vh - 280px)' }} // Increased height for bigger lists
      >
        <SortableContext items={taskIds}>
          <div className='space-y-2 transition-all duration-300 ease-in-out'>
            {/* Show indicator at the top if dropping at index 0 */}
            {renderDropIndicator(0)}

            {tasks.map((task, index) => {
              const isFirstAppearance = !animatedTaskIdsRef.current.has(
                task.id
              );
              if (isFirstAppearance) {
                animatedTaskIdsRef.current.add(task.id);
              }
              const shouldAnimate =
                isFirstAppearance && task.id !== activeTaskId;

              return (
                <div
                  key={task.id}
                  className={shouldAnimate ? 'animate-slideUp' : ''}
                  style={
                    shouldAnimate
                      ? {
                          animationFillMode: 'both',
                          animationDelay: `${index * 50}ms`,
                        }
                      : undefined
                  }
                >
                  <TaskCard
                    task={task}
                    columnId={column.id}
                    isBeingDragged={task.id === activeTaskId}
                    onDeleteTask={onDeleteTask}
                    onMoveTask={onMoveTask}
                    onOpenCard={onOpenCard}
                    onUpdateCardTitle={onUpdateCardTitle}
                    onEditDates={onEditDates}
                    onEditAssignee={onEditAssignee}
                  />
                  {/* Show drop indicator after each task */}
                  {renderDropIndicator(index + 1)}
                </div>
              );
            })}

            {/* Empty Column Indicator */}
            {tasks.length === 0 && (
              <div
                className={`flex h-28 items-center justify-center rounded-lg border-2 border-dashed transition-colors duration-200 animate-scaleIn ${
                  showEmptyColumnIndicator
                    ? 'border-primary bg-primary/10 animate-pulse'
                    : 'border-border'
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    showEmptyColumnIndicator
                      ? 'text-primary'
                      : 'text-muted-foreground/70'
                  }`}
                >
                  {showEmptyColumnIndicator ? 'Drop here' : 'No tasks'}
                </p>
              </div>
            )}
          </div>
        </SortableContext>
      </div>
      <div className='sticky bottom-0 p-2 bg-background/80 backdrop-blur-sm border-t border-border/20'>
        <AddCardForm
          columnId={column.id}
          onAddCard={onAddCard || (() => Promise.resolve(false))}
        />
      </div>
    </div>
  );
}
