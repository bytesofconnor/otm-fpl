// Description: Live FPL bootstrap helpers for news, minutes chance, and Fantrax name matching.

import { canonicalClub } from "./clubs"

type Json = Record<string, unknown>

function asRecord(value: unknown): Json | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null
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

export type FplMatchReturns = {
  goals: number
  assists: number
  cleanSheets: number
  saves: number
  keyPasses?: number
  minutes: number
}

export type FplElement = {
  id: number
  code: number | null
  /** PulseLive / FPL badge id (`t{n}.png`). */
  badge: number | null
  webName: string
  firstName: string
  secondName: string
  team: string
  news: string
  chance: number | null
  minutes: number
  status: string
  goals: number
  assists: number
  cleanSheets: number
  saves: number
  /** Best single fixture this FPL gameweek — not season totals. */
  lastMatch?: FplMatchReturns | null
}

type FplIndex = {
  byKey: Map<string, FplElement>
  elements: FplElement[]
  /** True when the requested FPL gameweek's fixtures are all finished. */
  eventFinished: boolean
}

const FPL_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
}

function explainValue(stats: unknown[], identifier: string): number {
  for (const row of stats) {
    const rec = asRecord(row)
    if (!rec) continue
    if (str(rec.identifier) !== identifier) continue
    return num(rec.value) ?? 0
  }
  return 0
}

function matchReturnsFromExplain(explain: unknown): FplMatchReturns[] {
  const fixtures = Array.isArray(explain) ? explain : []
  const matches: FplMatchReturns[] = []
  for (const block of fixtures) {
    const rec = asRecord(block)
    const stats = rec && Array.isArray(rec.stats) ? rec.stats : []
    const minutes = explainValue(stats, "minutes")
    if (minutes <= 0 && explainValue(stats, "goals_scored") <= 0 && explainValue(stats, "assists") <= 0) continue
    matches.push({
      goals: explainValue(stats, "goals_scored"),
      assists: explainValue(stats, "assists"),
      cleanSheets: explainValue(stats, "clean_sheets"),
      saves: explainValue(stats, "saves"),
      minutes,
    })
  }
  return matches
}

/**
 * FPL live scoring is per gameweek; a double GW can look like a brace when it was 1+1.
 * Haul labels must use one fixture.
 */
function matchReturnsFromStats(stats: unknown): FplMatchReturns | null {
  const rec = asRecord(stats)
  if (!rec) return null
  const minutes = num(rec.minutes) ?? 0
  if (minutes <= 0) return null
  return {
    goals: num(rec.goals_scored) ?? 0,
    assists: num(rec.assists) ?? 0,
    cleanSheets: num(rec.clean_sheets) ?? 0,
    saves: num(rec.saves) ?? 0,
    minutes,
  }
}

function bestSingleMatch(matches: FplMatchReturns[]): FplMatchReturns | null {
  if (!matches.length) return null
  return [...matches].sort(
    (a, b) => b.goals - a.goals || b.assists - a.assists || b.minutes - a.minutes,
  )[0] ?? null
}

async function loadEventLive(eventId: number): Promise<Map<number, FplMatchReturns>> {
  const byId = new Map<number, FplMatchReturns>()
  const liveRes = await fetch(`https://fantasy.premierleague.com/api/event/${eventId}/live/`, {
    next: { revalidate: 120 },
    headers: FPL_HEADERS,
  }).catch(() => null)
  if (!liveRes?.ok) return byId
  const liveJson: unknown = await liveRes.json().catch(() => null)
  const liveRoot = asRecord(liveJson)
  const elements = liveRoot && Array.isArray(liveRoot.elements) ? liveRoot.elements : []
  for (const row of elements) {
    const rec = asRecord(row)
    if (!rec) continue
    const id = num(rec.id)
    if (id == null) continue
    const best = bestSingleMatch(matchReturnsFromExplain(rec.explain)) ?? matchReturnsFromStats(rec.stats)
    if (best) byId.set(id, best)
  }
  return byId
}

export function foldName(value: string): string {
  return value
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ø/g, "o")
    .replace(/ł/g, "l")
    .replace(/đ/g, "d")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
}

function fold(value: string): string {
  return foldName(value)
}

/**
 * Loads the live FPL bootstrap and indexes players by team + folded name.
 */
