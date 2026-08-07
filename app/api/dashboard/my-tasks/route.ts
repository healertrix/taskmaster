import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/dashboard/my-tasks - Cards assigned to the current user, across
// every board they have access to, bucketed into upcoming/overdue/completed
// for the homepage "My tasks" widget.
export async function GET() {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Cards the current user is assigned to, with enough of their list/board
    // to bucket them below. RLS already scopes this to boards the user can
    // see, same as everywhere else cards are read.
    const { data: cardMembers, error: cardsError } = await supabase
      .from('card_members')
      .select(
        `
        cards!inner (
          id,
          title,
          due_date,
          list_id,
          lists!inner (
            id,
            board_id,
            boards!inner ( id, name )
          )
        )
      `
      )
      .eq('profile_id', user.id);

    if (cardsError) {
      console.error('Error fetching my-tasks cards:', cardsError);
      return NextResponse.json(
        { error: 'Failed to fetch tasks' },
        { status: 500 }
      );
    }

    const rows = (cardMembers || [])
      .map((row: any) => row.cards)
      .filter(Boolean);

    if (rows.length === 0) {
      return NextResponse.json({ upcoming: [], overdue: [], completed: [] });
    }

    // "Completed" has no dedicated flag on cards — same convention as list
    // view's row checkbox: a card sitting in its board's last (highest
    // position) list counts as done. Figure out each relevant board's last
    // list by fetching all of that board's lists, not just the ones these
    // assigned cards happen to sit in — a board's true last list might have
    // none of the user's cards in it.
    const boardIds = Array.from(
      new Set(rows.map((card: any) => card.lists.board_id))
    );

    const { data: allLists, error: listsError } = await supabase
      .from('lists')
      .select('id, board_id, position')
      .in('board_id', boardIds);

    if (listsError) {
      console.error('Error fetching lists for my-tasks:', listsError);
      return NextResponse.json(
        { error: 'Failed to fetch tasks' },
        { status: 500 }
      );
    }

    const lastListIdByBoard = new Map<string, string>();
    for (const list of allLists || []) {
      const current = lastListIdByBoard.get(list.board_id);
      if (!current) {
        lastListIdByBoard.set(list.board_id, list.id);
        continue;
      }
      const currentList = (allLists || []).find((l) => l.id === current);
      if (currentList && list.position > currentList.position) {
        lastListIdByBoard.set(list.board_id, list.id);
      }
    }

    const now = Date.now();
    const upcoming: any[] = [];
    const overdue: any[] = [];
    const completed: any[] = [];

    for (const card of rows) {
      const boardId = card.lists.board_id;
      const boardName = card.lists.boards?.name || 'Board';
      const isCompleted = lastListIdByBoard.get(boardId) === card.list_id;

      const shaped = {
        id: card.id,
        title: card.title,
        due_date: card.due_date,
        board_id: boardId,
        board_name: boardName,
      };

      if (isCompleted) {
        completed.push(shaped);
        continue;
      }

      if (card.due_date && new Date(card.due_date).getTime() < now) {
        overdue.push(shaped);
      } else {
        upcoming.push(shaped);
      }
    }

    // Soonest-due first for upcoming/overdue; most-recently-due first isn't
    // meaningful for completed, so leave that in whatever order it came in.
    const byDueDate = (a: any, b: any) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    };
    upcoming.sort(byDueDate);
    overdue.sort(byDueDate);

    return NextResponse.json({ upcoming, overdue, completed });
  } catch (error) {
    console.error('Error in GET /api/dashboard/my-tasks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
