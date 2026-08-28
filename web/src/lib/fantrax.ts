// Description: Fantrax fxea client and normalizers for league info, standings, and rosters.

import type {
  FantraxDraftPick,
  FantraxFormNews,
  FantraxFormPoint,
  FantraxFormSnapshot,
  FantraxLeagueSnapshot,
  FantraxManagerSeries,
  FantraxMatchup,
  FantraxMatchupLine,
  FantraxPlayerSeries,
  FantraxPoolPlayer,
  FantraxRosterPlayer,
  FantraxSlateGame,
  FantraxScoringChip,
  FantraxStanding,
  FantraxStat,
  FantraxTeam,
  FantraxTransaction,
  PlayerAvailability,
} from "./fantrax-shared"
import { scorePickup } from "./fantrax-shared"
import { loadFplIndex, matchFplPlayer } from "./fpl"
import { getProjectionSnapshots } from "./supabase"

const FANTRAX_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

const FANTRAX_BASE = "https://www.fantrax.com/fxea/general"

type Json = Record<string, unknown>

function asRecord(value: unknown): Json | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const rec = asRecord(value)
  if (!rec) return []
  for (const key of ["items", "tableList", "standings", "rows", "result"]) {
    if (Array.isArray(rec[key])) {
      const arr = rec[key] as unknown[]
      if (key === "tableList") {
        const rows = arr.flatMap((table) => {
          const tableRec = asRecord(table)
          return tableRec ? asArray(tableRec.rows ?? tableRec.items ?? tableRec.standings) : []
        })
        if (rows.length) return rows
      }
      return arr
    }
  }
  return []
}

function str(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  return fallback
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

async function fantraxGet(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${FANTRAX_BASE}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, {
    next: { revalidate: 120 },
    headers: { Accept: "application/json", "User-Agent": FANTRAX_UA },
  })
  const json: unknown = await res.json().catch(() => null)
  const rec = asRecord(json)
  const err = rec ? asRecord(rec.error) : null
  if (err) {
    throw new Error(str(err.message, str(err.code, "Fantrax request failed")))
  }
  if (!res.ok) throw new Error(`Fantrax ${path} failed (${res.status})`)
  return json
}

function standingFromRow(row: unknown, index: number, youTeamId: string | null): FantraxStanding | null {
  const rec = asRecord(row)
  if (!rec) return null
  const teamId = str(rec.teamId ?? rec.id)
  const teamName = str(rec.teamName ?? rec.name ?? rec.team)
  if (!teamName) return null
  const wltRaw = str(rec.points)
  const isWlt = /^\d+-\d+(-\d+)?$/.test(wltRaw)
  const wins = num(rec.wins ?? rec.w)
  const losses = num(rec.losses ?? rec.l)
  const ties = num(rec.ties ?? rec.t)
  const record =
    wins != null && losses != null
      ? `${wins}–${losses}${ties != null ? `–${ties}` : ""}`
      : isWlt
        ? wltRaw.replace(/-/g, "–")
        : "—"
  const pf = rec.totalPointsFor ?? rec.pf ?? rec.fpts ?? (isWlt ? null : rec.points)
  return {
    rank: num(rec.rank ?? rec.place) ?? index + 1,
    teamId,
    teamName,
    record,
    points: pf == null || pf === "" ? "—" : str(pf),
    you: Boolean(youTeamId && teamId && teamId === youTeamId),
  }
}

type PlayerMeta = { name: string; team: string; position: string }

function displayName(raw: string): string {
  const m = raw.match(/^([^,]+),\s+(.+)$/)
  return m ? `${m[2]} ${m[1]}` : raw
}

let eplPlayerIndex: Map<string, PlayerMeta> | null = null

async function loadEplPlayerIndex(): Promise<Map<string, PlayerMeta>> {
  if (eplPlayerIndex) return eplPlayerIndex
  const raw = await fantraxGet("getPlayerIds", { sport: "EPL" })
  const rec = asRecord(raw) ?? {}
  const map = new Map<string, PlayerMeta>()
  for (const [id, value] of Object.entries(rec)) {
    const row = asRecord(value)
    if (!row) continue
    const name = str(row.name)
    if (!name) continue
    map.set(id, {
      name: displayName(name),
      team: str(row.team ?? row.teamShortName, "—"),
      position: str(row.position, "—"),
    })
  }
  eplPlayerIndex = map
  return map
}

function parsePeriodDate(value: unknown): number | null {
  const s = str(value)
  if (!s) return null
  const normalized = s.replace(/\.0([+-])/, "$1").replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
  const ms = Date.parse(normalized)
  return Number.isFinite(ms) ? ms : null
}

function currentPeriodNumber(periods: unknown): number | null {
  const list = asArray(periods)
    .map((row) => {
      const rec = asRecord(row)
      if (!rec) return null
      const number = num(rec.number ?? rec.period)
      const start = parsePeriodDate(rec.startDate)
      const end = parsePeriodDate(rec.endDate)
      if (number == null || start == null || end == null) return null
      return { number, start, end }
    })
    .filter((row): row is { number: number; start: number; end: number } => row != null)
    .sort((a, b) => a.number - b.number)
  if (!list.length) return null
  const now = Date.now()
  const live = list.find((p) => now >= p.start && now <= p.end)
  if (live) return live.number
  const upcoming = list.find((p) => now < p.start)
  if (upcoming) return upcoming.number
  return list[list.length - 1]?.number ?? null
}

function periodLabel(periods: unknown, period: number | null): string {
  if (period == null) return ""
  const rec = asArray(periods)
    .map(asRecord)
    .find((row) => row && num(row.number ?? row.period) === period)
  if (!rec) return `Period ${period}`
  const start = parsePeriodDate(rec.startDate)
  const end = parsePeriodDate(rec.endDate)
  if (start == null || end == null) return `GW${period}`
  const fmt = (ms: number) =>
    new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  return `GW${period} · ${fmt(start)}–${fmt(end)}`
}

function emptyMatchupFields(): Pick<
  FantraxMatchup,
  "homeOptimal" | "awayOptimal" | "homeBench" | "awayBench"
> {
  return { homeOptimal: null, awayOptimal: null, homeBench: [], awayBench: [] }
}

