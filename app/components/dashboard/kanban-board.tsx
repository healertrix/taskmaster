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
import { Plus, MoreHorizontal } from 'lucide-react';
import { Column } from './kanban/column';
import { SortableTask } from './kanban/sortable-task';
import { Task } from './kanban/types';

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
  const [columns, setColumns] = useState(initialColumns);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
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

    if (!over) return;

    const activeTask = findTask(active.id);
    const overTask = findTask(over.id);

    if (!activeTask) return;

    const activeColumn = columns.find((col) =>
      col.tasks.some((task) => task.id === active.id)
    );
    const overColumn =
      columns.find((col) => col.tasks.some((task) => task.id === over.id)) ||
      columns.find((col) => col.id === over.id);

    if (!activeColumn || !overColumn) return;

    if (activeColumn !== overColumn) {
      setColumns(
        columns.map((col) => {
          if (col.id === activeColumn.id) {
            return {
              ...col,
              tasks: col.tasks.filter((task) => task.id !== active.id),
            };
          }
          if (col.id === overColumn.id) {
            return {
              ...col,
              tasks: [...col.tasks, activeTask],
            };
          }
          return col;
        })
      );
    } else if (overTask) {
      const oldIndex = activeColumn.tasks.findIndex(
        (task) => task.id === active.id
      );
      const newIndex = activeColumn.tasks.findIndex(
        (task) => task.id === over.id
      );

      setColumns(
        columns.map((col) => {
          if (col.id === activeColumn.id) {
            const newTasks = arrayMove(col.tasks, oldIndex, newIndex);
            return {
              ...col,
              tasks: newTasks,
            };
          }
          return col;
        })
      );
    }

    setActiveId(null);
  };

  const findTask = (id: string) => {
    for (const column of columns) {
      const task = column.tasks.find((t) => t.id === id);
      if (task) return task;
    }
    return null;
  };

  return (
    <div className='flex gap-6 p-6 overflow-x-auto'>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className='flex gap-6'>
          {columns.map((column) => (
            <Column key={column.id} column={column} tasks={column.tasks} />
          ))}
        </div>

        <DragOverlay>
          {activeId ? (
            <div className='bg-white dark:bg-gray-900 p-4 rounded-lg shadow-lg'>
              {findTask(activeId)?.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
