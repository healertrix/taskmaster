import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAppStore } from '@/lib/stores/useAppStore';

export interface WorkspaceBoard {
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
  starred?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  color: string;
  owner_id: string;
  visibility: string;
  created_at: string;
}

// Memoized color display utility
const createColorDisplay = (color: string) => {
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

// Memoized date formatter
const createDateFormatter = () => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (dateString: string) => formatter.format(new Date(dateString));
};

export const useWorkspaceBoards = (workspaceId: string) => {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<WorkspaceBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const supabase = createClient();
  const {
    getWorkspaceBoardsCache,
    setWorkspaceBoardsCache,
    updateBoardInCache,
    addBoardToCache,
    removeBoardFromCache,
    clearWorkspaceBoardsCache,
  } = useAppStore();

  // Memoized utilities
  const getColorDisplay = useMemo(() => createColorDisplay, []);
  const formatDate = useMemo(() => createDateFormatter(), []);

  // Check cache first
  const checkCache = useCallback(() => {
    const cached = getWorkspaceBoardsCache(workspaceId);
    if (cached) {
      setWorkspace(cached.workspace);
      setBoards(cached.boards);
      setLoading(false);
      setError(null);
      return true;
    }
    return false;
  }, [workspaceId, getWorkspaceBoardsCache]);

  // Fetch workspace data with caching
  const fetchWorkspace = useCallback(async () => {
    try {
      // Check cache first
      const cached = getWorkspaceBoardsCache(workspaceId);
      if (cached?.workspace) {
        setWorkspace(cached.workspace);
        return cached.workspace;
      }

      const { data: workspaceData, error: workspaceError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (workspaceError) {
        setError('Workspace not found');
        return null;
      }

      setWorkspace(workspaceData);
      return workspaceData;
    } catch (err) {
      console.error('Error fetching workspace:', err);
      setError('Failed to fetch workspace');
      return null;
    }
  }, [supabase, workspaceId, getWorkspaceBoardsCache]);

  // Fetch boards with starred status and caching
  const fetchBoards = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('User not authenticated');
        return;
      }

      // Check cache first
      const cached = getWorkspaceBoardsCache(workspaceId);
      if (cached?.boards) {
        setBoards(cached.boards);
        return cached.boards;
      }

      // Check if user has access to this workspace
      const { data: membershipData, error: membershipError } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('profile_id', user.id)
        .single();

      if (membershipError) {
        setError('Access denied to this workspace');
        return;
      }

      // Optimized: Fetch boards and starred status in parallel
      const [boardsResult, starsResult] = await Promise.all([
        supabase
          .from('boards')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('is_archived', false)
          .order('updated_at', { ascending: false }),
        supabase
          .from('board_stars')
          .select('board_id')
          .eq('profile_id', user.id),
      ]);

      if (boardsResult.error) {
        console.error('Error fetching boards:', boardsResult.error);
        setError('Failed to fetch boards');
        return;
      }

      if (!boardsResult.data || boardsResult.data.length === 0) {
        setBoards([]);
        return [];
      }

      // Create a set of starred board IDs for fast lookup
      const starredBoardIds = new Set(
        starsResult.data?.map((star) => star.board_id) || []
      );

      // Combine boards with starred status
      const boardsWithStarStatus = boardsResult.data.map((board) => ({
        ...board,
        starred: starredBoardIds.has(board.id),
      }));

      setBoards(boardsWithStarStatus);
      return boardsWithStarStatus;
    } catch (err) {
      console.error('Error in fetchBoards:', err);
      setError('Failed to fetch boards');
      return [];
    }
  }, [supabase, workspaceId, getWorkspaceBoardsCache]);

  // Optimized toggle star status for a board
  const toggleBoardStar = useCallback(
    async (boardId: string) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('User not authenticated');
        }

        // Optimistic update
        const currentBoard = boards.find((b) => b.id === boardId);
        if (!currentBoard) return;

        const newStarred = !currentBoard.starred;

        // Update local state immediately for better UX
        setBoards((prev) =>
          prev.map((board) =>
            board.id === boardId ? { ...board, starred: newStarred } : board
          )
        );

        // Update cache
        updateBoardInCache(workspaceId, boardId, { starred: newStarred });

        // Check if board is currently starred
        const { data: existingStar, error: checkError } = await supabase
          .from('board_stars')
          .select('id')
          .eq('board_id', boardId)
          .eq('profile_id', user.id)
          .single();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingStar) {
          // Remove star
          const { error: deleteError } = await supabase
            .from('board_stars')
            .delete()
            .eq('board_id', boardId)
            .eq('profile_id', user.id);

          if (deleteError) {
            // Revert optimistic update on error
            setBoards((prev) =>
              prev.map((board) =>
                board.id === boardId
                  ? { ...board, starred: !newStarred }
                  : board
              )
            );
            updateBoardInCache(workspaceId, boardId, { starred: !newStarred });
            throw deleteError;
          }
        } else {
          // Add star
          const { error: insertError } = await supabase
            .from('board_stars')
            .insert({
              board_id: boardId,
              profile_id: user.id,
            });

          if (insertError) {
            // Revert optimistic update on error
            setBoards((prev) =>
              prev.map((board) =>
                board.id === boardId
                  ? { ...board, starred: !newStarred }
                  : board
              )
            );
            updateBoardInCache(workspaceId, boardId, { starred: !newStarred });
            throw insertError;
          }
        }
      } catch (err) {
        console.error('Error toggling board star:', err);
        throw err; // Re-throw to handle in component
      }
    },
    [supabase, workspaceId, boards, updateBoardInCache]
  );

  // Initialize data with caching
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      // Check cache first - show cached data immediately if available
      const cached = getWorkspaceBoardsCache(workspaceId);
      if (cached) {
        setWorkspace(cached.workspace);
        setBoards(cached.boards);
        setLoading(false);
        setLastFetchTime(Date.now());
        
        // Background refresh: fetch fresh data without blocking UI
        setTimeout(async () => {
          try {
            const [workspaceData, boardsData] = await Promise.all([
              fetchWorkspace(),
              fetchBoards(),
            ]);
            
            if (workspaceData && boardsData) {
              setWorkspaceBoardsCache(workspaceId, workspaceData, boardsData);
              setWorkspace(workspaceData);
              setBoards(boardsData);
              setLastFetchTime(Date.now());
            }
          } catch (error) {
            console.error('Background refresh failed:', error);
          }
        }, 100);
        
        return;
      }

      // No cache available - fetch fresh data
      const [workspaceData, boardsData] = await Promise.all([
        fetchWorkspace(),
        fetchBoards(),
      ]);

      // Cache the results
      if (workspaceData && boardsData) {
        setWorkspaceBoardsCache(workspaceId, workspaceData, boardsData);
      }

      setLoading(false);
      setLastFetchTime(Date.now());
    };

    if (workspaceId) {
      loadData();
    }
  }, [
    workspaceId,
    getWorkspaceBoardsCache,
    fetchWorkspace,
    fetchBoards,
    setWorkspaceBoardsCache,
  ]);

  // Memoized refetch function
  const refetch = useCallback(async () => {
    // Clear cache to force fresh fetch
    clearWorkspaceBoardsCache(workspaceId);

    setLoading(true);
    setError(null);

    const [workspaceData, boardsData] = await Promise.all([
      fetchWorkspace(),
      fetchBoards(),
    ]);

    // Cache the fresh results
    if (workspaceData && boardsData) {
      setWorkspaceBoardsCache(workspaceId, workspaceData, boardsData);
    }

    setLoading(false);
    setLastFetchTime(Date.now());
  }, [
    workspaceId,
    clearWorkspaceBoardsCache,
    fetchWorkspace,
    fetchBoards,
    setWorkspaceBoardsCache,
  ]);

  // Memoized sorted boards
  const sortedBoards = useMemo(() => {
    return [...boards].sort((a, b) => {
      // Starred boards first
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;

      // Then by last activity
      return (
        new Date(b.last_activity_at).getTime() -
        new Date(a.last_activity_at).getTime()
      );
    });
  }, [boards]);

  return {
    workspace,
    boards: sortedBoards,
    loading,
    error,
    toggleBoardStar,
    refetch,
    lastFetchTime,
    getColorDisplay,
    formatDate,
    addBoardToCache,
    removeBoardFromCache,
  };
};
