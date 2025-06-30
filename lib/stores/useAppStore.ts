import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// Cache interfaces
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheStore {
  [key: string]: CacheEntry<any>;
}

// App store interface
interface AppState {
  // Cache management
  cache: CacheStore;

  // Workspace boards cache
  workspaceBoardsCache: {
    [workspaceId: string]: {
      workspace: any;
      boards: any[];
      timestamp: number;
      ttl: number;
    };
  };

  // User preferences cache
  userPreferences: {
    theme: 'light' | 'dark' | 'system';
    sidebarCollapsed: boolean;
  };

  // Cache actions
  setCache: (key: string, data: any, ttl?: number) => void;
  getCache: <T>(key: string) => T | null;
  clearCache: (key?: string) => void;
  clearExpiredCache: () => void;

  // Workspace boards cache actions
  setWorkspaceBoardsCache: (
    workspaceId: string,
    workspace: any,
    boards: any[]
  ) => void;
  getWorkspaceBoardsCache: (
    workspaceId: string
  ) => { workspace: any; boards: any[] } | null;
  updateBoardInCache: (
    workspaceId: string,
    boardId: string,
    updates: any
  ) => void;
  clearWorkspaceBoardsCache: (workspaceId?: string) => void;

  // User preferences actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

// Default TTL values
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const WORKSPACE_BOARDS_TTL = 2 * 60 * 1000; // 2 minutes

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        cache: {},
        workspaceBoardsCache: {},
        userPreferences: {
          theme: 'system',
          sidebarCollapsed: false,
        },

        // Cache actions
        setCache: (key: string, data: any, ttl = DEFAULT_TTL) => {
          set((state) => ({
            cache: {
              ...state.cache,
              [key]: {
                data,
                timestamp: Date.now(),
                ttl,
              },
            },
          }));
        },

        getCache: <T>(key: string): T | null => {
          const state = get();
          const entry = state.cache[key];

          if (!entry) return null;

          const isExpired = Date.now() - entry.timestamp > entry.ttl;
          if (isExpired) {
            // Auto-clear expired cache
            get().clearCache(key);
            return null;
          }

          return entry.data;
        },

        clearCache: (key?: string) => {
          set((state) => {
            if (key) {
              const { [key]: _, ...rest } = state.cache;
              return { cache: rest };
            }
            return { cache: {} };
          });
        },

        clearExpiredCache: () => {
          set((state) => {
            const now = Date.now();
            const validCache: CacheStore = {};

            Object.entries(state.cache).forEach(([key, entry]) => {
              if (now - entry.timestamp <= entry.ttl) {
                validCache[key] = entry;
              }
            });

            return { cache: validCache };
          });
        },

        // Workspace boards cache actions
        setWorkspaceBoardsCache: (
          workspaceId: string,
          workspace: any,
          boards: any[]
        ) => {
          set((state) => ({
            workspaceBoardsCache: {
              ...state.workspaceBoardsCache,
              [workspaceId]: {
                workspace,
                boards,
                timestamp: Date.now(),
                ttl: WORKSPACE_BOARDS_TTL,
              },
            },
          }));
        },

        getWorkspaceBoardsCache: (workspaceId: string) => {
          const state = get();
          const entry = state.workspaceBoardsCache[workspaceId];

          if (!entry) return null;

          const isExpired = Date.now() - entry.timestamp > entry.ttl;
          if (isExpired) {
            // Auto-clear expired cache
            get().clearWorkspaceBoardsCache(workspaceId);
            return null;
          }

          return {
            workspace: entry.workspace,
            boards: entry.boards,
          };
        },

        updateBoardInCache: (
          workspaceId: string,
          boardId: string,
          updates: any
        ) => {
          set((state) => {
            const entry = state.workspaceBoardsCache[workspaceId];
            if (!entry) return state;

            const updatedBoards = entry.boards.map((board) =>
              board.id === boardId ? { ...board, ...updates } : board
            );

            return {
              workspaceBoardsCache: {
                ...state.workspaceBoardsCache,
                [workspaceId]: {
                  ...entry,
                  boards: updatedBoards,
                },
              },
            };
          });
        },

        clearWorkspaceBoardsCache: (workspaceId?: string) => {
          set((state) => {
            if (workspaceId) {
              const { [workspaceId]: _, ...rest } = state.workspaceBoardsCache;
              return { workspaceBoardsCache: rest };
            }
            return { workspaceBoardsCache: {} };
          });
        },

        // User preferences actions
        setTheme: (theme: 'light' | 'dark' | 'system') => {
          set((state) => ({
            userPreferences: {
              ...state.userPreferences,
              theme,
            },
          }));
        },

        setSidebarCollapsed: (collapsed: boolean) => {
          set((state) => ({
            userPreferences: {
              ...state.userPreferences,
              sidebarCollapsed: collapsed,
            },
          }));
        },
      }),
      {
        name: 'taskmaster-app-store',
        partialize: (state) => ({
          userPreferences: state.userPreferences,
          // Don't persist cache data as it should be fresh on each session
        }),
      }
    ),
    {
      name: 'taskmaster-app-store',
    }
  )
);

// Utility functions for cache management
export const cacheUtils = {
  // Generate cache keys
  getWorkspaceBoardsKey: (workspaceId: string) =>
    `workspace-boards-${workspaceId}`,
  getWorkspaceKey: (workspaceId: string) => `workspace-${workspaceId}`,
  getBoardsKey: (workspaceId: string) => `boards-${workspaceId}`,
  getWorkspaceSettingsKey: (workspaceId: string) =>
    `workspace-settings-${workspaceId}`,

  // Cache validation
  isCacheValid: (timestamp: number, ttl: number) => {
    return Date.now() - timestamp <= ttl;
  },

  // Batch cache operations
  batchSetCache: (entries: Array<{ key: string; data: any; ttl?: number }>) => {
    const store = useAppStore.getState();
    entries.forEach(({ key, data, ttl }) => {
      store.setCache(key, data, ttl);
    });
  },

  // Cache cleanup
  cleanupExpiredCache: () => {
    const store = useAppStore.getState();
    store.clearExpiredCache();
  },
};
