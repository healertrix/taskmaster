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

    if (commentError) {
      console.error('Error updating comment:', commentError);
      return NextResponse.json(
        { error: 'Failed to update comment' },
        { status: 500 }
      );
    }

    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found or you do not have permission to edit it' },
        { status: 404 }
      );
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

    // Delete the comment (RLS policies will ensure user can only delete their own comments)
    const { error: deleteError } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)
      .eq('profile_id', user.id); // Ensure user can only delete their own comments

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
