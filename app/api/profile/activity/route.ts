import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Mirrors the icon/message categorization already used client-side (see
// activityIcon/activityMessage in app/profile/page.tsx) — kept as the
// single source of truth for "which action_types count as which category"
// so the filter pills and the icons never drift apart.
const CATEGORY_ACTION_TYPES: Record<string, string[]> = {
  comment: ['comment_added', 'comment_updated', 'comment_deleted'],
  label: ['label_added', 'label_removed'],
  member: ['member_added', 'member_removed'],
  attachment: ['attachment_added', 'attachment_removed'],
  checklist: ['checklist_added', 'checklist_updated', 'checklist_removed'],
  dates: [
    'due_date_set',
    'due_date_removed',
    'start_date_set',
    'start_date_removed',
    'timeline_updated',
  ],
  card: ['card_created', 'card_updated', 'card_moved'],
};

function parseIdSearch(query: string) {
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

// GET /api/profile/activity - A team activity feed: everyone's actions
// across every board the caller has access to (owned, direct board
// member, or workspace member on a workspace-visible board) — not just
// the caller's own actions. Each card's own Activity tab already shows
// full history for that one card; this is the cross-board equivalent for
// the profile page.
//
// Query params: limit (default 20), offset (default 0), search (matches
// card title / board name / member name / "#board-card" id — a member
// match returns ALL of that member's activity, not just activity on
// cards whose title happens to match), category (one of the
// CATEGORY_ACTION_TYPES keys above, or omitted for all).
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search')?.trim() || '';
    const category = searchParams.get('category') || '';

    // Boards the caller can access — same three ways access is granted
    // everywhere else in this app (owner / direct board member /
    // workspace member on a workspace-visible board).
    const [{ data: ownedBoards }, { data: memberBoardRows }, { data: workspaceMemberships }] =
      await Promise.all([
        supabase.from('boards').select('id').eq('owner_id', user.id),
        supabase.from('board_members').select('board_id').eq('profile_id', user.id),
        supabase.from('workspace_members').select('workspace_id').eq('profile_id', user.id),
      ]);

    const workspaceIds = (workspaceMemberships || []).map((w) => w.workspace_id);
    let workspaceVisibleBoardIds: string[] = [];
    if (workspaceIds.length > 0) {
      const { data: workspaceBoards } = await supabase
        .from('boards')
        .select('id')
        .in('workspace_id', workspaceIds)
        .eq('visibility', 'workspace');
      workspaceVisibleBoardIds = (workspaceBoards || []).map((b) => b.id);
    }

    const accessibleBoardIds = Array.from(
      new Set([
        ...(ownedBoards || []).map((b) => b.id),
        ...(memberBoardRows || []).map((m) => m.board_id),
        ...workspaceVisibleBoardIds,
      ])
    );

    if (accessibleBoardIds.length === 0) {
      return NextResponse.json({ activities: [], total: 0, hasMore: false });
    }

    let matchedCardIds: string[] | null = null;
    // Member-name matches are kept separate from card/board matches and
    // OR'd together at query time — a member match should surface ALL of
    // that member's activity, not just the intersection with a card/board
    // title match.
    let matchedProfileIds: string[] | null = null;

    if (search) {
      const idSearch = parseIdSearch(search);

      if (idSearch?.boardNumber != null) {
        // "3-15" — exact card on an exact board.
        const { data: boards } = await supabase
          .from('boards')
          .select('id')
          .eq('number', idSearch.boardNumber);
        const boardIds = (boards || []).map((b) => b.id);
        const { data: cards } = await supabase
          .from('cards')
          .select('id')
          .in('board_id', boardIds.length > 0 ? boardIds : ['__none__'])
          .eq('number', idSearch.cardNumber);
        matchedCardIds = (cards || []).map((c) => c.id);
      } else if (idSearch) {
        // Bare "15" — any card numbered 15, board-agnostic.
        const { data: cards } = await supabase
          .from('cards')
          .select('id')
          .eq('number', idSearch.cardNumber);
        matchedCardIds = (cards || []).map((c) => c.id);
      } else {
        // Free text — card title, board name, or member (actor) name.
        const [{ data: titleMatches }, { data: boardMatches }, { data: profileMatches }] =
          await Promise.all([
            supabase.from('cards').select('id').ilike('title', `%${search}%`),
            supabase
              .from('boards')
              .select('id')
              .ilike('name', `%${search}%`),
            supabase
              .from('profiles')
              .select('id')
              .ilike('full_name', `%${search}%`),
          ]);

        const cardIdsFromTitle = (titleMatches || []).map((c) => c.id);
        let cardIdsFromBoard: string[] = [];
        const boardIds = (boardMatches || []).map((b) => b.id);
        if (boardIds.length > 0) {
          const { data: cardsOnMatchedBoards } = await supabase
            .from('cards')
            .select('id')
            .in('board_id', boardIds);
          cardIdsFromBoard = (cardsOnMatchedBoards || []).map((c) => c.id);
        }

        matchedCardIds = Array.from(
          new Set([...cardIdsFromTitle, ...cardIdsFromBoard])
        );
        matchedProfileIds = (profileMatches || []).map((p) => p.id);
      }

      // Nothing matched on any front — short-circuit to an empty result
      // instead of running an unfiltered query.
      if (
        matchedCardIds.length === 0 &&
        (matchedProfileIds === null || matchedProfileIds.length === 0)
      ) {
        return NextResponse.json({ activities: [], total: 0, hasMore: false });
      }
    }

    let query = supabase
      .from('activities')
      .select(
        `
        id,
        action_type,
        action_data,
        created_at,
        actor:profile_id ( id, full_name, avatar_url ),
        cards!inner (
          id,
          title,
          card_number:number,
          board_id,
          boards!inner ( id, name, board_number:number, workspace_id, workspaces!inner ( id, name ) )
        )
      `,
        { count: 'exact' }
      )
      .in('board_id', accessibleBoardIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (matchedProfileIds && matchedProfileIds.length > 0) {
      // Member name matched — OR it with any card/board match so a
      // member's full activity always shows, plus anything matching the
      // text on its own merits.
      const orParts: string[] = [`profile_id.in.(${matchedProfileIds.join(',')})`];
      if (matchedCardIds && matchedCardIds.length > 0) {
        orParts.push(`card_id.in.(${matchedCardIds.join(',')})`);
      }
      query = query.or(orParts.join(','));
    } else if (matchedCardIds) {
      query = query.in('card_id', matchedCardIds);
    }

    if (category && CATEGORY_ACTION_TYPES[category]) {
      query = query.in('action_type', CATEGORY_ACTION_TYPES[category]);
    }

    const { data: activities, error: activitiesError, count } = await query;

    if (activitiesError) {
      console.error('Error fetching profile activity:', activitiesError);
      return NextResponse.json(
        { error: 'Failed to fetch activity' },
        { status: 500 }
      );
    }

    const shaped = (activities || []).map((activity: any) => ({
      id: activity.id,
      action_type: activity.action_type,
      action_data: activity.action_data,
      created_at: activity.created_at,
      is_own: activity.actor?.id === user.id,
      actor_name: activity.actor?.full_name || 'Someone',
      actor_avatar_url: activity.actor?.avatar_url || null,
      card_id: activity.cards?.id,
      card_title: activity.cards?.title,
      card_number: activity.cards?.card_number,
      board_id: activity.cards?.board_id,
      board_name: activity.cards?.boards?.name,
      board_number: activity.cards?.boards?.board_number,
      workspace_id: activity.cards?.boards?.workspace_id,
      workspace_name: activity.cards?.boards?.workspaces?.name,
    }));

    const total = count ?? shaped.length;

    return NextResponse.json({
      activities: shaped,
      total,
      hasMore: offset + shaped.length < total,
    });
  } catch (error) {
    console.error('Error in GET /api/profile/activity:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
