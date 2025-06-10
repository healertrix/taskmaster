'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardHeader } from '../../components/dashboard/header';
import { CreateBoardModal } from '../../components/board/CreateBoardModal';
import { createClient } from '@/utils/supabase/client';
import {
  Plus,
  Star,
  Settings,
  Users,
  ArrowLeft,
  MoreHorizontal,
  Clock,
  Grid3x3,
} from 'lucide-react';
import Link from 'next/link';

type Board = {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  is_archived: boolean;
  is_closed: boolean;
  visibility: string;
};

type Workspace = {
  id: string;
  name: string;
  color: string;
  owner_id: string;
  visibility: string;
  created_at: string;
};

export default function WorkspaceBoardsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false);

  // Fetch workspace and boards
  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient();

        // Get the current user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push('/auth/login');
          return;
        }

        // Fetch workspace
        const { data: workspaceData, error: workspaceError } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', workspaceId)
          .single();

        if (workspaceError) {
          setError('Workspace not found');
          return;
        }

        // Check if user has access to this workspace
        const { data: membershipData, error: membershipError } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspaceId)
          .eq('profile_id', user.id)
          .single();

        if (membershipError || !membershipData) {
          setError('Access denied');
          return;
        }

        setWorkspace(workspaceData);

        // Fetch boards in this workspace
        const { data: boardsData, error: boardsError } = await supabase
          .from('boards')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('is_archived', false)
          .order('last_activity_at', { ascending: false });

        if (boardsError) {
          console.error('Error fetching boards:', boardsError);
          setError('Failed to load boards');
        } else {
          setBoards(boardsData || []);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (workspaceId) {
      fetchData();
    }
  }, [workspaceId, router]);

  const handleBoardCreated = (newBoardId: string) => {
    // The modal handles navigation to the new board
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
    return (
      <div className='min-h-screen dot-pattern-dark'>
        <DashboardHeader />
        <main className='container mx-auto max-w-7xl px-4 pt-24 pb-16'>
          <div className='flex items-center justify-center h-64'>
            <div className='text-muted-foreground'>Loading...</div>
          </div>
        </main>
      </div>
    );
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
            <button
              className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
              aria-label='More options'
            >
              <MoreHorizontal className='w-5 h-5' />
            </button>
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
          {boards.map((board) => {
            const boardColorDisplay = getColorDisplay(board.color);
            return (
              <Link
                key={board.id}
                href={`/board/${board.id}`}
                className='group relative block p-5 rounded-xl card card-hover h-40 overflow-hidden'
              >
                {/* Color bar at top */}
                <div
                  className={`absolute top-0 left-0 right-0 h-2 ${
                    boardColorDisplay.isCustom
                      ? ''
                      : boardColorDisplay.className
                  }`}
                  style={
                    boardColorDisplay.isCustom ? boardColorDisplay.style : {}
                  }
                />

                <div className='relative z-10 flex flex-col justify-between h-full'>
                  <div>
                    <h3 className='font-semibold text-foreground mb-2 line-clamp-2'>
                      {board.name}
                    </h3>
                    {board.description && (
                      <p className='text-sm text-muted-foreground line-clamp-3 mb-3'>
                        {board.description}
                      </p>
                    )}
                  </div>

                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                      <Clock className='w-3 h-3' />
                      {formatDate(board.last_activity_at)}
                    </div>

                    <div className='flex items-center gap-1'>
                      <button
                        className='p-1 rounded-full text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-yellow-400 hover:bg-yellow-400/10 transition-all'
                        onClick={(e) => {
                          e.preventDefault();
                          // TODO: Add starring logic
                        }}
                        aria-label='Star board'
                      >
                        <Star className='w-4 h-4' />
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
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
      <CreateBoardModal
        isOpen={isCreateBoardModalOpen}
        onClose={() => setIsCreateBoardModalOpen(false)}
        onSuccess={handleBoardCreated}
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        workspaceColor={workspace.color}
      />
    </div>
  );
}
