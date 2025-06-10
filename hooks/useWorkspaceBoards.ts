import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

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

export const useWorkspaceBoards = (workspaceId: string) => {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<WorkspaceBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch workspace data
  const fetchWorkspace = useCallback(async () => {
    try {
      const { data: workspaceData, error: workspaceError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (workspaceError) {
        setError('Workspace not found');
        return;
      }

      setWorkspace(workspaceData);
    } catch (err) {
      console.error('Error fetching workspace:', err);
      setError('Failed to fetch workspace');
    }
  }, [supabase, workspaceId]);

  // Fetch boards with starred status
  const fetchBoards = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('User not authenticated');
        return;
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

      // Fetch boards in this workspace
      const { data: boardsData, error: boardsError } = await supabase
        .from('boards')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_archived', false)
        .order('updated_at', { ascending: false });

      if (boardsError) {
        console.error('Error fetching boards:', boardsError);
        setError('Failed to fetch boards');
        return;
      }

      if (!boardsData || boardsData.length === 0) {
        setBoards([]);
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

      const boardsWithStarStatus = boardsData.map((board) => ({
        ...board,
        starred: starredBoardIds.has(board.id),
      }));

      setBoards(boardsWithStarStatus);
    } catch (err) {
      console.error('Error in fetchBoards:', err);
      setError('Failed to fetch boards');
    }
  }, [supabase, workspaceId]);

  // Toggle star status for a board
  const toggleBoardStar = useCallback(
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
          setBoards((prev) =>
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

          // Update local state
          setBoards((prev) =>
            prev.map((board) =>
              board.id === boardId ? { ...board, starred: true } : board
            )
          );
        }
      } catch (err) {
        console.error('Error toggling board star:', err);
        throw err; // Re-throw to handle in component
      }
    },
    [supabase]
  );

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      await Promise.all([fetchWorkspace(), fetchBoards()]);

      setLoading(false);
    };

    if (workspaceId) {
      loadData();
    }
  }, [fetchWorkspace, fetchBoards, workspaceId]);

  return {
    workspace,
    boards,
    loading,
    error,
    toggleBoardStar,
    refetch: useCallback(async () => {
      await Promise.all([fetchWorkspace(), fetchBoards()]);
    }, [fetchWorkspace, fetchBoards]),
  };
};
