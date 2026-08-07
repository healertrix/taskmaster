import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Module-level singleton. Components (RouteGuard, AuthContext, ...) call
// createClient() directly in their render body and put the result (or
// `.auth`) in a useEffect dependency array. createBrowserClient() builds a
// brand-new client object every call, so without caching it here, every
// re-render — including every Fast Refresh reload in dev — produced a new
// object identity, which re-fired those effects and re-showed their loading
// spinners. A Supabase browser client is safe to share as a singleton (it
// manages its own auth state internally), so cache and reuse one instance.
let client: SupabaseClient | undefined

export const createClient = () => {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}