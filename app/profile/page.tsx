'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { DashboardHeader } from '../components/dashboard/header';
import { useAuth } from '@/context/AuthContext';
import { colorForNumber } from '@/utils/idColor';
import {
  Mail,
  Clock,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  Activity as ActivityIcon,
  MessageSquare,
  Tag,
  Users,
  Paperclip,
  CheckSquare,
  PlusCircle,
  Search,
  X,
} from 'lucide-react';

interface ProfileActivity {
  id: string;
  action_type: string;
  action_data: Record<string, any> | null;
  created_at: string;
  // Team feed — everyone's activity on boards you have access to, not
  // just your own. See app/api/profile/activity/route.ts.
  is_own: boolean;
  actor_name: string;
  actor_avatar_url: string | null;
  card_id: string;
  card_title: string;
  card_number: number | null;
  board_id: string;
  board_name: string;
  board_number: number | null;
  workspace_id: string | null;
  workspace_name: string | null;
}

const ACTIVITY_CATEGORIES: { key: string; label: string }[] = [
  { key: 'comment', label: 'Comments' },
  { key: 'label', label: 'Labels' },
  { key: 'member', label: 'Members' },
  { key: 'attachment', label: 'Attachments' },
  { key: 'checklist', label: 'Checklists' },
  { key: 'dates', label: 'Dates' },
  { key: 'card', label: 'Card' },
];

const ACTIVITY_PAGE_SIZE = 10;

const activityIcon = (actionType: string) => {
  if (actionType.startsWith('comment')) return MessageSquare;
  if (actionType.startsWith('label')) return Tag;
  if (actionType.startsWith('member')) return Users;
  if (actionType.startsWith('attachment')) return Paperclip;
  if (actionType.startsWith('checklist')) return CheckSquare;
  if (actionType === 'card_created') return PlusCircle;
  return ActivityIcon;
};

// Verb phrase only — "who" (you vs. someone else's name) is composed on
// top of this at render time, since it's a team feed, not just your own
// actions.
const ACTIVITY_VERB: Record<string, string> = {
  card_created: 'created',
  card_updated: 'updated',
  comment_added: 'commented on',
  comment_updated: 'edited a comment on',
  comment_deleted: 'deleted a comment on',
  attachment_added: 'added an attachment to',
  attachment_removed: 'removed an attachment from',
  label_added: 'added a label to',
  label_removed: 'removed a label from',
  member_added: 'added a member to',
  member_removed: 'removed a member from',
  due_date_set: 'set a due date on',
  due_date_removed: 'removed the due date on',
  start_date_set: 'set a start date on',
  timeline_updated: 'updated the dates on',
  checklist_added: 'added a checklist to',
  checklist_updated: 'updated a checklist on',
  checklist_removed: 'removed a checklist from',
  card_moved: 'moved',
};

const activityMessage = (activity: ProfileActivity) => {
  const who = activity.is_own ? 'You' : activity.actor_name;
  const verb = ACTIVITY_VERB[activity.action_type] || 'updated';
  return `${who} ${verb}`;
};

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

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

type TasksTab = 'upcoming' | 'overdue' | 'completed';

