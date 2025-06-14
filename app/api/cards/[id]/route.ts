import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/cards/[id] - Delete a specific card
export async function DELETE(
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

    // Fetch the card to verify it exists and get board info
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, title, board_id, list_id')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Verify user has access to the board (this will check RLS policies)
    const { data: boardData, error: boardError } = await supabase
      .from('boards')
      .select('id, name')
      .eq('id', card.board_id)
      .single();

    if (boardError || !boardData) {
      return NextResponse.json(
        { error: 'Board not found or access denied' },
        { status: 403 }
      );
    }

    // Delete card-related data first (to respect foreign key constraints)

    // Delete card comments
    const { error: commentsError } = await supabase
      .from('card_comments')
      .delete()
      .eq('card_id', cardId);

    if (commentsError) {
      console.error('Error deleting card comments:', commentsError);
    }

    // Delete card attachments
    const { error: attachmentsError } = await supabase
      .from('card_attachments')
      .delete()
      .eq('card_id', cardId);

    if (attachmentsError) {
      console.error('Error deleting card attachments:', attachmentsError);
    }

    // Delete card members
    const { error: cardMembersError } = await supabase
      .from('card_members')
      .delete()
      .eq('card_id', cardId);

    if (cardMembersError) {
      console.error('Error deleting card members:', cardMembersError);
    }

    // Delete card labels
    const { error: cardLabelsError } = await supabase
      .from('card_labels')
      .delete()
      .eq('card_id', cardId);

    if (cardLabelsError) {
      console.error('Error deleting card labels:', cardLabelsError);
    }

    // Delete activities related to this card
    const { error: activitiesError } = await supabase
      .from('activities')
      .delete()
      .eq('card_id', cardId);

    if (activitiesError) {
      console.error('Error deleting card activities:', activitiesError);
    }

    // Finally, delete the card itself
    const { data: deletedCard, error: cardDeleteError } = await supabase
      .from('cards')
      .delete()
      .eq('id', cardId)
      .select()
      .single();

    if (cardDeleteError) {
      console.error('Error deleting card:', cardDeleteError);
      throw new Error(`Failed to delete card: ${cardDeleteError.message}`);
    }

    if (!deletedCard) {
      throw new Error('Card deletion failed - no card was deleted');
    }

    return NextResponse.json({
      message: 'Card deleted successfully',
      deletedCard: {
        id: deletedCard.id,
        title: deletedCard.title,
        board_id: deletedCard.board_id,
        list_id: deletedCard.list_id,
      },
    });
  } catch (error) {
    console.error('Error in card deletion:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete card',
        details: 'An error occurred during the deletion process.',
      },
      { status: 500 }
    );
  }
}

// GET /api/cards/[id] - Get a specific card
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

    // Fetch the card with related data
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select(
        `
        *,
        profiles:created_by(id, email, full_name, avatar_url),
        card_comments(
          id,
          comment,
          created_at,
          profiles:created_by(id, full_name, avatar_url)
        ),
        card_attachments(
          id,
          filename,
          file_url,
          file_size,
          created_at
        ),
        card_members(
          profiles:profile_id(id, full_name, avatar_url)
        ),
        card_labels(
          id,
          color,
          name
        )
      `
      )
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Verify user has access to the board
    const { data: boardData, error: boardError } = await supabase
      .from('boards')
      .select('id')
      .eq('id', card.board_id)
      .single();

    if (boardError || !boardData) {
      return NextResponse.json(
        { error: 'Board not found or access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({ card });
  } catch (error) {
    console.error('Error fetching card:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/cards/[id] - Update a specific card
export async function PUT(
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
    const { title, description, start_date, due_date, due_status } = body;

    // Fetch the card to verify it exists and get board info
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, board_id')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Verify user has access to the board
    const { data: boardData, error: boardError } = await supabase
      .from('boards')
      .select('id')
      .eq('id', card.board_id)
      .single();

    if (boardError || !boardData) {
      return NextResponse.json(
        { error: 'Board not found or access denied' },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined)
      updateData.description = description?.trim() || null;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (due_status !== undefined) updateData.due_status = due_status;

    // Update the card
    const { data: updatedCard, error: updateError } = await supabase
      .from('cards')
      .update(updateData)
      .eq('id', cardId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating card:', updateError);
      return NextResponse.json(
        { error: 'Failed to update card' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Card updated successfully',
      card: updatedCard,
    });
  } catch (error) {
    console.error('Error in card update:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
