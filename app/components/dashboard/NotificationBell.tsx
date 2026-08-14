'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  BellRing,
  AtSign,
  MessageSquare,
  Calendar,
  ArrowRightLeft,
  Users,
  Check,
} from 'lucide-react';
import { useNotificationsStore } from '@/lib/stores/useNotificationsStore';

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

// Where a notification's row/dropdown item links to — card-scoped types go
// to the card, moved_list/etc. go to the board, and workspace_member_added
// (no card, no board) goes to the workspace's boards page instead.
const notificationHref = (n: NotificationItem) => {
  if (n.related_card_id) return `/board/${n.related_board_id}?card=${n.related_card_id}`;
  if (n.related_board_id) return `/board/${n.related_board_id}`;
  if (n.related_workspace_id) return `/boards/${n.related_workspace_id}`;
  return '#';
};

// Polling, not realtime — no realtime infrastructure exists elsewhere in
// this app to hook into, and a 45s interval is frequent enough for a
// notification bell without adding that infrastructure just for this.
// Also drives the opt-in browser-notification popups below — there's no
// push infrastructure (service worker / VAPID) yet, so those only fire
// while a tab is open to poll.
const POLL_INTERVAL_MS = 45_000;

// Dropdown preview count — the full, paginated history lives at
// /notifications.
const DROPDOWN_LIMIT = 5;

const LAST_SEEN_STORAGE_KEY = 'notif_last_seen_at';
// Cap how many OS popups fire from a single poll tick — if a user was
// offline and comes back to 20 new notifications, popping 20 native
// notifications at once would be its own kind of spam.
const MAX_POPUPS_PER_POLL = 5;

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

