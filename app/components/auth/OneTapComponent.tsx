'use client';

import Script from 'next/script';
import { createClient } from '@/utils/supabase/client';
import { CredentialResponse } from 'google-one-tap';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const OneTapComponent = () => {
  const supabase = createClient();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [workspaceCreated, setWorkspaceCreated] = useState(false);

  // generate nonce to use for google id token sign-in
  const generateNonce = async (): Promise<string[]> => {
    const nonce = btoa(
      String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))
    );
    const encoder = new TextEncoder();
    const encodedNonce = encoder.encode(nonce);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedNonce);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashedNonce = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return [nonce, hashedNonce];
  };

  useEffect(() => {
    const initializeGoogleOneTap = async () => {
      setIsLoading(true);

      try {
        // Use getUser() to check if there's already an existing session before initializing the one-tap UI
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.error('Error getting user', error);
        }

        if (data.user) {
          router.push('/');
          return;
        }

        const [nonce, hashedNonce] = await generateNonce();

        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
            callback: async (response: CredentialResponse) => {
              try {
                // Prevent multiple simultaneous authentication attempts
                if (workspaceCreated) {
                  return;
                }

                // send id token returned in response.credential to supabase
                const { data, error } = await supabase.auth.signInWithIdToken({
                  provider: 'google',
                  token: response.credential,
                  nonce,
                });

                if (error) {
                  console.error('Supabase auth error:', error);
                  throw error;
                }

                // Ensure user session is established
                if (data.user) {
                  // Set flag to prevent multiple workspace creations
                  setWorkspaceCreated(true);
                }

                // Redirect to main app
                router.push('/');
              } catch (error) {
                console.error('Authentication failed:', error);
                alert('Authentication failed. Please try again.');
                setWorkspaceCreated(false); // Reset flag on error
              }
            },
            nonce: hashedNonce,
            // with chrome's removal of third-party cookies, we need to use FedCM instead
            use_fedcm_for_prompt: true,
          });

          window.google.accounts.id.renderButton(
            document.getElementById('googleButton')!,
            {
              theme: 'outline',
              size: 'large',
            }
          );

          // Also display the One Tap prompt
          window.google.accounts.id.prompt();
        }
      } catch (error) {
        console.error('Error initializing Google One Tap', error);
      } finally {
        setIsLoading(false);
      }
    };

    // We need to wait for the script to load before initializing
    const timer = setTimeout(() => {
      initializeGoogleOneTap();
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [router, supabase.auth, workspaceCreated]); // Add workspaceCreated to dependencies

  return (
    <>
      <Script
        src='https://accounts.google.com/gsi/client'
        onLoad={() => {}}
        strategy='afterInteractive'
      />
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <div id='googleButton'></div>
        <div id='oneTap' className='fixed top-0 right-0 z-[100]' />
      </div>
    </>
  );
};

export default OneTapComponent;
