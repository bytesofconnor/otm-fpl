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

export type WeekChrome = {
  badge: "live" | "final" | null
  label: "Live" | "Final" | "Projected"
  showActuals: boolean
  showProjLine: boolean
}

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

export function currentPeriodNumber(periods: unknown, now = Date.now()): number | null {
  const list = scoringPeriodsFrom(periods)
  if (!list.length) return null
  const started = list.filter((p) => now >= p.start)
  if (started.length) return started[started.length - 1].number
  return list[0]?.number ?? null
}

function remaining(projected: number | null, scored: number | null): number | null {
  if (projected == null || scored == null) return null
  return Math.max(0, Math.round((projected - scored) * 10) / 10)
}

function sideDone(projected: number | null, scored: number | null): boolean {
  const left = remaining(projected, scored)
  if (left != null) return left <= 0.05
  if (projected == null) return (scored ?? 0) > 0
  return false
}

export function weekPhase(games: SlateScore[]): WeekPhase {
  if (!games.length) return "pre"
  const anyPlay = games.some((g) => (g.homeScore ?? 0) > 0 || (g.awayScore ?? 0) > 0)
  if (!anyPlay) return "pre"
  const allFinal = games.every((g) => sideDone(g.homeProjected, g.homeScore) && sideDone(g.awayProjected, g.awayScore))
  return allFinal ? "final" : "live"
}

export function weekChrome(phase: WeekPhase, isCurrentWeek: boolean): WeekChrome {
  if (phase === "final" || (phase === "live" && !isCurrentWeek)) {
    return { badge: "final", label: "Final", showActuals: true, showProjLine: false }
  }
  if (phase === "live" && isCurrentWeek) {
    return { badge: "live", label: "Live", showActuals: true, showProjLine: true }
  }
  return { badge: null, label: "Projected", showActuals: false, showProjLine: false }
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

export function remainingLeft(projected: number | null, scored: number | null): number {
  return remaining(projected, scored) ?? 0
}