export async function loadFplIndex(eventId?: number | null): Promise<FplIndex> {
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/", {
    next: { revalidate: 120 },
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
  })
  const empty = { byKey: new Map<string, FplElement>(), elements: [] as FplElement[], eventFinished: false }
  if (!res.ok) return empty
  const json: unknown = await res.json().catch(() => null)
  const root = asRecord(json)
  if (!root) return empty
  const teams = new Map<number, { short: string; badge: number | null }>()
  for (const row of Array.isArray(root.teams) ? root.teams : []) {
    const rec = asRecord(row)
    if (!rec) continue
    const id = num(rec.id)
    if (id == null) continue
    teams.set(id, { short: str(rec.short_name), badge: num(rec.code) })
  }
  const eventRows = (Array.isArray(root.events) ? root.events : []).map(asRecord)
  const current = eventRows.find((row) => row && row.is_current === true)
  const liveEvent = eventId ?? (current ? num(current.id) : null)
  const target = eventRows.find((row) => row && num(row.id) === liveEvent)
  const eventFinished = Boolean(target && (target.finished === true || target.data_checked === true))
  const liveById = liveEvent != null ? await loadEventLive(liveEvent) : new Map<number, FplMatchReturns>()
  const elements: FplElement[] = []
  const byKey = new Map<string, FplElement>()
  for (const row of Array.isArray(root.elements) ? root.elements : []) {
    const rec = asRecord(row)
    if (!rec) continue
    const teamId = num(rec.team)
    const club = teamId != null ? teams.get(teamId) : undefined
    const team = club?.short ?? ""
    const id = num(rec.id) ?? 0
    const el: FplElement = {
      id,
      code: num(rec.code),
      badge: club?.badge ?? null,
      webName: str(rec.web_name),
      firstName: str(rec.first_name),
      secondName: str(rec.second_name),
      team,
      news: str(rec.news),
      chance: num(rec.chance_of_playing_this_round),
      minutes: num(rec.minutes) ?? 0,
      status: str(rec.status, "a"),
      goals: num(rec.goals_scored) ?? 0,
      assists: num(rec.assists) ?? 0,
      cleanSheets: num(rec.clean_sheets) ?? 0,
      saves: num(rec.saves) ?? 0,
      lastMatch: liveById.get(id) ?? null,
    }
    elements.push(el)
    const names = [
      el.webName,
      `${el.firstName} ${el.secondName}`,
      el.secondName,
      el.secondName.split(/\s+/).filter(Boolean).slice(-1)[0] ?? "",
      `${el.firstName} ${el.secondName.split(/\s+/).filter(Boolean).slice(-1)[0] ?? ""}`,
    ]
    for (const name of names) {
      const foldedName = fold(name)
      if (!foldedName) continue
      const key = `${canonicalClub(team)}|${foldedName}`
      if (!byKey.has(key)) byKey.set(key, el)
    }
  }
  return { byKey, elements, eventFinished }
}

function lastToken(value: string): string {
  return fold(value.split(/\s+/).filter(Boolean).slice(-1)[0] ?? "")
}

function firstToken(value: string): string {
  return fold(value.split(/\s+/).filter(Boolean)[0] ?? "")
}

/**
 * Matches a Fantrax player to an FPL element using club + folded name.
 * Fantrax uses BRF/NOT; FPL uses BRE/NFO — both sides are canonicalized.
 */
export function matchFplPlayer(index: FplIndex, name: string, team: string): FplElement | null {
  const club = canonicalClub(team)
  const folded = fold(name)
  if (!folded) return null
  const exact = index.byKey.get(`${club}|${folded}`)
  if (exact) return exact
  const last = lastToken(name)
  const first = firstToken(name)
  const teamMates = index.elements.filter((el) => canonicalClub(el.team) === club)
  const lastHits = last
    ? teamMates.filter((el) => {
        const second = fold(el.secondName)
        return (
          lastToken(el.secondName) === last ||
          fold(el.webName) === last ||
          lastToken(el.webName) === last ||
          (last.length >= 5 && second.includes(last))
        )
      })
    : []
  if (lastHits.length === 1) return lastHits[0] ?? null
  if (lastHits.length > 1 && first) {
    const named = lastHits.filter(
      (el) => firstToken(el.firstName) === first || fold(el.webName).startsWith(first),
    )
    if (named.length === 1) return named[0] ?? null
  }
  const onClub = teamMates.find((el) => {
    const web = fold(el.webName)
    return (web.length >= 4 && folded.includes(web)) || lastToken(el.secondName) === last
  })
  if (onClub && lastHits.length <= 1) return onClub
  const unique = index.elements.filter((el) => {
    const firstLast = fold(`${el.firstName} ${el.secondName.split(/\s+/).filter(Boolean).slice(-1)[0] ?? ""}`)
    return fold(el.webName) === folded || fold(`${el.firstName} ${el.secondName}`) === folded || firstLast === folded
  })
  return unique.length === 1 ? unique[0] ?? null : null
}

/** Official Premier League headshot from the FPL photo code. Prefer 250×250; 110×140 exists more often. */
export function fplPhotoUrl(code: number | null | undefined, size: "40x40" | "110x140" | "250x250" = "250x250"): string | null {
  if (code == null || code <= 0) return null
  return `https://resources.premierleague.com/premierleague/photos/players/${size}/p${code}.png`
}

export function fplCrestUrl(badge: number | null | undefined): string | null {
  if (badge == null || badge <= 0) return null
  return `https://resources.premierleague.com/premierleague/badges/t${badge}.png`
}
