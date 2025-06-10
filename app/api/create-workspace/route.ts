import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient();

    // Get current authenticated user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = session.user;
    const userName =
      user.user_metadata?.name || user.user_metadata?.full_name || 'User';

    console.log('Creating workspace for user:', user.id);

    // Check if user already has a workspace (more robust check)
    const { data: existingWorkspaces, error: checkError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('owner_id', user.id);

    if (checkError) {
      console.error('Error checking existing workspaces:', checkError);
      throw checkError;
    }

    if (existingWorkspaces && existingWorkspaces.length > 0) {
      console.log('User already has workspaces:', existingWorkspaces.length);
      return NextResponse.json({
        success: true,
        workspace: existingWorkspaces[0],
        message: 'Workspace already exists',
      });
    }

    // Create default workspace with cleaner name
    const workspaceName =
      userName !== 'User' ? `${userName}'s Workspace` : 'My Workspace';

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: workspaceName,
        color: '#0079bf', // Default blue
        owner_id: user.id,
        visibility: 'private',
      })
      .select()
      .single();

    if (workspaceError) {
      console.error('Workspace creation error:', workspaceError);
      throw workspaceError;
    }

    console.log('✅ Workspace created:', workspace.id);

    return NextResponse.json({
      success: true,
      workspace,
      message: 'Workspace created successfully',
    });
  } catch (error) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create workspace',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