function findMatchup(info: Json, teamId: string, period: number | null, teams: FantraxTeam[]): FantraxMatchup | null {
  const blocks = asArray(info.matchups)
  const wanted = period ?? 1
  const block =
    blocks
      .map(asRecord)
      .find((row) => row && num(row.period) === wanted) ?? asRecord(blocks[0])
  if (!block) return null
  const list = asArray(block.matchupList ?? block.matchups ?? block.games)
  for (const item of list) {
    const rec = asRecord(item)
    if (!rec) continue
    const home = asRecord(rec.home) ?? rec
    const away = asRecord(rec.away) ?? rec
    const homeId = str(home.id ?? rec.homeTeamId ?? rec.team1Id)
    const awayId = str(away.id ?? rec.awayTeamId ?? rec.team2Id)
    if (homeId !== teamId && awayId !== teamId) continue
    const homeName = str(home.name ?? rec.homeTeamName, teams.find((t) => t.id === homeId)?.name ?? "Home")
    const awayName = str(away.name ?? rec.awayTeamName, teams.find((t) => t.id === awayId)?.name ?? "Away")
    return {
      home: homeName,
      away: awayName,
      homeId,
      awayId,
      homeScore: str(home.score ?? rec.homeScore) || null,
      awayScore: str(away.score ?? rec.awayScore) || null,
      homeProjected: null,
      awayProjected: null,
      period: wanted,
      periodLabel: periodLabel(info.scoringPeriods, wanted),
      lines: [],
      ...emptyMatchupFields(),
    }
  }
  return null
}

function rosterFromTeamBlock(block: unknown, index: Map<string, PlayerMeta>): FantraxRosterPlayer[] {
  const rec = asRecord(block)
  const list = rec ? asArray(rec.rosterItems ?? rec.players ?? rec.roster ?? rec.items) : asArray(block)
  const players: FantraxRosterPlayer[] = []
  for (const item of list) {
    const row = asRecord(item)
    if (!row) continue
    const id = str(row.id ?? row.scorerId)
    const meta = id ? index.get(id) : undefined
    const name = meta?.name || displayName(str(row.name)) || id
    if (!name) continue
    players.push({
      id: id || name,
      name,
      position: str(row.position ?? meta?.position, "—"),
      team: str(meta?.team ?? row.team, "—"),
      points: num(row.points ?? row.fpts),
      minutes: null,
      status: str(row.status) || undefined,
    })
  }
  const rank = (status: string | undefined) => {
    if (status === "ACTIVE") return 0
    if (status === "RESERVE") return 1
    return 2
  }
  return players.sort((a, b) => rank(a.status) - rank(b.status) || a.name.localeCompare(b.name))
}

async function fxpa(leagueId: string, method: string, data: Json): Promise<Json | null> {
  const cacheKey = new URLSearchParams({
    leagueId,
    m: method,
    p: str(data.period ?? data.view ?? ""),
    t: str(data.teamId ?? ""),
    proj: str(data.proj ?? ""),
    opt: str(data.optimal ?? ""),
    f: str(data.statusOrTeamFilter ?? ""),
    s: str(data.seasonOrProjection ?? ""),
  })
  const url = `https://www.fantrax.com/fxpa/req?${cacheKey.toString()}`
  const res = await fetch(url, {
    method: "POST",
    next: { revalidate: 120 },
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": FANTRAX_UA,
    },
    body: JSON.stringify({ msgs: [{ method, data: { leagueId, ...data } }] }),
  })
  const json: unknown = await res.json().catch(() => null)
  const root = asRecord(json)
  const responses = root ? asArray(root.responses) : []
  const first = asRecord(responses[0])
  if (!first) return null
  if (first.pageError) return null
  return asRecord(first.data)
}

function cellContent(cell: unknown): string {
  const rec = asRecord(cell)
  return rec ? str(rec.content).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : ""
}

function cellTeamId(cell: unknown): string {
  const rec = asRecord(cell)
  return rec ? str(rec.teamId) : ""
}

