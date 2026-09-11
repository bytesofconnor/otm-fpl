import { NextResponse } from "next/server"
import { createUserSupabaseClient } from "@/lib/supabase/server"

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/"
  return raw
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = safeNext(url.searchParams.get("next"))

  if (code) {
    const supabase = await createUserSupabaseClient()
    if (supabase) {
      await supabase.auth.exchangeCodeForSession(code)
    }
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
