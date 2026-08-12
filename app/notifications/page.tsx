'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { DashboardHeader } from '../components/dashboard/header';
import {
  Bell,
  AtSign,
  MessageSquare,
  Calendar,
  ArrowRightLeft,
  Users,
  X,
} from 'lucide-react';
import { useMarkReadOnView } from '@/hooks/useMarkReadOnView';

interface NotificationItem {
  id: string;
  type:
    | 'mention'
    | 'comment'
    | 'due_date_changed'
    | 'moved_list'
    | 'workspace_member_added'
    | string;
  content: string;
  is_read: boolean;
  created_at: string;
  actor_id: string | null;
  related_card_id: string | null;
  related_board_id: string | null;
  related_workspace_id: string | null;
  actor: { full_name: string | null; avatar_url: string | null } | null;
  cards: { title: string; card_number: number | null } | null;
  boards: {
    name: string;
    board_number: number | null;
    workspaces: { name: string } | null;
  } | null;
  workspaces: { name: string } | null;
}

// Where a notification links to — card-scoped types go to the card,
// moved_list/etc. go to the board, and workspace_member_added (no card, no
// board) goes to the workspace's members page instead.
const notificationHref = (n: NotificationItem) => {
  if (n.related_card_id) return `/board/${n.related_board_id}?card=${n.related_card_id}`;
  if (n.related_board_id) return `/board/${n.related_board_id}`;
  if (n.related_workspace_id) return `/workspace/${n.related_workspace_id}/members`;
  return '#';
};

const PAGE_SIZE = 20;

// Unread rows sort above read ones (each group keeps its own created_at-desc
// order — Array.sort is stable) — applied whenever a fresh page comes back
// from the server, not live, so marking something read mid-session doesn't
// make it jump position while the list's still on screen.
const sortByReadState = (list: NotificationItem[]) =>
  [...list].sort((a, b) => Number(a.is_read) - Number(b.is_read));

const TYPE_ICON: Record<string, typeof Bell> = {
  mention: AtSign,
  comment: MessageSquare,
  comment_on_watched_card: MessageSquare,
  due_date_changed: Calendar,
  moved_list: ArrowRightLeft,
  workspace_member_added: Users,
};

const timeAgo = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const initialsFor = (name: string | null) =>
  name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-teal-500',
];

