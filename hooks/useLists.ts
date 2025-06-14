import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

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
}

export const useLists = (boardId: string) => {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const supabase = createClient();

  const fetchLists = useCallback(async () => {
    if (!boardId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/lists?board_id=${boardId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch lists');
      }

      setLists(data.lists || []);
    } catch (err) {
      console.error('Error fetching lists:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch lists');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

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

        setLists((prev) => [...prev, newList]);
        return newList;
      } catch (err) {
        console.error('Error creating list:', err);
        setError(err instanceof Error ? err.message : 'Failed to create list');
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [boardId]
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

        setLists((prev) =>
          prev.map((list) =>
            list.id === listId
              ? { ...list, cards: [...list.cards, newCard] }
              : list
          )
        );

        return newCard;
      } catch (err) {
        console.error('Error creating card:', err);
        setError(err instanceof Error ? err.message : 'Failed to create card');
        return null;
      }
    },
    [boardId]
  );

  const deleteCard = useCallback(
    async (cardId: string) => {
      try {
        // Optimistically remove from UI
        const originalLists = lists;
        setLists((prev) =>
          prev.map((list) => ({
            ...list,
            cards: list.cards.filter((card) => card.id !== cardId),
          }))
        );

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
    [lists]
  );

  const updateListName = useCallback(
    async (listId: string, newName: string) => {
      if (!newName.trim()) return false;

      try {
        // Optimistically update the UI
        const originalLists = lists;
        setLists((prev) =>
          prev.map((list) =>
            list.id === listId ? { ...list, name: newName.trim() } : list
          )
        );

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
        setLists(lists);
        setError(
          err instanceof Error ? err.message : 'Failed to update list name'
        );
        return false;
      }
    },
    [lists]
  );

  const updateCard = useCallback((cardId: string, updates: Partial<Card>) => {
    setLists((prev) =>
      prev.map((list) => ({
        ...list,
        cards: list.cards.map((card) =>
          card.id === cardId ? { ...card, ...updates } : card
        ),
      }))
    );
  }, []);

  const deleteList = useCallback(
    async (listId: string) => {
      try {
        // Optimistically remove from UI
        const originalLists = lists;
        setLists((prev) => prev.filter((list) => list.id !== listId));

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
        setLists(lists);
        setError(err instanceof Error ? err.message : 'Failed to delete list');
        return false;
      }
    },
    [lists]
  );

  const archiveList = useCallback(
    async (listId: string) => {
      try {
        // Optimistically remove from UI (archive = hide from view)
        const originalLists = lists;
        setLists((prev) => prev.filter((list) => list.id !== listId));

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
        setLists(lists);
        setError(err instanceof Error ? err.message : 'Failed to archive list');
        return false;
      }
    },
    [lists]
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
    deleteList,
    archiveList,
    refetch: fetchLists,
  };
};
