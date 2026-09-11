// Description: Shared Fantrax types and league-ID parsing used by client and server.

/** Over the Moon FPL — the league this companion is built for. Shared links load it with no connect step. */
export const OTM_LEAGUE_ID = "8rnibtdamsxcq60v"
export const OTM_LEAGUE_NAME = "Over the Moon"

/** Browser storage for the connected Fantrax league and squad. Shared by League, Form, and Scout. */
export const LEAGUE_STORAGE_KEY = "otm_fantrax_league_id"
export const TEAM_STORAGE_KEY = "otm_fantrax_team_id"
export const TEAM_NAME_STORAGE_KEY = "otm_fantrax_team_name"
export const TEAM_SHORT_STORAGE_KEY = "otm_fantrax_team_short"
export const MEMBERSHIP_EVENT = "otm-membership"

export type PlayerAvailability = "starting" | "expected" | "out" | "injured" | "unknown"

export type FantraxStat = {
  code: string
  value: number
}

export type FantraxRosterPlayer = {
  id: string
  name: string
  shortName?: string
  position: string
  team: string
  /** Points actually scored this week. */
  points: number | null
  /** Fantrax weekly expected total. Collapses to `points` once the fixture is done. */
  projected?: number | null
  minutes: number | null
  status?: string
  opponent?: string
  kickoff?: string
  fixtureFinished?: boolean
  availability?: PlayerAvailability
  availabilityLabel?: string
  news?: string
  headshotUrl?: string
  stats?: FantraxStat[]
}

export type FantraxMatchupLine = {
  position: string
  home: FantraxRosterPlayer | null
  away: FantraxRosterPlayer | null
}

export type FantraxTeam = {
  id: string
  name: string
  shortName?: string
  logoUrl?: string
  owner?: string
}

export type FantraxStanding = {
  rank: number
  teamId: string
  teamName: string
  record: string
  points: string
  you: boolean
  logoUrl?: string
  shortName?: string
}

export type FantraxSlateGame = {
  home: string
  away: string
  homeId: string
  awayId: string
  homeProjected: string | null
  awayProjected: string | null
  homeScore: string | null
  awayScore: string | null
  homeOptimal: string | null
  awayOptimal: string | null
  yours: boolean
}

export type FantraxMatchup = {
  home: string
  away: string
  homeId: string
  awayId: string
  homeScore: string | null
  awayScore: string | null
  homeProjected: string | null
  awayProjected: string | null
  homeOptimal: string | null
  awayOptimal: string | null
  homeOwner?: string
  awayOwner?: string
  homeLogo?: string
  awayLogo?: string
  homeShort?: string
  awayShort?: string
  homeBench: FantraxRosterPlayer[]
  awayBench: FantraxRosterPlayer[]
  period: number
  periodLabel: string
  lines: FantraxMatchupLine[]
}

export type FantraxTransaction = {
  id: string
  teamName: string
  teamId: string
  playerName: string
  playerTeam: string
  kind: "claim" | "drop"
  date: string
}

export type FantraxDraftPick = {
  round: number
  pick: number
  teamId: string
  teamName: string
  playerName: string
  playerTeam: string
  position: string
}

export type FantraxScoringChip = {
  code: string
  value: string
}

export type FantraxFormPoint = {
  period: number
  value: number | null
  projected: boolean
  /** Points actually scored this week. Null if Fantrax has not posted a live total. */
  live?: number | null
  /** Fantrax weekly (or cumulative) projection, independent of live scoring. */
  forecast?: number | null
}

export type FantraxManagerSeries = {
  teamId: string
  name: string
  shortName?: string
  /** Fantrax owner handle — the name people actually recognize. */
  owner?: string
  you: boolean
  points: FantraxFormPoint[]
  cumulative: FantraxFormPoint[]
}

export type FantraxPlayerSeries = {
  id: string
  name: string
  team: string
  position: string
  status?: string
  points: FantraxFormPoint[]
  minutes: Array<number | null>
  opponent?: string
  kickoff?: string
  availability?: PlayerAvailability
  availabilityLabel?: string
  playedMinutes?: number | null
  chance?: number | null
}

