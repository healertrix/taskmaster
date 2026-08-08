'use client';

import React, { useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronRight,
  Check,
  GripVertical,
  MessageSquare,
  Paperclip,
  CheckCircle2,
} from 'lucide-react';
import { AddCardForm } from './AddCardForm';
import { ListActionsMenu } from './ListActionsMenu';
import { TaskActionsMenu } from './TaskActionsMenu';
import { ListNameEditor } from './ListNameEditor';
import { colorForNumber } from '@/utils/idColor';

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
  start_date?: string;
  due_date?: string;
  due_status?: 'due_soon' | 'overdue' | 'complete' | null;
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

interface ListViewProps {
  columns: Column[];
  // The board's own display number — lists/cards are numbered per-board,
  // so a bare local number alone can collide between a list and a card in
  // the SAME board (list #1 and card #1 can coexist). Prefixing every
  // badge with the board number gives it an unambiguous shareable id.
  boardNumber?: number;
  onOpenCard: (cardId: string) => void;
  onAddCard: (columnId: string, cardTitle: string) => Promise<boolean>;
  onDeleteList?: (listId: string) => Promise<boolean>;
  onUpdateListName?: (listId: string, newName: string) => Promise<boolean>;
  onToggleDoneList?: (listId: string, isDone: boolean) => Promise<boolean>;
  onMoveTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => Promise<boolean>;
  // (sourceListId/targetListId can be the same list — a same-section
  // reorder — or different — moving the card to another section.)
  onMoveCard?: (
    cardId: string,
    sourceListId: string,
    targetListId: string,
    newIndex: number
  ) => void;
  // Quick-edit — title is editable in place here; dates/assignee open a
  // small focused popover (rendered by the board page, which has the
  // board/workspace context those need) rather than the full CardModal.
  onUpdateCardTitle?: (cardId: string, title: string) => Promise<boolean>;
  onEditDates?: (cardId: string) => void;
  onEditAssignee?: (cardId: string) => void;
}

// A small burst of particles that fan out evenly from the checkbox on
// completion. Colors cycle through the app's existing accent tokens
// (nothing off-palette), positions are deterministic (evenly spaced angles
// around a circle), not random — a calm, consistent burst rather than a
// scattershot one.
// One grid template shared by the header row and every task row — the
// single source of truth for column widths, so header labels and row data
// are laid out by the exact same rule instead of two hand-matched flex
// layouts drifting apart (which is what erroralign.png was showing).
// Leading slot (drag handle + checkbox) | Name (flexible) | Dates | Assignees | actions menu
// Leading slot is wider than the checkbox itself (and the Name column
// starts with extra left padding, see the row/header below) so the name
// text has real breathing room instead of butting right up against the
// checkbox.
const ROW_GRID_COLS =
  'grid-cols-[3rem_1fr_7rem_5rem_1.75rem]';

const CONFETTI_COLORS = ['bg-primary', 'bg-secondary', 'bg-accent', 'bg-success'];
const CONFETTI_PARTICLES = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  const radius = 22;
  return {
    tx: Math.cos(angle) * radius,
    ty: Math.sin(angle) * radius,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: (i % 4) * 20,
  };
});

const formatShortDate = (date?: string) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// Single combined "Aug 10 – 12" style range, matching the Asana reference
// (one Dates column, not separate Start/Due columns). When both dates fall
// in the same month, the range end drops its own month name; a lone date
// (only start, or only due — most cards) just renders by itself.
const formatDateRange = (start: string | null, due: string | null) => {
  if (start && due) {
    const dueShort =
      start.split(' ')[0] === due.split(' ')[0]
        ? due.split(' ').slice(1).join(' ')
        : due;
    return `${start} – ${dueShort}`;
  }
  return due || start;
};

// A droppable id namespace for "drop into this section" (an empty section,
// or below its last row) — distinct from a task id so onDragEnd can tell
// "dropped on a row" and "dropped on a section" apart.
const sectionDroppableId = (columnId: string) => `column-${columnId}`;

interface TaskRowProps {
  task: Task;
  boardNumber?: number;
  isDone: boolean;
  isCelebrating: boolean;
  startDate: string | null;
  dueDate: string | null;
  onOpenCard: (cardId: string) => void;
  onToggleCompleted: (taskId: string) => void;
  onMoveTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => Promise<boolean>;
  onUpdateCardTitle?: (cardId: string, title: string) => Promise<boolean>;
  onEditDates?: (cardId: string) => void;
  onEditAssignee?: (cardId: string) => void;
  draggable: boolean;
}

