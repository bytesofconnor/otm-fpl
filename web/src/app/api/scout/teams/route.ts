/**
 * Scout Teams API — List managers from Over the Moon league
 * 
 * GET /api/scout/teams?leagueId=X
 * 
 * Returns team list with IDs, names, and owner handles for team picker
 */

import { NextResponse } from "next/server"
import { loadFantraxLeague } from "@/lib/fantrax"
import { parseLeagueId, OTM_LEAGUE_ID } from "@/lib/fantrax-shared"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const leagueId = parseLeagueId(searchParams.get("leagueId") ?? "") || OTM_LEAGUE_ID

  if (!leagueId) {
    return NextResponse.json(
      { error: "missing_league_id", message: "League ID required" },
      { status: 400 },
    )
  }

  try {
    // Load league data (no specific team needed)
    const league = await loadFantraxLeague(leagueId, null)

    // Extract team info with owners
    const teams = league.teams
      .filter((team) => team.id && team.name)
      .map((team) => ({
        id: team.id,
        name: team.name,
        owner: team.owner ?? null,
        shortName: team.shortName ?? null,
      }))
      .sort((a, b) => {
        // Sort by owner if available, otherwise by team name
        const aSort = a.owner ?? a.name
        const bSort = b.owner ?? b.name
        return aSort.localeCompare(bSort)
      })

    return NextResponse.json(
      {
        leagueId,
        leagueName: league.leagueName,
        teams,
      },
      {
        headers: {
          "cache-control": "s-maxage=600, stale-while-revalidate=1200",
        },
      },
    )
  } catch (err) {
    console.error("Scout teams error:", err)
    const message = err instanceof Error ? err.message : "Failed to load teams"
    return NextResponse.json(
      { error: "teams_failed", message },
      { status: 502 },
    )
  }
}
