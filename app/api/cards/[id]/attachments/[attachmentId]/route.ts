import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

    // Verify user has access to the board (either they created the attachment or they are a board member)
    const { data: boardAccess, error: boardError } = await supabase
      .from('board_members')
      .select('id, role')
      .eq('board_id', card.board_id)
      .eq('profile_id', user.id)
      .single();

    if (boardError || !boardAccess) {
      return NextResponse.json(
        { error: 'Board not found or access denied' },
        { status: 403 }
      );
    }

    // Only allow editing if user created the attachment or is admin/owner
    if (
      attachment.created_by !== user.id &&
      !['admin', 'owner'].includes(boardAccess.role)
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

    // Verify user has access to the board (either they created the attachment or they are a board member)
    const { data: boardAccess, error: boardError } = await supabase
      .from('board_members')
      .select('id, role')
      .eq('board_id', card.board_id)
      .eq('profile_id', user.id)
      .single();

    if (boardError || !boardAccess) {
      return NextResponse.json(
        { error: 'Board not found or access denied' },
        { status: 403 }
      );
    }

    // Only allow deletion if user created the attachment or is admin/owner
    if (
      attachment.created_by !== user.id &&
      !['admin', 'owner'].includes(boardAccess.role)
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
