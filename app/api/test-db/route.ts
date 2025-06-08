import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createClient();

    // Test 1: Check if profiles table exists and is accessible
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at')
      .limit(5);

    // Test 2: Check if we can access auth.users (this might fail due to RLS)
    let authUsersCount = 0;
    try {
      const { count } = await supabase
        .from('auth.users')
        .select('*', { count: 'exact', head: true });
      authUsersCount = count || 0;
    } catch (authError) {
      // This is expected to fail due to RLS
    }

    // Test 3: Check current session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    return NextResponse.json({
      success: true,
      tests: {
        profilesTable: {
          accessible: !profilesError,
          error: profilesError?.message,
          count: profiles?.length || 0,
          sampleProfiles: profiles?.map((p) => ({
            id: p.id.slice(0, 8) + '...',
            email: p.email,
            hasName: !!p.full_name,
            createdAt: p.created_at,
          })),
        },
        authUsers: {
          count: authUsersCount,
        },
        currentSession: {
          hasSession: !!session,
          userId: session?.user?.id?.slice(0, 8) + '...' || null,
          userEmail: session?.user?.email || null,
          error: sessionError?.message,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Database test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
