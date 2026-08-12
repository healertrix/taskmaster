import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service-role client — bypasses RLS entirely. Only for server code that
// genuinely has no user session to authenticate as (GitHub webhook
// deliveries, the GitHub App install callback before we can attribute the
// request to a signed-in profile mid-redirect). Every other route should
// keep using utils/supabase/server.ts's cookie-based client so RLS still
// does its job.
//
// NEVER import this from client components, and never let
// SUPABASE_SERVICE_ROLE_KEY leak into a NEXT_PUBLIC_* var — it's a full
// database bypass key.
export const createServiceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — required for server-to-server Supabase access (GitHub webhook/callback).'
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};