function TaskRow({
  task,
  boardNumber,
  isDone,
  isCelebrating,
  startDate,
  dueDate,
  onOpenCard,
  onToggleCompleted,
  onMoveTask,
  onDeleteTask,
  onUpdateCardTitle,
  onEditDates,
  onEditAssignee,
  draggable,
}: TaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: !draggable });

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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onOpenCard(task.id)}
      className={`group grid ${ROW_GRID_COLS} items-stretch border-b border-border/30 last:border-b-0 cursor-pointer transition-colors ${
        isDone ? 'bg-muted/10 hover:bg-muted/20' : 'hover:bg-muted/20'
      }`}
    >
      {/* Drag handle + checkbox share one fixed-width leading slot, matching
          the header's own leading grid column exactly (both use
          ROW_GRID_COLS) — this is what keeps Name/Dates/Assignees lined up
          under their headers regardless of how many leading elements a row
          has. */}
      <div className='flex items-center gap-1 pl-2 py-2.5'>
        {/* Drag handle — hover the left edge to grab and reposition the
            row, within its section or into another one. Hidden entirely
            (not just faded) when dragging isn't wired up (no onMoveCard). */}
        {draggable && (
          <button
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            title='Drag to reorder or move to another list'
            className='flex-shrink-0 p-0.5 text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-foreground cursor-grab active:cursor-grabbing transition-colors touch-none'
          >
            <GripVertical className='w-3.5 h-3.5' />
          </button>
        )}

        <div className='relative flex-shrink-0'>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCompleted(task.id);
            }}
            title={isDone ? 'Mark as not done' : 'Mark as done'}
            className={`relative w-5 h-5 rounded-full border flex items-center justify-center transition-colors duration-200 ${
              isCelebrating ? 'check-pop' : ''
            } ${
              isDone
                ? 'bg-muted-foreground/40 border-muted-foreground/40 text-background'
                : 'border-border/60 text-transparent hover:border-primary hover:text-primary/60'
            }`}
          >
            <Check className='w-3 h-3' />
          </button>

          {isCelebrating && (
            <div className='pointer-events-none absolute inset-0'>
              {CONFETTI_PARTICLES.map((p, i) => (
                <span
                  key={i}
                  className={`confetti-particle absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full ${p.color}`}
                  style={
                    {
                      '--tx': `${p.tx}px`,
                      '--ty': `${p.ty}px`,
                      animationDelay: `${p.delay}ms`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Name column — title and labels live together, left-aligned;
          comment/attachment counts are pushed to the cell's own right edge
          (ml-auto) rather than crowding right up against the title. */}
      <div className='flex items-center gap-2 min-w-0 pl-4 pr-3 py-2.5'>
        {isEditingTitle ? (
          <input
            type='text'
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
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
            className='flex-1 min-w-0 text-sm bg-background border border-primary rounded px-1.5 py-0.5 text-foreground focus:outline-none'
          />
        ) : (
          <>
            {task.number != null && (
              <span
                className='inline-flex items-center gap-1 flex-shrink-0 text-[11px] font-medium text-muted-foreground'
                title='Card id'
              >
                <span
                  className='w-1.5 h-1.5 rounded-full flex-shrink-0'
                  style={{ backgroundColor: colorForNumber(task.number) }}
                />
                #{boardNumber ?? '?'}-{task.number}
              </span>
            )}
            <span
              onClick={(e) => {
                if (!onUpdateCardTitle) return;
                e.stopPropagation();
                setTitleDraft(task.title);
                setIsEditingTitle(true);
              }}
              className={`inline-block w-fit shrink text-sm truncate min-w-0 transition-colors ${
                onUpdateCardTitle ? 'hover:bg-muted/40 rounded px-1 -mx-1' : ''
              } ${
                isDone ? 'text-muted-foreground line-through' : 'text-foreground'
              }`}
            >
              {task.title}
            </span>
          </>
        )}

        {task.labels && task.labels.length > 0 && (
          <div className='flex flex-wrap items-center gap-1 flex-shrink-0'>
            {task.labels.slice(0, 4).map((label, i) => (
              <span
                key={i}
                className='px-2 py-0.5 rounded-full text-[10px] font-medium text-white whitespace-nowrap'
                style={{ backgroundColor: label.color }}
              >
                {label.text}
              </span>
            ))}
          </div>
        )}

        {/* Comment / attachment counts — pushed to the right end of the
            Name column (a count only shows up when it's actually non-zero,
            never a bare "0"), instead of sitting right next to the title. */}
        {(!!task.comments || !!task.attachments) && (
          <div className='ml-auto flex items-center gap-2 flex-shrink-0 pl-2'>
            {!!task.comments && (
              <span className='flex items-center gap-0.5 text-[11px] text-muted-foreground'>
                <MessageSquare className='w-3 h-3' />
                {task.comments}
              </span>
            )}
            {!!task.attachments && (
              <span className='flex items-center gap-0.5 text-[11px] text-muted-foreground'>
                <Paperclip className='w-3 h-3' />
                {task.attachments}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Dates — one combined column ("Aug 10 – 12") instead of separate
          Start date / Due date columns, matching the reference layout.
          Bordered on both sides and clickable only within its own cell —
          clicking it opens just the date popover, never the card (that's
          the row's own onClick, which this stops from firing). Text is
          centered in the cell, matching inspiration/column.png. */}
      <div
        onClick={(e) => {
          if (!onEditDates) return;
          e.stopPropagation();
          onEditDates(task.id);
        }}
        title={onEditDates ? 'Edit dates' : undefined}
        className={`hidden md:flex items-center justify-center text-xs text-center border-l border-border/30 px-2 py-2.5 truncate ${
          onEditDates ? 'hover:bg-muted/40' : ''
        } ${
          task.due_status === 'overdue'
            ? 'text-destructive'
            : task.due_status === 'due_soon'
            ? 'text-amber-500'
            : 'text-muted-foreground'
        }`}
      >
        {formatDateRange(startDate, dueDate)}
      </div>

      {/* Assignees — same bordered-cell treatment, click confined to this
          column only. */}
      <div
        onClick={(e) => {
          if (!onEditAssignee) return;
          e.stopPropagation();
          onEditAssignee(task.id);
        }}
        title={onEditAssignee ? 'Edit assignees' : undefined}
        className={`flex items-center justify-center -space-x-2 border-l border-border/30 px-2 py-2.5 ${
          onEditAssignee ? 'hover:bg-muted/40' : ''
        }`}
      >
        {(task.assignees || []).slice(0, 3).map((a, i) =>
          a.avatar_url ? (
            <img
              key={i}
              src={a.avatar_url}
              alt={a.full_name || ''}
              title={a.full_name}
              className='w-6 h-6 rounded-full object-cover border-2 border-card'
            />
          ) : (
            <div
              key={i}
              title={a.full_name}
              className={`w-6 h-6 rounded-full ${a.color} border-2 border-card flex items-center justify-center text-[10px] font-bold text-white`}
            >
              {a.initials}
            </div>
          )
        )}
      </div>

      {/* Its own grid column regardless of whether the menu renders, so the
          columns to its left (Dates/Assignees) land under their headers the
          same whether or not a given row has move/delete handlers wired up
          — otherwise their trailing edge shifts row-to-row and against the
          header, which is what erroralign.png was showing. */}
      <div
        className='flex items-center justify-end pr-2 py-2.5'
        onClick={(e) => e.stopPropagation()}
      >
        {(onMoveTask || onDeleteTask) && (
          <TaskActionsMenu
            task={task}
            onMoveTask={onMoveTask}
            onDeleteTask={onDeleteTask}
          />
        )}
      </div>
    </div>
  );
}

interface SectionBodyProps {
  column: Column;
  droppable: boolean;
  children: React.ReactNode;
}

// Wraps a section's rows in both a SortableContext (reordering within the
// section) and a droppable region keyed separately from any row id, so
// dropping into an empty section — or below its last row — still resolves
// to that section rather than requiring a row to land on.
function SectionBody({ column, droppable, children }: SectionBodyProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: sectionDroppableId(column.id),
    disabled: !droppable,
  });

  return (
    <div
      ref={droppable ? setNodeRef : undefined}
      className={`border-t border-border/40 pt-1 transition-colors ${
        isOver ? 'bg-primary/5' : ''
      }`}
    >
      <SortableContext
        items={column.cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </div>
  );
}

export function ListView({
  columns,
  boardNumber,
  onOpenCard,
  onAddCard,
  onDeleteList,
  onUpdateListName,
  onToggleDoneList,
  onMoveTask,
  onDeleteTask,
  onMoveCard,
  onUpdateCardTitle,
  onEditDates,
  onEditAssignee,
}: ListViewProps) {
  // Collapsed defaults to false (expanded) for every section — matches the
  // Asana reference, which opens with all sections visible.
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});

  // Checking a row's checkbox is purely a local, visual "done" marker — it
  // does NOT move the card to another list or persist anywhere (Taskmaster
  // has no completed flag on cards, and the earlier "move to last list"
  // behavior was explicitly unwanted here: rows must stay put). It resets
  // on reload since there's nothing to load it back from.
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  // Card id currently showing the "Task completed" celebration, if any.
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const draggable = !!onMoveCard;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const toggleSection = (columnId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [columnId]: !prev[columnId],
    }));
  };

  const toggleCompleted = (taskId: string) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      const wasCompleted = next.has(taskId);
      if (wasCompleted) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }

      if (!wasCompleted) {
        // Just checked it — celebrate briefly, then clear.
        setCelebratingId(taskId);
        if (celebrationTimeoutRef.current) {
          clearTimeout(celebrationTimeoutRef.current);
        }
        celebrationTimeoutRef.current = setTimeout(() => {
          setCelebratingId((current) => (current === taskId ? null : current));
        }, 1400);
      }

      return next;
    });
  };

  const findColumnOfTask = (taskId: string) =>
    columns.find((col) => col.cards.some((c) => c.id === taskId));

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string;
    const column = findColumnOfTask(taskId);
    const task = column?.cards.find((c) => c.id === taskId) || null;
    setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || !onMoveCard) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;

    const sourceColumn = findColumnOfTask(activeId);
    if (!sourceColumn) return;

    // Dropped on a section's empty/below-rows area, not another row.
    const overSectionId = overId.startsWith('column-')
      ? overId.slice('column-'.length)
      : null;

    let targetColumn: Column | undefined;
    let newIndex: number;

    if (overSectionId) {
      targetColumn = columns.find((col) => col.id === overSectionId);
      if (!targetColumn) return;
      newIndex = targetColumn.cards.length;
    } else {
      targetColumn = findColumnOfTask(overId);
      if (!targetColumn) return;
      newIndex = targetColumn.cards.findIndex((c) => c.id === overId);
      if (newIndex === -1) newIndex = targetColumn.cards.length;
    }

    onMoveCard(activeId, sourceColumn.id, targetColumn.id, newIndex);
  };

  const content = (
    // No overflow-y-auto here — this page scrolls at the window level (its
    // ancestor is `min-h-screen`, not height-bound), so this div's content
    // never actually overflows its own box; it just grows instead. But
    // `overflow: auto` alone — regardless of whether it ever triggers an
    // actual scrollbar — makes an element the reference "scroll container"
    // for any `position: sticky` descendants. Since THIS container itself
    // never scrolls, nothing inside it could ever stick; the whole thing
    // just scrolled away with the page. Letting the real window scroll
    // handle it is what makes the column header's `sticky` actually work.
    <div className='flex-1 px-4 sm:px-6 py-4'>
      <div className='max-w-6xl mx-auto space-y-3 pb-8'>
        {/* Column header row — uses the exact same grid template as every
            task row (ROW_GRID_COLS), so labels always land directly above
            their cells no matter what a given row does or doesn't render. */}
        <div
          // top-[68px] matches DashboardHeader's fixed height exactly (see
          // its own `h-[68px]` loading placeholder) — this page scrolls at
          // the window level, not inside some bounded div, so "sticky
          // top-0" was sticking this row at the very top of the viewport,
          // right where the fixed nav already sits (z-50, above this row's
          // z-20) — it never looked stuck because the nav was covering it
          // the entire time you'd actually be scrolled far enough to see it.
          //
          // bg-card (not bg-background) matches the section boxes below it
          // — bg-background reads as flat black against them. No outer
          // px-3 either: the section boxes/rows below have zero outer
          // padding of their own (only per-cell padding), so this row
          // having one made every column start ~12px further right than
          // its data, which is what threw the alignment off.
          className={`hidden lg:grid ${ROW_GRID_COLS} text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky top-[68px] z-20 bg-card/95 backdrop-blur-md border border-border/50 rounded-xl shadow-sm`}
        >
          <div />
          <div className='pl-4 pr-3 py-2'>Name</div>
          <div className='px-2 py-2 border-l border-border/30 text-center'>
            Dates
          </div>
          <div className='px-2 py-2 border-l border-border/30 text-center'>
            Assignees
          </div>
          <div />
        </div>

        {columns.map((column) => {
          const isCollapsed = collapsedSections[column.id];

          return (
            <div
              key={column.id}
              className='bg-card/60 backdrop-blur-xl border border-border/50 rounded-xl overflow-hidden'
            >
              <div className='w-full flex items-center gap-1 pl-2 pr-1.5 py-3 hover:bg-muted/30 transition-colors group/header'>
                <button
                  onClick={() => toggleSection(column.id)}
                  title={isCollapsed ? 'Expand list' : 'Collapse list'}
                  className='flex-shrink-0 p-1 rounded hover:bg-muted/60 transition-colors'
                >
                  {isCollapsed ? (
                    <ChevronRight className='w-4 h-4 text-muted-foreground' />
                  ) : (
                    <ChevronDown className='w-4 h-4 text-muted-foreground' />
                  )}
                </button>

                {onUpdateListName ? (
                  <ListNameEditor
                    listName={column.title}
                    onSave={(newName) =>
                      onUpdateListName(column.id, newName)
                    }
                  />
                ) : (
                  <span className='flex-1 font-semibold text-sm text-foreground px-2 py-1'>
                    {column.title}
                  </span>
                )}

                {column.number != null && (
                  <span
                    className='flex-shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground pr-1'
                    title='List id'
                  >
                    <span
                      className='w-1.5 h-1.5 rounded-full flex-shrink-0'
                      style={{ backgroundColor: colorForNumber(column.number) }}
                    />
                    #{boardNumber ?? '?'}.{column.number}
                  </span>
                )}

                {column.is_done_list && (
                  <span title='Cards here count as completed'>
                    <CheckCircle2 className='w-3.5 h-3.5 text-success flex-shrink-0' />
                  </span>
                )}

                <span className='flex-shrink-0 text-xs text-muted-foreground pr-1'>
                  {column.cards.length}
                </span>

                {(onDeleteList || onToggleDoneList) && (
                  <div className='opacity-0 group-hover/header:opacity-100 transition-opacity'>
                    <ListActionsMenu
                      listId={column.id}
                      listName={column.title}
                      cardCount={column.cards.length}
                      onDeleteList={onDeleteList}
                      isDoneList={column.is_done_list}
                      onToggleDoneList={onToggleDoneList}
                    />
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <SectionBody column={column} droppable={draggable}>
                  {column.cards.map((task) => {
                    const isDone = completedIds.has(task.id);
                    const isCelebrating = celebratingId === task.id;
                    const startDate = formatShortDate(task.start_date);
                    const dueDate = formatShortDate(task.due_date);

                    return (
                      <TaskRow
                        key={task.id}
                        task={task}
                        boardNumber={boardNumber}
                        isDone={isDone}
                        isCelebrating={isCelebrating}
                        startDate={startDate}
                        dueDate={dueDate}
                        onOpenCard={onOpenCard}
                        onToggleCompleted={toggleCompleted}
                        onMoveTask={onMoveTask}
                        onDeleteTask={onDeleteTask}
                        onUpdateCardTitle={onUpdateCardTitle}
                        onEditDates={onEditDates}
                        onEditAssignee={onEditAssignee}
                        draggable={draggable}
                      />
                    );
                  })}

                  <div className='px-3 py-2'>
                    <AddCardForm columnId={column.id} onAddCard={onAddCard} />
                  </div>
                </SectionBody>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  if (!draggable) return content;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {content}
      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <div className='flex items-center gap-2 px-3 py-2.5 bg-card border border-primary/50 rounded-lg shadow-2xl max-w-md'>
            <div className='w-5 h-5 rounded-full border border-border/60 flex-shrink-0' />
            <span className='text-sm text-foreground truncate'>
              {activeTask.title}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
