// Description: Loads a Fantrax league snapshot (info, standings, rosters) for the connected league ID.

import { NextResponse } from "next/server"
import { loadFantraxLeague } from "@/lib/fantrax"
import { parseLeagueId } from "@/lib/fantrax-shared"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const leagueId = parseLeagueId(searchParams.get("leagueId") ?? "")
  const teamId = searchParams.get("teamId")?.trim() || null
  const periodRaw = Number(searchParams.get("period") ?? "")
  const period = Number.isInteger(periodRaw) && periodRaw > 0 ? periodRaw : null
  if (!leagueId) {
    return NextResponse.json({ error: "missing_league_id" }, { status: 400 })
  }
  try {
    const snapshot = await loadFantraxLeague(leagueId, teamId, period)
    return NextResponse.json(snapshot, {
      headers: { "cache-control": "s-maxage=120, stale-while-revalidate=300" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "fantrax_failed"
    const status = /invalid league|not found/i.test(message) ? 404 : 502
    return NextResponse.json({ error: "fantrax_failed", message }, { status })
  }
}
