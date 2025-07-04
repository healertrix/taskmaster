import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;

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

    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', profile_id)
      .single();

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