export type FantraxPoolPlayer = {
  id: string
  name: string
  team: string
  position: string
  points: number | null
  live?: number | null
  ownerTeamId?: string
  ownerName?: string
  ownerShort?: string
  wire?: "FA" | "WW"
  stats?: FantraxStat[]
  chance?: number | null
  playedMinutes?: number | null
  availability?: PlayerAvailability
  availabilityLabel?: string
  news?: string
  pickup?: number
  headshotUrl?: string
  /** Club badge from Fantrax. Always present; `headshotUrl` may be a player portrait. */
  crestUrl?: string
  season?: {
    goals: number
    assists: number
    cleanSheets: number
    minutes: number
    saves: number
  }
  /** Returns from one fixture this gameweek. Never season totals. */
  lastMatch?: {
    goals: number
    assists: number
    cleanSheets: number
    saves: number
    minutes: number
  } | null
  /** Scored / projected FPts by Fantrax scoring period. */
  weeks?: PlayerWeekPts[]
  /** Fantrax year-to-date FPts. Used for Total, never as a single GW. */
  seasonFpts?: number | null
}

export type PlayerWeekPts = {
  period: number
  projected: number | null
  scored: number | null
}

export function playerSeasonFpts(player: FantraxPoolPlayer): number | null {
  if (player.seasonFpts != null && Number.isFinite(player.seasonFpts)) return player.seasonFpts
  const weeks = player.weeks ?? []
  let sum = 0
  let any = false
  for (const week of weeks) {
    const value = week.scored ?? week.projected
    if (value == null) continue
    sum += value
    any = true
  }
  return any ? Math.round(sum * 10) / 10 : null
}

export function playerWeekPts(
  player: FantraxPoolPlayer,
  period: number,
  currentPeriod: number,
): PlayerWeekPts {
  const hit = player.weeks?.find((row) => row.period === period)
  if (hit) return hit
  if (period === currentPeriod) {
    return { period, projected: player.points, scored: player.live ?? null }
  }
  return { period, projected: null, scored: null }
}

/**
 * What to show on a GW bar. Once they have played this fixture, leftover is 0 —
 * a stale pre-match projection is not "still coming". Unplayed players keep the
 * projection as faint +n and sort on that number.
 */
export function weekBar(
  player: FantraxPoolPlayer,
  week: PlayerWeekPts,
): { scored: number | null; forecast: number | null } {
  const scored = week.scored
  const appeared = (player.lastMatch?.minutes ?? 0) > 0
  if (appeared) {
    return { scored, forecast: scored }
  }
  if (scored != null && scored > 0) {
    const left = remainingPts(week.projected, scored)
    if (left > 6) return { scored, forecast: scored }
    return { scored, forecast: week.projected ?? scored }
  }
  return { scored, forecast: week.projected ?? scored }
}

export function weekPending(player: FantraxPoolPlayer, week: PlayerWeekPts, weekDone = false): boolean {
  if (weekDone) return false
  if ((player.lastMatch?.minutes ?? 0) > 0) return false
  return week.scored == null || week.scored === 0
}

export type FantraxFormNews = {
  playerId: string
  name: string
  team: string
  position: string
  source: "fpl" | "fantrax"
  headline: string
  chance: number | null
  minutes: number | null
  availability?: PlayerAvailability
  availabilityLabel?: string
}

export type FantraxFormSnapshot = {
  leagueId: string
  leagueName: string
  teamId: string | null
  teamName: string | null
  currentPeriod: number
  /** FPL says this Fantrax period's fixtures are finished. */
  periodFinished: boolean
  windowStart: number
  windowEnd: number
  managers: FantraxManagerSeries[]
  players: FantraxPlayerSeries[]
  leagueOwned: FantraxPoolPlayer[]
  unowned: FantraxPoolPlayer[]
  news: FantraxFormNews[]
}

