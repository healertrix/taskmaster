import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';

  if (code) {
    const cookieStore = cookies();
    const supabase = createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/login?error=auth`
      );
    }

    // Get current session to fetch user information
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      // Update or create profile information in the database
      // Get user info from the session
      const { id, email, user_metadata } = session.user;

      // Try updating the profile record first, if it doesn't exist, create it
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id,
          email,
          full_name: user_metadata?.full_name || '',
          avatar_url: user_metadata?.avatar_url || '',
          updated_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
        },
        {
          onConflict: 'id',
          ignoreDuplicates: false,
        }
      );

      if (profileError) {
        console.error('Error updating profile:', profileError);
      }
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}${next}`);
}
