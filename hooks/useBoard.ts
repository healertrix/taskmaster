import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAppStore, cacheUtils } from '@/lib/stores/useAppStore';
import { useAuth } from '@/context/AuthContext';

export interface BoardData {
  id: string;
  name: string;
  // Shareable display number, scoped per workspace — see the migration in
  // supabase/supabase/migrations/20260807120000_add_scoped_display_numbers.sql.
  number?: number;
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
  // RouteGuard already verified the user before this page's hooks ever
  // run, and AuthContext caches that verified user — reuse it instead of
  // paying another getUser() round-trip here.
  const { user } = useAuth();

  // Cache helpers
  const { getCache, setCache, updateBoardInCache } = useAppStore();
  const CACHE_KEY = cacheUtils.getBoardKey(boardId);
  const CACHE_TTL = 2 * 60 * 1000; // 2 minutes TTL

  // Tracks whether a board has ever loaded, so fetchBoard can skip
  // flashing the loading spinner on a refetch — without needing `board`
  // itself in fetchBoard's dependency array. `board` used to be a
  // dependency there, but fetchBoard also calls setBoard(), so every
  // successful fetch changed fetchBoard's identity, which retriggered the
  // effect below that calls it, which fetched again — a self-perpetuating
  // infinite refetch loop, not a one-time fetch on mount. That's also why
  // a fetch could fire during the few seconds after a board was deleted
  // and hit the now-gone row, surfacing as "Failed to fetch board: Cannot
  // coerce the result to a single JSON object" instead of the app just
  // navigating away cleanly.
  const hasLoadedRef = useRef(false);

  const fetchBoard = useCallback(async () => {
    if (!boardId) return;

    try {
      if (!hasLoadedRef.current) setLoading(true);
      setError(null);

      // Return early from cache if available (still do background fetch for freshness)
      const cached = getCache<BoardData>(CACHE_KEY);
      if (cached) {
        setBoard(cached);
        setLoading(false);
      }

      const { data: boardData, error: boardError } = await supabase
        .from('boards')
        .select(
          `
          id,
          name,
          number,
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
        // PGRST116 is PostgREST's ".single() found 0 rows" code, which
        // surfaces as "Cannot coerce the result to a single JSON object" —
        // that's just "this board doesn't exist (anymore)", most often
        // because it was just deleted (e.g. a stale board tile from a
        // workspace list that hadn't been refreshed yet). Give it a plain,
        // non-scary message instead of the raw Postgres error text.
        if (boardError.code === 'PGRST116') {
          throw new Error('This board no longer exists.');
        }
        throw new Error(`Failed to fetch board: ${boardError.message}`);
      }

      if (!boardData) {
        throw new Error('This board no longer exists.');
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
      hasLoadedRef.current = true;

      // Update cache
      setCache(CACHE_KEY, freshBoard, CACHE_TTL);
    } catch (err) {
      console.error('Error fetching board:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch board');
    } finally {
      setLoading(false);
    }
  }, [boardId, supabase, user]);

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
  }, [board, boardId, isStarring, supabase, user]);

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
          // Also patch the board's entry in its workspace's board-list
          // cache — otherwise the rename only shows up there after that
          // cache separately expires or a hard refresh forces a refetch.
          updateBoardInCache(updated.workspace_id, boardId, {
            name: updated.name,
          });
          return updated;
        });
        return true;
      } catch (err) {
        console.error('Error updating board name:', err);
        return false;
      }
    },
    [board, boardId, supabase, updateBoardInCache]
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

  const updateBoardColor = useCallback(
    async (newColor: string) => {
      if (!board || !newColor) return false;

      try {
        const { error } = await supabase
          .from('boards')
          .update({ color: newColor })
          .eq('id', boardId);

        if (error) throw error;

        setBoard((prev) => {
          if (!prev) return null;
          const updated = { ...prev, color: newColor } as BoardData;
          setCache(CACHE_KEY, updated, CACHE_TTL);
          // Patch the board's entry in its workspace's board-list cache too
          // — this hook's own CACHE_KEY only covers the single-board page,
          // so without this, the color change was invisible on the
          // workspace boards grid / starred / home pages until their
          // separate caches expired (or a hard refresh forced a refetch).
          updateBoardInCache(updated.workspace_id, boardId, {
            color: newColor,
          });
          return updated;
        });
        return true;
      } catch (err) {
        console.error('Error updating board color:', err);
        return false;
      }
    },
    [board, boardId, supabase, updateBoardInCache]
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
    updateBoardColor,
    refetch: fetchBoard,
  };
};
