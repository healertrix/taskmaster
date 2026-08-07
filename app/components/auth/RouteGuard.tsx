'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface RouteGuardProps {
  children: React.ReactNode;
}

// Public paths that don't require authentication
const publicPaths = ['/auth/login'];

export default function RouteGuard({ children }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  // Reads AuthContext's already-verified user instead of doing its own
  // separate getUser() call. RouteGuard used to run an independent
  // getUser() on every navigation, in parallel with AuthContext's own
  // getSession()+getUser() chain (and, at the time, other hooks doing the
  // same) — each one is a real network round-trip that can trigger
  // Supabase's refresh-token rotation. Two of those racing on the same
  // (single-use) refresh token means one wins and the other's token is
  // already invalid, which can corrupt the session badly enough that only
  // clearing cookies recovers it. AuthContext is the one place that should
  // own verifying the user; everything else, including this guard, just
  // reads its result.
  const { user, isLoading } = useAuth();
  const isPublicRoute = publicPaths.includes(pathname);

  useEffect(() => {
    if (isLoading) return;

    if (!user && !isPublicRoute) {
      const redirectUrl = new URL('/auth/login', window.location.origin);
      redirectUrl.searchParams.set('next', pathname);
      router.push(`${redirectUrl.pathname}${redirectUrl.search}`);
    } else if (user && isPublicRoute) {
      router.push('/');
    }
  }, [user, isLoading, isPublicRoute, pathname, router]);

  // Still resolving the user, or about to redirect — show the loading
  // state rather than flashing protected content (or a redirect target)
  // for a frame.
  if (isLoading || (!user && !isPublicRoute) || (user && isPublicRoute)) {
    return (
      <div className='flex h-screen w-full items-center justify-center'>
        <div className='h-12 w-12 animate-spin rounded-full border-b-2 border-primary'></div>
      </div>
    );
  }

  return <>{children}</>;
}
