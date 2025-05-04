'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface RouteGuardProps {
  children: React.ReactNode;
}

export default function RouteGuard({ children }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // Public paths that don't require authentication
  const publicPaths = ['/auth/login'];

  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      try {
        // Check if the user is authenticated
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!data.session) {
          // User is not authenticated and trying to access a protected route
          if (!publicPaths.includes(pathname)) {
            router.push('/auth/login');
            return;
          }
        } else {
          // User is authenticated but trying to access auth pages
          if (publicPaths.includes(pathname)) {
            router.push('/');
            return;
          }
        }

        setIsAuthorized(true);
      } catch (error) {
        console.error('Authentication error:', error);
        if (!publicPaths.includes(pathname)) {
          router.push('/auth/login');
        } else {
          setIsAuthorized(true);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [pathname, router, supabase.auth]);

  // Show loading state or the children based on authorization status
  if (isLoading) {
    return (
      <div className='flex h-screen w-full items-center justify-center'>
        <div className='h-12 w-12 animate-spin rounded-full border-b-2 border-primary'></div>
      </div>
    );
  }

  return isAuthorized ? <>{children}</> : null;
}
