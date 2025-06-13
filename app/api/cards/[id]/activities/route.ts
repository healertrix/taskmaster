import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/cards/[id]/activities - Fetch activities for a card
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const cardId = params.id;

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this card
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, board_id')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Check if user is a board member
    const { data: membership, error: membershipError } = await supabase
      .from('board_members')
      .select('id')
      .eq('board_id', card.board_id)
      .eq('profile_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        {
          error: 'Access denied: You must be a board member to view activities',
        },
        { status: 403 }
      );
    }

    // Fetch activities with user profiles
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select(
        `
        id,
        action_type,
        action_data,
        created_at,
        profiles:profile_id (
          id,
          full_name,
          avatar_url
        ),
        comments:comment_id (
          id,
          content
        )
      `
      )
      .eq('card_id', cardId)
      .order('created_at', { ascending: false }); // Most recent first

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
      return NextResponse.json(
        { error: 'Failed to fetch activities' },
        { status: 500 }
      );
    }

    return NextResponse.json({ activities: activities || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
