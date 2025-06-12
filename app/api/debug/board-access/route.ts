import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get('board_id');

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all boards the user has access to
    const { data: userBoardsData, error: userBoardsError } = await supabase
      .from('boards')
      .select('id, name, owner_id, visibility, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    // Get all board memberships for the user
    const { data: userMembershipsData, error: userMembershipsError } =
      await supabase
        .from('board_members')
        .select(
          `
        board_id,
        role,
        joined_at,
        boards:board_id(id, name, owner_id, visibility)
      `
        )
        .eq('profile_id', user.id);

    let specificBoardDebug = null;

    if (boardId) {
      // Check if boardId is a valid UUID
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(boardId)) {
        specificBoardDebug = {
          error: `Invalid board ID format: "${boardId}". Board ID must be a valid UUID.`,
          example: 'Use format like: 123e4567-e89b-12d3-a456-426614174000',
        };
      } else {
        // Check board exists and get details
        const { data: boardData, error: boardError } = await supabase
          .from('boards')
          .select('*')
          .eq('id', boardId)
          .single();

        // Check user's membership in this board
        const { data: membershipData, error: membershipError } = await supabase
          .from('board_members')
          .select('*')
          .eq('board_id', boardId)
          .eq('profile_id', user.id)
          .single();

        // Check all members of this board
        const { data: allMembersData, error: allMembersError } = await supabase
          .from('board_members')
          .select(
            `
            *,
            profiles:profile_id(email, full_name)
          `
          )
          .eq('board_id', boardId);

        specificBoardDebug = {
          board: {
            found: !!boardData,
            data: boardData,
            error: boardError?.message,
          },
          user_membership: {
            found: !!membershipData,
            data: membershipData,
            error: membershipError?.message,
          },
          all_board_members: {
            count: allMembersData?.length || 0,
            data: allMembersData,
            error: allMembersError?.message,
          },
          can_create_cards: !!membershipData || boardData?.owner_id === user.id,
        };
      }
    }

    return NextResponse.json({
      debug_info: {
        instructions: boardId
          ? `Debugging board: ${boardId}`
          : 'Add ?board_id=YOUR_BOARD_ID to debug a specific board',
        current_user: {
          id: user.id,
          email: user.email,
        },
        user_owned_boards: {
          count: userBoardsData?.length || 0,
          data: userBoardsData,
          error: userBoardsError?.message,
        },
        user_board_memberships: {
          count: userMembershipsData?.length || 0,
          data: userMembershipsData,
          error: userMembershipsError?.message,
        },
        specific_board_debug: specificBoardDebug,
        sql_queries_for_your_user: {
          check_your_boards: `
-- Check all boards you own
SELECT id, name, owner_id, visibility, created_at 
FROM boards 
WHERE owner_id = '${user.id}' 
ORDER BY created_at DESC;
          `,
          check_your_memberships: `
-- Check all boards you're a member of
SELECT bm.board_id, bm.role, bm.joined_at, b.name as board_name
FROM board_members bm
JOIN boards b ON b.id = bm.board_id
WHERE bm.profile_id = '${user.id}';
          `,
          fix_missing_membership: `
-- Fix missing board membership (replace BOARD_ID with actual ID)
INSERT INTO board_members (board_id, profile_id, role)
VALUES ('BOARD_ID_HERE', '${user.id}', 'admin')
ON CONFLICT (board_id, profile_id) DO NOTHING;
          `,
        },
      },
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
