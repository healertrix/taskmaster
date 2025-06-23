'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardHeader } from '@/app/components/dashboard/header';
import { CreateBoardModal } from '@/app/components/board/CreateBoardModal';
import { WorkspaceBoardCard } from '@/app/components/board/WorkspaceBoardCard';
import { useWorkspaceBoards } from '@/hooks/useWorkspaceBoards';
import { createClient } from '@/utils/supabase/client';
import {
  Plus,
  Settings,
  Users,
  ArrowLeft,
  Grid3x3,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Edit3,
  Info,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import { useWorkspace } from '@/hooks/useWorkspace';

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
          placeholder='Workspace name'
          aria-label='Edit workspace name'
        />
        {isSaving && <Loader2 className='w-4 h-4 animate-spin' />}
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className='text-2xl font-bold hover:bg-muted/50 px-2 py-1 rounded transition-colors flex items-center gap-2 group'
    >
      {workspaceName}
      <Edit3 className='w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity' />
    </button>
  );
};

// Workspace Description Modal Component
const WorkspaceDescriptionModal = ({
  isOpen,
  onClose,
  workspaceName,
  description,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
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
              <h2 className='text-xl font-semibold'>Workspace Information</h2>
              <p className='text-sm text-muted-foreground'>{workspaceName}</p>
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
                  placeholder='Add a description for this workspace...'
                  disabled={isSaving}
                  autoFocus
                />

                <div className='space-y-2'>
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

export default function WorkspaceBoardsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);

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
  } = useWorkspaceBoards(workspaceId);

  // Notification states
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccessToastFading, setIsSuccessToastFading] = useState(false);
  const [isErrorToastFading, setIsErrorToastFading] = useState(false);

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

        {/* Boards Grid Skeleton */}
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
      </main>
    </div>
  );

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

          const { data: membership, error: membershipError } = membershipResult;
          const { data: settings, error: settingsError } = settingsResult;

          if (!membershipError && membership) {
            setUserRole(membership.role);

            // Default to permissive setting for speed
            let boardCreationPermission = 'any_member';

            if (!settingsError && settings) {
              // Look for new simplified format first
              const simplifiedSetting = settings.find(
                (s) => s.setting_type === 'board_creation_simplified'
              );
              if (simplifiedSetting) {
                try {
                  boardCreationPermission =
                    typeof simplifiedSetting.setting_value === 'string'
                      ? JSON.parse(simplifiedSetting.setting_value)
                      : simplifiedSetting.setting_value;
                } catch (error) {
                  boardCreationPermission = 'any_member';
                }
              }
            }

            // Quick permission check
            let canCreate = false;
            switch (boardCreationPermission) {
              case 'any_member':
                canCreate = ['admin', 'member'].includes(membership.role);
                break;
              case 'admins_only':
                canCreate = membership.role === 'admin';
                break;
              case 'owner_only':
                canCreate = false; // Only workspace owner can create
                break;
              default:
                canCreate = ['admin', 'member'].includes(membership.role);
            }

            setCanCreateBoards(canCreate);
          } else {
            setCanCreateBoards(false);
          }
        }
      } catch (error) {
        console.error('Error fetching workspace permissions:', error);
        // Don't disable on error, let the API handle permission rejection
        setCanCreateBoards(true);
      }
    };

    if (workspace) {
      fetchWorkspacePermissions();
    }
  }, [workspace, workspaceId, router]);

  const handleBoardCreated = async (newBoardId: string) => {
    // Refresh the boards data
    await refetch();
    showSuccess('Board created successfully!');
    console.log('Board created:', newBoardId);
  };

  // Function to determine if a color is a hex code or a tailwind class
  const getColorDisplay = (color: string) => {
    if (color.startsWith('#') || color.startsWith('rgb')) {
      return {
        isCustom: true,
        style: { backgroundColor: color },
        className: '',
      };
    }
    return {
      isCustom: false,
      style: {},
      className: color,
    };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return <PageLoadingSkeleton />;
  }

  if (error || !workspace) {
    return (
      <div className='min-h-screen dot-pattern-dark'>
        <DashboardHeader />
        <main className='container mx-auto max-w-7xl px-4 pt-24 pb-16'>
          <div className='flex items-center justify-center h-64'>
            <div className='text-red-500'>{error || 'Workspace not found'}</div>
          </div>
        </main>
      </div>
    );
  }

  const colorDisplay = getColorDisplay(workspace.color);

  return (
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />

      <main className='container mx-auto max-w-7xl px-4 pt-24 pb-16'>
        {/* Header */}
        <div className='flex items-center justify-between mb-8'>
          <div className='flex items-center gap-4'>
            <Link
              href='/'
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              aria-label='Back to home'
            >
              <ArrowLeft className='w-5 h-5' />
            </Link>

            <div className='flex items-center gap-3'>
              <div
                className={`w-10 h-10 ${
                  colorDisplay.isCustom ? '' : colorDisplay.className
                } rounded-lg text-white flex items-center justify-center text-lg font-bold shadow-md`}
                style={colorDisplay.style}
              >
                {workspace.name.charAt(0).toUpperCase()}
              </div>
              <div>
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

          <div className='flex items-center gap-2'>
            <button
              onClick={() => setIsDescriptionModalOpen(true)}
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              aria-label='Workspace information'
              title='Workspace Information'
            >
              <Info className='w-5 h-5' />
            </button>
            <Link
              href={`/workspace/${workspace.id}/members`}
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              aria-label='Workspace members'
              title='Members'
            >
              <Users className='w-5 h-5' />
            </Link>
            <Link
              href={`/workspace/${workspace.id}/settings`}
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              aria-label='Workspace settings'
              title='Settings'
            >
              <Settings className='w-5 h-5' />
            </Link>
          </div>
        </div>

        {/* Boards Grid */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
          {/* Create New Board - Only show if user has permission */}
          {canCreateBoards && (
            <button
              onClick={() => setIsCreateBoardModalOpen(true)}
              className='h-40 rounded-xl border-2 border-dashed border-border/50 hover:border-primary bg-card/30 hover:bg-card/50 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-all group card-hover'
            >
              <div className='w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors'>
                <Plus className='w-6 h-6 text-primary' />
              </div>
              <span className='font-semibold text-sm'>Create New Board</span>
              <span className='text-xs text-muted-foreground mt-1'>
                Add a board to this workspace
              </span>
            </button>
          )}

          {/* Board Cards */}
          {boards.map((board) => (
            <WorkspaceBoardCard
              key={board.id}
              board={board}
              onToggleStar={toggleBoardStar}
              formatDate={formatDate}
              getColorDisplay={getColorDisplay}
            />
          ))}
        </div>

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
                onClick={() => setIsCreateBoardModalOpen(true)}
                className='btn bg-primary text-white hover:bg-primary/90 px-4 py-2 flex items-center gap-2'
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
          onClose={() => setIsCreateBoardModalOpen(false)}
          onSuccess={handleBoardCreated}
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          workspaceColor={workspace.color}
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

      {/* Workspace Description Modal */}
      {workspaceData && (
        <WorkspaceDescriptionModal
          isOpen={isDescriptionModalOpen}
          onClose={() => setIsDescriptionModalOpen(false)}
          workspaceName={workspaceData.name}
          description={workspaceData.description || ''}
          onSave={updateWorkspaceDescription}
        />
      )}
    </div>
  );
}
