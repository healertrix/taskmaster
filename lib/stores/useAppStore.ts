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

  // Workspace members cache
  workspaceMembersCache: {
    [workspaceId: string]: {
      workspace: any;
      members: any[];
      settings: any;
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
  addBoardToCache: (workspaceId: string, board: any) => void;
  removeBoardFromCache: (workspaceId: string, boardId: string) => void;
  clearWorkspaceBoardsCache: (workspaceId?: string) => void;

  // Workspace members cache actions
  setWorkspaceMembersCache: (
    workspaceId: string,
    workspace: any,
    members: any[],
    settings: any
  ) => void;
  getWorkspaceMembersCache: (
    workspaceId: string
  ) => { workspace: any; members: any[]; settings: any } | null;
  updateMemberInCache: (
    workspaceId: string,
    memberId: string,
    updates: any
  ) => void;
  addMemberToCache: (workspaceId: string, member: any) => void;
  removeMemberFromCache: (workspaceId: string, memberId: string) => void;
  clearWorkspaceMembersCache: (workspaceId?: string) => void;

  // User preferences actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Preload cache for better performance
  preloadWorkspaceBoards: (
    workspaceId: string,
    fetchFunction: () => Promise<{ workspace: any; boards: any[] }>
  ) => Promise<{ workspace: any; boards: any[] }>;
}

// Default TTL values
const DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes
const WORKSPACE_BOARDS_TTL = 10 * 60 * 1000; // 10 minutes

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        cache: {},
        workspaceBoardsCache: {},
        workspaceMembersCache: {},
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

        addBoardToCache: (workspaceId: string, board: any) => {
          set((state) => {
            const entry = state.workspaceBoardsCache[workspaceId];
            if (!entry) return state;

            // Check if board already exists to avoid duplicates
            const boardExists = entry.boards.some((b) => b.id === board.id);
            if (boardExists) return state;

            const updatedBoards = [board, ...entry.boards];

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

        removeBoardFromCache: (workspaceId: string, boardId: string) => {
          set((state) => {
            const entry = state.workspaceBoardsCache[workspaceId];
            if (!entry) return state;

            const updatedBoards = entry.boards.filter(
              (board) => board.id !== boardId
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

        // Preload cache for better performance
        preloadWorkspaceBoards: async (
          workspaceId: string,
          fetchFunction: () => Promise<{ workspace: any; boards: any[] }>
        ) => {
          try {
            const data = await fetchFunction();
            set((state) => ({
              workspaceBoardsCache: {
                ...state.workspaceBoardsCache,
                [workspaceId]: {
                  workspace: data.workspace,
                  boards: data.boards,
                  timestamp: Date.now(),
                  ttl: WORKSPACE_BOARDS_TTL,
                },
              },
            }));
            return data;
          } catch (error) {
            console.error('Preload failed:', error);
            throw error;
          }
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

        // Workspace members cache actions
        setWorkspaceMembersCache: (
          workspaceId: string,
          workspace: any,
          members: any[],
          settings: any
        ) => {
          set((state) => ({
            workspaceMembersCache: {
              ...state.workspaceMembersCache,
              [workspaceId]: {
                workspace,
                members,
                settings,
                timestamp: Date.now(),
                ttl: WORKSPACE_BOARDS_TTL,
              },
            },
          }));
        },

        getWorkspaceMembersCache: (workspaceId: string) => {
          const state = get();
          const entry = state.workspaceMembersCache[workspaceId];

          if (!entry) return null;

          const isExpired = Date.now() - entry.timestamp > entry.ttl;
          if (isExpired) {
            // Auto-clear expired cache
            get().clearWorkspaceMembersCache(workspaceId);
            return null;
          }

          return {
            workspace: entry.workspace,
            members: entry.members,
            settings: entry.settings,
          };
        },

        updateMemberInCache: (
          workspaceId: string,
          memberId: string,
          updates: any
        ) => {
          set((state) => {
            const entry = state.workspaceMembersCache[workspaceId];
            if (!entry) return state;

            const updatedMembers = entry.members.map((member) =>
              member.id === memberId ? { ...member, ...updates } : member
            );

            return {
              workspaceMembersCache: {
                ...state.workspaceMembersCache,
                [workspaceId]: {
                  ...entry,
                  members: updatedMembers,
                },
              },
            };
          });
        },

        addMemberToCache: (workspaceId: string, member: any) => {
          set((state) => {
            const entry = state.workspaceMembersCache[workspaceId];
            if (!entry) return state;

            // Check if member already exists to avoid duplicates
            const memberExists = entry.members.some((m) => m.id === member.id);
            if (memberExists) return state;

            const updatedMembers = [member, ...entry.members];

            return {
              workspaceMembersCache: {
                ...state.workspaceMembersCache,
                [workspaceId]: {
                  ...entry,
                  members: updatedMembers,
                },
              },
            };
          });
        },

        removeMemberFromCache: (workspaceId: string, memberId: string) => {
          set((state) => {
            const entry = state.workspaceMembersCache[workspaceId];
            if (!entry) return state;

            const updatedMembers = entry.members.filter(
              (member) => member.id !== memberId
            );

            return {
              workspaceMembersCache: {
                ...state.workspaceMembersCache,
                [workspaceId]: {
                  ...entry,
                  members: updatedMembers,
                },
              },
            };
          });
        },

        clearWorkspaceMembersCache: (workspaceId?: string) => {
          set((state) => {
            if (workspaceId) {
              const { [workspaceId]: _, ...rest } = state.workspaceMembersCache;
              return { workspaceMembersCache: rest };
            }
            return { workspaceMembersCache: {} };
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
  getBoardKey: (boardId: string) => `board-${boardId}`,
  getBoardListsKey: (boardId: string) => `board-lists-${boardId}`,
  getWorkspaceBoardsKey: (workspaceId: string) =>
    `workspace-boards-${workspaceId}`,
  getWorkspaceKey: (workspaceId: string) => `workspace-${workspaceId}`,
  getBoardsKey: (workspaceId: string) => `boards-${workspaceId}`,
  getWorkspaceSettingsKey: (workspaceId: string) =>
    `workspace-settings-${workspaceId}`,

  // Card-related cache keys
  getCardCommentsKey: (cardId: string) => `card-comments-${cardId}`,
  getCardActivitiesKey: (cardId: string) => `card-activities-${cardId}`,
  getCardChecklistsKey: (cardId: string) => `card-checklists-${cardId}`,
  getCardAttachmentsKey: (cardId: string) => `card-attachments-${cardId}`,
  getCardMembersKey: (cardId: string) => `card-members-${cardId}`,
  getCardLabelsKey: (cardId: string) => `card-labels-${cardId}`,

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
