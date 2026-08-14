'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { parseDateRange } from '@/utils/parseDueDate';
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
    hasMoreHistory,
    setHasMoreHistory,
    selected,
    setSelected,
    hasActiveKey,
    setHasActiveKey,
    mentionItems,
    setMentionItems,
    mentionItemsLoaded,
    setMentionItemsLoaded,
    input,
    setInput,
    isSending,
    setIsSending,
    isCreatingSkeleton,
    setIsCreatingSkeleton,
    isDiscarding,
    setIsDiscarding,
    confirmingId,
    setConfirmingId,
    editingSkeletonId,
    setEditingSkeletonId,
    skeletonEdits,
    setSkeletonEdits,
    dismissedSkeletonIds,
    setDismissedSkeletonIds,
    expandedAssignId,
    setExpandedAssignId,
    cardMembers,
    setCardMembers,
    assigningKey,
    setAssigningKey,
    memberError,
    setMemberError,
    completedAssignIds,
    setCompletedAssignIds,
    prefetchedMembers,
    setPrefetchedMembers,
    expandedDateCardId,
    setExpandedDateCardId,
    dateDrafts,
    setDateDrafts,
    dueDatesByCard,
    setDueDatesByCard,
    startDatesByCard,
    setStartDatesByCard,
    settingDateKey,
    setSettingDateKey,
    dateErrorByCard,
    setDateErrorByCard,
    openPickerKind,
    setOpenPickerKind,
    workspaceSearch,
    setWorkspaceSearch,
    boardSearch,
    setBoardSearch,
  } = useAIChatStore();

  // Everything above lives in the shared store, not local state — this
  // widget is mounted twice inside DashboardHeader (mobile row + desktop
  // row, CSS-hidden depending on viewport), and any piece of state that
  // affects what's rendered has to be identical between both copies or
  // they can show genuinely different UI for the same messages (this is
  // what caused the date picker to appear to open twice — expand state
  // used to be local per-instance). Only the history fetch's own
  // loading/error flags stay local: harmless if they briefly differ, and
  // historyLoaded (shared) already prevents a redundant second fetch.
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  // Search within the member picker — purely transient typing state,
  // reset each time the picker opens.
  const [memberSearch, setMemberSearch] = useState('');

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
    [prefetchedMembers, setPrefetchedMembers]
  );

  // Real card members, fetched fresh from the DB — this is the source of
  // truth the member panel renders from, not a locally-tracked "what did I
  // click this session" set. That distinction is what actually fixes
  // "add someone, then can't remove them": a member added in an earlier
  // session (or before a refresh) is genuinely on the card, but a
  // click-only local Set never knew about it, so no removable chip ever
  // rendered for them.
  const fetchCardMembers = useCallback(
    (cardId: string) => {
      fetchJson(`/api/cards/${cardId}/members`)
        .then((data) => setCardMembers((prev) => ({ ...prev, [cardId]: data.members || [] })))
        .catch((err) => console.error('Error fetching card members:', err));
    },
    [setCardMembers]
  );

  const addMemberToCard = async (cardId: string, profileId: string) => {
    const key = `${cardId}-${profileId}`;
    setAssigningKey(key);
    setMemberError((prev) => ({ ...prev, [cardId]: null }));
    try {
      const res = await fetch(`/api/cards/${cardId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add member.');
      fetchCardMembers(cardId);
    } catch (err: any) {
      console.error('Error assigning member:', err);
      setMemberError((prev) => ({ ...prev, [cardId]: err.message || 'Failed to add member.' }));
    } finally {
      setAssigningKey(null);
    }
  };

  // Click an already-added member's chip to remove them. Always shows a
  // visible error on failure now — previously a failed removal only
  // logged to the console, so from the user's side it just silently did
  // nothing with no indication why.
  const removeMemberFromCard = async (cardId: string, profileId: string) => {
    const key = `${cardId}-${profileId}`;
    setAssigningKey(key);
    setMemberError((prev) => ({ ...prev, [cardId]: null }));
    try {
      const res = await fetch(`/api/cards/${cardId}/members/${profileId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove member.');
      fetchCardMembers(cardId);
    } catch (err: any) {
      console.error('Error removing member:', err);
      setMemberError((prev) => ({ ...prev, [cardId]: err.message || 'Failed to remove member.' }));
    } finally {
      setAssigningKey(null);
    }
  };

  // Member list and date picker are mutually exclusive (opening one closes
  // the other) — showing both at once was the "too cluttered" complaint.
  // Clicking the same toggle again collapses it, independent of Done.
  // Keyed by card id (not message id) — one card has exactly one
  // post_create_actions message here, so this lines up with cardMembers.
  const toggleMemberExpand = (cardId: string, workspaceId: string, boardId: string) => {
    setExpandedDateCardId(null);
    setMemberSearch('');
    setExpandedAssignId((prev) => {
      const next = prev === cardId ? null : cardId;
      if (next) {
        prefetchMembers(workspaceId, boardId);
        fetchCardMembers(cardId);
      }
      return next;
    });
  };

  const toggleDateExpand = (cardId: string) => {
    setExpandedAssignId(null);
    setExpandedDateCardId((prev) => (prev === cardId ? null : cardId));
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);
  // The header this widget lives in is `backdrop-blur-lg` (see
  // .superhero-header in globals.css) — backdrop-filter, like transform,
  // makes an element a new containing block for `position: fixed`
  // descendants. That silently confined the mobile panel's `fixed inset-0`
  // backdrop to the header's own ~64px-tall box instead of the true
  // viewport: the panel itself still rendered at full size (dvh units size
  // against the real viewport regardless of containing block), but the
  // backdrop only darkened that thin strip, leaving the rest of the page
  // showing through undimmed below it. Portaling to document.body escapes
  // the header's DOM subtree entirely, sidestepping the containing-block
  // rule altogether. On desktop the panel isn't full-bleed — it's a small
  // dropdown anchored to the trigger button via `absolute` — so it portals
  // into containerRef itself, which is a no-op positionally (same DOM
  // parent it would've had anyway) while keeping the anchor intact.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  // Set right before loadMoreHistory prepends older messages — tells the
  // auto-scroll-to-bottom effect below to skip that one update instead of
  // yanking the view back down the moment the user scrolled up to load
  // more history.
  const skipAutoScrollRef = useRef(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Belt-and-suspenders against approveSkeleton double-firing: confirmingId
  // (state) disables the button, but that only takes effect on the next
  // render — two fast clicks (or one slow network round-trip + an
  // impatient second click) can both fire before that re-render lands,
  // which would call /api/ai/chat/confirm twice and create two cards from
  // the same draft. A ref is checked and set synchronously, before any
  // `await`, so the second call sees it immediately regardless of render
  // timing.
  const approvingSkeletonIdsRef = useRef<Set<string>>(new Set());

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
  // the panel opening, history finishing its load, or the typing/creating
  // indicator appearing. A conversation opens on its latest message, not
  // its first. Writing scrollTop directly (useLayoutEffect, before paint)
  // rather than scrollIntoView — scrollIntoView scrolls whatever it
  // decides is the nearest scrollable ancestor, which was unreliable while
  // the panel's own entrance animation/transform was still resolving right
  // after opening; a direct assignment on the known container has no such
  // ambiguity. Runs twice (immediately, then next frame) to also cover
  // content that's still settling (avatar images, a taller skeleton card).
  useLayoutEffect(() => {
    if (!isOpen) return;
    if (skipAutoScrollRef.current) {
      // This update was an older page getting prepended by
      // loadMoreHistory, which already restored the right scroll offset
      // itself — jumping to the bottom here would undo that.
      skipAutoScrollRef.current = false;
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    const frame = requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, isOpen, isSending, isCreatingSkeleton, isLoadingHistory]);

  // Loads only the most recent page (last 5 messages) — a conversation
  // that's been going for a while shouldn't fetch and render its entire
  // history just to open the panel. Older messages load on demand as the
  // user scrolls up, via loadMoreHistory below.
  const loadHistory = useCallback(() => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    fetchJson('/api/ai/chat')
      .then((data) => {
        setMessages(data.messages || []);
        setHasMoreHistory(!!data.hasMore);
        setHistoryLoaded(true);
      })
      .catch((err) => {
        console.error('Error loading AI chat history:', err);
        setHistoryError(err.message || "Couldn't load your chat history.");
      })
      .finally(() => setIsLoadingHistory(false));
  }, [setMessages, setHistoryLoaded, setHasMoreHistory]);

  // Scrolling near the top of the loaded messages fetches the next older
  // page and prepends it, preserving the reader's scroll position (so the
  // message they were looking at doesn't jump).
  const loadMoreHistory = useCallback(() => {
    if (isLoadingMore || !hasMoreHistory || messages.length === 0) return;
    const oldest = messages[0];
    const container = scrollRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;
    setIsLoadingMore(true);
    fetchJson(`/api/ai/chat?before=${encodeURIComponent(oldest.created_at)}`)
      .then((data) => {
        skipAutoScrollRef.current = true;
        setMessages((prev) => [...(data.messages || []), ...prev]);
        setHasMoreHistory(!!data.hasMore);
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight + prevScrollTop;
          }
        });
      })
      .catch((err) => console.error('Error loading more chat history:', err))
      .finally(() => setIsLoadingMore(false));
  }, [isLoadingMore, hasMoreHistory, messages, setMessages, setHasMoreHistory]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 80) loadMoreHistory();
  };

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

  // The most recent post_create_actions message, if it hasn't been marked
  // Done yet — drives the docked actions bar (Add member / Set due date /
  // Done) above the compose box, always reachable regardless of scroll
  // position, the same treatment as the Create task bar.
  // Only ever the most recent message overall, not just the most recent
  // post_create_actions one — otherwise, creating a task, not clicking
  // Done, and then starting to describe a completely different task left
  // this bar (for the *old* task) sitting there the whole time, looking
  // like it was asking about a task that didn't exist yet. The instant
  // anything else happens — a new message, a board switch — the old task
  // is implicitly done with, whether or not "Done" was ever clicked.
  const pendingPostCreateMessage = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last || last.metadata?.kind !== 'post_create_actions') return null;
    return completedAssignIds.has(last.id) ? null : last;
  }, [messages, completedAssignIds]);

  // Resolved status for every skeleton_proposal, derived from the message
  // list itself rather than from approvedSkeletonIds/dismissedSkeletonIds
  // alone — those two Sets are plain in-memory state with no persistence,
  // so a page reload (or just reopening the chat later) wiped them while
  // `messages` came back from the DB exactly as it was. That made every
  // already-approved preview from an earlier session render as if it were
  // still live: editable dates, a clickable Approve that would create a
  // *second* card from the same draft, all fully interactive.
  //
  // The message list is itself the persisted record of what happened, so
  // resolution is derived straight from it:
  //   - approved: some later message in the SAME loaded history is a
  //     'confirmation' — the card this skeleton became actually exists.
  //     Stays visible, muted, permanently — this is the one state that
  //     should never disappear once reached, no matter what happens after.
  //   - superseded: not approved, but either explicitly cancelled
  //     (dismissedSkeletonIds — the one thing that genuinely has no DB
  //     trace, since Cancel never calls an API) or made stale by a later
  //     skeleton_proposal/draft_reset. These vanish outright (same as
  //     before) rather than lingering as clutter nothing points to anymore.
  //   - otherwise: still the live, actionable draft.
  const skeletonResolution = useMemo(() => {
    const result = new Map<string, 'approved' | 'superseded' | 'pending'>();
    messages.forEach((msg, i) => {
      if (msg.metadata?.kind !== 'skeleton_proposal') return;
      // dismissedSkeletonIds wins outright regardless of what else is
      // true — it's used both for cancelling a still-pending draft AND
      // for closing out an already-approved card once "Done" is clicked
      // on the post-creation actions (completeAssign), so an approved
      // card must still be hideable, not permanently stuck visible.
      if (dismissedSkeletonIds.has(msg.id)) {
        result.set(msg.id, 'superseded');
        return;
      }
      const later = messages.slice(i + 1);
      const approved = later.some((x) => x.message_type === 'confirmation');
      if (approved) {
        result.set(msg.id, 'approved');
        return;
      }
      const superseded = later.some(
        (x) => x.metadata?.kind === 'skeleton_proposal' || x.metadata?.kind === 'draft_reset'
      );
      result.set(msg.id, superseded ? 'superseded' : 'pending');
    });
    return result;
  }, [messages, dismissedSkeletonIds]);

  // Whether a live, still-actionable preview exists right now — drives
  // hiding the compose-area "Create task" button entirely (see Regenerate,
  // below, which lives on the card itself instead of relabeling this one).
  const hasPendingSkeleton = useMemo(
    () => Array.from(skeletonResolution.values()).some((status) => status === 'pending'),
    [skeletonResolution]
  );

  // Keeps the "N added" badge on the docked bar accurate without requiring
  // the panel to be expanded first — e.g. right after creating the task,
  // or reopening the chat on a still-pending task from an earlier session.
  useEffect(() => {
    if (pendingPostCreateMessage?.metadata?.card_id) {
      fetchCardMembers(pendingPostCreateMessage.metadata.card_id);
    }
  }, [pendingPostCreateMessage?.metadata?.card_id, fetchCardMembers]);

  // A skeleton proposal that's still sitting there unapproved goes stale
  // the moment anything else happens — another message sent, or "Create
  // task" clicked again — because at that point it's no longer clear the
  // preview still reflects what's being talked about. Dismiss it outright
  // (same as clicking Cancel) rather than leaving it visible: there's
  // nothing to grey it into that wouldn't just be confusing clutter next
  // to a conversation that's already moved on.
  const dismissStalePendingSkeletons = () => {
    const staleIds = messages
      .filter((msg) => skeletonResolution.get(msg.id) === 'pending')
      .map((msg) => msg.id);
    if (staleIds.length === 0) return;
    setDismissedSkeletonIds((prev) => {
      const next = new Set(prev);
      staleIds.forEach((id) => next.add(id));
      return next;
    });
  };

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
      dismissStalePendingSkeletons();
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
      // Clicking "Create task" again while an earlier proposal from this
      // same draft is still sitting there unapproved supersedes it — the
      // newer one always wins, regenerated from the fuller draft.
      dismissStalePendingSkeletons();
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
      dismissStalePendingSkeletons();
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
    // The muted "Created from this draft" preview card is only there as a
    // fading record between approving and wrapping up — once "Done" is
    // clicked, the confirmation pill is the permanent record of it and the
    // preview card is just clutter. Close it out the same way Cancel does.
    const approvedIds = messages
      .filter((msg) => skeletonResolution.get(msg.id) === 'approved')
      .map((msg) => msg.id);
    if (approvedIds.length > 0) {
      setDismissedSkeletonIds((prev) => {
        const next = new Set(prev);
        approvedIds.forEach((id) => next.add(id));
        return next;
      });
    }
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

  // Start/due date default to whatever was extracted from chat, but are
  // editable right in the preview while it's still the draft (see
  // showActions below) — edit?.startDate/dueDate wins once the user
  // touches either field. Once approved, editing moves to exactly one
  // place: the docked date panel after creation.
  const approveSkeleton = async (m: ChatMessage) => {
    // Synchronous guard — see approvingSkeletonIdsRef above. Must be the
    // very first thing that happens, before any await, or a fast second
    // click can slip through while confirmingId hasn't re-rendered yet.
    if (approvingSkeletonIdsRef.current.has(m.id)) return;
    approvingSkeletonIdsRef.current.add(m.id);

    const edit = skeletonEdits[m.id];
    const title = edit?.title ?? m.metadata?.title;
    const description = edit?.description ?? m.metadata?.description;
    const startDate = edit?.startDate ?? m.metadata?.start_date ?? null;
    const dueDate = edit?.dueDate ?? m.metadata?.due_date ?? null;
    if (!title?.trim()) {
      approvingSkeletonIdsRef.current.delete(m.id);
      return;
    }

    setConfirmingId(m.id);
    try {
      const data = await fetchJson('/api/ai/chat/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          startDate,
          dueDate,
          boardId: m.metadata.board_id,
          workspaceId: m.metadata.workspace_id,
          listId: m.metadata.list_id,
        }),
      });
      // Appending the confirmation message here is what flips
      // skeletonResolution to 'approved' for this card — no separate
      // "mark approved" state needed, the message list is the record.
      setMessages((prev) => [...prev, ...(data.messages || [])]);
      setEditingSkeletonId(null);
      if (m.metadata.workspace_id) {
        prefetchMembers(m.metadata.workspace_id, m.metadata.board_id);
      }
    } catch (err: any) {
      console.error('Error confirming task:', err);
      setMessages((prev) => [...prev, localErrorMessage(err.message || 'Something went wrong. Try again.')]);
      // Only cleared on failure — a legitimate retry after an error
      // shouldn't be locked out. On success it deliberately stays set:
      // once approved, this id should never be approvable again (belt and
      // suspenders alongside skeletonResolution making the button vanish).
      approvingSkeletonIdsRef.current.delete(m.id);
    } finally {
      setConfirmingId(null);
      refocusCompose();
    }
  };

  const formatDueDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  // Sets/changes start and/or due date on an already-created card — used
  // by the post-creation date panel. Only the fields actually passed get
  // sent/updated, so setting one doesn't clobber the other.
  const applyDates = async (
    cardId: string,
    changes: { startDate?: string | null; dueDate?: string | null }
  ) => {
    setSettingDateKey(cardId);
    setDateErrorByCard((prev) => ({ ...prev, [cardId]: null }));
    try {
      const body: Record<string, string | null> = {};
      if ('startDate' in changes) body.start_date = changes.startDate ?? null;
      if ('dueDate' in changes) body.due_date = changes.dueDate ?? null;
      // /api/cards/[id] only exports PUT, not PATCH — this was the actual
      // cause of "Failed to save the date": every call 405'd.
      const res = await fetch(`/api/cards/${cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save the date — try again.');
      if ('startDate' in changes) {
        setStartDatesByCard((prev) => ({ ...prev, [cardId]: changes.startDate ?? null }));
      }
      if ('dueDate' in changes) {
        setDueDatesByCard((prev) => ({ ...prev, [cardId]: changes.dueDate ?? null }));
      }
    } catch (err: any) {
      console.error('Error setting date:', err);
      setDateErrorByCard((prev) => ({ ...prev, [cardId]: err.message || 'Failed to save the date.' }));
    } finally {
      setSettingDateKey(null);
    }
  };

  // Free-text natural-language date, submitted via the Set button or Enter
  // — parsing happens client-side first (fast, no network) so the common
  // phrasings resolve instantly; if that fails, fall back to asking the AI
  // to interpret it before giving up and showing an error. Understands a
  // single date ("6th oct") as well as a range in one phrase ("start
  // today and end in one month") — whichever end(s) it recognizes get set.
  const submitDateDraft = async (cardId: string) => {
    const draft = dateDrafts[cardId]?.trim();
    if (!draft) return;

    const direct = parseDateRange(draft);
    if (direct.startDate || direct.dueDate) {
      const changes: { startDate?: string | null; dueDate?: string | null } = {};
      if (direct.startDate) changes.startDate = direct.startDate;
      if (direct.dueDate) changes.dueDate = direct.dueDate;
      await applyDates(cardId, changes);
      setExpandedDateCardId(null);
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
      const changes: { startDate?: string | null; dueDate?: string | null } = {};
      if (data.startDate) changes.startDate = data.startDate;
      if (data.dueDate) changes.dueDate = data.dueDate;
      await applyDates(cardId, changes);
      setExpandedDateCardId(null);
    } catch (err: any) {
      console.error('Error resolving date via AI:', err);
      setDateErrorByCard((prev) => ({
        ...prev,
        [cardId]: err.message || `Couldn't understand "${draft}" — try "30 days from now" or "start today, due in a month".`,
      }));
    } finally {
      setSettingDateKey(null);
    }
  };

  // Click a member row to add them; click their chip above to remove them.
  // Added members (top chips) come from cardMembers — the real, fetched
  // card_members rows — not a local "what did I click" set, so a member
  // who's genuinely on the card always shows up as removable, regardless
  // of when or in what session they were added.
  const renderMemberList = (cardId: string, workspaceId: string) => {
    const workspaceMembers = prefetchedMembers[workspaceId] || [];
    const addedMembers = cardMembers[cardId] || [];
    const addedIds = new Set(addedMembers.map((cm: any) => cm.profiles?.id));

    const q = memberSearch.trim().toLowerCase();
    const available = workspaceMembers.filter((mem: any) => {
      if (addedIds.has(mem.profiles.id)) return false;
      if (!q) return true;
      const name = (mem.profiles.full_name || '').toLowerCase();
      const email = (mem.profiles.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });

    const initials = (person: any) => (person.full_name || person.email || '?').charAt(0).toUpperCase();

    return (
      <div className='mt-2 bg-background/60 border border-border/60 rounded-lg p-2.5 space-y-2'>
        {addedMembers.length > 0 && (
          <div className='flex flex-wrap gap-1.5'>
            {addedMembers.map((cm: any) => {
              const person = cm.profiles;
              const key = `${cardId}-${person.id}`;
              const isBusy = assigningKey === key;
              return (
                <button
                  key={person.id}
                  disabled={isBusy}
                  onClick={() => removeMemberFromCard(cardId, person.id)}
                  title='Click to remove'
                  className='group flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-primary/10 hover:bg-destructive/10 transition-colors disabled:opacity-60'
                >
                  {person.avatar_url ? (
                    <img src={person.avatar_url} alt='' className='w-5 h-5 rounded-full object-cover flex-shrink-0' />
                  ) : (
                    <div className='w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground flex-shrink-0'>
                      {initials(person)}
                    </div>
                  )}
                  <span className='text-xs font-medium text-foreground group-hover:text-destructive transition-colors'>
                    {person.full_name || person.email}
                  </span>
                  {isBusy ? (
                    <Loader2 className='w-3 h-3 animate-spin text-muted-foreground flex-shrink-0' />
                  ) : (
                    <X className='w-3 h-3 text-muted-foreground group-hover:text-destructive flex-shrink-0' />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className='flex items-center gap-2 px-2 py-1.5 bg-background border border-border rounded-md'>
          <Search className='w-3.5 h-3.5 text-muted-foreground flex-shrink-0' />
          <input
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder='Search people...'
            className='flex-1 min-w-0 text-xs bg-transparent focus:outline-none placeholder:text-muted-foreground'
          />
        </div>

        <div className='max-h-36 overflow-y-auto space-y-0.5'>
          {workspaceMembers.length === 0 ? (
            <p className='text-xs text-muted-foreground text-center py-2'>Loading members...</p>
          ) : available.length === 0 ? (
            <p className='text-xs text-muted-foreground text-center py-2'>
              {q ? 'No matches.' : 'Everyone available is already added.'}
            </p>
          ) : (
            available.map((mem: any) => {
              const key = `${cardId}-${mem.profiles.id}`;
              const isBusy = assigningKey === key;
              return (
                <button
                  key={mem.profiles.id}
                  disabled={isBusy}
                  onClick={() => addMemberToCard(cardId, mem.profiles.id)}
                  className='w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs hover:bg-muted/60 transition-colors disabled:opacity-70'
                >
                  {mem.profiles.avatar_url ? (
                    <img src={mem.profiles.avatar_url} alt='' className='w-5 h-5 rounded-full object-cover flex-shrink-0' />
                  ) : (
                    <div className='w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-primary-foreground flex-shrink-0'>
                      {initials(mem.profiles)}
                    </div>
                  )}
                  <span className='truncate flex-1'>{mem.profiles.full_name || mem.profiles.email}</span>
                  {isBusy && <Loader2 className='w-3.5 h-3.5 animate-spin flex-shrink-0' />}
                </button>
              );
            })
          )}
        </div>

        {memberError[cardId] && <p className='text-[11px] text-destructive'>{memberError[cardId]}</p>}
      </div>
    );
  };

  // One compact column per end of the range, side by side — just a label,
  // the current value (if set), Clear, and the native date input itself.
  // No quick-pick buttons here: "today", "tomorrow", "in 3 days" etc. all
  // already work by just typing them into the free-text field below —
  // having them again as buttons here was redundant.
  const renderDateSection = (
    cardId: string,
    label: string,
    current: string | null | undefined,
    onPick: (iso: string | null) => void
  ) => (
    <div className='flex-1 min-w-0 space-y-1'>
      <div className='flex items-center justify-between gap-1'>
        <p className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate'>
          {label}
          {current && <span className='ml-1 normal-case font-medium text-foreground'>{formatDueDate(current)}</span>}
        </p>
        {current && (
          <button
            onClick={() => onPick(null)}
            disabled={settingDateKey === cardId}
            className='text-[11px] text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 flex-shrink-0'
          >
            Clear
          </button>
        )}
      </div>
      <input
        type='date'
        value={current ? current.slice(0, 10) : ''}
        disabled={settingDateKey === cardId}
        onChange={(e) => onPick(e.target.value ? new Date(e.target.value).toISOString() : null)}
        className='w-full text-xs bg-background border border-border rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:border-primary'
      />
    </div>
  );

  // initialStartDate/initialDueDate cover whatever was extracted from chat
  // at creation time (metadata.start_date/due_date) — until this panel's
  // own store entry is set, that's the real current value; without this
  // fallback the picker showed empty even though the card genuinely
  // already had that date.
  const renderDueDatePicker = (
    cardId: string,
    initialStartDate: string | null = null,
    initialDueDate: string | null = null
  ) => {
    const currentStart = startDatesByCard[cardId] ?? initialStartDate;
    const currentDue = dueDatesByCard[cardId] ?? initialDueDate;
    return (
      <div className='mt-2 space-y-3 bg-background/60 border border-border/60 rounded-lg p-3'>
        <div className='flex items-start gap-3'>
          {renderDateSection(cardId, 'Start', currentStart, (iso) => applyDates(cardId, { startDate: iso }))}
          {renderDateSection(cardId, 'Due', currentDue, (iso) => applyDates(cardId, { dueDate: iso }))}
        </div>

        <p className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
          Or describe it — either or both ("start today, due in a month")
        </p>
        <div className='flex items-center gap-2'>
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
            className='flex-1 min-w-0 text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground'
          />
          <button
            onClick={() => submitDateDraft(cardId)}
            disabled={settingDateKey === cardId || !dateDrafts[cardId]?.trim()}
            className='flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0'
          >
            {settingDateKey === cardId ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : 'Set'}
          </button>
        </div>
        {dateErrorByCard[cardId] && (
          <p className='text-[11px] text-destructive'>{dateErrorByCard[cardId]}</p>
        )}
      </div>
    );
  };

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

      {isOpen && createPortal(
        // Centered modal on mobile, anchored dropdown at md: and up. An
        // earlier edge-to-edge `fixed inset-0` attempt (w-full h-dvh)
        // fixed the collapsed-height bug but was still getting cut off
        // on one side on real devices — some phones report a CSS
        // viewport width past Tailwind's old `sm:` split (640px), so
        // they silently fell back to the *desktop* anchored-dropdown
        // styles instead: a panel pinned below the header, sized to a
        // fixed 28rem anchored to a button that isn't flush with the
        // screen edge, spilling off the side. Rather than chase the
        // exact breakpoint, this drops "flush with the edges" entirely
        // below md: — a plain centered dialog (backdrop + flex
        // centering + a width capped with margin on both sides) can't
        // run off an edge regardless of viewport width.
        <div
          className='fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 md:block md:bg-transparent md:p-0 md:absolute md:inset-auto md:top-full md:right-0 md:mt-2'
          // The mobile backdrop sits inside containerRef (same wrapper as
          // the trigger button), so the existing outside-click listener
          // below never sees a click on it as "outside" — it needs its
          // own handler. Guarded to the backdrop itself so clicks inside
          // the panel (which bubble up through this div) don't close it.
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
        <div className='w-full max-w-md h-[85dvh] md:h-[80vh] md:max-h-[48rem] md:w-[28rem] lg:w-[36rem] flex flex-col bg-popover text-popover-foreground border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150'>
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

          <div ref={scrollRef} onScroll={handleScroll} className='flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0'>
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
              <>
                {isLoadingMore && (
                  <div className='flex justify-center py-2'>
                    <Loader2 className='w-4 h-4 animate-spin text-muted-foreground' />
                  </div>
                )}
                {messages.map((m) => {
                // Boundary markers render as centered dividers, not bubbles
                // — makes the "draft reset" moment visually obvious.
                if (m.message_type === 'confirmation') {
                  const cardId: string | undefined = m.metadata?.card_id;
                  const currentStart = cardId ? startDatesByCard[cardId] ?? m.metadata?.start_date ?? null : null;
                  const currentDue = cardId ? dueDatesByCard[cardId] ?? m.metadata?.due_date ?? null : null;

                  // Just a link — no controls of its own. While the task
                  // is still fresh, the docked bar below (see
                  // pendingPostCreateMessage) is the one place to add
                  // members or set a date; two independent controls for
                  // the same card was exactly what caused the date picker
                  // to open twice at once. Once you're done with it, use
                  // the card itself (this link) for further changes.
                  return (
                    <div key={m.id} className='flex items-center gap-2 py-1'>
                      <div className='flex-1 h-px bg-border/60' />
                      {m.metadata?.board_id ? (
                        <Link
                          href={`/board/${m.metadata.board_id}?card=${m.metadata.card_id}`}
                          className='group flex items-center gap-2 max-w-[20rem] bg-success/10 hover:bg-success/15 border border-success/25 rounded-full pl-3 pr-3 py-1.5 transition-colors'
                        >
                          <CheckCircle2 className='w-4 h-4 text-success flex-shrink-0' />
                          <span className='text-sm font-medium text-foreground truncate'>{m.metadata.title}</span>
                          {(currentStart || currentDue) && (
                            <span className='text-xs text-success/80 flex-shrink-0'>
                              ·{currentStart && ` ${formatDueDate(currentStart)}`}
                              {currentStart && currentDue && ' →'}
                              {currentDue && ` ${formatDueDate(currentDue)}`}
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
                      <div className='flex-1 h-px bg-border/60' />
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
                  const resolution = skeletonResolution.get(m.id) ?? 'pending';
                  // Actionable only while genuinely still pending — derived
                  // from the message list itself (see skeletonResolution),
                  // not from state that resets on reload. That's what makes
                  // this hold up even for a preview loaded from history in
                  // a brand new session: an already-approved one renders
                  // locked from the first paint, same as it would if you'd
                  // never left the page.
                  const showActions = resolution === 'pending';
                  const isEditing = editingSkeletonId === m.id;
                  const edit = skeletonEdits[m.id] ?? {
                    title: m.metadata.title,
                    description: m.metadata.description,
                    startDate: m.metadata.start_date ?? null,
                    dueDate: m.metadata.due_date ?? null,
                  };

                  if (resolution === 'superseded') return null;

                  // Once approved, this card is a historical record, not
                  // something to act on — the confirmation pill (and the
                  // docked actions bar) are the live, interactive versions
                  // now. Muting it visually makes that distinction obvious
                  // instead of it still looking like an active form.
                  return (
                    <div
                      key={m.id}
                      className={`border rounded-xl p-3 space-y-2 max-w-[92%] transition-colors ${
                        showActions
                          ? 'bg-muted/40 border-border/60'
                          : 'bg-muted/10 border-border/30 opacity-60'
                      }`}
                    >
                      <p className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
                        {showActions ? 'Task preview' : 'Created from this draft'}
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
                      {showActions ? (
                        // Editable while this is still the draft — the
                        // extracted phrase is only a starting point, and
                        // it's much easier to fix a wrong guess here than
                        // to notice and fix it after the task exists.
                        // Locks for good the moment this stops being the
                        // latest message (see the read-only branch below).
                        <div className='flex items-center gap-3'>
                          <div className='flex-1 min-w-0 flex items-center gap-1.5'>
                            <span className='text-[11px] text-muted-foreground flex-shrink-0'>Start</span>
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
                              className='w-full text-xs bg-background border border-border rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:border-primary'
                            />
                          </div>
                          <div className='flex-1 min-w-0 flex items-center gap-1.5'>
                            <Calendar className='w-3.5 h-3.5 text-muted-foreground flex-shrink-0' />
                            <span className='text-[11px] text-muted-foreground flex-shrink-0'>Due</span>
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
                              className='w-full text-xs bg-background border border-border rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:border-primary'
                            />
                          </div>
                        </div>
                      ) : (
                        // Locked — this card is a historical record now.
                        // Reflects whatever was actually sent on Approve
                        // (edit.startDate/dueDate), not just the original
                        // extraction, so it doesn't go stale if it was
                        // hand-edited before approving. Changing it from
                        // here on happens in exactly one place: the docked
                        // date panel after creation.
                        (edit.startDate || edit.dueDate) && (
                          <p className='text-[11px] text-muted-foreground flex items-center gap-1'>
                            <Calendar className='w-3 h-3 flex-shrink-0' />
                            {edit.startDate && `Start ${formatDueDate(edit.startDate)}`}
                            {edit.startDate && edit.dueDate && ' · '}
                            {edit.dueDate && `Due ${formatDueDate(edit.dueDate)}`}
                          </p>
                        )
                      )}
                      {showActions && m.metadata.start_date_phrase && !edit.startDate && (
                        <p className='text-[11px] text-amber-500'>
                          Mentioned a start of "{m.metadata.start_date_phrase}" but couldn't resolve it — set it above.
                        </p>
                      )}
                      {showActions && m.metadata.due_date_phrase && !edit.dueDate && (
                        <p className='text-[11px] text-amber-500'>
                          Mentioned "{m.metadata.due_date_phrase}" but couldn't resolve it — set it above.
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
                          {/* Regenerate — redoes this preview from the
                              fuller conversation since it was drafted.
                              Lives here, on the card it actually affects,
                              instead of relabeling the compose-area button
                              (which now only ever says "Create task" and
                              is hidden entirely while a preview like this
                              one exists — see the button below the
                              messages list). */}
                          <button
                            onClick={createSkeleton}
                            disabled={!effectiveContext.boardId || isCreatingSkeleton || confirmingId === m.id}
                            title={!effectiveContext.boardId ? 'Pick a board first' : 'Redo this preview from the conversation so far'}
                            className='flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-muted/60 text-foreground hover:bg-muted transition-colors disabled:opacity-50'
                          >
                            {isCreatingSkeleton ? (
                              <Loader2 className='w-3 h-3 animate-spin' />
                            ) : (
                              <RotateCcw className='w-3 h-3' />
                            )}
                            Regenerate
                          </button>
                          <button
                            onClick={() => setDismissedSkeletonIds((prev) => new Set(prev).add(m.id))}
                            disabled={isCreatingSkeleton}
                            className='text-xs font-medium px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50'
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
                  const added = cardMembers[cardId] || [];
                  const currentDue = dueDatesByCard[cardId] ?? m.metadata.due_date ?? null;
                  const isCompleted = completedAssignIds.has(m.id);

                  // While pending, the interactive controls live in the
                  // docked bar above the compose box (see below) — always
                  // reachable regardless of scroll position, same as
                  // Create task. Nothing to render here until it's done.
                  if (!isCompleted) return null;

                  return (
                    <div key={m.id} className='flex items-center gap-1.5 text-xs text-muted-foreground px-1'>
                      <Check className='w-3.5 h-3.5 text-success flex-shrink-0' />
                      {added.length > 0
                        ? `Assigned ${added.length} ${added.length === 1 ? 'person' : 'people'}${
                            currentDue ? `, due ${formatDueDate(currentDue)}` : ''
                          }.`
                        : currentDue
                        ? `Due ${formatDueDate(currentDue)}.`
                        : 'Moving on.'}
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
                })}
              </>
            )}
            {(isSending || isCreatingSkeleton) && (
              <div className='flex items-center gap-1.5 text-xs text-muted-foreground px-1'>
                <Loader2 className='w-3.5 h-3.5 animate-spin' />
                {isCreatingSkeleton ? 'Putting the task together...' : 'Thinking...'}
              </div>
            )}
          </div>

          <div className='p-4 border-t border-border flex-shrink-0 space-y-2'>
            {/* Docked, not buried in the scrolling chat — same treatment
                as the Create task bar, so it's always reachable. Doesn't
                need an AI key: assigning members and setting dates are
                plain bot actions, not LLM calls. */}
            {pendingPostCreateMessage && (
              <div className='space-y-1.5'>
                <div className='w-full bg-muted/40 border border-border/60 rounded-xl p-3 space-y-2'>
                  <div className='flex items-center justify-between gap-2'>
                    <p className='text-sm text-foreground'>{pendingPostCreateMessage.content}</p>
                    {/* Same effect as closing any other popover in this
                        panel — collapses whichever of the member list /
                        date picker is open below, nothing more. It never
                        hides this bar itself, so there's no separate
                        "reopen" state to manage. */}
                    {(expandedAssignId === pendingPostCreateMessage.metadata.card_id ||
                      expandedDateCardId === pendingPostCreateMessage.metadata.card_id) && (
                      <button
                        onClick={() => {
                          setExpandedAssignId(null);
                          setExpandedDateCardId(null);
                        }}
                        className='p-1 -m-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0'
                        aria-label='Close'
                        title='Close'
                      >
                        <X className='w-3.5 h-3.5' />
                      </button>
                    )}
                  </div>
                  <div className='flex flex-wrap items-center gap-1.5'>
                    <button
                      onClick={() =>
                        toggleMemberExpand(
                          pendingPostCreateMessage.metadata.card_id,
                          pendingPostCreateMessage.metadata.workspace_id,
                          pendingPostCreateMessage.metadata.board_id
                        )
                      }
                      className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors ${
                        expandedAssignId === pendingPostCreateMessage.metadata.card_id
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-primary/10 text-primary hover:bg-primary/20'
                      }`}
                    >
                      <UserPlus className='w-3 h-3' />
                      {(() => {
                        const count = (cardMembers[pendingPostCreateMessage.metadata.card_id] || []).length;
                        return count > 0 ? `${count} added` : 'Add member';
                      })()}
                    </button>
                    <button
                      onClick={() => toggleDateExpand(pendingPostCreateMessage.metadata.card_id)}
                      className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors ${
                        expandedDateCardId === pendingPostCreateMessage.metadata.card_id
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-primary/10 text-primary hover:bg-primary/20'
                      }`}
                    >
                      <Calendar className='w-3 h-3' />
                      {(() => {
                        const start =
                          startDatesByCard[pendingPostCreateMessage.metadata.card_id] ??
                          pendingPostCreateMessage.metadata.start_date ??
                          null;
                        const due =
                          dueDatesByCard[pendingPostCreateMessage.metadata.card_id] ??
                          pendingPostCreateMessage.metadata.due_date ??
                          null;
                        if (!start && !due) return 'Pick dates';
                        if (start && due) return `${formatDueDate(start)} → ${formatDueDate(due)}`;
                        return formatDueDate(start || due);
                      })()}
                    </button>
                  </div>

                  {expandedAssignId === pendingPostCreateMessage.metadata.card_id &&
                    renderMemberList(
                      pendingPostCreateMessage.metadata.card_id,
                      pendingPostCreateMessage.metadata.workspace_id
                    )}
                  {expandedDateCardId === pendingPostCreateMessage.metadata.card_id &&
                    renderDueDatePicker(
                      pendingPostCreateMessage.metadata.card_id,
                      pendingPostCreateMessage.metadata.start_date ?? null,
                      pendingPostCreateMessage.metadata.due_date ?? null
                    )}
                </div>

                {/* Same width as the bar above it, its own row — wrapping
                    up the task is a separate action from configuring it. */}
                <button
                  onClick={() => completeAssign(pendingPostCreateMessage.id)}
                  className='w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors'
                >
                  <Check className='w-3.5 h-3.5' /> Done with this task
                </button>
              </div>
            )}

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
                    {/* Hidden entirely while a preview is already showing —
                        every action that applies to it (Approve/Edit/
                        Cancel/Regenerate) now lives on the card itself, so
                        a second "create/regenerate" control down here would
                        just be a duplicate path to the same thing. */}
                    {!hasPendingSkeleton && (
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
                    )}
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
        </div>,
        isMobile ? document.body : (containerRef.current ?? document.body)
      )}
    </div>
  );
}