function formatProj(value: number | null): string | null {
  if (value == null) return null
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

type ScheduleSide = { id: string; name: string; pts: string | null }

type ScheduleRow = {
  away: ScheduleSide
  home: ScheduleSide
}

function tablesOf(data: Json | null): Json[] {
  if (!data) return []
  const list = data.tableList
  if (!Array.isArray(list)) return []
  return list.map(asRecord).filter((row): row is Json => row != null)
}

function tableForPeriod(data: Json | null, period: number): Json | null {
  const tables = tablesOf(data)
  const match = tables.find((table) => {
    const caption = str(table.caption)
    return new RegExp(`(?:Gameweek|GW)\\s*${period}\\b`, "i").test(caption)
  })
  return match ?? tables[0] ?? null
}

function parseScheduleRows(table: Json): ScheduleRow[] {
  const games: ScheduleRow[] = []
  for (const row of asArray(table.rows)) {
    const rowRec = asRecord(row)
    const cells = rowRec ? asArray(rowRec.cells) : []
    if (cells.length < 4) continue
    const left: ScheduleSide = {
      id: cellTeamId(cells[0]),
      name: cellContent(cells[0]),
      pts: formatProj(num(cellContent(cells[1]))),
    }
    const right: ScheduleSide = {
      id: cellTeamId(cells[2]),
      name: cellContent(cells[2]),
      pts: formatProj(num(cellContent(cells[3]))),
    }
    if (!left.id || !right.id) continue
    games.push({ away: left, home: right })
  }
  return games
}

function parseSchedule(data: Json | null, period: number): ScheduleRow[] {
  const table = tableForPeriod(data, period)
  if (!table) return []
  return parseScheduleRows(table)
}

function parseAllScheduleWeeks(data: Json | null): Array<{ period: number; games: ScheduleRow[] }> {
  return tablesOf(data).map((table, index) => {
    const caption = str(table.caption)
    const match = caption.match(/(?:Gameweek|GW)\s*(\d+)/i)
    return { period: match ? Number(match[1]) : index + 1, games: parseScheduleRows(table) }
  })
}

const STAT_KEEP = new Set(["G", "AT", "KP", "CS", "Sv", "SOT", "GA", "PKS"])

function asPlayedMinutes(value: number | null): number | null {
  if (value == null || value < 1 || value > 120) return null
  if (Math.abs(value - Math.round(value)) > 0.05) return null
  return Math.round(value)
}

function minutesIndex(codes: string[]): number {
  return codes.findIndex((code) => /^(mp|min|mins|minutes)$/i.test(code))
}

const WEEKLY_PROJ = "PROJECTION_0_926_EVENT_PROJECTED_WEEKLY"

function parseFixture(raw: string): { opponent?: string; kickoff?: string; finished: boolean } {
  const text = raw.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim()
  if (!text) return { finished: false }
  const finished = /\bF\b/.test(text)
  const parts = text.split(/\s+/)
  return { opponent: parts[0], kickoff: parts.slice(1).join(" ") || undefined, finished }
}

function parseAvailability(scorer: Json): {
  availability: PlayerAvailability
  availabilityLabel: string
  news?: string
} {
  const icons = asArray(scorer.icons)
  let availability: PlayerAvailability = "unknown"
  let availabilityLabel = ""
  let news: string | undefined
  for (const icon of icons) {
    const rec = asRecord(icon)
    if (!rec) continue
    const typeId = str(rec.typeId)
    const tooltip = str(rec.tooltip)
    if (typeId === "15") {
      availability = "out"
      availabilityLabel = "Out"
    } else if (typeId === "1") {
      availability = "injured"
      availabilityLabel = "Injured"
    } else if (typeId === "12" && availability !== "out" && availability !== "injured") {
      availability = "starting"
      availabilityLabel = "Starting"
    } else if (typeId === "32" && availability === "unknown") {
      availability = "expected"
      availabilityLabel = "Expected"
    }
    if ((typeId === "8" || typeId === "9" || typeId === "14") && tooltip) news = tooltip
  }
  return { availability, availabilityLabel, news }
}

function parseProjectedRoster(data: Json | null): FantraxRosterPlayer[] {
  if (!data) return []
  const players: FantraxRosterPlayer[] = []
  for (const table of asArray(data.tables)) {
    const tableRec = asRecord(table)
    if (!tableRec) continue
    const header = asRecord(tableRec.header)
    const headerCells = header ? asArray(header.cells) : []
    const codes = headerCells.map((cell) => str(asRecord(cell)?.shortName))
    for (const row of asArray(tableRec.rows)) {
      const rowRec = asRecord(row)
      const scorer = rowRec ? asRecord(rowRec.scorer) : null
      if (!rowRec || !scorer) continue
      const statusId = str(rowRec.statusId)
      const cells = asArray(rowRec.cells)
      const fixture = parseFixture(cellContent(cells[0]))
      const stats: FantraxStat[] = []
      for (let i = 2; i < cells.length; i += 1) {
        const code = codes[i]
        if (!STAT_KEEP.has(code)) continue
        const value = num(cellContent(cells[i]))
        if (value == null || Math.abs(value) < 0.15) continue
        stats.push({ code, value })
      }
      const minIdx = minutesIndex(codes)
      const { availability, availabilityLabel, news } = parseAvailability(scorer)
      players.push({
        id: str(scorer.scorerId),
        name: str(scorer.name),
        shortName: str(scorer.shortName) || undefined,
        position: str(scorer.posShortNames ?? scorer.shortName, "—"),
        team: str(scorer.teamShortName, "—"),
        points: num(cellContent(cells[1])),
        minutes: minIdx >= 0 ? asPlayedMinutes(num(cellContent(cells[minIdx]))) : null,
        status: statusId === "1" ? "ACTIVE" : statusId === "2" ? "RESERVE" : statusId === "3" ? "IR" : statusId,
        opponent: fixture.opponent,
        kickoff: fixture.kickoff,
        fixtureFinished: fixture.finished,
        availability,
        availabilityLabel,
        news,
        headshotUrl: str(scorer.headshotUrl) || undefined,
        stats,
      })
    }
  }
  return players
}

function parseFantasyTeams(data: Json | null): FantraxTeam[] {
  if (!data) return []
  return asArray(data.fantasyTeams)
    .map((row) => {
      const rec = asRecord(row)
      if (!rec) return null
      const id = str(rec.id)
      const name = str(rec.name)
      if (!id || !name) return null
      return {
        id,
        name,
        shortName: str(rec.shortName) || undefined,
        logoUrl: str(rec.logoUrl128 ?? rec.logoUrl256) || undefined,
      } satisfies FantraxTeam
    })
    .filter((t): t is FantraxTeam => t != null)
}

function parseOwner(data: Json | null): string | undefined {
  const heading = data ? asRecord(data.teamHeadingInfo) : null
  const owners = heading ? asRecord(heading.owners) : null
  const value = owners ? str(owners.value) : ""
  return value || undefined
}

async function loadOwnerByTeam(
  leagueId: string,
  teamIds: string[],
  period: number,
): Promise<Map<string, string>> {
  const unique = [...new Set(teamIds.filter(Boolean))]
  const rows = await Promise.all(
    unique.map(async (teamId) => {
      const data = await fxpa(leagueId, "getTeamRosterInfo", { period, teamId }).catch(() => null)
      const owner = parseOwner(data)
      return owner ? ([teamId, owner] as const) : null
    }),
  )
  return new Map(rows.filter((row): row is readonly [string, string] => row != null))
}

type RosterBundle = { players: FantraxRosterPlayer[]; teams: FantraxTeam[]; owner?: string }

async function loadRosterBundle(leagueId: string, teamId: string, period: number): Promise<RosterBundle> {
  const [projData, liveData] = await Promise.all([
    fxpa(leagueId, "getTeamRosterInfo", {
      period,
      teamId,
      seasonOrProjection: WEEKLY_PROJ,
    }),
    fxpa(leagueId, "getTeamRosterInfo", { period, teamId }),
  ])
  const projected = parseProjectedRoster(projData)
  const actual = parseProjectedRoster(liveData)
  const liveBy = new Map(actual.map((p) => [p.id, p]))
  const players = projected.map((p) => {
    const live = liveBy.get(p.id)
    return {
      ...p,
      minutes: live?.minutes ?? p.minutes,
      stats: live?.stats?.length ? live.stats : p.stats,
      projected: p.points,
      points: live ? live.points : p.points,
      fixtureFinished: Boolean(p.fixtureFinished || live?.fixtureFinished),
    }
  })
  const source = projData ?? liveData
  return { players, teams: parseFantasyTeams(source), owner: parseOwner(source) }
}

function zipMatchupLines(home: FantraxRosterPlayer[], away: FantraxRosterPlayer[]): FantraxMatchupLine[] {
  const order = ["G", "D", "M", "F"]
  const starters = (list: FantraxRosterPlayer[]) => list.filter((p) => p.status === "ACTIVE")
  const homeStarters = starters(home)
  const awayStarters = starters(away)
  const lines: FantraxMatchupLine[] = []
  for (const pos of order) {
    const h = homeStarters.filter((p) => p.position.toUpperCase().startsWith(pos))
    const a = awayStarters.filter((p) => p.position.toUpperCase().startsWith(pos))
    const n = Math.max(h.length, a.length)
    for (let i = 0; i < n; i += 1) {
      lines.push({ position: pos, home: h[i] ?? null, away: a[i] ?? null })
    }
  }
  return lines
}

function benchOf(list: FantraxRosterPlayer[]): FantraxRosterPlayer[] {
  return list.filter((p) => p.status === "RESERVE" || p.status === "IR")
}

function teamsFromInfo(info: Json): FantraxTeam[] {
  const teamInfo = info.teamInfo
  if (Array.isArray(teamInfo)) {
    return teamInfo
      .map((t) => {
        const rec = asRecord(t)
        if (!rec) return null
        const id = str(rec.id ?? rec.teamId)
        const name = str(rec.name ?? rec.teamName)
        return name ? { id, name } : null
      })
      .filter((t): t is FantraxTeam => t != null)
  }
  const map = asRecord(teamInfo)
  if (!map) return []
  return Object.entries(map)
    .map(([id, value]) => {
      const rec = asRecord(value)
      const name = rec ? str(rec.name ?? rec.teamName, id) : String(id)
      return { id: rec ? str(rec.id ?? rec.teamId, id) : id, name }
    })
    .filter((t) => t.name)
}

function mergeTeams(base: FantraxTeam[], extra: FantraxTeam[]): FantraxTeam[] {
  const byId = new Map(base.map((t) => [t.id, { ...t }]))
  for (const team of extra) {
    const prev = byId.get(team.id) ?? { id: team.id, name: team.name }
    byId.set(team.id, {
      ...prev,
      name: team.name || prev.name,
      shortName: team.shortName ?? prev.shortName,
      logoUrl: team.logoUrl ?? prev.logoUrl,
      owner: team.owner ?? prev.owner,
    })
  }
  return [...byId.values()]
}

function scoringLabel(type: string): string {
  if (/HEAD_TO_HEAD_POINTS/i.test(type)) return "H2H points"
  return type.replace(/_/g, " ").toLowerCase()
}

function parsePointsToken(raw: string): string | null {
  const m = raw.match(/points(-?[\d.]+)/i)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n === 0) return null
  const abs = Number.isInteger(n) ? String(n) : String(n)
  return n > 0 ? `+${abs}` : `−${abs.replace("-", "")}`
}

