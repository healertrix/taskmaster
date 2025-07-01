import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/stores/useAppStore';
import { useLists } from './useLists';

// Hook that bridges the lists hook with the store for real-time updates
export const useBoardStore = (boardId: string) => {
  const {
    setBoardListsCache,
    getBoardListsCache,
    updateCardLabelsInCache,
    updateCardMembersInCache,
    updateCardInCache,
    addCardToListInCache,
    removeCardFromCache,
  } = useAppStore();

  // Use the existing lists hook for data fetching
  const { lists, loading, error, ...listsActions } = useLists(boardId);

  // Sync lists data to store whenever it changes
  useEffect(() => {
    if (lists.length > 0) {
      setBoardListsCache(boardId, lists);
    }
  }, [lists, boardId, setBoardListsCache]);

  // Get cached lists
  const getCachedLists = useCallback(() => {
    return getBoardListsCache(boardId) || lists;
  }, [getBoardListsCache, boardId, lists]);

  // Update card labels in real-time
  const updateCardLabels = useCallback(
    (cardId: string, labels: any[]) => {
      updateCardLabelsInCache(boardId, cardId, labels);
    },
    [updateCardLabelsInCache, boardId]
  );

  // Update card members in real-time
  const updateCardMembers = useCallback(
    (cardId: string, members: any[]) => {
      updateCardMembersInCache(boardId, cardId, members);
    },
    [updateCardMembersInCache, boardId]
  );

  // Update any card property in real-time
  const updateCard = useCallback(
    (cardId: string, updates: any) => {
      updateCardInCache(boardId, cardId, updates);
    },
    [updateCardInCache, boardId]
  );

  // Add card to list in real-time
  const addCardToList = useCallback(
    (listId: string, card: any) => {
      addCardToListInCache(boardId, listId, card);
    },
    [addCardToListInCache, boardId]
  );

  // Remove card in real-time
  const removeCard = useCallback(
    (cardId: string) => {
      removeCardFromCache(boardId, cardId);
    },
    [removeCardFromCache, boardId]
  );

  return {
    // Data
    lists: getCachedLists(),
    loading,
    error,

    // Original actions from useLists
    ...listsActions,

    // Real-time store actions
    updateCardLabels,
    updateCardMembers,
    updateCard,
    addCardToList,
    removeCard,
  };
};
