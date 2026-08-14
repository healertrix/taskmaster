'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { DashboardHeader } from '../../components/dashboard/header';
import { ColumnContainer } from '../../components/board/ColumnContainer';
import { ListView } from '../../components/board/ListView';
import { TaskCard } from '../../components/board/TaskCard';
import { useBoard } from '@/hooks/useBoard';
import { useBoardStore } from '@/hooks/useBoardStore';
import { useAppStore } from '@/lib/stores/useAppStore';
import { AddListForm } from '../../components/board/AddListForm';
import { CardModal } from '../../components/board/CardModal';
import { DateTimeRangePicker } from '@/components/ui/DateTimeRangePicker';
import { EntityInfoModal } from '@/components/ui/EntityInfoModal';
import { CardMemberPicker } from '../../components/board/CardMemberPicker';
import { MoveCardModal } from '../../components/board/MoveCardModal';
import {
  BoardSkeleton,
  BoardListViewSkeleton,
} from '../../components/ui/skeletons';
import { colorForNumber, colorForKey, colorForEntity } from '@/utils/idColor';
import { AISummaryModal } from '@/app/components/ai/AISummaryModal';
import {
  Star,
  User,
  Users,
  Plus,
  MoreHorizontal,
  Filter,
  Search,
  ChevronDown,
  Sparkles,
  Clock,
  CheckSquare,
  ArrowUp,
  Bug,
  Paperclip,
  MessageSquare,
  X,
  ArrowLeft,
  Settings,
  Share2,
  Archive,
  Edit3,
  Loader2,
  Info,
  CheckCircle2,
  AlertCircle,
  Trash2,
  LayoutGrid,
  List,
  Tag,
  ListChecks,
} from 'lucide-react';
import LabelModal from '../../components/board/LabelModal';
import ManageCustomFieldsModal from '../../components/board/ManageCustomFieldsModal';
import { useBoardCustomFields } from '@/hooks/useBoardCustomFields';

// Define card/task type
interface Task {
  id: string;
  title: string;
  // Shareable display number, scoped per board — see the migration in
  // supabase/supabase/migrations/20260807120000_add_scoped_display_numbers.sql.
  number?: number;
  labels?: { color: string; text: string }[];
  assignees?: {
    initials: string;
    color: string;
    avatar_url?: string;
    full_name?: string;
  }[];
  attachments?: number;
  comments?: number;
  start_date?: string;
  due_date?: string;
  due_status?: 'due_soon' | 'overdue' | 'complete' | null;
  updated_at?: string;
}

// Define column type
interface Column {
  id: string;
  title: string;
  // Shareable display number, scoped per board — see Task.number above.
  number?: number;
  // Whether this list counts toward "completed" in My Tasks — see
  // supabase/supabase/migrations/20260808150000_add_list_is_done.sql.
  is_done_list?: boolean;
  cards: Task[];
}

