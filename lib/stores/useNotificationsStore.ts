import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface ReadEvent {
  // 'all' means every unread row anywhere should be cleared; otherwise
  // the specific ids that just became read.
  ids: string[] | 'all';
  at: number;
}

interface NotificationsState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  knownReadIds: Set<string>;
  lastReadEvent: ReadEvent | null;

  // The one place any mounted notification view — the bell dropdown
  // (mounted twice, mobile + desktop, same duplication as AIChatWidget;
  // see lib/stores/useAIChatStore.ts's comment on why that needs a shared
  // store too) or the /notifications page — marks something read.
  // Broadcasts lastReadEvent afterward so every OTHER mounted view removes
  // the same rows from its own local list immediately, instead of each
  // one only finding out on its next 45s poll, a tab switch, or a reload.
  markRead: (ids: string[]) => void;
  markAllRead: () => void;
}

export const useNotificationsStore = create<NotificationsState>()(
  devtools((set, get) => ({
    unreadCount: 0,
    setUnreadCount: (count) => set({ unreadCount: count }),
    // Guards against double-decrementing unreadCount when multiple
    // mounted views (or a click + a stale in-flight request) both try to
    // mark the same id read — knownReadIds only ever grows, so a given id
    // decrements the shared count exactly once no matter how many
    // instances ask.
    knownReadIds: new Set<string>(),
    lastReadEvent: null,

    markRead: (ids) => {
      const state = get();
      const newlyRead = ids.filter((id) => !state.knownReadIds.has(id));
      if (newlyRead.length === 0) return;
      set({
        unreadCount: Math.max(0, state.unreadCount - newlyRead.length),
        knownReadIds: new Set([...state.knownReadIds, ...newlyRead]),
        lastReadEvent: { ids, at: Date.now() },
      });
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      }).catch((error) =>
        console.error('Error marking notifications read:', error)
      );
    },

    markAllRead: () => {
      set({ unreadCount: 0, lastReadEvent: { ids: 'all', at: Date.now() } });
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      }).catch((error) =>
        console.error('Error marking all notifications read:', error)
      );
    },
  }))
);
