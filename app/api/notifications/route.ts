import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/notifications - the current user's notifications (RLS already
// scopes this to their own rows), newest first, plus an unread count for
// the bell badge.
//
// Column names (related_card_id/related_board_id/related_comment_id) match
// the REAL pre-existing `notifications` table — see utils/notifications.ts
// for the full story of how that was discovered. `actor_id` was added in
// 20260814100000_notification_actor_and_preferences.sql.
//
// There used to be a dismissed_at soft-delete, separate from is_read —
// removed in 20260815110000_remove_notification_dismiss.sql. Only two
// states now: Unread (is_read = false) and Archive (is_read = true,
// permanent — nothing removes something from Archive once it's read).
//
// Query params:
//   limit    - page size (default 30, used as 5 by the dropdown / 20 by
//              the /notifications page's infinite scroll)
//   offset   - for pagination past the first page (default 0)
//   unread   - 'true' to only return unread rows (the /notifications page's
//              Unread tab)
//   read     - 'true' to only return already-read rows (the /notifications
//              page's Archive tab). Ignored if `unread` is also 'true'.
//   q        - if this looks like a ticket number ("34", "#34", "12-34",
//              "#12-34" — board_number-number, same format shown on the
//              card itself), returns only notifications about that exact
//              card, or nothing if no such card exists. Otherwise, plain
//              case-insensitive substring search against content.
//   type     - comma-separated notification `type` values to filter to,
//              e.g. 'comment,comment_on_watched_card' for the page's
//              "Comments" filter (mention/comment/comment_on_watched_card/
//              due_date_changed/moved_list/workspace_member_added)
// Parses "34", "#34", "12-34", "#12-34" into { cardNumber, boardNumber }.
// Anything else (real text, or a mix of letters and digits) isn't a
// ticket-number search at all — returns nulls, and the caller just does
// the plain content search.
function parseTicketQuery(q: string): {
  cardNumber: number | null;
  boardNumber: number | null;
} {
  const m = q.trim().match(/^#?(?:(\d+)-)?(\d+)$/);
  if (!m) return { cardNumber: null, boardNumber: null };
  return {
    boardNumber: m[1] ? parseInt(m[1], 10) : null,
    cardNumber: parseInt(m[2], 10),
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = parseInt(searchParams.get('offset') || '0');
    const unreadOnly = searchParams.get('unread') === 'true';
    const readOnly = !unreadOnly && searchParams.get('read') === 'true';
    const search = searchParams.get('q')?.trim();
    const types = searchParams
      .get('type')
      ?.split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    let query = supabase
      .from('notifications')
      .select(
        `
        id,
        type,
        content,
        is_read,
        created_at,
        actor_id,
        related_card_id,
        related_board_id,
        related_workspace_id,
        actor:actor_id (full_name, avatar_url),
        cards:related_card_id (title, card_number:number),
        boards:related_board_id (
          name,
          board_number:number,
          workspaces:workspace_id (name)
        ),
        workspaces:related_workspace_id (name)
      `
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) query = query.eq('is_read', false);
    else if (readOnly) query = query.eq('is_read', true);

    if (search) {
      const { cardNumber, boardNumber } = parseTicketQuery(search);

      if (cardNumber != null) {
        // Ticket search: find that card, show only notifications about
        // it. Not found → empty results, no fallback to text search.
        let cardsQuery = supabase
          .from('cards')
          .select('id, boards!inner(number)')
          .eq('number', cardNumber);
        if (boardNumber != null) {
          cardsQuery = cardsQuery.eq('boards.number', boardNumber);
        }
        const { data: matchingCards } = await cardsQuery;
        const cardIds = (matchingCards || []).map((c: any) => c.id);
        query =
          cardIds.length > 0
            ? query.in('related_card_id', cardIds)
            : query.eq('id', '00000000-0000-0000-0000-000000000000'); // no match, no rows
      } else {
        // Plain text search.
        query = query.ilike('content', `%${search}%`);
      }
    }

    if (types && types.length > 0) query = query.in('type', types);

    const [{ data: notifications, error }, { count: unreadCount }] =
      await Promise.all([
        query,
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false),
      ]);

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
      hasMore: (notifications || []).length === limit,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications - mark notifications read. Body is either
// { ids: string[] } for specific ones, or { markAllRead: true } for all of
// the current user's unread notifications.
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ids, markAllRead } = body;

    let query = supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('profile_id', user.id);

    if (markAllRead) {
      query = query.eq('is_read', false);
    } else if (Array.isArray(ids) && ids.length > 0) {
      query = query.in('id', ids);
    } else {
      return NextResponse.json(
        { error: 'Provide ids or markAllRead' },
        { status: 400 }
      );
    }

    const { error } = await query;

    if (error) {
      console.error('Error marking notifications read:', error);
      return NextResponse.json(
        { error: 'Failed to update notifications' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
