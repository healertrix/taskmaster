import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// DELETE /api/workspaces/[id]/invitations/[invitationId] - Cancel invitation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; invitationId: string } }
) {
  try {
    const supabase = createClient();
    const workspaceId = params.id;
    const invitationId = params.invitationId;

    // Get current user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;

    // Check if user is a member of this workspace with permission
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
    const canManageInvitations =
      membershipRestriction === '"anyone"' ||
      (membershipRestriction === '"any_member"' &&
        ['admin', 'member'].includes(membership.role)) ||
      (membershipRestriction === '"admins_only"' &&
        membership.role === 'admin') ||
      (membershipRestriction === '"owner_only"' && membership.role === 'admin');

    if (!canManageInvitations) {
      return NextResponse.json(
        { error: 'You do not have permission to manage invitations' },
        { status: 403 }
      );
    }

    // Check if invitation exists and belongs to this workspace
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select('id, email, workspace_id')
      .eq('id', invitationId)
      .eq('workspace_id', workspaceId)
      .is('accepted_at', null)
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Delete the invitation
    const { error: deleteError } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitationId);

    if (deleteError) {
      console.error('Error canceling invitation:', deleteError);
      return NextResponse.json(
        { error: 'Failed to cancel invitation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Invitation canceled successfully',
    });
  } catch (error) {
    console.error(
      'Error in DELETE /api/workspaces/[id]/invitations/[invitationId]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/workspaces/[id]/invitations/[invitationId] - Resend invitation
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; invitationId: string } }
) {
  try {
    const supabase = createClient();
    const workspaceId = params.id;
    const invitationId = params.invitationId;

    // Get current user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;

    // Check if user is a member of this workspace with permission
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
    const canManageInvitations =
      membershipRestriction === '"anyone"' ||
      (membershipRestriction === '"any_member"' &&
        ['admin', 'member'].includes(membership.role)) ||
      (membershipRestriction === '"admins_only"' &&
        membership.role === 'admin') ||
      (membershipRestriction === '"owner_only"' && membership.role === 'admin');

    if (!canManageInvitations) {
      return NextResponse.json(
        { error: 'You do not have permission to manage invitations' },
        { status: 403 }
      );
    }

    // Check if invitation exists and belongs to this workspace
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select('id, email, role, workspace_id')
      .eq('id', invitationId)
      .eq('workspace_id', workspaceId)
      .is('accepted_at', null)
      .single();

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Generate new invitation token and extend expiry
    const newToken = crypto.randomUUID();
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7); // 7 days from now

    // Update the invitation with new token and expiry
    const { error: updateError } = await supabase
      .from('invitations')
      .update({
        token: newToken,
        expires_at: newExpiresAt.toISOString(),
        created_at: new Date().toISOString(), // Reset creation time to show as "recently sent"
      })
      .eq('id', invitationId);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      return NextResponse.json(
        { error: 'Failed to resend invitation' },
        { status: 500 }
      );
    }

    // TODO: Send new invitation email here

    return NextResponse.json({
      message: 'Invitation resent successfully',
      expires_at: newExpiresAt.toISOString(),
    });
  } catch (error) {
    console.error(
      'Error in PATCH /api/workspaces/[id]/invitations/[invitationId]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
