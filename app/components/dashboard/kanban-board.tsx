import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Plus,
  MoreHorizontal,
  Bug,
  Sparkles,
  ArrowUp,
  CheckSquare,
} from 'lucide-react';
import { Column } from './kanban/column';
import { SortableTask } from './kanban/sortable-task';
import { Task, TaskType } from './kanban/types';

const TaskTypeIcon = ({ type }: { type: TaskType }) => {
  const colorClass =
    type === 'bug'
      ? 'text-red-400'
      : type === 'feature'
      ? 'text-violet-400'
      : type === 'improvement'
      ? 'text-blue-400'
      : 'text-emerald-400';
  const Icon =
    type === 'bug'
      ? Bug
      : type === 'feature'
      ? Sparkles
      : type === 'improvement'
      ? ArrowUp
      : CheckSquare;

  return <Icon className={`w-4 h-4 ${colorClass}`} />;
};

const initialColumns = [
  {
    id: 'todo',
    title: 'To Do',
    tasks: [
      {
        id: '1',
        type: 'task',
        title: 'Interview',
        description:
          'Conduct technical interview for senior developer position',
        status: 'todo',
        assignee: {
          name: 'Lora Piterson',
          avatar:
            'https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=32&h=32&q=80',
        },
        reporter: {
          name: 'John Doe',
          avatar:
            'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=32&h=32&q=80',
        },
        dueDate: '2024-03-15',
        createdAt: '2024-03-01',
        priority: 'high',
        labels: ['HR', 'Hiring'],
        comments: 3,
        attachments: 2,
        progress: 0,
        subtasks: {
          total: 4,
          completed: 1,
        },
      },
      {
        id: '2',
        type: 'bug',
        title: 'Fix Authentication Issue',
        description:
          'Users are experiencing intermittent login failures on the mobile app',
        status: 'todo',
        assignee: {
          name: 'Alex Chen',
          avatar:
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=32&h=32&q=80',
        },
        reporter: {
          name: 'Sarah Wilson',
          avatar:
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=32&h=32&q=80',
        },
        dueDate: '2024-03-10',
        createdAt: '2024-03-02',
        priority: 'high',
        labels: ['Bug', 'Mobile'],
        comments: 5,
        attachments: 1,
        progress: 0,
        subtasks: {
          total: 3,
          completed: 0,
        },
      },
    ],
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    tasks: [
      {
        id: '3',
        type: 'feature',
        title: 'Implement Dark Mode',
        description:
          'Add system-wide dark mode support with user preference persistence',
        status: 'in-progress',
        assignee: {
          name: 'Mike Johnson',
          avatar:
            'https://images.unsplash.com/photo-1519244703995-f4e0f30006d5?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=32&h=32&q=80',
        },
        reporter: {
          name: 'Lora Piterson',
          avatar:
            'https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=32&h=32&q=80',
        },
        dueDate: '2024-03-20',
        createdAt: '2024-02-28',
        priority: 'medium',
        labels: ['Feature', 'UI/UX'],
        comments: 8,
        attachments: 3,
        progress: 60,
        subtasks: {
          total: 5,
          completed: 3,
        },
      },
    ],
  },
  {
    id: 'review',
    title: 'Review',
    tasks: [
      {
        id: '4',
        type: 'improvement',
        title: 'Optimize Image Loading',
        description:
          'Implement lazy loading and image optimization for better performance',
        status: 'review',
        assignee: {
          name: 'Emily Davis',
          avatar:
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=32&h=32&q=80',
        },
        reporter: {
          name: 'Alex Chen',
          avatar:
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=32&h=32&q=80',
        },
        dueDate: '2024-03-12',
        createdAt: '2024-03-01',
        priority: 'low',
        labels: ['Performance', 'Frontend'],
        comments: 4,
        attachments: 1,
        progress: 90,
        subtasks: {
          total: 3,
          completed: 3,
        },
      },
    ],
  },
  {
    id: 'done',
    title: 'Done',
    tasks: [],
  },
];

