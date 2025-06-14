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

    // Verify user has access to the board
    const { data: boardAccess, error: boardError } = await supabase
      .from('board_members')
      .select('id')
      .eq('board_id', card.board_id)
      .eq('profile_id', user.id)
      .single();

    if (boardError || !boardAccess) {
      return NextResponse.json(
        { error: 'Board not found or access denied' },
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

    // Update positions in a transaction
    const { data: updatedCard, error: updateError } = await supabase.rpc(
      'move_card_to_list',
      {
        card_id: cardId,
        new_list_id: target_list_id,
        new_position: new_position,
      }
    );

    if (updateError) {
      console.error('Error moving card:', updateError);

      // Fallback to simple update if stored procedure doesn't exist
      const { data: fallbackCard, error: fallbackError } = await supabase
        .from('cards')
        .update({
          list_id: target_list_id,
          position: new_position,
        })
        .eq('id', cardId)
        .select('id, list_id, position')
        .single();

      if (fallbackError) {
        console.error('Fallback update also failed:', fallbackError);
        return NextResponse.json(
          { error: 'Failed to move card' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: 'Card moved successfully',
        card: fallbackCard,
      });
    }

    return NextResponse.json({
      message: 'Card moved successfully',
      card: updatedCard,
    });
  } catch (error) {
    console.error('Error in card move:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
