import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const cardId = params.id;

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

    if (!name || !url || !type) {
      return NextResponse.json(
        { error: 'Name, URL, and type are required' },
        { status: 400 }
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

    // Verify user has access to the board
    const { data: boardAccess, error: boardError } = await supabase
      .from('board_members')
      .select('id')
      .eq('board_id', card.board_id)
      .eq('profile_id', user.id)
      .single();

    if (boardError || !boardAccess) {
      return NextResponse.json(
        { error: 'Board not found or access denied' },
        { status: 403 }
      );
    }

    // Create the attachment using correct column names
    const { data: attachment, error: attachmentError } = await supabase
      .from('card_attachments')
      .insert({
        card_id: cardId,
        filename: name.trim(),
        file_url: url.trim(),
        created_by: user.id,
      })
      .select('*')
      .single();

    if (attachmentError) {
      console.error('Error creating attachment:', attachmentError);
      return NextResponse.json(
        { error: 'Failed to create attachment' },
        { status: 500 }
      );
    }

    // Create activity record for attachment addition
    const { error: activityError } = await supabase.from('activities').insert({
      card_id: cardId,
      action_type: 'attachment_added',
      action_data: {
        attachment_name: name.trim(),
        attachment_url: url.trim(),
        attachment_type: type.trim(),
      },
      created_by: user.id,
    });

    if (activityError) {
      console.error('Error creating activity record:', activityError);
      // Don't fail the request if activity creation fails
    }

    // Transform the response to match the expected format
    const transformedAttachment = {
      id: attachment.id,
      name: attachment.filename,
      url: attachment.file_url,
      type: type.trim(), // Store type in response since it's not in DB
      created_at: attachment.created_at,
      created_by: attachment.created_by,
    };

    return NextResponse.json({
      message: 'Attachment added successfully',
      attachment: transformedAttachment,
    });
  } catch (error) {
    console.error('Error in attachment creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const cardId = params.id;

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the card exists and user has access
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, board_id')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Verify user has access to the board
    const { data: boardAccess, error: boardError } = await supabase
      .from('board_members')
      .select('id')
      .eq('board_id', card.board_id)
      .eq('profile_id', user.id)
      .single();

    if (boardError || !boardAccess) {
      return NextResponse.json(
        { error: 'Board not found or access denied' },
        { status: 403 }
      );
    }

    // Fetch attachments for the card using correct column names
    const { data: attachments, error: attachmentsError } = await supabase
      .from('card_attachments')
      .select(
        `
        *,
        profiles:created_by(id, full_name, avatar_url)
      `
      )
      .eq('card_id', cardId)
      .order('created_at', { ascending: false });

    if (attachmentsError) {
      console.error('Error fetching attachments:', attachmentsError);
      return NextResponse.json(
        { error: 'Failed to fetch attachments' },
        { status: 500 }
      );
    }

    // Transform attachments to match expected format
    const transformedAttachments = (attachments || []).map((attachment) => ({
      id: attachment.id,
      name: attachment.filename,
      url: attachment.file_url,
      type: detectAttachmentType(attachment.file_url), // Detect type from URL
      created_at: attachment.created_at,
      created_by: attachment.created_by,
      profiles: attachment.profiles,
    }));

    return NextResponse.json({ attachments: transformedAttachments });
  } catch (error) {
    console.error('Error in GET /api/cards/[id]/attachments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to detect attachment type from URL
function detectAttachmentType(url: string): string {
  const lowerUrl = url.toLowerCase();

  // Image types
  if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/)) {
    return 'image';
  }

  // Document types
  if (lowerUrl.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt)(\?|$)/)) {
    return 'document';
  }

  // Video types
  if (lowerUrl.match(/\.(mp4|avi|mov|wmv|flv|webm|mkv)(\?|$)/)) {
    return 'video';
  }

  // Audio types
  if (lowerUrl.match(/\.(mp3|wav|ogg|flac|aac|m4a)(\?|$)/)) {
    return 'audio';
  }

  // Archive types
  if (lowerUrl.match(/\.(zip|rar|7z|tar|gz|bz2)(\?|$)/)) {
    return 'archive';
  }

  // Default to link
  return 'link';
}
