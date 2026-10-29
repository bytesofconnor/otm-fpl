import { weekChrome, weekPhaseFromSnapshot } from "@/lib/scoring-week"

declare const cardKeyBrand: unique symbol

export type CardKey = string & { readonly [cardKeyBrand]: typeof cardKeyBrand }

export type CardSource =
  | {
      readonly kind: "matchup"
      readonly leagueId: string
      readonly teamId: string
      readonly period: number
    }
  | {
      readonly kind: "scout"
      readonly leagueId: string
      readonly teamId: string
      readonly playerId: string
    }

const PERIOD_MAX = 38

function mint(value: string): CardKey {
  return value as CardKey
}

export function cardKey(source: CardSource): CardKey {
  if (source.kind === "matchup") {
    return mint(
      `m~${encodeURIComponent(source.leagueId)}~${encodeURIComponent(source.teamId)}~${source.period}`,
    )
  }
  return mint(
    `p~${encodeURIComponent(source.leagueId)}~${encodeURIComponent(source.teamId)}~${encodeURIComponent(source.playerId)}`,
  )
}

function part(value: string): string | null {
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    decoded = value
  }
  if (decoded.trim() === "") return null
  return decoded
}

export function parseCardKey(segment: string): CardSource | null {
  try {
    const bits = segment.split("~")
    if (bits.length !== 4) return null
    const [kind, leagueRaw, teamRaw, rest] = bits
    if (leagueRaw == null || teamRaw == null || rest == null) return null
    const leagueId = part(leagueRaw)
    const teamId = part(teamRaw)
    if (!leagueId || !teamId) return null
    if (kind === "m") {
      if (!/^(?:[1-9]|[1-2]\d|3[0-8])$/.test(rest)) return null
      const period = Number(rest)
      if (!Number.isInteger(period) || period < 1 || period > PERIOD_MAX) return null
      return { kind: "matchup", leagueId, teamId, period }
    }
    if (kind === "p") {
      const playerId = part(rest)
      if (!playerId) return null
      return { kind: "scout", leagueId, teamId, playerId }
    }
    return null
  } catch {
    return null
  }
}

export function cardPath(key: CardKey): string {
  return `/card/${key}`
}

export type ShareReceipt = "shared" | "copied" | "cancelled" | "failed"

export type ShareHost = {
  share?: (data: { title: string; text: string; url: string }) => Promise<void>
  copy?: (url: string) => Promise<void>
  origin?: string
}

const SHEET_TITLE = "Over the Moon"

function sheetText(key: CardKey): string {
  return parseCardKey(key)?.kind === "scout" ? "Scout recommendation" : "League matchup"
}

function isAbort(err: unknown): boolean {
  return typeof err === "object" && err !== null && "name" in err && err.name === "AbortError"
}

function shareFn(host: ShareHost | undefined): ShareHost["share"] | undefined {
  if (host) return host.share
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const share = navigator.share.bind(navigator)
    return (data) => share(data)
  }
  return undefined
}

async function writeClipboard(url: string): Promise<void> {
  if (typeof navigator === "undefined" || navigator.clipboard?.writeText == null) {
    throw new Error("clipboard")
  }
  await navigator.clipboard.writeText(url)
}

export async function presentShare(key: CardKey, host?: ShareHost): Promise<ShareReceipt> {
  const origin = host?.origin ?? (typeof window !== "undefined" ? window.location.origin : "")
  const url = `${origin}${cardPath(key)}`
  const share = shareFn(host)
  if (share) {
    try {
      await share({ title: SHEET_TITLE, text: sheetText(key), url })
      return "shared"
    } catch (err) {
      if (isAbort(err)) return "cancelled"
      return "failed"
    }
  }
  try {
    await (host?.copy ?? writeClipboard)(url)
    return "copied"
  } catch {
    return "failed"
  }
}

export type SlateScoreInput = ReadonlyArray<{
  homeScore: string | null
  awayScore: string | null
  homeProjected: string | null
  awayProjected: string | null
}>

export type MatchupScoreInput = {
  homeScore: string | null
  awayScore: string | null
  homeProjected: string | null
  awayProjected: string | null
}

export type MatchupFigures = {
  isCurrentWeek: boolean
  badge: "live" | "final" | null
  label: "Live" | "Final" | "Projected"
  showActuals: boolean
  showProjLine: boolean
  home: string
  away: string
  proj: string | null
}

const EM = "—"
const EN = "–"

function present(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function sideFigure(showActuals: boolean, actual: string | null, projected: string | null): string {
  if (showActuals) return present(actual) ?? "0"
  return present(projected) ?? EM
}

export function formFigure(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return EM
  return value.toFixed(1)
}

export function matchupFigures(
  slate: SlateScoreInput,
  matchup: MatchupScoreInput | null,
  viewedPeriod: number | null,
  currentPeriod: number | null,
): MatchupFigures {
  const isCurrentWeek = (viewedPeriod ?? currentPeriod) === currentPeriod
  const chrome = weekChrome(weekPhaseFromSnapshot([...slate], matchup), isCurrentWeek)
  const homeProjected = present(matchup?.homeProjected ?? null)
  const awayProjected = present(matchup?.awayProjected ?? null)
  const proj =
    chrome.showProjLine && (homeProjected || awayProjected)
      ? `proj ${homeProjected ?? EM} ${EN} ${awayProjected ?? EM}`
      : null
  return {
    isCurrentWeek,
    badge: chrome.badge,
    label: chrome.label,
    showActuals: chrome.showActuals,
    showProjLine: chrome.showProjLine,
    home: sideFigure(chrome.showActuals, matchup?.homeScore ?? null, matchup?.homeProjected ?? null),
    away: sideFigure(chrome.showActuals, matchup?.awayScore ?? null, matchup?.awayProjected ?? null),
    proj,
  }
}