function scoringChips(info: Json): FantraxScoringChip[] {
  const system = asRecord(info.scoringSystem)
  const cats = system ? asRecord(system.scoringCategories) : null
  const outfield = cats ? asRecord(cats.NON_GOALIE) : null
  const goalie = cats ? asRecord(cats.GOALIE) : null
  const order = ["G", "AT", "KP", "CS", "SOT", "Sv", "YC", "RC"]
  const chips: FantraxScoringChip[] = []
  for (const code of order) {
    const rec = asRecord(outfield?.[code] ?? goalie?.[code])
    const value = rec ? parsePointsToken(str(rec.Default)) : null
    if (value) chips.push({ code, value })
  }
  return chips
}

function parseTransactions(data: Json | null, playerIndex: Map<string, PlayerMeta>): FantraxTransaction[] {
  if (!data) return []
  const table = asRecord(data.table)
  const rows = table ? asArray(table.rows) : []
  const out: FantraxTransaction[] = []
  for (const row of rows) {
    const rec = asRecord(row)
    if (!rec) continue
    const kindRaw = str(rec.transactionCode ?? rec.transactionType).toUpperCase()
    const kind: "claim" | "drop" | null = kindRaw.includes("CLAIM") ? "claim" : kindRaw.includes("DROP") ? "drop" : null
    if (!kind) continue
    const scorer = asRecord(rec.scorer)
    const cells = asArray(rec.cells)
    const teamCell = asRecord(cells[0])
    const teamName = teamCell ? str(teamCell.content) : ""
    const teamId = teamCell ? str(teamCell.teamId) : ""
    if (!teamName || /^\d+$/.test(teamName)) continue
    const playerId = scorer ? str(scorer.scorerId) : ""
    const meta = playerId ? playerIndex.get(playerId) : undefined
    out.push({
      id: str(rec.txSetId, `${kind}-${playerId}-${teamId}`),
      teamName,
      teamId,
      playerName: scorer ? str(scorer.name, meta?.name || "Player") : meta?.name || "Player",
      playerTeam: scorer ? str(scorer.teamShortName, meta?.team || "") : meta?.team || "",
      kind,
      date: str(asRecord(cells[1])?.content),
    })
  }
  return out.slice(0, 10)
}

function parseDraftPicks(
  raw: unknown,
  teams: FantraxTeam[],
  playerIndex: Map<string, PlayerMeta>,
): { picks: FantraxDraftPick[]; draftType: string | null; draftState: string | null } {
  const rec = asRecord(raw)
  if (!rec) return { picks: [], draftType: null, draftState: null }
  const names = new Map(teams.map((t) => [t.id, t.name]))
  const picks = asArray(rec.draftPicks)
    .map((row) => {
      const pick = asRecord(row)
      if (!pick || num(pick.round) !== 1) return null
      const playerId = str(pick.playerId)
      const meta = playerIndex.get(playerId)
      const teamId = str(pick.teamId)
      return {
        round: 1,
        pick: num(pick.pick) ?? 0,
        teamId,
        teamName: names.get(teamId) ?? teamId,
        playerName: meta?.name || playerId,
        playerTeam: meta?.team || "—",
        position: meta?.position || "—",
      } satisfies FantraxDraftPick
    })
    .filter((p): p is FantraxDraftPick => p != null)
    .sort((a, b) => a.pick - b.pick)
  return { picks, draftType: str(rec.draftType) || null, draftState: str(rec.draftState) || null }
}

function salaryCapFromRosters(nested: Json): number | null {
  for (const value of Object.values(nested)) {
    const rec = asRecord(value)
    const cap = rec ? num(rec.salaryCap) : null
    if (cap != null) return cap
  }
  return null
}

function mergeSlate(
  proj: ScheduleRow[],
  live: ScheduleRow[],
  optimal: ScheduleRow[],
  youTeamId: string | null,
): FantraxSlateGame[] {
  const liveBy = new Map(live.map((g) => [`${g.away.id}-${g.home.id}`, g]))
  const optBy = new Map(optimal.map((g) => [`${g.away.id}-${g.home.id}`, g]))
  return proj.map((g) => {
    const key = `${g.away.id}-${g.home.id}`
    const l = liveBy.get(key)
    const o = optBy.get(key)
    return {
      home: g.home.name,
      away: g.away.name,
      homeId: g.home.id,
      awayId: g.away.id,
      homeProjected: g.home.pts,
      awayProjected: g.away.pts,
      homeScore: l?.home.pts ?? null,
      awayScore: l?.away.pts ?? null,
      homeOptimal: o?.home.pts ?? null,
      awayOptimal: o?.away.pts ?? null,
      yours: Boolean(youTeamId && (g.home.id === youTeamId || g.away.id === youTeamId)),
    }
  })
}

