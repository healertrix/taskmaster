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

export const useBoardStars = () => {
  const [starredBoards, setStarredBoards] = useState<Board[]>([]);
  const [recentBoards, setRecentBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch starred boards for the current user
  const fetchStarredBoards = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStarredBoards([]);
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
        setStarredBoards([]);
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
      setStarredBoards([]);
    }
  }, [supabase]);

  // Fetch recent boards with starred status
  const fetchRecentBoards = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setRecentBoards([]);
        return;
      }

      // Get user's recent board IDs from their profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('recent_boards')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error(
          'Error fetching user profile for recent boards:',
          profileError
        );
        setRecentBoards([]);
        return;
      }

      const recentBoardIds: string[] = profile?.recent_boards || [];

      if (recentBoardIds.length === 0) {
        setRecentBoards([]);
        return;
      }

      // Fetch board details for the recent board IDs
      // We need to preserve the order from the recent_boards array
      const boardPromises = recentBoardIds.map(async (boardId) => {
        const { data: boardData, error: boardError } = await supabase
          .from('boards')
          .select('id, name, color, workspace_id, updated_at')
          .eq('id', boardId)
          .single();

        if (boardError) {
          console.error(`Error fetching board ${boardId}:`, boardError);
          return null;
        }

        return boardData;
      });

      const boardResults = await Promise.all(boardPromises);
      const boardsData = boardResults.filter((board) => board !== null);

      if (boardsData.length === 0) {
        setRecentBoards([]);
        return;
      }

      // Get starred status for these boards
      const boardIds = boardsData.map((board) => board.id);

      const { data: starsData, error: starsError } = await supabase
        .from('board_stars')
        .select('board_id')
        .eq('profile_id', user.id)
        .in('board_id', boardIds);

      if (starsError) {
        console.error('Error fetching stars:', starsError);
        // Continue without starred status
        const boardsWithoutStars = boardsData.map((board) => ({
          ...board,
          starred: false,
        }));
        setRecentBoards(boardsWithoutStars as Board[]);
        return;
      }

      const starredBoardIds = new Set(
        starsData?.map((star) => star.board_id) || []
      );

      const boardsWithStars = boardsData.map((board) => ({
        ...board,
        starred: starredBoardIds.has(board.id),
      }));

      setRecentBoards(boardsWithStars as Board[]);
    } catch (err) {
      console.error('Error in fetchRecentBoards:', err);
      setRecentBoards([]);
    }
  }, [supabase]);

  // Toggle board star status
  const toggleBoardStar = useCallback(
    async (boardId: string) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          console.warn('User not authenticated');
          return;
        }

        // Find if board is currently starred
        const isCurrentlyStarred = starredBoards.some(
          (board) => board.id === boardId
        );

        if (isCurrentlyStarred) {
          // Remove star
          const { error } = await supabase
            .from('board_stars')
            .delete()
            .eq('profile_id', user.id)
            .eq('board_id', boardId);

          if (error) {
            console.error('Error removing star:', error);
            return;
          }

          // Update local state
          setStarredBoards((prev) =>
            prev.filter((board) => board.id !== boardId)
          );
        } else {
          // Add star
          const { error } = await supabase.from('board_stars').insert({
            profile_id: user.id,
            board_id: boardId,
          });

          if (error) {
            console.error('Error adding star:', error);
            return;
          }

          // Get board details to add to starred boards
          const { data: boardData, error: boardError } = await supabase
            .from('boards')
            .select('id, name, color, workspace_id, updated_at')
            .eq('id', boardId)
            .single();

          if (boardError) {
            console.error('Error fetching board details:', boardError);
            return;
          }

          // Update local state
          setStarredBoards((prev) => [
            ...prev,
            { ...boardData, starred: true } as Board,
          ]);
        }

        // Update recent boards starred status
        setRecentBoards((prev) =>
          prev.map((board) =>
            board.id === boardId
              ? { ...board, starred: !isCurrentlyStarred }
              : board
          )
        );
      } catch (err) {
        console.error('Error toggling board star:', err);
      }
    },
    [supabase, starredBoards]
  );

  // Refetch data
  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchStarredBoards(), fetchRecentBoards()]);
    setLoading(false);
  }, [fetchStarredBoards, fetchRecentBoards]);

  // Initial data fetch
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
    toggleBoardStar,
    refetch,
  };
};
