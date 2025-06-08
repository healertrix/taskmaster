import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/workspaces/[id]/members - Fetch all workspace members
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const workspaceId = params.id;

    // Get current user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;

    // Check if user is a member of this workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('profile_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch workspace members with profile information
    const { data: members, error: membersError } = await supabase
      .from('workspace_members')
      .select(
        `
        id,
        role,
        created_at,
        invited_by,
        profiles!workspace_members_profile_id_fkey (
          id,
          email,
          full_name,
          avatar_url
        ),
        inviter:profiles!workspace_members_invited_by_fkey (
          full_name,
          email
        )
      `
      )
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch members' },
        { status: 500 }
      );
    }

    // Fetch pending invitations
    const { data: invitations, error: invitationsError } = await supabase
      .from('invitations')
      .select(
        `
        id,
        email,
        role,
        created_at,
        expires_at,
        profiles!invitations_invited_by_fkey (
          full_name,
          email
        )
      `
      )
      .eq('workspace_id', workspaceId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (invitationsError) {
      console.error('Error fetching invitations:', invitationsError);
      return NextResponse.json(
        { error: 'Failed to fetch invitations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      members: members || [],
      invitations: invitations || [],
      userRole: membership.role,
    });
  } catch (error) {
    console.error('Error in GET /api/workspaces/[id]/members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/workspaces/[id]/members - Invite new member
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const workspaceId = params.id;
    const body = await request.json();
    const { email, role = 'member' } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
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

    // Check if user has permission to invite members
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('profile_id', user.id)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check workspace settings for invitation permissions
    const { data: settings, error: settingsError } = await supabase
      .from('workspace_settings')
      .select('setting_value')
      .eq('workspace_id', workspaceId)
      .eq('setting_type', 'membership_restriction')
      .single();

    if (settingsError) {
      console.error('Error fetching workspace settings:', settingsError);
      return NextResponse.json(
        { error: 'Failed to check permissions' },
        { status: 500 }
      );
    }

    const membershipRestriction = settings?.setting_value as string;
    const canInvite =
      membershipRestriction === '"anyone"' ||
      (membershipRestriction === '"any_member"' &&
        ['admin', 'member'].includes(membership.role)) ||
      (membershipRestriction === '"admins_only"' &&
        membership.role === 'admin') ||
      (membershipRestriction === '"owner_only"' && membership.role === 'admin'); // Admin is effectively owner in workspace context

    if (!canInvite) {
      return NextResponse.json(
        { error: 'You do not have permission to invite members' },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const { data: existingMember, error: existingMemberError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingMember) {
      const { data: existingMembership, error: existingMembershipError } =
        await supabase
          .from('workspace_members')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('profile_id', existingMember.id)
          .single();

      if (existingMembership) {
        return NextResponse.json(
          { error: 'User is already a member of this workspace' },
          { status: 400 }
        );
      }
    }

    // Check if there's already a pending invitation
    const { data: existingInvitation, error: existingInvitationError } =
      await supabase
        .from('invitations')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('email', email)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'There is already a pending invitation for this email' },
        { status: 400 }
      );
    }

    // Generate invitation token
    const invitationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    // Create invitation
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .insert({
        email,
        workspace_id: workspaceId,
        invited_by: user.id,
        role,
        token: invitationToken,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (invitationError) {
      console.error('Error creating invitation:', invitationError);
      return NextResponse.json(
        { error: 'Failed to send invitation' },
        { status: 500 }
      );
    }

    // TODO: Send invitation email here
    // For now, we'll just return the invitation details

    return NextResponse.json({
      message: 'Invitation sent successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/workspaces/[id]/members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
