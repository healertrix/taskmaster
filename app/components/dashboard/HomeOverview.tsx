'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, Loader2, Search, X, ArrowRight } from 'lucide-react';
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
  workspace_id?: string;
  workspace_name?: string;
}

interface MyTasksResponse {
  upcoming: MyTask[];
  overdue: MyTask[];
  completed: MyTask[];
}

type Tab = 'upcoming' | 'overdue' | 'completed';

const VISIBLE_COUNT = 6;

// Matches title/board name as substrings, plus the task's own ticket
// number — "34", "#34", "12-34", or "#12-34" all match a task numbered 34
// on board 12 (board_number-number, same format shown next to the title).
const matchesQuery = (t: MyTask, q: string) => {
  if (t.title.toLowerCase().includes(q)) return true;
  if (t.board_name.toLowerCase().includes(q)) return true;
  const ticket =
    t.board_number != null && t.number != null
      ? `${t.board_number}-${t.number}`
      : t.number != null
      ? `${t.number}`
      : '';
  return ticket.length > 0 && ticket.includes(q.replace(/^#/, ''));
};

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

export function HomeOverview({ displayName }: { displayName: string }) {
  const [data, setData] = useState<MyTasksResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

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

  const allActiveTasks = data?.[activeTab] || [];
  const query = search.trim().toLowerCase();
  const activeTasks = useMemo(
    () =>
      query
        ? allActiveTasks.filter((t) => matchesQuery(t, query))
        : allActiveTasks,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allActiveTasks, query]
  );
  const visibleTasks = activeTasks.slice(0, VISIBLE_COUNT);
  const hasMore = activeTasks.length > VISIBLE_COUNT;

  return (
    <section className='mb-12'>
      {/* Greeting */}
      <div className='mb-6'>
        <p className='text-sm text-muted-foreground mb-1'>{today}</p>
        <h1 className='text-2xl sm:text-3xl font-bold text-foreground heading-enter'>
          {getGreeting()}, {displayName}
        </h1>
      </div>

      <div>
        {/* My tasks */}
        <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-5'>
          <div className='flex items-center justify-between mb-4 gap-3'>
            <h2 className='text-base font-semibold text-foreground'>
              My tasks
            </h2>
            {/* Same growing-icon pattern as the notifications search —
                one input, always mounted, animates width/opacity instead
                of swapping elements. */}
            <div className='relative flex items-center h-9 flex-shrink-0'>
              <input
                ref={searchInputRef}
                type='text'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => {
                  if (!search) setSearchOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearch('');
                    setSearchOpen(false);
                    searchInputRef.current?.blur();
                  }
                }}
                placeholder={searchOpen ? 'Search my tasks...' : ''}
                className={`h-9 pl-9 pr-8 text-sm rounded-lg bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-[width,opacity,border-color] duration-300 ease-out ${
                  searchOpen
                    ? 'w-48 sm:w-56 border border-border/50 opacity-100 focus:border-primary/50'
                    : 'w-9 border border-transparent opacity-0'
                }`}
              />
              <button
                onClick={() => setSearchOpen(true)}
                aria-label='Search my tasks'
                tabIndex={searchOpen ? -1 : 0}
                className={`absolute left-0 top-0 w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground transition-colors ${
                  searchOpen
                    ? 'pointer-events-none'
                    : 'hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Search className='w-4 h-4' />
              </button>
              {searchOpen && search && (
                <button
                  onClick={() => {
                    setSearch('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label='Clear search'
                  className='absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded-full transition-colors'
                >
                  <X className='w-3.5 h-3.5' />
                </button>
              )}
            </div>
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
              {query ? (
                <>
                  <Search className='w-8 h-8 text-muted-foreground/50 mb-3' />
                  <p className='text-sm text-muted-foreground'>
                    No tasks match &ldquo;{search}&rdquo;.
                  </p>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          ) : (
            <div className='space-y-0.5'>
              {visibleTasks.map((task) => (
                // Title, board, and due date used to fight for space on
                // one line always — fine on desktop, but on a narrow phone
                // the board link (locked to 35% width) and due date (never
                // shrinking) left almost nothing for the title. Stacks into
                // two lines below sm: instead; sm:contents on the second
                // row's wrapper below removes it from layout at that
                // breakpoint so its children rejoin the single-line flow
                // exactly as before.
                <div
                  key={task.id}
                  className='flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-2 py-2 rounded-lg hover:bg-muted/30 transition-colors'
                >
                  <Link
                    href={`/board/${task.board_id}?card=${task.id}`}
                    className='flex items-center gap-2 min-w-0 group sm:flex-1'
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
                  <div className='flex items-center justify-between gap-2 pl-3.5 sm:pl-0 sm:contents'>
                    <Link
                      href={`/board/${task.board_id}`}
                      className='text-xs text-muted-foreground hover:text-primary transition-colors truncate min-w-0 sm:max-w-[35%] flex-shrink-0'
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
                          activeTab === 'overdue'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {formatDue(task.due_date)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {hasMore && (
                <Link
                  href={`/profile/tasks?status=${activeTab}`}
                  className='flex items-center justify-center gap-1.5 mt-1 px-2 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors'
                >
                  View all {activeTasks.length} {tabs.find((t) => t.key === activeTab)?.label.toLowerCase()} tasks
                  <ArrowRight className='w-3.5 h-3.5' />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
