import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { MentionableItem } from '@/app/components/ai/WorkspaceBoardMentionInput';

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  message_type: 'text' | 'resolve_prompt' | 'confirmation';
  content: string;
  metadata: any;
  resolved_workspace_id: string | null;
  resolved_board_id: string | null;
  created_at: string;
  isLocalError?: boolean;
  isSystemNote?: boolean;
}

export interface AIChatSelected {
  workspaceId?: string;
  boardId?: string;
  workspaceName?: string;
  boardName?: string;
}

export interface SkeletonEdit {
  title: string;
  description: string;
}

interface AIChatState {
  // AIChatWidget is mounted twice inside DashboardHeader (one copy for the
  // mobile action row, one for desktop — CSS shows only one at a time,
  // matching the same pattern NotificationBell/UserProfileMenu use). That's
  // harmless for components whose state is purely local, but every piece
  // of state that affects what's *shown* here has to live in this shared
  // store, not per-instance useState — otherwise the two mounted copies
  // can drift into genuinely different UI for the same underlying
  // messages (one instance's "which section is expanded" not matching the
  // other's), which is exactly what caused the date picker to appear to
  // open twice. Only pure DOM refs and transient fetch-in-flight flags
  // stay local in the component; everything that determines rendered
  // content lives here.
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;

  messages: AIChatMessage[];
  setMessages: (updater: AIChatMessage[] | ((prev: AIChatMessage[]) => AIChatMessage[])) => void;
  historyLoaded: boolean;
  setHistoryLoaded: (loaded: boolean) => void;
  // Whether older messages exist beyond what's currently loaded — history
  // loads one small page (last 5) at a time, older pages fetched as the
  // user scrolls toward the top rather than the whole log up front.
  hasMoreHistory: boolean;
  setHasMoreHistory: (value: boolean) => void;

  selected: AIChatSelected;
  setSelected: (selected: AIChatSelected) => void;

  hasActiveKey: boolean | null;
  setHasActiveKey: (value: boolean | null) => void;

  mentionItems: MentionableItem[];
  setMentionItems: (items: MentionableItem[]) => void;
  mentionItemsLoaded: boolean;
  setMentionItemsLoaded: (loaded: boolean) => void;

  // Compose box text.
  input: string;
  setInput: (value: string) => void;

  // In-flight action flags — drive disabled states / spinners.
  isSending: boolean;
  setIsSending: (value: boolean) => void;
  isCreatingSkeleton: boolean;
  setIsCreatingSkeleton: (value: boolean) => void;
  isDiscarding: boolean;
  setIsDiscarding: (value: boolean) => void;
  confirmingId: string | null;
  setConfirmingId: (id: string | null) => void;

  // Skeleton (task preview) editing.
  editingSkeletonId: string | null;
  setEditingSkeletonId: (id: string | null) => void;
  skeletonEdits: Record<string, SkeletonEdit>;
  setSkeletonEdits: (updater: (prev: Record<string, SkeletonEdit>) => Record<string, SkeletonEdit>) => void;
  dismissedSkeletonIds: Set<string>;
  setDismissedSkeletonIds: (updater: (prev: Set<string>) => Set<string>) => void;

  // Post-creation actions: assign members. expandedAssignId holds the
  // *card* id being expanded (not a message id) — one card has exactly one
  // post_create_actions message in this flow, so keying by card id lets
  // this line up directly with cardMembers/dateDrafts/etc below.
  expandedAssignId: string | null;
  setExpandedAssignId: (value: string | null | ((prev: string | null) => string | null)) => void;
  // Real, server-fetched card members (GET /api/cards/{id}/members) — the
  // source of truth for "who's on this card", refetched after every
  // add/remove. Previously this was a purely optimistic local Set that
  // only tracked what *this session* had clicked, so a member added in an
  // earlier session (or before a page refresh) never showed up as a
  // removable chip — they were genuinely on the card but the UI had no
  // record of it, making them impossible to remove. Keyed by card id.
  cardMembers: Record<string, any[]>;
  setCardMembers: (updater: (prev: Record<string, any[]>) => Record<string, any[]>) => void;
  assigningKey: string | null;
  setAssigningKey: (key: string | null) => void;
  memberError: Record<string, string | null>;
  setMemberError: (updater: (prev: Record<string, string | null>) => Record<string, string | null>) => void;
  completedAssignIds: Set<string>;
  setCompletedAssignIds: (updater: (prev: Set<string>) => Set<string>) => void;
  prefetchedMembers: Record<string, any[]>;
  setPrefetchedMembers: (updater: (prev: Record<string, any[]>) => Record<string, any[]>) => void;

