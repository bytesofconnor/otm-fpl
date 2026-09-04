/**
 * History Capture — Collect actual scored FPts, minutes, started signal, and ownership
 * 
 * Complements collectWeeklyProjectionCandidates (which captures projections before fixtures).
 * This captures actuals after fixtures progress/lock.
 */

import type { PlayerWeekStat, OwnershipSnapshot } from "./supabase"
import { loadFantraxForm } from "./fantrax"

/**
 * Generate unique capture ID for correlating stats + ownership snapshots
 */
function generateCaptureId(): string {
  return `capture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Collect player week stats (scored FPts, minutes, started) after fixtures progress
 * 
 * Unlike projections (first-wins), stats can be captured multiple times as week progresses.
 * Use capture_id to identify which capture run rows belong to.
 */
export async function collectPlayerWeekStats(
  leagueId: string,
  period: number,
): Promise<{
  captureId: string
  period: number
  stats: Omit<PlayerWeekStat, "id" | "created_at">[]
}> {
  const captureId = generateCaptureId()
  const stats: Omit<PlayerWeekStat, "id" | "created_at">[] = []
  
  try {
    // Load form data which includes league-owned players with recent stats
    const form = await loadFantraxForm(leagueId, null)
    
    // Capture stats for league-owned players (all rostered players)
    for (const player of form.leagueOwned) {
      // Extract scored FPts from live points (if available)
      const scoredFpts = player.live ?? player.points
      
      // Extract minutes and started signal
      const minutesPlayed = player.playedMinutes ?? null
      
      // We don't have explicit "started" boolean in FantraxPoolPlayer
      // But we can infer: if they played 60+ minutes, likely started
      const started = minutesPlayed != null && minutesPlayed >= 60 ? true : null
      
      stats.push({
        capture_id: captureId,
        league_id: leagueId,
        period,
        player_id: player.id,
        player_name: player.name,
        position: player.position,
        club: player.team,
        scored_fpts: scoredFpts,
        minutes_played: minutesPlayed,
        started,
        captured_at: new Date().toISOString(),
      })
    }
    
    return { captureId, period, stats }
  } catch (err) {
    console.error("Failed to collect player week stats:", err)
    return { captureId, period, stats: [] }
  }
}

/**
 * Collect ownership snapshots (FA/WW/owned status) for wire intelligence
 * 
 * Can be captured multiple times (e.g., daily) to track wire movement.
 */
export async function collectOwnershipSnapshots(
  leagueId: string,
  period: number,
  captureId?: string,
): Promise<{
  captureId: string
  period: number
  snapshots: Omit<OwnershipSnapshot, "id" | "created_at">[]
}> {
  const finalCaptureId = captureId || generateCaptureId()
  const snapshots: Omit<OwnershipSnapshot, "id" | "created_at">[] = []
  
  try {
    // Load form data which includes owned + unowned (FA/WW) players
    const form = await loadFantraxForm(leagueId, null)
    
    // Capture ownership for league-owned players
    for (const player of form.leagueOwned) {
      snapshots.push({
        capture_id: finalCaptureId,
        league_id: leagueId,
        period,
        player_id: player.id,
        player_name: player.name,
        position: player.position,
        club: player.team,
        availability: "OWNED",
        waiver_day: null,
        owner_team_id: player.ownerTeamId ?? null,
        owner_short_code: player.ownerShort ?? null,
        captured_at: new Date().toISOString(),
      })
    }
    
    // Capture ownership for unowned players (FA/WW)
    for (const player of form.unowned) {
      const availability = player.wire === "FA" ? "FA" : player.wire === "WW" ? "WW" : "UNKNOWN"
      
      // Parse waiver day from wire string if available
      // Fantrax format: "WW" or potentially "WW3" for day 3
      let waiverDay: number | null = null
      if (player.wire && player.wire.startsWith("WW")) {
        const dayMatch = player.wire.match(/WW(\d+)/)
        if (dayMatch) {
          waiverDay = parseInt(dayMatch[1], 10)
        }
      }
      
      snapshots.push({
        capture_id: finalCaptureId,
        league_id: leagueId,
        period,
        player_id: player.id,
        player_name: player.name,
        position: player.position,
        club: player.team,
        availability,
        waiver_day: waiverDay,
        owner_team_id: null,
        owner_short_code: null,
        captured_at: new Date().toISOString(),
      })
    }
    
    return { captureId: finalCaptureId, period, snapshots }
  } catch (err) {
    console.error("Failed to collect ownership snapshots:", err)
    return { captureId: finalCaptureId, period, snapshots: [] }
  }
}
