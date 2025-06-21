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

      // Get current user to fetch user information (more secure than getSession)
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error('Error getting user:', userError);
        return NextResponse.redirect(
          `${requestUrl.origin}/auth/login?error=user`
        );
      }

      if (user) {
        const { id, email, user_metadata } = user;

        console.log('Processing user login:', {
          id,
          email,
          metadata: user_metadata,
        });

        // Wait a moment for the database trigger to create the profile
        // The trigger should handle profile creation automatically
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check if profile was created by the trigger
        let profileExists = false;
        let retries = 0;
        const maxRetries = 3;

        while (!profileExists && retries < maxRetries) {
          const { data: existingProfile, error: checkError } = await supabase
            .from('profiles')
            .select('id, created_at')
            .eq('id', id)
            .single();

          if (existingProfile) {
            profileExists = true;
            console.log(
              'Profile found/created by trigger:',
              existingProfile.id
            );

            // Update last_active_at for the user
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ last_active_at: new Date().toISOString() })
              .eq('id', id);

            if (updateError) {
              console.error('Profile update error:', updateError);
            } else {
              console.log('Profile last_active_at updated');
            }
          } else {
            console.log(
              `Profile not found yet, retry ${retries + 1}/${maxRetries}`
            );
            retries++;
            if (retries < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          }
        }

        if (!profileExists) {
          console.error(
            'Profile was not created by trigger, manual creation needed'
          );
          // Fallback manual profile creation if trigger failed
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .upsert(
              {
                id,
                email,
                full_name:
                  user_metadata?.full_name || user_metadata?.name || '',
                avatar_url:
                  user_metadata?.avatar_url || user_metadata?.picture || '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                last_active_at: new Date().toISOString(),
              },
              {
                onConflict: 'id',
                ignoreDuplicates: false,
              }
            );

          if (profileError) {
            console.error('Manual profile creation failed:', profileError);
          } else {
            console.log('Manual profile creation successful:', profileData);
          }
        }

        // NOTE: Workspace creation removed as per user request
        // Users will need to create workspaces manually when needed
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