const formatDue = (dueDate: string | null) => {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// A board mention: name + its own #number + which workspace it's in — used
// wherever a task references a board, so it's never just a bare name.
function BoardTag({
  boardId,
  boardName,
  boardNumber,
  workspaceName,
}: {
  boardId: string;
  boardName: string;
  boardNumber?: number | null;
  workspaceName?: string | null;
}) {
  return (
    <Link
      href={`/board/${boardId}`}
      onClick={(e) => e.stopPropagation()}
      className='text-xs text-muted-foreground hover:text-primary transition-colors truncate max-w-[45%] flex-shrink-0'
      title={workspaceName ? `${boardName} · ${workspaceName}` : boardName}
    >
      {boardName}
      {boardNumber != null && ` #${boardNumber}`}
      {workspaceName && ` · ${workspaceName}`}
    </Link>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();

  const [tasksData, setTasksData] = useState<MyTasksResponse | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [tasksTab, setTasksTab] = useState<TasksTab>('upcoming');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchTasks = async () => {
      setIsLoadingTasks(true);
      try {
        const response = await fetch('/api/dashboard/my-tasks');
        const data = await response.json();
        if (!cancelled && response.ok) {
          setTasksData(data);
        }
      } catch (error) {
        console.error('Error fetching task counts:', error);
      } finally {
        if (!cancelled) setIsLoadingTasks(false);
      }
    };

    fetchTasks();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Activity feed — paginated, searchable, filterable by category.
  const [activities, setActivities] = useState<ProfileActivity[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [isLoadingMoreActivity, setIsLoadingMoreActivity] = useState(false);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityCategory, setActivityCategory] = useState<string | null>(
    null
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchActivity = useCallback(
    async (opts: { offset: number; append: boolean }) => {
      if (opts.append) setIsLoadingMoreActivity(true);
      else setIsLoadingActivity(true);

      try {
        const params = new URLSearchParams({
          limit: String(ACTIVITY_PAGE_SIZE),
          offset: String(opts.offset),
        });
        if (activitySearch.trim()) params.set('search', activitySearch.trim());
        if (activityCategory) params.set('category', activityCategory);

        const response = await fetch(`/api/profile/activity?${params}`);
        const data = await response.json();
        if (response.ok) {
          setActivities((prev) =>
            opts.append ? [...prev, ...(data.activities || [])] : data.activities || []
          );
          setActivityHasMore(!!data.hasMore);
        }
      } catch (error) {
        console.error('Error fetching profile activity:', error);
      } finally {
        setIsLoadingActivity(false);
        setIsLoadingMoreActivity(false);
      }
    },
    [activitySearch, activityCategory]
  );

  // Refetch from the top whenever search or category changes — debounced
  // for search so every keystroke doesn't fire a request.
  useEffect(() => {
    if (!user) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => fetchActivity({ offset: 0, append: false }),
      activitySearch ? 300 : 0
    );
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activitySearch, activityCategory]);

  if (!user) {
    return null; // Let the RouteGuard handle redirection
  }

  const getInitials = () => {
    if (!user.user_metadata?.full_name) return 'U';
    return user.user_metadata.full_name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const stats: {
    label: string;
    status: TasksTab;
    value?: number;
    icon: typeof AlertTriangle;
    accent: string;
    bg: string;
  }[] = [
    {
      label: 'Overdue',
      status: 'overdue',
      value: tasksData?.overdue.length,
      icon: AlertTriangle,
      accent: 'text-destructive',
      bg: 'bg-destructive/10',
    },
    {
      label: 'Upcoming',
      status: 'upcoming',
      value: tasksData?.upcoming.length,
      icon: CalendarClock,
      accent: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Completed',
      status: 'completed',
      value: tasksData?.completed.length,
      icon: CheckCircle2,
      accent: 'text-success',
      bg: 'bg-success/10',
    },
  ];

  const tasksTabs: { key: TasksTab; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'completed', label: 'Completed' },
  ];
  const activeTasks = tasksData?.[tasksTab] || [];

  return (
    <div className='min-h-screen'>
      <DashboardHeader />

      <main className='container mx-auto max-w-5xl px-4 pt-24 pb-16'>
        {/* Identity */}
        <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-6 sm:p-8'>
          <div className='flex flex-col sm:flex-row gap-5 sm:items-center'>
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt='User avatar'
                className='w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover flex-shrink-0'
              />
            ) : (
              <div className='w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary flex items-center justify-center text-xl font-semibold text-primary-foreground flex-shrink-0'>
                {getInitials()}
              </div>
            )}

            <div className='flex-1 min-w-0'>
              <h1 className='text-xl sm:text-2xl font-bold text-foreground heading-enter truncate'>
                {user.user_metadata?.full_name || 'User'}
              </h1>

              <div className='flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-2 text-sm text-muted-foreground'>
                <div className='flex items-center gap-1.5'>
                  <Mail className='w-3.5 h-3.5' />
                  <span className='truncate'>{user.email}</span>
                </div>

                {user.created_at && (
                  <div className='flex items-center gap-1.5'>
                    <Clock className='w-3.5 h-3.5' />
                    <span>Member since {formatDate(user.created_at)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats — each links through to the full list for that status */}
        <div className='grid grid-cols-3 gap-4 mt-6'>
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={`/profile/tasks?status=${stat.status}`}
              className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-4 sm:p-5 hover:border-primary/40 hover:bg-card/85 transition-colors'
            >
              <div
                className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}
              >
                <stat.icon className={`w-4 h-4 ${stat.accent}`} />
              </div>
              <div className='text-2xl font-bold text-foreground'>
                {tasksData ? stat.value : '—'}
              </div>
              <div className='text-xs text-muted-foreground mt-0.5'>
                {stat.label}
              </div>
            </Link>
          ))}
        </div>

        {/* My tasks */}
        <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-5 mt-6'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-base font-semibold text-foreground'>
              My tasks
            </h2>
            <Link
              href={`/profile/tasks?status=${tasksTab}`}
              className='text-xs text-primary hover:text-primary/80 transition-colors'
            >
              View all {tasksTab}
            </Link>
          </div>

          <div className='flex items-center gap-1 mb-4 border-b border-border/40'>
            {tasksTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTasksTab(tab.key)}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tasksTab === tab.key
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {tasksData && tasksData[tab.key].length > 0 && (
                  <span className='ml-1.5 text-xs text-muted-foreground'>
                    {tasksData[tab.key].length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {isLoadingTasks ? (
            <div className='flex items-center justify-center py-10 text-muted-foreground'>
              <Loader2 className='w-5 h-5 animate-spin' />
            </div>
          ) : activeTasks.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-10 text-center'>
              {tasksTab === 'completed' ? (
                <CheckCircle2 className='w-8 h-8 text-muted-foreground/50 mb-3' />
              ) : (
                <Circle className='w-8 h-8 text-muted-foreground/50 mb-3' />
              )}
              <p className='text-sm text-muted-foreground'>
                {tasksTab === 'upcoming' &&
                  "No upcoming tasks. You're all caught up."}
                {tasksTab === 'overdue' && 'Nothing overdue — nice work.'}
                {tasksTab === 'completed' &&
                  'Your completed tasks will appear here.'}
              </p>
            </div>
          ) : (
            <div className='space-y-0.5'>
              {activeTasks.slice(0, 8).map((task) => (
                <div
                  key={task.id}
                  className='flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/30 transition-colors'
                >
                  <Link
                    href={`/board/${task.board_id}?card=${task.id}`}
                    className='flex items-center gap-2 flex-1 min-w-0 group'
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
                  <BoardTag
                    boardId={task.board_id}
                    boardName={task.board_name}
                    boardNumber={task.board_number}
                    workspaceName={task.workspace_name}
                  />
                  {task.due_date && (
                    <span
                      className={`text-xs flex-shrink-0 ${
                        tasksTab === 'overdue'
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

        {/* Activity Section */}
        <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-6 mt-6'>
          {/* Sticky search + filter bar — stays visible while the activity
              list below is scrolled, right under the fixed site header. The
              negative margin + matching padding lets it span edge-to-edge
              within the rounded card so its background doesn't show gaps at
              the corners while scrolled under. */}
          <div className='sticky top-[68px] z-30 -mx-6 px-6 bg-card/95 backdrop-blur-xl pt-1 pb-4 rounded-t-2xl'>
            <div className='flex items-center justify-between flex-wrap gap-3'>
              <h2 className='text-lg font-semibold text-foreground flex items-center gap-2'>
                <ActivityIcon className='w-5 h-5 text-primary' />
                Recent Activity
              </h2>

              <div className='relative w-full sm:w-64'>
                <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground' />
                <input
                  type='text'
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  placeholder='Search card, board, member, or #id...'
                  className='w-full pl-8 pr-7 py-1.5 text-sm bg-muted/40 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all'
                />
                {activitySearch && (
                  <button
                    onClick={() => setActivitySearch('')}
                    className='absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                    aria-label='Clear search'
                  >
                    <X className='w-3.5 h-3.5' />
                  </button>
                )}
              </div>
            </div>

            {/* Category filter pills */}
            <div className='flex items-center gap-1.5 mt-4 flex-wrap'>
              <button
                onClick={() => setActivityCategory(null)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activityCategory === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground border-border/50 hover:border-primary/50'
                }`}
              >
                All
              </button>
              {ACTIVITY_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() =>
                    setActivityCategory((prev) => (prev === cat.key ? null : cat.key))
                  }
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    activityCategory === cat.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'text-muted-foreground border-border/50 hover:border-primary/50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {isLoadingActivity ? (
            <div className='flex items-center justify-center py-12 text-muted-foreground'>
              <Loader2 className='w-5 h-5 animate-spin' />
            </div>
          ) : activities.length === 0 ? (
            <div className='bg-muted/20 rounded-xl p-8 flex flex-col items-center justify-center border border-border/40 text-center'>
              <div className='w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4'>
                <ActivityIcon className='w-7 h-7 text-primary/70' />
              </div>
              <h3 className='text-base font-medium text-foreground mb-1'>
                {activitySearch || activityCategory
                  ? 'No matching activity'
                  : 'No activity yet'}
              </h3>
              <p className='text-sm text-muted-foreground max-w-md'>
                {activitySearch || activityCategory
                  ? 'Try a different search term or filter.'
                  : 'Your recent actions across boards and cards will appear here. Start collaborating to see your activity.'}
              </p>
            </div>
          ) : (
            <>
              <div className='space-y-1'>
                {activities.map((activity) => {
                  const Icon = activityIcon(activity.action_type);
                  return (
                    <div
                      key={activity.id}
                      className='flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/30 transition-colors group'
                    >
                      <div className='relative flex-shrink-0 mt-0.5'>
                        {activity.actor_avatar_url ? (
                          <img
                            src={activity.actor_avatar_url}
                            alt=''
                            className='w-8 h-8 rounded-full object-cover'
                          />
                        ) : (
                          <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary'>
                            {activity.actor_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className='absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-card border border-border flex items-center justify-center'>
                          <Icon className='w-2.5 h-2.5 text-primary' />
                        </div>
                      </div>
                      <div className='flex-1 min-w-0'>
                        <p className='text-sm text-foreground'>
                          {activityMessage(activity)}{' '}
                          <Link
                            href={`/board/${activity.board_id}?card=${activity.card_id}`}
                            className='font-medium hover:text-primary transition-colors'
                          >
                            {activity.card_title}
                            {activity.board_number != null &&
                              activity.card_number != null && (
                                <span className='ml-1 text-xs font-normal text-muted-foreground'>
                                  #{activity.board_number}-{activity.card_number}
                                </span>
                              )}
                          </Link>{' '}
                          <span className='text-muted-foreground'>on</span>{' '}
                          <BoardTag
                            boardId={activity.board_id}
                            boardName={activity.board_name}
                            boardNumber={activity.board_number}
                            workspaceName={activity.workspace_name}
                          />
                        </p>
                        <span className='text-xs text-muted-foreground'>
                          {formatRelativeTime(activity.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {activityHasMore && (
                <div className='flex justify-center mt-4'>
                  <button
                    onClick={() =>
                      fetchActivity({ offset: activities.length, append: true })
                    }
                    disabled={isLoadingMoreActivity}
                    className='px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border/50 rounded-lg hover:bg-muted/30 transition-colors disabled:opacity-50'
                  >
                    {isLoadingMoreActivity ? (
                      <Loader2 className='w-4 h-4 animate-spin' />
                    ) : (
                      'Load more'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
