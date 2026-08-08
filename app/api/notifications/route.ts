import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/notifications - the current user's notifications (RLS already
// scopes this to their own rows), newest first, plus an unread count for
// the bell badge.
//
// Column names (related_card_id/related_board_id/related_comment_id, no
// actor_id) match the REAL pre-existing `notifications` table — see
// utils/notifications.ts for the full story of how that was discovered.
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

    const [{ data: notifications, error }, { count: unreadCount }] =
      await Promise.all([
        supabase
          .from('notifications')
          .select(
            `
            id,
            type,
            content,
            is_read,
            created_at,
            related_card_id,
            related_board_id,
            cards:related_card_id (title, card_number:number),
            boards:related_board_id (name, board_number:number)
          `
          )
          .order('created_at', { ascending: false })
          .limit(limit),
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
