import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface WorkspaceBoardForHome {
  id: string;
  name: string;
  // Shareable display number, scoped per workspace — see the migration in
  // supabase/supabase/migrations/20260807120000_add_scoped_display_numbers.sql.
  number?: number;
  color: string;
  starred?: boolean;
  // "Last time anything happened on this board" — see the comment on
  // Board.last_activity_at in hooks/useBoardStars.ts for why this isn't
  // just `updated_at`.
  last_activity_at?: string;
}

export const useWorkspaceBoardsForHome = () => {
  const [workspaceBoards, setWorkspaceBoards] = useState<{
    [workspaceId: string]: WorkspaceBoardForHome[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  // RouteGuard already verified the user before this page's hooks ever
  // run, and AuthContext caches that verified user — reuse it instead of
  // every hook paying its own getUser() round-trip.
  const { user } = useAuth();

  // Fetch workspace boards with starred status
  const fetchWorkspaceBoards = useCallback(
    async (workspaceIds: string[]) => {
      try {
        if (!user || workspaceIds.length === 0) {
          setWorkspaceBoards({});
          return;
        }

        // Fetch boards for all workspaces
        const { data: boardsData, error: boardsError } = await supabase
          .from('boards')
          .select('id, name, number, color, workspace_id, last_activity_at')
          .in('workspace_id', workspaceIds);

        if (boardsError) {
          console.error('Error fetching workspace boards:', boardsError);
          setError(boardsError.message);
          return;
        }

        if (!boardsData || boardsData.length === 0) {
          setWorkspaceBoards({});
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
        }

        const starredBoardIds = new Set(
          starsData?.map((star) => star.board_id) || []
        );

        // Group boards by workspace with starred status
        const boardsByWorkspace = boardsData.reduce((acc, board) => {
          if (!acc[board.workspace_id]) {
            acc[board.workspace_id] = [];
          }
          acc[board.workspace_id].push({
            id: board.id,
            name: board.name,
            number: board.number,
            color: board.color,
            starred: starredBoardIds.has(board.id),
            last_activity_at: board.last_activity_at,
          });
          return acc;
        }, {} as { [workspaceId: string]: WorkspaceBoardForHome[] });

        // Merge the newly fetched boards with the existing state instead of
        // replacing it entirely. This prevents boards from other workspaces
        // (that were not part of this fetch call) from being removed from the
        // UI, which previously caused sections to "disappear" when we
        // refetched a single workspace (e.g., after starring a board).
        setWorkspaceBoards((prev) => ({
          ...prev,
          ...boardsByWorkspace,
        }));
      } catch (err) {
        console.error('Error in fetchWorkspaceBoards:', err);
        setError('Failed to fetch workspace boards');
      }
    },
    [supabase, user]
  );

  // Toggle star status for a board
  const toggleWorkspaceBoardStar = useCallback(
    async (boardId: string) => {
      try {
        if (!user) {
          throw new Error('User not authenticated');
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
          setWorkspaceBoards((prev) => {
            const updated = { ...prev };
            Object.keys(updated).forEach((workspaceId) => {
              updated[workspaceId] = updated[workspaceId].map((board) =>
                board.id === boardId ? { ...board, starred: false } : board
              );
            });
            return updated;
          });
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

          // Update local state
          setWorkspaceBoards((prev) => {
            const updated = { ...prev };
            Object.keys(updated).forEach((workspaceId) => {
              updated[workspaceId] = updated[workspaceId].map((board) =>
                board.id === boardId ? { ...board, starred: true } : board
              );
            });
            return updated;
          });
        }
      } catch (err) {
        console.error('Error toggling workspace board star:', err);
        throw err;
      }
    },
    [supabase, user]
  );

  return {
    workspaceBoards,
    loading,
    error,
    fetchWorkspaceBoards,
    toggleWorkspaceBoardStar,
  };
};
