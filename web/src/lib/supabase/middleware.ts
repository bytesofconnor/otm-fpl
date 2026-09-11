import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabasePublicEnv } from "@/lib/supabase/env"
import { authCookieOptions, persistAuthCookieOptions } from "@/lib/supabase/session"

export async function updateSession(request: NextRequest) {
  const env = getSupabasePublicEnv()
  if (!env) return NextResponse.next({ request })

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(env.url, env.key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        const cookies = persistAuthCookieOptions(cookiesToSet)
        cookies.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        supabaseResponse = NextResponse.next({ request })
        cookies.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value)
          })
        }
      },
    },
  })

  await supabase.auth.getClaims()
  return supabaseResponse
}
