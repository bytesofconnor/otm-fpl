// Description: Live FPL bootstrap helpers for news, minutes chance, and Fantrax name matching.

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

export type FplElement = {
  id: number
  webName: string
  firstName: string
  secondName: string
  team: string
  news: string
  chance: number | null
  minutes: number
  status: string
}

type FplIndex = {
  byKey: Map<string, FplElement>
  elements: FplElement[]
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
}

/**
 * Loads the live FPL bootstrap and indexes players by team + folded name.
 */
export async function loadFplIndex(): Promise<FplIndex> {
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/", {
    next: { revalidate: 1800 },
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
  })
  if (!res.ok) return { byKey: new Map(), elements: [] }
  const json: unknown = await res.json().catch(() => null)
  const root = asRecord(json)
  if (!root) return { byKey: new Map(), elements: [] }
  const teams = new Map<number, string>()
  for (const row of Array.isArray(root.teams) ? root.teams : []) {
    const rec = asRecord(row)
    if (!rec) continue
    const id = num(rec.id)
    if (id == null) continue
    teams.set(id, str(rec.short_name))
  }
  const elements: FplElement[] = []
  const byKey = new Map<string, FplElement>()
  for (const row of Array.isArray(root.elements) ? root.elements : []) {
    const rec = asRecord(row)
    if (!rec) continue
    const teamId = num(rec.team)
    const team = teamId != null ? teams.get(teamId) ?? "" : ""
    const el: FplElement = {
      id: num(rec.id) ?? 0,
      webName: str(rec.web_name),
      firstName: str(rec.first_name),
      secondName: str(rec.second_name),
      team,
      news: str(rec.news),
      chance: num(rec.chance_of_playing_this_round),
      minutes: num(rec.minutes) ?? 0,
      status: str(rec.status, "a"),
    }
    elements.push(el)
    const names = [el.webName, `${el.firstName} ${el.secondName}`, el.secondName]
    for (const name of names) {
      const key = `${team}|${fold(name)}`
      if (fold(name) && !byKey.has(key)) byKey.set(key, el)
    }
  }
  return { byKey, elements }
}

/**
 * Matches a Fantrax player to an FPL element using club + folded name.
 */
export function matchFplPlayer(index: FplIndex, name: string, team: string): FplElement | null {
  const teamKey = team.toUpperCase()
  const folded = fold(name)
  if (!folded) return null
  const exact = index.byKey.get(`${teamKey}|${folded}`)
  if (exact) return exact
  const last = fold(name.split(" ").slice(-1)[0] ?? "")
  const lastHit = last ? index.byKey.get(`${teamKey}|${last}`) : null
  if (lastHit) return lastHit
  const teamMates = index.elements.filter((el) => el.team === teamKey)
  return teamMates.find((el) => folded.includes(fold(el.webName)) || fold(el.secondName) === last) ?? null
}
