import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const cardId = params.id;

    // Support both parameter formats for backward compatibility
    const list_id = body.list_id || body.target_list_id;
    const position =
      body.position !== undefined ? body.position : body.new_position;

    if (!list_id || position === undefined) {
      return NextResponse.json(
        { error: 'List ID and position are required' },
        { status: 400 }
      );
    }

    // Validate position is a valid number
    const numericPosition = Number(position);
    if (
      isNaN(numericPosition) ||
      !isFinite(numericPosition) ||
      numericPosition < 0
    ) {
      return NextResponse.json(
        { error: 'Position must be a valid number (0 or greater)' },
        { status: 400 }
      );
    }

    // Convert 0-based position to 1-based position for internal processing
    // Drag-and-drop sends 0-based positions, move modal sends 1-based positions
    const adjustedPosition = numericPosition === 0 ? 1 : numericPosition;

    const supabase = createClient();

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the card to validate it exists and get current info
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, title, list_id, position, board_id')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Verify user has access to the board
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id, workspace_id')
      .eq('id', card.board_id)
      .single();

    if (boardError || !board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Check if user is a workspace member
    const { data: workspaceMember, error: memberError } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', board.workspace_id)
      .eq('profile_id', user.id)
      .single();

    if (memberError || !workspaceMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Validate the target list exists and is on the same board
    const { data: targetList, error: listError } = await supabase
      .from('lists')
      .select('id, name, board_id')
      .eq('id', list_id)
      .eq('board_id', card.board_id)
      .single();

    if (listError || !targetList) {
      return NextResponse.json(
        { error: 'Target list not found or not on the same board' },
        { status: 404 }
      );
    }

    // If moving to the same list and same position, no change needed
    if (card.list_id === list_id && card.position === adjustedPosition) {
      return NextResponse.json({
        success: true,
        message: 'Card is already in the specified position',
        card: {
          id: cardId,
          list_id,
          position: adjustedPosition,
          old_list_id: card.list_id,
          old_position: card.position,
        },
      });
    }

    // Convert 1-based position to proper float position for database
    // Get cards in target list to calculate proper position (exclude the card being moved)
    const { data: targetListCards, error: cardsError } = await supabase
      .from('cards')
      .select('id, position')
      .eq('list_id', list_id)
      .neq('id', cardId) // Exclude the card being moved
      .order('position', { ascending: true });

    if (cardsError) {
      console.error('Error fetching target list cards:', cardsError);
      return NextResponse.json(
        { error: 'Failed to fetch list cards' },
        { status: 500 }
      );
    }

    let newPosition: number;

    if (!targetListCards || targetListCards.length === 0) {
      // First card in empty list (or only card being moved back to same list)
      newPosition = 1;
    } else if (adjustedPosition <= 1) {
      // Move to top - get position before first card
      const firstCard = targetListCards[0];
      newPosition = firstCard.position / 2;
      // Ensure minimum position
      if (newPosition <= 0) {
        newPosition = 0.5;
      }
    } else if (adjustedPosition > targetListCards.length) {
      // Move to bottom - get position after last card
      const lastCard = targetListCards[targetListCards.length - 1];
      newPosition = lastCard.position + 1;
    } else {
      // Move between cards - get average of two positions
      const beforeCard = targetListCards[adjustedPosition - 2];
      const afterCard = targetListCards[adjustedPosition - 1];

      if (beforeCard && afterCard) {
        newPosition = (beforeCard.position + afterCard.position) / 2;
        // Ensure we have a valid position between the two cards
        if (
          newPosition <= beforeCard.position ||
          newPosition >= afterCard.position
        ) {
          // Fallback to a safe position
          newPosition = beforeCard.position + 0.1;
        }
      } else if (beforeCard) {
        newPosition = beforeCard.position + 1;
      } else if (afterCard) {
        newPosition = afterCard.position / 2;
        if (newPosition <= 0) {
          newPosition = 0.5;
        }
      } else {
        // Fallback
        newPosition = 1;
      }
    }

    // Validate the calculated position
    if (isNaN(newPosition) || !isFinite(newPosition) || newPosition <= 0) {
      console.error('Invalid position calculated:', newPosition);
      return NextResponse.json(
        { error: 'Failed to calculate valid position' },
        { status: 500 }
      );
    }

    console.log('Moving card:', {
      cardId,
      fromList: card.list_id,
      toList: list_id,
      oldPosition: card.position,
      newPosition,
      requestedPosition: adjustedPosition,
      originalPosition: numericPosition,
      targetListCardsCount: targetListCards?.length || 0,
    });

    // Update the card position and list
    const { data: updatedCard, error: updateError } = await supabase
      .from('cards')
      .update({
        list_id: list_id,
        position: newPosition,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating card:', updateError);
      return NextResponse.json(
        { error: 'Failed to move card' },
        { status: 500 }
      );
    }

    // Create activity record for the move
    try {
      const { data: fromList } = await supabase
        .from('lists')
        .select('name')
        .eq('id', card.list_id)
        .single();

      await supabase.from('activities').insert({
        profile_id: user.id,
        board_id: card.board_id,
        card_id: cardId,
        action_type: 'card_moved',
        action_data: {
          from_list: fromList?.name || 'Unknown List',
          to_list: targetList.name,
          from_list_id: card.list_id,
          to_list_id: list_id,
          card_title: card.title,
        },
      });
    } catch (activityError) {
      console.error('Failed to log move activity:', activityError);
      // Don't fail the request if activity logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Card moved successfully',
      card: {
        id: cardId,
        list_id,
        position: newPosition,
        old_list_id: card.list_id,
        old_position: card.position,
      },
    });
  } catch (error) {
    console.error('Error in move card endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
