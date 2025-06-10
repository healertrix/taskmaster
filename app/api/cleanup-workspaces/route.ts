import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = createClient();

    // Get current authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('Cleaning up workspaces for user:', user.id);

    // Find all workspaces owned by this user
    const { data: userWorkspaces, error: fetchError } = await supabase
      .from('workspaces')
      .select('id, name, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true });

    if (fetchError) {
      throw fetchError;
    }

    if (!userWorkspaces || userWorkspaces.length <= 1) {
      return NextResponse.json({
        message: 'No duplicate workspaces found',
        workspacesRemaining: userWorkspaces?.length || 0,
      });
    }

    // Group by name to find duplicates
    const workspaceGroups: { [key: string]: typeof userWorkspaces } = {};
    userWorkspaces.forEach((workspace) => {
      if (!workspaceGroups[workspace.name]) {
        workspaceGroups[workspace.name] = [];
      }
      workspaceGroups[workspace.name].push(workspace);
    });

    let deletedCount = 0;

    // For each group with duplicates, keep the oldest one and delete the rest
    for (const [name, workspaces] of Object.entries(workspaceGroups)) {
      if (workspaces.length > 1) {
        // Sort by created_at to keep the oldest
        workspaces.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        // Keep the first (oldest) and delete the rest
        const toDelete = workspaces.slice(1);

        for (const workspace of toDelete) {
          console.log(
            `Deleting duplicate workspace: ${workspace.name} (${workspace.id})`
          );

          // Delete workspace members first
          await supabase
            .from('workspace_members')
            .delete()
            .eq('workspace_id', workspace.id);

          // Delete workspace settings
          await supabase
            .from('workspace_settings')
            .delete()
            .eq('workspace_id', workspace.id);

          // Delete the workspace
          const { error: deleteError } = await supabase
            .from('workspaces')
            .delete()
            .eq('id', workspace.id);

          if (deleteError) {
            console.error(
              `Error deleting workspace ${workspace.id}:`,
              deleteError
            );
          } else {
            deletedCount++;
          }
        }
      }
    }

    return NextResponse.json({
      message: `Cleaned up ${deletedCount} duplicate workspaces`,
      deletedCount,
      workspacesRemaining: userWorkspaces.length - deletedCount,
    });
  } catch (error) {
    console.error('❌ Cleanup Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to cleanup workspaces',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
