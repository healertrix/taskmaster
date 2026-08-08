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
          card_number:number,
          due_date,
          list_id,
          lists!inner (
            id,
            board_id,
            boards!inner (
              id,
              name,
              board_number:number,
              workspace_id,
              workspaces!inner ( id, name )
            )
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

    // "Completed" has no dedicated flag on cards. Primary source: whichever
    // list(s) the board's own members have explicitly marked as a "done"
    // list (see supabase/supabase/migrations/20260808150000_add_list_is_done.sql
    // — more than one can be marked, e.g. both "Done" and "Archive"). A
    // board where nobody has marked anything falls back to the old
    // heuristic — its last (highest position) list counts as done — so
    // boards nobody's configured yet don't just stop reporting completions.
    const boardIds = Array.from(
      new Set(rows.map((card: any) => card.lists.board_id))
    );

    const { data: allLists, error: listsError } = await supabase
      .from('lists')
      .select('id, board_id, position, is_done_list')
      .in('board_id', boardIds);

    if (listsError) {
      console.error('Error fetching lists for my-tasks:', listsError);
      return NextResponse.json(
        { error: 'Failed to fetch tasks' },
        { status: 500 }
      );
    }

    const doneListIdsByBoard = new Map<string, Set<string>>();
    const lastListIdByBoard = new Map<string, string>();

    for (const list of allLists || []) {
      if (list.is_done_list) {
        const set = doneListIdsByBoard.get(list.board_id) || new Set<string>();
        set.add(list.id);
        doneListIdsByBoard.set(list.board_id, set);
      }

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

    const isCardCompleted = (boardId: string, listId: string): boolean => {
      const markedDone = doneListIdsByBoard.get(boardId);
      if (markedDone && markedDone.size > 0) {
        return markedDone.has(listId);
      }
      return lastListIdByBoard.get(boardId) === listId;
    };

    const now = Date.now();
    const upcoming: any[] = [];
    const overdue: any[] = [];
    const completed: any[] = [];

    for (const card of rows) {
      const boardId = card.lists.board_id;
      const boardName = card.lists.boards?.name || 'Board';
      const isCompleted = isCardCompleted(boardId, card.list_id);

      const shaped = {
        id: card.id,
        title: card.title,
        number: card.card_number,
        board_number: card.lists.boards?.board_number,
        due_date: card.due_date,
        board_id: boardId,
        board_name: boardName,
        workspace_id: card.lists.boards?.workspace_id,
        workspace_name: card.lists.boards?.workspaces?.name,
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
