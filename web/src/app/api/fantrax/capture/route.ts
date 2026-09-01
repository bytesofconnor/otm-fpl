// Description: Capture endpoint — snapshots Fantrax weekly projections before fixtures start

import { NextResponse } from "next/server"
import { parseLeagueId } from "@/lib/fantrax-shared"
import { upsertProjectionSnapshots } from "@/lib/supabase"

/**
 * Internal helper to load projected roster data from Fantrax.
 * This is similar to the logic in fantrax.ts but focused on getting projection data.
 */
async function fxpa(leagueId: string, method: string, data: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const cacheKey = new URLSearchParams({
    leagueId,
    m: method,
    p: String(data.period ?? data.view ?? ""),
    t: String(data.teamId ?? ""),
    proj: String(data.proj ?? ""),
    opt: String(data.optimal ?? ""),
    f: String(data.statusOrTeamFilter ?? ""),
    s: String(data.seasonOrProjection ?? ""),
  })
  const url = `https://www.fantrax.com/fxpa/req?${cacheKey.toString()}`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({ msgs: [{ method, data: { leagueId, ...data } }] }),
  })
  const json: unknown = await res.json().catch(() => null)
  const root = json as Record<string, unknown> | null
  const responses = root ? (Array.isArray(root.responses) ? root.responses : []) : []
  const first = responses[0] as Record<string, unknown> | null
  if (!first) return null
  if (first.pageError) return null
  return first.data as Record<string, unknown> | null
}

/**
 * Parses projected roster from Fantrax fxpa response
 */
function parseProjectedRoster(data: Record<string, unknown> | null): Array<{
  id: string
  teamId: string
  projected: number
}> {
  if (!data) return []
  const tables = Array.isArray(data.tables) ? data.tables : []
  const players: Array<{ id: string; teamId: string; projected: number }> = []

  for (const table of tables) {
    const tableRec = table as Record<string, unknown>
    if (!tableRec) continue
    const rows = Array.isArray(tableRec.rows) ? tableRec.rows : []
    
    for (const row of rows) {
      const rowRec = row as Record<string, unknown>
      const scorer = rowRec?.scorer as Record<string, unknown> | null
      if (!rowRec || !scorer) continue
      
      const cells = Array.isArray(rowRec.cells) ? rowRec.cells : []
      const projCell = cells[1] as Record<string, unknown> | null
      const projValue = projCell?.content
      const projected = typeof projValue === "number" ? projValue : typeof projValue === "string" ? parseFloat(projValue) : null
      
      if (!projected || projected <= 0) continue
      
      players.push({
        id: String(scorer.scorerId ?? ""),
        teamId: String(rowRec.teamId ?? ""),
        projected,
      })
    }
  }
  
  return players
}

/**
 * Fetches team IDs from league info
 */
async function getLeagueTeams(leagueId: string): Promise<string[]> {
  const url = new URL("https://www.fantrax.com/fxea/general/getLeagueInfo")
  url.searchParams.set("leagueId", leagueId)
  
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
    })
    const json = await res.json() as Record<string, unknown>
    const teamInfo = json.teamInfo
    
    if (Array.isArray(teamInfo)) {
      return teamInfo.map((t) => {
        const rec = t as Record<string, unknown>
        return String(rec?.id ?? rec?.teamId ?? "")
      }).filter(Boolean)
    }
    
    if (teamInfo && typeof teamInfo === "object") {
      return Object.keys(teamInfo as Record<string, unknown>)
    }
    
    return []
  } catch {
    return []
  }
}

/**
 * POST /api/fantrax/capture
 * 
 * Captures Fantrax weekly projections for a league and period.
 * First snapshot wins - won't overwrite existing snapshots.
 * 
 * Body: { leagueId: string, period: number }
 * Returns: { success: boolean, inserted: number, skipped: number }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as { leagueId?: string; period?: number }
    const leagueId = parseLeagueId(body.leagueId ?? "")
    const period = body.period ?? 1
    
    if (!leagueId) {
      return NextResponse.json({ error: "missing_league_id" }, { status: 400 })
    }
    
    if (!period || period < 1) {
      return NextResponse.json({ error: "invalid_period" }, { status: 400 })
    }
    
    // Get all teams in the league
    const teamIds = await getLeagueTeams(leagueId)
    if (!teamIds.length) {
      return NextResponse.json({ error: "no_teams_found" }, { status: 404 })
    }
    
    // Fetch projected rosters for all teams
    const WEEKLY_PROJ = "PROJECTION_0_926_EVENT_PROJECTED_WEEKLY"
    const rosterPromises = teamIds.map((teamId) =>
      fxpa(leagueId, "getTeamRosterInfo", {
        period,
        teamId,
        seasonOrProjection: WEEKLY_PROJ,
      })
    )
    
    const rosters = await Promise.all(rosterPromises)
    
    // Parse all players with projections
    const allPlayers: Array<{
      league_id: string
      period: number
      player_id: string
      team_id: string
      projected: number
      manager_projected: number | null
      captured_at: string
    }> = []
    
    for (let i = 0; i < rosters.length; i++) {
      const roster = rosters[i]
      const teamId = teamIds[i]
      const players = parseProjectedRoster(roster)
      
      for (const player of players) {
        allPlayers.push({
          league_id: leagueId,
          period,
          player_id: player.id,
          team_id: teamId,
          projected: player.projected,
          manager_projected: null, // Can be added later if needed
          captured_at: new Date().toISOString(),
        })
      }
    }
    
    if (!allPlayers.length) {
      return NextResponse.json({ 
        success: true, 
        inserted: 0, 
        skipped: 0,
        message: "No projections found to capture"
      })
    }
    
    // Upsert to Supabase (first snapshot wins via unique constraint)
    const result = await upsertProjectionSnapshots(allPlayers)
    
    return NextResponse.json({
      success: result.success,
      inserted: result.inserted,
      skipped: allPlayers.length - result.inserted,
      total: allPlayers.length,
      error: result.error,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "capture_failed"
    console.error("Capture error:", message)
    return NextResponse.json({ error: "capture_failed", message }, { status: 500 })
  }
}
