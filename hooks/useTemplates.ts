import { useCallback, useEffect, useState } from 'react';
import type { TemplateStructure } from '@/utils/boardTemplates';

export interface BoardTemplate {
  id: string;
  owner_id: string;
  name: string;
  structure: TemplateStructure;
  created_at: string;
  updated_at: string;
}

// Personal, cross-workspace, no board/cache scoping needed — unlike
// board-scoped data (labels, custom fields), there's no per-board cache
// key here, just "my templates," fetched once per mount. Small, personal,
// infrequently-changing list — no need for the shared Zustand cache
// machinery the board-scoped hooks use.
export function useTemplates() {
  const [templates, setTemplates] = useState<BoardTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const response = await fetch('/api/templates');
      const data = await response.json();
      if (response.ok) setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { templates, isLoading, refetch };
}
