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

  // Workspace settings cache
  workspaceSettingsCache: {
    [workspaceId: string]: {
      workspace: any;
      settings: any;
      userRole: string;
      timestamp: number;
      ttl: number;
    };
  };

  // Board lists cache - for real-time board data management
  boardListsCache: {
    [boardId: string]: {
      lists: any[];
      timestamp: number;
      ttl: number;
    };
  };

  // Board labels cache - shared across all cards in a board
  boardLabelsCache: {
    [boardId: string]: {
      labels: any[];
      timestamp: number;
      ttl: number;
    };
  };

  // Workspace members cache - shared across all cards in a workspace
  workspaceMembersForBoardCache: {
    [workspaceId: string]: {
      members: any[];
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

  // Workspace settings cache actions
  setWorkspaceSettingsCache: (
    workspaceId: string,
    workspace: any,
    settings: any,
    userRole: string
  ) => void;
  getWorkspaceSettingsCache: (
    workspaceId: string
  ) => { workspace: any; settings: any; userRole: string } | null;
  updateSettingsInCache: (workspaceId: string, settings: any) => void;
  updateWorkspaceInSettingsCache: (workspaceId: string, workspace: any) => void;
  clearWorkspaceSettingsCache: (workspaceId?: string) => void;

  // Board lists cache actions
  setBoardListsCache: (boardId: string, lists: any[]) => void;
  getBoardListsCache: (boardId: string) => any[] | null;
  updateCardInCache: (boardId: string, cardId: string, updates: any) => void;
  updateCardLabelsInCache: (
    boardId: string,
    cardId: string,
    labels: any[]
  ) => void;
  updateCardMembersInCache: (
    boardId: string,
    cardId: string,
    members: any[]
  ) => void;
  addCardToListInCache: (boardId: string, listId: string, card: any) => void;
  removeCardFromCache: (boardId: string, cardId: string) => void;
  clearBoardListsCache: (boardId?: string) => void;

  // Board labels cache actions
  setBoardLabelsCache: (boardId: string, labels: any[]) => void;
  getBoardLabelsCache: (boardId: string) => any[] | null;
  updateBoardLabelInCache: (
    boardId: string,
    labelId: string,
    updates: any
  ) => void;
  addBoardLabelToCache: (boardId: string, label: any) => void;
  removeBoardLabelFromCache: (boardId: string, labelId: string) => void;
  clearBoardLabelsCache: (boardId?: string) => void;

  // Workspace members for board cache actions
  setWorkspaceMembersForBoardCache: (
    workspaceId: string,
    members: any[]
  ) => void;
  getWorkspaceMembersForBoardCache: (workspaceId: string) => any[] | null;
  clearWorkspaceMembersForBoardCache: (workspaceId?: string) => void;

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
        workspaceSettingsCache: {},
        boardListsCache: {},
        boardLabelsCache: {},
        workspaceMembersForBoardCache: {},
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

        // Workspace settings cache actions
        setWorkspaceSettingsCache: (
          workspaceId: string,
          workspace: any,
          settings: any,
          userRole: string
        ) => {
          set((state) => ({
            workspaceSettingsCache: {
              ...state.workspaceSettingsCache,
              [workspaceId]: {
                workspace,
                settings,
                userRole,
                timestamp: Date.now(),
                ttl: WORKSPACE_BOARDS_TTL,
              },
            },
          }));
        },

        getWorkspaceSettingsCache: (workspaceId: string) => {
          const state = get();
          const entry = state.workspaceSettingsCache[workspaceId];

          if (!entry) return null;

          const isExpired = Date.now() - entry.timestamp > entry.ttl;
          if (isExpired) {
            // Auto-clear expired cache
            get().clearWorkspaceSettingsCache(workspaceId);
            return null;
          }

          return {
            workspace: entry.workspace,
            settings: entry.settings,
            userRole: entry.userRole,
          };
        },

        updateSettingsInCache: (workspaceId: string, settings: any) => {
          set((state) => {
            const entry = state.workspaceSettingsCache[workspaceId];
            if (!entry) return state;

            return {
              workspaceSettingsCache: {
                ...state.workspaceSettingsCache,
                [workspaceId]: {
                  ...entry,
                  settings,
                },
              },
            };
          });
        },

        updateWorkspaceInSettingsCache: (
          workspaceId: string,
          workspace: any
        ) => {
          set((state) => {
            const entry = state.workspaceSettingsCache[workspaceId];
            if (!entry) return state;

            return {
              workspaceSettingsCache: {
                ...state.workspaceSettingsCache,
                [workspaceId]: {
                  ...entry,
                  workspace,
                },
              },
            };
          });
        },

        clearWorkspaceSettingsCache: (workspaceId?: string) => {
          set((state) => {
            if (workspaceId) {
              const { [workspaceId]: _, ...rest } =
                state.workspaceSettingsCache;
              return { workspaceSettingsCache: rest };
            }
            return { workspaceSettingsCache: {} };
          });
        },

        // Board lists cache actions
        setBoardListsCache: (boardId: string, lists: any[]) => {
          set((state) => ({
            boardListsCache: {
              ...state.boardListsCache,
              [boardId]: {
                lists,
                timestamp: Date.now(),
                ttl: DEFAULT_TTL,
              },
            },
          }));
        },

        getBoardListsCache: (boardId: string) => {
          const state = get();
          const entry = state.boardListsCache[boardId];

          if (!entry) return null;

          const isExpired = Date.now() - entry.timestamp > entry.ttl;
          if (isExpired) {
            // Auto-clear expired cache
            get().clearBoardListsCache(boardId);
            return null;
          }

          return entry.lists;
        },

        updateCardInCache: (boardId: string, cardId: string, updates: any) => {
          set((state) => {
            const entry = state.boardListsCache[boardId];
            if (!entry) return state;

            const updatedLists = entry.lists.map((list) => ({
              ...list,
              cards: list.cards.map((card: any) =>
                card.id === cardId ? { ...card, ...updates } : card
              ),
            }));

            return {
              boardListsCache: {
                ...state.boardListsCache,
                [boardId]: {
                  ...entry,
                  lists: updatedLists,
                },
              },
            };
          });
        },

        updateCardLabelsInCache: (
          boardId: string,
          cardId: string,
          labels: any[]
        ) => {
          get().updateCardInCache(boardId, cardId, { card_labels: labels });
        },

        updateCardMembersInCache: (
          boardId: string,
          cardId: string,
          members: any[]
        ) => {
          get().updateCardInCache(boardId, cardId, { card_members: members });
        },

        addCardToListInCache: (boardId: string, listId: string, card: any) => {
          set((state) => {
            const entry = state.boardListsCache[boardId];
            if (!entry) return state;

            const updatedLists = entry.lists.map((list) =>
              list.id === listId
                ? { ...list, cards: [...list.cards, card] }
                : list
            );

            return {
              boardListsCache: {
                ...state.boardListsCache,
                [boardId]: {
                  ...entry,
                  lists: updatedLists,
                },
              },
            };
          });
        },

        removeCardFromCache: (boardId: string, cardId: string) => {
          set((state) => {
            const entry = state.boardListsCache[boardId];
            if (!entry) return state;

            const updatedLists = entry.lists.map((list) => ({
              ...list,
              cards: list.cards.filter((card: any) => card.id !== cardId),
            }));

            return {
              boardListsCache: {
                ...state.boardListsCache,
                [boardId]: {
                  ...entry,
                  lists: updatedLists,
                },
              },
            };
          });
        },

        clearBoardListsCache: (boardId?: string) => {
          set((state) => {
            if (boardId) {
              const { [boardId]: _, ...rest } = state.boardListsCache;
              return { boardListsCache: rest };
            }
            return { boardListsCache: {} };
          });
        },

        // Board labels cache actions
        setBoardLabelsCache: (boardId: string, labels: any[]) => {
          set((state) => ({
            boardLabelsCache: {
              ...state.boardLabelsCache,
              [boardId]: {
                labels,
                timestamp: Date.now(),
                ttl: DEFAULT_TTL,
              },
            },
          }));
        },

        getBoardLabelsCache: (boardId: string) => {
          const state = get();
          const entry = state.boardLabelsCache[boardId];

          if (!entry) return null;

          const isExpired = Date.now() - entry.timestamp > entry.ttl;
          if (isExpired) {
            get().clearBoardLabelsCache(boardId);
            return null;
          }

          return entry.labels;
        },

        updateBoardLabelInCache: (
          boardId: string,
          labelId: string,
          updates: any
        ) => {
          set((state) => {
            const entry = state.boardLabelsCache[boardId];
            if (!entry) return state;

            const updatedLabels = entry.labels.map((label) =>
              label.id === labelId ? { ...label, ...updates } : label
            );

            return {
              boardLabelsCache: {
                ...state.boardLabelsCache,
                [boardId]: {
                  ...entry,
                  labels: updatedLabels,
                },
              },
            };
          });
        },

        addBoardLabelToCache: (boardId: string, label: any) => {
          set((state) => {
            const entry = state.boardLabelsCache[boardId];
            if (!entry) return state;

            const labelExists = entry.labels.some((l) => l.id === label.id);
            if (labelExists) return state;

            const updatedLabels = [...entry.labels, label];

            return {
              boardLabelsCache: {
                ...state.boardLabelsCache,
                [boardId]: {
                  ...entry,
                  labels: updatedLabels,
                },
              },
            };
          });
        },

        removeBoardLabelFromCache: (boardId: string, labelId: string) => {
          set((state) => {
            const entry = state.boardLabelsCache[boardId];
            if (!entry) return state;

            const updatedLabels = entry.labels.filter(
              (label) => label.id !== labelId
            );

            return {
              boardLabelsCache: {
                ...state.boardLabelsCache,
                [boardId]: {
                  ...entry,
                  labels: updatedLabels,
                },
              },
            };
          });
        },

        clearBoardLabelsCache: (boardId?: string) => {
          set((state) => {
            if (boardId) {
              const { [boardId]: _, ...rest } = state.boardLabelsCache;
              return { boardLabelsCache: rest };
            }
            return { boardLabelsCache: {} };
          });
        },

        // Workspace members for board cache actions
        setWorkspaceMembersForBoardCache: (
          workspaceId: string,
          members: any[]
        ) => {
          set((state) => ({
            workspaceMembersForBoardCache: {
              ...state.workspaceMembersForBoardCache,
              [workspaceId]: {
                members,
                timestamp: Date.now(),
                ttl: DEFAULT_TTL,
              },
            },
          }));
        },

        getWorkspaceMembersForBoardCache: (workspaceId: string) => {
          const state = get();
          const entry = state.workspaceMembersForBoardCache[workspaceId];

          if (!entry) return null;

          const isExpired = Date.now() - entry.timestamp > entry.ttl;
          if (isExpired) {
            get().clearWorkspaceMembersForBoardCache(workspaceId);
            return null;
          }

          return entry.members;
        },

        clearWorkspaceMembersForBoardCache: (workspaceId?: string) => {
          set((state) => {
            if (workspaceId) {
              const { [workspaceId]: _, ...rest } =
                state.workspaceMembersForBoardCache;
              return { workspaceMembersForBoardCache: rest };
            }
            return { workspaceMembersForBoardCache: {} };
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
  getBoardLabelsKey: (boardId: string) => `board-labels-${boardId}`,
  getWorkspaceMembersForBoardKey: (workspaceId: string) =>
    `workspace-members-board-${workspaceId}`,
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
