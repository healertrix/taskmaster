import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/boards/[id] - Get board information
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const boardId = params.id;

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get board details
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select(
        'id, name, workspace_id, visibility, owner_id, created_at, updated_at'
      )
      .eq('id', boardId)
      .single();

    if (boardError || !board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Check if user has access to this board
    let hasAccess = false;

    // Check if user is board owner
    if (board.owner_id === user.id) {
      hasAccess = true;
    } else {
      // Check if user is a direct board member
      const { data: boardMembership, error: boardMemberError } = await supabase
        .from('board_members')
        .select('id')
        .eq('board_id', boardId)
        .eq('profile_id', user.id)
        .single();

      if (!boardMemberError && boardMembership) {
        hasAccess = true;
      } else if (board.visibility === 'workspace') {
        // Check if user is a workspace member for workspace-visible boards
        const { data: workspaceMembership, error: workspaceMemberError } =
          await supabase
            .from('workspace_members')
            .select('id')
            .eq('workspace_id', board.workspace_id)
            .eq('profile_id', user.id)
            .single();

        if (!workspaceMemberError && workspaceMembership) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied: You do not have access to this board' },
        { status: 403 }
      );
    }

    return NextResponse.json({ board });
  } catch (error) {
    console.error('Error in GET /api/boards/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