export type FantraxLeagueSnapshot = {
  leagueId: string
  leagueName: string
  scoringType: string | null
  teamCount: number
  currentPeriod: number | null
  viewedPeriod: number | null
  periodCount: number
  periodLabel: string
  salaryCap: number | null
  draftType: string | null
  draftState: string | null
  liveStarted: boolean
  teams: FantraxTeam[]
  standings: FantraxStanding[]
  matchup: FantraxMatchup | null
  roster: FantraxRosterPlayer[]
  waivers: FantraxRosterPlayer[]
  slate: FantraxSlateGame[]
  transactions: FantraxTransaction[]
  draftPicks: FantraxDraftPick[]
  scoringChips: FantraxScoringChip[]
}

/**
 * Compact axis/legend code for a manager name when Fantrax has no shortName.
 */
export function teamCode(name: string, shortName?: string | null): string {
  const given = shortName?.trim()
  if (given && given.length <= 6) return given
  const words = name
    .replace(/['’.]/g, "")
    .split(/[\s-]+/)
    .filter((w) => w && !/^(the|fc|and|of)$/i.test(w))
  if (words.length >= 2) return words.map((w) => w[0]).join("").slice(0, 4).toUpperCase()
  return (words[0] ?? name).slice(0, 4).toUpperCase()
}

/** Owner handle if Fantrax has one, otherwise the team name — never the cryptic code. */
export function managerChip(
  manager: { owner?: string | null; name: string; teamId?: string },
  league?: Array<{ owner?: string | null; teamId?: string }>,
): string {
  const owner = manager.owner?.trim()
  if (!owner) return manager.name
  const twins = league?.filter((row) => row.owner?.trim() === owner).length ?? 0
  if (twins > 1) {
    const tag = manager.name.replace(/^The\s+/i, "").split(/[\s'-]+/).filter(Boolean)[0]
    if (tag && tag.toLowerCase() !== owner.toLowerCase()) return `${owner} · ${tag}`
  }
  return owner
}

/** Filter chip: lowercase fantasy team name. Owner only if two squads share the name. */
export function managerFilterLabel(
  manager: { owner?: string | null; name: string; shortName?: string },
  league?: Array<{ name: string }>,
): string {
  const full = manager.name.replace(/\s+/g, " ").trim().toLowerCase()
  const twins = league?.filter((row) => row.name.replace(/\s+/g, " ").trim().toLowerCase() === full).length ?? 0
  const owner = manager.owner?.replace(/\s+/g, " ").trim().toLowerCase()
  const short = manager.shortName?.replace(/\s+/g, " ").trim().toLowerCase()
  if (short && short !== full && !full.includes(short)) return `${short} (${full})`
  if (twins > 1 && owner && owner !== full) return `${full} (${owner})`
  return full
}

/**
 * What's still in this week: weekly expected total minus scored. Zero once Fantrax has collapsed the projection.
 */
export function remainingPts(
  projected: number | null | undefined,
  scored: number | null | undefined,
): number {
  if (projected == null) return 0
  const live = scored ?? 0
  return Math.max(0, Math.round((projected - live) * 10) / 10)
}

/** Absurd for one Fantrax GW. Season YTD dumps sit well above this. */
export const MAX_WEEK_FPTS = 55

export function asThisWeekFpts(
  pts: number | null | undefined,
  seasonYtd?: number | null,
  _period?: number,
  currentPeriod?: number,
): number | null {
  if (pts == null || !Number.isFinite(pts) || pts < 0 || pts > MAX_WEEK_FPTS) return null
  if (
    seasonYtd != null &&
    currentPeriod != null &&
    currentPeriod > 1 &&
    Math.abs(pts - seasonYtd) < 0.08
  ) {
    return null
  }
  return pts
}

/** When Fantrax omits a GW (or returns YTD), fill the hole from season minus the other weeks. */
export function withDerivedWeekScores(
  weeks: PlayerWeekPts[],
  seasonFpts: number | null,
): PlayerWeekPts[] {
  if (seasonFpts == null || !weeks.length) return weeks
  const next = weeks.map((week) => ({ ...week }))
  const fill = (week: PlayerWeekPts, derived: number) => {
    if (derived < -0.2 || derived > MAX_WEEK_FPTS) return
    week.scored = Math.max(0, Math.round(derived * 10) / 10)
  }
  const missing = next.filter((week) => week.scored == null)
  if (missing.length === 1) {
    const known = next.reduce((sum, week) => sum + (week.scored ?? 0), 0)
    fill(missing[0], seasonFpts - known)
    return next
  }
  const latest = Math.max(...next.map((week) => week.period))
  const hole = next.find((week) => week.period === latest)
  if (hole && hole.scored == null && next.every((week) => week.period === latest || week.scored != null)) {
    const prior = next.reduce((sum, week) => sum + (week.period < latest ? (week.scored ?? 0) : 0), 0)
    fill(hole, seasonFpts - prior)
  }
  return next
}

export function asWeeklyLive(
  live: number | null | undefined,
  weekly: number | null | undefined,
): number | null {
  if (live == null) return null
  if (asThisWeekFpts(live) == null) return null
  if (weekly != null && weekly <= 22 && live > Math.max(weekly * 1.85, weekly + 8) && live > 16) {
    return null
  }
  return live
}

/** Points to rank this week: scored if it's actually a GW total, otherwise the weekly projection. */
export function weekFpts(player: { points: number | null; live?: number | null }): number | null {
  return asWeeklyLive(player.live, player.points) ?? asThisWeekFpts(player.points)
}

function poolStat(player: FantraxPoolPlayer, code: string): number {
  return player.stats?.find((row) => row.code === code)?.value ?? 0
}

export function playerStat(player: FantraxPoolPlayer, code: string): number | null {
  const row = player.stats?.find((entry) => entry.code === code)
  return row ? row.value : null
}

const STAT_LABEL: Record<string, string> = {
  G: "G",
  AT: "A",
  KP: "KP",
  CS: "CS",
  Sv: "Sv",
  SOT: "SoT",
  PKS: "PK",
  Min: "Min",
}

const STAT_WEIGHT: Record<string, number> = {
  G: 10,
  AT: 8,
  PKS: 7,
  CS: 6,
  Sv: 3,
  SOT: 2,
  KP: 1.5,
}

function formatStat(value: number): string {
  if (Math.abs(value - Math.round(value)) < 0.05) return String(Math.round(value))
  return value.toFixed(1)
}

export type StatChip = { label: string; value: string }

function keyStatCodes(position: string): string[] {
  const pos = position.toUpperCase()
  if (pos.startsWith("G")) return ["Sv", "CS"]
  if (pos.startsWith("D")) return ["G", "AT", "CS"]
  return ["G", "AT", "KP"]
}

/**
 * Position-aware line that always shows the returns people actually ask about.
 */
export function keyStats(player: FantraxPoolPlayer): StatChip[] {
  if (!player.stats?.length) return []
  const chips: StatChip[] = keyStatCodes(player.position).map((code) => ({
    label: STAT_LABEL[code] ?? code,
    value: formatStat(poolStat(player, code)),
  }))
  const sot = poolStat(player, "SOT")
  if (sot >= 0.5 && !player.position.toUpperCase().startsWith("G") && !player.position.toUpperCase().startsWith("D")) {
    chips.push({ label: "SoT", value: formatStat(sot) })
  }
  const mins = player.playedMinutes ?? poolStat(player, "Min")
  if (mins > 0) chips.push({ label: "Min", value: String(Math.round(mins)) })
  return chips
}

export function seasonStats(player: FantraxPoolPlayer): StatChip[] {
  const season = player.season
  if (!season || (season.goals === 0 && season.assists === 0 && season.cleanSheets === 0 && season.saves === 0)) {
    return []
  }
  const pos = player.position.toUpperCase()
  if (pos.startsWith("G")) {
    return [
      { label: "Sv", value: String(season.saves) },
      { label: "CS", value: String(season.cleanSheets) },
      { label: "Min", value: String(season.minutes) },
    ]
  }
  if (pos.startsWith("D")) {
    return [
      { label: "G", value: String(season.goals) },
      { label: "A", value: String(season.assists) },
      { label: "CS", value: String(season.cleanSheets) },
    ]
  }
  return [
    { label: "G", value: String(season.goals) },
    { label: "A", value: String(season.assists) },
  ]
}

/**
 * The returns that actually explain a player's week — goals, assists, CS, etc.
 */
export function highlightStats(stats: FantraxStat[] | undefined, limit = 3): StatChip[] {
  if (!stats?.length) return []
  return [...stats]
    .filter((row) => row.code !== "GA" && row.value >= 0.5 && STAT_LABEL[row.code])
    .sort((a, b) => b.value * (STAT_WEIGHT[b.code] ?? 1) - a.value * (STAT_WEIGHT[a.code] ?? 1))
    .slice(0, limit)
    .map((row) => ({
      label: STAT_LABEL[row.code] ?? row.code,
      value: formatStat(row.value),
    }))
}

/**
 * Match language only: brace / hat-trick / goal from one fixture.
 * Season G/A on the player is YTD and must not be used here.
 */
export function playerHeadline(player: FantraxPoolPlayer): string | null {
  const match = player.lastMatch
  if (!match) return null
  const g = match.goals
  const a = match.assists
  const cs = match.cleanSheets
  const sv = match.saves
  if (g >= 3) return "Hat-trick"
  if (g >= 2 && a >= 1) return "Brace and assist"
  if (g >= 2) return "Brace"
  if (g >= 1 && a >= 1) return "Goal and assist"
  if (g >= 1) return "Goal"
  if (a >= 2) return "Two assists"
  if (a >= 1) return "Assist"
  if (cs >= 1) return "Clean sheet"
  if (sv >= 5) return `${Math.round(sv)} saves`
  return null
}

/**
 * Ranks an unowned player for the wire: projection, chance of minutes, FA vs WW, and attacking returns.
 */
export function scorePickup(player: FantraxPoolPlayer): number {
  const chance = player.chance ?? 80
  let score = (player.points ?? 0) * 8
  score += poolStat(player, "G") * 6
  score += poolStat(player, "AT") * 5
  score += poolStat(player, "KP") * 1.5
  score += poolStat(player, "CS") * 4
  score += (chance / 100) * 12
  if (player.wire === "FA") score += 5
  if (player.availability === "starting") score += 4
  if (player.availability === "expected") score += 2
  if (player.availability === "out" || player.availability === "injured") score -= 18
  if (player.chance != null && player.chance < 50) score -= 12
  if (player.news) score -= 3
  if ((player.playedMinutes ?? 0) >= 60) score += 3
  return Math.round(score * 10) / 10
}

/**
 * Short reasons a wire player ranks where they do.
 */
export function pickupNotes(player: FantraxPoolPlayer): string[] {
  const notes: string[] = []
  if (player.wire === "FA") notes.push("FA")
  if (player.wire === "WW") notes.push("WW")
  if (player.availabilityLabel) notes.push(player.availabilityLabel)
  if (player.chance != null) notes.push(`${player.chance}%`)
  for (const code of ["G", "AT", "KP", "CS"]) {
    const value = poolStat(player, code)
    if (value >= 0.15) notes.push(`${value.toFixed(1)} ${code}`)
  }
  if ((player.playedMinutes ?? 0) >= 1) notes.push(`${player.playedMinutes}′ played`)
  return notes.slice(0, 5)
}

/**
 * Pulls a Fantrax league ID out of a raw ID or a pasted league URL.
 * @param input Pasted ID or Fantrax URL
 * @returns Normalized league ID or empty string
 */
export function parseLeagueId(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ""
  const fromQuery = trimmed.match(/[?&]leagueId=([^&]+)/i)
  if (fromQuery?.[1]) return decodeURIComponent(fromQuery[1])
  const fromPath = trimmed.match(/fantrax\.com\/(?:fantasy\/league|newui\/fantasy\/league)\/([^/?#]+)/i)
  if (fromPath?.[1] && fromPath[1] !== "home.do") return decodeURIComponent(fromPath[1])
  return trimmed
}
