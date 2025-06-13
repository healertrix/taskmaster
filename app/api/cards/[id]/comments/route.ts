import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/cards/[id]/comments - Fetch comments for a card
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

    // Verify user has access to this card
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, board_id')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Fetch comments with user profiles
    const { data: comments, error: commentsError } = await supabase
      .from('comments')
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
      .eq('card_id', cardId)
      .order('created_at', { ascending: true });

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
      return NextResponse.json(
        { error: 'Failed to fetch comments' },
        { status: 500 }
      );
    }

    return NextResponse.json({ comments: comments || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/cards/[id]/comments - Create a new comment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const cardId = params.id;

    console.log(
      'POST /api/cards/[id]/comments - Starting request for card:',
      cardId
    );

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log('Auth check:', { user: user?.id, authError });

    if (authError || !user) {
      console.log('Authentication failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content } = body;

    console.log('Request body:', { content });

    if (!content?.trim()) {
      console.log('Content validation failed');
      return NextResponse.json(
        { error: 'Comment content is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this card by checking board membership
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, board_id')
      .eq('id', cardId)
      .single();

    console.log('Card lookup:', { card, cardError });

    if (cardError || !card) {
      console.log('Card not found:', cardError);
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Check if user is a board member
    const { data: membership, error: membershipError } = await supabase
      .from('board_members')
      .select('id')
      .eq('board_id', card.board_id)
      .eq('profile_id', user.id)
      .single();

    console.log('Membership check:', { membership, membershipError });

    if (membershipError || !membership) {
      console.log('Access denied - not a board member:', membershipError);
      return NextResponse.json(
        { error: 'Access denied: You must be a board member to comment' },
        { status: 403 }
      );
    }

    // Create the comment
    console.log('Creating comment with data:', {
      card_id: cardId,
      profile_id: user.id,
      content: content.trim(),
    });

    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .insert({
        card_id: cardId,
        profile_id: user.id,
        content: content.trim(),
      })
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

    console.log('Comment creation result:', { comment, commentError });

    if (commentError) {
      console.error('Error creating comment:', commentError);
      return NextResponse.json(
        { error: `Failed to create comment: ${commentError.message}` },
        { status: 500 }
      );
    }

    console.log('Comment created successfully:', comment);
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST comments:', error);
    return NextResponse.json(
      {
        error: `Internal server error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      },
      { status: 500 }
    );
  }
}
