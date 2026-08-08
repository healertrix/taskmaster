import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/notifications/[id] - dismiss a single notification outright
// (read or not). RLS (notifications_delete_own) already restricts this to
// the caller's own rows, but the explicit .eq('profile_id', user.id) here
// keeps the intent obvious without relying solely on RLS to enforce it.
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
      .delete()
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
