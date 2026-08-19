'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardHeader } from '../../components/dashboard/header';
import { useAuth } from '@/context/AuthContext';
import { colorForNumber } from '@/utils/idColor';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { TaskCardRowListSkeleton } from '@/app/components/ui/skeletons';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Circle,
  Search,
  X,
  LayoutGrid,
  Users,
  ChevronDown,
} from 'lucide-react';

interface Assignee {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
}

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
  assignees?: Assignee[];
}

interface MyTasksResponse {
  upcoming: MyTask[];
  overdue: MyTask[];
  completed: MyTask[];
}

interface TeamTasksResponse extends MyTasksResponse {
  hasManagedBoards: boolean;
  members: Assignee[];
}

type Status = 'upcoming' | 'overdue' | 'completed';
type Source = 'my' | 'team';

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

const STATUSES: Status[] = ['upcoming', 'overdue', 'completed'];

// Matches title/board name/ticket number, plus (for Team tasks) any
// assignee's name — same as HomeOverview's widget version.
const matchesQuery = (t: MyTask, q: string) => {
  if (t.title.toLowerCase().includes(q)) return true;
  if (t.board_name.toLowerCase().includes(q)) return true;
  if (t.assignees?.some((a) => a.full_name?.toLowerCase().includes(q))) return true;
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
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export default function MyTasksByStatusPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = (searchParams?.get('status') as Status) || 'upcoming';
  const initialSource = (searchParams?.get('source') as Source) || 'my';

  const [status, setStatus] = useState<Status>(
    STATUSES.includes(initialStatus) ? initialStatus : 'upcoming'
  );
  const [source, setSource] = useState<Source>(
    initialSource === 'team' ? 'team' : 'my'
  );
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [myData, setMyData] = useState<MyTasksResponse | null>(null);
  const [teamData, setTeamData] = useState<TeamTasksResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    setIsLoading(true);
    Promise.all([
      fetch('/api/dashboard/my-tasks').then((res) => res.json()),
      fetch('/api/dashboard/team-tasks').then((res) => res.json()),
    ])
      .then(([myResult, teamResult]) => {
        if (!cancelled) {
          setMyData(myResult);
          setTeamData(teamResult);
        }
      })
      .catch((error) => console.error('Error fetching tasks:', error))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const showTeamToggle = !!teamData?.hasManagedBoards;
  const effectiveSource: Source = showTeamToggle ? source : 'my';
  const tasksData = effectiveSource === 'team' ? teamData : myData;

  // Switching tabs/source updates the URL too (shallow, no reload) — the
  // status/source it opens on can still be shared/bookmarked/linked to
  // (see HomeOverview's "View all" links), it just isn't locked to only
  // that one combination once you're here.
  const selectStatus = (next: Status) => {
    setStatus(next);
    router.replace(
      `/profile/tasks?status=${next}${effectiveSource === 'team' ? '&source=team' : ''}`,
      { scroll: false }
    );
  };

  const selectSource = (next: Source) => {
    setSource(next);
    setMemberFilter(null);
    router.replace(
      `/profile/tasks?status=${status}${next === 'team' ? '&source=team' : ''}`,
      { scroll: false }
    );
  };

  // Real back navigation, not a hardcoded destination — this page is
  // reached from both the homepage widget and from /profile's own "View
  // all" links, so a fixed "Back to profile" link was wrong whenever you
  // actually came from home. history.length > 1 is the standard "is there
  // somewhere to actually go back to" heuristic — it's only ever 1 when
  // this page was opened directly (a bookmark, typed URL, or a fresh tab),
  // where back() would otherwise leave the app entirely.
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const allTasks = tasksData?.[status] || [];
  const memberFiltered = useMemo(
    () =>
      memberFilter
        ? allTasks.filter((t) => t.assignees?.some((a) => a.id === memberFilter))
        : allTasks,
    [allTasks, memberFilter]
  );
  const query = search.trim().toLowerCase();
  const tasks = useMemo(
    () => (query ? memberFiltered.filter((t) => matchesQuery(t, query)) : memberFiltered),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [memberFiltered, query]
  );

  const selectedMember = teamData?.members.find((m) => m.id === memberFilter) || null;

  // Status tab badges (Upcoming/Overdue/Completed counts) — when a member
  // filter is active, these should read as "how many of THIS person's
  // tasks are in each status", not the whole team's, or the tabs would
  // show a count that doesn't match what's actually in the filtered list.
  const countForStatus = (s: Status) => {
    const all = tasksData?.[s] || [];
    if (!memberFilter) return all.length;
    return all.filter((t) => t.assignees?.some((a) => a.id === memberFilter)).length;
  };

  if (!user) return null;

  return (
    <div className='min-h-screen'>
      <DashboardHeader />

      <main className='container mx-auto max-w-4xl px-4 pt-24 pb-16'>
        <button
          onClick={handleBack}
          className='inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6'
        >
          <ArrowLeft className='w-4 h-4' />
          Back
        </button>

        <div className='flex items-center justify-between gap-4 mb-6 flex-wrap'>
          <div className='flex items-center gap-4'>
            <div
              className={`w-12 h-12 rounded-2xl ${config.bg} flex items-center justify-center flex-shrink-0`}
            >
              <Icon className={`w-6 h-6 ${config.accent}`} />
            </div>
            <div>
              <h1 className='text-2xl font-bold text-foreground heading-enter'>
                {effectiveSource === 'team' ? 'Team tasks' : 'My tasks'}
              </h1>
              <p className='text-sm text-muted-foreground'>
                {tasksData
                  ? `${tasks.length} ${config.label.toLowerCase()} task${tasks.length === 1 ? '' : 's'}`
                  : '—'}
              </p>
            </div>
          </div>

          {/* Same growing-icon search as the homepage widget and the
              notifications page — one input, animates open instead of
              swapping elements. */}
          <div className='relative flex items-center h-10 flex-shrink-0'>
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
              placeholder={searchOpen ? 'Search tasks...' : ''}
              className={`h-10 pl-9 pr-8 text-sm rounded-lg bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-[width,opacity,border-color] duration-300 ease-out ${
                searchOpen
                  ? 'w-56 sm:w-64 border border-border/50 opacity-100 focus:border-primary/50'
                  : 'w-10 border border-transparent opacity-0'
              }`}
            />
            <button
              onClick={() => setSearchOpen(true)}
              aria-label='Search tasks'
              tabIndex={searchOpen ? -1 : 0}
              className={`absolute left-0 top-0 w-10 h-10 flex items-center justify-center rounded-lg text-muted-foreground transition-colors ${
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
                className='absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded-full transition-colors'
              >
                <X className='w-3.5 h-3.5' />
              </button>
            )}
          </div>
        </div>

        <div className='flex items-center gap-3 mb-6 flex-wrap'>
          {/* Status tabs — this page used to be locked to whichever status
              you clicked in from, a dead end that sent you all the way back
              to the homepage to check a different one. */}
          <div className='flex items-center gap-1 p-1 bg-muted rounded-lg w-fit'>
            {STATUSES.map((s) => {
              const sConfig = STATUS_CONFIG[s];
              const count = countForStatus(s);
              return (
                <button
                  key={s}
                  onClick={() => selectStatus(s)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md transition-colors ${
                    status === s
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {sConfig.label}
                  {count > 0 && (
                    <span className='text-xs text-muted-foreground'>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {showTeamToggle && (
            <div className='flex items-center gap-1 p-1 bg-muted rounded-lg w-fit'>
              <button
                onClick={() => selectSource('my')}
                className={`px-3.5 py-2 text-sm font-medium rounded-md transition-colors ${
                  effectiveSource === 'my'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                My tasks
              </button>
              <button
                onClick={() => selectSource('team')}
                className={`px-3.5 py-2 text-sm font-medium rounded-md transition-colors ${
                  effectiveSource === 'team'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Team tasks
              </button>
            </div>
          )}

          {/* Member filter — only meaningful on Team tasks, where "who" is
              the whole point (unlike My tasks, always just you). */}
          {effectiveSource === 'team' && teamData && teamData.members.length > 0 && (
            <div className='relative'>
              <button
                onClick={() => setIsMemberDropdownOpen((prev) => !prev)}
                className='flex items-center gap-2 px-3 py-2 text-sm font-medium bg-muted rounded-lg text-foreground hover:bg-muted/70 transition-colors'
              >
                {selectedMember ? (
                  <>
                    <UserAvatar profile={selectedMember} size={18} />
                    {selectedMember.full_name || 'Unknown'}
                  </>
                ) : (
                  <>
                    <Users className='w-4 h-4 text-muted-foreground' />
                    Everyone
                  </>
                )}
                <ChevronDown className='w-3.5 h-3.5 text-muted-foreground' />
              </button>

              {isMemberDropdownOpen && (
                <>
                  <div
                    className='fixed inset-0 z-10'
                    onClick={() => setIsMemberDropdownOpen(false)}
                  />
                  <div className='absolute left-0 mt-1.5 w-56 bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl z-20 p-1 max-h-72 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100'>
                    <button
                      onClick={() => {
                        setMemberFilter(null);
                        setIsMemberDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md text-left transition-colors ${
                        !memberFilter ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
                      }`}
                    >
                      <Users className='w-4 h-4 flex-shrink-0' />
                      Everyone
                    </button>
                    {teamData.members.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => {
                          setMemberFilter(member.id);
                          setIsMemberDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 text-sm rounded-md text-left transition-colors ${
                          memberFilter === member.id
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted/60'
                        }`}
                      >
                        <UserAvatar profile={member} size={18} />
                        <span className='truncate'>{member.full_name || 'Unknown'}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <TaskCardRowListSkeleton count={6} />
        ) : tasks.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-24 text-center bg-card/40 border border-border/50 rounded-2xl'>
            {query ? (
              <>
                <Search className='w-10 h-10 text-muted-foreground/50 mb-4' />
                <p className='text-sm text-muted-foreground'>
                  No tasks match &ldquo;{search}&rdquo;.
                </p>
              </>
            ) : (
              <>
                {status === 'completed' ? (
                  <CheckCircle2 className='w-10 h-10 text-muted-foreground/50 mb-4' />
                ) : (
                  <Circle className='w-10 h-10 text-muted-foreground/50 mb-4' />
                )}
                <p className='text-sm text-muted-foreground'>
                  {status === 'upcoming' && "No upcoming tasks. You're all caught up."}
                  {status === 'overdue' && 'Nothing overdue — nice work.'}
                  {status === 'completed' && 'Nothing completed yet.'}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className='space-y-2.5'>
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/board/${task.board_id}?card=${task.id}`}
                className='group flex items-center gap-4 p-4 bg-card/50 hover:bg-card border border-border/50 hover:border-border rounded-2xl transition-all'
              >
                {task.number != null && (
                  <div
                    className='w-2.5 h-2.5 rounded-full flex-shrink-0'
                    style={{ backgroundColor: colorForNumber(task.number) }}
                  />
                )}

                <div className='flex-1 min-w-0'>
                  <p className='text-base font-medium text-foreground group-hover:text-primary transition-colors truncate'>
                    {task.title}
                  </p>
                  <div className='flex items-center flex-wrap gap-x-2 gap-y-1 mt-1.5'>
                    <span className='inline-flex items-center gap-1 text-xs text-muted-foreground'>
                      <LayoutGrid className='w-3 h-3 flex-shrink-0' />
                      {task.board_name}
                      {task.board_number != null &&
                        task.number != null &&
                        ` #${task.board_number}-${task.number}`}
                    </span>
                    {task.workspace_name && (
                      <span className='text-xs text-muted-foreground'>
                        · {task.workspace_name}
                      </span>
                    )}
                  </div>
                </div>

                {task.assignees && task.assignees.length > 0 && (
                  <div className='flex items-center -space-x-1.5 flex-shrink-0'>
                    {task.assignees.slice(0, 3).map((assignee) => (
                      <div key={assignee.id} title={assignee.full_name || 'Unknown'}>
                        <UserAvatar profile={assignee} size={24} />
                      </div>
                    ))}
                    {task.assignees.length > 3 && (
                      <div
                        className='w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground ring-2 ring-card'
                        title={`+${task.assignees.length - 3} more`}
                      >
                        +{task.assignees.length - 3}
                      </div>
                    )}
                  </div>
                )}

                {task.due_date && (
                  <span
                    className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
                      status === 'overdue'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {formatDue(task.due_date)}
                  </span>
                )}

                <ArrowRight className='w-4 h-4 text-muted-foreground/0 group-hover:text-muted-foreground flex-shrink-0 transition-colors' />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
