'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardHeader } from '@/app/components/dashboard/header';
import { CreateBoardModal } from '@/app/components/board/CreateBoardModal';
import { WorkspaceBoardCard } from '@/app/components/board/WorkspaceBoardCard';
import { useWorkspaceBoards } from '@/hooks/useWorkspaceBoards';
import { WorkspaceBoardsListSkeleton } from '@/app/components/ui/skeletons';
import { EntityInfoModal } from '@/components/ui/EntityInfoModal';
import { colorForNumber, colorForKey, colorForEntity } from '@/utils/idColor';
import { createClient } from '@/utils/supabase/client';
import {
  Plus,
  Settings,
  Users,
  ArrowLeft,
  Grid3x3,
  LayoutGrid,
  List,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Edit3,
  Info,
  Star,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useSafeNavigation, createSafeClickHandler } from '@/utils/navigation';

// Workspace Name Editor Component
const WorkspaceNameEditor = ({
  workspaceName,
  onSave,
}: {
  workspaceName: string;
  onSave: (name: string) => Promise<boolean>;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(workspaceName);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (editName.trim() === workspaceName || !editName.trim()) {
      setIsEditing(false);
      setEditName(workspaceName);
      return;
    }

    setIsSaving(true);
    const success = await onSave(editName);
    setIsSaving(false);

    if (success) {
      setIsEditing(false);
    } else {
      setEditName(workspaceName); // Revert on failure
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditName(workspaceName);
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
          placeholder='Workspace name'
          aria-label='Edit workspace name'
        />
        {isSaving && <Loader2 className='w-4 h-4 animate-spin flex-shrink-0' />}
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className='text-lg sm:text-2xl font-bold hover:bg-muted/50 px-2 py-1 rounded transition-colors flex items-center gap-2 w-full text-left min-w-0 group'
    >
      <span className='truncate flex-1'>{workspaceName}</span>
      <Edit3 className='w-3 h-3 sm:w-4 sm:h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0' />
    </button>
  );
};

// Workspace Description Modal Component
export default function WorkspaceBoardsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);

  // Grid/list toggle + in-page board search — persisted per-workspace so
  // switching workspaces doesn't carry a stale filter over, but coming back
  // to the same one remembers your last view. Lazy initializer so the very
  // first render (including the loading skeleton, see PageLoadingSkeleton
  // below) already reflects the saved view instead of always starting as
  // 'grid' and flipping after a mount-time effect — guarded for SSR since
  // localStorage doesn't exist there.
  const [boardsView, setBoardsView] = useState<'grid' | 'list'>(() => {
    if (typeof window === 'undefined') return 'grid';
    const saved = window.localStorage.getItem(
      `workspace-boards-view-${workspaceId}`
    );
    return saved === 'list' ? 'list' : 'grid';
  });
  const [boardSearchQuery, setBoardSearchQuery] = useState('');

  const handleSetBoardsView = useCallback(
    (view: 'grid' | 'list') => {
      setBoardsView(view);
      localStorage.setItem(`workspace-boards-view-${workspaceId}`, view);
    },
    [workspaceId]
  );

  // Permission states
  const [userRole, setUserRole] = useState<string>('');
  const [isWorkspaceOwner, setIsWorkspaceOwner] = useState(false);
  const [canCreateBoards, setCanCreateBoards] = useState(true);

  // Use the workspace hook for workspace management
  const {
    workspace: workspaceData,
    loading: workspaceLoading,
    error: workspaceError,
    updateWorkspaceName,
    updateWorkspaceDescription,
  } = useWorkspace(workspaceId);

  // Use the workspace boards hook
  const {
    workspace,
    boards,
    loading: isLoading,
    error,
    toggleBoardStar,
    refetch,
    lastFetchTime,
    formatDate,
    removeBoardFromCache,
    addBoardToCache,
  } = useWorkspaceBoards(workspaceId);

  // Notification states
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccessToastFading, setIsSuccessToastFading] = useState(false);
  const [isErrorToastFading, setIsErrorToastFading] = useState(false);

  // Clean modal open/close handlers
  const handleCreateBoard = useCallback(() => {
    setIsCreateBoardModalOpen(true);
  }, []);

  const handleDescriptionModalOpen = useCallback(() => {
    setIsDescriptionModalOpen(true);
  }, []);

  const handleDescriptionModalClose = useCallback(() => {
    setIsDescriptionModalOpen(false);
  }, []);

  const handleCreateBoardModalClose = useCallback(() => {
    setIsCreateBoardModalOpen(false);
  }, []);

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

  // Loading Spinner Component
  const LoadingSpinner = ({
    size = 'md',
  }: {
    size?: 'sm' | 'md' | 'lg' | 'xl';
  }) => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-6 h-6',
      lg: 'w-8 h-8',
      xl: 'w-12 h-12',
    };

    return (
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
    );
  };

  // Page Loading Skeleton
  const PageLoadingSkeleton = () => (
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />
      <main className='container mx-auto max-w-7xl px-4 pt-24 pb-16'>
        {/* Header Skeleton */}
        <div className='flex items-center justify-between mb-8'>
          <div className='flex items-center gap-4'>
            <div className='w-9 h-9 bg-muted/50 rounded-lg animate-pulse' />
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 bg-muted/50 rounded-lg animate-pulse' />
              <div className='space-y-2'>
                <div className='h-7 w-48 bg-muted/50 rounded animate-pulse' />
                <div className='h-4 w-32 bg-muted/50 rounded animate-pulse' />
              </div>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-9 h-9 bg-muted/50 rounded-lg animate-pulse' />
            <div className='w-9 h-9 bg-muted/50 rounded-lg animate-pulse' />
          </div>
        </div>

        {/* Boards Skeleton — shaped to match the remembered grid/list view
            (boardsView is read from localStorage before first paint, see
            its lazy initializer above) so it doesn't flip layout once the
            real content lands. */}
        {boardsView === 'list' ? (
          <WorkspaceBoardsListSkeleton />
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
            {/* Create Board Card Skeleton */}
            <div className='h-40 rounded-xl border-2 border-dashed border-border/50 bg-card/30 flex flex-col items-center justify-center'>
              <div className='w-12 h-12 bg-muted/50 rounded-full animate-pulse mb-3' />
              <div className='h-4 w-24 bg-muted/50 rounded animate-pulse mb-1' />
              <div className='h-3 w-32 bg-muted/50 rounded animate-pulse' />
            </div>

            {/* Board Card Skeletons */}
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className='h-40 rounded-xl bg-card border border-border/50 p-5'
              >
                <div className='h-2 bg-muted/50 rounded mb-4 animate-pulse' />
                <div className='space-y-2 mb-4'>
                  <div className='h-5 bg-muted/50 rounded animate-pulse' />
                  <div className='h-4 bg-muted/50 rounded w-3/4 animate-pulse' />
                  <div className='h-4 bg-muted/50 rounded w-1/2 animate-pulse' />
                </div>
                <div className='flex items-center justify-between mt-auto'>
                  <div className='h-3 w-16 bg-muted/50 rounded animate-pulse' />
                  <div className='w-4 h-4 bg-muted/50 rounded animate-pulse' />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDescriptionModalOpen) {
        handleDescriptionModalClose();
      }
    };

    if (isDescriptionModalOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isDescriptionModalOpen, handleDescriptionModalClose]);

  // Optimized workspace permissions - faster check
  useEffect(() => {
    const fetchWorkspacePermissions = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push('/auth/login');
          return;
        }

        // Check if user is workspace owner first (fastest check)
        if (workspace) {
          const isOwner = workspace.owner_id === user.id;
          setIsWorkspaceOwner(isOwner);

          // If workspace owner, can always create boards - no need for further checks
          if (isOwner) {
            setCanCreateBoards(true);
            setUserRole('owner');
            return;
          }

          // For non-owners, get membership and settings in parallel for speed
          const [membershipResult, settingsResult] = await Promise.all([
            supabase
              .from('workspace_members')
              .select('role')
              .eq('workspace_id', workspaceId)
              .eq('profile_id', user.id)
              .single(),
            supabase
              .from('workspace_settings')
              .select('setting_value, setting_type')
              .eq('workspace_id', workspaceId)
              .in('setting_type', [
                'board_creation_simplified',
                'board_creation_restriction',
              ]),
          ]);

          if (membershipResult.error) {
            setCanCreateBoards(false);
            setUserRole('');
            return;
          }

          const userRole = membershipResult.data.role;
          setUserRole(userRole);

          // Check workspace settings for board creation restrictions
          const settings = settingsResult.data || [];
          const boardCreationRestriction = settings.find(
            (s) => s.setting_type === 'board_creation_restriction'
          )?.setting_value;

          if (boardCreationRestriction === 'admin_only') {
            setCanCreateBoards(userRole === 'admin');
          } else {
            // Default: members and admins can create boards
            setCanCreateBoards(['admin', 'member'].includes(userRole));
          }
        }
      } catch (error) {
        console.error('Error fetching workspace permissions:', error);
        setCanCreateBoards(false);
      }
    };

    if (workspace) {
      fetchWorkspacePermissions();
    }
  }, [workspace, workspaceId, router]);

  const handleBoardCreated = async (newBoardId: string) => {
    console.log('Board created:', newBoardId);

    // Get the newly created board data from the API
    try {
      const response = await fetch(`/api/boards/${newBoardId}`);
      const data = await response.json();

      if (response.ok && data.board) {
        // Add the new board to cache immediately for better UX
        const newBoard = {
          ...data.board,
          starred: false, // New boards are not starred by default
        };
        addBoardToCache(workspaceId, newBoard);
      }
    } catch (error) {
      console.error('Error fetching new board data:', error);
    }

    // Also refresh the boards data to ensure consistency
    await refetch();

    // Show success message
    showSuccess('Board created successfully!');
  };

  const handleBoardDeleted = async (boardId: string) => {
    console.log('Board deleted:', boardId);

    // Remove the board from cache immediately for better UX
    removeBoardFromCache(workspaceId, boardId);

    // Refresh the boards data to ensure consistency
    await refetch();

    // Show success message
    showSuccess('Board deleted successfully!');
  };

  if (isLoading && !workspace && boards.length === 0) {
    return <PageLoadingSkeleton />;
  }

  if (error || !workspace) {
    return (
      <div className='min-h-screen dot-pattern-dark'>
        <DashboardHeader />
        <main className='container mx-auto max-w-7xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
          <div className='flex items-center justify-center h-64'>
            <div className='text-red-500 text-center text-sm sm:text-base px-4'>
              {error || 'Workspace not found'}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Search matches by name OR by board number — "#3" or plain "3" both
  // find board number 3, so a shared id doubles as a search shortcut.
  const trimmedSearch = boardSearchQuery.trim();
  const searchedNumber = /^#?\d+$/.test(trimmedSearch)
    ? parseInt(trimmedSearch.replace('#', ''), 10)
    : null;
  const filteredBoards = trimmedSearch
    ? boards.filter(
        (b) =>
          b.name.toLowerCase().includes(trimmedSearch.toLowerCase()) ||
          (searchedNumber != null && b.number === searchedNumber)
      )
    : boards;

  return (
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />

      <main className='container mx-auto max-w-7xl px-3 sm:px-4 pt-16 sm:pt-24 pb-8 sm:pb-16'>
        {/* Header */}
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8'>
          {/* Mobile: Workspace name first, then breadcrumb */}
          <div className='flex flex-col gap-3 sm:hidden min-w-0'>
            {/* Workspace name - prominent on mobile */}
            <div className='flex items-center gap-2'>
              <Link
                href='/'
                className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0'
                aria-label='Back to home'
              >
                <ArrowLeft className='w-4 h-4' />
              </Link>
              <div className='min-w-0 flex-1'>
                {workspaceData ? (
                  <WorkspaceNameEditor
                    workspaceName={workspaceData.name}
                    onSave={updateWorkspaceName}
                  />
                ) : (
                  <h1 className='text-lg font-bold text-foreground truncate'>
                    {workspace.name}
                  </h1>
                )}
              </div>
            </div>

            {/* Workspace info - subtle on mobile */}
            <div className='flex items-center gap-2 ml-7'>
              <div
                className='w-4 h-4 rounded text-white flex items-center justify-center text-xs font-bold flex-shrink-0'
                style={{
                  backgroundColor: colorForEntity(
                    workspace.id,
                    workspace.number
                  ),
                }}
              >
                {workspace.name.charAt(0).toUpperCase()}
              </div>
              <p className='text-xs text-muted-foreground truncate'>
                Workspace Boards
              </p>
            </div>
          </div>

          {/* Desktop: Traditional layout */}
          <div className='hidden sm:flex items-center gap-4 min-w-0 flex-1'>
            <Link
              href='/'
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors flex-shrink-0'
              aria-label='Back to home'
            >
              <ArrowLeft className='w-5 h-5' />
            </Link>

            <div className='flex items-center gap-3 min-w-0 flex-1'>
              <div
                className='w-10 h-10 rounded-lg text-white flex items-center justify-center text-lg font-bold shadow-md flex-shrink-0'
                style={{
                  backgroundColor: colorForEntity(
                    workspace.id,
                    workspace.number
                  ),
                }}
              >
                {workspace.name.charAt(0).toUpperCase()}
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  {workspaceData ? (
                    <WorkspaceNameEditor
                      workspaceName={workspaceData.name}
                      onSave={updateWorkspaceName}
                    />
                  ) : (
                    <h1 className='text-2xl font-bold text-foreground'>
                      {workspace.name}
                    </h1>
                  )}
                </div>
                <p className='text-muted-foreground text-sm'>
                  Workspace Boards
                </p>
              </div>
            </div>
          </div>

          {/* Actions - always on the right */}
          <div className='flex items-center justify-end gap-2 sm:gap-2 flex-shrink-0'>
            <button
              onClick={handleDescriptionModalOpen}
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              aria-label='Workspace information'
              title='Workspace Information'
            >
              <Info className='w-4 h-4 sm:w-5 sm:h-5' />
            </button>
            <Link
              href={`/workspace/${workspace.id}/members`}
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              aria-label='Workspace members'
              title='Members'
            >
              <Users className='w-4 h-4 sm:w-5 sm:h-5' />
            </Link>
            <Link
              href={`/workspace/${workspace.id}/settings`}
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              aria-label='Workspace settings'
              title='Settings'
            >
              <Settings className='w-4 h-4 sm:w-5 sm:h-5' />
            </Link>
          </div>
        </div>

        {/* Toolbar: search boards in this workspace + grid/list toggle */}
        <div className='flex items-center gap-2 mb-4 sm:mb-6'>
          <div className='relative flex-1 max-w-sm'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
            <input
              type='text'
              value={boardSearchQuery}
              onChange={(e) => setBoardSearchQuery(e.target.value)}
              placeholder='Search boards by name or #number...'
              className='w-full pl-9 pr-3 py-2 text-sm bg-muted/40 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all'
            />
          </div>

          <div className='flex items-center gap-0.5 p-0.5 bg-muted/40 border border-border/50 rounded-lg flex-shrink-0'>
            <button
              onClick={() => handleSetBoardsView('grid')}
              title='Grid view'
              className={`p-1.5 rounded-md transition-colors ${
                boardsView === 'grid'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className='w-4 h-4' />
            </button>
            <button
              onClick={() => handleSetBoardsView('list')}
              title='List view'
              className={`p-1.5 rounded-md transition-colors ${
                boardsView === 'list'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className='w-4 h-4' />
            </button>
          </div>
        </div>

        {/* Boards Grid */}
        {boardsView === 'grid' ? (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6'>
            {/* Create New Board - Only show if user has permission, and
                only when not filtering (a search result set isn't the
                place to also offer creating something new). */}
            {canCreateBoards && !boardSearchQuery.trim() && (
              <button
                onClick={handleCreateBoard}
                className='h-32 sm:h-40 rounded-xl border-2 border-dashed border-border/50 hover:border-primary bg-card/30 hover:bg-card/50 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-all group card-hover'
              >
                <div className='w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-primary/20 transition-colors'>
                  <Plus className='w-5 h-5 sm:w-6 sm:h-6 text-primary' />
                </div>
                <span className='font-semibold text-sm'>Create New Board</span>
                <span className='text-xs text-muted-foreground mt-1 px-2 text-center'>
                  Add a board to this workspace
                </span>
              </button>
            )}

            {/* Board Cards */}
            {filteredBoards.map((board) => (
              <WorkspaceBoardCard
                key={board.id}
                board={board}
                onToggleStar={toggleBoardStar}
                formatDate={formatDate}
              />
            ))}
          </div>
        ) : (
          <div className='bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden divide-y divide-border/40'>
            {filteredBoards.map((board) => {
              return (
                <Link
                  key={board.id}
                  href={`/board/${board.id}`}
                  className='flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group'
                >
                  <span
                    className='w-2.5 h-2.5 rounded-full flex-shrink-0'
                    style={{
                      backgroundColor:
                        board.number != null
                          ? colorForNumber(board.number)
                          : colorForKey(board.id),
                    }}
                  />
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-medium text-foreground truncate'>
                      {board.name}
                      {board.number != null && (
                        <span
                          className='ml-1.5 text-xs font-normal text-muted-foreground'
                          title='Board number'
                        >
                          #{board.number}
                        </span>
                      )}
                    </p>
                    {board.description && (
                      <p className='text-xs text-muted-foreground truncate'>
                        {board.description}
                      </p>
                    )}
                  </div>
                  <div className='hidden sm:flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0'>
                    <Clock className='w-3 h-3' />
                    {formatDate(board.last_activity_at)}
                  </div>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      await toggleBoardStar(board.id);
                    }}
                    className={`p-1.5 rounded-full transition-colors flex-shrink-0 ${
                      board.starred
                        ? 'text-yellow-400 hover:text-yellow-500'
                        : 'text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-yellow-400'
                    } hover:bg-yellow-400/10`}
                    aria-label={board.starred ? 'Unstar board' : 'Star board'}
                    title={board.starred ? 'Unstar board' : 'Star board'}
                  >
                    <Star
                      className='w-4 h-4'
                      fill={board.starred ? 'currentColor' : 'none'}
                    />
                  </button>
                </Link>
              );
            })}

            {filteredBoards.length === 0 && (
              <div className='px-4 py-8 text-center text-sm text-muted-foreground'>
                No boards match &ldquo;{boardSearchQuery}&rdquo;
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {boards.length === 0 && (
          <div className='flex flex-col items-center justify-center py-16 text-center'>
            <div className='w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4'>
              <Grid3x3 className='w-8 h-8 text-muted-foreground' />
            </div>
            <h3 className='text-lg font-semibold text-foreground mb-2'>
              No boards yet
            </h3>
            <p className='text-muted-foreground mb-4 max-w-md'>
              {canCreateBoards
                ? 'Get started by creating your first board in this workspace. Boards help you organize your projects and tasks.'
                : "This workspace doesn't have any boards yet. Contact an admin to create boards in this workspace."}
            </p>
            {canCreateBoards && (
              <button
                onClick={handleCreateBoard}
                className='btn btn-primary px-4 py-2 flex items-center gap-2'
              >
                <Plus className='w-4 h-4' />
                Create Board
              </button>
            )}
          </div>
        )}
      </main>

      {/* Board creation modal */}
      {workspace && (
        <CreateBoardModal
          isOpen={isCreateBoardModalOpen}
          onClose={handleCreateBoardModalClose}
          onSuccess={handleBoardCreated}
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          workspaceNumber={workspace.number}
        />
      )}

      {/* Workspace description modal */}
      {workspaceData && (
        <EntityInfoModal
          isOpen={isDescriptionModalOpen}
          onClose={handleDescriptionModalClose}
          entityType='workspace'
          name={workspaceData.name}
          colorSeed={workspaceData.id}
          number={workspaceData.number}
          description={workspaceData.description || ''}
          onSave={updateWorkspaceDescription}
          createdAt={workspaceData.created_at}
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
          <div className='bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 shadow-2xl max-w-sm backdrop-blur-sm'>
            <div className='flex items-center gap-3'>
              <CheckCircle2 className='w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0' />
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
                  }, 500);
                }}
                className='text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 transition-colors'
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
              <AlertCircle className='w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0' />
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
                  }, 500);
                }}
                className='text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors'
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
