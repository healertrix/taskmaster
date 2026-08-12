import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// The 4 toggleable notification types — 'mention' is deliberately excluded
// (always on, no row for it; see
// supabase/supabase/migrations/20260814100000_notification_actor_and_preferences.sql).
const TOGGLEABLE_TYPES = [
  'comment',
  'comment_on_watched_card',
  'due_date_changed',
  'moved_list',
] as const;

// GET /api/notification-preferences - the current user's preferences,
// defaulting every type to enabled: true when no row exists yet (a
// missing row means "never touched this setting", not "disabled").
export async function GET() {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('type, enabled')
      .eq('profile_id', user.id);

    if (error) {
      console.error('Error fetching notification preferences:', error);
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 }
      );
    }

    const stored = new Map((data || []).map((row) => [row.type, row.enabled]));
    const preferences = TOGGLEABLE_TYPES.map((type) => ({
      type,
      enabled: stored.has(type) ? stored.get(type) : true,
    }));

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/notification-preferences - upsert one type's enabled state.
// Body: { type: string, enabled: boolean }
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
    const { type, enabled } = body;

    if (!TOGGLEABLE_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'enabled must be a boolean' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('notification_preferences')
      .upsert(
        { profile_id: user.id, type, enabled, updated_at: new Date().toISOString() },
        { onConflict: 'profile_id,type' }
      );

    if (error) {
      console.error('Error updating notification preference:', error);
      return NextResponse.json(
        { error: 'Failed to update preference' },
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
