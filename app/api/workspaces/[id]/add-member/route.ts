import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { notifyWorkspaceMemberAdded } from '@/utils/notifications';

// POST /api/workspaces/[id]/add-member - Add existing user as member
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const workspaceId = params.id;
    const body = await request.json();
    const { profile_id, role = 'member' } = body;

    if (!profile_id || !role) {
      return NextResponse.json(
        { error: 'Profile ID and role are required' },
        { status: 400 }
      );
    }

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to add members
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('profile_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check workspace settings for membership permissions
    const { data: settingsData, error: settingsError } = await supabase
      .from('workspace_settings')
      .select('setting_type, setting_value')
      .eq('workspace_id', workspaceId);

    console.log('Workspace settings check:', { settingsData, settingsError });

    if (settingsError) {
      console.error('Error fetching workspace settings:', settingsError);
      return NextResponse.json(
        { error: 'Failed to check permissions' },
        { status: 500 }
      );
    }

    // Default membership restriction
    let membershipRestriction = 'admins_only';

    // Process settings data to find membership_restriction
    if (settingsData && settingsData.length > 0) {
      const membershipSetting = settingsData.find(
        (setting) => setting.setting_type === 'membership_restriction'
      );

      if (membershipSetting) {
        try {
          if (typeof membershipSetting.setting_value === 'string') {
            membershipRestriction = JSON.parse(membershipSetting.setting_value);
          } else {
            membershipRestriction = membershipSetting.setting_value;
          }
        } catch (error) {
          console.error('Error parsing membership_restriction:', error);
          membershipRestriction = 'admins_only';
        }
      }
    }

    // Check if user can add members based on their role and workspace settings
    const canAddMembers = (() => {
      switch (membershipRestriction) {
        case 'owner_only':
          return membership.role === 'owner';
        case 'admins_only':
          return membership.role === 'owner' || membership.role === 'admin';
        case 'anyone':
          return (
            membership.role === 'owner' ||
            membership.role === 'admin' ||
            membership.role === 'member'
          );
        default:
          return membership.role === 'owner' || membership.role === 'admin';
      }
    })();

    console.log('Permission check:', {
      membershipRestriction,
      userRole: membership.role,
      canAddMembers,
    });

    if (!canAddMembers) {
      return NextResponse.json(
        {
          error: 'You do not have permission to add members to this workspace',
        },
        { status: 403 }
      );
    }

    // canAddMembers only checked whether the caller may add someone at
    // all — it says nothing about which role they're allowed to hand out.
    // Without this, a plain 'member' (in a workspace where the 'anyone'
    // setting lets any member add people) could send { role: 'admin' } in
    // the request body and grant admin through this route directly,
    // bypassing the promote/demote route's owner/admin-only check
    // entirely. Reject unknown roles, and only let an existing
    // owner/admin grant 'admin'.
    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }
    if (role === 'admin' && !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        {
          error: 'Only workspace owners and admins can add members as admin',
        },
        { status: 403 }
      );
    }

    // Check if profile exists. Goes through get_profile_by_id() (a
    // SECURITY DEFINER function — see
    // 20260814220000_fix_add_member_profile_lookup.sql) rather than
    // querying `profiles` directly: the person being added is, by
    // definition, someone the caller doesn't share a workspace/board with
    // yet, which the RLS-scoped table read wouldn't return.
    const { data: profileRows, error: profileError } = await supabase.rpc(
      'get_profile_by_id',
      { p_profile_id: profile_id }
    );
    const profile = profileRows?.[0];

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const { data: existingMembership, error: existingMembershipError } =
      await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('profile_id', profile_id)
        .single();

    if (existingMembership) {
      return NextResponse.json(
        { error: 'User is already a member of this workspace' },
        { status: 400 }
      );
    }

    // Add user as workspace member
    const { data: newMember, error: addMemberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        profile_id: profile_id,
        role,
        invited_by: user.id,
      })
      .select()
      .single();

    if (addMemberError) {
      console.error('Error adding member:', addMemberError);
      return NextResponse.json(
        { error: 'Failed to add member' },
        { status: 500 }
      );
    }

    // Create activity record
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single();

    if (!workspaceError && workspace) {
      await supabase.from('activities').insert({
        profile_id: user.id,
        action_type: 'member_added_to_workspace',
        action_data: {
          member_email: profile.email,
          member_name: profile.full_name,
          workspace_id: workspaceId,
          workspace_name: workspace.name,
          role: role,
        },
      });

      // Best-effort, same convention as every other notification call
      // site — never lets a notification failure block the add itself.
      try {
        await notifyWorkspaceMemberAdded(supabase, {
          workspaceId,
          workspaceName: workspace.name,
          actorId: user.id,
          newMemberProfileId: profile_id,
        });
      } catch (notificationError) {
        console.error(
          'Failed to create workspace-added notification:',
          notificationError
        );
      }
    }

    return NextResponse.json({
      message: 'Member added successfully',
      member: {
        id: newMember.id,
        profile_id: profile.id,
        email: profile.email,
        name: profile.full_name,
        role: role,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/workspaces/[id]/add-member:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
