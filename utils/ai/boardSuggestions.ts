import type { createClient } from '@/utils/supabase/server';

export interface BoardSuggestion {
  id: string;
  name: string;
  workspace_id: string;
  workspace_name: string;
}

const SUGGESTION_COUNT = 3;

// Three quick-pick boards to offer inline in the chat when no board has
// been chosen yet: scoped to the given workspace if one is already
// selected, otherwise the user's most recently active boards across every
// workspace they belong to. Starred boards are bumped to the front either
// way — same "quick pick" ordering as the board picker dropdown.
export async function getBoardSuggestions(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  workspaceId?: string | null
): Promise<BoardSuggestion[]> {
  let workspaceIds: string[];
  const workspaceNameById = new Map<string, string>();

  if (workspaceId) {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', workspaceId)
      .single();
    if (!workspace) return [];
    workspaceIds = [workspace.id];
    workspaceNameById.set(workspace.id, workspace.name);
  } else {
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(id, name)')
      .eq('profile_id', userId);
    const workspaces = (memberships || []).map((m: any) => m.workspaces).filter(Boolean);
    workspaceIds = workspaces.map((w: any) => w.id);
    workspaces.forEach((w: any) => workspaceNameById.set(w.id, w.name));
  }

  if (workspaceIds.length === 0) return [];

  const { data: boards } = await supabase
    .from('boards')
    .select('id, name, workspace_id, last_activity_at')
    .in('workspace_id', workspaceIds)
    .order('last_activity_at', { ascending: false })
    .limit(20);

  if (!boards || boards.length === 0) return [];

  const { data: stars } = await supabase
    .from('board_stars')
    .select('board_id')
    .eq('profile_id', userId)
    .in(
      'board_id',
      boards.map((b) => b.id)
    );
  const starredIds = new Set((stars || []).map((s) => s.board_id));

  const sorted = [...boards].sort((a, b) => {
    const aStar = starredIds.has(a.id) ? 1 : 0;
    const bStar = starredIds.has(b.id) ? 1 : 0;
    if (aStar !== bStar) return bStar - aStar;
    return 0; // already ordered by last_activity_at desc from the query
  });

  return sorted.slice(0, SUGGESTION_COUNT).map((b) => ({
    id: b.id,
    name: b.name,
    workspace_id: b.workspace_id,
    workspace_name: workspaceNameById.get(b.workspace_id) || '',
  }));
}