// Board name editor component
const BoardNameEditor = ({
  boardName,
  onSave,
}: {
  boardName: string;
  onSave: (name: string) => Promise<boolean>;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(boardName);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (editName.trim() === boardName || !editName.trim()) {
      setIsEditing(false);
      setEditName(boardName);
      return;
    }

    setIsSaving(true);
    const success = await onSave(editName);
    setIsSaving(false);

    if (success) {
      setIsEditing(false);
    } else {
      setEditName(boardName); // Revert on failure
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditName(boardName);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className='flex items-center gap-2 w-full'>
        <input
          type='text'
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className='text-lg sm:text-2xl font-bold bg-transparent border-b-2 border-primary focus:outline-none w-full min-w-0'
          autoFocus
          disabled={isSaving}
          placeholder='Board name'
          aria-label='Edit board name'
        />
        {isSaving && <Loader2 className='w-4 h-4 animate-spin flex-shrink-0' />}
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className='text-lg sm:text-2xl font-bold hover:bg-muted/50 px-2 py-1 rounded transition-colors flex items-center gap-2 w-full text-left min-w-0'
    >
      <span className='truncate flex-1 heading-enter'>{boardName}</span>
      <Edit3 className='w-3 h-3 sm:w-4 sm:h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0' />
    </button>
  );
};

// List identity is a small colored dot, not a full-panel wash — derived
// from the list's own display number (see utils/idColor.ts) rather than a
// user pick, so it's stable across reloads and needs no color-picker UI.
// Falls back to hashing the list's UUID for any row that somehow doesn't
// have a number yet.
const getColumnStyle = (id: string, number?: number) =>
  number != null ? colorForNumber(number) : colorForKey(id);

// Shown when the board fetch fails. If it failed specifically because the
// board no longer exists (most often: it was just deleted, and this is a
// stale tile/link that hadn't been refreshed yet), this auto-redirects
// back after a moment instead of dead-ending on a scary error page the
// user has to manually click out of. A genuine fetch error (network,
// permissions, etc.) still just shows the message with a manual way back.
function BoardGoneOrError({
  boardGone,
  message,
  onGoBack,
}: {
  boardGone: boolean;
  message: string;
  onGoBack: () => void;
}) {
  useEffect(() => {
    if (!boardGone) return;
    const timeout = setTimeout(onGoBack, 1800);
    return () => clearTimeout(timeout);
  }, [boardGone, onGoBack]);

  return (
    <div className='min-h-screen flex flex-col items-center justify-center'>
      <div className='text-center'>
        <h1 className='text-2xl font-bold text-foreground mb-2'>
          {boardGone ? 'Board not found' : 'Error loading board'}
        </h1>
        <p className='text-muted-foreground mb-4'>
          {boardGone ? "This board doesn't exist anymore." : message}
        </p>
        {boardGone ? (
          <p className='text-sm text-muted-foreground'>Taking you back…</p>
        ) : (
          <button
            onClick={onGoBack}
            className='px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors'
          >
            Go Back
          </button>
        )}
      </div>
    </div>
  );
}

export default function BoardPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // Board settings and deletion states
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showManageLabelsModal, setShowManageLabelsModal] = useState(false);
  const [showManageCustomFieldsModal, setShowManageCustomFieldsModal] =
    useState(false);
  const [showBoardDeletionModal, setShowBoardDeletionModal] = useState(false);
  const [deletionConfirmName, setDeletionConfirmName] = useState('');
  const [isDeletingBoard, setIsDeletingBoard] = useState(false);
  const [deletionStats, setDeletionStats] = useState<any>(null);
  const [showDeletionDetails, setShowDeletionDetails] = useState(false);

  // Card modal states
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isUpdatingLabels, setIsUpdatingLabels] = useState(false);

  // Quick-edit popovers — dates/assignee editable directly from a card's
  // row/tile (list view or board view) without opening the full CardModal.
  // Lifted up here rather than living inside TaskRow/TaskCard themselves
  // because DateTimeRangePicker/CardMemberPicker both need board/workspace
  // context those components don't otherwise carry.
  const [quickEditDatesCardId, setQuickEditDatesCardId] = useState<
    string | null
  >(null);
  const [quickEditAssigneeCardId, setQuickEditAssigneeCardId] = useState<
    string | null
  >(null);

  // Move card modal states
  const [showMoveCardModal, setShowMoveCardModal] = useState(false);
  const [moveCardData, setMoveCardData] = useState<{
    cardId: string;
    cardTitle: string;
    currentListId: string;
    currentListName: string;
  } | null>(null);

  // Notification states
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccessToastFading, setIsSuccessToastFading] = useState(false);
  const [isErrorToastFading, setIsErrorToastFading] = useState(false);

  // Use the board hook to fetch real data
  const {
    board,
    members,
    loading,
    error,
    isStarring,
    toggleStar,
    updateBoardName,
    updateBoardDescription,
  } = useBoard(params.id);

  const {
    fields: customFields,
    isLoading: isLoadingCustomFields,
    refetch: refetchCustomFields,
  } = useBoardCustomFields(params.id);

  const { removeBoardFromCache } = useAppStore();

  // Use the board store hook for real-time data management
  const {
    lists,
    loading: listsLoading,
    error: listsError,
    isCreating: isCreatingList,
    createList,
    createCard,
    deleteCard,
    updateListName,
    updateCard,
    moveCard,
    archiveList,
    deleteList,
    toggleListDone,
    updateCardLabels,
    updateCardMembers,
    refetch,
    getBoardLabels,
    getCardLabels,
    getWorkspaceMembers,
    getCardMembers,
  } = useBoardStore(params.id);

  // Local UI state for columns (needed for optimistic updates)
  const [columns, setColumns] = useState<Column[]>([]);

  // In-board search — filters cards by title OR by card number ("#12" or
  // plain "12" both find card number 12) across every list, in both board
  // and list view. Lists themselves always stay visible (so you can still
  // see which list a match is in / add to an empty one) — only the cards
  // inside get filtered.
  const [boardSearchQuery, setBoardSearchQuery] = useState('');
  const trimmedBoardSearch = boardSearchQuery.trim();
  const searchedCardNumber = /^#?\d+$/.test(trimmedBoardSearch)
    ? parseInt(trimmedBoardSearch.replace('#', ''), 10)
    : null;
  const filteredColumns =
    trimmedBoardSearch.length > 0
      ? columns.map((col) => ({
          ...col,
          cards: col.cards.filter(
            (card) =>
              card.title
                .toLowerCase()
                .includes(trimmedBoardSearch.toLowerCase()) ||
              (searchedCardNumber != null && card.number === searchedCardNumber)
          ),
        }))
      : columns;

  // Board/List view toggle, remembered per board in localStorage. Lazy
  // initializer so the very first client render already reads the saved
  // value instead of flashing "board" first — guarded for SSR since
  // localStorage doesn't exist there.
  const [boardView, setBoardView] = useState<'board' | 'list'>(() => {
    if (typeof window === 'undefined') return 'board';
    const saved = window.localStorage.getItem(`taskmaster:board-view:${params.id}`);
    return saved === 'list' ? 'list' : 'board';
  });

  useEffect(() => {
    window.localStorage.setItem(`taskmaster:board-view:${params.id}`, boardView);
  }, [boardView, params.id]);

  // Keep columns in sync with the latest lists from the hook
  useEffect(() => {
    const converted = lists.map((list) => ({
      id: list.id,
      title: list.name,
      number: list.number,
      is_done_list: list.is_done_list,
      cards: list.cards.map((card) => ({
        id: card.id,
        title: card.title,
        number: card.number,
        labels: card.card_labels?.map((label) => ({
          color: label.labels.color,
          text: label.labels.name,
        })),
        assignees: card.card_members?.map((member) => ({
          initials: member.profiles.full_name
            .split(' ')
            .map((n) => n[0])
            .join(''),
          color: 'bg-primary',
          avatar_url: member.profiles.avatar_url,
          full_name: member.profiles.full_name,
        })),
        start_date: card.start_date,
        due_date: card.due_date,
        due_status: card.due_status,
        updated_at: card.updated_at,
        attachments: card.attachments,
        comments: card.comments,
      })),
    }));
    setColumns(converted);
  }, [lists]);

  // Simple back navigation using browser history
  const handleGoBack = () => {
    router.back();
  };

  // Notification helper functions
  const showSuccess = useCallback((message: string) => {
    // Defer state updates to avoid "Cannot update a component while rendering a different component" warning
    setTimeout(() => {
      setSuccessMessage(message);
      setShowSuccessToast(true);
      setIsSuccessToastFading(false);

      // Start fade out animation after 3.5 seconds
      setTimeout(() => {
        setIsSuccessToastFading(true);
        // Remove toast after fade animation completes
        setTimeout(() => {
          setShowSuccessToast(false);
          setIsSuccessToastFading(false);
        }, 500);
      }, 3500);
    }, 0);
  }, []);

  const showError = useCallback((message: string) => {
    // Defer state updates to avoid "Cannot update a component while rendering a different component" warning
    setTimeout(() => {
      setErrorMessage(message);
      setShowErrorToast(true);
      setIsErrorToastFading(false);

      // Start fade out animation after 4.5 seconds
      setTimeout(() => {
        setIsErrorToastFading(true);
        // Remove toast after fade animation completes
        setTimeout(() => {
          setShowErrorToast(false);
          setIsErrorToastFading(false);
        }, 500);
      }, 4500);
    }, 0);
  }, []);

  // Track board access when component mounts (background, non-blocking)
  useEffect(() => {
    if (params.id) {
      // Use setTimeout to defer tracking until after initial render
      setTimeout(async () => {
        try {
          const { trackBoardAccess } = await import('@/utils/boardAccess');
          await trackBoardAccess(params.id);
        } catch (error) {
          console.error('Error tracking board access:', error);
        }
      }, 0);
    }
  }, [params.id]);

  // Handle opening card from URL parameter
  useEffect(() => {
    const cardId = searchParams?.get('card');
    if (cardId && columns.length > 0) {
      // Check if the card exists in the current board
      const cardExists = columns.some((column) =>
        column.cards.some((card) => card.id === cardId)
      );

      if (cardExists) {
        setSelectedCardId(cardId);
        setIsCardModalOpen(true);

        // Remove the card parameter from URL without triggering a page reload
        const url = new URL(window.location.href);
        url.searchParams.delete('card');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [searchParams, columns]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDescriptionModalOpen) {
        setIsDescriptionModalOpen(false);
      }
      if (e.key === 'Escape' && showSettingsDropdown) {
        setShowSettingsDropdown(false);
      }
    };

    if (isDescriptionModalOpen || showSettingsDropdown) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isDescriptionModalOpen, showSettingsDropdown]);

  // Close settings dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsDropdownRef.current &&
        !settingsDropdownRef.current.contains(event.target as Node)
      ) {
        setShowSettingsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Board deletion function
  const deleteBoard = async () => {
    if (!board || deletionConfirmName !== board.name) {
      showError('Please type the board name exactly to confirm deletion');
      return;
    }

    setIsDeletingBoard(true);

    try {
      const response = await fetch(`/api/boards/${params.id}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          boardName: board.name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete board');
      }

      setDeletionStats(data.deletionStats);
      showSuccess('Board deleted successfully');

      // Clear this board out of the workspace board-list cache — without
      // this, the /boards/[workspaceId] page (and its own client-side
      // cache, which isn't cleared just by navigating) kept showing the
      // deleted board's tile until a hard refresh, and clicking it hit the
      // now-gone row and threw "Cannot coerce the result to a single JSON
      // object" instead of the tile simply not being there anymore.
      removeBoardFromCache(board.workspace.id, params.id);

      // Go to the workspace's board list — deterministic, unlike
      // router.back(), which goes wherever browser history happens to
      // point (an external referrer, a bookmark, nothing at all) rather
      // than somewhere that still makes sense once this board is gone.
      setTimeout(() => {
        router.push(`/boards/${board.workspace.id}`);
      }, 2000);
    } catch (error) {
      console.error('Error deleting board:', error);
      showError(
        error instanceof Error ? error.message : 'Failed to delete board'
      );
    } finally {
      setIsDeletingBoard(false);
    }
  };

  const [dragOverInfo, setDragOverInfo] = useState<{
    id: string | null;
    type: 'column' | 'task' | null;
    index: number | null;
    columnId: string | null;
  }>({
    id: null,
    type: null,
    index: null,
    columnId: null,
  });

  // Configure sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Reduced to make it more responsive
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle creating a new list
  const handleCreateList = async (name: string): Promise<boolean> => {
    const newList = await createList(name);
    return !!newList;
  };

  // Handle archiving a list with notifications
  const handleArchiveList = useCallback(
    async (listId: string): Promise<boolean> => {
      // Find the list name
      const list = lists.find((l) => l.id === listId);
      const listName = list?.name || 'List';

      const success = await archiveList(listId);
      if (success) {
        showSuccess(`List "${listName}" archived successfully`);
      } else {
        showError(`Failed to archive list "${listName}"`);
      }
      return success;
    },
    [lists, archiveList, showSuccess, showError]
  );

  // Handle deleting a list with notifications
  const handleDeleteList = useCallback(
    async (listId: string): Promise<boolean> => {
      // Find the list name
      const list = lists.find((l) => l.id === listId);
      const listName = list?.name || 'List';

      const success = await deleteList(listId);
      if (success) {
        showSuccess(`List "${listName}" deleted successfully`);
      } else {
        showError(`Failed to delete list "${listName}"`);
      }
      return success;
    },
    [lists, deleteList, showSuccess, showError]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      // Find the task to get its title for the notification
      let taskTitle = 'Task';
      for (const list of lists) {
        const task = list.cards.find((card) => card.id === taskId);
        if (task) {
          taskTitle = task.title;
          break;
        }
      }

      const success = await deleteCard(taskId);
      if (success) {
        showSuccess(`Card "${taskTitle}" deleted successfully`);
      } else {
        showError(`Failed to delete card "${taskTitle}"`);
      }
      return success;
    },
    [lists, deleteCard, showSuccess, showError]
  );

  // Move card handler
  const handleMoveTask = (taskId: string) => {
    // Find the task and its current list
    let taskTitle = 'Task';
    let currentListId = '';
    let currentListName = 'List';

    for (const list of lists) {
      const task = list.cards.find((card) => card.id === taskId);
      if (task) {
        taskTitle = task.title;
        currentListId = list.id;
        currentListName = list.name;
        break;
      }
    }

    setMoveCardData({
      cardId: taskId,
      cardTitle: taskTitle,
      currentListId: currentListId,
      currentListName: currentListName,
    });
    setShowMoveCardModal(true);
  };

  const handleCloseMoveModal = () => {
    setShowMoveCardModal(false);
    setMoveCardData(null);
  };

  const handleMoveSuccess = useCallback(() => {
    // Board data will be automatically updated by the store
    // No need for manual refetch since useBoardStore manages real-time updates
    showSuccess('Card moved successfully');
  }, [showSuccess]);

  // Card modal handlers
  const handleOpenCard = (cardId: string) => {
    setSelectedCardId(cardId);
    setIsCardModalOpen(true);
  };

  const handleCloseCard = () => {
    setSelectedCardId(null);
    setIsCardModalOpen(false);
  };

  // Debounce utility function
  function debounce(func: Function, wait: number) {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const handleUpdateCard = useCallback(
    async (cardId: string, updates: any): Promise<boolean> => {
      // Declared outside the try block so the catch block below can use it
      // to revert the optimistic update if the save fails.
      let previousValues: Record<string, any> | null = null;
      try {
        // If only updating timestamp (from activity refresh), just update local state
        if (Object.keys(updates).length === 1 && updates.updated_at) {
          // Defer state updates to avoid setState during render warning
          setTimeout(() => {
            setColumns((prevColumns) =>
              prevColumns.map((column) => ({
                ...column,
                cards: column.cards.map((card) =>
                  card.id === cardId
                    ? {
                        ...card,
                        updated_at: updates.updated_at,
                      }
                    : card
                ),
              }))
            );

            // Update the card in lists state for CardModal
            updateCard(cardId, {
              updated_at: updates.updated_at,
            });
          }, 0);

          return true;
        }

        // Find the card's current values so we can revert if the save
        // fails, and apply the edit optimistically so the UI (and
        // CardModal, which reads the card from this same `lists` state)
        // reflects it immediately instead of waiting on the round-trip.
        for (const list of lists) {
          const existing = list.cards.find((c: any) => c.id === cardId);
          if (existing) {
            previousValues = {};
            Object.keys(updates).forEach((key) => {
              previousValues![key] = (existing as any)[key];
            });
            break;
          }
        }
        updateCard(cardId, updates);

        // For actual field updates, make API call
        const response = await fetch(`/api/cards/${cardId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update card');
        }

        // Reconcile with the server's canonical values (e.g. computed
        // due_status) now that the save has actually completed.
        updateCard(cardId, {
          title: data.card.title,
          description: data.card.description,
          start_date: data.card.start_date,
          due_date: data.card.due_date,
          due_status: data.card.due_status,
          updated_at: data.card.updated_at,
        });

        showSuccess('Card updated successfully');
        return true;
      } catch (error) {
        console.error('Error updating card:', error);
        // Revert the optimistic update
        if (previousValues) {
          updateCard(cardId, previousValues);
        }
        showError(
          error instanceof Error ? error.message : 'Failed to update card'
        );
        return false;
      }
    },
    [updateCard, showSuccess, showError, lists]
  );

  // Handle labels updated - update store for instant UI sync
  const handleLabelsUpdated = useCallback(
    async (labelId?: string, labelData?: any) => {
      if (!selectedCardId) return;

      try {
        // Fetch fresh card labels from API
        const response = await fetch(`/api/cards/${selectedCardId}/labels`);
        const data = await response.json();

        if (response.ok) {
          // Update the store with fresh labels data
          updateCardLabels(selectedCardId, data.labels || []);

          // Also trigger card update for timestamp
          handleUpdateCard(selectedCardId, {
            updated_at: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Error fetching updated labels:', error);
      }
    },
    [selectedCardId, updateCardLabels, handleUpdateCard]
  );

  // Handle members updated - update store for instant UI sync
  const handleMembersUpdated = useCallback(
    async (memberId?: string, memberData?: any) => {
      if (!selectedCardId) return;

      try {
        // Fetch fresh card members from API
        const response = await fetch(`/api/cards/${selectedCardId}/members`);
        const data = await response.json();

        if (response.ok) {
          // Update the store with fresh members data
          updateCardMembers(selectedCardId, data.members || []);

          // Also trigger card update for timestamp
          handleUpdateCard(selectedCardId, {
            updated_at: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Error fetching updated members:', error);
      }
    },
    [selectedCardId, updateCardMembers, handleUpdateCard]
  );

  // Same as handleMembersUpdated above, but for the quick-edit assignee
  // popover, which can be editing a *different* card than whichever one
  // (if any) is open in the full CardModal — so it can't rely on
  // selectedCardId the way that handler does.
  const handleQuickEditMembersUpdated = useCallback(
    async (cardId: string) => {
      try {
        const response = await fetch(`/api/cards/${cardId}/members`);
        const data = await response.json();

        if (response.ok) {
          updateCardMembers(cardId, data.members || []);
          handleUpdateCard(cardId, { updated_at: new Date().toISOString() });
        }
      } catch (error) {
        console.error('Error fetching updated members:', error);
      }
    },
    [updateCardMembers, handleUpdateCard]
  );

  // Finds a card (and its current data) across all lists, for the
  // quick-edit popovers to read starting values from.
  const findCardById = useCallback(
    (cardId: string) => {
      for (const list of lists) {
        const card = list.cards.find((c: any) => c.id === cardId);
        if (card) return card;
      }
      return null;
    },
    [lists]
  );

  // Removes a member from the quick-edit assignee popover — same DELETE
  // endpoint CardModal's own remove button uses. Applied optimistically
  // (the card is already loaded in `lists`, unlike the add flow above which
  // has nothing local to optimistically update against) and reconciled with
  // the server afterwards via handleQuickEditMembersUpdated; rolled back on
  // failure.
  const handleQuickEditMemberRemoved = useCallback(
    async (cardId: string, profileId: string) => {
      const card = findCardById(cardId);
      const previousMembers = (card as any)?.card_members || [];

      updateCardMembers(
        cardId,
        previousMembers.filter((m: any) => m.profiles.id !== profileId)
      );

      try {
        const response = await fetch(
          `/api/cards/${cardId}/members/${profileId}`,
          { method: 'DELETE' }
        );

        if (response.ok) {
          await handleQuickEditMembersUpdated(cardId);
        } else {
          updateCardMembers(cardId, previousMembers);
          showError('Failed to remove member');
        }
      } catch (error) {
        console.error('Error removing member:', error);
        updateCardMembers(cardId, previousMembers);
        showError('Failed to remove member');
      }
    },
    [findCardById, updateCardMembers, handleQuickEditMembersUpdated, showError]
  );

  // Enhanced move success handler that doesn't close the card modal
  const handleCardMoveSuccess = useCallback(
    (newListId: string, newListName: string) => {
      // Board data will be automatically updated by the store
      // No need for manual refetch since useBoardStore manages real-time updates
      showSuccess(`Card moved to "${newListName}" successfully`);
      // Note: We don't close the card modal here - it stays open for better UX
    },
    [showSuccess]
  );

  // Handle adding a new card to a column
  const handleAddCard = useCallback(
    async (columnId: string, cardTitle: string): Promise<boolean> => {
      if (!cardTitle.trim()) return false;

      try {
        // Use the hook's createCard function to save to database
        const newCard = await createCard(columnId, cardTitle.trim());

        if (!newCard) {
          showError('Failed to create card');
          return false;
        }

        // Convert the database card to the UI Task format and update columns state
        const newTask: Task = {
          id: newCard.id,
          title: newCard.title,
          labels: newCard.card_labels
            ? newCard.card_labels.map((cardLabel: any) => ({
                color: cardLabel.labels.color,
                text: cardLabel.labels.name || '',
              }))
            : [],
          assignees: newCard.profiles
            ? [
                {
                  initials: newCard.profiles.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase(),
                  color: 'bg-blue-500',
                },
              ]
            : [],
          attachments: 0,
          comments: 0,
          start_date: newCard.start_date,
          due_date: newCard.due_date,
          due_status: newCard.due_status,
        };

        // The createCard function already updates the lists state

        showSuccess(`Card "${cardTitle}" added successfully`);
        return true;
      } catch (error) {
        console.error('Error adding card:', error);
        showError('Failed to add card');
        return false;
      }
    },
    [createCard, showSuccess, showError]
  );

  // Show loading skeleton if board or lists are still loading — shaped to
  // match the remembered view (boardView is read from localStorage before
  // first paint, see its lazy initializer above) so the skeleton doesn't
  // flip layout once the real content lands.
  if (loading || listsLoading || !board || !lists) {
    return boardView === 'list' ? <BoardListViewSkeleton /> : <BoardSkeleton />;
  }

  // Handle error states
  if (error) {
    const boardGone = error.includes('no longer exists');

    return (
      <BoardGoneOrError
        boardGone={boardGone}
        message={error}
        onGoBack={() => router.back()}
      />
    );
  }

  if (listsError) {
    return (
      <div className='min-h-screen dot-pattern-dark flex flex-col items-center justify-center'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-destructive mb-2'>
            Error loading board data
          </h1>
          <p className='text-muted-foreground mb-4'>{listsError}</p>
          <button
            onClick={() => router.back()}
            className='px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors'
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  function findColumnById(id: string): Column | undefined {
    return columns.find((column) => column.id === id);
  }

  function findTaskById(
    id: string
  ): { task: Task; columnId: string } | undefined {
    for (const column of columns) {
      const task = column.cards.find((card) => card.id === id);
      if (task) {
        return { task, columnId: column.id };
      }
    }
    return undefined;
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const taskInfo = findTaskById(active.id as string);

    if (taskInfo) {
      const { task, columnId } = taskInfo;
      setActiveTask(task);
      setActiveColumnId(columnId);
    }

    // Reset drag over info when starting a new drag
    setDragOverInfo({
      id: null,
      type: null,
      index: null,
      columnId: null,
    });
  }

  // Create a custom collision detection strategy
  const collisionDetectionStrategy = (args: any) => {
    // First, let's use the built-in rectangle intersection strategy
    const intersections = rectIntersection(args);

    // If there are no intersections or we're not dragging, return the results
    if (!intersections?.length || !activeTask) return intersections;

    // Find the closest intersection - prioritize columns when moving horizontally
    // and tasks when moving vertically
    return closestCorners(args);
  };

  // Add a function to handle the drag over event
  function handleDragOver(event: any) {
    const { active, over } = event;

    if (!over) {
      setDragOverInfo({
        id: null,
        type: null,
        index: null,
        columnId: null,
      });
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Don't do anything if hovering over the active item
    if (activeId === overId) return;

    // Check if over is a column
    const isOverColumn = columns.some((col) => col.id === overId);

    if (isOverColumn) {
      // If over a column, set the drag over info
      const columnIndex = columns.findIndex((col) => col.id === overId);
      const column = columns[columnIndex];

      setDragOverInfo({
        id: overId,
        type: 'column',
        index: column.cards.length, // Will place at the end of the column
        columnId: overId,
      });
    } else {
      // If over a task, find the task and its column
      const overTaskInfo = findTaskById(overId);
      if (!overTaskInfo) return;

      const { columnId } = overTaskInfo;
      const column = findColumnById(columnId);
      if (!column) return;

      const taskIndex = column.cards.findIndex((task) => task.id === overId);

      setDragOverInfo({
        id: overId,
        type: 'task',
        index: taskIndex,
        columnId: columnId,
      });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    // Always reset dragOverInfo immediately
    setDragOverInfo({
      id: null,
      type: null,
      index: null,
      columnId: null,
    });

    // If there's no over element, we can't do anything
    if (!over) {
      setActiveTask(null);
      setActiveColumnId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // If dropped on itself, no changes needed
    if (activeId === overId) {
      setActiveTask(null);
      setActiveColumnId(null);
      return;
    }

    // Get information about active task
    const activeTaskInfo = findTaskById(activeId);
    if (!activeTaskInfo) {
      setActiveTask(null);
      setActiveColumnId(null);
      return;
    }

    const { columnId: sourceListId } = activeTaskInfo;

    // Check if over is a column or a task
    const isOverAColumn = columns.some((col) => col.id === overId);

    let targetListId: string;
    let newPosition: number;
    // Index into the target list's cards *excluding* the dragged card —
    // matches what the server's target-list query returns (it excludes the
    // card being moved too), so the two stay in the same coordinate space.
    // `newPosition` above is only for the local optimistic reorder, which
    // has its own same-list adjustment (see moveCard in useLists.ts) and
    // must not be reused here or the two adjustments would compound.
    let serverIndex: number;

    if (isOverAColumn) {
      targetListId = overId;
      const targetColumn = columns.find((col) => col.id === targetListId);
      newPosition = targetColumn ? targetColumn.cards.length : 0;
      const otherCards = targetColumn
        ? targetColumn.cards.filter((card) => card.id !== activeId)
        : [];
      serverIndex = otherCards.length;
    } else {
      const overTaskInfo = findTaskById(overId);
      if (!overTaskInfo) {
        setActiveTask(null);
        setActiveColumnId(null);
        return;
      }
      const { columnId: overColumnId } = overTaskInfo;
      targetListId = overColumnId;
      const targetColumn = columns.find((col) => col.id === targetListId);
      if (!targetColumn) {
        setActiveTask(null);
        setActiveColumnId(null);
        return;
      }
      const insertIndex = targetColumn.cards.findIndex(
        (card) => card.id === overId
      );
      newPosition = insertIndex;

      const otherCards = targetColumn.cards.filter(
        (card) => card.id !== activeId
      );
      const overIndexAmongOthers = otherCards.findIndex(
        (card) => card.id === overId
      );
      serverIndex =
        overIndexAmongOthers === -1 ? otherCards.length : overIndexAmongOthers;
    }

    moveCard(activeId, sourceListId, targetListId, newPosition);

    setTimeout(() => {
      setActiveTask(null);
      setActiveColumnId(null);
    }, 50);

    try {
      const response = await fetch(`/api/cards/${activeId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          list_id: targetListId,
          position: serverIndex,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to move card');
      }

      // No success toast here — the card visibly relocating is already
      // the feedback; a toast on top of every drag reads as noisy.
    } catch (error) {
      console.error('Error moving card:', error);
      showError('Failed to move card');
      refetch();
    }
  }

  // List view's drag-and-drop: same optimistic-update-then-persist pattern
  // as handleDragEnd above, just driven by ListView's own DnD instead of
  // the kanban board's. Plain function, not useCallback — declared after
  // the loading-gate early return below, same reasoning as handleDragEnd.
  const handleMoveCardInListView = async (
    cardId: string,
    sourceListId: string,
    targetListId: string,
    newIndex: number
  ) => {
    moveCard(cardId, sourceListId, targetListId, newIndex);

    try {
      const response = await fetch(`/api/cards/${cardId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list_id: targetListId,
          position: newIndex,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to move card');
      }

      // No success toast — same reasoning as handleDragEnd above.
    } catch (error) {
      console.error('Error moving card:', error);
      showError('Failed to move card');
      refetch();
    }
  };

  // Format the last access time
  const formatLastAccess = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div
      // Board (kanban/grid) view is a fixed-height shell — no page-level
      // scroll — so the row of columns is immediately usable without
      // scrolling down first, and horizontal scroll always works right
      // away on any screen size (see ColumnContainer, which now sizes off
      // this real bounded height via flexbox instead of a magic-number vh
      // calc). List view keeps the old window-scrolling shell — it
      // already scrolls correctly at the page level and wasn't the
      // reported problem.
      className={`dot-pattern-dark flex flex-col ${
        boardView === 'list' ? 'min-h-screen' : 'h-dvh overflow-hidden'
      }`}
    >
      <DashboardHeader />

      {/* Board Header */}
      {/* pt-20, not pt-16 — the fixed header (icon buttons + w-9 h-9
          avatar + border-b) runs close enough to 64px on real devices
          that this row was getting clipped under it. The starred page
          already made this exact bump for the same reason. */}
      <div className='flex-shrink-0 container mx-auto max-w-full px-3 sm:px-4 pt-20 sm:pt-24 pb-3 sm:pb-8'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 group'>
          {/* Mobile: Board name first, then breadcrumb */}
          <div className='flex flex-col gap-2 sm:hidden min-w-0'>
            {/* Board name - prominent on mobile */}
            <div className='flex items-center gap-2'>
              <button
                onClick={handleGoBack}
                className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0'
                title='Go back'
              >
                <ArrowLeft className='w-4 h-4' />
              </button>
              <div className='min-w-0 flex-1 flex items-center gap-2'>
                {/* Board's own color — derived from its display number
                    (see utils/idColor.ts), not user-picked. */}
                <span
                  className='w-2.5 h-2.5 rounded-full flex-shrink-0'
                  style={{
                    backgroundColor:
                      board.number != null
                        ? colorForNumber(board.number)
                        : colorForKey(board.id),
                  }}
                  title='Board color'
                />
                <BoardNameEditor
                  boardName={board.name}
                  onSave={updateBoardName}
                />
                {board.number != null && (
                  <span
                    className='text-xs text-muted-foreground flex-shrink-0'
                    title='Board number'
                  >
                    #{board.number}
                  </span>
                )}
              </div>
            </div>

            {/* Workspace breadcrumb - subtle on mobile */}
            <div className='flex items-center gap-2 ml-7'>
              <div
                className='w-4 h-4 rounded text-white flex items-center justify-center text-xs font-bold flex-shrink-0'
                style={{
                  backgroundColor: colorForEntity(
                    board.workspace.id,
                    board.workspace.number
                  ),
                }}
              >
                {board.workspace.name.charAt(0).toUpperCase()}
              </div>
              <Link
                href={`/boards/${board.workspace.id}`}
                className='text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer truncate'
                title={`Go to ${board.workspace.name} workspace`}
              >
                {board.workspace.name}
              </Link>
            </div>
          </div>

          {/* Desktop: Traditional layout */}
          <div className='hidden sm:flex items-center gap-4 min-w-0 flex-1'>
            <button
              onClick={handleGoBack}
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0'
              title='Go back'
            >
              <ArrowLeft className='w-5 h-5' />
            </button>

            <div className='flex items-center gap-3 min-w-0 flex-1'>
              {/* Workspace indicator */}
              <div className='flex items-center gap-2 min-w-0'>
                <div
                  className='w-8 h-8 rounded-lg text-white flex items-center justify-center text-sm font-bold shadow-md flex-shrink-0'
                  style={{
                    backgroundColor: colorForEntity(
                      board.workspace.id,
                      board.workspace.number
                    ),
                  }}
                >
                  {board.workspace.name.charAt(0).toUpperCase()}
                </div>
                <Link
                  href={`/boards/${board.workspace.id}`}
                  className='text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer truncate'
                  title={`Go to ${board.workspace.name} workspace`}
                >
                  {board.workspace.name}
                </Link>
              </div>

              <span className='text-muted-foreground'>/</span>

              {/* Board name - editable */}
              <div className='min-w-0 flex-1 flex items-center gap-2'>
                {/* Board's own color — see the matching mobile comment
                    above for why this exists. */}
                <span
                  className='w-2.5 h-2.5 rounded-full flex-shrink-0'
                  style={{
                    backgroundColor:
                      board.number != null
                        ? colorForNumber(board.number)
                        : colorForKey(board.id),
                  }}
                  title='Board color'
                />
                <BoardNameEditor
                  boardName={board.name}
                  onSave={updateBoardName}
                />
                {board.number != null && (
                  <span
                    className='text-xs text-muted-foreground flex-shrink-0'
                    title='Board number'
                  >
                    #{board.number}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions - always on the right */}
          <div className='flex items-center justify-end gap-2 sm:gap-4 flex-shrink-0'>
            {/* In-board search — filters cards by title in both views */}
            <div className='relative hidden sm:block w-40 lg:w-56'>
              <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground' />
              <input
                type='text'
                value={boardSearchQuery}
                onChange={(e) => setBoardSearchQuery(e.target.value)}
                placeholder='Search by title or #number...'
                className='w-full pl-8 pr-3 py-1.5 text-sm bg-muted/40 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all'
              />
            </div>

            {/* Board / List view toggle */}
            <div className='flex items-center gap-0.5 p-0.5 bg-muted/40 border border-border/50 rounded-lg'>
              <button
                onClick={() => setBoardView('board')}
                title='Board view'
                className={`p-1.5 rounded-md transition-colors ${
                  boardView === 'board'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className='w-4 h-4' />
              </button>
              <button
                onClick={() => setBoardView('list')}
                title='List view'
                className={`p-1.5 rounded-md transition-colors ${
                  boardView === 'list'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <List className='w-4 h-4' />
              </button>
            </div>

            {/* Info button */}
            <button
              onClick={() => setIsDescriptionModalOpen(true)}
              className='p-2 sm:p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              title='Board information'
            >
              <Info className='w-4 h-4 sm:w-5 sm:h-5' />
            </button>

            {/* AI activity summary */}
            <button
              onClick={() => setIsSummaryModalOpen(true)}
              className='p-2 sm:p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              title='Summarize recent activity'
            >
              <Sparkles className='w-4 h-4 sm:w-5 sm:h-5' />
            </button>

            {/* last_activity_at reflects any activity on the board (cards,
                lists, comments — see bump_board_last_activity trigger),
                not just edits to the board's own name/description/color
                (that's updated_at). Falls back to updated_at for boards
                that predate the trigger. */}
            <div className='hidden md:flex items-center gap-2 text-sm text-muted-foreground'>
              <Clock className='w-4 h-4' />
              <span>
                Last updated{' '}
                {formatLastAccess(board.last_activity_at || board.updated_at)}
              </span>
            </div>

            {/* Labels updating indicator */}
            {isUpdatingLabels && (
              <div className='flex items-center gap-2 text-sm text-accent'>
                <Loader2 className='w-4 h-4 animate-spin' />
                <span>Updating labels...</span>
              </div>
            )}

            {/* Star button */}
            <button
              onClick={toggleStar}
              disabled={isStarring}
              className={`p-2 rounded-lg transition-all duration-200 ${
                board.is_starred
                  ? 'text-yellow-400 hover:text-yellow-500 bg-yellow-400/10'
                  : 'text-muted-foreground hover:text-yellow-400 hover:bg-yellow-400/10'
              } ${isStarring ? 'animate-pulse' : ''}`}
              title={board.is_starred ? 'Unstar board' : 'Star board'}
            >
              <Star
                className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 ${
                  isStarring ? 'scale-110' : ''
                }`}
                fill={board.is_starred ? 'currentColor' : 'none'}
              />
            </button>

            {/* Board Settings Dropdown */}
            <div className='relative' ref={settingsDropdownRef}>
              <button
                onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
                title='Board settings'
              >
                <Settings className='w-4 h-4 sm:w-5 sm:h-5' />
              </button>

              {/* Settings Dropdown Menu */}
              {showSettingsDropdown && (
                <div className='absolute top-full right-0 mt-2 w-64 bg-card/95 backdrop-blur-xl border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150'>
                  {/* Board color is no longer user-editable — it's derived
                      from the board's own display number (see
                      utils/idColor.ts), same everywhere it's shown. */}

                  {/* Manage Labels / Custom Fields — the only entry points
                      for these outside opening a card and clicking its
                      label/field icons. */}
                  <div className='p-2 border-b border-border'>
                    <button
                      onClick={() => {
                        setShowManageLabelsModal(true);
                        setShowSettingsDropdown(false);
                      }}
                      className='w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 rounded-lg transition-colors'
                    >
                      <Tag className='w-4 h-4 text-muted-foreground' />
                      <div className='font-medium text-sm'>Manage labels</div>
                    </button>
                    <button
                      onClick={() => {
                        setShowManageCustomFieldsModal(true);
                        setShowSettingsDropdown(false);
                      }}
                      className='w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 rounded-lg transition-colors'
                    >
                      <ListChecks className='w-4 h-4 text-muted-foreground' />
                      <div className='font-medium text-sm'>
                        Manage custom fields
                      </div>
                    </button>
                  </div>

                  {/* Delete Board Option — same single-line size as
                      Manage labels/custom fields above; the two-line
                      title+description version stood out as visibly
                      bigger than everything else in this menu. */}
                  <div className='p-2'>
                    <button
                      onClick={() => {
                        setDeletionConfirmName('');
                        setShowDeletionDetails(false);
                        setShowBoardDeletionModal(true);
                        setShowSettingsDropdown(false);
                      }}
                      title='Permanently delete this board and all its content'
                      className='w-full flex items-center gap-3 px-3 py-2 text-left text-destructive hover:bg-destructive/10 rounded-lg transition-colors'
                    >
                      <Trash2 className='w-4 h-4' />
                      <div className='font-medium text-sm'>Delete board</div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board - Full width without padding */}
      {boardView === 'list' ? (
        <ListView
          columns={filteredColumns}
          boardNumber={board.number}
          onOpenCard={handleOpenCard}
          onAddCard={handleAddCard}
          onDeleteList={handleDeleteList}
          onUpdateListName={updateListName}
          onToggleDoneList={toggleListDone}
          onMoveTask={handleMoveTask}
          onDeleteTask={handleDeleteTask}
          // Same reasoning as the grid view's sensors guard above — disable
          // reordering while a search filter is narrowing what's shown, so
          // a drop index computed against the filtered list can't land a
          // card in the wrong spot in the real (unfiltered) one.
          onMoveCard={
            boardSearchQuery.trim() ? undefined : handleMoveCardInListView
          }
          onUpdateCardTitle={(cardId, title) =>
            handleUpdateCard(cardId, { title })
          }
          onEditDates={setQuickEditDatesCardId}
          onEditAssignee={setQuickEditAssigneeCardId}
        />
      ) : (
      <div className='flex-1 min-h-0 overflow-x-auto'>
        <DndContext
          // Dragging is disabled (no sensor to trigger it) while a search
          // filter is active — filteredColumns' card indices don't line up
          // with the real (unfiltered) list positions that handleDragEnd
          // computes against, so reordering while filtered could silently
          // drop a card in the wrong slot. Clear the search to reorder.
          sensors={boardSearchQuery.trim() ? [] : sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* Deliberately NOT items-start here: each column's wrapping
              slot below still needs to stretch to the row's full,
              definite height — that's what lets max-h-full on
              ColumnContainer's own root correctly cap a long list (and
              keep the whole PAGE from needing to scroll). The "short
              lists stay short" behavior instead comes from
              ColumnContainer's root being naturally auto-height (not
              itself stretched — it isn't a flex child of anything, only
              its invisible slot wrapper is), capped by that same
              max-h-full. Adding items-start here breaks the slot's own
              height into `auto`, which breaks the percentage basis
              max-h-full needs — that's what caused the whole-page-scroll
              regression. */}
          <div className='flex gap-6 h-full min-w-max px-4'>
            {filteredColumns.map((column) => (
              <div key={column.id} className='flex-shrink-0'>
                <ColumnContainer
                  column={column}
                  tasks={column.cards}
                  getColumnStyle={getColumnStyle}
                  boardNumber={board.number}
                  dragOverInfo={dragOverInfo}
                  activeTaskId={activeTask?.id}
                  onUpdateListName={updateListName}
                  onArchiveList={handleArchiveList}
                  onDeleteList={handleDeleteList}
                  onToggleDoneList={toggleListDone}
                  onAddCard={handleAddCard}
                  onDeleteTask={handleDeleteTask}
                  onMoveTask={handleMoveTask}
                  onOpenCard={handleOpenCard}
                  onUpdateCardTitle={(cardId, title) =>
                    handleUpdateCard(cardId, { title })
                  }
                  onEditDates={setQuickEditDatesCardId}
                  onEditAssignee={setQuickEditAssigneeCardId}
                />
              </div>
            ))}

            {/* Add List Form */}
            <AddListForm
              onCreateList={handleCreateList}
              isCreating={isCreatingList}
            />
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask && (
              <div className='transform scale-105 rotate-1 shadow-2xl'>
                <TaskCard
                  task={activeTask}
                  columnId={activeColumnId || ''}
                  isBeingDragged={false}
                  onDeleteTask={handleDeleteTask}
                  onMoveTask={handleMoveTask}
                  onOpenCard={handleOpenCard}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
      )}

      {/* Description Modal */}
      <EntityInfoModal
        isOpen={isDescriptionModalOpen}
        onClose={() => setIsDescriptionModalOpen(false)}
        entityType='board'
        name={board.name}
        colorSeed={board.id}
        number={board.number}
        description={board.description || ''}
        onSave={updateBoardDescription}
        createdAt={board.created_at}
        updatedAt={board.last_activity_at}
      />

      {isSummaryModalOpen && (
        <AISummaryModal
          scope='board'
          id={board.id}
          label={board.name}
          onClose={() => setIsSummaryModalOpen(false)}
        />
      )}

      {/* Manage Labels — card-less mode, opened from the settings
          dropdown rather than a card's label icon. */}
      <LabelModal
        isOpen={showManageLabelsModal}
        onClose={() => setShowManageLabelsModal(false)}
        boardId={board.id}
      />

      <ManageCustomFieldsModal
        isOpen={showManageCustomFieldsModal}
        onClose={() => setShowManageCustomFieldsModal(false)}
        boardId={board.id}
        fields={customFields}
        isLoading={isLoadingCustomFields}
        onFieldsChanged={refetchCustomFields}
      />

      {/* Board Deletion Confirmation Modal */}
      {showBoardDeletionModal && board && (
        <div className='fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6'>
          <div className='bg-card/90 backdrop-blur-xl rounded-lg shadow-xl max-w-lg w-full p-6 border border-destructive/30'>
            <div className='flex items-center gap-3 mb-6'>
              <div className='w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center'>
                <Trash2 className='w-6 h-6 text-destructive' />
              </div>
              <div>
                <h3 className='text-xl font-bold text-foreground'>
                  Delete Board
                </h3>
                <p className='text-sm text-muted-foreground'>
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className='space-y-6'>
              {/* Consequences */}
              <div className='p-4 bg-destructive/10 border border-destructive/30 rounded-lg'>
                <h4 className='font-semibold text-destructive mb-3 flex items-center gap-2'>
                  <AlertCircle className='w-4 h-4' />
                  What will be deleted:
                </h4>
                <ul className='text-sm text-destructive/90 space-y-2'>
                  <li className='flex items-center gap-2'>
                    <Trash2 className='w-3 h-3' />
                    The board "{board.name}" and all its settings
                  </li>
                  <li className='flex items-center gap-2'>
                    <LayoutGrid className='w-3 h-3' />
                    All lists and cards in this board
                  </li>
                  <li className='flex items-center gap-2'>
                    <Users className='w-3 h-3' />
                    All member access and permissions
                  </li>
                  <li className='flex items-center gap-2'>
                    <MessageSquare className='w-3 h-3' />
                    All comments, attachments, and activity history
                  </li>
                </ul>
              </div>

              {/* Confirmation Input */}
              <div>
                <label className='block text-sm font-medium text-foreground mb-2'>
                  Type the board name{' '}
                  <span className='font-bold text-destructive'>"{board.name}"</span>{' '}
                  to confirm:
                </label>
                <input
                  type='text'
                  value={deletionConfirmName}
                  onChange={(e) => setDeletionConfirmName(e.target.value)}
                  placeholder={board.name}
                  className='w-full p-3 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive focus:border-transparent'
                  disabled={isDeletingBoard}
                  autoFocus
                />
              </div>

              {/* Action Buttons */}
              <div className='flex gap-3'>
                <button
                  onClick={() => {
                    setShowBoardDeletionModal(false);
                    setDeletionConfirmName('');
                    setShowDeletionDetails(false);
                  }}
                  className='flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
                  disabled={isDeletingBoard}
                >
                  Cancel
                </button>
                <button
                  onClick={deleteBoard}
                  disabled={
                    isDeletingBoard || deletionConfirmName !== board.name
                  }
                  className='flex-1 px-4 py-2.5 text-sm font-medium bg-destructive hover:bg-destructive/90 disabled:bg-destructive/50 disabled:cursor-not-allowed text-destructive-foreground rounded-lg transition-colors flex items-center justify-center gap-2'
                >
                  {isDeletingBoard ? (
                    <>
                      <Loader2 className='w-4 h-4 animate-spin' />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className='w-4 h-4' />
                      Delete board permanently
                    </>
                  )}
                </button>
              </div>

              {/* Progress indicator */}
              {isDeletingBoard && (
                <div className='p-3 bg-accent/10 border border-accent/30 rounded-lg'>
                  <div className='flex items-center gap-2 text-accent'>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    <span className='text-sm font-medium'>
                      Deleting board and all related data...
                    </span>
                  </div>
                  <p className='text-xs text-accent/80 mt-1'>
                    This may take a few moments. Please do not close this
                    window.
                  </p>
                </div>
              )}

              {/* Deletion stats (if available) */}
              {deletionStats && (
                <div className='p-3 bg-success/10 border border-success/30 rounded-lg'>
                  <h5 className='font-medium text-success mb-2'>
                    Deletion completed:
                  </h5>
                  <div className='grid grid-cols-2 gap-2 text-xs text-success/90'>
                    <div>Board: {deletionStats.board}</div>
                    <div>Members: {deletionStats.members}</div>
                    <div>Lists: {deletionStats.lists}</div>
                    <div>Stars: {deletionStats.stars}</div>
                    <div>Cards: {deletionStats.cards}</div>
                    <div>Activities: {deletionStats.activities}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Card Modal */}
      {isCardModalOpen &&
        selectedCardId &&
        (() => {
          // Find the selected card across all lists
          let selectedCard = null;
          let listName = '';
          let listId = '';

          for (const list of lists) {
            const card = list.cards.find((c) => c.id === selectedCardId);
            if (card) {
              selectedCard = card;
              listName = list.name;
              listId = list.id;
              break;
            }
          }

          return selectedCard ? (
            <CardModal
              card={{ ...selectedCard, board_id: params.id, list_id: listId }}
              isOpen={isCardModalOpen}
              onClose={handleCloseCard}
              onUpdateCard={handleUpdateCard}
              onDeleteCard={handleDeleteTask}
              onLabelsUpdated={handleLabelsUpdated}
              onMembersUpdated={handleMembersUpdated}
              boardNumber={board.number}
              listName={listName}
              boardName={board?.name || 'Board'}
              onMoveSuccess={handleCardMoveSuccess}
              moveCard={moveCard}
              lists={lists}
              // All four already sit in the shared cache/embedded card
              // data — wiring them in is what actually makes labels and
              // members load instantly instead of cold-fetching on every
              // card open, same as custom fields' initialValues fix.
              cachedBoardLabels={getBoardLabels()}
              cachedCardLabels={getCardLabels(selectedCard.id)}
              cachedWorkspaceMembers={getWorkspaceMembers()}
              cachedCardMembers={getCardMembers(selectedCard.id)}
            />
          ) : null;
        })()}

      {/* Quick-edit dates popover — editing a card's dates directly from
          its row/tile, without opening the full CardModal. */}
      {quickEditDatesCardId &&
        (() => {
          const card = findCardById(quickEditDatesCardId);
          if (!card) return null;
          return (
            <DateTimeRangePicker
              startDate={card.start_date || undefined}
              endDate={card.due_date || undefined}
              onSaveDateTime={(dates) => {
                handleUpdateCard(quickEditDatesCardId, {
                  start_date: dates.startDate || null,
                  due_date: dates.endDate || null,
                });
                setQuickEditDatesCardId(null);
              }}
              onClose={() => setQuickEditDatesCardId(null)}
            />
          );
        })()}

      {/* Quick-edit assignee popover — same idea, for card members. */}
      {quickEditAssigneeCardId &&
        (() => {
          const card = findCardById(quickEditAssigneeCardId);
          if (!card) return null;
          return (
            <CardMemberPicker
              isOpen
              onClose={() => setQuickEditAssigneeCardId(null)}
              workspaceId={board?.workspace.id || ''}
              boardId={params.id}
              cardId={quickEditAssigneeCardId}
              currentMembers={(card as any).card_members || []}
              onMemberAdded={() =>
                handleQuickEditMembersUpdated(quickEditAssigneeCardId)
              }
              onRemoveMember={(profileId) =>
                handleQuickEditMemberRemoved(quickEditAssigneeCardId, profileId)
              }
              allowMultipleSelections
            />
          );
        })()}

      {/* Move Card Modal */}
      {moveCardData && (
        <MoveCardModal
          isOpen={showMoveCardModal}
          onClose={handleCloseMoveModal}
          cardId={moveCardData.cardId}
          cardTitle={moveCardData.cardTitle}
          currentListId={moveCardData.currentListId}
          currentListName={moveCardData.currentListName}
          boardId={params.id}
          onMoveSuccess={handleCardMoveSuccess}
          moveCard={moveCard}
          lists={lists}
        />
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] transition-all duration-500 ${
            isSuccessToastFading
              ? 'animate-out slide-out-to-bottom-2 fade-out opacity-0 scale-95'
              : 'animate-in slide-in-from-bottom-2 fade-in opacity-100 scale-100'
          }`}
        >
          <div className='bg-card/90 backdrop-blur-xl border border-success/30 rounded-lg p-4 shadow-xl shadow-black/40 max-w-sm'>
            <div className='flex items-center gap-3'>
              <div className='flex-shrink-0'>
                <CheckCircle2 className='w-5 h-5 text-success' />
              </div>
              <div className='flex-1'>
                <p className='text-sm font-medium text-foreground'>
                  {successMessage}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsSuccessToastFading(true);
                  setTimeout(() => {
                    setShowSuccessToast(false);
                    setIsSuccessToastFading(false);
                  }, 300);
                }}
                className='flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors'
                aria-label='Close success notification'
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {showErrorToast && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] transition-all duration-500 ${
            isErrorToastFading
              ? 'animate-out slide-out-to-bottom-2 fade-out opacity-0 scale-95'
              : 'animate-in slide-in-from-bottom-2 fade-in opacity-100 scale-100'
          }`}
        >
          <div className='bg-card/90 backdrop-blur-xl border border-destructive/30 rounded-lg p-4 shadow-xl shadow-black/40 max-w-sm'>
            <div className='flex items-center gap-3'>
              <div className='flex-shrink-0'>
                <AlertCircle className='w-5 h-5 text-destructive' />
              </div>
              <div className='flex-1'>
                <p className='text-sm font-medium text-foreground'>
                  {errorMessage}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsErrorToastFading(true);
                  setTimeout(() => {
                    setShowErrorToast(false);
                    setIsErrorToastFading(false);
                  }, 300);
                }}
                className='flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors'
                aria-label='Close error notification'
              >
                <X className='w-4 h-4' />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
