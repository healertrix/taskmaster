import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/workspaces/[id]/members/[profileId] - Update member role
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; profileId: string } }
) {
  try {
    const supabase = createClient();
    const workspaceId = params.id;
    const targetProfileId = params.profileId;
    const body = await request.json();
    const { role } = body;

    if (!role || !['admin', 'member', 'guest'].includes(role)) {
      return NextResponse.json(
        { error: 'Valid role is required' },
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

    // Check current user's role in workspace
    const { data: currentUserMembership, error: currentUserError } =
      await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('profile_id', user.id)
        .single();

    if (currentUserError || !currentUserMembership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Only admins can change roles
    if (currentUserMembership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can update member roles' },
        { status: 403 }
      );
    }

    // Check if target member exists
    const { data: targetMembership, error: targetMemberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('profile_id', targetProfileId)
      .single();

    if (targetMemberError || !targetMembership) {
      return NextResponse.json(
        { error: 'Member not found in workspace' },
        { status: 404 }
      );
    }

    // Prevent changing own role
    if (user.id === targetProfileId) {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 400 }
      );
    }

    // Update member role
    const { error: updateError } = await supabase
      .from('workspace_members')
      .update({
        role,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId)
      .eq('profile_id', targetProfileId);

    if (updateError) {
      console.error('Error updating member role:', updateError);
      return NextResponse.json(
        { error: 'Failed to update member role' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Member role updated successfully',
      role,
    });
  } catch (error) {
    console.error(
      'Error in PATCH /api/workspaces/[id]/members/[profileId]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/workspaces/[id]/members/[profileId] - Remove member from workspace
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; profileId: string } }
) {
  try {
    const supabase = createClient();
    const workspaceId = params.id;
    const targetProfileId = params.profileId;

    // Get current user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;

    // Check current user's role in workspace
    const { data: currentUserMembership, error: currentUserError } =
      await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('profile_id', user.id)
        .single();

    if (currentUserError || !currentUserMembership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if target member exists
    const { data: targetMembership, error: targetMemberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('profile_id', targetProfileId)
      .single();

    if (targetMemberError || !targetMembership) {
      return NextResponse.json(
        { error: 'Member not found in workspace' },
        { status: 404 }
      );
    }

    // Check permissions: users can remove themselves, or admins can remove others
    const canRemove =
      user.id === targetProfileId || // User removing themselves
      currentUserMembership.role === 'admin'; // Admin removing others

    if (!canRemove) {
      return NextResponse.json(
        { error: 'You do not have permission to remove this member' },
        { status: 403 }
      );
    }

    // Get workspace to check if this is the owner
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();

    if (workspaceError) {
      console.error('Error fetching workspace:', workspaceError);
      return NextResponse.json(
        { error: 'Failed to verify workspace ownership' },
        { status: 500 }
      );
    }

    // Prevent removing the workspace owner
    if (targetProfileId === workspace.owner_id) {
      return NextResponse.json(
        { error: 'Cannot remove the workspace owner' },
        { status: 400 }
      );
    }

    // Remove member from workspace
    const { error: deleteError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('profile_id', targetProfileId);

    if (deleteError) {
      console.error('Error removing member:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove member' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error(
      'Error in DELETE /api/workspaces/[id]/members/[profileId]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
