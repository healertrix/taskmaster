import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function checkCardAccess(supabase: any, cardId: string, userId: string) {
  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('id, board_id')
    .eq('id', cardId)
    .single();

  if (cardError || !card) {
    return { hasAccess: false, error: 'Card not found', card: null };
  }

  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select('id, workspace_id, visibility, owner_id')
    .eq('id', card.board_id)
    .single();

  if (boardError || !board) {
    return { hasAccess: false, error: 'Board not found', card: null };
  }

  let hasAccess = false;

  if (board.owner_id === userId) {
    hasAccess = true;
  } else {
    const { data: boardMembership, error: boardMemberError } = await supabase
      .from('board_members')
      .select('id')
      .eq('board_id', card.board_id)
      .eq('profile_id', userId)
      .single();

    if (!boardMemberError && boardMembership) {
      hasAccess = true;
    } else if (board.visibility === 'workspace') {
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

// GET /api/cards/[id]/custom-fields - this card's set values, keyed by
// field. Field *definitions* (name/type/options) come from the board-level
// endpoint separately and are cached per-board — this only returns what's
// actually been filled in for this one card.
export async function GET(
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

    const { id: cardId } = params;

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

    const { data: values, error: valuesError } = await supabase
      .from('card_custom_field_values')
      .select('id, field_id, value, updated_at')
      .eq('card_id', cardId);

    if (valuesError) {
      console.error('Error fetching custom field values:', valuesError);
      return NextResponse.json(
        { error: 'Failed to fetch custom field values' },
        { status: 500 }
      );
    }

    return NextResponse.json({ values });
  } catch (error) {
    console.error('Error in GET /api/cards/[id]/custom-fields:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
