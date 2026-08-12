import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request);

  // Check if the user is authenticated. getUser() re-verifies against the
  // Auth server rather than trusting whatever getSession() reads straight
  // from the request cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get pathname
  const pathname = request.nextUrl.pathname;

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/auth/login',
    '/api/auth/callback',
    // GitHub calls this directly, server-to-server — there's no user
    // session, ever (that's what its own HMAC signature check in
    // utils/github/verifyWebhook.ts is for instead). Without this, every
    // delivery got redirected to /auth/login by the block below and
    // bounced with a 405 (a page route can't handle POST) before our
    // handler ever ran.
    '/api/github/webhook',
  ];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // If user is not authenticated and trying to access a protected route
  if (!user && !isPublicRoute) {
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If user is authenticated and trying to access auth pages (like login)
  if (user && pathname.startsWith('/auth/login')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Update the user's last_active_at time in the database
  // We only do this on non-public routes to avoid too many updates
  if (user && !isPublicRoute) {
    const userId = user.id;

    try {
      await supabase
        .from('profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      console.error('Error updating last_active_at:', error);
    }
  }

  return response;
}

// Define routes that should be checked for authentication
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