function liveStarted(slate: FantraxSlateGame[]): boolean {
  return slate.some((g) => {
    const hs = num(g.homeScore)
    const as = num(g.awayScore)
    return (hs != null && hs > 0) || (as != null && as > 0)
  })
}

/**
 * Loads a normalized snapshot for a Fantrax league, optionally scoped to one team and gameweek.
 * @param leagueId Fantrax league ID
 * @param teamId Optional fantasy team ID ("you")
 * @param requestedPeriod Optional scoring period to view
 */
export async function loadFantraxLeague(
  leagueId: string,
  teamId?: string | null,
  requestedPeriod?: number | null,
): Promise<FantraxLeagueSnapshot> {
  const [infoResult, standingsResult, rostersResult, playersResult, draftResult] = await Promise.allSettled([
    fantraxGet("getLeagueInfo", { leagueId }),
    fantraxGet("getStandings", { leagueId }),
    fantraxGet("getTeamRosters", { leagueId }),
    loadEplPlayerIndex(),
    fantraxGet("getDraftResults", { leagueId }),
  ])

  if (infoResult.status === "rejected" && standingsResult.status === "rejected") {
    throw new Error(infoResult.reason instanceof Error ? infoResult.reason.message : "Could not load league")
  }

  const infoRaw = infoResult.status === "fulfilled" ? infoResult.value : {}
  const standingsRaw = standingsResult.status === "fulfilled" ? standingsResult.value : []
  const rostersRaw = rostersResult.status === "fulfilled" ? rostersResult.value : {}
  const playerIndex = playersResult.status === "fulfilled" ? playersResult.value : new Map<string, PlayerMeta>()
  const draftRaw = draftResult.status === "fulfilled" ? draftResult.value : null

  const info = asRecord(infoRaw) ?? {}
  const periods = info.scoringPeriods ?? info.rosterPeriods
  const currentPeriod = currentPeriodNumber(periods)
  const periodCount = asArray(periods).length
  const viewedPeriod =
    requestedPeriod && requestedPeriod >= 1 && requestedPeriod <= (periodCount || 38)
      ? requestedPeriod
      : currentPeriod
  const standings = asArray(standingsRaw)
    .map((row, i) => standingFromRow(row, i, teamId ?? null))
    .filter((row): row is FantraxStanding => row != null)
    .sort((a, b) => a.rank - b.rank || a.teamName.localeCompare(b.teamName))
  let teams = teamsFromInfo(info)
  if (!teams.length) {
    teams = standings.map((row) => ({ id: row.teamId, name: row.teamName })).filter((t) => t.id)
  }

  const rosterMap = asRecord(rostersRaw) ?? {}
  const nestedRosters = asRecord(rosterMap.rosters) ?? rosterMap
  const ownedIds = new Set<string>()
  let roster: FantraxRosterPlayer[] = []
  if (teamId && nestedRosters[teamId]) {
    roster = rosterFromTeamBlock(nestedRosters[teamId], playerIndex)
    for (const p of roster) ownedIds.add(p.id)
  } else {
    for (const value of Object.values(nestedRosters)) {
      for (const p of rosterFromTeamBlock(value, playerIndex)) ownedIds.add(p.id)
    }
  }

  const playerInfo = asRecord(info.playerInfo) ?? {}
  const waivers: FantraxRosterPlayer[] = []
  for (const [id, value] of Object.entries(playerInfo)) {
    if (ownedIds.has(id)) continue
    const rec = asRecord(value)
    const status = str(rec?.status).toUpperCase()
    if (status !== "WW") continue
    const meta = playerIndex.get(id)
    waivers.push({
      id,
      name: meta?.name || id,
      position: str(rec?.eligiblePos ?? meta?.position, "—"),
      team: str(meta?.team, "—"),
      points: null,
      minutes: null,
      status,
    })
  }

  const period = viewedPeriod ?? 1
  const matchupSeed = teamId ? findMatchup(info, teamId, viewedPeriod, teams) : null
  const [projSched, liveSched, optSched, txData, homeRoster, awayRoster, selfRoster] = await Promise.all([
    fxpa(leagueId, "getStandings", { view: "SCHEDULE", period, proj: true }),
    fxpa(leagueId, "getStandings", { view: "SCHEDULE", period, proj: false }),
    fxpa(leagueId, "getStandings", { view: "SCHEDULE", period, proj: true, optimal: true }),
    fxpa(leagueId, "getTransactionDetailsHistory", { maxResultsPerPage: "20" }),
    matchupSeed
      ? loadRosterBundle(leagueId, matchupSeed.homeId, matchupSeed.period).catch(() => null)
      : Promise.resolve(null),
    matchupSeed
      ? loadRosterBundle(leagueId, matchupSeed.awayId, matchupSeed.period).catch(() => null)
      : Promise.resolve(null),
    !matchupSeed && teamId ? loadRosterBundle(leagueId, teamId, period).catch(() => null) : Promise.resolve(null),
  ])

  let matchup = matchupSeed
  const homePlayers = homeRoster?.players ?? []
  const awayPlayers = awayRoster?.players ?? []
  let rosterMeta: RosterBundle | null =
    (teamId && matchupSeed?.homeId === teamId ? homeRoster : null) ??
    (teamId && matchupSeed?.awayId === teamId ? awayRoster : null) ??
    selfRoster ??
    homeRoster

  if (homeRoster) {
    teams = mergeTeams(teams, homeRoster.teams)
    if (homeRoster.owner && matchupSeed) {
      teams = mergeTeams(teams, [{ id: matchupSeed.homeId, name: matchupSeed.home, owner: homeRoster.owner }])
    }
  }
  if (awayRoster) {
    teams = mergeTeams(teams, awayRoster.teams)
    if (awayRoster.owner && matchupSeed) {
      teams = mergeTeams(teams, [{ id: matchupSeed.awayId, name: matchupSeed.away, owner: awayRoster.owner }])
    }
  }

  if (rosterMeta) {
    teams = mergeTeams(teams, rosterMeta.teams)
    if (rosterMeta.owner && teamId) {
      teams = mergeTeams(teams, [{ id: teamId, name: teams.find((t) => t.id === teamId)?.name ?? "", owner: rosterMeta.owner }])
    }
    if (rosterMeta.players.length) roster = rosterMeta.players
  }

  const slate = mergeSlate(
    parseSchedule(projSched, period),
    parseSchedule(liveSched, period),
    parseSchedule(optSched, period),
    teamId ?? null,
  )
  const yours = slate.find((g) => g.yours)

  if (matchup) {
    const homeTeam = teams.find((t) => t.id === matchup.homeId)
    const awayTeam = teams.find((t) => t.id === matchup.awayId)
    const aligned = yours
      ? yours.homeId === matchup.homeId
        ? yours
        : {
            ...yours,
            homeProjected: yours.awayProjected,
            awayProjected: yours.homeProjected,
            homeScore: yours.awayScore,
            awayScore: yours.homeScore,
            homeOptimal: yours.awayOptimal,
            awayOptimal: yours.homeOptimal,
          }
      : null
    matchup = {
      ...matchup,
      homeProjected: aligned?.homeProjected ?? matchup.homeProjected,
      awayProjected: aligned?.awayProjected ?? matchup.awayProjected,
      homeScore: aligned?.homeScore ?? matchup.homeScore,
      awayScore: aligned?.awayScore ?? matchup.awayScore,
      homeOptimal: aligned?.homeOptimal ?? null,
      awayOptimal: aligned?.awayOptimal ?? null,
      homeOwner: homeTeam?.owner,
      awayOwner: awayTeam?.owner,
      homeLogo: homeTeam?.logoUrl,
      awayLogo: awayTeam?.logoUrl,
      homeShort: homeTeam?.shortName,
      awayShort: awayTeam?.shortName,
      homeBench: benchOf(homePlayers),
      awayBench: benchOf(awayPlayers),
      lines: zipMatchupLines(homePlayers, awayPlayers),
    }
    if (teamId === matchup.homeId && homePlayers.length) roster = homePlayers
    if (teamId === matchup.awayId && awayPlayers.length) roster = awayPlayers
  }

  const teamById = new Map(teams.map((t) => [t.id, t]))
  const standingsWithMeta = standings.map((row) => ({
    ...row,
    logoUrl: teamById.get(row.teamId)?.logoUrl,
    shortName: teamById.get(row.teamId)?.shortName,
  }))

  const scoringTypeRaw = str(asRecord(info.scoringSystem)?.type)
  const draft = parseDraftPicks(draftRaw, teams, playerIndex)

  return {
    leagueId,
    leagueName: str(info.leagueName ?? info.name, "Fantrax league"),
    scoringType: scoringTypeRaw ? scoringLabel(scoringTypeRaw) : null,
    teamCount: teams.length || standings.length,
    currentPeriod,
    viewedPeriod,
    periodCount: periodCount || 38,
    periodLabel: periodLabel(periods, viewedPeriod),
    salaryCap: salaryCapFromRosters(nestedRosters),
    draftType: draft.draftType || str(asRecord(info.draftSettings)?.draftType ?? info.draftType) || null,
    draftState: draft.draftState,
    liveStarted: liveStarted(slate),
    teams,
    standings: standingsWithMeta,
    matchup,
    roster,
    waivers: waivers.slice(0, 10),
    slate,
    transactions: parseTransactions(txData, playerIndex),
    draftPicks: draft.picks,
    scoringChips: scoringChips(info),
  }
}

