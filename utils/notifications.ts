import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationType =
  | 'mention'
  | 'comment'
  | 'due_date_changed'
  | 'moved_list';

// Matches the REAL notifications table already present in the database
// (discovered mid-build — see the migrations around
// 20260808130000_fix_handle_new_comment_mentions_cast.sql for the full
// story): related_card_id / related_board_id / related_comment_id, no
// actor_id column. There's also a pre-existing `handle_new_comment()`
// trigger that already creates `mention` notifications the moment a
// comment is INSERTed — so this file must NOT also notify mentions on
// comment create, only on comment EDIT (the trigger only fires on
// INSERT, so a mention added later by editing isn't covered by it).
//
// Every call site wraps these in try/catch and never lets a notification
// failure block the primary action — same convention this codebase
// already uses for `activities` inserts.

/**
 * Notifies people newly @mentioned by editing an existing comment. Do NOT
 * call this for a brand-new comment — the `handle_new_comment` trigger
 * already creates these on INSERT; calling this too would double-notify.
 */
export async function notifyMentionedProfiles(
  supabase: SupabaseClient,
  params: {
    cardId: string;
    boardId: string;
    commentId: string;
    cardTitle: string;
    actorId: string;
    mentionedProfileIds: string[];
  }
) {
  const recipientIds = Array.from(
    new Set(params.mentionedProfileIds.filter((id) => id !== params.actorId))
  );
  if (recipientIds.length === 0) return;

  const rows = recipientIds.map((profile_id) => ({
    profile_id,
    type: 'mention' as const,
    related_card_id: params.cardId,
    related_board_id: params.boardId,
    related_comment_id: params.commentId,
    content: `You were mentioned in a comment on "${params.cardTitle}"`,
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) console.error('Failed to create mention notifications:', error);
}

/**
 * Notifies a card's assigned members about a normal-priority update
 * (comment/due-date/move). `excludeProfileIds` lets a caller skip anyone
 * who already got a higher-priority `mention` notification for the same
 * event, so they aren't notified twice for one action.
 */
export async function notifyCardMembers(
  supabase: SupabaseClient,
  params: {
    type: Exclude<NotificationType, 'mention'>;
    actorId: string;
    cardId: string;
    boardId: string;
    content: string;
    commentId?: string;
    excludeProfileIds?: string[];
  }
) {
  const { data: members, error: membersError } = await supabase
    .from('card_members')
    .select('profile_id')
    .eq('card_id', params.cardId);

  if (membersError) {
    console.error(
      'Failed to look up card members for notification:',
      membersError
    );
    return;
  }

  const exclude = new Set([params.actorId, ...(params.excludeProfileIds || [])]);
  const recipientIds = (members || [])
    .map((m) => m.profile_id as string)
    .filter((id) => !exclude.has(id));

  if (recipientIds.length === 0) return;

  const rows = recipientIds.map((profile_id) => ({
    profile_id,
    type: params.type,
    related_card_id: params.cardId,
    related_board_id: params.boardId,
    related_comment_id: params.commentId || null,
    content: params.content,
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) console.error('Failed to create notifications:', error);
}