// Actor avatar with a small type-icon badge pinned to its corner — shows
// both who and what kind of event at a glance, matching the Activity
// feed's avatar-first look instead of the old generic type-only icon.
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
          className='w-7 h-7 rounded-full object-cover'
        />
      ) : (
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold ${AVATAR_COLORS[colorIndex]}`}
        >
          {initialsFor(name)}
        </div>
      )}
      <div
        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ring-2 ring-popover ${
          isMention ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground text-background'
        }`}
      >
        <Icon className='w-2 h-2' />
      </div>
    </div>
  );
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  // Shared, not local — this component is mounted twice (mobile + desktop
  // copies, see DashboardHeader), and the badge count also has to reflect
  // what happens on the /notifications page. See
  // lib/stores/useNotificationsStore.ts.
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const setUnreadCount = useNotificationsStore((s) => s.setUnreadCount);
  const markReadShared = useNotificationsStore((s) => s.markRead);
  const markAllReadShared = useNotificationsStore((s) => s.markAllRead);
  const lastReadEvent = useNotificationsStore((s) => s.lastReadEvent);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement>(null);
  // Guards against firing a popup for a notification already popped in an
  // earlier poll — persisted so a page refresh doesn't re-fire the whole
  // recent history as "new".
  const lastSeenAtRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPermission(Notification.permission);
    const stored = localStorage.getItem(LAST_SEEN_STORAGE_KEY);
    lastSeenAtRef.current = stored ? parseInt(stored, 10) : Date.now();
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      // Unread only — same filter as the /notifications page's Unread tab.
      // Previously this fetched the 5 most recent regardless of read
      // state, so a notification you'd already read (clicked through,
      // auto-marked from being on screen, or hit the checkmark on) just
      // sat there greyed out on every reopen/poll instead of actually
      // going away — reading as "this isn't really being marked read"
      // even though it was. Anything already handled lives in Archive on
      // the full /notifications page now, not here.
      const res = await fetch(
        `/api/notifications?limit=${DROPDOWN_LIMIT}&unread=true`
      );
      if (!res.ok) return;
      const data = await res.json();
      const fresh: NotificationItem[] = data.notifications || [];
      setNotifications(fresh);
      setUnreadCount(data.unreadCount || 0);

      // Opt-in browser popups — only once permission has actually been
      // granted (never auto-prompted, see the toggle button below).
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        const newOnes = fresh
          .filter(
            (n) => !n.is_read && new Date(n.created_at).getTime() > lastSeenAtRef.current
          )
          .slice(0, MAX_POPUPS_PER_POLL);

        newOnes.forEach((n) => {
          const actorName = n.actor?.full_name || 'Someone';
          const popup = new Notification(actorName, {
            body: n.content,
            tag: n.id,
          });
          popup.onclick = () => {
            window.focus();
            window.location.href = notificationHref(n);
            markReadShared([n.id]);
            popup.close();
          };
        });

        if (fresh.length > 0) {
          const latest = Math.max(
            ...fresh.map((n) => new Date(n.created_at).getTime())
          );
          lastSeenAtRef.current = Math.max(lastSeenAtRef.current, latest);
          localStorage.setItem(
            LAST_SEEN_STORAGE_KEY,
            String(lastSeenAtRef.current)
          );
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const requestBrowserPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  // Both delegate to the shared store, which does the actual PATCH and
  // then broadcasts lastReadEvent — the effect below (and the equivalent
  // one in every other mounted view: the other bell copy, the
  // /notifications page) reacts to that to remove the same rows from its
  // own local list. This component doesn't need to know or care whether
  // the read event it's reacting to originated from itself or elsewhere.
  const markRead = (ids: string[]) => markReadShared(ids);
  const markAllRead = () => {
    if (notifications.length === 0) return;
    markAllReadShared();
  };

  // Reacts to a read event from ANY mounted view — including this
  // component's own markRead/markAllRead calls above, which also flow
  // through here rather than updating local state directly, so there's
  // exactly one code path instead of two that could drift apart.
  useEffect(() => {
    if (!lastReadEvent) return;
    setNotifications((prev) =>
      lastReadEvent.ids === 'all'
        ? []
        : prev.filter((n) => !(lastReadEvent.ids as string[]).includes(n.id))
    );
  }, [lastReadEvent]);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      setIsLoading(true);
      fetchNotifications().finally(() => setIsLoading(false));
    }
  };

  return (
    <div className='relative' ref={containerRef}>
      <button
        onClick={handleToggle}
        className='relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
        aria-label='Notifications'
        title='Notifications'
      >
        <Bell className='w-5 h-5' />
        {unreadCount > 0 && (
          <span className='absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center'>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className='absolute top-full right-0 mt-2 w-80 bg-popover text-popover-foreground border border-border rounded-lg shadow-2xl z-[60] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150'>
          <div className='flex items-center justify-between px-3 py-2.5 border-b border-border'>
            <h3 className='text-sm font-semibold'>
              Notifications
              {unreadCount > 0 && (
                <span className='ml-1.5 text-xs font-normal text-muted-foreground'>
                  ({unreadCount} unread)
                </span>
              )}
            </h3>
            <div className='flex items-center gap-2'>
              {permission !== 'granted' && permission !== 'denied' && (
                <button
                  onClick={requestBrowserPermission}
                  title='Enable browser notifications'
                  className='p-1 -m-1 text-muted-foreground hover:text-foreground transition-colors'
                >
                  <BellRing className='w-3.5 h-3.5' />
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className='text-xs text-primary hover:text-primary/80 transition-colors'
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className='max-h-[28rem] overflow-y-auto'>
            {isLoading ? (
              <div className='p-6 text-center text-sm text-muted-foreground'>
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className='p-6 text-center text-sm text-muted-foreground'>
                You&apos;re all caught up.
              </div>
            ) : (
              notifications.map((n) => {
                const isMention = n.type === 'mention';
                const href = notificationHref(n);

                return (
                  <Link
                    key={n.id}
                    href={href}
                    onClick={() => {
                      if (!n.is_read) markRead([n.id]);
                      setIsOpen(false);
                    }}
                    className={`group flex items-start gap-2.5 px-3 py-2.5 border-b border-border/50 last:border-b-0 transition-colors hover:bg-muted/40 ${
                      !n.is_read ? 'bg-primary/5' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    <NotificationAvatar n={n} />
                    <div className='flex-1 min-w-0'>
                      <p className='text-xs font-semibold text-foreground truncate'>
                        {n.actor?.full_name || 'Someone'}
                      </p>
                      <p
                        className={`text-sm ${
                          isMention
                            ? 'text-foreground font-medium'
                            : 'text-foreground'
                        }`}
                      >
                        {n.content}
                      </p>
                      <p className='text-[11px] text-muted-foreground mt-0.5 truncate'>
                        {n.boards?.workspaces?.name && `${n.boards.workspaces.name} · `}
                        {n.boards?.name}
                        {n.boards?.board_number != null &&
                          ` · #${n.boards.board_number}`}
                        {!n.boards && n.workspaces?.name}
                        {' · '}
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <>
                        <div className='w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5' />
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markRead([n.id]);
                          }}
                          title='Mark as read'
                          aria-label='Mark as read'
                          className='opacity-0 group-hover:opacity-100 p-1 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-opacity flex-shrink-0'
                        >
                          <Check className='w-3.5 h-3.5' />
                        </button>
                      </>
                    )}
                  </Link>
                );
              })
            )}
          </div>

          <Link
            href='/notifications'
            onClick={() => setIsOpen(false)}
            className='block px-3 py-2.5 text-center text-xs font-medium text-primary hover:bg-muted/40 border-t border-border transition-colors'
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
