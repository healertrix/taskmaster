import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/search/cards - Search cards by title and description
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Get current user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Search cards that the user has access to
    // This includes:
    // 1. Cards in boards where the user is a member
    // 2. Cards in boards within workspaces where the user is a member
    // 3. Public boards (if visibility allows)

    const { data: cards, error: searchError } = await supabase
      .from('cards')
      .select(
        `
        id,
        title,
        description,
        updated_at,
        due_date,
        list_id,
        lists!inner(name, board_id),
        boards!inner(
          id,
          name,
          color,
          workspaces!inner(name)
        )
      `
      )
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (searchError) {
      console.error('Card search error:', searchError);
      return NextResponse.json(
        { error: 'Failed to search cards', details: searchError.message },
        { status: 500 }
      );
    }

    // Filter cards by user access permissions
    const accessibleCards = [];

    for (const card of cards || []) {
      const boardId = card.boards.id;

      // Check if user has access to this board
      const { data: hasAccess } = await supabase.rpc('check_board_access', {
        board_id: boardId,
        user_id: userId,
      });

      if (hasAccess) {
        accessibleCards.push({
          id: card.id,
          title: card.title,
          description: card.description,
          board: card.boards.name,
          boardId: card.boards.id,
          boardColor: card.boards.color,
          workspace: card.boards.workspaces.name,
          list: card.lists.name,
          updatedAt: card.updated_at,
          dueDate: card.due_date,
        });
      }
    }

    return NextResponse.json({
      cards: accessibleCards,
    });
  } catch (error) {
    console.error('Error in GET /api/search/cards:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