export function KanbanBoard() {
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: any) => {
    const { active } = event;
    setActiveId(active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeTask = findTask(active.id);
    if (!activeTask) {
      setActiveId(null);
      return;
    }

    const activeColumn = columns.find((col) =>
      col.tasks.some((task) => task.id === active.id)
    );
    const overColumn =
      columns.find((col) => col.id === over.id) ||
      columns.find((col) => col.tasks.some((task) => task.id === over.id));

    if (!activeColumn || !overColumn) {
      setActiveId(null);
      return;
    }

    if (activeColumn.id === overColumn.id) {
      const oldIndex = activeColumn.tasks.findIndex((t) => t.id === active.id);
      const newIndex = overColumn.tasks.findIndex((t) => t.id === over.id);

      if (oldIndex !== newIndex && newIndex !== -1) {
        setColumns((prev) =>
          prev.map((col) =>
            col.id === activeColumn.id
              ? { ...col, tasks: arrayMove(col.tasks, oldIndex, newIndex) }
              : col
          )
        );
      }
    } else {
      setColumns((prev) => {
        const activeTasks = activeColumn.tasks.filter(
          (t) => t.id !== active.id
        );
        const overTasks = [...overColumn.tasks];

        const overTaskIndex = overColumn.tasks.findIndex(
          (t) => t.id === over.id
        );

        if (overTaskIndex !== -1) {
          overTasks.splice(overTaskIndex, 0, activeTask);
        } else {
          overTasks.push(activeTask);
        }

        return prev.map((col) => {
          if (col.id === activeColumn.id) {
            return { ...col, tasks: activeTasks };
          }
          if (col.id === overColumn.id) {
            return { ...col, tasks: overTasks };
          }
          return col;
        });
      });
    }

    setActiveId(null);
  };

  const findTask = (id: string): Task | null => {
    for (const column of columns) {
      const task = column.tasks.find((t) => t.id === id);
      if (task) return task;
    }
    return null;
  };

  const activeTask = activeId ? findTask(activeId) : null;

  return (
    <div className='h-[calc(100vh-10rem)] bg-gradient-to-br from-background via-background to-[hsl(240,20%,10%)] rounded-2xl p-1 overflow-hidden relative'>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className='h-full overflow-x-auto rounded-xl'>
          <div className='inline-flex h-full gap-5 p-4 pt-6 min-w-full'>
            {columns.map((column) => (
              <Column key={column.id} column={column} tasks={column.tasks} />
            ))}
            <div className='flex-shrink-0 w-[360px]'>
              <button className='btn btn-ghost w-full h-12 flex items-center justify-center gap-2 border-2 border-dashed border-border/50 hover:border-primary hover:bg-primary/5'>
                <Plus className='w-5 h-5' /> Add Column
              </button>
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className='bg-card shadow-2xl rounded-lg p-4 cursor-grabbing w-[360px] ring-2 ring-primary/50 rotate-1 relative overflow-hidden'>
              <div
                className={`absolute top-0 left-0 bottom-0 w-1 ${
                  activeTask.type === 'bug'
                    ? 'bg-red-500/30'
                    : activeTask.type === 'feature'
                    ? 'bg-violet-500/30'
                    : activeTask.type === 'improvement'
                    ? 'bg-blue-500/30'
                    : 'bg-emerald-500/30'
                }`}
              ></div>

              <div className='pl-3'>
                <div className='flex items-start gap-3'>
                  <div
                    className={`w-7 h-7 rounded-lg ${
                      activeTask.type === 'bug'
                        ? 'bg-red-500/10 text-red-400'
                        : activeTask.type === 'feature'
                        ? 'bg-violet-500/10 text-violet-400'
                        : activeTask.type === 'improvement'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-emerald-500/10 text-emerald-400'
                    } flex items-center justify-center flex-shrink-0`}
                  >
                    <TaskTypeIcon type={activeTask.type} />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <h4 className='text-sm font-semibold text-foreground truncate'>
                      {activeTask.title}
                    </h4>
                    {activeTask.assignee && (
                      <div className='flex items-center gap-1 mt-1'>
                        <img
                          src={activeTask.assignee.avatar}
                          alt={activeTask.assignee.name}
                          className='w-4 h-4 rounded-full'
                        />
                        <span className='text-xs text-muted-foreground'>
                          {activeTask.assignee.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
