import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper function to check if user has access to a board based on board/workspace membership
async function checkBoardAccess(supabase: any, boardId: string, userId: string) {
  // Get board details to check visibility and workspace
  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select('id, workspace_id, visibility, owner_id')
    .eq('id', boardId)
    .single();

  if (boardError || !board) {
    return { hasAccess: false, error: 'Board not found', board: null };
  }

  // Check access permissions (board membership OR workspace membership for workspace-visible boards)
  let hasAccess = false;

  // Check if user is board owner
  if (board.owner_id === userId) {
    hasAccess = true;
  } else {
    // Check if user is a direct board member
    const { data: boardMembership, error: boardMemberError } = await supabase
      .from('board_members')
      .select('id')
      .eq('board_id', boardId)
      .eq('profile_id', userId)
      .single();

    if (!boardMemberError && boardMembership) {
      hasAccess = true;
    } else if (board.visibility === 'workspace') {
      // Check if user is a workspace member for workspace-visible boards
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

// GET /api/boards/[id]/labels - Get all labels for a board
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { id: boardId } = params;

    // Check access using helper function
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

    // Get all labels for the board
    const { data: labels, error: labelsError } = await supabase
      .from('labels')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: true });

    if (labelsError) {
      console.error('Error fetching labels:', labelsError);
      return NextResponse.json(
        { error: 'Failed to fetch labels' },
        { status: 500 }
      );
    }

    return NextResponse.json({ labels });
  } catch (error) {
    console.error('Error in GET /api/boards/[id]/labels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/boards/[id]/labels - Create a new label
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { id: boardId } = params;
    const { name, color } = await request.json();

    // Validate input
    if (!color) {
      return NextResponse.json({ error: 'Color is required' }, { status: 400 });
    }

    // Check access using helper function
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

    // Create the label
    const { data: label, error: createError } = await supabase
      .from('labels')
      .insert({
        name: name || null,
        color,
        board_id: boardId,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating label:', createError);
      return NextResponse.json(
        { error: 'Failed to create label' },
        { status: 500 }
      );
    }

    return NextResponse.json({ label }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/boards/[id]/labels:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
