import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface Board {
  id: string;
  name: string;
  // Shareable display number, scoped per workspace — see the migration in
  // supabase/supabase/migrations/20260807120000_add_scoped_display_numbers.sql.
  number?: number;
  color: string;
  starred?: boolean;
  workspace_id?: string;
  // Only actually needed where boards from different workspaces are mixed
  // together without any grouping (Starred/Recent Boards on the home
  // page) — not set/used where boards are already grouped under their
  // workspace's own heading.
  workspace_name?: string;
  // "Last updated" as shown to the user means "last time anything
  // happened on this board" (a card moved, created, edited — same
  // semantic Jira/ADO use for an issue's own "Updated" timestamp), NOT
  // when the board's own row (name/description/color) last changed —
  // that's what the `updated_at` column actually means, and it's the
  // wrong one to show here. See the migration in
  // supabase/supabase/migrations/20260809100000_bump_board_last_activity.sql.
  last_activity_at?: string;
}

export const useBoardStars = () => {
  const [starredBoards, setStarredBoards] = useState<Board[]>([]);
  const [recentBoards, setRecentBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  // RouteGuard already verified the user against the Auth server before
  // this page's hooks ever run, and AuthContext caches that verified user —
  // reuse it instead of every hook paying its own getUser() round-trip.
  const { user, isLoading: authLoading } = useAuth();

  // Fetch starred boards for the current user
  const fetchStarredBoards = useCallback(async () => {
    try {
      if (!user) {
        setStarredBoards([]);
        return;
      }

      // Ordered by the starred board's own last_activity_at (most recently
      // active first) via the embedded `boards` relation — same reasoning
      // as useWorkspaceBoardsForHome's board query: an unordered `.eq()`
      // fetch has no guaranteed row order in Postgres, which is what made
      // this section's boards visibly reshuffle on every reload.
      const { data, error } = await supabase
        .from('board_stars')
        .select(
          `
          boards (
            id,
            name,
            board_number:number,
            color,
            workspace_id,
            last_activity_at,
            workspaces:workspace_id ( name )
          )
        `
        )
        .eq('profile_id', user.id)
        .order('last_activity_at', { referencedTable: 'boards', ascending: false, nullsFirst: false });

      if (error) {
        console.error('Error fetching starred boards:', error);
        setStarredBoards([]);
        return;
      }

      // Aliased to board_number above and renamed back to `number` here —
      // a bare `number` column name inside this relation select otherwise
      // trips up supabase-js's compile-time select-string type parser
      // (it collides with the `number` TS type keyword during inference).
      const boards =
        data?.map((item: any) => {
          const { board_number, workspaces, ...rest } = item.boards;
          return {
            ...rest,
            number: board_number,
            workspace_name: workspaces?.name,
            starred: true,
          };
        }) || [];

      setStarredBoards(boards as Board[]);
    } catch (err) {
      console.error('Error in fetchStarredBoards:', err);
      setStarredBoards([]);
    }
  }, [supabase, user]);

  // Fetch recent boards with starred status
  const fetchRecentBoards = useCallback(async () => {
    try {
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
          .select(
            'id, name, number, color, workspace_id, last_activity_at, workspaces:workspace_id(name)'
          )
          .eq('id', boardId)
          .maybeSingle();

        if (boardError) {
          console.error(`Error fetching board ${boardId}:`, boardError);
          return null;
        }

        return boardData;
      });

      const boardResults = await Promise.all(boardPromises);
      const boardsData = boardResults
        .filter((board) => board !== null)
        .map((board: any) => {
          const { workspaces, ...rest } = board;
          return { ...rest, workspace_name: workspaces?.name };
        });

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
  }, [supabase, user]);

  // Toggle board star status
  const toggleBoardStar = useCallback(
    async (boardId: string) => {
      try {
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
            .select(
            'id, name, number, color, workspace_id, last_activity_at, workspaces:workspace_id(name)'
          )
            .eq('id', boardId)
            .maybeSingle();

          if (boardError || !boardData) {
            console.error('Error fetching board details:', boardError);
            return;
          }

          // Update local state
          const { workspaces, ...boardRest } = boardData as any;
          setStarredBoards((prev) => [
            ...prev,
            {
              ...boardRest,
              workspace_name: workspaces?.name,
              starred: true,
            } as Board,
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
    [supabase, starredBoards, user]
  );

  // Refetch data
  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchStarredBoards(), fetchRecentBoards()]);
    setLoading(false);
  }, [fetchStarredBoards, fetchRecentBoards]);

  // Initial data fetch — wait for AuthContext to resolve so `user` isn't
  // still null just because its own getUser() call hasn't finished yet.
  useEffect(() => {
    if (authLoading) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      await Promise.all([fetchStarredBoards(), fetchRecentBoards()]);
      setLoading(false);
    };

    loadData();
  }, [authLoading, fetchStarredBoards, fetchRecentBoards]);

  return {
    starredBoards,
    recentBoards,
    loading,
    error,
    toggleBoardStar,
    refetch,
  };
};
