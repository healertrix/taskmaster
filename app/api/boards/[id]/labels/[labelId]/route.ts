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

// PUT /api/boards/[id]/labels/[labelId] - Update a label
export async function PUT(
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

    const { id: boardId, labelId } = params;
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

    // Update the label
    const { data: label, error: updateError } = await supabase
      .from('labels')
      .update({
        name: name || null,
        color,
        updated_at: new Date().toISOString(),
      })
      .eq('id', labelId)
      .eq('board_id', boardId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating label:', updateError);
      return NextResponse.json(
        { error: 'Failed to update label' },
        { status: 500 }
      );
    }

    if (!label) {
      return NextResponse.json({ error: 'Label not found' }, { status: 404 });
    }

    return NextResponse.json({ label });
  } catch (error) {
    console.error('Error in PUT /api/boards/[id]/labels/[labelId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/boards/[id]/labels/[labelId] - Delete a label
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

    const { id: boardId, labelId } = params;

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

    // Delete the label (this will also cascade delete card_labels entries)
    const { error: deleteError } = await supabase
      .from('labels')
      .delete()
      .eq('id', labelId)
      .eq('board_id', boardId);

    if (deleteError) {
      console.error('Error deleting label:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete label' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/boards/[id]/labels/[labelId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
