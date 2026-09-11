import type { CookieOptions, CookieOptionsWithName } from "@supabase/ssr"

/** One year. Access JWTs stay short; middleware refreshes them from this cookie. */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const authCookieOptions: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  maxAge: AUTH_COOKIE_MAX_AGE,
}

export function persistAuthCookieOptions<
  T extends { name: string; value: string; options: CookieOptions },
>(cookies: T[]): T[] {
  return cookies.map((cookie) => {
    if (!cookie.value) return cookie
    return {
      ...cookie,
      options: {
        ...cookie.options,
        path: cookie.options.path ?? "/",
        sameSite: cookie.options.sameSite ?? "lax",
        maxAge: AUTH_COOKIE_MAX_AGE,
      },
    }
  })
}
