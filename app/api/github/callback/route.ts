import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';
import { verifyInstallState } from '@/utils/github/state';
import {
  getInstallationDetails,
  listInstallationRepos,
} from '@/utils/github/auth';

// GET /api/github/callback - GitHub redirects here once the admin finishes
// the install flow on github.com. Runs in the admin's own browser session
// (unlike the webhook route), so the normal cookie-based Supabase client
// still has their session — used to re-verify they're still an admin of
// the workspace the signed `state` claims, as defense in depth on top of
// the signature check itself.
function redirectToSettings(
  request: NextRequest,
  workspaceId: string,
  status: 'connected' | 'error',
  reason?: string
) {
  const url = new URL(`/workspace/${workspaceId}/settings`, request.url);
  url.searchParams.set('github', status);
  if (reason) url.searchParams.set('reason', reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get('installation_id');
  const state = searchParams.get('state');
  const setupAction = searchParams.get('setup_action'); // 'install' | 'update' | 'request'

  const verifiedState = verifyInstallState(state);
  if (!verifiedState) {
    // No workspace to redirect back to if state itself doesn't check out —
    // this is the one case that can't land back on a settings page.
    return NextResponse.json(
      { error: 'Invalid or expired installation request. Please try connecting again.' },
      { status: 400 }
    );
  }
  const { workspaceId } = verifiedState;

  if (!installationId) {
    return redirectToSettings(request, workspaceId, 'error', 'missing_installation_id');
  }

  // setup_action=request happens when a non-admin GitHub org member
  // requests an install an org owner has to approve — nothing to record
  // yet, the real installation event arrives later via the `installation`
  // webhook once approved.
  if (setupAction === 'request') {
    return redirectToSettings(request, workspaceId, 'error', 'awaiting_org_approval');
  }

  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return redirectToSettings(request, workspaceId, 'error', 'not_signed_in');
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('profile_id', user.id)
    .single();
  if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
    return redirectToSettings(request, workspaceId, 'error', 'access_denied');
  }

  const service = createServiceClient();

  try {
    const { account_login, account_type } = await getInstallationDetails(installationId);

    const { data: installationRow, error: installError } = await service
      .from('github_installations')
      .upsert(
        {
          workspace_id: workspaceId,
          installation_id: Number(installationId),
          account_login,
          account_type,
          connected_by_profile_id: user.id,
        },
        { onConflict: 'workspace_id' }
      )
      .select('id')
      .single();

    if (installError) {
      // installation_id has its own UNIQUE constraint separate from the
      // workspace_id one the upsert targets — this is that case: this
      // exact GitHub installation is already linked to a different
      // taskmaster workspace.
      if (installError.code === '23505') {
        return redirectToSettings(
          request,
          workspaceId,
          'error',
          'installation_already_linked'
        );
      }
      throw installError;
    }

    const repos = await listInstallationRepos(installationId);
    let skippedCount = 0;

    for (const repo of repos) {
      const { error: repoError } = await service.from('github_repos').insert({
        installation_id: installationRow.id,
        workspace_id: workspaceId,
        github_repo_id: repo.id,
        full_name: repo.full_name,
      });
      // Unique violation on github_repo_id = already connected to a
      // different workspace — skip it, surface the count, not fatal.
      if (repoError) {
        if (repoError.code === '23505') {
          skippedCount += 1;
        } else {
          console.error('Failed to insert connected repo:', repoError);
        }
      }
    }

    return redirectToSettings(
      request,
      workspaceId,
      'connected',
      skippedCount > 0 ? `${skippedCount}_repos_already_linked_elsewhere` : undefined
    );
  } catch (error) {
    console.error('GitHub installation callback failed:', error);
    return redirectToSettings(request, workspaceId, 'error', 'unexpected_error');
  }
}