function trimManagerWeeks(managers: FantraxManagerSeries[]): FantraxManagerSeries[] {
  if (!managers.length) return managers
  const keep = managers[0].points.map((_, i) => managers.some((m) => (m.points[i]?.value ?? 0) > 0))
  if (!keep.some(Boolean)) return managers
  return managers.map((m) => ({
    ...m,
    points: m.points.filter((_, i) => keep[i]),
    cumulative: m.cumulative.filter((_, i) => keep[i]),
  }))
}

function collapseFlatPlayerWeeks(players: FantraxPlayerSeries[]): FantraxPlayerSeries[] {
  if (!players.length || players[0].points.length < 2) return players
  const moves = players.some((p) => {
    const first = p.points[0]?.value
    return p.points.slice(1).some((pt) => pt.value != null && first != null && Math.abs(pt.value - first) > 0.15)
  })
  if (moves) return players
  return players.map((p) => ({ ...p, points: p.points.slice(0, 1), minutes: p.minutes.slice(0, 1) }))
}

function trimPlayerWeeks(players: FantraxPlayerSeries[]): FantraxPlayerSeries[] {
  if (!players.length) return players
  const keep = players[0].points.map((_, i) => players.some((p) => (p.points[i]?.value ?? 0) > 0))
  if (!keep.some(Boolean)) return players
  return players.map((p) => ({
    ...p,
    points: p.points.filter((_, i) => keep[i]),
    minutes: p.minutes.filter((_, i) => keep[i]),
  }))
}

function scoreFromCell(pts: string | null): number | null {
  return num(pts)
}

function buildManagerSeries(
  projWeeks: Array<{ period: number; games: ScheduleRow[] }>,
  liveWeeks: Array<{ period: number; games: ScheduleRow[] }>,
  youTeamId: string | null,
  teams: FantraxTeam[],
): FantraxManagerSeries[] {
  type Acc = { name: string; projected: Map<number, number>; actual: Map<number, number> }
  const byId = new Map<string, Acc>()
  const touch = (id: string, name: string, period: number, value: number | null, bucket: "projected" | "actual") => {
    if (!id || value == null) return
    const prev = byId.get(id) ?? { name, projected: new Map(), actual: new Map() }
    prev.name = name || prev.name
    prev[bucket].set(period, value)
    byId.set(id, prev)
  }
  for (const week of projWeeks) {
    for (const game of week.games) {
      touch(game.away.id, game.away.name, week.period, scoreFromCell(game.away.pts), "projected")
      touch(game.home.id, game.home.name, week.period, scoreFromCell(game.home.pts), "projected")
    }
  }
  for (const week of liveWeeks) {
    for (const game of week.games) {
      const away = scoreFromCell(game.away.pts)
      const home = scoreFromCell(game.home.pts)
      if (away != null && away > 0) touch(game.away.id, game.away.name, week.period, away, "actual")
      if (home != null && home > 0) touch(game.home.id, game.home.name, week.period, home, "actual")
    }
  }
  const periods = [...new Set(projWeeks.map((w) => w.period))].sort((a, b) => a - b)
  const names = new Map(teams.map((t) => [t.id, t]))
  return [...byId.entries()]
    .map(([teamId, acc]) => {
      let runLive = 0
      let runForecast = 0
      const points: FantraxFormPoint[] = []
      const cumulative: FantraxFormPoint[] = []
      for (const period of periods) {
        const actual = acc.actual.get(period) ?? null
        const projected = acc.projected.get(period) ?? null
        const forecast = projected ?? actual
        const hasLive = actual != null
        points.push({
          period,
          value: forecast,
          projected: !hasLive,
          live: actual,
          forecast,
        })
        if (hasLive) runLive += actual
        if (forecast != null) runForecast += forecast
        cumulative.push({
          period,
          value: forecast == null ? null : Number(runForecast.toFixed(1)),
          projected: !hasLive,
          live: hasLive ? Number(runLive.toFixed(1)) : null,
          forecast: forecast == null ? null : Number(runForecast.toFixed(1)),
        })
      }
      const meta = names.get(teamId)
      return {
        teamId,
        name: meta?.name || acc.name,
        shortName: meta?.shortName,
        owner: meta?.owner,
        you: Boolean(youTeamId && teamId === youTeamId),
        points,
        cumulative,
      } satisfies FantraxManagerSeries
    })
    .sort((a, b) => Number(b.you) - Number(a.you) || a.name.localeCompare(b.name))
}

