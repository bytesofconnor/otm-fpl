/**
 * Form Engine — Scout's transparent form-scoring model
 * 
 * Computes continuous form scores (0-100) from recent Fantrax points, minutes, starts,
 * and surprise bumps when players beat projections. Then buckets into heat levels.
 * 
 * Season 1: Rule-based, transparent scoring (no black-box ML)
 * Future: Incorporate opponent strength, home/away splits, fixture congestion
 */

// ============================================================================
// Types
// ============================================================================

export type HeatBucket = "cold" | "warm" | "hot" | "fire" | "burning"

export interface FormInput {
  /** FPts from most recent finished gameweek */
  lastGW: number | null
  /** FPts from 2 gameweeks ago */
  priorGW: number | null
  /** FPts from 3 gameweeks ago */
  prior2GW: number | null
  /** Proportion of recent games with 60+ minutes (0-1) */
  minutesStability: number
  /** Proportion of recent games started (0-1) */
  startRate: number
  /** Did recent actual beat frozen projection? */
  projBeat: boolean
  /** Gameweeks since last return (for decay) */
  gameweeksSinceLastReturn: number
}

export interface FormScore {
  /** Final form score (0-100) */
  score: number
  /** Heat bucket classification */
  heat: HeatBucket
  /** Breakdown of score components (for transparency) */
  breakdown: {
    baseScore: number
    minutesBonus: number
    surpriseBonus: number
    decayFactor: number
  }
}

// ============================================================================
// Constants
// ============================================================================

/** Weight for most recent GW */
const LAST_GW_WEIGHT = 3.0

/** Weight for 2 GW ago */
const PRIOR_GW_WEIGHT = 1.5

/** Weight for 3 GW ago */
const PRIOR2_GW_WEIGHT = 0.5

/** Minutes stability bonus multiplier */
const MINUTES_STABILITY_MULTIPLIER = 8

/** Start rate bonus multiplier */
const START_RATE_MULTIPLIER = 6

/** Bonus for beating frozen projection */
const SURPRISE_BONUS = 5

/** Decay half-life in gameweeks (score decays to 0 after 4 GW with no returns) */
const DECAY_HALF_LIFE_GW = 4

/** Heat bucket thresholds */
const HEAT_THRESHOLDS = {
  cold: { min: 0, max: 15 },
  warm: { min: 16, max: 35 },
  hot: { min: 36, max: 60 },
  fire: { min: 61, max: 80 },
  burning: { min: 81, max: 100 },
} as const

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Clamp a number between min and max (inclusive)
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Compute continuous form score (0-100) from recent Fantrax data
 * 
 * Formula (Season 1):
 * - baseScore = (lastGW * 3.0) + (priorGW * 1.5) + (prior2GW * 0.5)
 * - minutesBonus = (minutesStability * 8) + (startRate * 6)
 * - surpriseBonus = projBeat ? 5 : 0
 * - decayFactor = max(0, 1 - (gameweeksSinceLastReturn / 4))
 * - formScore = (baseScore + minutesBonus + surpriseBonus) * decayFactor
 * 
 * @param input Recent Fantrax data for a player
 * @returns Form score with breakdown
 */
export function computeFormScore(input: FormInput): FormScore {
  // Base score: weighted recent FPts
  const lastGWPts = input.lastGW ?? 0
  const priorGWPts = input.priorGW ?? 0
  const prior2GWPts = input.prior2GW ?? 0

  const baseScore = 
    (lastGWPts * LAST_GW_WEIGHT) +
    (priorGWPts * PRIOR_GW_WEIGHT) +
    (prior2GWPts * PRIOR2_GW_WEIGHT)

  // Minutes bonus: stability + start rate
  const minutesStability = clamp(input.minutesStability, 0, 1)
  const startRate = clamp(input.startRate, 0, 1)

  const minutesBonus = 
    (minutesStability * MINUTES_STABILITY_MULTIPLIER) +
    (startRate * START_RATE_MULTIPLIER)

  // Surprise bonus: beat projection
  const surpriseBonus = input.projBeat ? SURPRISE_BONUS : 0

  // Decay factor: prevent one boom from lasting forever
  // After 4 GW with no returns, score decays to 0
  const gameweeksSinceReturn = Math.max(0, input.gameweeksSinceLastReturn)
  const decayFactor = Math.max(0, 1 - (gameweeksSinceReturn / DECAY_HALF_LIFE_GW))

  // Final score: (base + bonuses) * decay, clamped to 0-100
  const rawScore = (baseScore + minutesBonus + surpriseBonus) * decayFactor
  const score = clamp(Math.round(rawScore * 10) / 10, 0, 100)

  // Classify into heat bucket
  const heat = formScoreToHeat(score)

  return {
    score,
    heat,
    breakdown: {
      baseScore: Math.round(baseScore * 10) / 10,
      minutesBonus: Math.round(minutesBonus * 10) / 10,
      surpriseBonus,
      decayFactor: Math.round(decayFactor * 100) / 100,
    },
  }
}

