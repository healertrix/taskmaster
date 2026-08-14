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
  Check,
  Search,
  X,
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

// Where a notification links to — card-scoped types go to the card,
// moved_list/etc. go to the board, and workspace_member_added (no card, no
// board) goes to the workspace's boards page instead.
const notificationHref = (n: NotificationItem) => {
  if (n.related_card_id) return `/board/${n.related_board_id}?card=${n.related_card_id}`;
  if (n.related_board_id) return `/board/${n.related_board_id}`;
  if (n.related_workspace_id) return `/boards/${n.related_workspace_id}`;
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

// Debounce the search box so every keystroke doesn't fire its own request.
const SEARCH_DEBOUNCE_MS = 350;

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
  // Two states only — Unread (the default/main view) and Archive
  // (everything already read, permanent). No "All" — dismissing used to
  // mean "hide everywhere" and made things vanish; now dismissing IS
  // marking read, so Unread and Archive between them already cover
  // everything without a third, redundant combined view.
  const [tab, setTab] = useState<'unread' | 'read'>('unread');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState(''); // debounced
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  // Shared with the bell dropdown (both mounted copies) — see
  // lib/stores/useNotificationsStore.ts. Marking something read from the
  // dropdown while this page is open needs to show up here immediately,
  // not just on the next fetch.
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const setUnreadCount = useNotificationsStore((s) => s.setUnreadCount);
  const markReadShared = useNotificationsStore((s) => s.markRead);
  const markAllReadShared = useNotificationsStore((s) => s.markAllRead);
  const lastReadEvent = useNotificationsStore((s) => s.lastReadEvent);
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
      params.set(tab === 'unread' ? 'unread' : 'read', 'true');
      if (search) params.set('q', search);

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
  }, [tab, search]);

  // Debounce the search box into `search`, which is what load() actually
  // reads — keystrokes update searchInput instantly (so the field itself
  // never lags), the request only fires SEARCH_DEBOUNCE_MS after typing
  // stops.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Focus the box the instant it expands from icon to input.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Reload from scratch whenever the tab or search changes.
  useEffect(() => {
    offsetRef.current = 0;
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search]);

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

  // Both delegate to the shared store, which does the actual PATCH and
  // broadcasts lastReadEvent — the effect below (and the equivalent one
  // in both mounted bell-dropdown copies) reacts to that to remove the
  // same rows from its own local list, regardless of which view the
  // action started in. See lib/stores/useNotificationsStore.ts.
  const markRead = (ids: string[]) => markReadShared(ids);
  const markAllRead = () => {
    if (notifications.filter((n) => !n.is_read).length === 0) return;
    markAllReadShared();
  };

  // Reacts to a read event from ANY mounted view, including this page's
  // own markRead/markAllRead calls above. On the Unread tab a now-read row
  // no longer belongs here, so it's removed outright rather than left
  // sitting there greyed out. On Archive nothing was ever unread to match,
  // so this is a no-op there — it'll show up next time Archive is fetched
  // (switching to it, or the next reload), not injected live mid-scroll.
  useEffect(() => {
    if (!lastReadEvent) return;
    setNotifications((prev) =>
      lastReadEvent.ids === 'all'
        ? tab === 'unread'
          ? []
          : prev
        : prev.filter((n) => !(lastReadEvent.ids as string[]).includes(n.id))
    );
  }, [lastReadEvent, tab]);

  return (
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />

      <main className='container mx-auto max-w-5xl pt-24 pb-16 px-4'>
        <div className='flex items-center justify-between mb-4 gap-3'>
          <h1 className='text-xl font-semibold text-foreground'>Notifications</h1>
          <div className='flex items-center gap-3'>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className='text-sm text-primary hover:text-primary/80 transition-colors whitespace-nowrap'
              >
                Mark all read
              </button>
            )}
            {/* One element growing into an input, not two elements
                swapping — the icon button stays mounted the whole time
                (just becomes visually decorative and click-through once
                expanded) and the input's own width/opacity/border
                transition together, so this reads as the icon *becoming*
                a search box instead of popping between two states. */}
            <div className='relative flex items-center h-9'>
              <input
                ref={searchInputRef}
                type='text'
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => {
                  if (!searchInput) setSearchOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchInput('');
                    setSearchOpen(false);
                    searchInputRef.current?.blur();
                  }
                }}
                placeholder={searchOpen ? 'Search notifications...' : ''}
                className={`h-9 pl-9 pr-8 text-sm rounded-lg bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-[width,opacity,border-color] duration-300 ease-out ${
                  searchOpen
                    ? 'w-56 border border-border/50 opacity-100 focus:border-primary/50'
                    : 'w-9 border border-transparent opacity-0'
                }`}
              />
              <button
                onClick={() => setSearchOpen(true)}
                aria-label='Search notifications'
                tabIndex={searchOpen ? -1 : 0}
                className={`absolute left-0 top-0 w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground transition-colors ${
                  searchOpen
                    ? 'pointer-events-none'
                    : 'hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Search className='w-4 h-4' />
              </button>
              {searchOpen && searchInput && (
                <button
                  onClick={() => {
                    setSearchInput('');
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
        </div>

        <div className='flex items-center gap-1 p-1 bg-muted rounded-lg w-fit mb-4'>
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
            Archive
          </button>
        </div>

        <div className='bg-card/75 backdrop-blur-xl border border-border rounded-2xl overflow-hidden'>
          {isLoading ? (
            <div className='p-10 text-center text-sm text-muted-foreground'>
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className='p-10 text-center text-sm text-muted-foreground'>
              {search
                ? 'No notifications match your search.'
                : tab === 'unread'
                ? "You're all caught up."
                : 'Nothing archived yet.'}
            </div>
          ) : (
            notifications.map((n) => {
              const href = notificationHref(n);

              return (
                <Link
                  key={n.id}
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
                    <>
                      <div className='w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5' />
                      {/* Same action as clicking through — just without
                          leaving this page. Archive has no equivalent
                          button: everything there is already read, so
                          there'd be nothing for it to do. */}
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
                        <Check className='w-4 h-4' />
                      </button>
                    </>
                  )}
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
