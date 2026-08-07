import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/profile/activity - The current user's own recent activity
// (things they did), across every card they've touched, for the profile
// page's activity feed. Filtered to profile_id = the caller's own id, so
// no separate board/workspace access check is needed beyond auth — it's
// entirely their own activity rows.
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

    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select(
        `
        id,
        action_type,
        action_data,
        created_at,
        cards!inner (
          id,
          title,
          board_id,
          boards!inner ( id, name )
        )
      `
      )
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (activitiesError) {
      console.error('Error fetching profile activity:', activitiesError);
      return NextResponse.json(
        { error: 'Failed to fetch activity' },
        { status: 500 }
      );
    }

    const shaped = (activities || []).map((activity: any) => ({
      id: activity.id,
      action_type: activity.action_type,
      action_data: activity.action_data,
      created_at: activity.created_at,
      card_id: activity.cards?.id,
      card_title: activity.cards?.title,
      board_id: activity.cards?.board_id,
      board_name: activity.cards?.boards?.name,
    }));

    return NextResponse.json({ activities: shaped });
  } catch (error) {
    console.error('Error in GET /api/profile/activity:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
