import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/search/boards - Search boards by name, or by their shareable
// number ("3" or "#3" — boards are numbered per workspace, see the
// migration in supabase/supabase/migrations/20260807120000_add_scoped_display_numbers.sql)
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    const numberMatch = query?.match(/^#?(\d+)$/);
    const boardNumber = numberMatch ? parseInt(numberMatch[1], 10) : null;

    // A pure number is a complete search on its own even at 1 character.
    if (!query || (query.length < 2 && boardNumber == null)) {
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

    // Search boards by name, or by number if the query looks like one
    // (bare `number` column aliased to board_number — see the same
    // supabase-js type-parser note in app/api/search/cards/route.ts).
    let boardsQuery = supabase.from('boards').select(
      `
        id,
        name,
        board_number:number,
        color,
        updated_at,
        last_activity_at,
        workspaces!inner(
          id,
          name
        ),
        board_stars!left(
          id
        )
      `
    );

    boardsQuery =
      boardNumber != null
        ? boardsQuery.or(`name.ilike.%${query}%,number.eq.${boardNumber}`)
        : boardsQuery.ilike('name', `%${query}%`);

    const { data: boards, error: searchError } = await boardsQuery
      .eq('is_archived', false)
      .eq('is_closed', false)
      .order('last_activity_at', { ascending: false })
      .limit(limit);

    if (searchError) {
      console.error('Board search error:', searchError);
      return NextResponse.json(
        { error: 'Failed to search boards', details: searchError.message },
        { status: 500 }
      );
    }

    // Filter boards by user access permissions
    const accessibleBoards = [];

    for (const board of (boards || []) as any[]) {
      // Check if user has access to this board
      const { data: hasAccess } = await supabase.rpc('check_board_access', {
        board_id: board.id,
        user_id: userId,
      });

      if (hasAccess) {
        accessibleBoards.push({
          id: board.id,
          name: board.name,
          number: board.board_number,
          color: board.color,
          workspace: board.workspaces.name,
          workspaceId: board.workspaces.id,
          updatedAt: board.updated_at,
          lastActivityAt: board.last_activity_at,
          starred: board.board_stars.some((star: any) => star.id),
        });
      }
    }

    return NextResponse.json({
      boards: accessibleBoards,
    });
  } catch (error) {
    console.error('Error in GET /api/search/boards:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
