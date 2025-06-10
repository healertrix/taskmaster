'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardHeader } from '../../components/dashboard/header';
import { CreateBoardModal } from '../../components/board/CreateBoardModal';
import { WorkspaceBoardCard } from '../../components/board/WorkspaceBoardCard';
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
} from 'lucide-react';
import Link from 'next/link';

export default function WorkspaceBoardsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false);

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
          {[...Array(8)].map((_, i) => (
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

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/auth/login');
        return;
      }
    };

    checkAuth();
  }, [router]);

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
                <h1 className='text-2xl font-bold text-foreground'>
                  {workspace.name}
                </h1>
                <p className='text-muted-foreground text-sm'>
                  Workspace Boards
                </p>
              </div>
            </div>
          </div>

          <div className='flex items-center gap-2'>
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
          {/* Create New Board */}
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

          {/* Board Cards */}
          {boards.map((board) => (
            <WorkspaceBoardCard
              key={board.id}
              board={board}
              onToggleStar={toggleBoardStar}
              formatDate={formatDate}
              getColorDisplay={getColorDisplay}
              workspaceId={workspace.id}
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
              Get started by creating your first board in this workspace. Boards
              help you organize your projects and tasks.
            </p>
            <button
              onClick={() => setIsCreateBoardModalOpen(true)}
              className='btn bg-primary text-white hover:bg-primary/90 px-4 py-2 flex items-center gap-2'
            >
              <Plus className='w-4 h-4' />
              Create Board
            </button>
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
          className={`fixed top-20 right-6 z-[9999] transition-all duration-500 ${
            isSuccessToastFading
              ? 'animate-out slide-out-to-top-2 fade-out opacity-0 scale-95'
              : 'animate-in slide-in-from-top-2 fade-in opacity-100 scale-100'
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
          className={`fixed top-20 right-6 z-[9999] transition-all duration-500 ${
            isErrorToastFading
              ? 'animate-out slide-out-to-top-2 fade-out opacity-0 scale-95'
              : 'animate-in slide-in-from-top-2 fade-in opacity-100 scale-100'
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
    </div>
  );
}
