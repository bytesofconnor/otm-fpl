/**
 * Scout Waiver Claim Helper API
 * 
 * GET /api/scout/waivers?leagueId=X&teamId=Y
 * 
 * Returns ranked waiver priority order for players currently on waivers.
 * Helps managers avoid wasting high claims on players who might clear to FA.
 * 
 * Logic:
 * - Form score + fixture adjustment (from Fixture Context Layer)
 * - Roster gap urgency (position need)
 * - Ownership pressure (% rostered in league)
 * - Risk assessment: "likely to clear waivers" vs "high competition"
 * 
 * Hard filters:
 * - Only players currently on waivers (not FA)
 * - Position matches roster need
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

interface WaiverTarget {
  player: {
    id: string
    name: string
    club: string
    position: string
    waiverDay: number | null
  }
  claimPriority: number // 1 = top claim, 2 = second, etc.
  formChip: HeatBucket
  formScore: number
  formScoreWithFixtures: number
  fixtureContext: {
    bar: string
    summary: string
    avgDifficulty: number
    adjustment: number
  } | null
  dropCandidate: {
    name: string
    position: string
    formChip: HeatBucket
    formScore: number
  } | null
  riskAssessment: "high_competition" | "likely_clears" | "uncertain"
  ownershipPct: number // % rostered in league
  reasoning: string
  confidence: ConfidenceLevel
  killConditions: string[]
}

interface WaiversResponse {
  leagueId: string
  teamId: string | null
  teamName: string | null
  currentPeriod: number
  targets: WaiverTarget[]
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compute form score for a pool player (simplified, no full series)
 */
function computeFormForPoolPlayer(
  player: FantraxPoolPlayer,
  hasRecentStarts: boolean,
): FormScore {
  const lastGW = player.points ?? 0
  const priorGW = null
  const prior2GW = null

  const minutesStability = hasRecentStarts ? 3 : 0
  const startRate = hasRecentStarts ? 1.0 : 0.5

  const didBeatProj = lastGW > (player.points ?? 0)

  return computeFormScore({
    lastGW,
    priorGW,
    prior2GW,
    minutesStability,
    startRate,
    projBeatCount: didBeatProj ? 1 : 0,
  })
}

/**
 * Compute form score for roster player
 */
function computeFormForRosterPlayer(player: FantraxPlayerSeries): FormScore {
  const recentGWs = player.series.slice(-3)
  const lastGW = recentGWs[recentGWs.length - 1]?.scored ?? player.live ?? 0
  const priorGW = recentGWs[recentGWs.length - 2]?.scored ?? null
  const prior2GW = recentGWs[recentGWs.length - 3]?.scored ?? null

  const minutesStability = computeMinutesStability(player)
  const startRate = player.series.filter((s) => s.playedMinutes && s.playedMinutes >= 60).length / Math.max(player.series.length, 1)

  let projBeatCount = 0
  for (const gw of recentGWs.slice(-3)) {
    if (gw.scored != null && gw.proj != null && gw.scored > gw.proj) {
      projBeatCount++
    }
  }

  return computeFormScore({
    lastGW,
    priorGW,
    prior2GW,
    minutesStability,
    startRate,
    projBeatCount,
  })
}

/**
 * Check if player has enough signal
 */
function hasEnoughSignal(player: FantraxPoolPlayer): boolean {
  const hasProjection = player.points != null && player.points >= MIN_CURRENT_GW_PROJECTION
  const hasPlayedMinutes = player.playedMinutes != null && player.playedMinutes > 0
  return hasProjection || hasPlayedMinutes
}

/**
 * Find drop candidate (same position, lowest form, bench preferred)
 */
function findDropCandidate(
  waiverPlayer: FantraxPoolPlayer,
  roster: FantraxPlayerSeries[],
  rosterFormScores: Map<string, FormScore>,
): { player: FantraxPlayerSeries; form: FormScore } | null {
  const samePosition = roster.filter((p) => {
    const waiverPos = waiverPlayer.position.charAt(0).toUpperCase()
    const rosterPos = p.position.charAt(0).toUpperCase()
    return waiverPos === rosterPos
  })

  if (samePosition.length === 0) return null

  const benchCandidates = samePosition
    .map((p) => ({
      player: p,
      form: rosterFormScores.get(p.id) ?? computeFormForRosterPlayer(p),
      isBench: p.status === "RESERVE" || p.status === "IR",
    }))
    .sort((a, b) => {
      if (a.isBench && !b.isBench) return -1
      if (!a.isBench && b.isBench) return 1
      return a.form.score - b.form.score
    })

  return benchCandidates[0] ?? null
}

/**
 * Calculate ownership percentage in league
 */
function calculateOwnershipPct(
  playerId: string,
  allPlayers: FantraxPlayerSeries[],
): number {
  // Count how many rosters own this player
  const owned = allPlayers.filter(p => p.id === playerId).length
  const totalRosters = 12 // OTM league size (could be dynamic)
  return Math.round((owned / totalRosters) * 100)
}

/**
 * Assess risk of missing waiver claim
 */
function assessRisk(
  ownershipPct: number,
  formScoreWithFixtures: number,
  waiverDay: number | null,
): "high_competition" | "likely_clears" | "uncertain" {
  // High competition: Hot player, multiple managers likely want
  if (formScoreWithFixtures >= 65 && ownershipPct >= 15) {
    return "high_competition"
  }

  // Likely clears: Low ownership, decent form but not elite
  if (ownershipPct <= 10 && formScoreWithFixtures < 60) {
    return "likely_clears"
  }

  // Waiver day 1-2: higher competition
  if (waiverDay != null && waiverDay <= 2) {
    return "high_competition"
  }

  return "uncertain"
}

