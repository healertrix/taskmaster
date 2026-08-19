import { useCallback, useEffect, useState } from 'react';
import type { TemplateStructure } from '@/utils/boardTemplates';

export interface BoardTemplate {
  id: string;
  // null on starter templates (is_system: true) — they aren't owned by
  // anyone, see the starter_board_templates migration.
  owner_id: string | null;
  is_system: boolean;
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
//
// GET /api/templates returns both the caller's own templates and the
// shared starter set in one response (RLS itself does the union — the
// route has no explicit owner_id filter, see its own comment) — split
// apart here so callers don't have to re-derive "mine vs. starter" from
// is_system every time.
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

  const personalTemplates = templates.filter((t) => !t.is_system);
  const starterTemplates = templates.filter((t) => t.is_system);

  return { templates, personalTemplates, starterTemplates, isLoading, refetch };
}
