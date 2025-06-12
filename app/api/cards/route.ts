import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, list_id, board_id, position } = body;

    // Validate required fields
    if (!title?.trim()) {
      return NextResponse.json(
        { error: 'Card title is required' },
        { status: 400 }
      );
    }

    if (!list_id) {
      return NextResponse.json(
        { error: 'List ID is required' },
        { status: 400 }
      );
    }

    if (!board_id) {
      return NextResponse.json(
        { error: 'Board ID is required' },
        { status: 400 }
      );
    }

    // Verify the list exists and belongs to the board
    const { data: listData, error: listError } = await supabase
      .from('lists')
      .select('id, board_id')
      .eq('id', list_id)
      .eq('board_id', board_id)
      .single();

    if (listError || !listData) {
      return NextResponse.json(
        { error: 'List not found or does not belong to this board' },
        { status: 404 }
      );
    }

    // Get the next position for the card if not provided
    let cardPosition = position;
    if (cardPosition === undefined || cardPosition === null) {
      const { data: positionData } = await supabase
        .from('cards')
        .select('position')
        .eq('list_id', list_id)
        .order('position', { ascending: false })
        .limit(1)
        .single();

      cardPosition = (positionData?.position || 0) + 1;
    }

    // Debug: Check user's board membership before creating card
    const { data: membershipCheck, error: membershipError } = await supabase
      .from('board_members')
      .select('role, joined_at')
      .eq('board_id', board_id)
      .eq('profile_id', user.id)
      .single();

    console.log('Debug - User membership check:', {
      user_id: user.id,
      board_id,
      membership: membershipCheck,
      membershipError,
    });

    // Create the card
    const { data: cardData, error: cardError } = await supabase
      .from('cards')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        list_id,
        board_id,
        position: cardPosition,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (cardError) {
      console.error('Card creation error:', cardError);
      console.error('Card creation context:', {
        user_id: user.id,
        board_id,
        list_id,
        title: title.trim(),
        position: cardPosition,
      });

      // Return more specific error message
      if (cardError.code === '42501') {
        return NextResponse.json(
          {
            error:
              'Permission denied: You are not authorized to create cards on this board',
            details: 'Make sure you are a member of this board',
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to create card',
          details: cardError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Card created successfully',
        card: cardData,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('list_id');
    const boardId = searchParams.get('board_id');

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = supabase
      .from('cards')
      .select(
        `
        *,
        profiles:created_by(id, email, full_name)
      `
      )
      .order('position', { ascending: true });

    if (listId) {
      query = query.eq('list_id', listId);
    }

    if (boardId) {
      query = query.eq('board_id', boardId);
    }

    const { data: cards, error } = await query;

    if (error) {
      console.error('Error fetching cards:', error);
      return NextResponse.json(
        { error: 'Failed to fetch cards' },
        { status: 500 }
      );
    }

    return NextResponse.json({ cards });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
