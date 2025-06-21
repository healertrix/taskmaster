import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/profiles/search - Search profiles by name or email
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const workspaceId = searchParams.get('workspace_id');

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

    const user = session.user;

    // If workspace_id is provided, check if user has permission to add members
    if (workspaceId) {
      // First check if user is the workspace owner
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .single();

      if (workspaceError) {
        return NextResponse.json(
          { error: 'Workspace not found' },
          { status: 404 }
        );
      }

      const isOwner = workspace.owner_id === user.id;

      if (!isOwner) {
        // If not owner, check membership
        const { data: membership, error: membershipError } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspaceId)
          .eq('profile_id', user.id)
          .single();

        if (membershipError || !membership) {
          return NextResponse.json(
            { error: 'Access denied - not a member' },
            { status: 403 }
          );
        }

        // Check if user has permission to add members (admin)
        if (membership.role !== 'admin') {
          return NextResponse.json(
            {
              error:
                'Insufficient permissions to search for members - need admin role',
            },
            { status: 403 }
          );
        }
      }
    }

    // Search profiles by email and name using OR query
    const { data: allProfiles, error: searchError } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);

    if (searchError) {
      console.error('Search error:', searchError);
      return NextResponse.json(
        { error: 'Failed to search profiles', details: searchError.message },
        { status: 500 }
      );
    }

    // If workspace_id is provided, filter out users who are already members
    let filteredProfiles = allProfiles || [];

    if (workspaceId && allProfiles && allProfiles.length > 0) {
      const profileIds = allProfiles.map((p) => p.id);

      const { data: existingMembers, error: membersError } = await supabase
        .from('workspace_members')
        .select('profile_id')
        .eq('workspace_id', workspaceId)
        .in('profile_id', profileIds);

      if (!membersError && existingMembers) {
        const existingMemberIds = existingMembers.map((m) => m.profile_id);
        // Also exclude the workspace owner
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('owner_id')
          .eq('id', workspaceId)
          .single();

        if (workspace) {
          existingMemberIds.push(workspace.owner_id);
        }

        filteredProfiles = allProfiles.filter(
          (p) => !existingMemberIds.includes(p.id)
        );
      }
    }

    return NextResponse.json({
      profiles: filteredProfiles.map((profile) => ({
        id: profile.id,
        name: profile.full_name || 'No name set',
        email: profile.email,
        avatar_url: profile.avatar_url,
      })),
    });
  } catch (error) {
    console.error('Error in GET /api/profiles/search:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
