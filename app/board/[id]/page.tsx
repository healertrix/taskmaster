'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
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
import { TaskCard } from '../../components/board/TaskCard';
import { useBoard } from '@/hooks/useBoard';
import { useLists } from '@/hooks/useLists';
import { AddListForm } from '../../components/board/AddListForm';
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
  Save,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

// Define card/task type
interface Task {
  id: string;
  title: string;
  labels?: { color: string; text: string }[];
  assignees?: { initials: string; color: string }[];
  attachments?: number;
  comments?: number;
}

// Define column type
interface Column {
  id: string;
  title: string;
  cards: Task[];
}

// Map old colors to new space theme colors
const labelColors = {
  'bg-red-500': 'bg-primary text-white',
  'bg-purple-500': 'bg-purple-500 text-white',
  'bg-green-500': 'bg-secondary text-white',
  'bg-blue-500': 'bg-accent text-white',
  'bg-gray-500': 'bg-slate-500 text-white',
};

// Sample data for columns and cards (will be replaced with real data eventually)
const initialColumns: Column[] = [
  {
    id: 'review-pending',
    title: 'Review - Pending',
    cards: [
      {
        id: 'card1',
        title: '2nd Review @Clq',
        labels: [{ color: 'bg-red-500', text: 'Priority' }],
        assignees: [
          { initials: 'AN', color: 'bg-orange-500' },
          { initials: 'KV', color: 'bg-purple-500' },
        ],
      },
    ],
  },
  {
    id: 'android-pending',
    title: 'Android - Pending',
    cards: [
      {
        id: 'card3',
        title: 'Home Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card4',
        title: 'Profile Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card5',
        title: 'Theft Report Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card6',
        title: 'Over Charging Report Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card7',
        title: 'Duping Report Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card8',
        title: 'Spot Details Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
      {
        id: 'card9',
        title: 'Places to go Activity',
        labels: [{ color: 'bg-purple-500', text: 'Android' }],
      },
    ],
  },
  {
    id: 'web-pending',
    title: 'Web - Pending',
    cards: [
      {
        id: 'card10',
        title: 'Nation Home Page',
        labels: [{ color: 'bg-green-500', text: 'Web' }],
      },
      {
        id: 'card11',
        title: 'State Home Page',
        labels: [{ color: 'bg-green-500', text: 'Web' }],
      },
      {
        id: 'card12',
        title: 'Analysis Page',
        labels: [{ color: 'bg-green-500', text: 'Web' }],
      },
      {
        id: 'card13',
        title: 'Requests Handling Page',
        labels: [{ color: 'bg-green-500', text: 'Web' }],
      },
      {
        id: 'card14',
        title: 'Police Home Page',
        labels: [{ color: 'bg-green-500', text: 'Web' }],
      },
    ],
  },
  {
    id: 'backend-pending',
    title: 'Backend - Pending',
    cards: [
      {
        id: 'card15',
        title: 'Authorization',
        labels: [{ color: 'bg-blue-500', text: 'Backend' }],
      },
      {
        id: 'card16',
        title: 'Hotel View and Tourist Spot',
        labels: [{ color: 'bg-blue-500', text: 'Backend' }],
        assignees: [{ initials: 'AN', color: 'bg-orange-500' }],
      },
      {
        id: 'card17',
        title:
          'Tourists List, Police Control Room, Police, State Supervisor List',
        labels: [{ color: 'bg-blue-500', text: 'Backend' }],
        assignees: [{ initials: 'KV', color: 'bg-purple-500' }],
      },
    ],
  },
  {
    id: 'references',
    title: 'References',
    cards: [
      {
        id: 'card18',
        title: 'GitHub References',
        labels: [{ color: 'bg-gray-500', text: 'Documentation' }],
        attachments: 3,
        comments: 3,
      },
      {
        id: 'card19',
        title: 'Excali Design',
        labels: [{ color: 'bg-green-500', text: 'Design' }],
        attachments: 1,
      },
      {
        id: 'card20',
        title: 'Support Page',
        labels: [{ color: 'bg-red-500', text: 'Priority' }],
      },
    ],
  },
];

// Map color database values to CSS classes
const getColorClass = (color: string) => {
  const colorMap: { [key: string]: string } = {
    'bg-red-600': 'bg-red-600',
    'bg-blue-600': 'bg-blue-600',
    'bg-green-600': 'bg-green-600',
    'bg-purple-600': 'bg-purple-600',
    'bg-yellow-600': 'bg-yellow-600',
    'bg-pink-600': 'bg-pink-600',
    'bg-indigo-600': 'bg-indigo-600',
    'bg-orange-600': 'bg-orange-600',
  };

  return colorMap[color] || 'bg-blue-600';
};

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
      <div className='flex items-center gap-2'>
        <input
          type='text'
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className='text-2xl font-bold bg-transparent border-b-2 border-primary focus:outline-none'
          autoFocus
          disabled={isSaving}
          placeholder='Board name'
          aria-label='Edit board name'
        />
        {isSaving && <Loader2 className='w-4 h-4 animate-spin' />}
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className='text-2xl font-bold hover:bg-muted/50 px-2 py-1 rounded transition-colors flex items-center gap-2'
    >
      {boardName}
      <Edit3 className='w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity' />
    </button>
  );
};

