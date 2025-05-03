'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { DashboardHeader } from '../../components/dashboard/header';
import { ColumnContainer } from '../../components/board/ColumnContainer';
import { TaskCard } from '../../components/board/TaskCard';
import {
  Star,
  User,
  Users,
  Plus,
  MoreHorizontal,
  Filter,
  Search,
  ChevronDown,
  Sparkles,
  Clock,
  CheckSquare,
  ArrowUp,
  Bug,
  Paperclip,
  MessageSquare,
} from 'lucide-react';

// Define card/task type
interface Task {
  id: string;
  title: string;
  labels?: { color: string; text: string }[];
  assignees?: { initials: string; color: string }[];
  attachments?: number;
  comments?: number;
}

// Define column type
interface Column {
  id: string;
  title: string;
  cards: Task[];
}

// Map old colors to new space theme colors
const labelColors = {
  'bg-red-500': 'bg-primary text-white',
  'bg-purple-500': 'bg-purple-500 text-white',
  'bg-green-500': 'bg-secondary text-white',
  'bg-blue-500': 'bg-accent text-white',
  'bg-gray-500': 'bg-slate-500 text-white',
};

// Sample data for columns and cards
const initialColumns: Column[] = [
  {
    id: 'review-pending',
    title: 'Review - Pending',
    cards: [
      {
        id: 'card1',
        title: '2nd Review @Clq',
        labels: [{ color: 'bg-red-500', text: 'Priority' }],
        assignees: [
          { initials: 'AN', color: 'bg-orange-500' },
          { initials: 'KV', color: 'bg-purple-500' },
        ],
      },
    ],
  },
  {
    id: 'android-pending',
    title: 'Android - Pending',
    cards: [
      {
        id: 'card3',
        title: 'Home Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card4',
        title: 'Profile Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card5',
        title: 'Theft Report Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card6',
        title: 'Over Charging Report Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card7',
        title: 'Duping Report Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card8',
        title: 'Spot Details Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card9',
        title: 'Places to go Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
    ],
  },
  {
    id: 'web-pending',
    title: 'Web - Pending',
    cards: [
      {
        id: 'card10',
        title: 'Nation Home Page',
        labels: [{ color: 'bg-green-500', text: 'Web' }],
      },
      {
        id: 'card11',
        title: 'State Home Page',
        labels: [{ color: 'bg-green-500', text: 'Web' }],
      },
      {
        id: 'card12',
        title: 'Analysis Page',
        labels: [{ color: 'bg-green-500', text: 'Web' }],
      },
      {
        id: 'card13',
        title: 'Requests Handling Page',
        labels: [{ color: 'bg-green-500', text: 'Web' }],
      },
      {
        id: 'card14',
        title: 'Police Home Page',
        labels: [{ color: 'bg-green-500', text: 'Web' }],
      },
    ],
  },
  {
    id: 'backend-pending',
    title: 'Backend - Pending',
    cards: [
      {
        id: 'card15',
        title: 'Authorization',
        labels: [{ color: 'bg-blue-500', text: 'Backend' }],
      },
      {
        id: 'card16',
        title: 'Hotel View and Tourist Spot',
        labels: [{ color: 'bg-blue-500', text: 'Backend' }],
        assignees: [{ initials: 'AN', color: 'bg-orange-500' }],
      },
      {
        id: 'card17',
        title:
          'Tourists List, Police Control Room, Police, State Supervisor List',
        labels: [{ color: 'bg-blue-500', text: 'Backend' }],
        assignees: [{ initials: 'KV', color: 'bg-purple-500' }],
      },
    ],
  },
  {
    id: 'references',
    title: 'References',
    cards: [
      {
        id: 'card18',
        title: 'GitHub References',
        labels: [{ color: 'bg-gray-500', text: 'Documentation' }],
        attachments: 3,
        comments: 3,
      },
      {
        id: 'card19',
        title: 'Excali Design',
        labels: [{ color: 'bg-green-500', text: 'Design' }],
        attachments: 1,
      },
      {
        id: 'card20',
        title: 'Figma Designs',
        labels: [{ color: 'bg-green-500', text: 'Design' }],
        attachments: 1,
      },
      {
        id: 'card21',
        title: 'DB Design',
        labels: [{ color: 'bg-green-500', text: 'Design' }],
        attachments: 1,
      },
    ],
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    cards: [],
  },
];

// Helper function to get a column style based on ID
const getColumnStyle = (id: string) => {
  const styles = {
    'review-pending': 'bg-purple-500/10 border-purple-500/30 text-purple-500',
    'android-pending': 'bg-violet-500/10 border-violet-500/30 text-violet-500',
    'web-pending': 'bg-green-500/10 border-green-500/30 text-green-500',
    'backend-pending': 'bg-blue-500/10 border-blue-500/30 text-blue-500',
    references: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
    'in-progress': 'bg-primary/10 border-primary/30 text-primary',
  };

  return (
    styles[id as keyof typeof styles] ||
    'bg-slate-500/10 border-slate-500/30 text-slate-400'
  );
};

export default function BoardPage({ params }: { params: { id: string } }) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [dragOverInfo, setDragOverInfo] = useState<{
    id: UniqueIdentifier | null;
    type: 'task' | 'column' | null;
    index: number | null;
    columnId: string | null;
  }>({
    id: null,
    type: null,
    index: null,
    columnId: null,
  });
  const boardName = 'TouristSprint1'; // Dynamically get this based on params.id in a real app

  // Configure sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Reduced to make it more responsive
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function findColumnById(id: string): Column | undefined {
    return columns.find((column) => column.id === id);
  }

  function findTaskById(
    id: string
  ): { task: Task; columnId: string } | undefined {
    for (const column of columns) {
      const task = column.cards.find((card) => card.id === id);
      if (task) {
        return { task, columnId: column.id };
      }
    }
    return undefined;
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const taskInfo = findTaskById(active.id as string);

    if (taskInfo) {
      const { task, columnId } = taskInfo;
      setActiveTask(task);
      setActiveColumnId(columnId);
    }

    // Reset drag over info when starting a new drag
    setDragOverInfo({
      id: null,
      type: null,
      index: null,
      columnId: null,
    });
  }

  // Create a custom collision detection strategy
  const collisionDetectionStrategy = (args: any) => {
    // First, let's use the built-in rectangle intersection strategy
    const intersections = rectIntersection(args);

    // If there are no intersections or we're not dragging, return the results
    if (!intersections?.length || !activeTask) return intersections;

    // Find the closest intersection - prioritize columns when moving horizontally
    // and tasks when moving vertically
    return closestCorners(args);
  };

  // Add a function to handle the drag over event
  function handleDragOver(event: any) {
    const { active, over } = event;

    if (!over) {
      setDragOverInfo({
        id: null,
        type: null,
        index: null,
        columnId: null,
      });
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Don't do anything if hovering over the active item
    if (activeId === overId) return;

    // Check if over is a column
    const isOverColumn = columns.some((col) => col.id === overId);

    if (isOverColumn) {
      // If over a column, set the drag over info
      const columnIndex = columns.findIndex((col) => col.id === overId);
      const column = columns[columnIndex];

      setDragOverInfo({
        id: overId,
        type: 'column',
        index: column.cards.length, // Will place at the end of the column
        columnId: overId,
      });
    } else {
      // If over a task, find the task and its column
      const overTaskInfo = findTaskById(overId);
      if (!overTaskInfo) return;

      const { columnId } = overTaskInfo;
      const column = findColumnById(columnId);
      if (!column) return;

      const taskIndex = column.cards.findIndex((task) => task.id === overId);

      setDragOverInfo({
        id: overId,
        type: 'task',
        index: taskIndex,
        columnId: columnId,
      });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    // Create smooth transition for the DOM update by waiting for the animation frame
    window.requestAnimationFrame(() => {
      // Clear the active task state and drag over info
      setActiveTask(null);
      setActiveColumnId(null);
      setDragOverInfo({
        id: null,
        type: null,
        index: null,
        columnId: null,
      });
    });

    // If there's no over element, we can't do anything
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // If dropped on itself, no changes needed
    if (activeId === overId) return;

    // Get information about active task
    const activeTaskInfo = findTaskById(activeId);
    if (!activeTaskInfo) return;

    const { task: activeTask, columnId: activeColumnId } = activeTaskInfo;

    // Check if over is a column or a task
    const isOverAColumn = columns.some((col) => col.id === overId);

    // If over a column, find that column
    if (isOverAColumn) {
      // Handle dropping on a column
      const targetColumnId = overId;

      // If it's the same column, no need to move between columns
      if (targetColumnId === activeColumnId) return;

      setColumns((prevColumns) => {
        return prevColumns.map((column) => {
          // Remove from source column
          if (column.id === activeColumnId) {
            return {
              ...column,
              cards: column.cards.filter((card) => card.id !== activeId),
            };
          }

          // Add to target column
          if (column.id === targetColumnId) {
            return {
              ...column,
              cards: [...column.cards, activeTask],
            };
          }

          return column;
        });
      });
    } else {
      // Over a task
      const overTaskInfo = findTaskById(overId);
      if (!overTaskInfo) return;

      const { columnId: overColumnId } = overTaskInfo;

      setColumns((prevColumns) => {
        return prevColumns.map((column) => {
          // Same column - reordering
          if (column.id === activeColumnId && column.id === overColumnId) {
            const oldIndex = column.cards.findIndex(
              (card) => card.id === activeId
            );
            const newIndex = column.cards.findIndex(
              (card) => card.id === overId
            );

            return {
              ...column,
              cards: arrayMove(column.cards, oldIndex, newIndex),
            };
          }

          // Remove from source column
          if (column.id === activeColumnId) {
            return {
              ...column,
              cards: column.cards.filter((card) => card.id !== activeId),
            };
          }

          // Add to target column
          if (column.id === overColumnId) {
            const newIndex = column.cards.findIndex(
              (card) => card.id === overId
            );
            const newCards = [...column.cards];
            newCards.splice(newIndex, 0, activeTask);

            return {
              ...column,
              cards: newCards,
            };
          }

          return column;
        });
      });
    }
  }

  return (
    <div className='h-screen overflow-hidden dot-pattern-dark flex flex-col'>
      <DashboardHeader />

      <main className='flex-1 flex flex-col overflow-hidden pt-16'>
        {/* Board Header - Clean, minimal design */}
        <div className='w-full mx-auto px-6 py-1 border-b border-white/10'>
          <div className='flex items-center justify-between'>
            {/* Left side - Title and description */}
            <div className='flex flex-col'>
              <div className='flex items-center gap-2 mb-0.5'>
                <h1 className='text-base font-medium text-purple-400'>
                  {boardName}
                </h1>
                <button
                  className='text-purple-400/70 hover:text-purple-400 transition-colors'
                  aria-label='Star board'
                >
                  <Star className='w-4 h-4' />
                </button>
              </div>
              <p className='text-[10px] text-gray-400 max-w-2xl'>
                Tourism Safety application: Android, Web, and Backend
              </p>
            </div>

            {/* Right side - Actions and info */}
            <div className='flex items-center gap-3'>
              <div className='text-xs text-gray-400 flex items-center'>
                <Clock className='w-3.5 h-3.5 mr-1' />
                <span>2h ago</span>
              </div>

              <div className='flex items-center'>
                <button className='flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-300 hover:bg-white/10 transition-colors'>
                  <Filter className='w-3.5 h-3.5' />
                  <span>Filters</span>
                </button>
                <button className='flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-300 hover:bg-white/10 transition-colors ml-1'>
                  <Users className='w-3.5 h-3.5' />
                  <span>Share</span>
                </button>
              </div>

              <div className='flex -space-x-1.5'>
                <div className='w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-xs font-medium ring-1 ring-background'>
                  AN
                </div>
                <div className='w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-xs font-medium ring-1 ring-background'>
                  KV
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Board Content - Wrapped with DndContext */}
        <div className='flex-1 overflow-x-auto overflow-y-auto px-8 pb-6 pt-4'>
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className='flex items-start gap-5 min-h-[450px] pb-4'>
              {/* Render columns using ColumnContainer */}
              {columns.map((column) => (
                <ColumnContainer
                  key={column.id}
                  column={column}
                  tasks={column.cards}
                  getColumnStyle={getColumnStyle}
                  labelColors={labelColors}
                  dragOverInfo={dragOverInfo}
                  activeTaskId={activeTask?.id}
                />
              ))}

              {/* Button to add new list */}
              <div className='w-64 flex-shrink-0 self-start mr-8'>
                <button className='w-full h-[40px] flex items-center justify-center px-3 py-2 bg-gray-800/90 hover:bg-gray-700/90 border border-gray-600/40 text-white rounded-lg shadow-sm'>
                  <Plus className='w-4 h-4 text-white mr-1.5' />
                  <span className='text-sm font-normal'>Add another list</span>
                </button>
              </div>
              {/* Extra space on the right */}
              <div className='w-8 flex-shrink-0'></div>
            </div>

            {/* Drag Overlay - Renders the task being dragged */}
            <DragOverlay
              dropAnimation={{
                duration: 300,
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
              }}
            >
              {activeTask ? (
                <div className='rotate-1 scale-105 transition-transform duration-200 opacity-90 shadow-lg w-80 pointer-events-none'>
                  <TaskCard
                    task={activeTask}
                    labelColors={labelColors}
                    columnId={activeColumnId || ''}
                    isDragTarget={false}
                    isBeingDragged={false}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </main>
    </div>
  );
}
