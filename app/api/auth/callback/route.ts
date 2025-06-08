import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';

  console.log('Auth callback received:', { code: !!code, next });

  if (code) {
    const supabase = createClient();

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Error exchanging code for session:', error);
        return NextResponse.redirect(
          `${
            requestUrl.origin
          }/auth/login?error=auth&message=${encodeURIComponent(error.message)}`
        );
      }

      console.log('Session exchange successful:', {
        userId: data.session?.user?.id,
      });

      // Get current session to fetch user information
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Error getting session:', sessionError);
        return NextResponse.redirect(
          `${requestUrl.origin}/auth/login?error=session`
        );
      }

      if (session?.user) {
        // Simple profile creation/update in the database
        const { id, email, user_metadata } = session.user;

        console.log('Creating/updating profile for user:', {
          id,
          email,
          metadata: user_metadata,
        });

        // Simple profile upsert (backup if trigger fails)
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .upsert(
            {
              id,
              email,
              full_name: user_metadata?.full_name || user_metadata?.name || '',
              avatar_url:
                user_metadata?.avatar_url || user_metadata?.picture || '',
              updated_at: new Date().toISOString(),
              last_active_at: new Date().toISOString(),
            },
            {
              onConflict: 'id',
              ignoreDuplicates: false,
            }
          )
          .select();

        if (profileError) {
          console.error('Profile error:', profileError);
          // Continue anyway - the user is authenticated
        } else {
          console.log('Profile backup upsert successful:', profileData);
        }
      }
    } catch (error) {
      console.error('Unexpected error in auth callback:', error);
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/login?error=unexpected`
      );
    }
  }

  console.log('Redirecting to:', `${requestUrl.origin}${next}`);
  return NextResponse.redirect(`${requestUrl.origin}${next}`);
}
