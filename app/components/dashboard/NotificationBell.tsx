'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, AtSign, MessageSquare, Calendar, ArrowRightLeft, X } from 'lucide-react';

interface NotificationItem {
  id: string;
  type: 'mention' | 'comment' | 'due_date_changed' | 'moved_list' | string;
  content: string;
  is_read: boolean;
  created_at: string;
  related_card_id: string | null;
  related_board_id: string | null;
  cards: { title: string; card_number: number | null } | null;
  boards: { name: string; board_number: number | null } | null;
}

// Polling, not realtime — no realtime infrastructure exists elsewhere in
// this app to hook into, and a 45s interval is frequent enough for a
// notification bell without adding that infrastructure just for this.
const POLL_INTERVAL_MS = 45_000;

const TYPE_ICON: Record<string, typeof Bell> = {
  mention: AtSign,
  comment: MessageSquare,
  comment_on_watched_card: MessageSquare,
  due_date_changed: Calendar,
  moved_list: ArrowRightLeft,
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

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=30');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
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

  const markRead = async (ids: string[]) => {
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - ids.length));
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
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className='text-xs text-primary hover:text-primary/80 transition-colors'
              >
                Mark all read
              </button>
            )}
          </div>

          <div className='max-h-96 overflow-y-auto'>
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
                const Icon = TYPE_ICON[n.type] || Bell;
                const isMention = n.type === 'mention';
                const href = n.related_card_id
                  ? `/board/${n.related_board_id}?card=${n.related_card_id}`
                  : `/board/${n.related_board_id}`;

                return (
                  <Link
                    key={n.id}
                    href={href}
                    onClick={() => {
                      if (!n.is_read) markRead([n.id]);
                      setIsOpen(false);
                    }}
                    className={`group flex items-start gap-2.5 px-3 py-2.5 border-b border-border/50 last:border-b-0 transition-colors hover:bg-muted/40 ${
                      !n.is_read ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isMention
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className='w-3.5 h-3.5' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p
                        className={`text-sm ${
                          isMention
                            ? 'text-foreground font-medium'
                            : 'text-foreground'
                        }`}
                      >
                        {n.content}
                      </p>
                      <p className='text-[11px] text-muted-foreground mt-0.5'>
                        {n.boards?.name}
                        {n.boards?.board_number != null &&
                          ` · #${n.boards.board_number}`}
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
        </div>
      )}
    </div>
  );
}