  // Post-creation actions: due date.
  expandedDateCardId: string | null;
  setExpandedDateCardId: (value: string | null | ((prev: string | null) => string | null)) => void;
  dateDrafts: Record<string, string>;
  setDateDrafts: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  dueDatesByCard: Record<string, string | null>;
  setDueDatesByCard: (updater: (prev: Record<string, string | null>) => Record<string, string | null>) => void;
  settingDateKey: string | null;
  setSettingDateKey: (key: string | null) => void;
  dateErrorByCard: Record<string, string | null>;
  setDateErrorByCard: (updater: (prev: Record<string, string | null>) => Record<string, string | null>) => void;

  // Workspace/board pickers.
  openPickerKind: 'workspace' | 'board' | null;
  setOpenPickerKind: (
    value: 'workspace' | 'board' | null | ((prev: 'workspace' | 'board' | null) => 'workspace' | 'board' | null)
  ) => void;
  workspaceSearch: string;
  setWorkspaceSearch: (value: string) => void;
  boardSearch: string;
  setBoardSearch: (value: string) => void;
}

export const useAIChatStore = create<AIChatState>()(
  devtools((set) => ({
    isOpen: false,
    setIsOpen: (open) => set({ isOpen: open }),

    messages: [],
    setMessages: (updater) =>
      set((state) => ({
        messages: typeof updater === 'function' ? (updater as (prev: AIChatMessage[]) => AIChatMessage[])(state.messages) : updater,
      })),
    historyLoaded: false,
    setHistoryLoaded: (loaded) => set({ historyLoaded: loaded }),
    hasMoreHistory: false,
    setHasMoreHistory: (value) => set({ hasMoreHistory: value }),

    selected: {},
    setSelected: (selected) => set({ selected }),

    hasActiveKey: null,
    setHasActiveKey: (value) => set({ hasActiveKey: value }),

    mentionItems: [],
    setMentionItems: (items) => set({ mentionItems: items }),
    mentionItemsLoaded: false,
    setMentionItemsLoaded: (loaded) => set({ mentionItemsLoaded: loaded }),

    input: '',
    setInput: (value) => set({ input: value }),

    isSending: false,
    setIsSending: (value) => set({ isSending: value }),
    isCreatingSkeleton: false,
    setIsCreatingSkeleton: (value) => set({ isCreatingSkeleton: value }),
    isDiscarding: false,
    setIsDiscarding: (value) => set({ isDiscarding: value }),
    confirmingId: null,
    setConfirmingId: (id) => set({ confirmingId: id }),

    editingSkeletonId: null,
    setEditingSkeletonId: (id) => set({ editingSkeletonId: id }),
    skeletonEdits: {},
    setSkeletonEdits: (updater) => set((state) => ({ skeletonEdits: updater(state.skeletonEdits) })),
    dismissedSkeletonIds: new Set(),
    setDismissedSkeletonIds: (updater) => set((state) => ({ dismissedSkeletonIds: updater(state.dismissedSkeletonIds) })),

    expandedAssignId: null,
    setExpandedAssignId: (value) =>
      set((state) => ({
        expandedAssignId: typeof value === 'function' ? value(state.expandedAssignId) : value,
      })),
    cardMembers: {},
    setCardMembers: (updater) => set((state) => ({ cardMembers: updater(state.cardMembers) })),
    assigningKey: null,
    setAssigningKey: (key) => set({ assigningKey: key }),
    memberError: {},
    setMemberError: (updater) => set((state) => ({ memberError: updater(state.memberError) })),
    completedAssignIds: new Set(),
    setCompletedAssignIds: (updater) => set((state) => ({ completedAssignIds: updater(state.completedAssignIds) })),
    prefetchedMembers: {},
    setPrefetchedMembers: (updater) => set((state) => ({ prefetchedMembers: updater(state.prefetchedMembers) })),

    expandedDateCardId: null,
    setExpandedDateCardId: (value) =>
      set((state) => ({
        expandedDateCardId: typeof value === 'function' ? value(state.expandedDateCardId) : value,
      })),
    dateDrafts: {},
    setDateDrafts: (updater) => set((state) => ({ dateDrafts: updater(state.dateDrafts) })),
    dueDatesByCard: {},
    setDueDatesByCard: (updater) => set((state) => ({ dueDatesByCard: updater(state.dueDatesByCard) })),
    settingDateKey: null,
    setSettingDateKey: (key) => set({ settingDateKey: key }),
    dateErrorByCard: {},
    setDateErrorByCard: (updater) => set((state) => ({ dateErrorByCard: updater(state.dateErrorByCard) })),

    openPickerKind: null,
    setOpenPickerKind: (value) =>
      set((state) => ({
        openPickerKind: typeof value === 'function' ? value(state.openPickerKind) : value,
      })),
    workspaceSearch: '',
    setWorkspaceSearch: (value) => set({ workspaceSearch: value }),
    boardSearch: '',
    setBoardSearch: (value) => set({ boardSearch: value }),
  }))
);
