import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/dashboard/team-tasks - Cards assigned to *other* people, on
// boards the current user owns or is a board admin on — the "what is my
// team working on" counterpart to /api/dashboard/my-tasks, for the
// homepage's My tasks / Team tasks toggle and /profile/tasks. Bucketed
// into upcoming/overdue/completed the same way my-tasks is, using the same
// is_done_list heuristic (see the comment there).
//
// `hasManagedBoards` tells the caller whether this user owns/admins any
// board at all, independent of whether any of those boards currently have
// assigned cards — the UI hides the Team tasks tab entirely when false
// (a pure member has nothing to manage, not just nothing to show), rather
// than inferring that from an empty task list (which could just mean
// nobody's assigned anything yet).
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

    // Boards you own outright, plus boards where you're a board_members
    // admin — board-level only, not workspace role, so a workspace
    // owner/admin who isn't personally on a given board doesn't see its
    // team tasks (see the design discussion this endpoint came out of).
    const [{ data: ownedBoards, error: ownedError }, { data: adminMemberships, error: adminError }] =
      await Promise.all([
        supabase.from('boards').select('id').eq('owner_id', user.id),
        supabase
          .from('board_members')
          .select('board_id')
          .eq('profile_id', user.id)
          .eq('role', 'admin'),
      ]);

    if (ownedError || adminError) {
      console.error('Error fetching managed boards:', ownedError || adminError);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    const managedBoardIds = Array.from(
      new Set([
        ...(ownedBoards || []).map((b) => b.id),
        ...(adminMemberships || []).map((m) => m.board_id),
      ])
    );

    if (managedBoardIds.length === 0) {
      return NextResponse.json({
        hasManagedBoards: false,
        upcoming: [],
        overdue: [],
        completed: [],
        members: [],
      });
    }

    // Every card_members row on those boards, excluding your own — a card
    // assigned to both you and someone else still counts (it shows up
    // under the other assignee), only rows where *you're* the profile_id
    // are dropped.
    const { data: cardMembers, error: cardsError } = await supabase
      .from('card_members')
      .select(
        `
        profile_id,
        profiles:profile_id ( id, full_name, avatar_url ),
        cards!inner (
          id,
          title,
          card_number:number,
          due_date,
          list_id,
          board_id,
          boards!inner (
            id,
            name,
            board_number:number,
            workspace_id,
            workspaces!inner ( id, name )
          )
        )
      `
      )
      .in('cards.board_id', managedBoardIds)
      .neq('profile_id', user.id);

    if (cardsError) {
      console.error('Error fetching team-tasks cards:', cardsError);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }

    // Typed `any[]` — Supabase's query builder infers embedded relations
    // (cards/boards/workspaces here) as arrays rather than single objects
    // without generated types configured, same as the identical pattern in
    // my-tasks/route.ts's `rows`.
    const rows: any[] = (cardMembers || []).filter((row: any) => row.cards);

    if (rows.length === 0) {
      return NextResponse.json({
        hasManagedBoards: true,
        upcoming: [],
        overdue: [],
        completed: [],
        members: [],
      });
    }

    // One entry per card, assignees collected onto it — a card with two
    // assignees appears once, with both people listed (see the design
    // discussion: matches how assignees are shown everywhere else in the
    // app, and keeps per-status counts meaning "N distinct tasks").
    const cardById = new Map<string, any>();
    const membersById = new Map<string, { id: string; full_name: string; avatar_url?: string }>();

    for (const row of rows) {
      const card = row.cards;
      const assignee = row.profiles;
      if (!assignee) continue;

      membersById.set(assignee.id, assignee);

      const existing = cardById.get(card.id);
      if (existing) {
        existing.assignees.push(assignee);
        continue;
      }

      cardById.set(card.id, {
        id: card.id,
        title: card.title,
        number: card.card_number,
        board_number: card.boards?.board_number,
        due_date: card.due_date,
        board_id: card.board_id,
        board_name: card.boards?.name || 'Board',
        workspace_id: card.boards?.workspace_id,
        workspace_name: card.boards?.workspaces?.name,
        list_id: card.list_id,
        assignees: [assignee],
      });
    }

    const cards = Array.from(cardById.values());

    // Same is_done_list / "last list on the board" completion heuristic as
    // my-tasks — see the comment there for why.
    const boardIds = Array.from(new Set(cards.map((c) => c.board_id)));
    const { data: allLists, error: listsError } = await supabase
      .from('lists')
      .select('id, board_id, position, is_done_list')
      .in('board_id', boardIds);

    if (listsError) {
      console.error('Error fetching lists for team-tasks:', listsError);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
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

    for (const card of cards) {
      const { list_id, ...shaped } = card;
      const isCompleted = isCardCompleted(card.board_id, list_id);

      if (isCompleted) {
        completed.push(shaped);
      } else if (shaped.due_date && new Date(shaped.due_date).getTime() < now) {
        overdue.push(shaped);
      } else {
        upcoming.push(shaped);
      }
    }

    const byDueDate = (a: any, b: any) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    };
    upcoming.sort(byDueDate);
    overdue.sort(byDueDate);

    return NextResponse.json({
      hasManagedBoards: true,
      upcoming,
      overdue,
      completed,
      members: Array.from(membersById.values()),
    });
  } catch (error) {
    console.error('Error in GET /api/dashboard/team-tasks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
