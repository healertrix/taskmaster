import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/workspaces/[id]/available-members - Get workspace members available for card assignment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const workspaceId = params.id;
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

    // Verify user has access to the workspace
    const { data: workspaceMembership, error: workspaceMemberError } =
      await supabase
        .from('workspace_members')
        .select('id, role')
        .eq('workspace_id', workspaceId)
        .eq('profile_id', user.id)
        .single();

    if (workspaceMemberError || !workspaceMembership) {
      return NextResponse.json(
        { error: 'Access denied: You are not a member of this workspace' },
        { status: 403 }
      );
    }

    // Get all workspace members
    const { data: workspaceMembers, error: membersError } = await supabase
      .from('workspace_members')
      .select(
        `
        id,
        role,
        created_at,
        profiles:profile_id(id, full_name, avatar_url, email)
      `
      )
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (membersError) {
      console.error('Error fetching workspace members:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch workspace members' },
        { status: 500 }
      );
    }

    let availableMembers = workspaceMembers || [];

    // If board_id is provided, also include direct board members who might not be workspace members
    if (boardId) {
      // Verify user has access to the board
      const { data: board, error: boardError } = await supabase
        .from('boards')
        .select('id, workspace_id, visibility, owner_id')
        .eq('id', boardId)
        .single();

      if (boardError || !board) {
        return NextResponse.json({ error: 'Board not found' }, { status: 404 });
      }

      // Check if user has access to this board
      let hasAccess = false;

      if (board.owner_id === user.id) {
        hasAccess = true;
      } else {
        const { data: boardMembership, error: boardMemberError } =
          await supabase
            .from('board_members')
            .select('id')
            .eq('board_id', boardId)
            .eq('profile_id', user.id)
            .single();

        if (!boardMemberError && boardMembership) {
          hasAccess = true;
        } else if (board.visibility === 'workspace' && workspaceMembership) {
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied: You do not have access to this board' },
          { status: 403 }
        );
      }

      // Get direct board members
      const { data: boardMembers, error: boardMembersError } = await supabase
        .from('board_members')
        .select(
          `
          id,
          role,
          created_at,
          profiles:profile_id(id, full_name, avatar_url, email)
        `
        )
        .eq('board_id', boardId);

      if (!boardMembersError && boardMembers) {
        // Merge workspace members and board members, avoiding duplicates
        const existingProfileIds = new Set(
          availableMembers.map((member) => member.profiles?.id)
        );

        const additionalBoardMembers = boardMembers.filter(
          (member) =>
            member.profiles && !existingProfileIds.has(member.profiles.id)
        );

        availableMembers = [...availableMembers, ...additionalBoardMembers];
      }

      // Also include the board owner if not already included
      if (
        !availableMembers.some(
          (member) => member.profiles?.id === board.owner_id
        )
      ) {
        const { data: ownerProfile, error: ownerError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email')
          .eq('id', board.owner_id)
          .single();

        if (!ownerError && ownerProfile) {
          availableMembers.push({
            id: 'owner',
            role: 'owner',
            created_at: board.created_at || new Date().toISOString(),
            profiles: ownerProfile,
          });
        }
      }
    }

    // Sort by name for better UX
    availableMembers.sort((a, b) => {
      const nameA = a.profiles?.full_name || a.profiles?.email || '';
      const nameB = b.profiles?.full_name || b.profiles?.email || '';
      return nameA.localeCompare(nameB);
    });

    return NextResponse.json({ members: availableMembers });
  } catch (error) {
    console.error(
      'Error in GET /api/workspaces/[id]/available-members:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
