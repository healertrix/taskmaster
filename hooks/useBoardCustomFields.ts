import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/lib/stores/useAppStore';
import type { CustomFieldDefinition } from '@/utils/customFields';

export interface CustomField {
  id: string;
  board_id: string;
  name: string;
  definition: CustomFieldDefinition;
  position: number;
  created_at: string;
  updated_at: string;
}

// Fetches + caches a board's custom field *definitions* — mirrors the
// board-labels fetch in useBoardStore.ts (same cache, same "check cache
// first, fetch once per board" shape). Every card modal opened on the same
// board reuses this instead of refetching. refetch() is exposed for the
// board-settings "Manage custom fields" screen, which needs to force a
// fresh list right after creating/editing/deleting a field.
export function useBoardCustomFields(boardId: string | undefined) {
  const { setBoardCustomFieldsCache, getBoardCustomFieldsCache } = useAppStore();
  const [fields, setFields] = useState<CustomField[]>(() =>
    boardId ? getBoardCustomFieldsCache(boardId) || [] : []
  );
  const [isLoading, setIsLoading] = useState(!fields.length);

  const refetch = useCallback(async () => {
    if (!boardId) return;
    try {
      const response = await fetch(`/api/boards/${boardId}/custom-fields`);
      const data = await response.json();
      if (response.ok) {
        setFields(data.fields || []);
        setBoardCustomFieldsCache(boardId, data.fields || []);
      }
    } catch (error) {
      console.error('Error fetching custom fields:', error);
    } finally {
      setIsLoading(false);
    }
  }, [boardId, setBoardCustomFieldsCache]);

  useEffect(() => {
    if (!boardId) return;

    const cached = getBoardCustomFieldsCache(boardId);
    if (cached) {
      setFields(cached);
      setIsLoading(false);
      return;
    }

    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  return { fields, isLoading, refetch };
}
