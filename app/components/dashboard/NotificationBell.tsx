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

// Where a notification's row/dropdown item links to — card-scoped types go
// to the card, moved_list/etc. go to the board, and workspace_member_added
// (no card, no board) goes to the workspace's members page instead.
const notificationHref = (n: NotificationItem) => {
  if (n.related_card_id) return `/board/${n.related_board_id}?card=${n.related_card_id}`;
  if (n.related_board_id) return `/board/${n.related_board_id}`;
  if (n.related_workspace_id) return `/workspace/${n.related_workspace_id}/members`;
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
// /notifications. 8 fits without the dropdown itself needing to scroll on
// typical screen heights.
const DROPDOWN_LIMIT = 8;

// Unread rows sort above read ones (each group keeps its own created_at-desc
// order — Array.sort is stable) — applied whenever a fresh list comes back
// from the server, not live, so marking something read mid-session doesn't
// make it jump position while the dropdown's still open.
const sortByReadState = (list: NotificationItem[]) =>
  [...list].sort((a, b) => Number(a.is_read) - Number(b.is_read));

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
  const [unreadCount, setUnreadCount] = useState(0);
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
      const res = await fetch(`/api/notifications?limit=${DROPDOWN_LIMIT}`);
      if (!res.ok) return;
      const data = await res.json();
      const fresh: NotificationItem[] = sortByReadState(data.notifications || []);
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
            fetch('/api/notifications', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: [n.id] }),
            }).catch(() => {});
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

  const markRead = async (ids: string[]) => {
    // Only ids that were actually still unread count toward the badge — the
    // click handler and the auto-mark-on-view timer can both target the
    // same row (e.g. it auto-read while the user was already clicking it),
    // so this guards against double-decrementing.
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
    if (unreadIds.length === 0) return;
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
  };

  // Dismiss deletes it outright — read or not — as opposed to markRead,
  // which just clears the unread dot and keeps it in the list.
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
                No notifications yet.
              </div>
            ) : (
              notifications.map((n) => {
                const isMention = n.type === 'mention';
                const href = notificationHref(n);

                return (
                  <Link
                    key={n.id}
                    ref={n.is_read ? undefined : registerReadOnViewRef(n.id)}
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
                      <X className='w-3.5 h-3.5' />
                    </button>
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
