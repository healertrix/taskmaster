import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/search/boards - Search boards by name
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

    // Search boards by name
    const { data: boards, error: searchError } = await supabase
      .from('boards')
      .select(
        `
        id,
        name,
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
      )
      .ilike('name', `%${query}%`)
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

    for (const board of boards || []) {
      // Check if user has access to this board
      const { data: hasAccess } = await supabase.rpc('check_board_access', {
        board_id: board.id,
        user_id: userId,
      });

      if (hasAccess) {
        accessibleBoards.push({
          id: board.id,
          name: board.name,
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
