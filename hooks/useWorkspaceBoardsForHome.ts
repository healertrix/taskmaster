import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

export interface WorkspaceBoardForHome {
  id: string;
  name: string;
  color: string;
  starred?: boolean;
}

export const useWorkspaceBoardsForHome = () => {
  const [workspaceBoards, setWorkspaceBoards] = useState<{
    [workspaceId: string]: WorkspaceBoardForHome[];
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch workspace boards with starred status
  const fetchWorkspaceBoards = useCallback(
    async (workspaceIds: string[]) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || workspaceIds.length === 0) {
          setWorkspaceBoards({});
          return;
        }

        // Fetch boards for all workspaces
        const { data: boardsData, error: boardsError } = await supabase
          .from('boards')
          .select('id, name, color, workspace_id')
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
            color: board.color,
            starred: starredBoardIds.has(board.id),
          });
          return acc;
        }, {} as { [workspaceId: string]: WorkspaceBoardForHome[] });

        setWorkspaceBoards(boardsByWorkspace);
      } catch (err) {
        console.error('Error in fetchWorkspaceBoards:', err);
        setError('Failed to fetch workspace boards');
      }
    },
    [supabase]
  );

  // Toggle star status for a board
  const toggleWorkspaceBoardStar = useCallback(
    async (boardId: string) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

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
    [supabase]
  );

  return {
    workspaceBoards,
    loading,
    error,
    fetchWorkspaceBoards,
    toggleWorkspaceBoardStar,
  };
};
