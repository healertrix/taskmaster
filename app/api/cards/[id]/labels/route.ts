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

// GET /api/cards/[id]/labels - Get all labels assigned to a card
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { id: cardId } = params;

    // Check access using helper function
    const { hasAccess, error: accessError } = await checkCardAccess(
      supabase,
      cardId,
      user.id
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: accessError || 'Access denied' },
        { status: 403 }
      );
    }

    // Get labels assigned to the card
    const { data: cardLabels, error: labelsError } = await supabase
      .from('card_labels')
      .select(
        `
        id,
        created_at,
        labels (
          id,
          name,
          color,
          board_id
        )
      `
      )
      .eq('card_id', cardId);

    if (labelsError) {
      console.error('Error fetching card labels:', labelsError);
      return NextResponse.json(
        { error: 'Failed to fetch card labels' },
        { status: 500 }
      );
    }

    return NextResponse.json({ labels: cardLabels });
  } catch (error) {
    console.error('Error in GET /api/cards/[id]/labels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/cards/[id]/labels - Assign a label to a card
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { id: cardId } = params;
    const { labelId } = await request.json();

    // Validate input
    if (!labelId) {
      return NextResponse.json(
        { error: 'Label ID is required' },
        { status: 400 }
      );
    }

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

    // Verify the label belongs to the same board
    const { data: label, error: labelError } = await supabase
      .from('labels')
      .select('id, board_id, name, color')
      .eq('id', labelId)
      .eq('board_id', card.board_id)
      .single();

    if (labelError || !label) {
      return NextResponse.json(
        { error: 'Label not found or not on same board' },
        { status: 400 }
      );
    }

    // Assign the label to the card (using upsert to handle duplicates)
    const { data: cardLabel, error: assignError } = await supabase
      .from('card_labels')
      .upsert({
        card_id: cardId,
        label_id: labelId,
      })
      .select(
        `
        id,
        created_at,
        labels (
          id,
          name,
          color,
          board_id
        )
      `
      )
      .single();

    if (assignError) {
      console.error('Error assigning label to card:', assignError);
      return NextResponse.json(
        { error: 'Failed to assign label' },
        { status: 500 }
      );
    }

    // Create activity record
    try {
      await supabase.from('activities').insert({
        profile_id: user.id,
        board_id: card.board_id,
        card_id: cardId,
        action_type: 'label_added',
        action_data: {
          label_name: label.name,
          label_color: label.color,
        },
      });
    } catch (activityError) {
      // Don't fail the main operation if activity logging fails
      console.error('Failed to log activity:', activityError);
    }

    return NextResponse.json({ cardLabel }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/cards/[id]/labels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