/**
 * Convert continuous form score to heat bucket classification
 * 
 * Buckets:
 * - Cold (0-15): Injured, benched, or no returns
 * - Warm (16-35): Occasional returns, uncertain minutes
 * - Hot (36-60): Reliable starter, recent returns
 * - Fire (61-80): Multi-returns or clean sheet lock
 * - Burning (81-100): Elite form + high ceiling
 * 
 * @param score Form score (0-100)
 * @returns Heat bucket classification
 */
export function formScoreToHeat(score: number): HeatBucket {
  const clamped = clamp(score, 0, 100)

  if (clamped >= HEAT_THRESHOLDS.burning.min) return "burning"
  if (clamped >= HEAT_THRESHOLDS.fire.min) return "fire"
  if (clamped >= HEAT_THRESHOLDS.hot.min) return "hot"
  if (clamped >= HEAT_THRESHOLDS.warm.min) return "warm"
  return "cold"
}

/**
 * Get display label for heat bucket
 */
export function heatLabel(heat: HeatBucket): string {
  const labels: Record<HeatBucket, string> = {
    cold: "Cold",
    warm: "Warm",
    hot: "Hot",
    fire: "Fire",
    burning: "Burning",
  }
  return labels[heat]
}

/**
 * Get emoji indicator for heat bucket
 */
export function heatEmoji(heat: HeatBucket): string {
  const emojis: Record<HeatBucket, string> = {
    cold: "❄️",
    warm: "🌤️",
    hot: "🔥",
    fire: "🔥🔥",
    burning: "🔥🔥🔥",
  }
  return emojis[heat]
}

/**
 * Get Tailwind color class for heat bucket
 */
export function heatColor(heat: HeatBucket): string {
  const colors: Record<HeatBucket, string> = {
    cold: "text-blue-500",
    warm: "text-yellow-500",
    hot: "text-orange-500",
    fire: "text-red-500",
    burning: "text-purple-500",
  }
  return colors[heat]
}

/**
 * Get Tailwind background color class for heat bucket
 */
export function heatBgColor(heat: HeatBucket): string {
  const colors: Record<HeatBucket, string> = {
    cold: "bg-blue-500/10",
    warm: "bg-yellow-500/10",
    hot: "bg-orange-500/10",
    fire: "bg-red-500/10",
    burning: "bg-purple-500/10",
  }
  return colors[heat]
}

// ============================================================================
// Convenience Helpers
// ============================================================================

/**
 * Compute form score for a player with default/fallback values
 * 
 * Useful when you don't have all data points (e.g., minutes not available yet)
 */
export function computeFormScoreSimple(options: {
  lastGW?: number | null
  priorGW?: number | null
  prior2GW?: number | null
  minutesStability?: number
  startRate?: number
  projBeat?: boolean
}): FormScore {
  const input: FormInput = {
    lastGW: options.lastGW ?? null,
    priorGW: options.priorGW ?? null,
    prior2GW: options.prior2GW ?? null,
    minutesStability: options.minutesStability ?? 0.5, // assume moderate
    startRate: options.startRate ?? 0.5, // assume moderate
    projBeat: options.projBeat ?? false,
    gameweeksSinceLastReturn: 0, // assume recent return
  }
  return computeFormScore(input)
}

/**
 * Helper to compute gameweeks since last return from a list of recent FPts
 * 
 * @param recentGWs Array of FPts from recent gameweeks (newest first)
 * @returns Gameweeks since last return (0 if last GW had returns)
 */
export function gameweeksSinceLastReturn(recentGWs: Array<number | null>): number {
  for (let i = 0; i < recentGWs.length; i++) {
    const pts = recentGWs[i]
    if (pts != null && pts >= 0.5) {
      return i
    }
  }
  return recentGWs.length // All GWs had no returns
}

/**
 * Helper to compute minutes stability from a list of recent minutes
 * 
 * @param recentMinutes Array of minutes from recent gameweeks
 * @returns Proportion of games with 60+ minutes (0-1)
 */
export function computeMinutesStability(recentMinutes: Array<number | null>): number {
  const validGames = recentMinutes.filter((m) => m != null)
  if (validGames.length === 0) return 0

  const games60Plus = validGames.filter((m) => m! >= 60).length
  return games60Plus / validGames.length
}

/**
 * Helper to compute start rate from a list of recent starts
 * 
 * @param recentStarts Array of booleans (true = started) from recent gameweeks
 * @returns Proportion of games started (0-1)
 */
export function computeStartRate(recentStarts: Array<boolean | null>): number {
  const validGames = recentStarts.filter((s) => s != null)
  if (validGames.length === 0) return 0

  const starts = validGames.filter((s) => s === true).length
  return starts / validGames.length
}
