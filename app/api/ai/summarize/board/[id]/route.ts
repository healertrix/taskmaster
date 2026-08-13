import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getActiveClientForUser } from '@/utils/ai/client';
import { fetchRecentActivity, summarizeActivity } from '@/utils/ai/activitySummary';

// POST /api/ai/summarize/board/[id] - on-demand, ephemeral summary of a
// board's last 7 days of activity. Not cached; regenerates on every call.
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RLS restricts this select to boards the caller can actually see —
    // a board that exists but isn't theirs reads the same as "not found".
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id, name')
      .eq('id', params.id)
      .single();

    if (boardError || !board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const activeClient = await getActiveClientForUser(supabase, user.id);
    if (!activeClient) {
      return NextResponse.json(
        { error: 'no_active_key', message: 'Add an API key in Settings to use AI features.' },
        { status: 400 }
      );
    }

    const { lines, stats } = await fetchRecentActivity(supabase, [board.id]);
    const { headline, highlights } = await summarizeActivity(
      activeClient.client,
      activeClient.model,
      board.name,
      lines
    );

    return NextResponse.json({ headline, highlights, stats });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
