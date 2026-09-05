/**
 * Scout Waivers API — Prioritized waiver wire claim recommendations
 * 
 * GET /api/scout/waivers?leagueId=X&teamId=Y
 * 
 * Returns ranked waiver wire (WW only, not FA) targets with claim-priority fields:
 * - Claim priority ranking (1 = highest)
 * - Form scoring with fixture adjustment
 * - "Why now" reasoning
 * - Drop candidate (never banned: no Garner, Truffert, Havertz)
 * - Risk assessment
 * - Confidence + kill conditions
 * - Recent GW summary
 * 
 * Hard filters:
 * - WW only (no FA)
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
  computeStartRate,
  type HeatBucket,
  type FormScore,
} from "@/lib/form-engine"
import {
  SCOUT_DEFAULT_LEAGUE_ID,
  isSIADropBanned,
  isSIATeamExcluded,
  MIN_CURRENT_GW_PROJECTION,
  getMinFormScoreGap,
  determineConfidence,
  generateKillConditions,
  type ConfidenceLevel,
} from "@/lib/scout-config"
import {
  getFixtureContext,
  formatFixtureDifficultyBar,
  getFixtureSummary,
} from "@/lib/fixtures"

// Default SIA teamId
const DEFAULT_TEAM_ID = "yv00la6xmsxcq62w"

// ============================================================================
// Types
// ============================================================================

type RiskLevel = "low" | "medium" | "high"

interface WaiverCandidate {
  claimPriority: number // 1 = highest priority
  player: {
    id: string
    name: string
    club: string
    position: string
  }
  reasoning: string
  formChip: HeatBucket
  formScore: number
  formScoreWithFixtures: number
  recentGW: Array<number | null>
  minutesContext: string | null
  fixtureContext: {
    bar: string // e.g. "🟢🟢⚪⚫⚪"
    summary: string // e.g. "Favorable fixtures ahead"
    avgDifficulty: number
    adjustment: number // +/- points from fixtures
  } | null
  dropCandidate: {
    name: string
    position: string
    formChip: HeatBucket
    formScore: number
  } | null
  riskAssessment: {
    level: RiskLevel
    factors: string[]
  }
  confidence: ConfidenceLevel
  killConditions: string[]
  fantraxProj: number | null
}

interface WaiversResponse {
  leagueId: string
  teamId: string
  teamName: string | null
  currentPeriod: number
  waivers: WaiverCandidate[]
  debug?: {
    totalUnowned: number
    afterWWFilter: number
    afterSignalFilter: number
    afterTeamExclusionFilter: number
    afterFixtureFilter: number
    afterBenchComparisonFilter: number
    afterFormGapFilter: number
    afterDropBanFilter: number
    finalCandidates: number
    minFormScoreGap: number
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
  const recentStarts = player.minutes.slice(0, 3).map((m) => m != null && m >= 60)

  return computeFormScore({
    lastGW: recentGWs[0] ?? null,
    priorGW: recentGWs[1] ?? null,
    prior2GW: recentGWs[2] ?? null,
    minutesStability: computeMinutesStability(recentMinutes),
    startRate: computeStartRate(recentStarts),
    projBeat: false, // We don't have snapshot comparison here yet
    gameweeksSinceLastReturn: gameweeksSinceLastReturn(recentGWs),
  })
}

/**
 * Compute form score for a FantraxPoolPlayer (available/owned by others)
 */
function computeFormForPoolPlayer(player: FantraxPoolPlayer, hasRecentStarts: boolean): FormScore {
  const projectedPts = player.points ?? 0
  let estimatedLastGW = projectedPts

  if (player.playedMinutes != null && player.playedMinutes > 0) {
    estimatedLastGW = projectedPts > 0 ? projectedPts : 5
  }

  return computeFormScore({
    lastGW: estimatedLastGW > 0 ? estimatedLastGW : null,
    priorGW: null,
    prior2GW: null,
    minutesStability: player.playedMinutes && player.playedMinutes >= 60 ? 1.5 : 0.5,
    startRate: hasRecentStarts ? 0.9 : 0.5,
    projBeat: false,
    gameweeksSinceLastReturn: estimatedLastGW > 0 ? 0 : 2,
  })
}

/**
 * Check if player has enough signal to be recommended
 */
function hasEnoughSignal(player: FantraxPoolPlayer): boolean {
  if (player.points != null && player.points >= MIN_CURRENT_GW_PROJECTION) {
    return true
  }

  if (player.playedMinutes != null && player.playedMinutes >= 60) {
    return true
  }

  if (player.stats && player.stats.length > 0) {
    const hasReturns = player.stats.some((s) => ["G", "AT", "CS"].includes(s.code) && s.value > 0)
    if (hasReturns) return true
  }

  return false
}

