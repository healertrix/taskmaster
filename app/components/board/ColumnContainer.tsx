'use client';

import React, { useRef } from 'react';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus, CheckCircle2 } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { ListNameEditor } from './ListNameEditor';
import { ListActionsMenu } from './ListActionsMenu';
import { AddCardForm } from './AddCardForm';

// Define Task type matching page.tsx
interface Task {
  id: string;
  title: string;
  // Shareable display number, scoped per board — see the migration in
  // supabase/supabase/migrations/20260807120000_add_scoped_display_numbers.sql.
  number?: number;
  labels?: { color: string; text: string }[];
  assignees?: { initials: string; color: string }[];
  attachments?: number;
  comments?: number;
}

interface Column {
  id: string;
  title: string;
  // Shareable display number, scoped per board — see Task.number above.
  number?: number;
  // Whether this list counts toward "completed" in My Tasks — see
  // supabase/supabase/migrations/20260808150000_add_list_is_done.sql.
  is_done_list?: boolean;
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
  getColumnStyle: (columnId: string, number?: number) => string;
  // The board's own display number — lists/cards are numbered per-board
  // (see utils/idColor.ts), so their bare number alone isn't unique across
  // boards or even, confusingly, across a list vs. a card in the SAME
  // board (list #1 and card #1 can coexist). Prefixing with the board
  // number gives every badge a globally unambiguous shareable id.
  boardNumber?: number;
  dragOverInfo: DragOverInfo;
  activeTaskId?: string;
  onUpdateListName?: (listId: string, newName: string) => Promise<boolean>;
  onArchiveList?: (listId: string) => Promise<boolean>;
  onDeleteList?: (listId: string) => Promise<boolean>;
  onToggleDoneList?: (listId: string, isDone: boolean) => Promise<boolean>;
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
  boardNumber,
  dragOverInfo,
  activeTaskId,
  onUpdateListName,
  onArchiveList,
  onDeleteList,
  onToggleDoneList,
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
      // max-h-full (not h-full) + the row's items-start (see
      // app/board/[id]/page.tsx) — a column is only as tall as its own
      // content (header + cards + add-card form), capped at whatever
      // height is actually available, not forced to match the tallest
      // column. Matches Trello: short/empty lists stay short; only a
      // genuinely long list scrolls internally once it hits the cap.
      className='flex flex-col w-80 flex-shrink-0 mr-5 kanban-column rounded-2xl overflow-hidden max-h-full'
    >
      <div className='flex-shrink-0 p-4 rounded-t-2xl kanban-column-header flex justify-between items-center relative z-10'>
        <div className='flex items-center gap-2 flex-1 min-w-0'>
          <span
            className='w-2 h-2 rounded-full flex-shrink-0'
            style={{ backgroundColor: getColumnStyle(column.id, column.number) }}
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
          {column.number != null && (
            <span
              className='text-xs text-muted-foreground flex-shrink-0'
              title='List id'
            >
              #{boardNumber ?? '?'}.{column.number}
            </span>
          )}
          {column.is_done_list && (
            <span title='Cards here count as completed'>
              <CheckCircle2 className='w-3.5 h-3.5 text-success flex-shrink-0' />
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
          onDeleteList={onDeleteList || (() => Promise.resolve(false))}
          isDoneList={column.is_done_list}
          onToggleDoneList={onToggleDoneList}
        />
      </div>
      {/* Make the content area scrollable — flex-1 min-h-0 so it fills
          whatever's left below the header within the column's own
          max-h-full, rather than a hardcoded max-height. Extra bottom
          padding (pb-6 vs p-4 everywhere else) so the last card gets some
          breathing room above the add-card form instead of sitting flush
          against it. */}
      <div className='flex-1 min-h-0 overflow-y-auto p-4 pb-6 kanban-column-content rounded-b-2xl'>
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
                    boardNumber={boardNumber}
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
