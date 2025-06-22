import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
    const { target_list_id, new_position } = body;

    if (!target_list_id) {
      return NextResponse.json(
        { error: 'Target list ID is required' },
        { status: 400 }
      );
    }

    if (new_position === undefined || new_position === null) {
      return NextResponse.json(
        { error: 'New position is required' },
        { status: 400 }
      );
    }

    // Fetch the card to verify it exists and get current info
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, list_id, position, board_id')
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

    // Check access permissions (board membership OR workspace membership for workspace-visible boards)
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

    // Verify target list exists and belongs to the same board
    const { data: targetList, error: listError } = await supabase
      .from('lists')
      .select('id, board_id')
      .eq('id', target_list_id)
      .eq('board_id', card.board_id)
      .single();

    if (listError || !targetList) {
      return NextResponse.json(
        { error: 'Target list not found or does not belong to this board' },
        { status: 404 }
      );
    }

    // If moving to the same list and same position, no change needed
    if (card.list_id === target_list_id && card.position === new_position) {
      return NextResponse.json({
        message: 'No changes needed',
        card: card,
      });
    }

    // Get list names for activity logging
    const { data: fromList } = await supabase
      .from('lists')
      .select('name')
      .eq('id', card.list_id)
      .single();

    const { data: toList } = await supabase
      .from('lists')
      .select('name')
      .eq('id', target_list_id)
      .single();

    // Direct update instead of using stored procedure
    const { data: updatedCard, error: updateError } = await supabase
        .from('cards')
        .update({
          list_id: target_list_id,
          position: new_position,
        updated_at: new Date().toISOString(),
        })
        .eq('id', cardId)
      .select('id, list_id, position');

    if (updateError) {
      console.error('Error moving card:', updateError);
        return NextResponse.json(
          { error: 'Failed to move card' },
          { status: 500 }
        );
      }

    // Check if any rows were updated
    if (!updatedCard || updatedCard.length === 0) {
      console.error(
        'No card was updated - card might not exist or no permissions'
      );
      return NextResponse.json(
        { error: 'Card not found or no permission to update' },
        { status: 404 }
      );
    }

    // Create activity for card move
    try {
      await supabase.from('activities').insert({
        profile_id: user.id,
        board_id: card.board_id,
        card_id: cardId,
        action_type: 'card_moved',
        action_data: {
          from_list: fromList?.name || 'Unknown List',
          to_list: toList?.name || 'Unknown List',
          from_list_id: card.list_id,
          to_list_id: target_list_id,
        },
      });
    } catch (activityError) {
      console.error('Failed to log move activity:', activityError);
    }

    return NextResponse.json({
      message: 'Card moved successfully',
      card: updatedCard[0],
    });
  } catch (error) {
    console.error('Error in card move:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
