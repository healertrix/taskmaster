import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/cards/[id]/members/[profileId] - Remove a member from a card
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; profileId: string } }
) {
  try {
    const supabase = createClient();
    const cardId = params.id;
    const profileId = params.profileId;

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

    // Check if current user has permission to remove members
    let canRemoveMembers = false;

    // Check if user is board owner
    if (board.owner_id === user.id) {
      canRemoveMembers = true;
    } else {
      // Check if user is a direct board member
      const { data: boardMembership, error: boardMemberError } = await supabase
        .from('board_members')
        .select('id, role')
        .eq('board_id', card.board_id)
        .eq('profile_id', user.id)
        .single();

      if (!boardMemberError && boardMembership) {
        canRemoveMembers = true;
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
          canRemoveMembers = true;
        }
      }
    }

    // Users can always remove themselves from cards
    if (profileId === user.id) {
      canRemoveMembers = true;
    }

    if (!canRemoveMembers) {
      return NextResponse.json(
        { error: 'Access denied: You cannot remove members from this card' },
        { status: 403 }
      );
    }

    // Verify the card member exists
    const { data: existingMember, error: memberError } = await supabase
      .from('card_members')
      .select('id')
      .eq('card_id', cardId)
      .eq('profile_id', profileId)
      .single();

    if (memberError || !existingMember) {
      return NextResponse.json(
        { error: 'User is not a member of this card' },
        { status: 404 }
      );
    }

    // Remove the member from the card
    const { error: removeMemberError } = await supabase
      .from('card_members')
      .delete()
      .eq('card_id', cardId)
      .eq('profile_id', profileId);

    if (removeMemberError) {
      console.error('Error removing card member:', removeMemberError);
      return NextResponse.json(
        { error: 'Failed to remove card member' },
        { status: 500 }
      );
    }

    // Activity will be automatically created by database trigger

    return NextResponse.json({
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error(
      'Error in DELETE /api/cards/[id]/members/[profileId]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
