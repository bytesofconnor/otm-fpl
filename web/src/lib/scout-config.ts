/**
 * Scout Configuration — SIA preferences, drop bans, and hard filters
 * 
 * These constants encode business rules for Scout recommendations.
 */

import { OTM_LEAGUE_ID } from "./fantrax-shared"

// ============================================================================
// SIA (Saints Intelligence Agency) Configuration
// ============================================================================

/**
 * Over the Moon league ID (default for Scout)
 */
export const SCOUT_DEFAULT_LEAGUE_ID = OTM_LEAGUE_ID

/**
 * SIA team ID in Over the Moon league
 * TODO: This needs to be discovered from Fantrax API or configured
 * For now, we'll accept it as a query parameter
 */
export const SIA_TEAM_ID: string | null = null // Will be passed as param

/**
 * Players that SIA should NEVER be recommended to drop
 * These are long-term holds regardless of form
 */
export const SIA_DROP_BANS = new Set([
  "Garner",
  "Truffert",
  "Havertz",
])

/**
 * Check if a player is on SIA's drop ban list
 */
export function isSIADropBanned(playerName: string): boolean {
  // Normalize: check if any banned name is contained in the player name
  // (handles variations like "James Garner" vs "Garner")
  const normalized = playerName.toLowerCase().trim()
  for (const banned of SIA_DROP_BANS) {
    if (normalized.includes(banned.toLowerCase())) {
      return true
    }
  }
  return false
}

/**
 * Teams that SIA prefers not to add players from
 * Currently: No Arsenal inbound players
 */
export const SIA_TEAM_EXCLUSIONS = new Set([
  "ARS",  // Arsenal
])

/**
 * Check if a player's team is excluded for SIA
 */
export function isSIATeamExcluded(teamShortName: string): boolean {
  return SIA_TEAM_EXCLUSIONS.has(teamShortName.toUpperCase())
}

// ============================================================================
// Signal Thresholds
// ============================================================================

/**
 * Minimum recent FPts to be considered for recommendations
 * Sum of last 3 GW should be >= this threshold
 */
export const MIN_RECENT_FPTS_THRESHOLD = 8

/**
 * Minimum starts in recent games to be considered
 * At least this many starts in last 3-4 games
 */
export const MIN_RECENT_STARTS = 2

/**
 * Minimum current GW projection to be considered (if no recent actuals)
 */
export const MIN_CURRENT_GW_PROJECTION = 6

/**
 * Minimum form score gap to recommend a pickup over a bench player
 * Available player must score at least this much higher than bench
 * Lowered from 10 to 5 for early-season viability when data is thin
 */
export const MIN_FORM_SCORE_GAP = 5

// ============================================================================
// Display Limits
// ============================================================================

/**
 * Maximum opportunities to show per position
 */
export const MAX_OPPORTUNITIES_PER_POSITION = 10

/**
 * Maximum opportunities to show in total (all positions)
 */
export const MAX_OPPORTUNITIES_TOTAL = 40

// ============================================================================
// Confidence Thresholds
// ============================================================================

export type ConfidenceLevel = "low" | "medium" | "high"

/**
 * Determine confidence level based on form score gap and other factors
 */
export function determineConfidence(
  formScoreGap: number,
  recentStarts: number,
  hasInjuryNews: boolean,
): ConfidenceLevel {
  // Low confidence: injury news, low starts, or small gap
  if (hasInjuryNews || recentStarts < 2 || formScoreGap < 10) {
    return "low"
  }
  
  // High confidence: large gap, consistent starts, no concerns
  if (formScoreGap >= 20 && recentStarts >= 3) {
    return "high"
  }
  
  // Medium confidence: everything else
  return "medium"
}

/**
 * Generate kill conditions for a recommendation
 */
export function generateKillConditions(
  hasInjuryNews: boolean,
  availability?: string,
): string[] {
  const conditions: string[] = []
  
  if (hasInjuryNews || availability === "injured" || availability === "out") {
    conditions.push("Skip if injury news worsens pre-GW")
  }
  
  if (availability !== "starting") {
    conditions.push("Skip if not in predicted XI 1hr before kickoff")
  }
  
  if (!hasInjuryNews && availability === "starting") {
    conditions.push("Skip if benched unexpectedly or manager rotation comments")
  }
  
  // Always include general condition
  if (conditions.length === 0) {
    conditions.push("Monitor team news pre-GW for rotation or injury")
  }
  
  return conditions.slice(0, 3) // Max 3 kill conditions
}
