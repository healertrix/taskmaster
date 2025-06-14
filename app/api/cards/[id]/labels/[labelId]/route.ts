import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

    // Get the card to verify access
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select(
        `
        id,
        board_id,
        boards!inner (
          board_members!inner (
            profile_id
          )
        )
      `
      )
      .eq('id', cardId)
      .eq('boards.board_members.profile_id', user.id)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: 'Card not found or access denied' },
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
