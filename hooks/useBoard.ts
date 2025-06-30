import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAppStore, cacheUtils } from '@/lib/stores/useAppStore';

export interface BoardData {
  id: string;
  name: string;
  description: string | null;
  color: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  is_archived: boolean;
  is_closed: boolean;
  visibility: string;
  workspace: {
    id: string;
    name: string;
    color: string;
  };
  is_starred: boolean;
}

export interface BoardMember {
  id: string;
  profile_id: string;
  role: 'admin' | 'member';
  profiles: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

export const useBoard = (boardId: string) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStarring, setIsStarring] = useState(false);

  const supabase = createClient();

  // Cache helpers
  const { getCache, setCache } = useAppStore();
  const CACHE_KEY = cacheUtils.getBoardKey(boardId);
  const CACHE_TTL = 2 * 60 * 1000; // 2 minutes TTL

  const fetchBoard = useCallback(async () => {
    if (!boardId) return;

    try {
      if (!board) setLoading(true);
      setError(null);

      // Return early from cache if available (still do background fetch for freshness)
      const cached = getCache<BoardData>(CACHE_KEY);
      if (cached) {
        setBoard(cached);
        setLoading(false);
      }

      // Get current user for starred status
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Fetch board details with workspace info
      const { data: boardData, error: boardError } = await supabase
        .from('boards')
        .select(
          `
          id,
          name,
          description,
          color,
          workspace_id,
          created_at,
          updated_at,
          owner_id,
          is_archived,
          is_closed,
          visibility,
          workspaces (
            id,
            name,
            color
          )
        `
        )
        .eq('id', boardId)
        .single();

      if (boardError) {
        throw new Error(`Failed to fetch board: ${boardError.message}`);
      }

      if (!boardData) {
        throw new Error('Board not found');
      }

      // Check if board is starred by current user
      let isStarred = false;
      if (user) {
        const { data: starData, error: starError } = await supabase
          .from('board_stars')
          .select('id')
          .eq('board_id', boardId)
          .eq('profile_id', user.id)
          .single();

        if (starError && starError.code !== 'PGRST116') {
          console.error('Error checking star status:', starError);
        } else {
          isStarred = !!starData;
        }
      }

      const freshBoard: BoardData = {
        ...boardData,
        workspace: boardData.workspaces,
        is_starred: isStarred,
      };

      setBoard(freshBoard);

      // Update cache
      setCache(CACHE_KEY, freshBoard, CACHE_TTL);
    } catch (err) {
      console.error('Error fetching board:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch board');
    } finally {
      setLoading(false);
    }
  }, [boardId, supabase, board]);

  const fetchMembers = useCallback(async () => {
    if (!boardId) return;

    try {
      const { data: membersData, error: membersError } = await supabase
        .from('board_members')
        .select(
          `
          id,
          profile_id,
          role,
          profiles!profile_id (
            id,
            full_name,
            email,
            avatar_url
          )
        `
        )
        .eq('board_id', boardId);

      if (membersError) {
        console.error('Error fetching board members:', membersError);
        return;
      }

      setMembers(membersData || []);
    } catch (err) {
      console.error('Error fetching board members:', err);
    }
  }, [boardId, supabase]);

  const toggleStar = useCallback(async () => {
    if (!board || isStarring) return;

    try {
      setIsStarring(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      if (board.is_starred) {
        // Remove star
        const { error } = await supabase
          .from('board_stars')
          .delete()
          .eq('board_id', boardId)
          .eq('profile_id', user.id);

        if (error) throw error;

        setBoard((prev) => {
          if (!prev) return null;
          const updated = { ...prev, is_starred: false };
          setCache(CACHE_KEY, updated, CACHE_TTL);
          return updated;
        });
      } else {
        // Add star
        const { error } = await supabase.from('board_stars').insert({
          board_id: boardId,
          profile_id: user.id,
        });

        if (error) throw error;

        setBoard((prev) => {
          if (!prev) return null;
          const updated = { ...prev, is_starred: true };
          setCache(CACHE_KEY, updated, CACHE_TTL);
          return updated;
        });
      }
    } catch (err) {
      console.error('Error toggling star:', err);
      // Optionally show error to user
    } finally {
      setIsStarring(false);
    }
  }, [board, boardId, isStarring, supabase]);

  const updateBoardName = useCallback(
    async (newName: string) => {
      if (!board || !newName.trim()) return false;

      try {
        const { error } = await supabase
          .from('boards')
          .update({ name: newName.trim() })
          .eq('id', boardId);

        if (error) throw error;

        setBoard((prev) => {
          if (!prev) return null;
          const updated = { ...prev, name: newName.trim() } as BoardData;
          setCache(CACHE_KEY, updated, CACHE_TTL);
          return updated;
        });
        return true;
      } catch (err) {
        console.error('Error updating board name:', err);
        return false;
      }
    },
    [board, boardId, supabase]
  );

  const updateBoardDescription = useCallback(
    async (newDescription: string) => {
      if (!board) return false;

      try {
        const { error } = await supabase
          .from('boards')
          .update({ description: newDescription.trim() || null })
          .eq('id', boardId);

        if (error) throw error;

        setBoard((prev) => {
          if (!prev) return null;
          const updated = {
            ...prev,
            description: newDescription.trim() || null,
          } as BoardData;
          setCache(CACHE_KEY, updated, CACHE_TTL);
          return updated;
        });
        return true;
      } catch (err) {
        console.error('Error updating board description:', err);
        return false;
      }
    },
    [board, boardId, supabase]
  );

  useEffect(() => {
    fetchBoard();
    fetchMembers();
  }, [fetchBoard, fetchMembers]);

  return {
    board,
    members,
    loading,
    error,
    isStarring,
    toggleStar,
    updateBoardName,
    updateBoardDescription,
    refetch: fetchBoard,
  };
};