function NotificationAvatar({ n }: { n: NotificationItem }) {
  const Icon = TYPE_ICON[n.type] || Bell;
  const isMention = n.type === 'mention';
  const name = n.actor?.full_name || null;
  const colorIndex = name ? name.charCodeAt(0) % AVATAR_COLORS.length : 0;

  return (
    <div className='relative flex-shrink-0 mt-0.5'>
      {n.actor?.avatar_url ? (
        <img
          src={n.actor.avatar_url}
          alt={name || 'User'}
          className='w-9 h-9 rounded-full object-cover'
        />
      ) : (
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${AVATAR_COLORS[colorIndex]}`}
        >
          {initialsFor(name)}
        </div>
      )}
      <div
        className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-background ${
          isMention ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground text-background'
        }`}
      >
        <Icon className='w-2.5 h-2.5' />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [tab, setTab] = useState<'all' | 'unread' | 'read'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (reset: boolean) => {
    const offset = reset ? 0 : offsetRef.current;
    if (reset) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (tab === 'unread') params.set('unread', 'true');
      else if (tab === 'read') params.set('read', 'true');

      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const fresh: NotificationItem[] = data.notifications || [];

      setNotifications((prev) =>
        sortByReadState(reset ? fresh : [...prev, ...fresh])
      );
      setUnreadCount(data.unreadCount || 0);
      setHasMore(!!data.hasMore);
      offsetRef.current = offset + fresh.length;
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [tab]);

  // Reload from scratch whenever the tab changes.
  useEffect(() => {
    offsetRef.current = 0;
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Infinite scroll — fetch the next page once the sentinel at the bottom
  // of the list enters the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          load(false);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, load]);

  const markRead = async (ids: string[]) => {
    // Only ids that were actually still unread count toward the badge — the
    // click handler and the auto-mark-on-view timer can both target the
    // same row, so this guards against double-decrementing.
    let actuallyUnreadIds: string[] = [];
    setNotifications((prev) => {
      actuallyUnreadIds = ids.filter(
        (id) => prev.find((n) => n.id === id && !n.is_read)
      );
      return prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n));
    });
    if (actuallyUnreadIds.length > 0) {
      setUnreadCount((prev) => Math.max(0, prev - actuallyUnreadIds.length));
    }
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
    } catch (error) {
      console.error('Error marking notification read:', error);
    }
  };

  // Auto-mark-as-read: an unread row that's been visibly on screen for a
  // beat gets marked read even if it's never clicked — see
  // hooks/useMarkReadOnView.ts for why. Only greys it out in place; sort
  // order is only recomputed on the next fetch (see sortByReadState above).
  const registerReadOnViewRef = useMarkReadOnView((id) => markRead([id]));

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
    } catch (error) {
      console.error('Error marking all notifications read:', error);
    }
    if (tab === 'unread') {
      setNotifications((prev) => prev.filter((n) => !unreadIds.includes(n.id)));
    }
  };

  const dismiss = async (id: string) => {
    const wasUnread = notifications.find((n) => n.id === id)?.is_read === false;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  return (
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />

      <main className='container mx-auto max-w-5xl pt-24 pb-16 px-4'>
        <div className='flex items-center justify-between mb-4'>
          <h1 className='text-xl font-semibold text-foreground'>Notifications</h1>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className='text-sm text-primary hover:text-primary/80 transition-colors'
            >
              Mark all read
            </button>
          )}
        </div>

        <div className='flex items-center gap-1 p-1 bg-muted rounded-lg w-fit mb-4'>
          <button
            onClick={() => setTab('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'all'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTab('unread')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'unread'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Unread
            {unreadCount > 0 && ` (${unreadCount})`}
          </button>
          <button
            onClick={() => setTab('read')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'read'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Read
          </button>
        </div>

        <div className='bg-card/75 backdrop-blur-xl border border-border rounded-2xl overflow-hidden'>
          {isLoading ? (
            <div className='p-10 text-center text-sm text-muted-foreground'>
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className='p-10 text-center text-sm text-muted-foreground'>
              {tab === 'unread'
                ? "You're all caught up."
                : tab === 'read'
                ? 'Nothing read yet.'
                : 'No notifications yet.'}
            </div>
          ) : (
            notifications.map((n) => {
              const href = notificationHref(n);

              return (
                <Link
                  key={n.id}
                  ref={n.is_read ? undefined : registerReadOnViewRef(n.id)}
                  href={href}
                  onClick={() => {
                    if (!n.is_read) markRead([n.id]);
                  }}
                  className={`group flex items-start gap-3 px-4 py-3.5 border-b border-border/50 last:border-b-0 transition-colors hover:bg-muted/40 ${
                    !n.is_read ? 'bg-primary/5' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <NotificationAvatar n={n} />
                  <div className='flex-1 min-w-0'>
                    <p className='text-sm font-semibold text-foreground'>
                      {n.actor?.full_name || 'Someone'}
                    </p>
                    <p
                      className={`text-sm ${
                        n.type === 'mention'
                          ? 'text-foreground font-medium'
                          : 'text-foreground'
                      }`}
                    >
                      {n.content}
                    </p>
                    <p className='text-xs text-muted-foreground mt-1'>
                      {n.boards?.workspaces?.name && `${n.boards.workspaces.name} · `}
                      {n.boards?.name}
                      {n.boards?.board_number != null && ` · #${n.boards.board_number}`}
                      {!n.boards && n.workspaces?.name}
                      {' · '}
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div className='w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5' />
                  )}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      dismiss(n.id);
                    }}
                    title='Dismiss'
                    aria-label='Dismiss notification'
                    className='opacity-0 group-hover:opacity-100 p-1 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-opacity flex-shrink-0'
                  >
                    <X className='w-4 h-4' />
                  </button>
                </Link>
              );
            })
          )}

          {hasMore && (
            <div ref={sentinelRef} className='p-4 text-center text-xs text-muted-foreground'>
              {isLoadingMore ? 'Loading more...' : ''}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
