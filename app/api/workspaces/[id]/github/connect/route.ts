import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { signInstallState } from '@/utils/github/state';

// GET /api/workspaces/[id]/github/connect - workspace admin/owner clicks
// "Connect GitHub" in settings, lands here, gets redirected to GitHub's own
// installation picker. GitHub redirects back to /api/github/callback with
// an installation_id and this same signed state once the admin finishes
// choosing repos on GitHub's screen.
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

  if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const appSlug = process.env.GITHUB_APP_SLUG;
  if (!appSlug) {
    return NextResponse.json(
      { error: 'GitHub integration is not configured (missing GITHUB_APP_SLUG)' },
      { status: 500 }
    );
  }

  const state = signInstallState(workspaceId);
  const installUrl = `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(
    state
  )}`;

  return NextResponse.redirect(installUrl);
}
