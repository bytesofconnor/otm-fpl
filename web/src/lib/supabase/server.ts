import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getSupabasePublicEnv } from "@/lib/supabase/env"
import { authCookieOptions, persistAuthCookieOptions } from "@/lib/supabase/session"

export async function createUserSupabaseClient() {
  const env = getSupabasePublicEnv()
  if (!env) return null
  const cookieStore = await cookies()

  return createServerClient(env.url, env.key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet, _headers) {
        try {
          persistAuthCookieOptions(cookiesToSet).forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot set cookies; middleware refreshes the session.
        }
      },
    },
  })
}
