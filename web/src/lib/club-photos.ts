// Description: Current-kit portraits scraped from official club squad pages (cached).

import { canonicalClub } from "./clubs"
import { foldName } from "./fpl"

const SQUAD_PAGES: Array<{ club: string; url: string }> = [
  { club: "LIV", url: "https://www.liverpoolfc.com/team/mens" },
  { club: "MUN", url: "https://www.manutd.com/en/players-and-staff/first-team" },
  { club: "LEE", url: "https://www.leedsunited.com/en/teams/mens" },
  { club: "NEW", url: "https://www.newcastleunited.com/en/teams/mens-team" },
  { club: "TOT", url: "https://www.tottenhamhotspur.com/teams/mens" },
  { club: "AVL", url: "https://www.avfc.co.uk/teams/first-team/" },
  { club: "EVE", url: "https://www.evertonfc.com/team/first-team" },
  { club: "HUL", url: "https://www.wearehullcity.co.uk/squad/" },
  { club: "BOU", url: "https://www.afcb.co.uk/teams/first-team/" },
  { club: "FUL", url: "https://www.fulhamfc.com/players/" },
]

const HEADERS = {
  Accept: "text/html,application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
}

function absoluteUrl(src: string, pageUrl: string): string {
  const cleaned = src.replace(/&amp;/g, "&").trim()
  if (cleaned.startsWith("//")) return `https:${cleaned}`
  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) return cleaned
  try {
    return new URL(cleaned, pageUrl).toString()
  } catch {
    return cleaned
  }
}

function isPhotoUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) && /\.(png|jpe?g|webp)(\?|$)/i.test(value)
}

function imageFromUnknown(value: unknown, depth = 0): string | null {
  if (depth > 6 || value == null) return null
  if (typeof value === "string") return isPhotoUrl(value) ? value : null
  if (typeof value !== "object") return null
  const rec = value as Record<string, unknown>
  if (rec.sizes && typeof rec.sizes === "object") {
    const sizes = rec.sizes as Record<string, unknown>
    for (const key of ["md", "sm", "xs", "lg", "xl"]) {
      const hit = imageFromUnknown(sizes[key], depth + 1)
      if (hit) return hit
    }
  }
  for (const key of ["webpUrl", "url", "src", "profileImage", "image", "headshot", "thumbnail"]) {
    const hit = imageFromUnknown(rec[key], depth + 1)
    if (hit) return hit
  }
  return null
}

function displayName(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 1) return value.trim()
  if (!value || typeof value !== "object") return null
  const rec = value as Record<string, unknown>
  for (const key of ["display", "full", "fullName", "displayName", "name"]) {
    const hit = displayName(rec[key])
    if (hit) return hit
  }
  return null
}

function walkJson(node: unknown, seen: WeakSet<object>, out: Array<{ name: string; url: string }>): void {
  if (node == null || typeof node !== "object") return
  if (seen.has(node)) return
  seen.add(node)
  if (Array.isArray(node)) {
    for (const row of node) walkJson(row, seen, out)
    return
  }
  const rec = node as Record<string, unknown>
  const name = displayName(rec.name) ?? displayName(rec.displayName) ?? displayName(rec.fullName)
  const url =
    imageFromUnknown(rec.profileImage) ??
    imageFromUnknown(rec.image) ??
    imageFromUnknown(rec.headshot) ??
    imageFromUnknown(rec.thumbnail)
  if (name && url) out.push({ name, url })
  for (const value of Object.values(rec)) walkJson(value, seen, out)
}

function nameFromAlt(alt: string): string | null {
  let text = alt.replace(/\s+/g, " ").trim()
  text = text.replace(/^IMAGE\s*-\s*/i, "")
  text = text.replace(/\s*-\s*Square$/i, "")
  text = text.replace(/^(Player Profile|Profile)\s*:\s*/i, "")
  text = text.replace(/\s+Image$/i, "")
  text = text.replace(/-removebg.*$/i, "")
  text = text.replace(/-\d{2,}.*$/, "")
  if (/celebrat|logo|sponsor|ticket|stadium|group |video |crest|badge/i.test(text)) return null
  const words = text.split(" ").filter(Boolean)
  if (words.length < 2 || words.length > 5) return null
  if (!words.every((word) => /^[\p{L}'’.-]+$/u.test(word))) return null
  return text
}

function parseSquadHtml(html: string, pageUrl: string): Array<{ name: string; url: string }> {
  const found: Array<{ name: string; url: string }> = []
  const next = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)
  if (next?.[1]) {
    try {
      const payload: unknown = JSON.parse(next[1])
      const players = (payload as { props?: { pageProps?: { players?: unknown } } }).props?.pageProps?.players
      walkJson(Array.isArray(players) ? players : payload, new WeakSet(), found)
    } catch {
      /* ignore malformed next data */
    }
  }
  for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
    const raw = tag[0] ?? ""
    const alt = raw.match(/\balt=["']([^"']*)["']/i)?.[1]
    const src = raw.match(/\b(?:src|data-src|data-lazy-src)=["']([^"']+)["']/i)?.[1]
    if (!alt || !src) continue
    const name = nameFromAlt(alt)
    if (!name) continue
    const url = absoluteUrl(src.split(/\s+/)[0] ?? src, pageUrl)
    if (isPhotoUrl(url)) found.push({ name, url })
  }
  return found
}

function indexPhotos(club: string, rows: Array<{ name: string; url: string }>): Array<[string, string]> {
  const code = canonicalClub(club)
  const entries: Array<[string, string]> = []
  for (const row of rows) {
    const folded = foldName(row.name)
    const last = foldName(row.name.split(/\s+/).filter(Boolean).slice(-1)[0] ?? "")
    if (folded) entries.push([`${code}|${folded}`, row.url])
    if (last && last !== folded) entries.push([`${code}|${last}`, row.url])
  }
  return entries
}

async function loadSquadPage(club: string, url: string): Promise<Array<[string, string]>> {
  const res = await fetch(url, {
    headers: HEADERS,
    next: { revalidate: 60 * 60 * 6 },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) return []
  const html = await res.text()
  return indexPhotos(club, parseSquadHtml(html, res.url || url))
}

export type ClubPhotoIndex = Map<string, string>

export async function loadClubPhotoIndex(): Promise<ClubPhotoIndex> {
  const settled = await Promise.allSettled(SQUAD_PAGES.map((row) => loadSquadPage(row.club, row.url)))
  const index: ClubPhotoIndex = new Map()
  for (const result of settled) {
    if (result.status !== "fulfilled") continue
    for (const [key, url] of result.value) {
      if (!index.has(key)) index.set(key, url)
    }
  }
  return index
}

export function lookupClubPhoto(index: ClubPhotoIndex | undefined, name: string, team: string): string | undefined {
  if (!index?.size) return undefined
  const club = canonicalClub(team)
  const folded = foldName(name)
  if (!folded) return undefined
  const exact = index.get(`${club}|${folded}`)
  if (exact) return exact
  const last = foldName(name.split(/\s+/).filter(Boolean).slice(-1)[0] ?? "")
  if (last && last !== folded) return index.get(`${club}|${last}`)
  return undefined
}
