import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { notifyCardMembers } from '@/utils/notifications';

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

    // Get cards in target list to calculate the new fractional position
    // (excludes the card being moved, so `position` below is a 0-based
    // index into exactly this array — the same coordinate space the
    // client computes it in)
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

    const cards = targetListCards || [];
    // Clamp to a valid index — large sentinel values (e.g. 999999 from the
    // "move to end" modal) collapse to "append at the end".
    const index = Math.max(0, Math.min(Math.trunc(numericPosition), cards.length));

    let newPosition: number;

    if (cards.length === 0) {
      // Only card in the (target) list
      newPosition = 1;
    } else if (index === 0) {
      // Move to top - get position before first card
      newPosition = cards[0].position / 2;
      if (newPosition <= 0) {
        newPosition = 0.5;
      }
    } else if (index === cards.length) {
      // Move to bottom - get position after last card
      newPosition = cards[cards.length - 1].position + 1;
    } else {
      // Move between cards - get average of the two neighboring positions
      const beforeCard = cards[index - 1];
      const afterCard = cards[index];
      newPosition = (beforeCard.position + afterCard.position) / 2;
      // Ensure we have a valid position between the two cards
      if (
        newPosition <= beforeCard.position ||
        newPosition >= afterCard.position
      ) {
        // Fallback to a safe position
        newPosition = beforeCard.position + 0.1;
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

      // A reorder within the same list isn't a move worth notifying
      // about — only a genuine list-to-list change is.
      if (card.list_id !== list_id) {
        try {
          await notifyCardMembers(supabase, {
            type: 'moved_list',
            actorId: user.id,
            cardId,
            boardId: card.board_id,
            content: `Moved from ${fromList?.name || 'a list'} to ${targetList.name}`,
          });
        } catch (notificationError) {
          console.error(
            'Failed to create move notifications:',
            notificationError
          );
        }
      }
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
