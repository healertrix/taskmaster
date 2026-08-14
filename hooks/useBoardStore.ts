import { useEffect, useCallback, useState } from 'react';
import { useAppStore } from '@/lib/stores/useAppStore';
import { useLists } from './useLists';

// Hook that bridges the lists hook with the store for real-time updates
export const useBoardStore = (boardId: string) => {
  const {
    setBoardListsCache,
    getBoardListsCache,
    addCardToListInCache,
    removeCardFromCache,
    setBoardLabelsCache,
    getBoardLabelsCache,
    updateBoardLabelInCache,
    addBoardLabelToCache,
    removeBoardLabelFromCache,
    setWorkspaceMembersForBoardCache,
    getWorkspaceMembersForBoardCache,
    setBoardCustomFieldsCache,
    getBoardCustomFieldsCache,
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

  // Fetch board custom field definitions once when board loads — same
  // reasoning as labels above. Without this, useBoardCustomFields (used by
  // the card modal's Custom Fields section) had no head start: it only
  // began fetching once a card was actually opened, well after every
  // other section (which all get cached/prefetched data passed down from
  // this hook) had already rendered — visible as custom fields being the
  // one section that "starts loading" after everything else already has.
  useEffect(() => {
    const fetchBoardCustomFields = async () => {
      if (!boardId) return;

      const cached = getBoardCustomFieldsCache(boardId);
      if (cached) return;

      try {
        const response = await fetch(`/api/boards/${boardId}/custom-fields`);
        const data = await response.json();

        if (response.ok) {
          setBoardCustomFieldsCache(boardId, data.fields || []);
        }
      } catch (error) {
        console.error('Error fetching board custom fields:', error);
      }
    };

    fetchBoardCustomFields();
  }, [boardId, setBoardCustomFieldsCache, getBoardCustomFieldsCache]);

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

  // Update card labels — goes through useLists' own setLists so `lists`
  // (this hook instance's source of truth) stays correct. The sync effect
  // above then mirrors the change into the shared cache automatically.
  // Writing directly to the cache here (the old behavior) let edits get
  // silently discarded the next time `lists` changed for any other reason,
  // since the sync effect would overwrite the cache with the stale `lists`
  // snapshot that never had this edit applied.
  const updateCardLabels = useCallback(
    (cardId: string, labels: any[]) => {
      listsActions.updateCard(cardId, { card_labels: labels });
    },
    [listsActions]
  );

  // Update card members — same reasoning as updateCardLabels above.
  const updateCardMembers = useCallback(
    (cardId: string, members: any[]) => {
      listsActions.updateCard(cardId, { card_members: members });
    },
    [listsActions]
  );

  // Update any card property — same reasoning as updateCardLabels above.
  // (This also fixes a bug where this cache-only version, spread later in
  // the return object below, silently shadowed the correct listsActions.updateCard.)
  const updateCard = useCallback(
    (cardId: string, updates: any) => {
      listsActions.updateCard(cardId, updates);
    },
    [listsActions]
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
