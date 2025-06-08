import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createClient();

    // Test database connection
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error,
        },
        { status: 500 }
      );
    }

    // Test auth
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      profilesCount: profiles?.length || 0,
      hasSession: !!session,
      sessionUser: session?.user?.id || null,
    });
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Server error',
        details: error,
      },
      { status: 500 }
    );
  }
}
