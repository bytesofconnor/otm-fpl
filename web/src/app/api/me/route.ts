import { NextResponse } from "next/server"
import { OTM_LEAGUE_ID, parseLeagueId } from "@/lib/fantrax-shared"
import { createUserSupabaseClient } from "@/lib/supabase/server"
import { createServerSupabaseClient } from "@/lib/supabase"

export type MembershipPayload = {
  email: string | null
  leagueId: string
  teamId: string | null
  plan: "free" | "pro"
}

async function requireUser() {
  const supabase = await createUserSupabaseClient()
  if (!supabase) {
    return { error: NextResponse.json({ error: "auth_unconfigured" }, { status: 503 }), supabase: null, user: null }
  }
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }), supabase: null, user: null }
  }
  return { error: null, supabase, user: data.user }
}

async function ensureProfile(
  supabase: NonNullable<Awaited<ReturnType<typeof createUserSupabaseClient>>>,
  userId: string,
) {
  const existing = await supabase.from("profiles").select("league_id, team_id, plan").eq("id", userId).maybeSingle()
  if (existing.data) return existing.data

  const insert = await supabase.from("profiles").insert({
    id: userId,
    league_id: OTM_LEAGUE_ID,
    plan: "free",
  }).select("league_id, team_id, plan").single()

  if (insert.data) return insert.data

  const admin = createServerSupabaseClient()
  if (!admin) return null
  await admin.from("profiles").upsert({ id: userId, league_id: OTM_LEAGUE_ID, plan: "free" })
  const again = await supabase.from("profiles").select("league_id, team_id, plan").eq("id", userId).maybeSingle()
  return again.data
}

export async function GET() {
  const { error, supabase, user } = await requireUser()
  if (error || !supabase || !user) {
    return NextResponse.json({
      email: null,
      leagueId: OTM_LEAGUE_ID,
      teamId: null,
      plan: "free",
    } satisfies MembershipPayload)
  }

  const profile = await ensureProfile(supabase, user.id)
  if (!profile) {
    return NextResponse.json({ error: "profile_missing" }, { status: 500 })
  }

  const body: MembershipPayload = {
    email: user.email ?? null,
    leagueId: parseLeagueId(profile.league_id) || OTM_LEAGUE_ID,
    teamId: profile.team_id ?? null,
    plan: profile.plan === "pro" ? "pro" : "free",
  }
  return NextResponse.json(body)
}

export async function PATCH(request: Request) {
  const { error, supabase, user } = await requireUser()
  if (error || !supabase || !user) {
    return NextResponse.json({ saved: false })
  }

  const json = (await request.json().catch(() => null)) as { leagueId?: unknown; teamId?: unknown } | null
  const leagueId = typeof json?.leagueId === "string" ? parseLeagueId(json.leagueId) : ""
  if (!leagueId) {
    return NextResponse.json({ error: "invalid_league" }, { status: 400 })
  }
  const teamId =
    json?.teamId == null || json.teamId === ""
      ? null
      : typeof json.teamId === "string"
        ? json.teamId
        : null

  await ensureProfile(supabase, user.id)
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ league_id: leagueId, team_id: teamId })
    .eq("id", user.id)

  if (updateError) {
    return NextResponse.json({ error: "update_failed", message: updateError.message }, { status: 500 })
  }

  const body: MembershipPayload = {
    email: user.email ?? null,
    leagueId,
    teamId,
    plan: "free",
  }
  const current = await supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle()
  if (current.data?.plan === "pro") body.plan = "pro"
  return NextResponse.json(body)
}