function parsePlayerStats(data: Json | null): FantraxPoolPlayer[] {
  if (!data) return []
  const header = asRecord(data.tableHeader)
  const keys = header ? asArray(header.cells).map((cell) => str(asRecord(cell)?.key || asRecord(cell)?.shortName)) : []
  const lower = keys.map((key) => key.toLowerCase())
  const fptsIdx = lower.findIndex((k) => k === "fpts" || k === "score")
  const statusIdx = lower.findIndex((k) => k === "status" || k === "sta")
  const minIdx = minutesIndex(lower)
  const rows = asArray(data.statsTable)
  const out: FantraxPoolPlayer[] = []
  for (const row of rows) {
    const rec = asRecord(row)
    const scorer = rec ? asRecord(rec.scorer) : null
    if (!rec || !scorer) continue
    const cells = asArray(rec.cells)
    const statusCell = statusIdx >= 0 ? asRecord(cells[statusIdx]) : asRecord(cells[1])
    const fptsCell = fptsIdx >= 0 ? cells[fptsIdx] : cells[Math.min(4, cells.length - 1)]
    const statusRaw = statusCell ? str(statusCell.content).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : ""
    const ownerId = statusCell ? str(statusCell.teamId) : ""
    const ownerName = statusCell ? str(statusCell.toolTip) : ""
    const ownerShort = ownerId ? statusRaw : undefined
    let wire: "FA" | "WW" | undefined
    if (/^FA$/i.test(statusRaw)) wire = "FA"
    else if (/^W\b/i.test(statusRaw)) wire = "WW"
    const stats: FantraxStat[] = []
    keys.forEach((code, i) => {
      const normalized = code === "A" ? "AT" : code
      if (!STAT_KEEP.has(normalized)) return
      const value = num(cellContent(cells[i]))
      if (value == null || Math.abs(value) < 0.15) return
      stats.push({ code: normalized, value })
    })
    const { availability, availabilityLabel, news } = parseAvailability(scorer)
    out.push({
      id: str(scorer.scorerId),
      name: str(scorer.name),
      team: str(scorer.teamShortName),
      position: str(scorer.posShortNames),
      points: num(cellContent(fptsCell)),
      ownerTeamId: ownerId || undefined,
      ownerName: ownerName || undefined,
      ownerShort,
      wire,
      stats: stats.length ? stats : undefined,
      availability,
      availabilityLabel: availabilityLabel || undefined,
      news,
      playedMinutes: minIdx >= 0 ? asPlayedMinutes(num(cellContent(cells[minIdx]))) : null,
    })
  }
  return out.filter((p) => p.id && p.name)
}

async function loadPlayerStatsPool(
  leagueId: string,
  filter: "ALL_TAKEN" | "ALL_AVAILABLE",
  season?: string,
): Promise<FantraxPoolPlayer[]> {
  const data = await fxpa(leagueId, "getPlayerStats", {
    pageNumber: 1,
    maxResultsPerPage: 500,
    ...(season ? { seasonOrProjection: season } : { period: 1 }),
    statusOrTeamFilter: filter,
  })
  return parsePlayerStats(data)
}

function buildPlayerSeries(weeks: Array<{ period: number; players: FantraxRosterPlayer[] }>): FantraxPlayerSeries[] {
  const byId = new Map<string, FantraxPlayerSeries>()
  for (const week of weeks) {
    for (const player of week.players) {
      const prev =
        byId.get(player.id) ??
        ({
          id: player.id,
          name: player.name,
          team: player.team,
          position: player.position,
          status: player.status,
          points: [],
          minutes: [],
        } satisfies FantraxPlayerSeries)
      prev.points.push({ period: week.period, value: player.points, projected: true })
      prev.minutes.push(player.minutes)
      if (player.status) prev.status = player.status
      if (player.opponent) prev.opponent = player.opponent
      if (player.kickoff) prev.kickoff = player.kickoff
      if (player.availability) prev.availability = player.availability
      if (player.availabilityLabel) prev.availabilityLabel = player.availabilityLabel
      if (asPlayedMinutes(player.minutes) != null) prev.playedMinutes = asPlayedMinutes(player.minutes)
      byId.set(player.id, prev)
    }
  }
  return [...byId.values()].sort((a, b) => {
    const rank = (status?: string) => (status === "ACTIVE" ? 0 : status === "RESERVE" ? 1 : 2)
    return rank(a.status) - rank(b.status) || a.name.localeCompare(b.name)
  })
}

/**
 * Loads manager trajectories, upcoming player projections, and news for the Form page.
 * Merges frozen projection snapshots from Supabase with live Fantrax data.
 */
