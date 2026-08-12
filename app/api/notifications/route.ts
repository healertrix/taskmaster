import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/notifications - the current user's notifications (RLS already
// scopes this to their own rows), newest first, plus an unread count for
// the bell badge.
//
// Column names (related_card_id/related_board_id/related_comment_id) match
// the REAL pre-existing `notifications` table — see utils/notifications.ts
// for the full story of how that was discovered. `actor_id` was added in
// 20260814100000_notification_actor_and_preferences.sql. `dismissed_at` was
// added in 20260815100000_notifications_soft_dismiss.sql — every list here
// excludes dismissed rows (they still exist, just soft-deleted; see
// DELETE /api/notifications/[id]).
//
// Query params:
//   limit    - page size (default 30, used as 8 by the dropdown / 20 by
//              the /notifications page's infinite scroll)
//   offset   - for pagination past the first page (default 0)
//   unread   - 'true' to only return unread rows (the /notifications page's
//              Unread tab)
//   read     - 'true' to only return already-read rows (the /notifications
//              page's Read tab). Ignored if `unread` is also 'true'.
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
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) query = query.eq('is_read', false);
    else if (readOnly) query = query.eq('is_read', true);

    const [{ data: notifications, error }, { count: unreadCount }] =
      await Promise.all([
        query,
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false)
          .is('dismissed_at', null),
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
