// Description: Form API — manager trajectories, upcoming player projections, and roster news.

import { NextResponse } from "next/server"
import { loadFantraxForm } from "@/lib/fantrax"
import { parseLeagueId } from "@/lib/fantrax-shared"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const leagueId = parseLeagueId(searchParams.get("leagueId") ?? "")
  const teamId = searchParams.get("teamId")?.trim() || null
  if (!leagueId) {
    return NextResponse.json({ error: "missing_league_id" }, { status: 400 })
  }
  try {
    const snapshot = await loadFantraxForm(leagueId, teamId)
    return NextResponse.json(snapshot, {
      headers: { "cache-control": "s-maxage=180, stale-while-revalidate=300" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "fantrax_failed"
    return NextResponse.json({ error: "fantrax_failed", message }, { status: 502 })
  }
}
