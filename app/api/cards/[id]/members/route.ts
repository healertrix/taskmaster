import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/cards/[id]/members - Get all members assigned to a card
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

    // Verify the card exists and user has access
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, board_id, title')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Get board details to check visibility and workspace
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id, workspace_id, visibility, owner_id')
      .eq('id', card.board_id)
      .single();

    if (boardError || !board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Check access permissions
    let hasAccess = false;

    // Check if user is board owner
    if (board.owner_id === user.id) {
      hasAccess = true;
    } else {
      // Check if user is a direct board member
      const { data: boardMembership, error: boardMemberError } = await supabase
        .from('board_members')
        .select('id')
        .eq('board_id', card.board_id)
        .eq('profile_id', user.id)
        .single();

      if (!boardMemberError && boardMembership) {
        hasAccess = true;
      } else if (board.visibility === 'workspace') {
        // Check if user is a workspace member for workspace-visible boards
        const { data: workspaceMembership, error: workspaceMemberError } =
          await supabase
            .from('workspace_members')
            .select('id')
            .eq('workspace_id', board.workspace_id)
            .eq('profile_id', user.id)
            .single();

        if (!workspaceMemberError && workspaceMembership) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            'Access denied: You must be a board member or workspace member',
        },
        { status: 403 }
      );
    }

    // Fetch card members with profile information
    const { data: cardMembers, error: membersError } = await supabase
      .from('card_members')
      .select(
        `
        id,
        created_at,
        profiles:profile_id(id, full_name, avatar_url, email)
      `
      )
      .eq('card_id', cardId)
      .order('created_at', { ascending: true });

    if (membersError) {
      console.error('Error fetching card members:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch card members' },
        { status: 500 }
      );
    }

    return NextResponse.json({ members: cardMembers || [] });
  } catch (error) {
    console.error('Error in GET /api/cards/[id]/members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/cards/[id]/members - Add a member to a card
export async function POST(
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

    const body = await request.json();
    const { profile_id } = body;

    if (!profile_id) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    // Verify the card exists and user has access
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, board_id, title')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Get board details to check visibility and workspace
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id, workspace_id, visibility, owner_id')
      .eq('id', card.board_id)
      .single();

    if (boardError || !board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Check if current user has permission to add members
    let canAddMembers = false;

    // Check if user is board owner
    if (board.owner_id === user.id) {
      canAddMembers = true;
    } else {
      // Check if user is a direct board member
      const { data: boardMembership, error: boardMemberError } = await supabase
        .from('board_members')
        .select('id, role')
        .eq('board_id', card.board_id)
        .eq('profile_id', user.id)
        .single();

      if (!boardMemberError && boardMembership) {
        canAddMembers = true;
      } else if (board.visibility === 'workspace') {
        // Check if user is a workspace member for workspace-visible boards
        const { data: workspaceMembership, error: workspaceMemberError } =
          await supabase
            .from('workspace_members')
            .select('id')
            .eq('workspace_id', board.workspace_id)
            .eq('profile_id', user.id)
            .single();

        if (!workspaceMemberError && workspaceMembership) {
          canAddMembers = true;
        }
      }
    }

    if (!canAddMembers) {
      return NextResponse.json(
        { error: 'Access denied: You cannot add members to this card' },
        { status: 403 }
      );
    }

    // Verify the user being added has access to the board
    let targetUserHasAccess = false;

    // Check if target user is board owner
    if (board.owner_id === profile_id) {
      targetUserHasAccess = true;
    } else {
      // Check if target user is a direct board member
      const { data: targetBoardMembership, error: targetBoardMemberError } =
        await supabase
          .from('board_members')
          .select('id')
          .eq('board_id', card.board_id)
          .eq('profile_id', profile_id)
          .single();

      if (!targetBoardMemberError && targetBoardMembership) {
        targetUserHasAccess = true;
      } else if (board.visibility === 'workspace') {
        // Check if target user is a workspace member for workspace-visible boards
        const {
          data: targetWorkspaceMembership,
          error: targetWorkspaceMemberError,
        } = await supabase
          .from('workspace_members')
          .select('id')
          .eq('workspace_id', board.workspace_id)
          .eq('profile_id', profile_id)
          .single();

        if (!targetWorkspaceMemberError && targetWorkspaceMembership) {
          targetUserHasAccess = true;
        }
      }
    }

    if (!targetUserHasAccess) {
      return NextResponse.json(
        { error: 'Cannot add user: They do not have access to this board' },
        { status: 400 }
      );
    }

    // Add the member to the card (will fail if already exists due to unique constraint)
    const { data: cardMember, error: addMemberError } = await supabase
      .from('card_members')
      .insert({
        card_id: cardId,
        profile_id: profile_id,
      })
      .select(
        `
        id,
        created_at,
        profiles:profile_id(id, full_name, avatar_url, email)
      `
      )
      .single();

    if (addMemberError) {
      if (addMemberError.code === '23505') {
        // Unique constraint violation
        return NextResponse.json(
          { error: 'User is already a member of this card' },
          { status: 400 }
        );
      }
      console.error('Error adding card member:', addMemberError);
      return NextResponse.json(
        { error: 'Failed to add card member' },
        { status: 500 }
      );
    }

    // Activity will be automatically created by database trigger

    return NextResponse.json({
      message: 'Member added successfully',
      member: cardMember,
    });
  } catch (error) {
    console.error('Error in POST /api/cards/[id]/members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
