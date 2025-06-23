import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/search/workspaces - Search workspaces by name
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

    // First get all workspaces the user has access to
    const { data: userWorkspaces, error: accessError } = await supabase
      .from('workspaces')
      .select(
        `
        id,
        name,
        color,
        updated_at,
        owner_id
      `
      )
      .or(`owner_id.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (accessError) {
      console.error('Error fetching user workspaces:', accessError);
      return NextResponse.json(
        { error: 'Failed to fetch workspaces', details: accessError.message },
        { status: 500 }
      );
    }

    // Also get workspaces where user is a member
    const { data: memberWorkspaces, error: memberError } = await supabase
      .from('workspace_members')
      .select(
        `
        workspaces!inner(
          id,
          name,
          color,
          updated_at,
          owner_id
        )
      `
      )
      .eq('profile_id', userId);

    if (memberError) {
      console.error('Error fetching member workspaces:', memberError);
    }

    // Combine and deduplicate workspaces
    const allWorkspaces = [...(userWorkspaces || [])];
    if (memberWorkspaces) {
      memberWorkspaces.forEach((member: any) => {
        if (!allWorkspaces.find((w) => w.id === member.workspaces.id)) {
          allWorkspaces.push(member.workspaces);
        }
      });
    }

    // Filter by search query
    const workspaces = allWorkspaces
      .filter((workspace) =>
        workspace.name.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, limit);

    const searchError = null; // No error if we reach here

    if (searchError) {
      console.error('Workspace search error:', searchError);
      return NextResponse.json(
        { error: 'Failed to search workspaces', details: searchError.message },
        { status: 500 }
      );
    }

    // Get member count for each workspace
    const workspacesWithMemberCount = await Promise.all(
      (workspaces || []).map(async (workspace) => {
        const { data: memberCount } = await supabase
          .from('workspace_members')
          .select('id', { count: 'exact' })
          .eq('workspace_id', workspace.id);

        return {
          id: workspace.id,
          name: workspace.name,
          color: workspace.color,
          updatedAt: workspace.updated_at,
          isOwner: workspace.owner_id === userId,
          memberCount: (memberCount?.length || 0) + 1, // +1 for owner
          letter: workspace.name.charAt(0).toUpperCase(),
        };
      })
    );

    return NextResponse.json({
      workspaces: workspacesWithMemberCount,
    });
  } catch (error) {
    console.error('Error in GET /api/search/workspaces:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
