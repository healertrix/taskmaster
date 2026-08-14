import type { createClient } from '@/utils/supabase/server';

export interface ListSetupState {
  // 'none' — no unresolved nudge/proposal for this board; either never
  // started, or already resolved (created or declined).
  // 'nudge_pending' — the "want default lists?" message was sent; the
  // next user message for this board should be read as their answer,
  // not as more task content.
  // 'proposal_pending' — a list_setup_proposal preview is sitting there
  // waiting on its own Approve/Cancel buttons, not a text reply.
  kind: 'none' | 'nudge_pending' | 'proposal_pending';
}

const SCAN_LIMIT = 50;

// Derived from the message log itself, same reasoning as
// utils/ai/chatDraft.ts and the frontend's skeletonResolution — no
// separate "pending nudge" table, just the most recent list-setup-kind
// message resolved_board_id-scoped to this board. Scans this user's
// recent messages (not draft-boundary-limited — a board's emptiness is a
// board fact, not a per-draft one) for the newest of: list_setup_created/
// _declined (resolved, stop) vs _proposal/_nudge (still pending).
export async function getListSetupState(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  boardId: string
): Promise<ListSetupState> {
  const { data } = await supabase
    .from('ai_chat_messages')
    .select('metadata, resolved_board_id')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(SCAN_LIMIT);

  if (!data) return { kind: 'none' };

  for (const row of data) {
    if (row.resolved_board_id !== boardId) continue;
    const kind = (row.metadata as any)?.kind;
    if (kind === 'list_setup_created' || kind === 'list_setup_declined') {
      return { kind: 'none' };
    }
    if (kind === 'list_setup_proposal') return { kind: 'proposal_pending' };
    if (kind === 'list_setup_nudge') return { kind: 'nudge_pending' };
  }

  return { kind: 'none' };
}

export async function isBoardEmpty(
  supabase: ReturnType<typeof createClient>,
  boardId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('lists')
    .select('id')
    .eq('board_id', boardId)
    .eq('is_archived', false)
    .limit(1);
  return !data || data.length === 0;
}
