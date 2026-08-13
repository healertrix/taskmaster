import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getActiveClientForUser } from '@/utils/ai/client';
import { fetchRecentActivity, summarizeActivity } from '@/utils/ai/activitySummary';

// POST /api/ai/summarize/workspace/[id] - on-demand, ephemeral summary of
// the last 7 days of activity across every board in a workspace.
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

    // RLS restricts this to workspaces the caller belongs to.
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', params.id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const { data: boards, error: boardsError } = await supabase
      .from('boards')
      .select('id')
      .eq('workspace_id', workspace.id);

    if (boardsError) {
      console.error('Error fetching workspace boards for summary:', boardsError);
      return NextResponse.json(
        { error: 'Failed to fetch boards' },
        { status: 500 }
      );
    }

    const activeClient = await getActiveClientForUser(supabase, user.id);
    if (!activeClient) {
      return NextResponse.json(
        { error: 'no_active_key', message: 'Add an API key in Settings to use AI features.' },
        { status: 400 }
      );
    }

    const boardIds = (boards || []).map((b) => b.id);
    const { lines, stats } = await fetchRecentActivity(supabase, boardIds);
    const { headline, highlights } = await summarizeActivity(
      activeClient.client,
      activeClient.model,
      workspace.name,
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
