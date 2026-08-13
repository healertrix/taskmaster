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

interface AIChatState {
  // AIChatWidget is mounted inside DashboardHeader, which every page
  // renders its own instance of — so navigating between pages (e.g.
  // clicking a "Created" card link to open it) unmounts and remounts the
  // whole widget. Local component state would reset on every navigation,
  // which is exactly the "opening the card closes the chat" bug. Moving
  // the state that needs to survive that into this module-level store
  // fixes it for free: the store isn't tied to any component's lifecycle.
  //
  // Purely transient UI state (which dropdown is open, in-progress edits,
  // per-message loading flags) stays as local useState in the component —
  // losing that on navigation is fine, only the conversation/context/open
  // state needs to persist.
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;

  messages: AIChatMessage[];
  setMessages: (updater: AIChatMessage[] | ((prev: AIChatMessage[]) => AIChatMessage[])) => void;
  historyLoaded: boolean;
  setHistoryLoaded: (loaded: boolean) => void;

  selected: AIChatSelected;
  setSelected: (selected: AIChatSelected) => void;

  hasActiveKey: boolean | null;
  setHasActiveKey: (value: boolean | null) => void;

  mentionItems: MentionableItem[];
  setMentionItems: (items: MentionableItem[]) => void;
  mentionItemsLoaded: boolean;
  setMentionItemsLoaded: (loaded: boolean) => void;
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

    selected: {},
    setSelected: (selected) => set({ selected }),

    hasActiveKey: null,
    setHasActiveKey: (value) => set({ hasActiveKey: value }),

    mentionItems: [],
    setMentionItems: (items) => set({ mentionItems: items }),
    mentionItemsLoaded: false,
    setMentionItemsLoaded: (loaded) => set({ mentionItemsLoaded: loaded }),
  }))
);