// Description Editor Modal Component
const DescriptionModal = ({
  isOpen,
  onClose,
  boardName,
  description,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  boardName: string;
  description: string;
  onSave: (description: string) => Promise<boolean>;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(description);
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setEditDescription(description);
      setIsEditing(false);
    }
  }, [isOpen, description]);

  const handleSave = async () => {
    if (editDescription.trim() === description) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    const success = await onSave(editDescription);
    setIsSaving(false);

    if (success) {
      setIsEditing(false);
    } else {
      setEditDescription(description); // Revert on failure
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditDescription(description);
      setIsEditing(false);
    }
  };

  if (!isOpen) return null;

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className='fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4'
      onClick={handleBackdropClick}
    >
      <div className='bg-card rounded-xl shadow-2xl border border-border max-w-2xl w-full max-h-[80vh] overflow-hidden'>
        {/* Header */}
        <div className='flex items-center justify-between p-6 border-b border-border'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center'>
              <Info className='w-5 h-5 text-primary' />
            </div>
            <div>
              <h2 className='text-xl font-semibold'>Board Information</h2>
              <p className='text-sm text-muted-foreground'>{boardName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-2 hover:bg-muted/50 rounded-lg transition-colors'
            title='Close'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        {/* Content */}
        <div className='p-6'>
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <label className='text-sm font-medium text-foreground'>
                Description
              </label>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className='text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors'
                >
                  <Edit3 className='w-3 h-3' />
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <div className='space-y-3'>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className='w-full h-32 p-3 bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none text-sm'
                  placeholder='Add a description for this board...'
                  disabled={isSaving}
                  autoFocus
                />
                <div className='flex items-center justify-between'>
                  <p className='text-xs text-muted-foreground'>
                    Ctrl + Enter to save, Escape to cancel
                  </p>
                  <div className='flex items-center gap-2'>
                    <button
                      onClick={() => {
                        setEditDescription(description);
                        setIsEditing(false);
                      }}
                      className='px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className='px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50'
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className='w-3 h-3 animate-spin' />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className='w-3 h-3' />
                          Save
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className='min-h-[128px] p-3 bg-muted/20 border border-border/50 rounded-lg cursor-pointer hover:bg-muted/30 transition-colors group'
                onClick={() => setIsEditing(true)}
                title='Click to edit description'
              >
                {description && description.trim() ? (
                  <div className='relative'>
                    <p className='text-sm text-foreground whitespace-pre-wrap leading-relaxed'>
                      {description}
                    </p>
                    <div className='absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                      <Edit3 className='w-3 h-3 text-muted-foreground' />
                    </div>
                  </div>
                ) : (
                  <div className='flex items-center justify-center h-full'>
                    <div className='text-center'>
                      <p className='text-sm text-muted-foreground mb-2'>
                        No description added yet
                      </p>
                      <p className='text-xs text-muted-foreground flex items-center gap-1 justify-center'>
                        <Edit3 className='w-3 h-3' />
                        Click here to add one
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className='px-6 py-4 bg-muted/20 border-t border-border'>
          <div className='flex items-center justify-between text-xs text-muted-foreground'>
            <span>Click outside or press Esc to close</span>
            <span>Ctrl + Enter to save when editing</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Loading component
const BoardLoading = () => (
  <div className='min-h-screen dot-pattern-dark'>
    <DashboardHeader />
    <div className='container mx-auto max-w-7xl px-4 pt-24 pb-16'>
      <div className='flex items-center justify-between mb-8'>
        <div className='flex items-center gap-4'>
          <div className='w-8 h-8 bg-muted/50 rounded animate-pulse' />
          <div className='space-y-2'>
            <div className='h-8 w-48 bg-muted/50 rounded animate-pulse' />
            <div className='h-4 w-32 bg-muted/50 rounded animate-pulse' />
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <div className='w-9 h-9 bg-muted/50 rounded-lg animate-pulse' />
          <div className='w-9 h-9 bg-muted/50 rounded-lg animate-pulse' />
          <div className='w-9 h-9 bg-muted/50 rounded-lg animate-pulse' />
        </div>
      </div>
      <div className='text-center py-12'>
        <Loader2 className='w-8 h-8 animate-spin mx-auto text-primary' />
        <p className='text-muted-foreground mt-2'>Loading board...</p>
      </div>
    </div>
  </div>
);

// Error component
const BoardError = ({ error, backUrl }: { error: string; backUrl: string }) => (
  <div className='min-h-screen dot-pattern-dark'>
    <DashboardHeader />
    <div className='container mx-auto max-w-7xl px-4 pt-24 pb-16'>
      <div className='text-center py-12'>
        <div className='w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4'>
          <X className='w-8 h-8 text-red-500' />
        </div>
        <h1 className='text-2xl font-bold text-foreground mb-2'>
          Board Not Found
        </h1>
        <p className='text-muted-foreground mb-6'>{error}</p>
        <Link
          href={backUrl}
          className='inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors'
        >
          <ArrowLeft className='w-4 h-4' />
          Back
        </Link>
      </div>
    </div>
  </div>
);

const getColumnStyle = (id: string) => {
  const styles = {
    'review-pending': 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    'android-pending': 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    'web-pending': 'bg-green-500/10 border-green-500/30 text-green-400',
    'backend-pending': 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    references: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
  };

  return (
    styles[id as keyof typeof styles] ||
    'bg-slate-500/10 border-slate-500/30 text-slate-400'
  );
};

export default function BoardPage({ params }: { params: { id: string } }) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);

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

  // Use the lists hook to manage lists/columns
  const {
    lists,
    loading: listsLoading,
    error: listsError,
    isCreating: isCreatingList,
    createList,
    updateListName,
    archiveList,
    deleteList,
  } = useLists(params.id);

  // Get navigation context from URL params
  const searchParams = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );
  const fromContext = searchParams.get('from');
  const workspaceId = searchParams.get('workspaceId');

  // Smart navigation function
  const getBackUrl = () => {
    if (fromContext === 'workspace' && workspaceId) {
      return `/boards/${workspaceId}`;
    }
    return '/'; // Default to home page
  };

  const getBackLabel = () => {
    if (fromContext === 'workspace') {
      return 'Back to Workspace';
    }
    return 'Back to Home';
  };

  // Notification helper functions
  const showSuccess = (message: string) => {
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
  };

  const showError = (message: string) => {
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
  };

  // Convert lists to columns format for existing components
  useEffect(() => {
    if (lists) {
      const convertedColumns: Column[] = lists.map((list) => ({
        id: list.id,
        title: list.name,
        cards: list.cards.map((card) => ({
          id: card.id,
          title: card.title,
          labels: [], // TODO: Add labels support when available
          assignees: card.profiles
            ? [
                {
                  initials: card.profiles.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase(),
                  color: 'bg-blue-500',
                },
              ]
            : [],
          attachments: 0, // TODO: Add attachments support when available
          comments: 0, // TODO: Add comments support when available
        })),
      }));
      setColumns(convertedColumns);
    }
  }, [lists]);

  // Track board access when component mounts
  useEffect(() => {
    const trackAccess = async () => {
      if (params.id) {
        try {
          const { trackBoardAccess } = await import('@/utils/boardAccess');
          await trackBoardAccess(params.id);
        } catch (error) {
          console.error('Error tracking board access:', error);
        }
      }
    };

    trackAccess();
  }, [params.id]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDescriptionModalOpen) {
        setIsDescriptionModalOpen(false);
      }
    };

    if (isDescriptionModalOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isDescriptionModalOpen]);

  const [dragOverInfo, setDragOverInfo] = useState<{
    id: UniqueIdentifier | null;
    type: 'task' | 'column' | null;
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
  const handleArchiveList = async (listId: string): Promise<boolean> => {
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
  };

  // Handle deleting a list with notifications
  const handleDeleteList = async (listId: string): Promise<boolean> => {
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
  };

  // Task action handlers
  const handleEditTask = (taskId: string) => {
    console.log('Edit task:', taskId);
    // TODO: Implement task editing modal
    showSuccess('Task editing will be implemented soon');
  };

  const handleCopyTask = (taskId: string) => {
    console.log('Copy task:', taskId);
    // TODO: Implement task copying
    showSuccess('Task copying will be implemented soon');
  };

  const handleArchiveTask = async (taskId: string): Promise<boolean> => {
    console.log('Archive task:', taskId);
    // TODO: Implement task archiving
    showSuccess('Task archived successfully');
    return true;
  };

  const handleDeleteTask = async (taskId: string): Promise<boolean> => {
    console.log('Delete task:', taskId);
    // TODO: Implement task deletion
    showSuccess('Task deleted successfully');
    return true;
  };

  const handleManageLabels = (taskId: string) => {
    console.log('Manage labels for task:', taskId);
    // TODO: Implement label management modal
    showSuccess('Label management will be implemented soon');
  };

  const handleManageAssignees = (taskId: string) => {
    console.log('Manage assignees for task:', taskId);
    // TODO: Implement assignee management modal
    showSuccess('Assignee management will be implemented soon');
  };

  const handleManageDueDate = (taskId: string) => {
    console.log('Manage due date for task:', taskId);
    // TODO: Implement due date management modal
    showSuccess('Due date management will be implemented soon');
  };

  // Handle adding a new card to a column
  const handleAddCard = async (
    columnId: string,
    cardTitle: string
  ): Promise<boolean> => {
    console.log('Add card to column:', columnId, 'with title:', cardTitle);

    try {
      // Create a new task with a unique ID
      const newTask: Task = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: cardTitle,
        labels: [],
        assignees: [],
        attachments: 0,
        comments: 0,
      };

      // Update the columns state to add the new task
      setColumns((prevColumns) =>
        prevColumns.map((column) =>
          column.id === columnId
            ? { ...column, cards: [...column.cards, newTask] }
            : column
        )
      );

      showSuccess(`Card "${cardTitle}" added successfully`);
      return true;
    } catch (error) {
      console.error('Error adding card:', error);
      showError('Failed to add card');
      return false;
    }
  };

  // Show loading state
  if (loading || listsLoading) {
    return <BoardLoading />;
  }

  // Show error state
  if (error || listsError || !board) {
    return (
      <BoardError
        error={error || listsError || 'Board not found'}
        backUrl={getBackUrl()}
      />
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    // Create smooth transition for the DOM update by waiting for the animation frame
    window.requestAnimationFrame(() => {
      // Clear the active task state and drag over info
      setActiveTask(null);
      setActiveColumnId(null);
      setDragOverInfo({
        id: null,
        type: null,
        index: null,
        columnId: null,
      });
    });

    // If there's no over element, we can't do anything
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // If dropped on itself, no changes needed
    if (activeId === overId) return;

    // Get information about active task
    const activeTaskInfo = findTaskById(activeId);
    if (!activeTaskInfo) return;

    const { task: activeTask, columnId: activeColumnId } = activeTaskInfo;

    // Check if over is a column or a task
    const isOverAColumn = columns.some((col) => col.id === overId);

    // If over a column, find that column
    if (isOverAColumn) {
      // Handle dropping on a column
      const targetColumnId = overId;

      // If it's the same column, no need to move between columns
      if (targetColumnId === activeColumnId) return;

      setColumns((prevColumns) => {
        return prevColumns.map((column) => {
          // Remove from source column
          if (column.id === activeColumnId) {
            return {
              ...column,
              cards: column.cards.filter((card) => card.id !== activeId),
            };
          }

          // Add to target column
          if (column.id === targetColumnId) {
            return {
              ...column,
              cards: [...column.cards, activeTask],
            };
          }

          return column;
        });
      });
    } else {
      // Handle dropping on a task
      const overTaskInfo = findTaskById(overId);
      if (!overTaskInfo) return;

      const { columnId: overColumnId } = overTaskInfo;

      if (activeColumnId === overColumnId) {
        // Same column - reorder tasks
        setColumns((prevColumns) => {
          return prevColumns.map((column) => {
            if (column.id !== activeColumnId) return column;

            const oldIndex = column.cards.findIndex(
              (card) => card.id === activeId
            );
            const newIndex = column.cards.findIndex(
              (card) => card.id === overId
            );

            return {
              ...column,
              cards: arrayMove(column.cards, oldIndex, newIndex),
            };
          });
        });
      } else {
        // Different columns - move task
        setColumns((prevColumns) => {
          return prevColumns.map((column) => {
            // Remove from source column
            if (column.id === activeColumnId) {
              return {
                ...column,
                cards: column.cards.filter((card) => card.id !== activeId),
              };
            }

            // Add to target column at the position of the over task
            if (column.id === overColumnId) {
              const newCards = [...column.cards];
              const insertIndex = newCards.findIndex(
                (card) => card.id === overId
              );
              newCards.splice(insertIndex, 0, activeTask);
              return {
                ...column,
                cards: newCards,
              };
            }

            return column;
          });
        });
      }
    }
  }

  // Get workspace color class
  const workspaceColorClass = getColorClass(board.workspace.color);

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
    <div className='min-h-screen dot-pattern-dark flex flex-col'>
      <DashboardHeader />

      {/* Board Header */}
      <div className='container mx-auto max-w-full px-4 pt-24 pb-8'>
        <div className='flex items-center justify-between group'>
          {/* Left side - Board info */}
          <div className='flex items-center gap-4'>
            <Link
              href={getBackUrl()}
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              title={getBackLabel()}
            >
              <ArrowLeft className='w-5 h-5' />
            </Link>

            <div className='flex items-center gap-3'>
              {/* Workspace indicator */}
              <div className='flex items-center gap-2'>
                <div
                  className={`w-8 h-8 ${workspaceColorClass} rounded-lg text-white flex items-center justify-center text-sm font-bold shadow-md`}
                >
                  {board.workspace.name.charAt(0).toUpperCase()}
                </div>
                <span className='text-sm text-muted-foreground'>
                  {board.workspace.name}
                </span>
              </div>

              <span className='text-muted-foreground'>/</span>

              {/* Board name - editable */}
              <BoardNameEditor
                boardName={board.name}
                onSave={updateBoardName}
              />
            </div>
          </div>

          {/* Right side - Board info and actions */}
          <div className='flex items-center gap-4'>
            {/* Info button */}
            <button
              onClick={() => setIsDescriptionModalOpen(true)}
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              title='Board information'
            >
              <Info className='w-5 h-5' />
            </button>

            {/* Last access time */}
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Clock className='w-4 h-4' />
              <span>Last accessed {formatLastAccess(board.updated_at)}</span>
            </div>

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
                className={`w-5 h-5 transition-transform duration-200 ${
                  isStarring ? 'scale-110' : ''
                }`}
                fill={board.is_starred ? 'currentColor' : 'none'}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board - Full width without padding */}
      <div className='flex-1 overflow-x-auto'>
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className='flex gap-6 h-full min-w-max px-4'>
            {columns.map((column) => (
              <div key={column.id} className='flex-shrink-0'>
                <ColumnContainer
                  column={column}
                  tasks={column.cards}
                  getColumnStyle={getColumnStyle}
                  labelColors={labelColors}
                  dragOverInfo={dragOverInfo}
                  activeTaskId={activeTask?.id}
                  onUpdateListName={updateListName}
                  onArchiveList={handleArchiveList}
                  onDeleteList={handleDeleteList}
                  onAddCard={handleAddCard}
                  onEditTask={handleEditTask}
                  onCopyTask={handleCopyTask}
                  onArchiveTask={handleArchiveTask}
                  onDeleteTask={handleDeleteTask}
                  onManageLabels={handleManageLabels}
                  onManageAssignees={handleManageAssignees}
                  onManageDueDate={handleManageDueDate}
                />
              </div>
            ))}

            {/* Add List Form */}
            <AddListForm
              onCreateList={handleCreateList}
              isCreating={isCreatingList}
            />
          </div>

          <DragOverlay>
            {activeTask && (
              <TaskCard
                task={activeTask}
                labelColors={labelColors}
                columnId={activeColumnId || ''}
                isDragTarget={false}
                isBeingDragged={false}
                onEditTask={handleEditTask}
                onCopyTask={handleCopyTask}
                onArchiveTask={handleArchiveTask}
                onDeleteTask={handleDeleteTask}
                onManageLabels={handleManageLabels}
                onManageAssignees={handleManageAssignees}
                onManageDueDate={handleManageDueDate}
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Description Modal */}
      <DescriptionModal
        isOpen={isDescriptionModalOpen}
        onClose={() => setIsDescriptionModalOpen(false)}
        boardName={board.name}
        description={board.description || ''}
        onSave={updateBoardDescription}
      />

      {/* Success Toast */}
      {showSuccessToast && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] transition-all duration-500 ${
            isSuccessToastFading
              ? 'animate-out slide-out-to-bottom-2 fade-out opacity-0 scale-95'
              : 'animate-in slide-in-from-bottom-2 fade-in opacity-100 scale-100'
          }`}
        >
          <div className='bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 shadow-2xl max-w-sm backdrop-blur-sm'>
            <div className='flex items-center gap-3'>
              <div className='flex-shrink-0'>
                <CheckCircle2 className='w-5 h-5 text-green-600 dark:text-green-400' />
              </div>
              <div className='flex-1'>
                <p className='text-sm font-medium text-green-800 dark:text-green-200'>
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
                className='flex-shrink-0 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 transition-colors'
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
          <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 shadow-2xl max-w-sm backdrop-blur-sm'>
            <div className='flex items-center gap-3'>
              <div className='flex-shrink-0'>
                <AlertCircle className='w-5 h-5 text-red-600 dark:text-red-400' />
              </div>
              <div className='flex-1'>
                <p className='text-sm font-medium text-red-800 dark:text-red-200'>
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
                className='flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors'
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
