import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createClient();

    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {},
      recommendations: [],
    };

    // Test 1: Check if we can access auth.users (this should fail due to RLS)
    try {
      const { data: authUsers, error: authError } = await supabase
        .from('auth.users')
        .select('id, email')
        .limit(1);

      results.tests.authUsersAccess = {
        success: !authError,
        error: authError?.message,
        note: 'Should fail due to RLS - this is expected',
      };
    } catch (error) {
      results.tests.authUsersAccess = {
        success: false,
        error: 'Cannot access auth.users table',
        note: 'Expected - RLS blocks direct access',
      };
    }

    // Test 2: Check profiles table structure and data
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    results.tests.profilesTable = {
      success: !profilesError,
      error: profilesError?.message,
      count: profilesData?.length || 0,
      recentProfiles: profilesData || [],
    };

    // Test 3: Check workspaces table
    const { data: workspacesData, error: workspacesError } = await supabase
      .from('workspaces')
      .select('id, name, owner_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    results.tests.workspacesTable = {
      success: !workspacesError,
      error: workspacesError?.message,
      count: workspacesData?.length || 0,
      recentWorkspaces: workspacesData || [],
    };

    // Test 4: Check current user authentication
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    results.tests.currentUser = {
      authenticated: !!user,
      error: userError?.message,
      userId: user?.id,
      email: user?.email,
    };

    // Test 5: If user exists, check their profile and workspace
    if (user) {
      const { data: userProfile, error: userProfileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      results.tests.userProfile = {
        exists: !!userProfile,
        error: userProfileError?.message,
        profile: userProfile,
      };

      const { data: userWorkspaces, error: userWorkspacesError } =
        await supabase.from('workspaces').select('*').eq('owner_id', user.id);

      results.tests.userWorkspaces = {
        count: userWorkspaces?.length || 0,
        error: userWorkspacesError?.message,
        workspaces: userWorkspaces || [],
      };
    }

    // Test 6: Try to manually insert a test profile (to see if triggers fire)
    if (user) {
      const testProfileId = 'test-' + Date.now();

      try {
        // First, try to insert a test profile to see what happens
        const { data: insertTest, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: testProfileId,
            email: 'test@example.com',
            full_name: 'Test User',
          })
          .select();

        results.tests.manualProfileInsert = {
          success: !insertError,
          error: insertError?.message,
          data: insertTest,
        };

        // Clean up test profile
        if (!insertError) {
          await supabase.from('profiles').delete().eq('id', testProfileId);
        }
      } catch (error) {
        results.tests.manualProfileInsert = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Test 7: Check if we can see database functions/triggers (this will likely fail)
    try {
      const { data: functions, error: functionsError } = await supabase
        .from('information_schema.routines')
        .select('routine_name, routine_type')
        .eq('routine_name', 'handle_new_user')
        .limit(5);

      results.tests.databaseFunctions = {
        success: !functionsError,
        error: functionsError?.message,
        functions: functions || [],
      };
    } catch (error) {
      results.tests.databaseFunctions = {
        success: false,
        error: 'Cannot access information_schema',
        note: 'Expected - RLS blocks system table access',
      };
    }

    // Generate recommendations based on test results
    if (user && !results.tests.userProfile?.exists) {
      results.recommendations.push(
        'User authenticated but profile missing - database trigger may not be working'
      );
    }

    if (user && results.tests.userWorkspaces?.count === 0) {
      results.recommendations.push(
        'User has no workspaces - workspace creation logic needs investigation'
      );
    }

    if (results.tests.profilesTable?.count === 0) {
      results.recommendations.push(
        'No profiles in database - triggers definitely not working'
      );
    }

    if (!results.tests.manualProfileInsert?.success) {
      results.recommendations.push(
        'Cannot manually insert profiles - check RLS policies'
      );
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Database debug error:', error);
    return NextResponse.json(
      {
        error: 'Database debug failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
