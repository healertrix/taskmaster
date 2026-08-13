import type { createClient } from '@/utils/supabase/server';

const HISTORY_SCAN_LIMIT = 200;

export interface DraftTurn {
  role: 'user' | 'assistant';
  content: string;
}

// The "draft" is everything the user has said (and been told) since the
// last task was created or the last manual discard/complete — that's the
// whole back-and-forth the skeleton generator uses as context. Boundary is
// whichever comes most recently:
//   - message_type='confirmation' (a task was just created)
//   - metadata.kind='draft_reset' (user hit Discard, or Done after assigning)
//   - metadata.kind='post_create_actions' (the "assign people / set a due
//     date?" follow-up itself) — treated as a boundary too so its own text
//     never leaks into the next task's context even if the user starts
//     typing again without explicitly clicking Done.
// No separate "draft" table — the boundary is just read off the existing
// persisted log.
export async function getDraftMessages(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<DraftTurn[]> {
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('role, content, message_type, metadata')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_SCAN_LIMIT);

  if (error || !data) return [];

  const draft: DraftTurn[] = [];
  for (const row of data) {
    const kind = (row.metadata as any)?.kind;
    const isBoundary =
      row.message_type === 'confirmation' || kind === 'draft_reset' || kind === 'post_create_actions';
    if (isBoundary) break;
    draft.push({ role: row.role as 'user' | 'assistant', content: row.content });
  }

  return draft.reverse();
}
