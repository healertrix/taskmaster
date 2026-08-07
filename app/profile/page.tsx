'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardHeader } from '../components/dashboard/header';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/utils/supabase/client';
import {
  Mail,
  Clock,
  Activity as ActivityIcon,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Tag,
  Users,
  Paperclip,
  CheckSquare,
  PlusCircle,
  Loader2,
} from 'lucide-react';

interface ProfileActivity {
  id: string;
  action_type: string;
  action_data: Record<string, any> | null;
  created_at: string;
  card_id: string;
  card_title: string;
  board_id: string;
  board_name: string;
}

interface MyTasksCounts {
  upcoming: number;
  overdue: number;
  completed: number;
}

const activityIcon = (actionType: string) => {
  if (actionType.startsWith('comment')) return MessageSquare;
  if (actionType.startsWith('label')) return Tag;
  if (actionType.startsWith('member')) return Users;
  if (actionType.startsWith('attachment')) return Paperclip;
  if (actionType.startsWith('checklist')) return CheckSquare;
  if (actionType === 'card_created') return PlusCircle;
  return ActivityIcon;
};

const activityMessage = (activity: ProfileActivity) => {
  switch (activity.action_type) {
    case 'card_created':
      return 'You created';
    case 'card_updated':
      return 'You updated';
    case 'comment_added':
      return 'You commented on';
    case 'comment_updated':
      return 'You edited a comment on';
    case 'comment_deleted':
      return 'You deleted a comment on';
    case 'attachment_added':
      return 'You added an attachment to';
    case 'attachment_removed':
      return 'You removed an attachment from';
    case 'label_added':
      return 'You added a label to';
    case 'label_removed':
      return 'You removed a label from';
    case 'member_added':
      return 'You added a member to';
    case 'member_removed':
      return 'You removed a member from';
    case 'due_date_set':
      return 'You set a due date on';
    case 'due_date_removed':
      return 'You removed the due date on';
    case 'start_date_set':
      return 'You set a start date on';
    case 'checklist_added':
      return 'You added a checklist to';
    case 'checklist_updated':
      return 'You updated a checklist on';
    case 'checklist_removed':
      return 'You removed a checklist from';
    default:
      return 'You updated';
  }
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

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [activities, setActivities] = useState<ProfileActivity[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [counts, setCounts] = useState<MyTasksCounts | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchActivity = async () => {
      setIsLoadingActivity(true);
      try {
        const response = await fetch('/api/profile/activity');
        const data = await response.json();
        if (!cancelled && response.ok) {
          setActivities(data.activities || []);
        }
      } catch (error) {
        console.error('Error fetching profile activity:', error);
      } finally {
        if (!cancelled) setIsLoadingActivity(false);
      }
    };

    const fetchCounts = async () => {
      try {
        const response = await fetch('/api/dashboard/my-tasks');
        const data = await response.json();
        if (!cancelled && response.ok) {
          setCounts({
            upcoming: data.upcoming?.length || 0,
            overdue: data.overdue?.length || 0,
            completed: data.completed?.length || 0,
          });
        }
      } catch (error) {
        console.error('Error fetching task counts:', error);
      }
    };

    fetchActivity();
    fetchCounts();
    return () => {
      cancelled = true;
    };
  }, [user]);

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

  const stats = [
    {
      label: 'Overdue',
      value: counts?.overdue,
      icon: AlertTriangle,
      accent: 'text-destructive',
      bg: 'bg-destructive/10',
    },
    {
      label: 'Upcoming',
      value: counts?.upcoming,
      icon: CalendarClock,
      accent: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Completed',
      value: counts?.completed,
      icon: CheckCircle2,
      accent: 'text-success',
      bg: 'bg-success/10',
    },
  ];

  return (
    <div className='min-h-screen'>
      <DashboardHeader />

      <main className='container mx-auto max-w-5xl px-4 pt-24 pb-16'>
        {/* Profile header */}
        <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden'>
          <div className='h-28 sm:h-36 bg-gradient-to-br from-primary/20 via-secondary/15 to-accent/10 relative' />

          <div className='px-6 sm:px-8 pb-8'>
            <div className='flex flex-col sm:flex-row gap-6 sm:items-end'>
              {/* Avatar */}
              <div className='-mt-12 sm:-mt-14 flex-shrink-0'>
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt='User avatar'
                    className='w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-background shadow-xl'
                  />
                ) : (
                  <div className='w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-primary flex items-center justify-center text-2xl font-semibold text-primary-foreground border-4 border-background shadow-xl'>
                    {getInitials()}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className='flex-1 pt-2 sm:pt-0'>
                <h1 className='text-xl sm:text-2xl font-bold text-foreground heading-enter'>
                  {user.user_metadata?.full_name || 'User'}
                </h1>

                <div className='flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-sm text-muted-foreground'>
                  <div className='flex items-center gap-2'>
                    <Mail className='w-4 h-4' />
                    <span>{user.email}</span>
                  </div>

                  {user.created_at && (
                    <div className='flex items-center gap-2'>
                      <Clock className='w-4 h-4' />
                      <span>Member since {formatDate(user.created_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className='grid grid-cols-3 gap-4 mt-6'>
          {stats.map((stat) => (
            <div
              key={stat.label}
              className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-4 sm:p-5'
            >
              <div
                className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}
              >
                <stat.icon className={`w-4 h-4 ${stat.accent}`} />
              </div>
              <div className='text-2xl font-bold text-foreground'>
                {counts ? stat.value : '—'}
              </div>
              <div className='text-xs text-muted-foreground mt-0.5'>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Activity Section */}
        <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl p-6 mt-6'>
          <h2 className='text-lg font-semibold text-foreground flex items-center gap-2 mb-5'>
            <ActivityIcon className='w-5 h-5 text-primary' />
            Recent Activity
          </h2>

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
                No activity yet
              </h3>
              <p className='text-sm text-muted-foreground max-w-md'>
                Your recent actions across boards and cards will appear here.
                Start collaborating to see your activity.
              </p>
            </div>
          ) : (
            <div className='space-y-1'>
              {activities.map((activity) => {
                const Icon = activityIcon(activity.action_type);
                return (
                  <Link
                    key={activity.id}
                    href={`/board/${activity.board_id}?card=${activity.card_id}`}
                    className='flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/30 transition-colors group'
                  >
                    <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5'>
                      <Icon className='w-4 h-4 text-primary' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm text-foreground'>
                        {activityMessage(activity)}{' '}
                        <span className='font-medium group-hover:text-primary transition-colors'>
                          {activity.card_title}
                        </span>{' '}
                        <span className='text-muted-foreground'>
                          on {activity.board_name}
                        </span>
                      </p>
                      <span className='text-xs text-muted-foreground'>
                        {formatRelativeTime(activity.created_at)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
