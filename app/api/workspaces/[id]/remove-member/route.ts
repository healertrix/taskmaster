import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/workspaces/[id]/remove-member - Remove a member from workspace
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const workspaceId = params.id;
    const body = await request.json();
    const { profile_id } = body;

    console.log('Remove member request:', { workspaceId, profile_id });

    if (!profile_id) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
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
    console.log('Current user:', user.id);

    // Check if current user is the workspace owner or has admin permissions
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();

    console.log('Workspace ownership check:', { workspace, workspaceError });

    const isWorkspaceOwner = workspace && workspace.owner_id === user.id;
    console.log('Is workspace owner:', isWorkspaceOwner);

    let userRole = 'member'; // default
    if (isWorkspaceOwner) {
      userRole = 'owner';
    } else {
      // Check membership table for role
      const { data: membership, error: membershipError } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('profile_id', user.id)
        .single();

      console.log('Current user membership:', { membership, membershipError });

      if (membershipError || !membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      userRole = membership.role;
    }

    console.log('Final user role:', userRole);

    // Only owners and admins can remove members
    if (!['owner', 'admin'].includes(userRole)) {
      return NextResponse.json(
        { error: 'You do not have permission to remove members' },
        { status: 403 }
      );
    }

    // Find the member to remove
    const { data: memberToRemove, error: memberError } = await supabase
      .from('workspace_members')
      .select('id, role, profile_id')
      .eq('workspace_id', workspaceId)
      .eq('profile_id', profile_id)
      .single();

    console.log('Member to remove query:', { memberToRemove, memberError });

    if (memberError || !memberToRemove) {
      console.log('Member not found in workspace_members table');
      return NextResponse.json(
        { error: 'Member not found in this workspace' },
        { status: 404 }
      );
    }

    // Get member profile for logging
    const { data: memberProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', profile_id)
      .single();

    console.log('Member profile:', { memberProfile, profileError });

    // Prevent removing the last owner
    if (memberToRemove.role === 'owner') {
      const { count: ownerCount, error: countError } = await supabase
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('role', 'owner');

      console.log('Owner count check:', { ownerCount, countError });

      if (countError) {
        console.error('Error counting owners:', countError);
        return NextResponse.json(
          { error: 'Failed to verify workspace ownership' },
          { status: 500 }
        );
      }

      if (ownerCount && ownerCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last owner from the workspace' },
          { status: 400 }
        );
      }
    }

    // Permission rules:
    // - Workspace owners can remove anyone
    // - Admins can remove members but not other admins or owners
    if (
      userRole !== 'owner' &&
      ['owner', 'admin'].includes(memberToRemove.role)
    ) {
      return NextResponse.json(
        { error: 'Only workspace owners can remove other owners or admins' },
        { status: 403 }
      );
    }

    console.log('Permission check passed:', {
      userRole,
      memberRole: memberToRemove.role,
    });

    // Remove the member
    console.log('Attempting to remove member:', memberToRemove.id);
    const { error: removeError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberToRemove.id);

    if (removeError) {
      console.error('Error removing member:', removeError);
      return NextResponse.json(
        { error: 'Failed to remove member' },
        { status: 500 }
      );
    }

    console.log('Member removed successfully');

    // Create activity record
    const { data: workspaceInfo, error: workspaceInfoError } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single();

    if (!workspaceInfoError && workspaceInfo && memberProfile) {
      await supabase.from('activities').insert({
        profile_id: user.id,
        action_type: 'member_removed_from_workspace',
        action_data: {
          member_email: memberProfile.email,
          member_name: memberProfile.full_name,
          workspace_id: workspaceId,
          workspace_name: workspaceInfo.name,
          removed_role: memberToRemove.role,
        },
      });
    }

    return NextResponse.json({
      message: 'Member removed successfully',
      removed_member: {
        id: memberToRemove.id,
        profile_id: profile_id,
        email: memberProfile?.email,
        name: memberProfile?.full_name,
        role: memberToRemove.role,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/workspaces/[id]/remove-member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
