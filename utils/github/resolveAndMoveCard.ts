import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyCardMembers } from '@/utils/notifications';

// Resolves a "#board-card" reference to the actual card row, scoped to one
// workspace (repos are one-workspace-only — see the github_repos schema —
// so there's never ambiguity about which workspace's boards to search).
// Board/card numbers are permanent and never reused (see
// supabase/supabase/migrations/20260807120000_add_scoped_display_numbers.sql),
// so this resolution is stable forever once a link is created.
export async function resolveCardByNumber(
  supabase: SupabaseClient,
  workspaceId: string,
  boardNumber: number,
  cardNumber: number
): Promise<{ id: string; list_id: string; board_id: string; title: string } | null> {
  const { data: board } = await supabase
    .from('boards')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('number', boardNumber)
    .maybeSingle();
  if (!board) return null;

  const { data: card } = await supabase
    .from('cards')
    .select('id, list_id, board_id, title')
    .eq('board_id', board.id)
    .eq('number', cardNumber)
    .maybeSingle();

  return card || null;
}

// Moves a card to its board's "done" list as a result of a merged PR — the
// same effect as a human dragging it there via /api/cards/[id]/move, just
// triggered from the webhook instead of a request from that user.
//
// Target list resolution (per the design conversation):
//   1. An explicit override list name from the PR ("Closes #3-12 -> "QA""),
//      matched case-insensitively against list names on the board.
//   2. Otherwise, the leftmost list flagged is_done_list.
//   3. Otherwise, the rightmost list on the board (matches the existing
//      fallback convention in app/api/dashboard/my-tasks/route.ts).
export async function moveCardToDoneList(
  supabase: SupabaseClient,
  params: {
    card: { id: string; list_id: string; board_id: string; title: string };
    overrideListName: string | null;
    // Attributed actor for the activity/notification — the workspace
    // admin who connected the GitHub installation (see
    // github_installations.connected_by_profile_id). May be null if that
    // profile's since been deleted; the move still happens either way,
    // just without an activity/notification (best-effort, same as every
    // other activity insert in this app).
    actorProfileId: string | null;
    prUrl: string;
    prTitle: string;
  }
): Promise<{ moved: boolean; reason?: string }> {
  const { card, overrideListName, actorProfileId, prUrl, prTitle } = params;

  const { data: lists } = await supabase
    .from('lists')
    .select('id, name, number, is_done_list')
    .eq('board_id', card.board_id)
    .order('number', { ascending: true });

  if (!lists || lists.length === 0) return { moved: false, reason: 'no_lists' };

  let targetList = overrideListName
    ? lists.find(
        (l) => l.name.trim().toLowerCase() === overrideListName.trim().toLowerCase()
      )
    : undefined;

  if (!targetList) {
    targetList = lists.find((l) => l.is_done_list);
  }
  if (!targetList) {
    targetList = lists[lists.length - 1]; // rightmost fallback
  }

  if (targetList.id === card.list_id) {
    return { moved: false, reason: 'already_in_target_list' };
  }

  // Append at the end of the target list — an automated move has no
  // meaningful "position the user dragged to," so it always lands last,
  // same as a freshly-added card would.
  const { data: lastCard } = await supabase
    .from('cards')
    .select('position')
    .eq('list_id', targetList.id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const newPosition = lastCard ? lastCard.position + 1 : 1;

  const { error: updateError } = await supabase
    .from('cards')
    .update({
      list_id: targetList.id,
      position: newPosition,
      updated_at: new Date().toISOString(),
    })
    .eq('id', card.id);

  if (updateError) {
    console.error('Failed to move card via GitHub automation:', updateError);
    return { moved: false, reason: 'update_failed' };
  }

  // Activity + notification — best-effort, same convention as every other
  // call site: never let this block/fail the move itself.
  if (actorProfileId) {
    try {
      const fromList = lists.find((l) => l.id === card.list_id);
      await supabase.from('activities').insert({
        profile_id: actorProfileId,
        board_id: card.board_id,
        card_id: card.id,
        action_type: 'card_moved',
        action_data: {
          from_list: fromList?.name || 'Unknown List',
          to_list: targetList.name,
          from_list_id: card.list_id,
          to_list_id: targetList.id,
          card_title: card.title,
          via_github_pr: { url: prUrl, title: prTitle },
        },
      });

      await notifyCardMembers(supabase, {
        type: 'moved_list',
        actorId: actorProfileId,
        cardId: card.id,
        boardId: card.board_id,
        content: `Moved to ${targetList.name} — PR merged: "${prTitle}"`,
      });
    } catch (error) {
      console.error('Failed to log GitHub-triggered move activity:', error);
    }
  }

  return { moved: true };
}
