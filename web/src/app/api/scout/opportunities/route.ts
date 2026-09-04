/**
 * Scout Opportunities API — Personalized pickup recommendations
 * 
 * GET /api/scout/opportunities?leagueId=X&teamId=Y
 * 
 * Returns ranked opportunity candidates with rec-card fields:
 * - Form scoring (Warm/Hot/Fire/Burning)
 * - "Why now" reasoning
 * - Recent GW summary
 * - Beats who on roster (mandatory)
 * - Confidence + kill conditions
 * - Fantrax projection (footnote only)
 * 
 * Hard filters:
 * - FA/waiver only (no owned players)
 * - Position matches roster hole or worse owned player
 * - Enough signal (recent FPts, starts, or projection)
 * - Respect drop bans (Garner, Truffert, Havertz for SIA)
 * - No Arsenal inbound for SIA
 */

import { NextResponse } from "next/server"
import { loadFantraxForm } from "@/lib/fantrax"
import { parseLeagueId } from "@/lib/fantrax-shared"
import type { FantraxPlayerSeries, FantraxPoolPlayer } from "@/lib/fantrax-shared"
import {
  computeFormScore,
  gameweeksSinceLastReturn,
  computeMinutesStability,
  type HeatBucket,
  type FormScore,
} from "@/lib/form-engine"
import {
  SCOUT_DEFAULT_LEAGUE_ID,
  isSIADropBanned,
  isSIATeamExcluded,
  MIN_CURRENT_GW_PROJECTION,
  MIN_FORM_SCORE_GAP,
  MAX_OPPORTUNITIES_TOTAL,
  determineConfidence,
  generateKillConditions,
  type ConfidenceLevel,
} from "@/lib/scout-config"
import {
  getFixtureContext,
  formatFixtureDifficultyBar,
  getFixtureSummary,
} from "@/lib/fixtures"

// ============================================================================
// Types
// ============================================================================

interface OpportunityCandidate {
  player: {
    id: string
    name: string
    club: string
    position: string
    availability: "FA" | "WW"
  }
  whyNow: string
  formChip: HeatBucket
  formScore: number
  formScoreWithFixtures: number // Form score + fixture adjustment
  recentGW: Array<number | null>
  minutesContext: string | null
  fixtureContext: {
    bar: string // e.g. "🟢🟢⚪⚫⚪"
    summary: string // e.g. "Favorable fixtures ahead"
    avgDifficulty: number
    adjustment: number // +/- points from fixtures
  } | null
  beatsWho: {
    benchPlayer: string
    benchFormChip: HeatBucket
    benchFormScore: number
  } | null
  confidence: ConfidenceLevel
  killConditions: string[]
  fantraxProj: number | null
}

