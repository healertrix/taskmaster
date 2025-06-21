import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper function to check if user has access to a card based on board/workspace membership
async function checkCardAccess(supabase: any, cardId: string, userId: string) {
  // Get the card and board details
  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('id, board_id')
    .eq('id', cardId)
    .single();

  if (cardError || !card) {
    return { hasAccess: false, error: 'Card not found', card: null };
  }

  // Get board details to check visibility and workspace
  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select('id, workspace_id, visibility, owner_id')
    .eq('id', card.board_id)
    .single();

  if (boardError || !board) {
    return { hasAccess: false, error: 'Board not found', card: null };
  }

  // Check access permissions (board membership OR workspace membership for workspace-visible boards)
  let hasAccess = false;

  // Check if user is board owner
  if (board.owner_id === userId) {
    hasAccess = true;
  } else {
    // Check if user is a direct board member
    const { data: boardMembership, error: boardMemberError } = await supabase
      .from('board_members')
      .select('id')
      .eq('board_id', card.board_id)
      .eq('profile_id', userId)
      .single();

    if (!boardMemberError && boardMembership) {
      hasAccess = true;
    } else if (board.visibility === 'workspace') {
      // Check if user is a workspace member for workspace-visible boards
      const { data: workspaceMembership, error: workspaceMemberError } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', board.workspace_id)
        .eq('profile_id', userId)
        .single();

      if (!workspaceMemberError && workspaceMembership) {
        hasAccess = true;
      }
    }
  }

  return { hasAccess, error: null, card };
}

// DELETE /api/cards/[id]/labels/[labelId] - Remove a label from a card
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; labelId: string } }
) {
  try {
    const supabase = createClient();

    // Get the user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: cardId, labelId } = params;

    // Check access using helper function
    const {
      hasAccess,
      error: accessError,
      card,
    } = await checkCardAccess(supabase, cardId, user.id);

    if (!hasAccess || !card) {
      return NextResponse.json(
        { error: accessError || 'Access denied' },
        { status: 403 }
      );
    }

    // Get the label info before removing for activity logging
    const { data: label, error: labelError } = await supabase
      .from('labels')
      .select('name, color')
      .eq('id', labelId)
      .single();

    // Remove the label from the card
    const { error: removeError } = await supabase
      .from('card_labels')
      .delete()
      .eq('card_id', cardId)
      .eq('label_id', labelId);

    if (removeError) {
      console.error('Error removing label from card:', removeError);
      return NextResponse.json(
        { error: 'Failed to remove label' },
        { status: 500 }
      );
    }

    // Create activity record
    if (label) {
      try {
        await supabase.from('activities').insert({
          profile_id: user.id,
          board_id: card.board_id,
          card_id: cardId,
          action_type: 'label_removed',
          action_data: {
            label_name: label.name,
            label_color: label.color,
          },
        });
      } catch (activityError) {
        // Don't fail the main operation if activity logging fails
        console.error('Failed to log activity:', activityError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/cards/[id]/labels/[labelId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
