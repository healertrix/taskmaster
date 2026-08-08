'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { DashboardHeader } from '../../components/dashboard/header';
import { useAuth } from '@/context/AuthContext';
import { colorForNumber } from '@/utils/idColor';
import {
  ArrowLeft,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Circle,
} from 'lucide-react';

interface MyTask {
  id: string;
  title: string;
  number?: number;
  board_number?: number;
  due_date: string | null;
  board_id: string;
  board_name: string;
  workspace_id?: string;
  workspace_name?: string;
}

interface MyTasksResponse {
  upcoming: MyTask[];
  overdue: MyTask[];
  completed: MyTask[];
}

type Status = 'upcoming' | 'overdue' | 'completed';

const STATUS_CONFIG: Record<
  Status,
  { label: string; icon: typeof AlertTriangle; accent: string; bg: string }
> = {
  overdue: {
    label: 'Overdue',
    icon: AlertTriangle,
    accent: 'text-destructive',
    bg: 'bg-destructive/10',
  },
  upcoming: {
    label: 'Upcoming',
    icon: CalendarClock,
    accent: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    accent: 'text-success',
    bg: 'bg-success/10',
  },
};

const formatDue = (dueDate: string | null) => {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export default function MyTasksByStatusPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const status = (searchParams?.get('status') as Status) || 'upcoming';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;

  const [tasksData, setTasksData] = useState<MyTasksResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    setIsLoading(true);
    fetch('/api/dashboard/my-tasks')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setTasksData(data);
      })
      .catch((error) => console.error('Error fetching my tasks:', error))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  const tasks = tasksData?.[status] || [];
  const Icon = config.icon;

  return (
    <div className='min-h-screen'>
      <DashboardHeader />

      <main className='container mx-auto max-w-3xl px-4 pt-24 pb-16'>
        <Link
          href='/profile'
          className='inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4'
        >
          <ArrowLeft className='w-4 h-4' />
          Back to profile
        </Link>

        <div className='flex items-center gap-3 mb-6'>
          <div
            className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}
          >
            <Icon className={`w-5 h-5 ${config.accent}`} />
          </div>
          <div>
            <h1 className='text-xl font-bold text-foreground heading-enter'>
              {config.label} tasks
            </h1>
            <p className='text-sm text-muted-foreground'>
              {tasksData ? `${tasks.length} task${tasks.length === 1 ? '' : 's'}` : '—'}
            </p>
          </div>
        </div>

        <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-3 sm:p-4'>
          {isLoading ? (
            <div className='flex items-center justify-center py-16 text-muted-foreground'>
              <Loader2 className='w-5 h-5 animate-spin' />
            </div>
          ) : tasks.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-16 text-center'>
              {status === 'completed' ? (
                <CheckCircle2 className='w-9 h-9 text-muted-foreground/50 mb-3' />
              ) : (
                <Circle className='w-9 h-9 text-muted-foreground/50 mb-3' />
              )}
              <p className='text-sm text-muted-foreground'>
                {status === 'upcoming' && "No upcoming tasks. You're all caught up."}
                {status === 'overdue' && 'Nothing overdue — nice work.'}
                {status === 'completed' && 'Nothing completed yet.'}
              </p>
            </div>
          ) : (
            <div className='space-y-0.5'>
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className='flex items-center gap-3 px-2.5 py-2.5 rounded-lg hover:bg-muted/30 transition-colors'
                >
                  <Link
                    href={`/board/${task.board_id}?card=${task.id}`}
                    className='flex items-center gap-2 flex-1 min-w-0 group'
                    title='Open card'
                  >
                    {task.number != null && (
                      <span
                        className='w-1.5 h-1.5 rounded-full flex-shrink-0'
                        style={{ backgroundColor: colorForNumber(task.number) }}
                      />
                    )}
                    <span className='text-sm text-foreground truncate min-w-0 group-hover:text-primary transition-colors'>
                      {task.title}
                      {task.board_number != null && task.number != null && (
                        <span
                          className='ml-1.5 text-xs font-normal text-muted-foreground'
                          title='Card id'
                        >
                          #{task.board_number}-{task.number}
                        </span>
                      )}
                    </span>
                  </Link>
                  <Link
                    href={`/board/${task.board_id}`}
                    className='text-xs text-muted-foreground hover:text-primary transition-colors truncate max-w-[35%] flex-shrink-0'
                    title={
                      task.workspace_name
                        ? `${task.board_name} · ${task.workspace_name}`
                        : task.board_name
                    }
                  >
                    {task.board_name}
                    {task.board_number != null && ` #${task.board_number}`}
                    {task.workspace_name && ` · ${task.workspace_name}`}
                  </Link>
                  {task.due_date && (
                    <span
                      className={`text-xs flex-shrink-0 ${
                        status === 'overdue'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {formatDue(task.due_date)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