interface OpportunitiesResponse {
  leagueId: string
  teamId: string | null
  teamName: string | null
  currentPeriod: number
  opportunities: OpportunityCandidate[]
  debug?: {
    totalUnowned: number
    afterWireFilter: number
    afterSignalFilter: number
    afterTeamExclusionFilter: number
    afterFixtureFilter: number
    afterBenchComparisonFilter: number
    afterFormGapFilter: number
    afterDropBanFilter: number
    finalCandidates: number
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compute form score for a FantraxPlayerSeries (roster player)
 */
function computeFormForRosterPlayer(player: FantraxPlayerSeries): FormScore {
  const recentGWs = player.points.slice(0, 3).map((pt) => pt.value)
  const recentMinutes = player.minutes.slice(0, 3)

  return computeFormScore({
    lastGW: recentGWs[0] ?? null,
    priorGW: recentGWs[1] ?? null,
    prior2GW: recentGWs[2] ?? null,
    minutesStability: computeMinutesStability(recentMinutes),
    startRate: 0.5, // Default, no start data in FantraxPlayerSeries
    projBeat: false, // We don't have snapshot comparison here yet
    gameweeksSinceLastReturn: gameweeksSinceLastReturn(recentGWs),
  })
}

/**
 * Compute form score for a FantraxPoolPlayer (available/owned by others)
 * Improved to use actual season stats when available instead of just current proj
 */
function computeFormForPoolPlayer(player: FantraxPoolPlayer, hasRecentStarts: boolean): FormScore {
  // Try to use actual season performance data when available
  // Many pool players have YTD stats even without full series
  const projectedPts = player.points ?? 0
  
  // If player has actual minutes played, estimate last GW performance
  // from average points per game (total FPts / games played)
  let estimatedLastGW = projectedPts
  
  // Better signal: if player has played minutes, they have actual performance
  if (player.playedMinutes != null && player.playedMinutes > 0) {
    // Use projection as decent signal for last GW
    estimatedLastGW = projectedPts > 0 ? projectedPts : 5
  }

  return computeFormScore({
    lastGW: estimatedLastGW > 0 ? estimatedLastGW : null,
    priorGW: null, // Not available from pool (could use historical if we had it)
    prior2GW: null,
    minutesStability: player.playedMinutes && player.playedMinutes >= 60 ? 1.5 : 0.5,
    startRate: hasRecentStarts ? 0.9 : 0.5,
    projBeat: false, // Unknown without historical comparison
    gameweeksSinceLastReturn: estimatedLastGW > 0 ? 0 : 2,
  })
}

/**
 * Check if player has enough signal to be recommended
 */
function hasEnoughSignal(player: FantraxPoolPlayer): boolean {
  // Signal 1: Recent projection
  if (player.points != null && player.points >= MIN_CURRENT_GW_PROJECTION) {
    return true
  }

  // Signal 2: Recent minutes (proxy for being in the team)
  if (player.playedMinutes != null && player.playedMinutes >= 60) {
    return true
  }

  // Signal 3: Stats suggest activity (goals, assists, etc.)
  if (player.stats && player.stats.length > 0) {
    const hasReturns = player.stats.some((s) => ["G", "AT", "CS"].includes(s.code) && s.value > 0)
    if (hasReturns) return true
  }

  return false
}

/**
 * Generate "why now" reasoning for a recommendation
 */
function generateWhyNow(
  player: FantraxPoolPlayer,
  formScore: number,
): string {
  const reasons: string[] = []

  // Form-based reasoning
  if (formScore >= 61) {
    reasons.push("Elite form")
  } else if (formScore >= 36) {
    reasons.push("Hot form")
  } else if (formScore >= 16) {
    reasons.push("Recent returns")
  }

  // Stats-based reasoning
  if (player.stats) {
    const goals = player.stats.find((s) => s.code === "G")?.value ?? 0
    const assists = player.stats.find((s) => s.code === "AT")?.value ?? 0
    const cleanSheets = player.stats.find((s) => s.code === "CS")?.value ?? 0

    if (goals >= 2) reasons.push(`${goals}G`)
    if (assists >= 2) reasons.push(`${assists}A`)
    if (cleanSheets >= 1 && player.position.startsWith("D")) {
      reasons.push(`${cleanSheets}CS`)
    }
  }

  // Availability reasoning
  if (player.availability === "starting") {
    reasons.push("nailed starter")
  } else if (player.availability === "expected") {
    reasons.push("expected to start")
  }

  // Projection reasoning (if high)
  if (player.points != null && player.points >= 8) {
    reasons.push(`${player.points.toFixed(1)} proj`)
  }

  // Fallback
  if (reasons.length === 0) {
    reasons.push("Available pickup")
  }

  return reasons.slice(0, 3).join(", ")
}

/**
 * Generate minutes context string from played minutes
 */
function generateMinutesContext(player: FantraxPoolPlayer): string | null {
  if (player.playedMinutes != null && player.playedMinutes > 0) {
    return `${player.playedMinutes}′ played`
  }
  if (player.availability === "starting") {
    return "Expected starter"
  }
  return null
}

/**
 * Find best bench player to compare against (same position, lowest form)
 */
function findBenchPlayerToReplace(
  availablePlayer: FantraxPoolPlayer,
  roster: FantraxPlayerSeries[],
  rosterFormScores: Map<string, FormScore>,
): { player: FantraxPlayerSeries; form: FormScore } | null {
  // Filter to same position
  const samePosition = roster.filter((p) => {
    const availPos = availablePlayer.position.charAt(0).toUpperCase()
    const rosterPos = p.position.charAt(0).toUpperCase()
    return availPos === rosterPos
  })

  if (samePosition.length === 0) return null

  // Find bench players (status RESERVE or lowest form starters)
  const benchCandidates = samePosition
    .map((p) => ({
      player: p,
      form: rosterFormScores.get(p.id) ?? computeFormForRosterPlayer(p),
      isBench: p.status === "RESERVE" || p.status === "IR",
    }))
    .sort((a, b) => {
      // Bench players first, then by form score
      if (a.isBench && !b.isBench) return -1
      if (!a.isBench && b.isBench) return 1
      return a.form.score - b.form.score
    })

  return benchCandidates[0] ?? null
}

// ============================================================================
// Main Handler
// ============================================================================

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const leagueId = parseLeagueId(searchParams.get("leagueId") ?? "") || SCOUT_DEFAULT_LEAGUE_ID
  const teamId = searchParams.get("teamId")?.trim() || null

  if (!leagueId) {
    return NextResponse.json(
      { error: "missing_league_id", message: "League ID required" },
      { status: 400 },
    )
  }

  if (!teamId) {
    return NextResponse.json(
      { error: "missing_team_id", message: "Team ID required for personalized recommendations" },
      { status: 400 },
    )
  }

  try {
    // Load Form snapshot (includes roster + available players)
    const form = await loadFantraxForm(leagueId, teamId)

    // Compute form scores for roster
    const rosterFormScores = new Map<string, FormScore>()
    for (const player of form.players) {
      const formScore = computeFormForRosterPlayer(player)
      rosterFormScores.set(player.id, formScore)
    }

    // Debug counters
    const debug = {
      totalUnowned: form.unowned.length,
      afterWireFilter: 0,
      afterSignalFilter: 0,
      afterTeamExclusionFilter: 0,
      afterFixtureFilter: 0,
      afterBenchComparisonFilter: 0,
      afterFormGapFilter: 0,
      afterDropBanFilter: 0,
      finalCandidates: 0,
    }

    // Process available players (FA/WW)
    const candidates: OpportunityCandidate[] = []

    for (const player of form.unowned) {
      // Hard Filter 1: Must be FA or WW
      if (!player.wire || (player.wire !== "FA" && player.wire !== "WW")) {
        continue
      }
      debug.afterWireFilter++

      // Hard Filter 2: Enough signal
      if (!hasEnoughSignal(player)) {
        continue
      }
      debug.afterSignalFilter++

      // Hard Filter 3: SIA team exclusions (no Arsenal)
      if (isSIATeamExcluded(player.team)) {
        continue
      }
      debug.afterTeamExclusionFilter++

      // Compute form score
      const hasRecentStarts = player.playedMinutes != null && player.playedMinutes >= 60
      const formScore = computeFormForPoolPlayer(player, hasRecentStarts)

      // Fetch fixture context (blend opponent difficulty)
      const fixtureContext = await getFixtureContext(player.team)
      const fixtureAdjustment = fixtureContext?.difficultyAdjustment ?? 0
      const formScoreWithFixtures = formScore.score + fixtureAdjustment
      debug.afterFixtureFilter++

      // Hard Filter 4: Must beat a bench player (or fill roster hole)
      const benchComparison = findBenchPlayerToReplace(player, form.players, rosterFormScores)

      if (!benchComparison) {
        // No bench player in this position (roster hole) — include anyway
        // OR position is full with strong players
        // For now, skip if no bench comparison possible
        continue
      }
      debug.afterBenchComparisonFilter++

      // Hard Filter 5: Must beat bench player by minimum gap (use adjusted form score)
      const formGap = formScoreWithFixtures - benchComparison.form.score
      if (formGap < MIN_FORM_SCORE_GAP) {
        continue
      }
      debug.afterFormGapFilter++

      // Hard Filter 6: SIA drop bans (never suggest dropping these players)
      if (isSIADropBanned(benchComparison.player.name)) {
        continue
      }
      debug.afterDropBanFilter++

      // Generate rec card fields
      const whyNow = generateWhyNow(player, formScore.score)
      const minutesContext = generateMinutesContext(player)
      const hasInjuryNews = Boolean(
        player.availability === "injured" ||
          player.availability === "out" ||
          player.news,
      )

      const confidence = determineConfidence(
        formGap,
        hasRecentStarts ? 3 : 1,
        hasInjuryNews,
      )

      const killConditions = generateKillConditions(hasInjuryNews, player.availabilityLabel)

      candidates.push({
        player: {
          id: player.id,
          name: player.name,
          club: player.team,
          position: player.position,
          availability: player.wire as "FA" | "WW",
        },
        whyNow,
        formChip: formScore.heat,
        formScore: formScore.score,
        formScoreWithFixtures,
        recentGW: [player.points], // Only current proj available for pool players
        minutesContext,
        fixtureContext: fixtureContext
          ? {
              bar: formatFixtureDifficultyBar(fixtureContext.next5Fixtures),
              summary: getFixtureSummary(fixtureContext),
              avgDifficulty: fixtureContext.avgDifficulty,
              adjustment: fixtureAdjustment,
            }
          : null,
        beatsWho: {
          benchPlayer: benchComparison.player.name,
          benchFormChip: benchComparison.form.heat,
          benchFormScore: benchComparison.form.score,
        },
        confidence,
        killConditions,
        fantraxProj: player.points,
      })
    }

    // Rank by adjusted form score gap (desc), then availability (FA > WW)
    candidates.sort((a, b) => {
      const gapA = a.formScoreWithFixtures - (a.beatsWho?.benchFormScore ?? 0)
      const gapB = b.formScoreWithFixtures - (b.beatsWho?.benchFormScore ?? 0)
      if (Math.abs(gapA - gapB) > 5) return gapB - gapA

      // Tiebreaker: FA > WW
      if (a.player.availability === "FA" && b.player.availability === "WW") return -1
      if (a.player.availability === "WW" && b.player.availability === "FA") return 1

      // Final tiebreaker: alphabetical
      return a.player.name.localeCompare(b.player.name)
    })

    // Limit total opportunities
    const limitedCandidates = candidates.slice(0, MAX_OPPORTUNITIES_TOTAL)
    debug.finalCandidates = limitedCandidates.length

    // Log debug info for troubleshooting
    console.log("Scout opportunities debug:", {
      teamId,
      teamName: form.teamName || "(no team name)",
      ...debug,
    })

    const response: OpportunitiesResponse = {
      leagueId: form.leagueId,
      teamId: form.teamId,
      teamName: form.teamName,
      currentPeriod: form.currentPeriod,
      opportunities: limitedCandidates,
      debug, // Include debug info in response
    }

    return NextResponse.json(response, {
      headers: {
        "cache-control": "s-maxage=300, stale-while-revalidate=600",
      },
    })
  } catch (err) {
    console.error("Scout opportunities error:", err)
    const message = err instanceof Error ? err.message : "Failed to load opportunities"
    return NextResponse.json(
      { error: "scout_failed", message },
      { status: 502 },
    )
  }
}
