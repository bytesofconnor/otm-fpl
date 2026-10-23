export type ScoringPeriod = {
  number: number
  start: number
  end: number
}

export type SlateScore = {
  homeScore: number | null
  awayScore: number | null
  homeProjected: number | null
  awayProjected: number | null
}

export type WeekPhase = "pre" | "live" | "final"

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function str(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value)
}

export function parsePeriodDate(value: unknown): number | null {
  const s = str(value)
  if (!s) return null
  const normalized = s.replace(/\.0([+-])/, "$1").replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
  const ms = Date.parse(normalized)
  return Number.isFinite(ms) ? ms : null
}

export function scoringPeriodsFrom(periods: unknown): ScoringPeriod[] {
  return asArray(periods)
    .map((row) => {
      const rec = asRecord(row)
      if (!rec) return null
      const number = num(rec.number ?? rec.period)
      const start = parsePeriodDate(rec.startDate)
      const end = parsePeriodDate(rec.endDate)
      if (number == null || start == null || end == null) return null
      return { number, start, end }
    })
    .filter((row): row is ScoringPeriod => row != null)
    .sort((a, b) => a.number - b.number)
}

/**
 * Current Fantrax scoring period. Today this is the first window that still contains `now`.
 * Overlapping start/end days therefore stay on the earlier GW.
 */
export function currentPeriodNumber(periods: unknown, now = Date.now()): number | null {
  const list = scoringPeriodsFrom(periods)
  if (!list.length) return null
  const live = list.find((p) => now >= p.start && now <= p.end)
  if (live) return live.number
  const upcoming = list.find((p) => now < p.start)
  if (upcoming) return upcoming.number
  return list[list.length - 1]?.number ?? null
}

function remaining(projected: number | null, scored: number | null): number | null {
  if (projected == null || scored == null) return null
  return Math.max(0, Math.round((projected - scored) * 10) / 10)
}

export function weekPhase(games: SlateScore[]): WeekPhase {
  const started = games.some((g) => (g.homeScore ?? 0) > 0 || (g.awayScore ?? 0) > 0)
  return started ? "live" : "pre"
}

export type WeekChrome = {
  badge: "live" | "final" | null
  label: "Live" | "Final" | "Projected"
  showActuals: boolean
  showProjLine: boolean
}

/**
 * Badge and score chrome. Today LIVE stays on after the slate is done,
 * because weekPhase never returns "final".
 */
export function weekChrome(phase: WeekPhase, isCurrentWeek: boolean): WeekChrome {
  const live = phase === "live" && isCurrentWeek
  return {
    badge: live ? "live" : null,
    label: live ? "Live" : "Projected",
    showActuals: phase === "live",
    showProjLine: live,
  }
}

export function weekPhaseFromSnapshot(
  slate: Array<{
    homeScore: string | null
    awayScore: string | null
    homeProjected: string | null
    awayProjected: string | null
  }>,
  matchup: {
    homeScore: string | null
    awayScore: string | null
    homeProjected: string | null
    awayProjected: string | null
  } | null,
): WeekPhase {
  const games = slateScoresFrom(slate)
  if (games.length) return weekPhase(games)
  if (!matchup) return "pre"
  return weekPhase(slateScoresFrom([matchup]))
}

export function slateScoresFrom(games: Array<{
  homeScore: string | null
  awayScore: string | null
  homeProjected: string | null
  awayProjected: string | null
}>): SlateScore[] {
  return games.map((g) => ({
    homeScore: num(g.homeScore),
    awayScore: num(g.awayScore),
    homeProjected: num(g.homeProjected),
    awayProjected: num(g.awayProjected),
  }))
}

export function remainingLeft(projected: number | null, scored: number | null): number {
  return remaining(projected, scored) ?? 0
}
