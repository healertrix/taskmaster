'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Layers,
  Trello,
  RotateCcw,
  Search,
  Star,
  Check,
  Pencil,
  Trash2,
  UserPlus,
  CheckCircle2,
  ArrowUpRight,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { createClient } from '@/utils/supabase/client';
import { useAIChatStore, type AIChatMessage as ChatMessage } from '@/lib/stores/useAIChatStore';
import { parseDueDate } from '@/utils/parseDueDate';
import {
  WorkspaceBoardMentionInput,
  type MentionableItem,
} from './WorkspaceBoardMentionInput';

const REQUEST_TIMEOUT_MS = 25_000;

// Every fetch in this widget goes through here so a slow/hung network call
// (or a hung LLM call on the server) always resolves within
// REQUEST_TIMEOUT_MS instead of leaving a spinner running forever.
async function fetchJson(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed with ${res.status}`);
    return data;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Timed out — the request took too long. Try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function localErrorMessage(content: string): ChatMessage {
  return {
    id: `local-error-${Date.now()}`,
    role: 'assistant',
    message_type: 'text',
    content,
    metadata: null,
    resolved_workspace_id: null,
    resolved_board_id: null,
    created_at: new Date().toISOString(),
    isLocalError: true,
  };
}

// A quick, local-only confirmation the moment a board is picked — makes
// switching context feel alive instead of a silent UI-only change. Not
// persisted (it's not real conversation content), just client feedback.
function boardSwitchMessage(boardName: string): ChatMessage {
  return {
    id: `local-board-${Date.now()}`,
    role: 'assistant',
    message_type: 'text',
    content: `🎯 Locked onto "${boardName}" — everything from here creates a task there.`,
    metadata: null,
    resolved_workspace_id: null,
    resolved_board_id: null,
    created_at: new Date().toISOString(),
    isSystemNote: true,
  };
}

// Lives in the header (app/components/dashboard/header.tsx), between
// NotificationBell and UserProfileMenu.
//
// Flow: every message just accumulates as context in the current "draft"
// (see utils/ai/chatDraft.ts) — no per-message LLM call. When ready, the
// user clicks "Create task", which synthesizes one task from the whole
// draft and shows it as an editable skeleton for Approve/Edit/Cancel.
// Approving creates the card, resets the draft, and offers to assign
// members right there. "Discard" abandons the draft without creating
// anything.
export function AIChatWidget() {
  const { user } = useAuth();
  const pathname = usePathname();
  const params = useParams();

  const isBoardPage = pathname?.startsWith('/board/');
  const isWorkspacePage = pathname?.startsWith('/boards/');
  const pageBoardId = isBoardPage ? (params?.id as string) : undefined;
  const pageWorkspaceId = isWorkspacePage ? (params?.id as string) : undefined;

  // isOpen/messages/selected/mentionItems/hasActiveKey live in a shared
  // store, not local state — this widget is mounted inside DashboardHeader,
  // which every page renders its own instance of, so a page navigation
  // (e.g. clicking a "Created" card link to open it) unmounts and remounts
  // the whole widget. Local state would silently reset — which is exactly
  // the "opening the card closes the chat" bug. The store isn't tied to
  // any component's lifecycle, so it survives that remount for free.
  const {
    isOpen,
    setIsOpen,
    messages,
    setMessages,
    historyLoaded,
    setHistoryLoaded,
    selected,
    setSelected,
    hasActiveKey,
    setHasActiveKey,
    mentionItems,
    setMentionItems,
    mentionItemsLoaded,
    setMentionItemsLoaded,
  } = useAIChatStore();

  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCreatingSkeleton, setIsCreatingSkeleton] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Due dates: which card's date picker is expanded, any free-text phrase
  // being typed ("30 days from now"), the last known date per card (so the
  // pill and the post-creation actions block agree), and a loading flag.
  const [expandedDateCardId, setExpandedDateCardId] = useState<string | null>(null);
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});
  const [dueDatesByCard, setDueDatesByCard] = useState<Record<string, string | null>>({});
  const [settingDateKey, setSettingDateKey] = useState<string | null>(null);
  const [dateErrorByCard, setDateErrorByCard] = useState<Record<string, string | null>>({});

  // Skeleton approval: which one is being edited, and its (possibly
  // edited) values — keyed by message id so re-opening an old skeleton
  // after scrolling back still shows the right draft.
  const [editingSkeletonId, setEditingSkeletonId] = useState<string | null>(null);
  const [skeletonEdits, setSkeletonEdits] = useState<
    Record<string, { title: string; description: string; dueDate: string | null; startDate: string | null }>
  >({});
  // Cancel is client-only — dismisses the buttons on that skeleton without
  // touching the server; the underlying draft messages stay intact so
  // "Create task" can be clicked again to regenerate.
  const [dismissedSkeletonIds, setDismissedSkeletonIds] = useState<Set<string>>(new Set());

  // Assigning members happens inline in the chat, not a modal — an earlier
  // version reused the board's CardMemberPicker modal here, but its
  // internal effect keys off an `onClose` callback identity
  // ([isOpen, onClose] deps); passing an inline arrow function meant that
  // effect (which calls window.history.pushState) re-ran on every re-render
  // of this widget, hammering browser history and freezing/crashing the
  // tab. An inline list has no modal, no portal, no history manipulation —
  // that whole class of bug can't happen here.
  const [expandedAssignId, setExpandedAssignId] = useState<string | null>(null);
  const [addedMemberIds, setAddedMemberIds] = useState<Record<string, Set<string>>>({});
  const [assigningKey, setAssigningKey] = useState<string | null>(null);
  const [completedAssignIds, setCompletedAssignIds] = useState<Set<string>>(new Set());
  // Fetched in the background the moment a task is created (while the user
  // is still reading the confirmation), so expanding "Add member" a few
  // seconds later shows the list instantly instead of waiting on a fetch.
  const [prefetchedMembers, setPrefetchedMembers] = useState<Record<string, any[]>>({});

  const prefetchMembers = useCallback(
    (workspaceId: string, boardId: string) => {
      if (!workspaceId || prefetchedMembers[workspaceId]) return;
      fetch(`/api/workspaces/${workspaceId}/available-members?board_id=${boardId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.members) {
            setPrefetchedMembers((prev) => ({ ...prev, [workspaceId]: data.members }));
          }
        })
        .catch((err) => console.error('Error prefetching members:', err));
    },
    [prefetchedMembers]
  );

  const addMemberToCard = async (messageId: string, cardId: string, profileId: string) => {
    const key = `${messageId}-${profileId}`;
    setAssigningKey(key);
    try {
      const res = await fetch(`/api/cards/${cardId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId }),
      });
      if (!res.ok) throw new Error('Failed to add member');
      setAddedMemberIds((prev) => {
        const next = new Set(prev[messageId] || []);
        next.add(profileId);
        return { ...prev, [messageId]: next };
      });
    } catch (err) {
      console.error('Error assigning member:', err);
    } finally {
      setAssigningKey(null);
    }
  };

  // Workspace and board pickers — independent, each with its own search.
  const [openPickerKind, setOpenPickerKind] = useState<'workspace' | 'board' | null>(null);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [boardSearch, setBoardSearch] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);

  // Disabling a focused textarea (e.g. while `disabled={isSending}`) makes
  // the browser force-blur it, and that focus never comes back on its own
  // — every send/create/discard/etc previously kicked the cursor out of
  // the compose box. Restore it once whichever action finishes.
  const refocusCompose = () => {
    requestAnimationFrame(() => composeRef.current?.focus());
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      // DashboardHeader renders two instances of this widget — one for the
      // mobile row, one for desktop — both mounted at once, CSS-hidden
      // depending on viewport (offsetParent is null while hidden). That
      // was harmless back when isOpen was local per-instance state; now
      // that it's shared globally (so navigation doesn't reset it — see
      // useAIChatStore), the *hidden* instance's own listener would see
      // every click as "outside its container" (since the click never
      // happens inside an invisible node) and immediately close the
      // shared state. Only the actually-visible instance should ever act.
      if (containerRef.current.offsetParent === null) return;
      // composedPath() (not .contains()) — picking a workspace/board from
      // the @mention dropdown removes that dropdown from the DOM in the
      // same tick this event is still bubbling toward document. .contains()
      // re-queries the *current* tree when this handler finally runs, so a
      // node that's already been removed by that re-render reads as "not
      // contained" even though the click plainly landed inside the panel.
      // composedPath() is the path the event actually traveled at the
      // moment it fired, captured before any of that — reliable regardless
      // of what's since been unmounted.
      const path = event.composedPath ? event.composedPath() : [];
      if (path.includes(containerRef.current)) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll to the bottom whenever new content lands — new messages,
  // the panel opening, or the typing/creating indicator appearing.
  // requestAnimationFrame (not a plain sync read) because scrollHeight
  // read immediately on commit can still lag one frame behind the actual
  // painted layout, especially right after a taller skeleton card or the
  // board picker's search box collapses.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, isOpen, isSending, isCreatingSkeleton]);

  const loadHistory = useCallback(() => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    fetchJson('/api/ai/chat')
      .then((data) => {
        setMessages(data.messages || []);
        setHistoryLoaded(true);
      })
      .catch((err) => {
        console.error('Error loading AI chat history:', err);
        setHistoryError(err.message || "Couldn't load your chat history.");
      })
      .finally(() => setIsLoadingHistory(false));
  }, [setMessages, setHistoryLoaded]);

  const loadKeyState = useCallback(() => {
    fetchJson('/api/ai/keys')
      .then((data) => setHasActiveKey((data.keys || []).some((k: any) => k.isActive)))
      .catch((err) => console.error('Error loading AI key state:', err));
  }, []);

  // Flattened workspace + board options for @mentions and the pickers —
  // fetched lazily on first open. Workspaces come from /api/workspaces;
  // boards (with starred/last-activity, for the quick-pick ordering) are
  // queried directly via Supabase (RLS-scoped) — the same recipe
  // app/page.tsx / useWorkspaceBoardsForHome use, there's no combined API.
  const loadMentionItems = useCallback(async () => {
    if (!user) return;
    try {
      const wsData = await fetchJson('/api/workspaces');
      const workspaces: { id: string; name: string }[] = wsData.workspaces || [];

      const items: MentionableItem[] = workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        kind: 'workspace',
      }));

      if (workspaces.length > 0) {
        const supabase = createClient();
        const workspaceIds = workspaces.map((w) => w.id);
        const [{ data: boards, error }, { data: stars }] = await Promise.all([
          supabase
            .from('boards')
            .select('id, name, number, workspace_id, last_activity_at')
            .in('workspace_id', workspaceIds),
          supabase.from('board_stars').select('board_id').eq('profile_id', user.id),
        ]);

        if (error) {
          console.error('Error loading boards for mentions:', error);
        } else {
          const workspaceNameById = new Map(workspaces.map((w) => [w.id, w.name]));
          const starredIds = new Set((stars || []).map((s) => s.board_id));
          (boards || []).forEach((b) => {
            items.push({
              id: b.id,
              name: b.name,
              kind: 'board',
              number: b.number ?? undefined,
              workspaceId: b.workspace_id,
              workspaceName: workspaceNameById.get(b.workspace_id),
              starred: starredIds.has(b.id),
              lastActivityAt: b.last_activity_at ?? undefined,
            });
          });
        }
      }

      setMentionItems(items);
      setMentionItemsLoaded(true);
    } catch (err) {
      console.error('Error loading mention items:', err);
    }
  }, [user, setMentionItems, setMentionItemsLoaded]);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      // Already loaded (e.g. this is a remount after navigating, not a
      // fresh session) — don't refetch, the store already has it.
      if (!historyLoaded) loadHistory();
      if (!mentionItemsLoaded) loadMentionItems();
      loadKeyState();
    } else {
      setOpenPickerKind(null);
    }
  };

  // Context: an explicit pick wins outright, then the current page's
  // board/workspace, then the most recently resolved board in the loaded
  // history (so reopening the widget resumes where you left off).
  const effectiveContext = useMemo(() => {
    if (selected.workspaceId || selected.boardId) {
      return {
        workspaceId: selected.workspaceId,
        workspaceName: selected.workspaceName,
        boardId: selected.boardId,
        boardName: selected.boardName,
      };
    }
    if (pageBoardId) {
      const item = mentionItems.find((i) => i.kind === 'board' && i.id === pageBoardId);
      return {
        workspaceId: item?.workspaceId,
        workspaceName: item?.workspaceName,
        boardId: item?.id,
        boardName: item?.name,
      };
    }
    if (pageWorkspaceId) {
      const item = mentionItems.find((i) => i.kind === 'workspace' && i.id === pageWorkspaceId);
      return { workspaceId: item?.id, workspaceName: item?.name, boardId: undefined, boardName: undefined };
    }
    const lastResolved = [...messages].reverse().find((m) => m.resolved_board_id);
    if (lastResolved) {
      const item = mentionItems.find((i) => i.kind === 'board' && i.id === lastResolved.resolved_board_id);
      return {
        workspaceId: item?.workspaceId,
        workspaceName: item?.workspaceName,
        boardId: item?.id,
        boardName: item?.name,
      };
    }
    return { workspaceId: undefined, workspaceName: undefined, boardId: undefined, boardName: undefined };
  }, [selected, pageBoardId, pageWorkspaceId, mentionItems, messages]);

  const selectWorkspace = (item: MentionableItem) => {
    // Deliberately drops any board — it belonged to the old workspace.
    setSelected({ workspaceId: item.id, workspaceName: item.name });
    setOpenPickerKind(null);
    setWorkspaceSearch('');
  };

  const selectBoard = (item: MentionableItem) => {
    setSelected({
      workspaceId: item.workspaceId || effectiveContext.workspaceId,
      workspaceName: item.workspaceName || effectiveContext.workspaceName,
      boardId: item.id,
      boardName: item.name,
    });
    setOpenPickerKind(null);
    setBoardSearch('');
    setMessages((prev) => [...prev, boardSwitchMessage(item.name)]);
  };

  // Picking one of the inline "which board?" suggestions in the chat
  // itself — same effect as picking from the dropdown, just one click
  // from where the question was actually asked.
  const pickSuggestedBoard = (b: { id: string; name: string; workspace_id: string; workspace_name: string }) => {
    setSelected({ workspaceId: b.workspace_id, workspaceName: b.workspace_name, boardId: b.id, boardName: b.name });
    setMessages((prev) => [...prev, boardSwitchMessage(b.name)]);
  };

  const workspaceResults = useMemo(() => {
    const q = workspaceSearch.trim().toLowerCase();
    return mentionItems.filter((i) => i.kind === 'workspace' && (!q || i.name.toLowerCase().includes(q)));
  }, [mentionItems, workspaceSearch]);

  // Empty search = quick pick: starred first, then most recently active —
  // so the common case (pick the board you were just on) is one click,
  // not a search. Typing narrows to a normal name/#key match.
  const boardResults = useMemo(() => {
    const q = boardSearch.trim().toLowerCase();
    const scope = effectiveContext.workspaceId;
    const boards = mentionItems.filter((i) => {
      if (i.kind !== 'board') return false;
      if (scope && i.workspaceId !== scope) return false;
      return true;
    });

    if (!q) {
      return [...boards]
        .sort((a, b) => {
          if (!!b.starred !== !!a.starred) return (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
          const at = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
          const bt = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
          return bt - at;
        })
        .slice(0, 8);
    }

    return boards.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.number != null && String(i.number) === q.replace(/^#/, ''))
    );
  }, [mentionItems, boardSearch, effectiveContext.workspaceId]);

  // How many messages belong to the current draft — mirrors the server's
  // boundary logic (utils/ai/chatDraft.ts): everything after the most
  // recent confirmation, draft_reset, or post_create_actions. Drives
  // whether "Create task" / "Discard" are shown at all.
  const draftMessageCount = useMemo(() => {
    let count = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      const kind = m.metadata?.kind;
      if (m.message_type === 'confirmation' || kind === 'draft_reset' || kind === 'post_create_actions') break;
      count++;
    }
    return count;
  }, [messages]);

  const sendMessage = async () => {
    const content = input;
    if (!content.trim() || isSending) return;
    setInput('');
    setIsSending(true);
    try {
      const data = await fetchJson('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          content,
          workspaceId: effectiveContext.workspaceId,
          boardId: effectiveContext.boardId,
        }),
      });
      setMessages((prev) => [...prev, ...(data.messages || [])]);
    } catch (err: any) {
      console.error('Error sending AI chat message:', err);
      setMessages((prev) => [...prev, localErrorMessage(err.message || 'Something went wrong. Try again.')]);
    } finally {
      setIsSending(false);
      refocusCompose();
    }
  };

  const createSkeleton = async () => {
    if (!effectiveContext.boardId || draftMessageCount === 0 || isCreatingSkeleton) return;
    setIsCreatingSkeleton(true);
    try {
      const data = await fetchJson('/api/ai/chat/skeleton', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: effectiveContext.workspaceId,
          boardId: effectiveContext.boardId,
          workspaceName: effectiveContext.workspaceName,
          boardName: effectiveContext.boardName,
        }),
      });
      setMessages((prev) => [...prev, ...(data.messages || [])]);
    } catch (err: any) {
      console.error('Error creating task skeleton:', err);
      setMessages((prev) => [...prev, localErrorMessage(err.message || 'Something went wrong. Try again.')]);
    } finally {
      setIsCreatingSkeleton(false);
      refocusCompose();
    }
  };

  const discardDraft = async () => {
    if (draftMessageCount === 0 || isDiscarding) return;
    setIsDiscarding(true);
    try {
      const data = await fetchJson('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discard' }),
      });
      setMessages((prev) => [...prev, ...(data.messages || [])]);
    } catch (err: any) {
      console.error('Error discarding draft:', err);
      setMessages((prev) => [...prev, localErrorMessage(err.message || 'Something went wrong. Try again.')]);
    } finally {
      setIsDiscarding(false);
      refocusCompose();
    }
  };

  // "Done" on the assign step — explicit, visible signal that this task is
  // fully wrapped up and the next message starts a clean context, instead
  // of silently hoping the user notices. messageId is marked complete
  // locally right away so its buttons disappear immediately.
  const completeAssign = async (messageId: string) => {
    setCompletedAssignIds((prev) => new Set(prev).add(messageId));
    try {
      const data = await fetchJson('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
      setMessages((prev) => [...prev, ...(data.messages || [])]);
    } catch (err: any) {
      console.error('Error completing task:', err);
      setMessages((prev) => [...prev, localErrorMessage(err.message || 'Something went wrong. Try again.')]);
    } finally {
      refocusCompose();
    }
  };

  const approveSkeleton = async (m: ChatMessage) => {
    const edit = skeletonEdits[m.id];
    const title = edit?.title ?? m.metadata?.title;
    const description = edit?.description ?? m.metadata?.description;
    const dueDate = edit?.dueDate ?? m.metadata?.due_date ?? null;
    const startDate = edit?.startDate ?? null;
    if (!title?.trim()) return;

    setConfirmingId(m.id);
    try {
      const data = await fetchJson('/api/ai/chat/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          dueDate,
          startDate,
          boardId: m.metadata.board_id,
          workspaceId: m.metadata.workspace_id,
          listId: m.metadata.list_id,
        }),
      });
      setMessages((prev) => [...prev, ...(data.messages || [])]);
      setEditingSkeletonId(null);
      if (m.metadata.workspace_id) {
        prefetchMembers(m.metadata.workspace_id, m.metadata.board_id);
      }
    } catch (err: any) {
      console.error('Error confirming task:', err);
      setMessages((prev) => [...prev, localErrorMessage(err.message || 'Something went wrong. Try again.')]);
    } finally {
      setConfirmingId(null);
      refocusCompose();
    }
  };

  // Quick-pick due date options, computed fresh each render — cheap, and
  // "today" needs to actually be today.
  const dueDateQuickOptions = () => {
    const mk = (daysFromNow: number) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + daysFromNow);
      return d.toISOString();
    };
    return [
      { label: 'Today', iso: mk(0) },
      { label: 'Tomorrow', iso: mk(1) },
      { label: 'In 3 days', iso: mk(3) },
      { label: 'In 1 week', iso: mk(7) },
      { label: 'In 30 days', iso: mk(30) },
    ];
  };

  const formatDueDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  // Sets/changes a due date on an already-created card — used by both the
  // confirmation pill's calendar icon and the post-creation actions block,
  // keyed by card id so both stay in sync.
  const applyDueDate = async (cardId: string, iso: string) => {
    setSettingDateKey(cardId);
    setDateErrorByCard((prev) => ({ ...prev, [cardId]: null }));
    try {
      // /api/cards/[id] only exports PUT, not PATCH — this was the actual
      // cause of "Failed to save the date": every call 405'd.
      const res = await fetch(`/api/cards/${cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ due_date: iso }),
      });
      if (!res.ok) throw new Error('Failed to save the date — try again.');
      setDueDatesByCard((prev) => ({ ...prev, [cardId]: iso }));
      setExpandedDateCardId(null);
    } catch (err: any) {
      console.error('Error setting due date:', err);
      setDateErrorByCard((prev) => ({ ...prev, [cardId]: err.message || 'Failed to save the date.' }));
    } finally {
      setSettingDateKey(null);
    }
  };

  // Free-text natural-language date, submitted via the Set button or Enter
  // — parsing happens client-side first (fast, no network) so the common
  // phrasings resolve instantly; if that fails, fall back to asking the AI
  // to interpret it before giving up and showing an error.
  const submitDateDraft = async (cardId: string) => {
    const draft = dateDrafts[cardId]?.trim();
    if (!draft) return;

    const iso = parseDueDate(draft);
    if (iso) {
      applyDueDate(cardId, iso);
      return;
    }

    setSettingDateKey(cardId);
    setDateErrorByCard((prev) => ({ ...prev, [cardId]: null }));
    try {
      const data = await fetchJson('/api/ai/parse-date', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase: draft }),
      });
      await applyDueDate(cardId, data.date);
    } catch (err: any) {
      console.error('Error resolving date via AI:', err);
      setDateErrorByCard((prev) => ({
        ...prev,
        [cardId]: err.message || `Couldn't understand "${draft}" — try "30 days from now" or "6th oct".`,
      }));
      setSettingDateKey(null);
    }
  };

  const renderDueDatePicker = (cardId: string) => (
    <div className='mt-2 space-y-2 bg-background/60 border border-border/60 rounded-lg p-2'>
      <div className='flex flex-wrap gap-1.5'>
        {dueDateQuickOptions().map((opt) => (
          <button
            key={opt.label}
            disabled={settingDateKey === cardId}
            onClick={() => applyDueDate(cardId, opt.iso)}
            className='text-xs font-medium px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50'
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className='flex items-center gap-1.5'>
        <input
          type='date'
          disabled={settingDateKey === cardId}
          onChange={(e) => e.target.value && applyDueDate(cardId, new Date(e.target.value).toISOString())}
          className='text-xs bg-background border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:border-primary'
        />
        <span className='text-[10px] text-muted-foreground flex-shrink-0'>or type it</span>
        <input
          value={dateDrafts[cardId] || ''}
          disabled={settingDateKey === cardId}
          onChange={(e) => {
            setDateDrafts((prev) => ({ ...prev, [cardId]: e.target.value }));
            setDateErrorByCard((prev) => ({ ...prev, [cardId]: null }));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitDateDraft(cardId);
          }}
          placeholder='"30 days from now", "6th oct"...'
          className='flex-1 min-w-0 text-xs bg-background border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:border-primary placeholder:text-muted-foreground'
        />
        <button
          onClick={() => submitDateDraft(cardId)}
          disabled={settingDateKey === cardId || !dateDrafts[cardId]?.trim()}
          className='text-xs font-medium px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 flex-shrink-0'
        >
          Set
        </button>
        {settingDateKey === cardId && <Loader2 className='w-3.5 h-3.5 animate-spin text-muted-foreground flex-shrink-0' />}
      </div>
      {dateErrorByCard[cardId] && (
        <p className='text-[11px] text-destructive'>{dateErrorByCard[cardId]}</p>
      )}
    </div>
  );

  if (!user) return null;

  return (
    <div ref={containerRef} className='relative'>
      <button
        onClick={handleToggle}
        className='relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
        aria-label='AI task chat'
        title='Create a task with AI'
      >
        <Sparkles className='w-5 h-5' />
      </button>

      {isOpen && (
        <div className='absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] sm:w-[28rem] md:w-[36rem] h-[80vh] max-h-[48rem] flex flex-col bg-popover text-popover-foreground border border-border rounded-2xl shadow-2xl overflow-hidden z-[60] animate-in fade-in-0 zoom-in-95 duration-150'>
          <div className='flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0'>
            <h3 className='text-sm font-semibold flex items-center gap-2'>
              <Sparkles className='w-4 h-4 text-primary' />
              Create a task with AI
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className='p-1 -m-1 text-muted-foreground hover:text-foreground transition-colors'
              aria-label='Close'
            >
              <X className='w-4 h-4' />
            </button>
          </div>

          {/* Workspace and board — two independent pickers */}
          <div className='flex items-center gap-2 px-4 py-2.5 border-b border-border/60 flex-shrink-0'>
            <div className='relative flex-1 min-w-0'>
              <button
                onClick={() => setOpenPickerKind((k) => (k === 'workspace' ? null : 'workspace'))}
                className='w-full flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/60 rounded-lg px-3 py-2 transition-colors truncate'
              >
                <Layers className='w-3.5 h-3.5 flex-shrink-0' />
                <span className='truncate'>{effectiveContext.workspaceName || 'Select workspace'}</span>
              </button>

              {openPickerKind === 'workspace' && (
                <div className='absolute left-0 right-0 mt-1.5 bg-popover border border-border rounded-lg shadow-2xl z-10 overflow-hidden'>
                  <div className='flex items-center gap-2 px-2.5 py-2 border-b border-border/60'>
                    <Search className='w-3.5 h-3.5 text-muted-foreground flex-shrink-0' />
                    <input
                      autoFocus
                      value={workspaceSearch}
                      onChange={(e) => setWorkspaceSearch(e.target.value)}
                      placeholder='Search workspaces...'
                      className='flex-1 min-w-0 text-xs bg-transparent focus:outline-none placeholder:text-muted-foreground'
                    />
                  </div>
                  <div className='max-h-52 overflow-y-auto py-1'>
                    {workspaceResults.length === 0 ? (
                      <p className='px-3 py-3 text-xs text-muted-foreground text-center'>No workspaces match.</p>
                    ) : (
                      workspaceResults.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => selectWorkspace(item)}
                          className='w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted/50 transition-colors'
                        >
                          <Layers className='w-3.5 h-3.5 text-muted-foreground flex-shrink-0' />
                          <span className='truncate'>{item.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className='relative flex-1 min-w-0'>
              <button
                onClick={() => setOpenPickerKind((k) => (k === 'board' ? null : 'board'))}
                className='w-full flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/60 rounded-lg px-3 py-2 transition-colors truncate'
              >
                <Trello className='w-3.5 h-3.5 flex-shrink-0' />
                <span className='truncate'>{effectiveContext.boardName || 'Select board'}</span>
              </button>

              {openPickerKind === 'board' && (
                <div className='absolute left-0 right-0 mt-1.5 bg-popover border border-border rounded-lg shadow-2xl z-10 overflow-hidden'>
                  <div className='flex items-center gap-2 px-2.5 py-2 border-b border-border/60'>
                    <Search className='w-3.5 h-3.5 text-muted-foreground flex-shrink-0' />
                    <input
                      autoFocus
                      value={boardSearch}
                      onChange={(e) => setBoardSearch(e.target.value)}
                      placeholder={
                        effectiveContext.workspaceName
                          ? `Search boards in ${effectiveContext.workspaceName}... (or #key)`
                          : 'Search boards... (or #key)'
                      }
                      className='flex-1 min-w-0 text-xs bg-transparent focus:outline-none placeholder:text-muted-foreground'
                    />
                  </div>
                  <div className='max-h-52 overflow-y-auto py-1'>
                    {boardResults.length === 0 ? (
                      <p className='px-3 py-3 text-xs text-muted-foreground text-center'>No boards match.</p>
                    ) : (
                      boardResults.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => selectBoard(item)}
                          className='w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted/50 transition-colors'
                        >
                          <Trello className='w-3.5 h-3.5 text-muted-foreground flex-shrink-0' />
                          <span className='truncate flex items-center gap-1'>
                            {item.name}
                            {item.number != null && (
                              <span className='text-muted-foreground'>#{item.number}</span>
                            )}
                            {item.starred && <Star className='w-3 h-3 text-yellow-400 fill-current flex-shrink-0' />}
                          </span>
                          {!effectiveContext.workspaceName && item.workspaceName && (
                            <span className='ml-auto text-muted-foreground flex-shrink-0 truncate'>
                              {item.workspaceName}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div ref={scrollRef} className='flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0'>
            {isLoadingHistory ? (
              <div className='flex justify-center py-10'>
                <Loader2 className='w-5 h-5 animate-spin text-muted-foreground' />
              </div>
            ) : historyError ? (
              <div className='flex flex-col items-center gap-2 py-10 text-center'>
                <p className='text-sm text-muted-foreground'>{historyError}</p>
                <button
                  onClick={loadHistory}
                  className='flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors'
                >
                  <RotateCcw className='w-3 h-3' /> Try again
                </button>
              </div>
            ) : messages.length === 0 ? (
              <p className='text-sm text-muted-foreground text-center py-10 max-w-xs mx-auto leading-relaxed'>
                Describe a task — go back and forth as much as you like, then hit{' '}
                <span className='text-foreground font-medium'>Create task</span> when you're ready.
              </p>
            ) : (
              messages.map((m, idx) => {
                const isLatest = idx === messages.length - 1;

                // Boundary markers render as centered dividers, not bubbles
                // — makes the "draft reset" moment visually obvious.
                if (m.message_type === 'confirmation') {
                  const cardId: string | undefined = m.metadata?.card_id;
                  const currentDue = cardId ? dueDatesByCard[cardId] ?? m.metadata?.due_date ?? null : null;
                  const dateExpanded = !!cardId && expandedDateCardId === cardId;

                  return (
                    <div key={m.id} className='space-y-2'>
                      <div className='flex items-center gap-2 py-1'>
                        <div className='flex-1 h-px bg-border/60' />
                        <div className='flex items-center gap-1.5'>
                          {m.metadata?.board_id ? (
                            <Link
                              href={`/board/${m.metadata.board_id}?card=${m.metadata.card_id}`}
                              className='group flex items-center gap-2 max-w-[20rem] bg-success/10 hover:bg-success/15 border border-success/25 rounded-full pl-3 pr-3 py-1.5 transition-colors'
                            >
                              <CheckCircle2 className='w-4 h-4 text-success flex-shrink-0' />
                              <span className='text-sm font-medium text-foreground truncate'>{m.metadata.title}</span>
                              {currentDue && (
                                <span className='text-xs text-success/80 flex-shrink-0'>
                                  · {formatDueDate(currentDue)}
                                </span>
                              )}
                              <ArrowUpRight className='w-3.5 h-3.5 text-success flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity' />
                            </Link>
                          ) : (
                            <div className='flex items-center gap-1.5 text-sm text-success font-medium px-2'>
                              <CheckCircle2 className='w-4 h-4 flex-shrink-0' />
                              Created "{m.metadata?.title}"
                            </div>
                          )}
                          {cardId && (
                            <button
                              onClick={() => setExpandedDateCardId(dateExpanded ? null : cardId)}
                              title='Set due date'
                              className='p-1.5 rounded-full bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0'
                            >
                              <Calendar className='w-3.5 h-3.5' />
                            </button>
                          )}
                        </div>
                        <div className='flex-1 h-px bg-border/60' />
                      </div>
                      {dateExpanded && cardId && renderDueDatePicker(cardId)}
                    </div>
                  );
                }
                if (m.metadata?.kind === 'draft_reset') {
                  return (
                    <div key={m.id} className='flex items-center gap-2 py-1'>
                      <div className='flex-1 h-px bg-border/40' />
                      <span className='text-[11px] text-muted-foreground px-2'>{m.content}</span>
                      <div className='flex-1 h-px bg-border/40' />
                    </div>
                  );
                }

                // Skeleton proposal — an editable card, not a plain bubble.
                if (m.metadata?.kind === 'skeleton_proposal') {
                  const dismissed = dismissedSkeletonIds.has(m.id);
                  const showActions = isLatest && !dismissed;
                  const isEditing = editingSkeletonId === m.id;
                  const edit = skeletonEdits[m.id] ?? {
                    title: m.metadata.title,
                    description: m.metadata.description,
                    dueDate: m.metadata.due_date ?? null,
                    startDate: null,
                  };

                  if (dismissed) return null;

                  return (
                    <div
                      key={m.id}
                      className='bg-muted/40 border border-border/60 rounded-xl p-3 space-y-2 max-w-[92%]'
                    >
                      <p className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
                        Task preview
                      </p>
                      {isEditing ? (
                        <div className='space-y-2'>
                          <input
                            value={edit.title}
                            onChange={(e) =>
                              setSkeletonEdits((prev) => ({ ...prev, [m.id]: { ...edit, title: e.target.value } }))
                            }
                            className='w-full text-sm font-medium bg-background border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30'
                            placeholder='Title'
                          />
                          <textarea
                            value={edit.description}
                            onChange={(e) =>
                              setSkeletonEdits((prev) => ({
                                ...prev,
                                [m.id]: { ...edit, description: e.target.value },
                              }))
                            }
                            rows={3}
                            className='w-full text-sm bg-background border border-border rounded-md px-2.5 py-1.5 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 resize-none'
                            placeholder='Description'
                          />
                        </div>
                      ) : (
                        <div>
                          <p className='text-sm font-medium text-foreground'>{edit.title}</p>
                          {edit.description && (
                            <p className='text-xs text-muted-foreground mt-1 whitespace-pre-line'>
                              {edit.description}
                            </p>
                          )}
                        </div>
                      )}
                      <div className='flex flex-wrap items-center gap-x-4 gap-y-1.5'>
                        <div className='flex items-center gap-1.5'>
                          <span className='text-[11px] text-muted-foreground w-9 flex-shrink-0'>Start</span>
                          <input
                            type='date'
                            value={edit.startDate ? edit.startDate.slice(0, 10) : ''}
                            onChange={(e) =>
                              setSkeletonEdits((prev) => ({
                                ...prev,
                                [m.id]: {
                                  ...edit,
                                  startDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                                },
                              }))
                            }
                            className='text-xs bg-background border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:border-primary'
                          />
                        </div>
                        <div className='flex items-center gap-1.5'>
                          <Calendar className='w-3.5 h-3.5 text-muted-foreground flex-shrink-0' />
                          <span className='text-[11px] text-muted-foreground w-9 flex-shrink-0'>Due</span>
                          <input
                            type='date'
                            value={edit.dueDate ? edit.dueDate.slice(0, 10) : ''}
                            onChange={(e) =>
                              setSkeletonEdits((prev) => ({
                                ...prev,
                                [m.id]: {
                                  ...edit,
                                  dueDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                                },
                              }))
                            }
                            className='text-xs bg-background border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:border-primary'
                          />
                        </div>
                      </div>
                      {!edit.dueDate && m.metadata.due_date_phrase && (
                        <p className='text-[11px] text-amber-500'>
                          Mentioned "{m.metadata.due_date_phrase}" but couldn't resolve it to a date — set it above.
                        </p>
                      )}
                      <p className='text-[11px] text-muted-foreground'>
                        into {m.metadata.board_name}
                        {m.metadata.workspace_name && ` (${m.metadata.workspace_name})`}
                      </p>

                      {showActions && (
                        <div className='flex items-center gap-1.5 pt-1'>
                          <button
                            onClick={() => approveSkeleton(m)}
                            disabled={confirmingId === m.id || !edit.title?.trim()}
                            className='flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50'
                          >
                            {confirmingId === m.id ? (
                              <Loader2 className='w-3 h-3 animate-spin' />
                            ) : (
                              <Check className='w-3 h-3' />
                            )}
                            Approve
                          </button>
                          {!isEditing ? (
                            <button
                              onClick={() => {
                                setEditingSkeletonId(m.id);
                                setSkeletonEdits((prev) => ({ ...prev, [m.id]: edit }));
                              }}
                              className='flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-muted/60 text-foreground hover:bg-muted transition-colors'
                            >
                              <Pencil className='w-3 h-3' /> Edit
                            </button>
                          ) : (
                            <button
                              onClick={() => setEditingSkeletonId(null)}
                              className='text-xs font-medium px-2.5 py-1.5 rounded-md bg-muted/60 text-foreground hover:bg-muted transition-colors'
                            >
                              Done
                            </button>
                          )}
                          <button
                            onClick={() => setDismissedSkeletonIds((prev) => new Set(prev).add(m.id))}
                            className='text-xs font-medium px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors'
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }

                // Assign-people follow-up, plain bot message (not AI) —
                // expands inline into a member list, no modal.
                if (m.metadata?.kind === 'post_create_actions') {
                  const cardId = m.metadata.card_id;
                  const isMemberExpanded = expandedAssignId === m.id;
                  const isDateExpanded = expandedDateCardId === cardId;
                  const members = prefetchedMembers[m.metadata.workspace_id] || [];
                  const added = addedMemberIds[m.id] || new Set<string>();
                  const currentDue = dueDatesByCard[cardId] ?? m.metadata.due_date ?? null;
                  const isCompleted = completedAssignIds.has(m.id);

                  if (isCompleted) {
                    return (
                      <div key={m.id} className='flex items-center gap-1.5 text-xs text-muted-foreground px-1'>
                        <Check className='w-3.5 h-3.5 text-success flex-shrink-0' />
                        {added.size > 0
                          ? `Assigned ${added.size} ${added.size === 1 ? 'person' : 'people'}${
                              currentDue ? `, due ${formatDueDate(currentDue)}` : ''
                            }.`
                          : currentDue
                          ? `Due ${formatDueDate(currentDue)}.`
                          : 'Moving on.'}
                      </div>
                    );
                  }

                  return (
                    <div key={m.id} className='bg-muted/50 text-foreground text-sm rounded-xl px-3 py-2 max-w-[90%]'>
                      <p>{m.content}</p>
                      <div className='mt-1.5 flex flex-wrap items-center gap-1.5'>
                        <button
                          onClick={() => {
                            setExpandedAssignId(isMemberExpanded ? null : m.id);
                            prefetchMembers(m.metadata.workspace_id, m.metadata.board_id);
                          }}
                          className='flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors'
                        >
                          <UserPlus className='w-3 h-3' /> Add member
                        </button>
                        <button
                          onClick={() => setExpandedDateCardId(isDateExpanded ? null : cardId)}
                          className='flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors'
                        >
                          <Calendar className='w-3 h-3' />
                          {currentDue ? formatDueDate(currentDue) : 'Set due date'}
                        </button>
                        <button
                          onClick={() => completeAssign(m.id)}
                          className='flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors'
                        >
                          <Check className='w-3 h-3' /> Done with this task
                        </button>
                      </div>

                      {isMemberExpanded && (
                        <div className='mt-2 space-y-0.5 max-h-40 overflow-y-auto'>
                          {members.length === 0 ? (
                            <p className='text-xs text-muted-foreground py-1'>Loading members...</p>
                          ) : (
                            members.map((mem: any) => {
                              const isAdded = added.has(mem.profiles.id);
                              const key = `${m.id}-${mem.profiles.id}`;
                              return (
                                <button
                                  key={mem.profiles.id}
                                  disabled={isAdded || assigningKey === key}
                                  onClick={() => addMemberToCard(m.id, cardId, mem.profiles.id)}
                                  className='w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs hover:bg-muted/60 transition-colors disabled:opacity-70'
                                >
                                  {mem.profiles.avatar_url ? (
                                    <img
                                      src={mem.profiles.avatar_url}
                                      alt=''
                                      className='w-5 h-5 rounded-full object-cover flex-shrink-0'
                                    />
                                  ) : (
                                    <div className='w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground flex-shrink-0'>
                                      {(mem.profiles.full_name || mem.profiles.email || '?').charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <span className='truncate flex-1'>
                                    {mem.profiles.full_name || mem.profiles.email}
                                  </span>
                                  {isAdded ? (
                                    <Check className='w-3.5 h-3.5 text-success flex-shrink-0' />
                                  ) : (
                                    assigningKey === key && (
                                      <Loader2 className='w-3.5 h-3.5 animate-spin flex-shrink-0' />
                                    )
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}

                      {isDateExpanded && renderDueDatePicker(cardId)}
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    className={`text-sm rounded-xl px-3 py-2 max-w-[88%] leading-relaxed ${
                      m.role === 'user'
                        ? 'ml-auto bg-primary/15 text-foreground'
                        : m.isLocalError
                        ? 'bg-destructive/10 text-destructive'
                        : m.isSystemNote
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'bg-muted/50 text-foreground'
                    }`}
                  >
                    <p className='whitespace-pre-line'>{m.content}</p>

                    {m.metadata?.kind === 'board_suggest' && (
                      <div className='mt-2 flex flex-wrap gap-1.5'>
                        {m.metadata.boards.map((b: any) => (
                          <button
                            key={b.id}
                            onClick={() => pickSuggestedBoard(b)}
                            className='flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors'
                          >
                            <Trello className='w-3 h-3' />
                            {b.name}
                            {b.workspace_name && (
                              <span className='text-primary/70'>· {b.workspace_name}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {(isSending || isCreatingSkeleton) && (
              <div className='flex items-center gap-1.5 text-xs text-muted-foreground px-1'>
                <Loader2 className='w-3.5 h-3.5 animate-spin' />
                {isCreatingSkeleton ? 'Putting the task together...' : 'Thinking...'}
              </div>
            )}
          </div>

          <div className='p-4 border-t border-border flex-shrink-0 space-y-2'>
            {hasActiveKey === false ? (
              <p className='text-xs text-muted-foreground text-center py-1'>
                Add an API key in{' '}
                <Link href='/settings' onClick={() => setIsOpen(false)} className='text-primary hover:text-primary/80'>
                  Settings
                </Link>{' '}
                to use AI features.
              </p>
            ) : (
              <>
                {draftMessageCount > 0 && (
                  <div className='flex items-center justify-between gap-2'>
                    <button
                      onClick={discardDraft}
                      disabled={isDiscarding}
                      className='flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50'
                    >
                      <Trash2 className='w-3.5 h-3.5' />
                      {isDiscarding ? 'Discarding...' : 'Discard draft'}
                    </button>
                    <button
                      onClick={createSkeleton}
                      disabled={!effectiveContext.boardId || isCreatingSkeleton}
                      title={!effectiveContext.boardId ? 'Pick a board first' : undefined}
                      className='flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50'
                    >
                      {isCreatingSkeleton ? (
                        <Loader2 className='w-3.5 h-3.5 animate-spin' />
                      ) : (
                        <Sparkles className='w-3.5 h-3.5' />
                      )}
                      Create task
                    </button>
                  </div>
                )}

                <div className='relative'>
                  <WorkspaceBoardMentionInput
                    ref={composeRef}
                    value={input}
                    onChange={setInput}
                    items={mentionItems}
                    rows={3}
                    onMentionInsert={(item) =>
                      setSelected(
                        item.kind === 'workspace'
                          ? { workspaceId: item.id, workspaceName: item.name }
                          : {
                              boardId: item.id,
                              boardName: item.name,
                              workspaceId: item.workspaceId,
                              workspaceName: item.workspaceName,
                            }
                      )
                    }
                    onSubmit={sendMessage}
                    placeholder='Describe the task... (@ to pick a board)'
                    className='w-full resize-none min-h-[6rem] max-h-[16rem] text-sm bg-background border border-border rounded-lg pl-3 pr-12 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30'
                    disabled={isSending}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isSending}
                    className='absolute bottom-2.5 right-2.5 p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50'
                    aria-label='Send'
                  >
                    <Send className='w-4 h-4' />
                  </button>
                </div>
                <p className='text-[11px] text-muted-foreground text-right'>
                  Enter to send · Shift+Enter for a new line
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
