'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { DashboardHeader } from './components/dashboard/header';
import {
  Plus,
  Search,
  Star,
  Clock,
  User,
  Users,
  Settings,
  MoreHorizontal,
  ChevronDown,
  LayoutGrid,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { CreateWorkspaceModal } from './components/workspace/CreateWorkspaceModal';
import {
  CreateBoardModal,
  CreateBoardModalRef,
} from './components/board/CreateBoardModal';
import { BoardCard } from './components/board/BoardCard';
import { createClient } from '@/utils/supabase/client';
import { useBoardStars } from '@/hooks/useBoardStars';
import { useWorkspaceBoardsForHome } from '@/hooks/useWorkspaceBoardsForHome';
import { canUserCreateBoards } from '@/utils/permissions';

const initialWorkspaces: any[] = [];

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<{
    [key: string]: boolean;
  }>({});
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [isCreateWorkspaceModalOpen, setIsCreateWorkspaceModalOpen] =
    useState(false);
  const [isCreateBoardModalOpen, setIsCreateBoardModalOpen] = useState(false);
  const [boardModalContext, setBoardModalContext] = useState<{
    workspaceId?: string;
    workspaceName?: string;
    workspaceColor?: string;
  } | null>(null);
  const [userWorkspaces, setUserWorkspaces] = useState(initialWorkspaces);
  const [workspaceSettings, setWorkspaceSettings] = useState<
    Record<string, any>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const createBoardModalRef = useRef<CreateBoardModalRef>(null);

  // Use the custom hook for board stars
  const {
    starredBoards,
    recentBoards,
    loading: boardsLoading,
    error: boardsError,
    toggleBoardStar,
    refetch: refetchBoards,
  } = useBoardStars();

  // Use the workspace boards hook for workspace sections
  const { workspaceBoards, fetchWorkspaceBoards, toggleWorkspaceBoardStar } =
    useWorkspaceBoardsForHome();

  // Fetch user workspaces and their boards
  const fetchWorkspacesWithBoards = useCallback(async () => {
    try {
      const supabase = createClient();

      // Get the current user
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (currentUser) {
        setUser(currentUser); // Store user in state
        // Fetch workspaces where user is a member (owner or regular member)
        const { data: workspaceData, error: workspaceError } = await supabase
          .from('workspace_members')
          .select(
            `
            workspace_id,
            role,
            workspaces (
              id,
              name,
              color,
              owner_id
            )
          `
          )
          .eq('profile_id', currentUser.id);

        if (workspaceError) {
          console.error('Error fetching workspaces:', workspaceError);
          return;
        }

        if (workspaceData) {
          // Query workspaces directly using workspace IDs from memberships
          // This avoids RLS circular dependency issues
          const workspaceIds = workspaceData.map((wm) => wm.workspace_id);

          // Query workspaces directly (this will work with the simplified RLS policies)
          const { data: directWorkspaceData, error: directWorkspaceError } =
            await supabase
              .from('workspaces')
              .select('id, name, color, owner_id, visibility')
              .in('id', workspaceIds);

          if (directWorkspaceError) {
            console.error(
              'Error fetching workspaces directly:',
              directWorkspaceError
            );
            // Fall back to the original approach
            const validWorkspaceData = workspaceData.filter(
              (wm) => wm.workspaces !== null
            );
            const workspaceIds = validWorkspaceData.map(
              (wm) => wm.workspaces.id
            );

            const mappedWorkspaces = validWorkspaceData.map((wm) => ({
              id: wm.workspaces.id,
              name: wm.workspaces.name,
              initial: wm.workspaces.name.charAt(0).toUpperCase(),
              color: wm.workspaces.color,
              role: wm.role || 'member',
              boards: [],
              members: [],
            }));

            setUserWorkspaces(mappedWorkspaces);
            await fetchWorkspaceBoards(workspaceIds);
            await fetchWorkspaceSettings(workspaceIds);
          } else {
            // SUCCESS: Use direct workspace data
            const mappedWorkspaces = directWorkspaceData.map((workspace) => {
              // Find the corresponding membership data
              const membership = workspaceData.find(
                (wm) => wm.workspace_id === workspace.id
              );
              // If user is workspace owner, set role to 'owner'
              const isOwner = workspace.owner_id === currentUser.id;
              const role = isOwner ? 'owner' : membership?.role || 'member';

              return {
                id: workspace.id,
                name: workspace.name,
                initial: workspace.name.charAt(0).toUpperCase(),
                color: workspace.color,
                owner_id: workspace.owner_id, // Include owner_id for ownership checks
                role,
                boards: [],
                members: [],
              };
            });

            setUserWorkspaces(mappedWorkspaces);

            // Fetch boards for all workspaces
            const workspaceIds = directWorkspaceData.map((w) => w.id);
            await fetchWorkspaceBoards(workspaceIds);

            // Fetch workspace settings for permission checks
            await fetchWorkspaceSettings(workspaceIds);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchWorkspaceBoards]);

  // Fetch workspace settings for permission checks
  const fetchWorkspaceSettings = useCallback(async (workspaceIds: string[]) => {
    try {
      const supabase = createClient();

      // Fetch settings for all workspaces
      const { data: settingsData, error } = await supabase
        .from('workspace_settings')
        .select('workspace_id, setting_type, setting_value')
        .in('workspace_id', workspaceIds);

      if (!error && settingsData) {
        // Process settings data by workspace
        const settingsByWorkspace: Record<string, any> = {};

        settingsData.forEach((setting) => {
          if (!settingsByWorkspace[setting.workspace_id]) {
            settingsByWorkspace[setting.workspace_id] = {
              membership_restriction: 'admins_only',
              board_creation_simplified: 'any_member',
              board_deletion_simplified: 'any_member',
            };
          }

          if (
            setting.setting_type === 'membership_restriction' ||
            setting.setting_type === 'board_creation_simplified' ||
            setting.setting_type === 'board_deletion_simplified'
          ) {
            try {
              const value =
                typeof setting.setting_value === 'string'
                  ? JSON.parse(setting.setting_value)
                  : setting.setting_value;
              settingsByWorkspace[setting.workspace_id][setting.setting_type] =
                value;
            } catch {
              // Keep default value on parse error
            }
          }
        });

        setWorkspaceSettings(settingsByWorkspace);
      }
    } catch (error) {
      console.error('Error fetching workspace settings:', error);
    }
  }, []);

  // Fetch user workspaces on component mount
  useEffect(() => {
    fetchWorkspacesWithBoards();
  }, [fetchWorkspacesWithBoards]);

  // Handle initial page load with hash
  useEffect(() => {
    // Check if there's a hash when the component first mounts
    if (
      typeof window !== 'undefined' &&
      window.location.hash &&
      userWorkspaces.length === 0
    ) {
      // Store the hash to scroll to after data loads
      const hash = window.location.hash;
      if (hash) {
        localStorage.setItem('pendingScroll', hash);
      }
    }
  }, []);

  // Handle scroll after data loads
  useEffect(() => {
    if (typeof window !== 'undefined' && userWorkspaces.length > 0) {
      const pendingScroll = localStorage.getItem('pendingScroll');
      if (pendingScroll) {
        // Clear the pending scroll
        localStorage.removeItem('pendingScroll');
        // Set the hash and trigger scroll
        window.location.hash = pendingScroll;
      }
    }
  }, [userWorkspaces.length]);

  // Handle hash navigation when page loads
  useEffect(() => {
    const handleHashNavigation = () => {
      if (typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.substring(1); // Remove the #

        // Try multiple times to find the element as it might not be rendered yet
        let attempts = 0;
        const maxAttempts = 10;

        const tryScroll = () => {
          const element = document.getElementById(hash);
          if (element) {
            // Scroll to element with offset for fixed header
            const offsetTop = element.offsetTop - 100; // Account for fixed header
            window.scrollTo({
              top: offsetTop,
              behavior: 'smooth',
            });
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(tryScroll, 200); // Try again after 200ms
          }
        };

        // Start trying after a small delay
        setTimeout(tryScroll, 100);
      }
    };

    // Run when workspaces are loaded
    if (userWorkspaces.length > 0) {
      handleHashNavigation();
    }

    // Also listen for hash changes (when navigating back from other pages)
    window.addEventListener('hashchange', handleHashNavigation);

    return () => {
      window.removeEventListener('hashchange', handleHashNavigation);
    };
  }, [userWorkspaces.length]);

  const toggleWorkspace = useCallback((id: string) => {
    setExpandedWorkspaces((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const handleCreateWorkspaceClick = useCallback(() => {
    setIsCreateWorkspaceModalOpen(true);
  }, []);

  const handleWorkspaceCreated = async (newWorkspaceId: string) => {
    try {
      const supabase = createClient();

      // Fetch the newly created workspace
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', newWorkspaceId)
        .single();

      if (error) {
        console.error('Error fetching new workspace:', error);
      } else if (data) {
        // Add the new workspace to the state WITH owner_id and role
        const newWorkspace = {
          id: data.id,
          name: data.name,
          initial: data.name.charAt(0).toUpperCase(),
          color: data.color,
          owner_id: data.owner_id, // Include owner_id for ownership detection
          role: 'owner', // Set role as owner since user created the workspace
          boards: [],
          members: [],
        };

        setUserWorkspaces((prev) => [...prev, newWorkspace]);

        // Auto-expand the new workspace
        setExpandedWorkspaces((prev) => ({
          ...prev,
          [newWorkspaceId]: true,
        }));

        // Refetch workspaces in the create board modal (if it's open)
        if (createBoardModalRef.current) {
          try {
            await createBoardModalRef.current.refetchWorkspaces();
          } catch (error) {
            console.error('Error refetching workspaces:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error handling new workspace:', error);
    }
  };

  // Handle board creation from top-level (recent boards section)
  const handleCreateBoardTopLevel = () => {
    setBoardModalContext(null); // No workspace context
    setIsCreateBoardModalOpen(true);
  };

  // Handle board creation from workspace section
  const handleCreateBoardInWorkspace = (workspace: any) => {
    setBoardModalContext({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspaceColor: workspace.color,
    });
    setIsCreateBoardModalOpen(true);
  };

  const handleBoardCreated = async (newBoardId: string) => {
    // Refresh all board data to show the new board
    await fetchWorkspacesWithBoards();
    await refetchBoards();

    // Also refresh workspace boards to update the workspace sections
    if (boardModalContext?.workspaceId) {
      // If creating from specific workspace, refresh that workspace
      await fetchWorkspaceBoards([boardModalContext.workspaceId]);
    } else {
      // If creating from top-level, refresh all workspaces
      const workspaceIds = userWorkspaces.map((w) => w.id);
      if (workspaceIds.length > 0) {
        await fetchWorkspaceBoards(workspaceIds);
      }
    }

    setIsCreateBoardModalOpen(false);
    setBoardModalContext(null);
  };

  const currentUser = {
    name: 'Superhero User',
    avatar: '', // Leave empty for initial/icon display
  };

  // Function to determine if a color is a hex code or a tailwind class
  const getColorDisplay = useCallback((color: string) => {
    // If it starts with # or rgb, it's a custom color
    if (color.startsWith('#') || color.startsWith('rgb')) {
      return {
        isCustom: true,
        style: { backgroundColor: color },
        className: '',
      };
    }
    // Otherwise it's a Tailwind class
    return {
      isCustom: false,
      style: {},
      className: color,
    };
  }, []);

  return (
    // Use the dark dot pattern for the body background
    <div className='min-h-screen dot-pattern-dark'>
      <DashboardHeader />

      <main className='container mx-auto max-w-7xl px-4 pt-24 pb-16'>
        {/* Sidebar and Main Content */}
        <div className='flex gap-8'>
          {/* Sidebar - Using dark glass effect - Hidden on mobile */}
          <div className='w-64 flex-shrink-0 hidden md:block'>
            <div className='glass-dark rounded-xl p-4 sticky top-24'>
              <div className='mt-4'>
                <h3 className='px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
                  Workspaces
                </h3>
                <div className='mt-3 space-y-1.5'>
                  {userWorkspaces.map((workspace) => (
                    <div key={workspace.id} className='space-y-1'>
                      <button
                        className='nav-item flex items-center justify-between w-full text-sm'
                        onClick={() => toggleWorkspace(workspace.id)}
                      >
                        <div className='flex items-center gap-2.5'>
                          <div
                            className={`w-7 h-7 ${
                              getColorDisplay(workspace.color).isCustom
                                ? ''
                                : getColorDisplay(workspace.color).className
                            } rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-md`}
                            style={getColorDisplay(workspace.color).style}
                          >
                            {workspace.initial}
                          </div>
                          <span className='font-medium'>{workspace.name}</span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-muted-foreground transition-transform ${
                            expandedWorkspaces[workspace.id] ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {expandedWorkspaces[workspace.id] && (
                        <div className='pl-9 space-y-1 mt-1'>
                          <Link
                            href={`/boards/${workspace.id}`}
                            className='nav-item flex items-center gap-2.5 w-full text-xs'
                          >
                            <LayoutGrid className='w-3.5 h-3.5' />
                            Boards
                          </Link>
                          <Link
                            href={`/workspace/${workspace.id}/members`}
                            className='nav-item flex items-center gap-2.5 w-full text-xs'
                          >
                            <Users className='w-3.5 h-3.5' />
                            Members
                          </Link>
                          <Link
                            href={`/workspace/${workspace.id}/settings`}
                            className='nav-item flex items-center gap-2.5 w-full text-xs'
                          >
                            <Settings className='w-3.5 h-3.5' />
                            Settings
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    className='btn btn-ghost flex items-center gap-2 w-full text-sm justify-start px-3 mt-3'
                    onClick={handleCreateWorkspaceClick}
                  >
                    <Plus className='w-4 h-4' />
                    Create Workspace
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className='flex-1 md:flex-1 w-full'>
            {/* Starred Boards Section */}
            {(boardsLoading || starredBoards.length > 0) && (
              <section className='mb-12'>
                <div className='flex items-center justify-between mb-5'>
                  <h2 className='text-xl font-semibold text-foreground flex items-center gap-2'>
                    <Star
                      className='w-5 h-5 text-yellow-400'
                      fill='currentColor'
                    />
                    Starred Boards
                  </h2>
                  {!boardsLoading && starredBoards.length > 6 && (
                    <Link
                      href='/starred'
                      className='text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1'
                    >
                      View all starred
                      <ChevronRight className='w-3 h-3' />
                    </Link>
                  )}
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'>
                  {boardsLoading ? (
                    // Loading skeleton for starred boards
                    <>
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                          key={i}
                          className='h-32 rounded-xl bg-card/50 animate-pulse'
                        />
                      ))}
                    </>
                  ) : (
                    starredBoards
                      .slice(0, 6)
                      .map((board) => (
                        <BoardCard
                          key={board.id}
                          board={board}
                          onToggleStar={toggleBoardStar}
                        />
                      ))
                  )}
                </div>
              </section>
            )}

            {/* Recent Boards Section */}
            <section className='mb-12'>
              <div className='flex items-center justify-between mb-5'>
                <h2 className='text-xl font-semibold text-foreground flex items-center gap-2'>
                  <Clock className='w-5 h-5 text-secondary' />
                  Recent Boards
                </h2>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'>
                {boardsLoading ? (
                  // Loading skeleton
                  <>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className='h-32 rounded-xl bg-card/50 animate-pulse'
                      />
                    ))}
                  </>
                ) : boardsError ? (
                  // Error state
                  <div className='col-span-full p-8 text-center text-muted-foreground'>
                    <p>Error loading boards: {boardsError}</p>
                  </div>
                ) : recentBoards.length === 0 ? (
                  // Empty state
                  <div className='col-span-full p-8 text-center text-muted-foreground'>
                    <p>
                      No recently accessed boards. Visit some boards to see them
                      here!
                    </p>
                  </div>
                ) : (
                  // Board cards
                  recentBoards.map((board) => (
                    <BoardCard
                      key={board.id}
                      board={board}
                      onToggleStar={toggleBoardStar}
                    />
                  ))
                )}
              </div>
            </section>

            {/* Workspaces Section */}
            {(() => {
              return userWorkspaces.map((workspace) => (
                <section
                  key={workspace.id}
                  id={`workspace-${workspace.id}`}
                  className='mb-12 scroll-mt-24 pt-4'
                  style={{ scrollMarginTop: '6rem' }}
                >
                  <div className='flex items-center justify-between mb-5'>
                    <Link
                      href={`/boards/${workspace.id}`}
                      className='flex items-center gap-2.5 text-xl font-semibold text-foreground hover:text-primary transition-colors group'
                    >
                      <div
                        className={`w-6 h-6 ${
                          getColorDisplay(workspace.color).isCustom
                            ? ''
                            : getColorDisplay(workspace.color).className
                        } rounded-lg text-white flex items-center justify-center text-xs font-bold shadow-md group-hover:scale-105 transition-transform`}
                        style={getColorDisplay(workspace.color).style}
                      >
                        {workspace.initial}
                      </div>
                      {workspace.name}
                    </Link>
                    <div className='flex items-center gap-2'>
                      {(workspaceBoards[workspace.id] || workspace.boards)
                        .length > 6 && (
                        <Link
                          href={`/boards/${workspace.id}`}
                          className='text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mr-2'
                        >
                          View all boards
                          <ChevronRight className='w-3 h-3' />
                        </Link>
                      )}
                      <Link
                        href={`/workspace/${workspace.id}/members`}
                        className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
                        aria-label='Workspace members'
                        title='Workspace members'
                      >
                        <Users className='w-4 h-4' />
                      </Link>
                      <Link
                        href={`/workspace/${workspace.id}/settings`}
                        className='p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors'
                        aria-label='Workspace settings'
                        title='Workspace settings'
                      >
                        <Settings className='w-4 h-4' />
                      </Link>
                    </div>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'>
                    {(() => {
                      const allBoards =
                        workspaceBoards[workspace.id] || workspace.boards;
                      // If more than 6 boards, sort by latest (updated_at) and take first 5
                      // Otherwise, show all boards
                      const boardsToShow =
                        allBoards.length > 6
                          ? [...allBoards]
                              .sort(
                                (a, b) =>
                                  new Date(b.updated_at || '').getTime() -
                                  new Date(a.updated_at || '').getTime()
                              )
                              .slice(0, 5)
                          : allBoards;

                      return boardsToShow.map((board) => {
                        // Always ensure we have starred status - prefer workspaceBoards data
                        let boardForCard = board;

                        // If we're using fallback data, try to find starred status
                        if (
                          !workspaceBoards[workspace.id] &&
                          !board.hasOwnProperty('starred')
                        ) {
                          // Check if this board is in starred boards to get starred status
                          const starredBoard = starredBoards.find(
                            (sb) => sb.id === board.id
                          );
                          boardForCard = {
                            id: board.id,
                            name: board.name,
                            color: board.color,
                            starred: starredBoard ? true : false,
                          };
                        }
                        return (
                          <Link
                            key={board.id}
                            href={`/board/${board.id}`}
                            className='group relative block p-5 rounded-xl card card-hover h-32 overflow-hidden transition-all duration-200'
                          >
                            {/* Color bar at top */}
                            <div
                              className={`absolute top-0 left-0 right-0 h-1.5 ${board.color}`}
                            ></div>

                            {/* Content */}
                            <div className='relative z-10 flex flex-col justify-between h-full'>
                              <div>
                                <h3 className='font-semibold text-foreground truncate pr-8'>
                                  {board.name}
                                </h3>
                              </div>

                              {/* Star button */}
                              <div className='flex justify-end relative z-20'>
                                <button
                                  className={`relative z-30 p-2 rounded-full transition-all duration-200 ${
                                    boardForCard.starred
                                      ? 'text-yellow-400 hover:text-yellow-500'
                                      : 'text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-yellow-400'
                                  } hover:bg-yellow-400/10`}
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Use the main toggleBoardStar function to ensure all sections sync
                                    await toggleBoardStar(board.id);
                                    // Always refetch workspace boards to update local state
                                    await fetchWorkspaceBoards([workspace.id]);
                                    // Also refetch main board data to keep everything in sync
                                    await refetchBoards();
                                  }}
                                  aria-label={
                                    boardForCard.starred
                                      ? 'Unstar board'
                                      : 'Star board'
                                  }
                                  title={
                                    boardForCard.starred
                                      ? 'Unstar board'
                                      : 'Star board'
                                  }
                                  style={{ pointerEvents: 'auto' }}
                                >
                                  <Star
                                    className='w-4 h-4'
                                    fill={
                                      boardForCard.starred
                                        ? 'currentColor'
                                        : 'none'
                                    }
                                    stroke='currentColor'
                                  />
                                </button>
                              </div>
                            </div>
                          </Link>
                        );
                      });
                    })()}

                    {/* Create New Board */}
                    {(() => {
                      // If no user data, show loading
                      if (!user) {
                        return (
                          <div className='h-32 rounded-xl border-2 border-dashed border-border/50 bg-card/30 flex flex-col items-center justify-center text-muted-foreground'>
                            <div className='w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center mb-2'>
                              <Loader2 className='w-5 h-5 animate-spin' />
                            </div>
                            <span className='font-medium text-sm'>
                              Loading...
                            </span>
                          </div>
                        );
                      }

                      // If you own the workspace, you can create boards
                      const isOwner = workspace.owner_id === user.id;

                      if (isOwner) {
                        // Workspace owner - allow board creation
                        return (
                          <button
                            onClick={() =>
                              handleCreateBoardInWorkspace(workspace)
                            }
                            className='h-32 rounded-xl border-2 border-dashed border-border/50 hover:border-primary bg-card/30 hover:bg-card/50 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-all group card-hover'
                          >
                            <div className='w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors'>
                              <Plus className='w-5 h-5 text-primary' />
                            </div>
                            <span className='font-medium text-sm'>
                              Create New Board
                            </span>
                          </button>
                        );
                      }

                      // Check permissions for non-owners
                      const settings = workspaceSettings[workspace.id];
                      const userRole = workspace.role || 'member';
                      const canCreate = canUserCreateBoards(settings, userRole);

                      if (canCreate) {
                        return (
                          <button
                            onClick={() =>
                              handleCreateBoardInWorkspace(workspace)
                            }
                            className='h-32 rounded-xl border-2 border-dashed border-border/50 hover:border-primary bg-card/30 hover:bg-card/50 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-all group card-hover'
                          >
                            <div className='w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors'>
                              <Plus className='w-5 h-5 text-primary' />
                            </div>
                            <span className='font-medium text-sm'>
                              Create New Board
                            </span>
                          </button>
                        );
                      }

                      // Can't create boards - show message
                      return (
                        <div className='h-32 rounded-xl border-2 border-dashed border-border/30 bg-card/20 flex flex-col items-center justify-center text-muted-foreground/60'>
                          <div className='w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center mb-2'>
                            <Plus className='w-5 h-5 text-muted-foreground/40' />
                          </div>
                          <span className='font-medium text-sm text-center px-4'>
                            Only certain members can create boards
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </section>
              ));
            })()}
          </div>
        </div>
      </main>

      {/* Workspace creation modal */}
      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceModalOpen}
        onClose={() => setIsCreateWorkspaceModalOpen(false)}
        onSuccess={handleWorkspaceCreated}
      />

      {/* Board creation modal */}
      <CreateBoardModal
        ref={createBoardModalRef}
        isOpen={isCreateBoardModalOpen}
        onClose={() => setIsCreateBoardModalOpen(false)}
        onSuccess={handleBoardCreated}
        workspaceId={boardModalContext?.workspaceId}
        workspaceName={boardModalContext?.workspaceName}
        workspaceColor={boardModalContext?.workspaceColor}
      />
    </div>
  );
}
