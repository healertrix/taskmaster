import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

export interface Board {
  id: string;
  name: string;
  color: string;
  starred?: boolean;
  workspace_id?: string;
  updated_at?: string;
}

// Demo boards for when user has no real data (limit to 3)
const DEMO_BOARDS: Board[] = [
  {
    id: 'demo1',
    name: 'Project Planning',
    color: 'bg-blue-600',
    starred: false,
  },
  {
    id: 'demo2',
    name: 'Website Redesign',
    color: 'bg-purple-600',
    starred: true,
  },
  {
    id: 'demo3',
    name: 'Marketing Campaign',
    color: 'bg-green-600',
    starred: false,
  },
];

export const useBoardStars = () => {
  const [starredBoards, setStarredBoards] = useState<Board[]>([]);
  const [recentBoards, setRecentBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useDemoData, setUseDemoData] = useState(false);

  const supabase = createClient();

  // Fetch starred boards for the current user
  const fetchStarredBoards = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Use demo starred boards for unauthenticated users
        const demoStarred = DEMO_BOARDS.filter((board) => board.starred);
        setStarredBoards(demoStarred);
        return;
      }

      const { data, error } = await supabase
        .from('board_stars')
        .select(
          `
          boards (
            id,
            name,
            color,
            workspace_id,
            updated_at
          )
        `
        )
        .eq('profile_id', user.id);

      if (error) {
        console.error('Error fetching starred boards:', error);
        // For starred boards, we show empty if there's an error unless we're using demo data
        if (useDemoData) {
          const demoStarred = DEMO_BOARDS.filter((board) => board.starred);
          setStarredBoards(demoStarred);
        } else {
          setStarredBoards([]);
        }
        return;
      }

      const boards =
        data?.map((item) => ({
          ...item.boards,
          starred: true,
        })) || [];

      setStarredBoards(boards as Board[]);
    } catch (err) {
      console.error('Error in fetchStarredBoards:', err);
      // For starred boards, we show empty if there's an error unless we're using demo data
      if (useDemoData) {
        const demoStarred = DEMO_BOARDS.filter((board) => board.starred);
        setStarredBoards(demoStarred);
      } else {
        setStarredBoards([]);
      }
    }
  }, [supabase, useDemoData]);

  // Fetch recent boards with starred status
  const fetchRecentBoards = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Use demo data for unauthenticated users
        setUseDemoData(true);
        setRecentBoards(DEMO_BOARDS);
        return;
      }

      // Get workspaces where user is a member
      const { data: workspaceData, error: workspaceError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('profile_id', user.id);

      if (workspaceError) {
        console.error('Error fetching workspaces:', workspaceError);
        // Fallback to demo data on error
        setUseDemoData(true);
        setRecentBoards(DEMO_BOARDS);
        return;
      }

      const workspaceIds = workspaceData?.map((wm) => wm.workspace_id) || [];

      if (workspaceIds.length === 0) {
        // Use demo data if user has no workspaces
        setUseDemoData(true);
        setRecentBoards(DEMO_BOARDS);
        return;
      }

      // Get recent boards from these workspaces (limit to 3)
      const { data: boardsData, error: boardsError } = await supabase
        .from('boards')
        .select('id, name, color, workspace_id, updated_at')
        .in('workspace_id', workspaceIds)
        .order('updated_at', { ascending: false })
        .limit(3);

      if (boardsError) {
        console.error('Error fetching recent boards:', boardsError);
        // Fallback to demo data on error
        setUseDemoData(true);
        setRecentBoards(DEMO_BOARDS);
        return;
      }

      if (!boardsData || boardsData.length === 0) {
        // Use demo data if no boards found
        setUseDemoData(true);
        setRecentBoards(DEMO_BOARDS);
        return;
      }

      // Get starred status for these boards
      const boardIds = boardsData?.map((board) => board.id) || [];

      const { data: starsData, error: starsError } = await supabase
        .from('board_stars')
        .select('board_id')
        .eq('profile_id', user.id)
        .in('board_id', boardIds);

      if (starsError) {
        console.error('Error fetching stars:', starsError);
        // Continue without starred status rather than showing demo data
      }

      const starredBoardIds = new Set(
        starsData?.map((star) => star.board_id) || []
      );

      const boardsWithStarStatus =
        boardsData?.map((board) => ({
          ...board,
          starred: starredBoardIds.has(board.id),
        })) || [];

      setUseDemoData(false);
      setRecentBoards(boardsWithStarStatus as Board[]);
    } catch (err) {
      console.error('Error in fetchRecentBoards:', err);
      // Fallback to demo data on unexpected error
      setUseDemoData(true);
      setRecentBoards(DEMO_BOARDS);
    }
  }, [supabase]);

  // Toggle star status for a board
  const toggleBoardStar = useCallback(
    async (boardId: string) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || useDemoData) {
          // Handle demo data toggling
          const currentBoard = recentBoards.find(
            (board) => board.id === boardId
          );
          if (!currentBoard) return;

          if (currentBoard.starred) {
            // Remove from starred
            setStarredBoards((prev) =>
              prev.filter((board) => board.id !== boardId)
            );
            setRecentBoards((prev) =>
              prev.map((board) =>
                board.id === boardId ? { ...board, starred: false } : board
              )
            );
          } else {
            // Add to starred
            const starredBoard = { ...currentBoard, starred: true };
            setStarredBoards((prev) => [...prev, starredBoard]);
            setRecentBoards((prev) =>
              prev.map((board) =>
                board.id === boardId ? { ...board, starred: true } : board
              )
            );
          }
          return;
        }

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
            throw deleteError;
          }

          // Update local state
          setStarredBoards((prev) =>
            prev.filter((board) => board.id !== boardId)
          );
          setRecentBoards((prev) =>
            prev.map((board) =>
              board.id === boardId ? { ...board, starred: false } : board
            )
          );
        } else {
          // Add star
          const { error: insertError } = await supabase
            .from('board_stars')
            .insert({
              board_id: boardId,
              profile_id: user.id,
            });

          if (insertError) {
            throw insertError;
          }

          // Find the board in recent boards to add to starred
          const boardToStar = recentBoards.find(
            (board) => board.id === boardId
          );
          if (boardToStar) {
            const starredBoard = { ...boardToStar, starred: true };
            setStarredBoards((prev) => [...prev, starredBoard]);
            setRecentBoards((prev) =>
              prev.map((board) =>
                board.id === boardId ? { ...board, starred: true } : board
              )
            );
          }
        }
      } catch (err) {
        console.error('Error toggling board star:', err);
        setError('Failed to toggle board star');
      }
    },
    [supabase, recentBoards, useDemoData]
  );

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      await Promise.all([fetchStarredBoards(), fetchRecentBoards()]);

      setLoading(false);
    };

    loadData();
  }, [fetchStarredBoards, fetchRecentBoards]);

  return {
    starredBoards,
    recentBoards,
    loading,
    error,
    useDemoData,
    toggleBoardStar,
    refetch: useCallback(async () => {
      await Promise.all([fetchStarredBoards(), fetchRecentBoards()]);
    }, [fetchStarredBoards, fetchRecentBoards]),
  };
};
