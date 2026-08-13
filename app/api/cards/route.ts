import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createCard } from '@/utils/cards/createCard';

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

    const result = await createCard(supabase, user.id, {
      title,
      description,
      list_id,
      board_id,
      position,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, ...(result.details && { details: result.details }) },
        { status: result.status }
      );
    }

    return NextResponse.json(
      {
        message: 'Card created successfully',
        card: result.card,
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
        profiles:created_by(id, email, full_name),
        card_members(
          id,
          created_at,
          profiles:profile_id(id, full_name, avatar_url, email)
        ),
        card_labels(
          id,
          labels(id, name, color)
        )
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
