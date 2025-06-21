import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper function to check board access
async function checkBoardAccess(supabase: any, boardId: string, userId: string) {
  // Get board details to check visibility and workspace
  const { data: board, error: boardError } = await supabase
    .from('boards')
    .select('id, workspace_id, visibility, owner_id')
    .eq('id', boardId)
    .single();

  if (boardError || !board) {
    return { hasAccess: false, error: 'Board not found', userRole: null };
  }

  // Check access permissions
  let hasAccess = false;
  let userRole = null;

  // Check if user is board owner
  if (board.owner_id === userId) {
    hasAccess = true;
    userRole = 'owner';
  } else {
    // Check if user is a direct board member
    const { data: boardMembership, error: boardMemberError } = await supabase
      .from('board_members')
      .select('id, role')
      .eq('board_id', boardId)
      .eq('profile_id', userId)
      .single();

    if (!boardMemberError && boardMembership) {
      hasAccess = true;
      userRole = boardMembership.role;
    } else if (board.visibility === 'workspace') {
      // Check if user is a workspace member for workspace-visible boards
      const { data: workspaceMembership, error: workspaceMemberError } = await supabase
        .from('workspace_members')
        .select('id, role')
        .eq('workspace_id', board.workspace_id)
        .eq('profile_id', userId)
        .single();

      if (!workspaceMemberError && workspaceMembership) {
        hasAccess = true;
        userRole = workspaceMembership.role;
      }
    }
  }

  return { hasAccess, error: null, userRole };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  try {
    const supabase = createClient();
    const cardId = params.id;
    const attachmentId = params.attachmentId;

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, url, type } = body;

    console.log('PUT attachment request:', {
      cardId,
      attachmentId,
      name,
      url,
      type,
    });

    if (!name || !url || !type) {
      return NextResponse.json(
        { error: 'Name, URL, and type are required' },
        { status: 400 }
      );
    }

    // Get attachment details first using correct column names
    const { data: attachment, error: attachmentError } = await supabase
      .from('card_attachments')
      .select('id, card_id, filename, created_by')
      .eq('id', attachmentId)
      .eq('card_id', cardId)
      .single();

    if (attachmentError || !attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Verify the card exists and user has access
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, board_id, title')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Check access using helper function
    const {
      hasAccess,
      error: accessError,
      userRole,
    } = await checkBoardAccess(supabase, card.board_id, user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: accessError || 'Access denied' },
        { status: 403 }
      );
    }

    // Only allow editing if user created the attachment or is admin/owner
    if (
      attachment.created_by !== user.id &&
      !['admin', 'owner'].includes(userRole)
    ) {
      return NextResponse.json(
        { error: 'You can only edit your own attachments' },
        { status: 403 }
      );
    }

    // Update the attachment using correct column names
    const { data: updatedAttachment, error: updateError } = await supabase
      .from('card_attachments')
      .update({
        filename: name.trim(),
        file_url: url.trim(),
      })
      .eq('id', attachmentId)
      .eq('card_id', cardId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating attachment:', updateError);
      console.error('Update query details:', {
        table: 'card_attachments',
        updateData: {
          filename: name.trim(),
          file_url: url.trim(),
        },
        whereClause: { id: attachmentId, card_id: cardId },
      });
      return NextResponse.json(
        { error: 'Failed to update attachment' },
        { status: 500 }
      );
    }

    // Activity is now automatically created by database trigger

    // Transform the response to match the expected format
    const transformedAttachment = {
      id: updatedAttachment.id,
      name: updatedAttachment.filename,
      url: updatedAttachment.file_url,
      type: type.trim(),
      created_at: updatedAttachment.created_at,
      created_by: updatedAttachment.created_by,
    };

    return NextResponse.json({
      message: 'Attachment updated successfully',
      attachment: transformedAttachment,
    });
  } catch (error) {
    console.error(
      'Error in PUT /api/cards/[id]/attachments/[attachmentId]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  try {
    const supabase = createClient();
    const cardId = params.id;
    const attachmentId = params.attachmentId;

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get attachment details first using correct column names
    const { data: attachment, error: attachmentError } = await supabase
      .from('card_attachments')
      .select('id, card_id, filename, created_by')
      .eq('id', attachmentId)
      .eq('card_id', cardId)
      .single();

    if (attachmentError || !attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // Verify the card exists and user has access
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, board_id, title')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Check access using helper function
    const {
      hasAccess,
      error: accessError,
      userRole,
    } = await checkBoardAccess(supabase, card.board_id, user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: accessError || 'Access denied' },
        { status: 403 }
      );
    }

    // Only allow deletion if user created the attachment or is admin/owner
    if (
      attachment.created_by !== user.id &&
      !['admin', 'owner'].includes(userRole)
    ) {
      return NextResponse.json(
        { error: 'You can only delete your own attachments' },
        { status: 403 }
      );
    }

    // Delete the attachment
    const { error: deleteError } = await supabase
      .from('card_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('card_id', cardId);

    if (deleteError) {
      console.error('Error deleting attachment:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete attachment' },
        { status: 500 }
      );
    }

    // Activity is now automatically created by database trigger

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      'Error in DELETE /api/cards/[id]/attachments/[attachmentId]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
