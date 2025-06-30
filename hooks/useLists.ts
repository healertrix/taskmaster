import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAppStore, cacheUtils } from '@/lib/stores/useAppStore';

export interface List {
  id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
  cards: Card[];
}

export interface Card {
  id: string;
  title: string;
  description?: string;
  position: number;
  created_at: string;
  updated_at: string;
  start_date?: string;
  due_date?: string;
  due_status?: string;
  created_by: string;
  profiles?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  card_members?: Array<{
    id: string;
    created_at: string;
    profiles: {
      id: string;
      full_name: string;
      avatar_url?: string;
      email: string;
    };
  }>;
  card_labels?: Array<{
    id: string;
    labels: {
      id: string;
      name: string;
      color: string;
    };
  }>;
}

export const useLists = (boardId: string) => {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const supabase = createClient();

  // Cache helpers
  const { getCache, setCache } = useAppStore();
  const CACHE_KEY = cacheUtils.getBoardListsKey(boardId);
  const CACHE_TTL = 60 * 1000; // 1 minute TTL

  const fetchLists = useCallback(async () => {
    if (!boardId) return;

    try {
      if (lists.length === 0) setLoading(true);
      setError(null);

      // Serve from cache immediately if present
      const cached = getCache<List[]>(CACHE_KEY);
      if (cached) {
        setLists(cached);
        setLoading(false);
      }

      const response = await fetch(`/api/lists?board_id=${boardId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch lists');
      }

      const freshLists = data.lists || [];
      setLists(freshLists);

      // Update cache
      setCache(CACHE_KEY, freshLists, CACHE_TTL);
    } catch (err) {
      console.error('Error fetching lists:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch lists');
    } finally {
      setLoading(false);
    }
  }, [boardId, lists.length, getCache, setCache]);

  const createList = useCallback(
    async (name: string) => {
      if (!boardId || !name.trim()) return null;

      try {
        setIsCreating(true);
        setError(null);

        const response = await fetch('/api/lists', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name.trim(),
            board_id: boardId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create list');
        }

        // Add the new list to the current lists
        const newList: List = {
          ...data.list,
          cards: [],
        };

        setLists((prev) => {
          const updated = [...prev, newList];
          setCache(CACHE_KEY, updated, CACHE_TTL);
          return updated;
        });
        return newList;
      } catch (err) {
        console.error('Error creating list:', err);
        setError(err instanceof Error ? err.message : 'Failed to create list');
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [boardId, setCache]
  );

  const createCard = useCallback(
    async (listId: string, title: string) => {
      if (!boardId || !listId || !title.trim()) return null;

      try {
        setError(null);

        const response = await fetch('/api/cards', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: title.trim(),
            list_id: listId,
            board_id: boardId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create card');
        }

        // Add the new card to the appropriate list
        const newCard = {
          ...data.card,
          profiles: data.card.profiles || null,
        };

        setLists((prev) => {
          const updated = prev.map((list) =>
            list.id === listId
              ? { ...list, cards: [...list.cards, newCard] }
              : list
          );
          setCache(CACHE_KEY, updated, CACHE_TTL);
          return updated;
        });

        return newCard;
      } catch (err) {
        console.error('Error creating card:', err);
        setError(err instanceof Error ? err.message : 'Failed to create card');
        return null;
      }
    },
    [boardId, setCache]
  );

  const deleteCard = useCallback(
    async (cardId: string) => {
      try {
        // Optimistically remove from UI
        const originalLists = lists;
        setLists((prev) => {
          const updated = prev.map((list) => ({
            ...list,
            cards: list.cards.filter((card) => card.id !== cardId),
          }));
          setCache(CACHE_KEY, updated, CACHE_TTL);
          return updated;
        });

        const response = await fetch(`/api/cards/${cardId}`, {
          method: 'DELETE',
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to delete card');
        }

        return true;
      } catch (err) {
        console.error('Error deleting card:', err);
        // Revert the optimistic update
        setLists(originalLists);
        setError(err instanceof Error ? err.message : 'Failed to delete card');
        return false;
      }
    },
    [lists, setCache]
  );

  const updateListName = useCallback(
    async (listId: string, newName: string) => {
      if (!newName.trim()) return false;

      try {
        // Optimistically update the UI
        const originalLists = lists;
        setLists((prev) => {
          const updated = prev.map((list) =>
            list.id === listId ? { ...list, name: newName.trim() } : list
          );
          setCache(CACHE_KEY, updated, CACHE_TTL);
          return updated;
        });

        const response = await fetch('/api/lists', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: listId,
            name: newName.trim(),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update list name');
        }

        return true;
      } catch (err) {
        console.error('Error updating list name:', err);
        // Revert the optimistic update
        setLists((prev) => {
          setCache(CACHE_KEY, prev, CACHE_TTL);
          return prev;
        });
        setError(
          err instanceof Error ? err.message : 'Failed to update list name'
        );
        return false;
      }
    },
    [lists, setCache]
  );

  const updateCard = useCallback(
    (cardId: string, updates: Partial<Card>) => {
      setLists((prev) => {
        const updated = prev.map((list) => ({
          ...list,
          cards: list.cards.map((card) =>
            card.id === cardId ? { ...card, ...updates } : card
          ),
        }));
        setCache(CACHE_KEY, updated, CACHE_TTL);
        return updated;
      });
    },
    [setCache]
  );

  const deleteList = useCallback(
    async (listId: string) => {
      try {
        // Optimistically remove from UI
        const originalLists = lists;
        setLists((prev) => {
          const updated = prev.filter((list) => list.id !== listId);
          setCache(CACHE_KEY, updated, CACHE_TTL);
          return updated;
        });

        const response = await fetch(`/api/lists?id=${listId}`, {
          method: 'DELETE',
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to delete list');
        }

        return true;
      } catch (err) {
        console.error('Error deleting list:', err);
        // Revert the optimistic update
        setLists((prev) => {
          setCache(CACHE_KEY, prev, CACHE_TTL);
          return prev;
        });
        setError(err instanceof Error ? err.message : 'Failed to delete list');
        return false;
      }
    },
    [lists, setCache]
  );

  const archiveList = useCallback(
    async (listId: string) => {
      try {
        // Optimistically remove from UI (archive = hide from view)
        const originalLists = lists;
        setLists((prev) => {
          const updated = prev.filter((list) => list.id !== listId);
          setCache(CACHE_KEY, updated, CACHE_TTL);
          return updated;
        });

        const response = await fetch('/api/lists', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: listId,
            is_archived: true,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to archive list');
        }

        return true;
      } catch (err) {
        console.error('Error archiving list:', err);
        // Revert the optimistic update
        setLists((prev) => {
          setCache(CACHE_KEY, prev, CACHE_TTL);
          return prev;
        });
        setError(err instanceof Error ? err.message : 'Failed to archive list');
        return false;
      }
    },
    [lists, setCache]
  );

  const moveCard = useCallback(
    (
      cardId: string,
      sourceListId: string,
      targetListId: string,
      newPosition: number
    ) => {
      setLists((prev) => {
        // Find the card being moved
        let cardToMove: Card | null = null;
        let oldIndex = -1;

        // Remove card from source list and capture the old index
        const listsWithCardRemoved = prev.map((list) => {
          if (list.id === sourceListId) {
            oldIndex = list.cards.findIndex((c) => c.id === cardId);

            const updatedCards = list.cards.filter((card) => {
              if (card.id === cardId) {
                cardToMove = card;
                return false;
              }
              return true;
            });
            return { ...list, cards: updatedCards };
          }
          return list;
        });

        if (!cardToMove) return prev;

        // Add card to target list at the specified position
        const updatedLists = listsWithCardRemoved.map((list) => {
          if (list.id === targetListId) {
            const updatedCards = [...list.cards];
            let insertIndex = newPosition;

            // If moving within the same list, adjust index if necessary
            if (sourceListId === targetListId) {
              // After removal, if the original index was before the new index, the new index decreases by 1
              if (oldIndex !== -1 && oldIndex < newPosition) {
                insertIndex = newPosition - 1;
              }
            }

            if (insertIndex < 0) insertIndex = 0;
            if (insertIndex > updatedCards.length) {
              insertIndex = updatedCards.length;
            }

            updatedCards.splice(insertIndex, 0, cardToMove!);
            return { ...list, cards: updatedCards };
          }
          return list;
        });

        // Update cache with new list state
        setCache(CACHE_KEY, updatedLists, CACHE_TTL);
        return updatedLists;
      });
    },
    [setCache]
  );

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  return {
    lists,
    loading,
    error,
    isCreating,
    createList,
    createCard,
    deleteCard,
    updateListName,
    updateCard,
    moveCard,
    deleteList,
    archiveList,
    refetch: fetchLists,
  };
};
