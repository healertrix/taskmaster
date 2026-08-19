'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, Search, X, ArrowRight, Users } from 'lucide-react';
import { colorForNumber } from '@/utils/idColor';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { TaskRowListSkeleton } from '@/app/components/ui/skeletons';

// Same grid template for the header row and every task row below it — one
// source of truth, so "Task / Board / Assignees / Due" always sits
// directly above the data it labels instead of two hand-tuned layouts
// drifting apart (see the /workspaces list view and ListView.tsx's task
// rows for the same pattern elsewhere in the app).
//
// Two variants, not one grid with an always-present-but-sometimes-empty
// Assignees column: My tasks is implicitly always you, so a column of
// your own repeated avatar (or an empty slot when the field isn't even
// populated) is pure noise there — it only earns its place on Team tasks,
// where who's assigned is the actual point.
const MY_TASK_ROW_GRID_COLS = 'sm:grid-cols-[1fr_9rem_3.75rem]';
const TEAM_TASK_ROW_GRID_COLS = 'sm:grid-cols-[1fr_9rem_4.5rem_3.75rem]';

interface Assignee {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
}

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
  // Only present on Team tasks rows — see TeamTasksResponse.
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

type Tab = 'upcoming' | 'overdue' | 'completed';
type Source = 'my' | 'team';

const VISIBLE_COUNT = 6;

// Matches title/board name/ticket number, same as before, plus (for Team
// tasks) any assignee's name — letting you type a teammate's name to
// filter the list down to their work without needing the dedicated
// member-filter dropdown that only exists on the full /profile/tasks page.
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
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