/**
 * Generate reasoning for waiver priority
 */
function generateWaiverReasoning(
  player: FantraxPoolPlayer,
  formScoreWithFixtures: number,
  riskAssessment: string,
  ownershipPct: number,
): string {
  const parts: string[] = []

  if (formScoreWithFixtures >= 70) {
    parts.push("Elite form")
  } else if (formScoreWithFixtures >= 60) {
    parts.push("Strong form")
  } else {
    parts.push("Decent form")
  }

  if (riskAssessment === "high_competition") {
    parts.push("high demand")
  } else if (riskAssessment === "likely_clears") {
    parts.push("low competition")
  }

  if (ownershipPct >= 20) {
    parts.push(`${ownershipPct}% rostered`)
  } else if (ownershipPct <= 5) {
    parts.push("minimal ownership")
  }

  return parts.join(", ")
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
      { error: "missing_team_id", message: "Team ID required" },
      { status: 400 },
    )
  }

  try {
    const form = await loadFantraxForm(leagueId, teamId)

    // Compute form scores for roster
    const rosterFormScores = new Map<string, FormScore>()
    for (const player of form.players) {
      const formScore = computeFormForRosterPlayer(player)
      rosterFormScores.set(player.id, formScore)
    }

    // Process waiver players
    const targets: WaiverTarget[] = []

    for (const player of form.unowned) {
      // Hard Filter 1: Must be on waivers (not FA)
      if (player.wire !== "WW") {
        continue
      }

      // Hard Filter 2: Enough signal
      if (!hasEnoughSignal(player)) {
        continue
      }

      // Hard Filter 3: SIA team exclusions
      if (isSIATeamExcluded(player.team)) {
        continue
      }

      // Compute form
      const hasRecentStarts = player.playedMinutes != null && player.playedMinutes >= 60
      const formScore = computeFormForPoolPlayer(player, hasRecentStarts)

      // Fetch fixture context
      const fixtureContext = await getFixtureContext(player.team)
      const fixtureAdjustment = fixtureContext?.difficultyAdjustment ?? 0
      const formScoreWithFixtures = formScore.score + fixtureAdjustment

      // Find drop candidate
      const dropComparison = findDropCandidate(player, form.players, rosterFormScores)

      // Skip if no drop candidate
      if (!dropComparison) {
        continue
      }

      // Hard Filter 4: Drop bans
      if (isSIADropBanned(dropComparison.player.name)) {
        continue
      }

      // Calculate ownership
      const ownershipPct = calculateOwnershipPct(player.id, form.players)

      // Assess risk
      const riskAssessment = assessRisk(ownershipPct, formScoreWithFixtures, player.waiverDay ?? null)

      // Generate reasoning
      const reasoning = generateWaiverReasoning(player, formScoreWithFixtures, riskAssessment, ownershipPct)

      // Confidence
      const hasInjuryNews = Boolean(
        player.availability === "injured" ||
          player.availability === "out" ||
          player.news,
      )
      const confidence = determineConfidence(
        formScoreWithFixtures - dropComparison.form.score,
        hasRecentStarts ? 3 : 1,
        hasInjuryNews,
      )

      const killConditions = generateKillConditions(hasInjuryNews, player.availabilityLabel)

      targets.push({
        player: {
          id: player.id,
          name: player.name,
          club: player.team,
          position: player.position,
          waiverDay: player.waiverDay ?? null,
        },
        claimPriority: 0, // Will be set after sorting
        formChip: formScore.heat,
        formScore: formScore.score,
        formScoreWithFixtures,
        fixtureContext: fixtureContext
          ? {
              bar: formatFixtureDifficultyBar(fixtureContext.next5Fixtures),
              summary: getFixtureSummary(fixtureContext),
              avgDifficulty: fixtureContext.avgDifficulty,
              adjustment: fixtureAdjustment,
            }
          : null,
        dropCandidate: {
          name: dropComparison.player.name,
          position: dropComparison.player.position,
          formChip: dropComparison.form.heat,
          formScore: dropComparison.form.score,
        },
        riskAssessment,
        ownershipPct,
        reasoning,
        confidence,
        killConditions,
      })
    }

    // Sort by priority:
    // 1. High competition players first (use top claims)
    // 2. Then by adjusted form score (desc)
    // 3. Then by waiver day (earlier = higher competition)
    targets.sort((a, b) => {
      // High competition players first
      if (a.riskAssessment === "high_competition" && b.riskAssessment !== "high_competition") return -1
      if (a.riskAssessment !== "high_competition" && b.riskAssessment === "high_competition") return 1

      // Likely clears players last
      if (a.riskAssessment === "likely_clears" && b.riskAssessment !== "likely_clears") return 1
      if (a.riskAssessment !== "likely_clears" && b.riskAssessment === "likely_clears") return -1

      // Within same risk tier, sort by form
      const formDiff = b.formScoreWithFixtures - a.formScoreWithFixtures
      if (Math.abs(formDiff) > 5) return formDiff

      // Tiebreaker: earlier waiver day = higher priority
      const waiverDayA = a.player.waiverDay ?? 999
      const waiverDayB = b.player.waiverDay ?? 999
      return waiverDayA - waiverDayB
    })

    // Assign claim priority
    targets.forEach((target, idx) => {
      target.claimPriority = idx + 1
    })

    const response: WaiversResponse = {
      leagueId: form.leagueId,
      teamId: form.teamId,
      teamName: form.teamName,
      currentPeriod: form.currentPeriod,
      targets,
    }

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    })
  } catch (error) {
    console.error("Error generating waiver recommendations:", error)
    return NextResponse.json(
      {
        error: "generation_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
