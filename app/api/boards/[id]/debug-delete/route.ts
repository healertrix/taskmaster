import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/boards/[id]/debug-delete - Debug board deletion issues
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const boardId = params.id;

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if board exists
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('*')
      .eq('id', boardId)
      .single();

    // Check constraints that might prevent deletion
    const { data: lists, error: listsError } = await supabase
      .from('lists')
      .select('id, name')
      .eq('board_id', boardId);

    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('id, title')
      .eq('board_id', boardId);

    const { data: boardMembers, error: membersError } = await supabase
      .from('board_members')
      .select('id, profile_id, role')
      .eq('board_id', boardId);

    const { data: boardStars, error: starsError } = await supabase
      .from('board_stars')
      .select('id, profile_id')
      .eq('board_id', boardId);

    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('id, activity_type')
      .eq('board_id', boardId);

    // Test if user can delete the board (without actually deleting)
    const { data: deleteTest, error: deleteTestError } = await supabase
      .from('boards')
      .delete()
      .eq('id', 'non-existent-id')
      .select();

    return NextResponse.json({
      debug_info: {
        board_id: boardId,
        user_id: user.id,
        board_exists: !!board,
        board_data: board,
        board_error: boardError?.message,
        remaining_dependencies: {
          lists: {
            count: lists?.length || 0,
            data: lists,
            error: listsError?.message,
          },
          cards: {
            count: cards?.length || 0,
            data: cards,
            error: cardsError?.message,
          },
          board_members: {
            count: boardMembers?.length || 0,
            data: boardMembers,
            error: membersError?.message,
          },
          board_stars: {
            count: boardStars?.length || 0,
            data: boardStars,
            error: starsError?.message,
          },
          activities: {
            count: activities?.length || 0,
            data: activities,
            error: activitiesError?.message,
          },
        },
        delete_test: {
          error: deleteTestError?.message,
          data: deleteTest,
        },
        suggested_solution:
          board &&
          (lists?.length ||
            cards?.length ||
            boardMembers?.length ||
            boardStars?.length ||
            activities?.length)
            ? 'There are still related records that need to be deleted first'
            : 'Board should be safe to delete',
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
