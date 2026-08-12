import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';

// GET /api/workspaces/[id]/github - the workspace's GitHub connection
// status + connected repos, for the settings page. Any workspace member
// can view (matches the github_repos_select_member RLS policy); only
// admins/owners can disconnect (DELETE below).
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const workspaceId = params.id;
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('profile_id', user.id)
    .single();
  if (!membership) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { data: installation } = await supabase
    .from('github_installations')
    .select('account_login, account_type, created_at')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  const { data: repos } = await supabase
    .from('github_repos')
    .select('id, full_name, created_at')
    .eq('workspace_id', workspaceId)
    .order('full_name', { ascending: true });

  return NextResponse.json({
    installation: installation || null,
    repos: repos || [],
  });
}

// DELETE /api/workspaces/[id]/github - disconnects the GitHub App
// installation entirely (all connected repos + their card links go with
// it, via FK cascade). Doesn't uninstall the App on GitHub's side — the
// admin still has to do that from GitHub if they want to fully revoke
// access; this just severs taskmaster's side of the connection.
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const workspaceId = params.id;
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('profile_id', user.id)
    .single();
  if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // No DELETE RLS policy exists on github_installations (only SELECT, for
  // members to view the connection) — this uses the service-role client
  // for the actual delete, after the admin/owner check above using the
  // normal session-bound client.
  const service = createServiceClient();
  const { error } = await service
    .from('github_installations')
    .delete()
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Failed to disconnect GitHub installation:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
