import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// A query like "3-15" means "card #15 on board #3" — the full shareable id
// (see supabase/supabase/migrations/20260807120000_add_scoped_display_numbers.sql
// and utils/idColor.ts for the numbering scheme). A bare "15" or "#15"
// means "card #15 on ANY board I can see" — ambiguous without a board
// prefix, so it can return several matches; each result carries its own
// boardNumber so the UI can show the full "3-15" to disambiguate.
function parseCardNumberQuery(query: string) {
  const compound = query.match(/^#?(\d+)-(\d+)$/);
  if (compound) {
    return {
      boardNumber: parseInt(compound[1], 10),
      cardNumber: parseInt(compound[2], 10),
    };
  }
  const bare = query.match(/^#?(\d+)$/);
  if (bare) {
    return { boardNumber: null, cardNumber: parseInt(bare[1], 10) };
  }
  return null;
}

// GET /api/search/cards - Search cards by title/description, or by their
// shareable number ("15" or "3-15")
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    const numberQuery = query ? parseCardNumberQuery(query) : null;

    // A pure number query ("15", "3-15") is a complete, meaningful search
    // on its own even at 1 character — only text queries need the 2-char
    // minimum to avoid a flood of near-useless single-letter matches.
    if (!query || (query.length < 2 && !numberQuery)) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Search cards that the user has access to
    // This includes:
    // 1. Cards in boards where the user is a member
    // 2. Cards in boards within workspaces where the user is a member
    // 3. Public boards (if visibility allows)

    // Aliased to card_number/board_number rather than the bare column name
    // `number` — a bare `number` column inside a supabase-js select string
    // collides with the `number` TS keyword in its compile-time type
    // parser (see the same fix in hooks/useBoardStars.ts).
    const SELECT_COLUMNS = `
        id,
        title,
        description,
        card_number:number,
        updated_at,
        due_date,
        list_id,
        lists!inner(name, board_id),
        boards!inner(
          id,
          name,
          color,
          board_number:number,
          workspaces!inner(name)
        )
      `;

    let cardsQuery;

    if (numberQuery?.boardNumber != null) {
      // Full shareable id ("3-15") — an exact lookup, not a fuzzy search.
      // boards.number lives on a joined table, which supabase-js's .or()
      // can't filter across in one call, so resolve the board(s) first.
      const { data: matchingBoards } = await supabase
        .from('boards')
        .select('id')
        .eq('number', numberQuery.boardNumber);

      const boardIds = (matchingBoards || []).map((b) => b.id);

      cardsQuery = supabase
        .from('cards')
        .select(SELECT_COLUMNS)
        .in('board_id', boardIds.length > 0 ? boardIds : ['__none__'])
        .eq('number', numberQuery.cardNumber);
    } else if (numberQuery) {
      // Bare number ("15") — ambiguous without a board, so match it
      // alongside the text search rather than instead of it; every result
      // still carries its own boardNumber so the UI can disambiguate.
      cardsQuery = supabase
        .from('cards')
        .select(SELECT_COLUMNS)
        .or(
          `title.ilike.%${query}%,description.ilike.%${query}%,number.eq.${numberQuery.cardNumber}`
        );
    } else {
      cardsQuery = supabase
        .from('cards')
        .select(SELECT_COLUMNS)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`);
    }

    const { data: cards, error: searchError } = await cardsQuery
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

    for (const card of (cards || []) as any[]) {
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
          number: card.card_number,
          board: card.boards.name,
          boardId: card.boards.id,
          boardNumber: card.boards.board_number,
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
