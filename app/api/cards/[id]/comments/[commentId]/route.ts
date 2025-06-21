import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PUT /api/cards/[id]/comments/[commentId] - Update a comment
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const supabase = createClient();
    const { id: cardId, commentId } = params;

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Comment content is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this card by checking board membership
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, board_id, title')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      console.log('Card not found:', cardError);
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Get board details to check visibility and workspace
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id, workspace_id, visibility, owner_id')
      .eq('id', card.board_id)
      .single();

    if (boardError || !board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Check access permissions (board membership OR workspace membership for workspace-visible boards)
    let hasAccess = false;

    // Check if user is board owner
    if (board.owner_id === user.id) {
      hasAccess = true;
    } else {
      // Check if user is a direct board member
      const { data: boardMembership, error: boardMemberError } = await supabase
        .from('board_members')
        .select('id')
        .eq('board_id', card.board_id)
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
      console.log('Access denied - not a board or workspace member');
      return NextResponse.json(
        {
          error:
            'Access denied: You must be a board member or workspace member to edit comments',
        },
        { status: 403 }
      );
    }

    // Update the comment (RLS policies will ensure user can only update their own comments)
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .update({
        content: content.trim(),
        is_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', commentId)
      .eq('profile_id', user.id) // Ensure user can only update their own comments
      .select(
        `
        id,
        content,
        created_at,
        updated_at,
        is_edited,
        profiles:profile_id (
          id,
          full_name,
          avatar_url
        )
      `
      )
      .single();

    console.log('Comment update result:', {
      comment,
      commentError,
      userId: user.id,
      commentId,
    });

    if (commentError) {
      console.error('Error updating comment:', commentError);

      // Check if it's a permission error
      if (commentError.code === 'PGRST116') {
        return NextResponse.json(
          {
            error: 'Comment not found or you do not have permission to edit it',
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: `Failed to update comment: ${commentError.message}` },
        { status: 500 }
      );
    }

    if (!comment) {
      console.log('No comment returned - likely permission issue');
      return NextResponse.json(
        { error: 'Comment not found or you do not have permission to edit it' },
        { status: 403 }
      );
    }

    // Create activity record for comment update
    try {
      await supabase.from('activities').insert({
        profile_id: user.id,
        board_id: card.board_id,
        card_id: cardId,
        comment_id: commentId,
        action_type: 'comment_updated',
        action_data: {
          comment_content: content.trim(),
          card_title: card.title || 'Untitled Card',
        },
      });
    } catch (activityError) {
      console.error(
        'Error creating activity for comment update:',
        activityError
      );
      // Don't fail the comment update if activity tracking fails
    }

    return NextResponse.json({ comment });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/cards/[id]/comments/[commentId] - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const supabase = createClient();
    const { id: cardId, commentId } = params;

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get comment and card info before deletion for activity tracking
    const { data: commentData, error: commentFetchError } = await supabase
      .from('comments')
      .select(
        `
        content,
        card_id,
        cards!inner(
          board_id,
          title
        )
      `
      )
      .eq('id', commentId)
      .eq('profile_id', user.id)
      .single();

    if (commentFetchError || !commentData) {
      return NextResponse.json(
        {
          error: 'Comment not found or you do not have permission to delete it',
        },
        { status: 404 }
      );
    }

    // Create activity record for comment deletion BEFORE deleting comment
    try {
      await supabase.from('activities').insert({
        profile_id: user.id,
        board_id: (commentData as any).cards.board_id,
        card_id: cardId,
        action_type: 'comment_deleted',
        action_data: {
          deleted_comment_content: commentData.content,
          card_title: (commentData as any).cards.title,
        },
      });
    } catch (activityError) {
      console.error(
        'Error creating activity for comment deletion:',
        activityError
      );
      // Don't fail the deletion if activity tracking fails
    }

    // Delete the comment - database constraint will SET NULL on activities.comment_id
    const { error: deleteError } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('profile_id', user.id);

    if (deleteError) {
      console.error('Error deleting comment:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete comment' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
