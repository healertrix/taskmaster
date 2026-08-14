import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { coerceCustomFieldValue } from '@/utils/customFields';

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

// PUT /api/cards/[id]/custom-fields/[fieldId] - set (upsert) this card's
// value for a board-defined field.
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; fieldId: string } }
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

    const { id: cardId, fieldId } = params;
    const { value } = await request.json();

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

    // Field must belong to the same board as the card — same guard as
    // labels verifying labelId/board_id match before assigning.
    const { data: field, error: fieldError } = await supabase
      .from('custom_fields')
      .select('id, board_id, name, definition')
      .eq('id', fieldId)
      .eq('board_id', card.board_id)
      .single();

    if (fieldError || !field) {
      return NextResponse.json(
        { error: 'Field not found or not on same board' },
        { status: 400 }
      );
    }

    let coerced: unknown;
    try {
      coerced = coerceCustomFieldValue(field.definition, value);
    } catch (validationError) {
      return NextResponse.json(
        {
          error:
            validationError instanceof Error
              ? validationError.message
              : 'Invalid value',
        },
        { status: 400 }
      );
    }

    const { data: fieldValue, error: upsertError } = await supabase
      .from('card_custom_field_values')
      .upsert(
        {
          card_id: cardId,
          field_id: fieldId,
          value: coerced,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'card_id,field_id' }
      )
      .select()
      .single();

    if (upsertError) {
      console.error('Error setting custom field value:', upsertError);
      return NextResponse.json(
        { error: 'Failed to set custom field value' },
        { status: 500 }
      );
    }

    // Same "don't fail the main write if this fails" pattern as label
    // activity logging.
    try {
      await supabase.from('activities').insert({
        profile_id: user.id,
        board_id: card.board_id,
        card_id: cardId,
        action_type: 'custom_field_updated',
        action_data: { field_name: field.name, new_value: coerced },
      });
    } catch (activityError) {
      console.error('Failed to log activity:', activityError);
    }

    return NextResponse.json({ fieldValue });
  } catch (error) {
    console.error(
      'Error in PUT /api/cards/[id]/custom-fields/[fieldId]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/cards/[id]/custom-fields/[fieldId] - clear this card's value
// (removes the row entirely — absence IS "not set", not an empty row).
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; fieldId: string } }
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

    const { id: cardId, fieldId } = params;

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

    const { error: deleteError } = await supabase
      .from('card_custom_field_values')
      .delete()
      .eq('card_id', cardId)
      .eq('field_id', fieldId);

    if (deleteError) {
      console.error('Error clearing custom field value:', deleteError);
      return NextResponse.json(
        { error: 'Failed to clear custom field value' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      'Error in DELETE /api/cards/[id]/custom-fields/[fieldId]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