export function HomeOverview({ displayName }: { displayName: string }) {
  const [myData, setMyData] = useState<MyTasksResponse | null>(null);
  const [teamData, setTeamData] = useState<TeamTasksResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<Source>('my');
  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    let cancelled = false;

    const fetchTasks = async () => {
      setIsLoading(true);
      try {
        // Both fetched up front, not just whichever tab is active — Team
        // tasks' hasManagedBoards has to be known before the toggle itself
        // can be shown/hidden, and fetching both now means switching the
        // toggle afterward is instant instead of triggering a fresh
        // loading spinner.
        const [myResponse, teamResponse] = await Promise.all([
          fetch('/api/dashboard/my-tasks'),
          fetch('/api/dashboard/team-tasks'),
        ]);
        const [myResult, teamResult] = await Promise.all([
          myResponse.json(),
          teamResponse.json(),
        ]);
        if (!cancelled) {
          if (myResponse.ok) setMyData(myResult);
          if (teamResponse.ok) setTeamData(teamResult);
        }
      } catch (error) {
        console.error('Error fetching tasks:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchTasks();
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

  const showTeamToggle = !!teamData?.hasManagedBoards;
  // A pure member's teamData resolves to hasManagedBoards: false — never
  // strand them on a "Team tasks" view that's about to disappear once
  // that's known.
  const effectiveSource: Source = showTeamToggle ? source : 'my';
  const data = effectiveSource === 'team' ? teamData : myData;

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
        {/* My tasks / Team tasks */}
        <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-5'>
          <div className='flex items-center justify-between mb-4 gap-3'>
            {showTeamToggle ? (
              <div className='flex items-center gap-1 p-1 bg-muted rounded-lg'>
                <button
                  onClick={() => setSource('my')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    effectiveSource === 'my'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  My tasks
                </button>
                <button
                  onClick={() => setSource('team')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    effectiveSource === 'team'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Team tasks
                </button>
              </div>
            ) : (
              <h2 className='text-base font-semibold text-foreground'>My tasks</h2>
            )}
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
                placeholder={searchOpen ? 'Search tasks...' : ''}
                className={`h-9 pl-9 pr-8 text-sm rounded-lg bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-[width,opacity,border-color] duration-300 ease-out ${
                  searchOpen
                    ? 'w-48 sm:w-56 border border-border/50 opacity-100 focus:border-primary/50'
                    : 'w-9 border border-transparent opacity-0'
                }`}
              />
              <button
                onClick={() => setSearchOpen(true)}
                aria-label='Search tasks'
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

          {/* Column headings — hidden below sm along with the grid itself,
              so "Task / Board / [Assignees /] Due" always sits directly
              above what it labels. Shown during loading too, since the
              skeleton below already has the same grid shape. */}
          {(isLoading || activeTasks.length > 0) && (
            <div
              className={`hidden sm:grid ${
                effectiveSource === 'team' ? TEAM_TASK_ROW_GRID_COLS : MY_TASK_ROW_GRID_COLS
              } gap-3 px-2 pb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide`}
            >
              <div>Task</div>
              <div>Board</div>
              {effectiveSource === 'team' && <div className='text-center'>Assignees</div>}
              <div className='text-right'>Due</div>
            </div>
          )}

          {isLoading ? (
            <TaskRowListSkeleton count={4} showAssignees={effectiveSource === 'team'} />
          ) : activeTasks.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-10 text-center'>
              {query ? (
                <>
                  <Search className='w-8 h-8 text-muted-foreground/50 mb-3' />
                  <p className='text-sm text-muted-foreground'>
                    No tasks match &ldquo;{search}&rdquo;.
                  </p>
                </>
              ) : effectiveSource === 'team' ? (
                <>
                  <Users className='w-8 h-8 text-muted-foreground/50 mb-3' />
                  <p className='text-sm text-muted-foreground'>
                    {activeTab === 'upcoming' &&
                      "No upcoming tasks assigned to your team right now."}
                    {activeTab === 'overdue' && 'Nothing overdue on your team — nice work.'}
                    {activeTab === 'completed' &&
                      "Your team's completed tasks will appear here."}
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
                // Fixed-width columns at sm+ instead of flex/max-w-%
                // guesses — title/board/assignees/due-date used to fight
                // for space on one flex line, and adding assignee avatars
                // for Team tasks made that worse (title got squeezed out).
                // sm:contents on the two wrapper divs below promotes their
                // children up into direct grid items, so board/assignees/
                // date land in their own fixed track instead of getting
                // packed into one shared cell. Below sm: (no room for 4
                // real columns on a phone) the wrappers stay real flex
                // rows instead, giving the same two-line stack as before.
                <div
                  key={task.id}
                  className={`flex flex-col sm:grid ${
                    effectiveSource === 'team' ? TEAM_TASK_ROW_GRID_COLS : MY_TASK_ROW_GRID_COLS
                  } sm:items-center gap-1 sm:gap-3 px-2 py-2 rounded-lg hover:bg-muted/30 transition-colors`}
                >
                  <Link
                    href={`/board/${task.board_id}?card=${task.id}`}
                    className='flex items-center gap-2 min-w-0 group'
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
                    {/* Board and workspace are two different things, not
                        one string with a middot — cramming them together
                        meant a long board name could push the workspace
                        name out of the truncation entirely. Each gets its
                        own line and truncates independently instead. */}
                    <div className='min-w-0 flex-shrink-0'>
                      <Link
                        href={`/board/${task.board_id}`}
                        className='block text-xs text-muted-foreground hover:text-primary transition-colors truncate'
                        title={task.board_name}
                      >
                        {task.board_name}
                        {task.board_number != null && ` #${task.board_number}`}
                      </Link>
                      {task.workspace_name && (
                        <p className='hidden sm:block text-[11px] text-muted-foreground/60 truncate' title={task.workspace_name}>
                          {task.workspace_name}
                        </p>
                      )}
                    </div>
                    <div className='flex items-center gap-2 flex-shrink-0 sm:contents'>
                      {/* Assignees column only exists at all on Team tasks
                          — on My tasks it's not just empty, it's not
                          rendered, so the grid only has 3 columns there
                          (see MY_TASK_ROW_GRID_COLS) instead of a pointless
                          reserved slot for a field My tasks never sets. */}
                      {effectiveSource === 'team' && (
                        <div className='flex items-center -space-x-1.5 sm:w-full sm:justify-center'>
                          {task.assignees?.slice(0, 3).map((assignee) => (
                            <div key={assignee.id} title={assignee.full_name || 'Unknown'}>
                              <UserAvatar profile={assignee} size={20} />
                            </div>
                          ))}
                          {task.assignees && task.assignees.length > 3 && (
                            <div
                              className='w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground ring-2 ring-card'
                              title={`+${task.assignees.length - 3} more`}
                            >
                              +{task.assignees.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                      <div className='text-xs flex-shrink-0 sm:text-right'>
                        {task.due_date && (
                          <span
                            className={
                              activeTab === 'overdue' ? 'text-destructive' : 'text-muted-foreground'
                            }
                          >
                            {formatDue(task.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Always available, not just once you're past VISIBLE_COUNT —
              the full page also carries filtering (the Team tasks member
              dropdown in particular) that's only there, not in this
              compact widget, so it's worth a way in even with just a
              couple of tasks. */}
          <Link
            href={`/profile/tasks?status=${activeTab}${
              effectiveSource === 'team' ? '&source=team' : ''
            }`}
            className='flex items-center justify-center gap-1.5 mt-3 px-2 py-2.5 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors'
          >
            {hasMore
              ? `View all ${activeTasks.length} ${tabs.find((t) => t.key === activeTab)?.label.toLowerCase()} tasks`
              : 'Open full view'}
            <ArrowRight className='w-3.5 h-3.5' />
          </Link>
        </div>
      </div>
    </section>
  );
}