/**
 * Generate reasoning for a waiver claim
 */
function generateReasoning(
  player: FantraxPoolPlayer,
  formScore: number,
  formGap: number,
): string {
  const reasons: string[] = []

  if (formScore >= 61) {
    reasons.push("Elite WW form")
  } else if (formScore >= 36) {
    reasons.push("Hot waiver target")
  } else if (formScore >= 16) {
    reasons.push("Emerging wire option")
  }

  if (formGap >= 20) {
    reasons.push(`+${Math.round(formGap)} over bench`)
  } else if (formGap >= 10) {
    reasons.push(`outscoring bench`)
  }

  if (player.stats) {
    const goals = player.stats.find((s) => s.code === "G")?.value ?? 0
    const assists = player.stats.find((s) => s.code === "AT")?.value ?? 0
    
    if (goals >= 2) reasons.push(`${goals}G recent`)
    if (assists >= 2) reasons.push(`${assists}A recent`)
  }

  if (player.availability === "starting") {
    reasons.push("nailed on")
  }

  if (reasons.length === 0) {
    reasons.push("Wire-available upgrade")
  }

  return reasons.slice(0, 4).join(", ")
}

/**
 * Generate minutes context string
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
 * Assess risk level for a waiver claim
 */
function assessRisk(
  player: FantraxPoolPlayer,
  hasRecentStarts: boolean,
  formGap: number,
): { level: RiskLevel; factors: string[] } {
  const factors: string[] = []
  let riskScore = 0

  // Risk factor 1: Injury/availability concerns
  if (player.availability === "injured" || player.availability === "out") {
    factors.push("Injury concern")
    riskScore += 2
  } else if (player.availability === "unknown") {
    factors.push("Availability uncertain")
    riskScore += 1
  }

  // Risk factor 2: Minutes/starts
  if (!hasRecentStarts && (!player.playedMinutes || player.playedMinutes < 60)) {
    factors.push("Limited recent minutes")
    riskScore += 2
  } else if (!hasRecentStarts) {
    factors.push("Rotation risk")
    riskScore += 1
  }

  // Risk factor 3: Small form gap
  if (formGap < 10) {
    factors.push("Marginal upgrade")
    riskScore += 1
  }

  // Risk factor 4: No projection
  if (!player.points || player.points < MIN_CURRENT_GW_PROJECTION) {
    factors.push("Low projection")
    riskScore += 1
  }

  // Mitigating factors
  if (player.availability === "starting") {
    factors.push("Expected to start (mitigates risk)")
    riskScore = Math.max(0, riskScore - 1)
  }

  if (formGap >= 20) {
    factors.push("Large form gap (mitigates risk)")
    riskScore = Math.max(0, riskScore - 1)
  }

  // Classify risk level
  let level: RiskLevel
  if (riskScore >= 4) {
    level = "high"
  } else if (riskScore >= 2) {
    level = "medium"
  } else {
    level = "low"
  }

  return {
    level,
    factors: factors.slice(0, 3),
  }
}

/**
 * Find best bench player to replace (same position, lowest form, not banned for this specific team)
 */
function findBenchPlayerToReplaceForTeam(
  availablePlayer: FantraxPoolPlayer,
  roster: FantraxPlayerSeries[],
  rosterFormScores: Map<string, FormScore>,
  teamId: string,
): { player: FantraxPlayerSeries; form: FormScore } | null {
  const availPos = availablePlayer.position.charAt(0).toUpperCase()
  
  const samePosition = roster.filter((p) => {
    const rosterPos = p.position.charAt(0).toUpperCase()
    return availPos === rosterPos
  })

  if (samePosition.length === 0) return null

  // Find bench players (exclude drop-banned players for this specific team)
  const validBenchCandidates = samePosition
    .filter((p) => !isSIADropBanned(p.name, teamId))
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

  return validBenchCandidates[0] ?? null
}

