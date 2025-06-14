import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user's board memberships
    const { data: boardMemberships, error: membershipError } = await supabase
      .from('board_members')
      .select(
        `
        id,
        role,
        board_id,
        boards (
          id,
          name,
          workspace_id
        )
      `
      )
      .eq('profile_id', user.id);

    // Check user's cards access
    const { data: userCards, error: cardsError } = await supabase
      .from('cards')
      .select('id, title, board_id, list_id')
      .limit(5);

    // Check if user profile exists
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', user.id)
      .single();

    // Check workspace memberships
    const { data: workspaceMemberships, error: workspaceError } = await supabase
      .from('workspace_members')
      .select(
        `
        id,
        role,
        workspace_id,
        workspaces (
          id,
          name
        )
      `
      )
      .eq('profile_id', user.id);

    return NextResponse.json({
      user_id: user.id,
      user_email: user.email,
      user_profile: userProfile,
      profile_error: profileError?.message,
      board_memberships: boardMemberships || [],
      membership_error: membershipError?.message,
      workspace_memberships: workspaceMemberships || [],
      workspace_error: workspaceError?.message,
      accessible_cards: userCards || [],
      cards_error: cardsError?.message,
      summary: {
        has_profile: !!userProfile,
        board_count: boardMemberships?.length || 0,
        workspace_count: workspaceMemberships?.length || 0,
        accessible_cards_count: userCards?.length || 0,
      },
    });
  } catch (error) {
    console.error('Error in board membership debug:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}
