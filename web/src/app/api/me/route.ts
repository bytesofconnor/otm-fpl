import { NextResponse } from "next/server"
import { OTM_LEAGUE_ID } from "@/lib/fantrax-shared"

/**
 * Simplified /api/me for single-user app.
 * Auth removed to avoid page load blocking (fixes PR #73 timeout issue).
 * Profile is stored client-side via league-session cookies.
 */
export type MembershipPayload = {
  email: string | null
  leagueId: string
  teamId: string | null
  plan: "free" | "pro"
}

export async function GET() {
  // For a 1-user app, return default profile. Real profile is client-side only.
  return NextResponse.json({
    email: null,
    leagueId: OTM_LEAGUE_ID,
    teamId: null,
    plan: "free",
  } satisfies MembershipPayload)
}