export async function loadFantraxForm(leagueId: string, teamId?: string | null): Promise<FantraxFormSnapshot> {
  const [infoResult, projResult, liveResult, fplResult, takenResult, availResult, takenLiveResult] = await Promise.allSettled([
    fantraxGet("getLeagueInfo", { leagueId }),
    fxpa(leagueId, "getStandings", { view: "SCHEDULE", period: 1, proj: true }),
    fxpa(leagueId, "getStandings", { view: "SCHEDULE", period: 1, proj: false }),
    loadFplIndex(),
    loadPlayerStatsPool(leagueId, "ALL_TAKEN", WEEKLY_PROJ),
    loadPlayerStatsPool(leagueId, "ALL_AVAILABLE", WEEKLY_PROJ),
    loadPlayerStatsPool(leagueId, "ALL_TAKEN"),
  ])
  const info = asRecord(infoResult.status === "fulfilled" ? infoResult.value : {}) ?? {}
  const currentPeriod = currentPeriodNumber(info.scoringPeriods ?? info.rosterPeriods) ?? 1
  
  // Fetch projection snapshots for current period (graceful fallback if Supabase not configured)
  const snapshots = await getProjectionSnapshots(leagueId, currentPeriod).catch(() => null)
  const windowStart = currentPeriod
  const windowEnd = Math.min(38, currentPeriod + 5)
  const periods = Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i)
  const teams = teamsFromInfo(info)
  const projWeeks = parseAllScheduleWeeks(projResult.status === "fulfilled" ? projResult.value : null)
  const liveWeeks = parseAllScheduleWeeks(liveResult.status === "fulfilled" ? liveResult.value : null)
  const managers = buildManagerSeries(projWeeks, liveWeeks, teamId ?? null, teams)
  const owners = await loadOwnerByTeam(
    leagueId,
    managers.map((m) => m.teamId),
    currentPeriod,
  )
  for (const manager of managers) {
    manager.owner = owners.get(manager.teamId) || manager.owner
  }

  let players: FantraxPlayerSeries[] = []
  let news: FantraxFormNews[] = []
  let teamName: string | null = teams.find((t) => t.id === teamId)?.name ?? null
  const fpl = fplResult.status === "fulfilled" ? fplResult.value : { byKey: new Map(), elements: [] }

  if (teamId) {
    const bundles = await Promise.all(periods.map((period) => loadRosterBundle(leagueId, teamId, period).catch(() => null)))
    const rosterTeams = bundles.find((bundle) => bundle?.teams.length)?.teams ?? []
    if (rosterTeams.length) {
      const merged = mergeTeams(teams, rosterTeams)
      for (const manager of managers) {
        manager.shortName = merged.find((t) => t.id === manager.teamId)?.shortName || manager.shortName
      }
    }
    const weeks = bundles
      .map((bundle, i) => (bundle ? { period: periods[i], players: bundle.players } : null))
      .filter((row): row is { period: number; players: FantraxRosterPlayer[] } => row != null)
    
    // Build player series and merge in snapshots for current period
    players = buildPlayerSeries(weeks).map((playerSeries) => {
      // For the current period, use frozen projection from snapshot if available
      const currentPeriodPoint = playerSeries.points.find((pt) => pt.period === currentPeriod)
      if (currentPeriodPoint && snapshots) {
        const snapshot = snapshots.get(playerSeries.id)
        if (snapshot) {
          const frozenProj = Number(snapshot.projected)
          // Replace the projected value with the frozen one
          currentPeriodPoint.value = frozenProj
          if (currentPeriodPoint.projected) {
            currentPeriodPoint.forecast = frozenProj
          }
        }
      }
      return playerSeries
    })
    const current = weeks.find((w) => w.period === currentPeriod)?.players ?? weeks[0]?.players ?? []
    if (bundles[0]?.owner && teamName) {
      teamName = teamName
    }
    for (const player of current) {
      const fplEl = matchFplPlayer(fpl, player.name, player.team)
      const fplNews = fplEl?.news?.trim() ?? ""
      const chance = fplEl?.chance ?? null
      if (fplEl && fplEl.minutes > 0) {
        const series = players.find((row) => row.id === player.id)
        if (series) {
          series.playedMinutes = fplEl.minutes
          series.chance = chance
        }
      } else if (chance != null) {
        const series = players.find((row) => row.id === player.id)
        if (series) series.chance = chance
      }
      const lineupRisk =
        player.availability === "out" ||
        player.availability === "injured" ||
        (chance != null && chance < 100)
      if (!fplNews && !lineupRisk) continue
      news.push({
        playerId: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        source: fplNews ? "fpl" : "fantrax",
        headline: fplNews || player.news?.trim() || player.availabilityLabel || "Watch",
        chance,
        minutes: asPlayedMinutes(player.minutes) ?? (fplEl && fplEl.minutes > 0 ? fplEl.minutes : null),
        availability: player.availability,
        availabilityLabel: player.availabilityLabel,
      })
    }
  }

  const takenLive = takenLiveResult.status === "fulfilled" ? takenLiveResult.value : []
  const liveById = new Map(takenLive.map((p) => [p.id, p.points]))
  const projectedTaken = takenResult.status === "fulfilled" ? takenResult.value.filter((p) => p.ownerTeamId) : []
  
  // Merge snapshot projections with league-owned players
  const leagueOwned = projectedTaken.map((p) => {
    const snapshot = snapshots?.get(p.id)
    const frozenProj = snapshot ? Number(snapshot.projected) : null
    const livePoints = liveById.has(p.id) ? (liveById.get(p.id) ?? 0) : null
    
    return {
      ...p,
      // Use frozen projection from snapshot if available, otherwise fall back to live Fantrax proj
      points: frozenProj ?? p.points,
      live: livePoints,
    }
  })
  // Merge snapshots into available players (for accurate pickup scoring)
  const unowned = (availResult.status === "fulfilled" ? availResult.value : [])
    .filter((p) => !p.ownerTeamId)
    .map((p) => {
      const fplEl = matchFplPlayer(fpl, p.name, p.team)
      const snapshot = snapshots?.get(p.id)
      const frozenProj = snapshot ? Number(snapshot.projected) : null
      
      const next = {
        ...p,
        // Use frozen projection if available, otherwise use live Fantrax proj
        points: frozenProj ?? p.points,
        chance: fplEl?.chance ?? p.chance,
        playedMinutes: (fplEl && fplEl.minutes > 0 ? fplEl.minutes : null) ?? p.playedMinutes,
        news: fplEl?.news?.trim() || p.news,
      }
      return { ...next, pickup: scorePickup(next) }
    })
    .sort((a, b) => (b.pickup ?? 0) - (a.pickup ?? 0) || (b.points ?? 0) - (a.points ?? 0))
    .slice(0, 24)

  return {
    leagueId,
    leagueName: str(info.leagueName ?? info.name, "Fantrax league"),
    teamId: teamId ?? null,
    teamName,
    currentPeriod,
    windowStart,
    windowEnd,
    managers: trimManagerWeeks(managers),
    players: collapseFlatPlayerWeeks(trimPlayerWeeks(players)),
    leagueOwned,
    unowned,
    news,
  }
}
