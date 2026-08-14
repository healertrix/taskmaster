import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  validateCustomFieldDefinition,
  type CustomFieldDefinition,
} from '@/utils/customFields';

// Same access check as /api/boards/[id]/labels — board owner, direct board
// member, or workspace member on a workspace-visible board.
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

// GET /api/boards/[id]/custom-fields - list field definitions for a board
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

    const { id: boardId } = params;

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

    const { data: fields, error: fieldsError } = await supabase
      .from('custom_fields')
      .select('*')
      .eq('board_id', boardId)
      .order('position', { ascending: true });

    if (fieldsError) {
      console.error('Error fetching custom fields:', fieldsError);
      return NextResponse.json(
        { error: 'Failed to fetch custom fields' },
        { status: 500 }
      );
    }

    return NextResponse.json({ fields });
  } catch (error) {
    console.error('Error in GET /api/boards/[id]/custom-fields:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/boards/[id]/custom-fields - create a new field definition
export async function POST(
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

    const { id: boardId } = params;
    const { name, definition } = (await request.json()) as {
      name?: string;
      definition?: CustomFieldDefinition;
    };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Field name is required' },
        { status: 400 }
      );
    }
    if (!definition) {
      return NextResponse.json(
        { error: 'Field type is required' },
        { status: 400 }
      );
    }

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

    // New fields go at the end of the list — count existing fields for
    // this board rather than trusting a client-supplied position.
    const { count } = await supabase
      .from('custom_fields')
      .select('id', { count: 'exact', head: true })
      .eq('board_id', boardId);

    const { data: field, error: createError } = await supabase
      .from('custom_fields')
      .insert({
        name: name.trim(),
        definition,
        board_id: boardId,
        position: count || 0,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating custom field:', createError);
      return NextResponse.json(
        { error: 'Failed to create custom field' },
        { status: 500 }
      );
    }

    return NextResponse.json({ field }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/boards/[id]/custom-fields:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
