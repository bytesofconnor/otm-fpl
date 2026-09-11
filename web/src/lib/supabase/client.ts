import { createBrowserClient } from "@supabase/ssr"
import { getSupabasePublicEnv } from "@/lib/supabase/env"
import { authCookieOptions } from "@/lib/supabase/session"

export function createBrowserSupabaseClient() {
  const env = getSupabasePublicEnv()
  if (!env) return null
  return createBrowserClient(env.url, env.key, {
    cookieOptions: authCookieOptions,
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}