// ============================================================================
// Main Handler
// ============================================================================

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const leagueId = parseLeagueId(searchParams.get("leagueId") ?? "") || SCOUT_DEFAULT_LEAGUE_ID
  const teamId = searchParams.get("teamId")?.trim() || DEFAULT_TEAM_ID

  if (!leagueId) {
    return NextResponse.json(
      { error: "missing_league_id", message: "League ID required" },
      { status: 400 },
    )
  }

  if (!teamId) {
    return NextResponse.json(
      { error: "missing_team_id", message: "Team ID required for personalized waiver recommendations" },
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

    const minFormScoreGap = getMinFormScoreGap(form.currentPeriod)

    const debug = {
      totalUnowned: form.unowned.length,
      afterWWFilter: 0,
      afterSignalFilter: 0,
      afterTeamExclusionFilter: 0,
      afterFixtureFilter: 0,
      afterBenchComparisonFilter: 0,
      afterFormGapFilter: 0,
      afterDropBanFilter: 0,
      finalCandidates: 0,
      minFormScoreGap,
    }

    const candidates: WaiverCandidate[] = []

    for (const player of form.unowned) {
      // Hard Filter 1: WW ONLY (not FA)
      if (player.wire !== "WW") {
        continue
      }
      debug.afterWWFilter++

      // Hard Filter 2: Enough signal
      if (!hasEnoughSignal(player)) {
        continue
      }
      debug.afterSignalFilter++

      // Hard Filter 3: Team exclusions (SIA-specific: no Arsenal)
      if (isSIATeamExcluded(player.team, teamId)) {
        continue
      }
      debug.afterTeamExclusionFilter++

      // Compute form score
      const hasRecentStarts = player.playedMinutes != null && player.playedMinutes >= 60
      const formScore = computeFormForPoolPlayer(player, hasRecentStarts)

      // Fetch fixture context
      const fixtureContext = await getFixtureContext(player.team)
      const fixtureAdjustment = fixtureContext?.difficultyAdjustment ?? 0
      const formScoreWithFixtures = formScore.score + fixtureAdjustment
      debug.afterFixtureFilter++

      // Hard Filter 4: Must have a valid drop candidate (not banned for this team)
      const benchComparison = findBenchPlayerToReplaceForTeam(player, form.players, rosterFormScores, teamId)

      if (!benchComparison) {
        continue
      }
      debug.afterBenchComparisonFilter++

      // Hard Filter 5: Must beat bench player by minimum gap
      const formGap = formScoreWithFixtures - benchComparison.form.score
      if (formGap < minFormScoreGap) {
        continue
      }
      debug.afterFormGapFilter++

      // Hard Filter 6: Double-check drop candidate is not banned for this team
      if (isSIADropBanned(benchComparison.player.name, teamId)) {
        continue
      }
      debug.afterDropBanFilter++

      // Generate claim fields
      const reasoning = generateReasoning(player, formScore.score, formGap)
      const minutesContext = generateMinutesContext(player)
      const riskAssessment = assessRisk(player, hasRecentStarts, formGap)
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
        claimPriority: 0, // Will be set during ranking
        player: {
          id: player.id,
          name: player.name,
          club: player.team,
          position: player.position,
        },
        reasoning,
        formChip: formScore.heat,
        formScore: formScore.score,
        formScoreWithFixtures,
        recentGW: [player.points],
        minutesContext,
        fixtureContext: fixtureContext
          ? {
              bar: formatFixtureDifficultyBar(fixtureContext.next5Fixtures),
              summary: getFixtureSummary(fixtureContext),
              avgDifficulty: fixtureContext.avgDifficulty,
              adjustment: fixtureAdjustment,
            }
          : null,
        dropCandidate: {
          name: benchComparison.player.name,
          position: benchComparison.player.position,
          formChip: benchComparison.form.heat,
          formScore: benchComparison.form.score,
        },
        riskAssessment,
        confidence,
        killConditions,
        fantraxProj: player.points,
      })
    }

    // Rank by adjusted form gap (desc), assign claim priorities
    candidates.sort((a, b) => {
      const gapA = a.formScoreWithFixtures - (a.dropCandidate?.formScore ?? 0)
      const gapB = b.formScoreWithFixtures - (b.dropCandidate?.formScore ?? 0)
      
      if (Math.abs(gapA - gapB) > 5) return gapB - gapA
      
      // Tiebreaker: confidence (high > medium > low)
      const confidenceOrder = { high: 3, medium: 2, low: 1 }
      const confA = confidenceOrder[a.confidence]
      const confB = confidenceOrder[b.confidence]
      if (confA !== confB) return confB - confA

      // Final tiebreaker: alphabetical
      return a.player.name.localeCompare(b.player.name)
    })

    // Assign claim priorities (1 = highest)
    candidates.forEach((candidate, index) => {
      candidate.claimPriority = index + 1
    })

    debug.finalCandidates = candidates.length

    console.log("Scout waivers debug:", {
      teamId,
      teamName: form.teamName || "(no team name)",
      ...debug,
    })

    const response: WaiversResponse = {
      leagueId: form.leagueId,
      teamId: teamId, // Use the validated teamId from params
      teamName: form.teamName,
      currentPeriod: form.currentPeriod,
      waivers: candidates,
      debug,
    }

    return NextResponse.json(response, {
      headers: {
        "cache-control": "s-maxage=300, stale-while-revalidate=600",
      },
    })
  } catch (err) {
    console.error("Scout waivers error:", err)
    const message = err instanceof Error ? err.message : "Failed to load waiver recommendations"
    return NextResponse.json(
      { error: "scout_waivers_failed", message },
      { status: 502 },
    )
  }
}
