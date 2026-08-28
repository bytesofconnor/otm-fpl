// Description: Shared Fantrax types and league-ID parsing used by client and server.

/** Over the Moon FPL — the league this companion is built for. Shared links load it with no connect step. */
export const OTM_LEAGUE_ID = "8rnibtdamsxcq60v"
export const OTM_LEAGUE_NAME = "Over the Moon"

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

function poolStat(player: FantraxPoolPlayer, code: string): number {
  return player.stats?.find((row) => row.code === code)?.value ?? 0
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
