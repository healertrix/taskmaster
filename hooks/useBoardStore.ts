import { useEffect, useCallback, useState } from 'react';
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
    setBoardLabelsCache,
    getBoardLabelsCache,
    updateBoardLabelInCache,
    addBoardLabelToCache,
    removeBoardLabelFromCache,
    setWorkspaceMembersForBoardCache,
    getWorkspaceMembersForBoardCache,
  } = useAppStore();

  const [workspaceId, setWorkspaceId] = useState<string>('');

  // Use the existing lists hook for data fetching
  const { lists, loading, error, ...listsActions } = useLists(boardId);

  // Sync lists data to store whenever it changes
  useEffect(() => {
    if (lists.length > 0) {
      setBoardListsCache(boardId, lists);
    }
  }, [lists, boardId, setBoardListsCache]);

  // Fetch board labels once when board loads
  useEffect(() => {
    const fetchBoardLabels = async () => {
      if (!boardId) return;

      // Check cache first
      const cached = getBoardLabelsCache(boardId);
      if (cached) return;

      try {
        const response = await fetch(`/api/boards/${boardId}/labels`);
        const data = await response.json();

        if (response.ok) {
          setBoardLabelsCache(boardId, data.labels || []);
        }
      } catch (error) {
        console.error('Error fetching board labels:', error);
      }
    };

    fetchBoardLabels();
  }, [boardId, setBoardLabelsCache, getBoardLabelsCache]);

  // Fetch workspace ID and members once when board loads
  useEffect(() => {
    const fetchWorkspaceAndMembers = async () => {
      if (!boardId) return;

      try {
        // Get workspace ID from board
        const boardResponse = await fetch(`/api/boards/${boardId}`);
        const boardData = await boardResponse.json();

        if (boardResponse.ok && boardData.board?.workspace_id) {
          const fetchedWorkspaceId = boardData.board.workspace_id;
          setWorkspaceId(fetchedWorkspaceId);

          // Check cache first for members
          const cachedMembers =
            getWorkspaceMembersForBoardCache(fetchedWorkspaceId);
          if (cachedMembers) return;

          // Fetch workspace members
          const membersResponse = await fetch(
            `/api/workspaces/${fetchedWorkspaceId}/members`
          );
          const membersData = await membersResponse.json();

          if (membersResponse.ok) {
            setWorkspaceMembersForBoardCache(
              fetchedWorkspaceId,
              membersData.members || []
            );
          }
        }
      } catch (error) {
        console.error('Error fetching workspace members:', error);
      }
    };

    fetchWorkspaceAndMembers();
  }, [
    boardId,
    setWorkspaceId,
    setWorkspaceMembersForBoardCache,
    getWorkspaceMembersForBoardCache,
  ]);

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

  // Get all board labels from cache
  const getBoardLabels = useCallback(() => {
    return getBoardLabelsCache(boardId) || [];
  }, [getBoardLabelsCache, boardId]);

  // Get all workspace members from cache
  const getWorkspaceMembers = useCallback(() => {
    return workspaceId
      ? getWorkspaceMembersForBoardCache(workspaceId) || []
      : [];
  }, [getWorkspaceMembersForBoardCache, workspaceId]);

  // Get labels for a specific card by filtering card_labels
  const getCardLabels = useCallback(
    (cardId: string) => {
      const allLists = getCachedLists();
      const boardLabels = getBoardLabels();

      // Find the card in lists
      for (const list of allLists) {
        const card = list.cards.find((c: any) => c.id === cardId);
        if (card && card.card_labels) {
          // Map card_labels to CardLabel structure
          return card.card_labels.map((cardLabel: any) => {
            const fullLabel = boardLabels.find(
              (label) => label.id === cardLabel.labels.id
            );
            return {
              id: cardLabel.id,
              created_at: cardLabel.created_at,
              labels: fullLabel || cardLabel.labels,
            };
          });
        }
      }
      return [];
    },
    [getCachedLists, getBoardLabels]
  );

  // Get members for a specific card by filtering card_members
  const getCardMembers = useCallback(
    (cardId: string) => {
      const allLists = getCachedLists();

      // Find the card in lists
      for (const list of allLists) {
        const card = list.cards.find((c: any) => c.id === cardId);
        if (card && card.card_members) {
          return card.card_members;
        }
      }
      return [];
    },
    [getCachedLists]
  );

  // Update board label in cache
  const updateBoardLabel = useCallback(
    (labelId: string, updates: any) => {
      updateBoardLabelInCache(boardId, labelId, updates);
    },
    [updateBoardLabelInCache, boardId]
  );

  // Add new board label to cache
  const addBoardLabel = useCallback(
    (label: any) => {
      addBoardLabelToCache(boardId, label);
    },
    [addBoardLabelToCache, boardId]
  );

  // Remove board label from cache
  const removeBoardLabel = useCallback(
    (labelId: string) => {
      removeBoardLabelFromCache(boardId, labelId);
    },
    [removeBoardLabelFromCache, boardId]
  );

  return {
    // Data
    lists: getCachedLists(),
    loading,
    error,
    workspaceId,

    // Original actions from useLists
    ...listsActions,

    // Real-time store actions
    updateCardLabels,
    updateCardMembers,
    updateCard,
    addCardToList,
    removeCard,

    // Optimized data getters
    getBoardLabels,
    getWorkspaceMembers,
    getCardLabels,
    getCardMembers,

    // Board label management
    updateBoardLabel,
    addBoardLabel,
    removeBoardLabel,
  };
};
