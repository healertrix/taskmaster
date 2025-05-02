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
      {
        id: 'card2',
        title: 'fefesf',
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
    'references': 'bg-slate-500/10 border-slate-500/30 text-slate-400',
    'in-progress': 'bg-primary/10 border-primary/30 text-primary',
  };

  return styles[id as keyof typeof styles] || 'bg-slate-500/10 border-slate-500/30 text-slate-400';
};

export default function BoardPage({ params }: { params: { id: string } }) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
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
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    // Clear the active task state
    setActiveTask(null);
    setActiveColumnId(null);

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

      <main className='flex-1 flex flex-col overflow-hidden'>
        {/* Board Header */}
        <div className='max-w-screen-2xl w-full mx-auto flex justify-between items-center py-4 px-6'>
          <div className='flex items-center space-x-4'>
            <h1 className='text-xl font-bold text-foreground bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent'>
              {boardName}
            </h1>
            <button
              className='text-muted-foreground hover:text-accent transition-colors'
              aria-label='Star board'
            >
              <Star className='w-5 h-5' />
            </button>
            <div className='h-6 border-l border-border'></div>
            <button className='btn btn-outline flex items-center gap-1 text-sm'>
              <Users className='w-4 h-4' />
              <span>Share</span>
            </button>
          </div>

          <div className='flex items-center space-x-3'>
            <button className='btn btn-outline flex items-center gap-1.5 text-sm'>
              <Filter className='w-4 h-4' />
              <span>Filters</span>
            </button>
            <div className='flex -space-x-2'>
              <div className='w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-background'>
                AN
              </div>
              <div className='w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-background'>
                KV
              </div>
              <button
                className='w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-muted-foreground text-xs transition-colors'
                aria-label='Add new member'
              >
                <Plus className='w-4 h-4' />
              </button>
            </div>
          </div>
        </div>

        {/* Board Content - Wrapped with DndContext */}
        <div className='flex-1 overflow-x-auto overflow-y-hidden px-6 pb-8'>
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className='flex items-start h-full'>
              {/* Render columns using ColumnContainer */}
              {columns.map((column) => (
                <ColumnContainer
                  key={column.id}
                  column={column}
                  tasks={column.cards}
                  getColumnStyle={getColumnStyle}
                  labelColors={labelColors}
                />
              ))}

              {/* Button to add new list */}
              <div className='w-80 flex-shrink-0'>
                <button className='w-full btn btn-secondary flex items-center gap-2 justify-start px-4 py-2.5 bg-white/5 backdrop-blur-sm hover:bg-white/10 border border-white/10 rounded-xl shadow-sm'>
                  <Plus className='w-4 h-4' />
                  Add another list
                </button>
              </div>
            </div>

            {/* Drag Overlay - Renders the task being dragged */}
            <DragOverlay>
              {activeTask ? (
                <TaskCard
                  task={activeTask}
                  labelColors={labelColors}
                  columnId={activeColumnId || ''}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </main>
    </div>
  );
}
