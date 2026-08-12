import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/notifications/[id] - dismiss a single notification (read or
// not). Soft-delete, NOT a real delete: sets dismissed_at so it drops out of
// every list (GET /api/notifications filters WHERE dismissed_at IS NULL),
// but the row itself is never destroyed. This used to be a real
// `.delete()` — a single unconfirmed click permanently erased history,
// unlike every mainstream app's notification "clear" action — see
// supabase/supabase/migrations/20260815100000_notifications_soft_dismiss.sql.
// RLS (notifications_update_own, or whatever governs UPDATE on this table)
// already restricts this to the caller's own rows, but the explicit
// .eq('profile_id', user.id) here keeps the intent obvious without relying
// solely on RLS to enforce it.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('notifications')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('profile_id', user.id);

    if (error) {
      console.error('Error dismissing notification:', error);
      return NextResponse.json(
        { error: 'Failed to dismiss notification' },
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
