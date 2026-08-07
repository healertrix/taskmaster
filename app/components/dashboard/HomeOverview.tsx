'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  Clock,
  LayoutGrid,
  Loader2,
} from 'lucide-react';
import { colorForNumber } from '@/utils/idColor';

interface MyTask {
  id: string;
  title: string;
  // Shareable display number (scoped per board) and its board's own
  // number — see the migration in
  // supabase/supabase/migrations/20260807120000_add_scoped_display_numbers.sql.
  number?: number;
  board_number?: number;
  due_date: string | null;
  board_id: string;
  board_name: string;
}

interface MyTasksResponse {
  upcoming: MyTask[];
  overdue: MyTask[];
  completed: MyTask[];
}

type Tab = 'upcoming' | 'overdue' | 'completed';

const formatDue = (dueDate: string | null) => {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export function HomeOverview({
  displayName,
}: {
  displayName: string;
}) {
  const [data, setData] = useState<MyTasksResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');

  useEffect(() => {
    let cancelled = false;

    const fetchMyTasks = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/dashboard/my-tasks');
        const result = await response.json();
        if (!cancelled && response.ok) {
          setData(result);
        }
      } catch (error) {
        console.error('Error fetching my tasks:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchMyTasks();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'completed', label: 'Completed' },
  ];

  const activeTasks = data?.[activeTab] || [];

  // Per-board "due soon" counts (upcoming + overdue), for the Projects panel.
  const dueSoonByBoard = new Map<string, { name: string; count: number }>();
  if (data) {
    for (const task of [...data.upcoming, ...data.overdue]) {
      const entry = dueSoonByBoard.get(task.board_id) || {
        name: task.board_name,
        count: 0,
      };
      entry.count += 1;
      dueSoonByBoard.set(task.board_id, entry);
    }
  }
  const projectSummaries = Array.from(dueSoonByBoard.entries()).map(
    ([boardId, info]) => ({ boardId, ...info })
  );

  return (
    <section className='mb-12'>
      {/* Greeting */}
      <div className='mb-6'>
        <p className='text-sm text-muted-foreground mb-1'>{today}</p>
        <h1 className='text-2xl sm:text-3xl font-bold text-foreground heading-enter'>
          {getGreeting()}, {displayName}
        </h1>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
        {/* My tasks */}
        <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-5'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-base font-semibold text-foreground'>
              My tasks
            </h2>
          </div>

          <div className='flex items-center gap-1 mb-4 border-b border-border/40'>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {data && data[tab.key].length > 0 && (
                  <span className='ml-1.5 text-xs text-muted-foreground'>
                    {data[tab.key].length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className='flex items-center justify-center py-10 text-muted-foreground'>
              <Loader2 className='w-5 h-5 animate-spin' />
            </div>
          ) : activeTasks.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-10 text-center'>
              {activeTab === 'completed' ? (
                <CheckCircle2 className='w-8 h-8 text-muted-foreground/50 mb-3' />
              ) : (
                <Circle className='w-8 h-8 text-muted-foreground/50 mb-3' />
              )}
              <p className='text-sm text-muted-foreground'>
                {activeTab === 'upcoming' &&
                  "No upcoming tasks. You're all caught up."}
                {activeTab === 'overdue' && 'Nothing overdue — nice work.'}
                {activeTab === 'completed' &&
                  'Your completed tasks will appear here.'}
              </p>
            </div>
          ) : (
            <div className='space-y-0.5'>
              {activeTasks.slice(0, 6).map((task) => (
                <Link
                  key={task.id}
                  href={`/board/${task.board_id}?card=${task.id}`}
                  className='flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/30 transition-colors group'
                >
                  {task.number != null && (
                    <span
                      className='w-1.5 h-1.5 rounded-full flex-shrink-0'
                      style={{ backgroundColor: colorForNumber(task.number) }}
                    />
                  )}
                  <span className='flex-1 text-sm text-foreground truncate min-w-0 group-hover:text-primary transition-colors'>
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
                  <span className='text-xs text-muted-foreground truncate max-w-[35%] flex-shrink-0'>
                    {task.board_name}
                  </span>
                  {task.due_date && (
                    <span
                      className={`text-xs flex-shrink-0 ${
                        activeTab === 'overdue'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {formatDue(task.due_date)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Projects */}
        <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-5'>
          <h2 className='text-base font-semibold text-foreground mb-4'>
            Boards with tasks due soon
          </h2>

          {isLoading ? (
            <div className='flex items-center justify-center py-10 text-muted-foreground'>
              <Loader2 className='w-5 h-5 animate-spin' />
            </div>
          ) : projectSummaries.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-10 text-center'>
              <LayoutGrid className='w-8 h-8 text-muted-foreground/50 mb-3' />
              <p className='text-sm text-muted-foreground'>
                No boards with tasks due soon right now.
              </p>
            </div>
          ) : (
            <div className='space-y-1'>
              {projectSummaries.slice(0, 6).map((project) => (
                <Link
                  key={project.boardId}
                  href={`/board/${project.boardId}`}
                  className='flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/30 transition-colors group'
                >
                  <div className='w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0'>
                    <LayoutGrid className='w-4 h-4 text-primary' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors'>
                      {project.name}
                    </div>
                    <div className='text-xs text-muted-foreground flex items-center gap-1'>
                      <Clock className='w-3 h-3' />
                      {project.count} task{project.count === 1 ? '' : 's'} due
                      soon
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
