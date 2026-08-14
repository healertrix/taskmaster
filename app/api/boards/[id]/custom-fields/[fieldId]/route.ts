import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  validateCustomFieldDefinition,
  type CustomFieldDefinition,
} from '@/utils/customFields';

async function checkBoardAccess(supabase: any, boardId: string, userId: string) {
  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select('id, workspace_id, visibility, owner_id')
    .eq('id', boardId)
    .single();

  if (boardError || !board) {
    return { hasAccess: false, error: 'Board not found', board: null };
  }

  let hasAccess = false;

  if (board.owner_id === userId) {
    hasAccess = true;
  } else {
    const { data: boardMembership, error: boardMemberError } = await supabase
      .from('board_members')
      .select('id')
      .eq('board_id', boardId)
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

  return { hasAccess, error: null, board };
}

// PATCH /api/boards/[id]/custom-fields/[fieldId] - rename/retype/reorder a field
export async function PATCH(
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

    const { id: boardId, fieldId } = params;
    const { name, definition, position } = (await request.json()) as {
      name?: string;
      definition?: CustomFieldDefinition;
      position?: number;
    };

    if (definition) {
      try {
        validateCustomFieldDefinition(definition);
      } catch (validationError) {
        return NextResponse.json(
          {
            error:
              validationError instanceof Error
                ? validationError.message
                : 'Invalid field definition',
          },
          { status: 400 }
        );
      }
    }

    const { hasAccess, error: accessError } = await checkBoardAccess(
      supabase,
      boardId,
      user.id
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: accessError || 'Access denied' },
        { status: 403 }
      );
    }

    // A field's type can't change once created — cards may already hold
    // values shaped for the old type (a Select's option ids, a Checkbox's
    // boolean), and retyping would leave them meaningless. The UI already
    // hides this option during edit; enforced here too since the API
    // shouldn't rely on the client alone for it. Renaming (and, for
    // Select, editing/adding/removing its own options) is still fine —
    // only definition.type itself is locked.
    if (definition) {
      const { data: existingField } = await supabase
        .from('custom_fields')
        .select('definition')
        .eq('id', fieldId)
        .eq('board_id', boardId)
        .single();

      if (
        existingField &&
        existingField.definition?.type !== definition.type
      ) {
        return NextResponse.json(
          { error: "A field's type can't be changed after it's created" },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json(
          { error: 'Field name cannot be empty' },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }
    if (definition !== undefined) updates.definition = definition;
    if (position !== undefined) updates.position = position;

    const { data: field, error: updateError } = await supabase
      .from('custom_fields')
      .update(updates)
      .eq('id', fieldId)
      .eq('board_id', boardId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating custom field:', updateError);
      return NextResponse.json(
        { error: 'Failed to update custom field' },
        { status: 500 }
      );
    }
    if (!field) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 });
    }

    return NextResponse.json({ field });
  } catch (error) {
    console.error(
      'Error in PATCH /api/boards/[id]/custom-fields/[fieldId]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/boards/[id]/custom-fields/[fieldId]?countOnly=1 - how many cards
// currently have a value set for this field, for the delete-confirmation UI.
export async function GET(
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

    const { id: boardId, fieldId } = params;

    const { hasAccess, error: accessError } = await checkBoardAccess(
      supabase,
      boardId,
      user.id
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: accessError || 'Access denied' },
        { status: 403 }
      );
    }

    const { count, error: countError } = await supabase
      .from('card_custom_field_values')
      .select('id', { count: 'exact', head: true })
      .eq('field_id', fieldId);

    if (countError) {
      console.error('Error counting custom field values:', countError);
      return NextResponse.json(
        { error: 'Failed to count affected cards' },
        { status: 500 }
      );
    }

    return NextResponse.json({ cardCount: count || 0 });
  } catch (error) {
    console.error(
      'Error in GET /api/boards/[id]/custom-fields/[fieldId]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/boards/[id]/custom-fields/[fieldId] - hard delete, cascades
// to every card's stored value for this field (ON DELETE CASCADE).
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

    const { id: boardId, fieldId } = params;

    const { hasAccess, error: accessError } = await checkBoardAccess(
      supabase,
      boardId,
      user.id
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: accessError || 'Access denied' },
        { status: 403 }
      );
    }

    const { error: deleteError } = await supabase
      .from('custom_fields')
      .delete()
      .eq('id', fieldId)
      .eq('board_id', boardId);

    if (deleteError) {
      console.error('Error deleting custom field:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete custom field' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      'Error in DELETE /api/boards/[id]/custom-fields/[fieldId]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
