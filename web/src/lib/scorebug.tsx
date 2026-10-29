import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import type { HeatBucket } from "@/lib/form-engine"
import {
  computeFormScore,
  computeMinutesStability,
  gameweeksSinceLastReturn,
  heatLabel,
  type FormScore,
} from "@/lib/form-engine"
import type { FantraxPlayerSeries, FantraxPoolPlayer, FantraxRosterPlayer } from "@/lib/fantrax-shared"
import {
  determineConfidence,
  generateKillConditions,
  type ConfidenceLevel,
} from "@/lib/scout-config"
import {
  cardKey,
  formFigure,
  matchupFigures,
  parseCardKey,
  type CardKey,
  type CardSource,
  type MatchupScoreInput,
  type SlateScoreInput,
} from "@/lib/scorebug-key"

declare const scorebugBrand: unique symbol

export type ScorebugTone = "live" | "final" | "projected" | "heat" | "absent"

export type Scorebug = {
  readonly [scorebugBrand]: true
  readonly key: CardKey
  readonly line: string
  readonly kicker: string
  readonly badge: string
  readonly accent: string
  readonly tone: ScorebugTone
  readonly homeName: string
  readonly homeDetail: string
  readonly homeFigure: string
  readonly awayName: string
  readonly awayDetail: string
  readonly awayFigure: string
  readonly foot: string
}

export type BroadcastLine = {
  readonly position: string
  readonly home: string
  readonly away: string
  readonly homeFigure: string
  readonly awayFigure: string
}

export type MatchupBoard = {
  readonly kind: "matchup"
  readonly leagueId: string
  readonly teamId: string
  readonly period: number
  readonly periodCount: number
  readonly periodLabel: string
  readonly lines: readonly BroadcastLine[]
}

export type ScoutBoard = {
  readonly kind: "scout"
  readonly leagueId: string
  readonly teamId: string
  readonly playerId: string
  readonly onWire: boolean
  readonly whyNow: string
  readonly minutes: string
  readonly beatsName: string
  readonly confidence: ConfidenceLevel | null
  readonly killLine: string
}

export type AbsentBoard = {
  readonly kind: "absent"
  readonly sentence: string
}

export type Broadcast = {
  readonly bug: Scorebug
  readonly board: MatchupBoard | ScoutBoard | AbsentBoard
}

export type MatchupFacts = {
  teamKnown: boolean
  leagueName: string
  teamName: string
  period: number
  periodCount: number
  periodLabel: string
  viewedPeriod: number | null
  currentPeriod: number | null
  slate: SlateScoreInput
  matchup: {
    home: string
    away: string
    homeShort: string | null
    awayShort: string | null
    homeScore: string | null
    awayScore: string | null
    homeProjected: string | null
    awayProjected: string | null
  } | null
  lines: readonly {
    position: string
    home: string
    away: string
    homePoints: number | null
    awayPoints: number | null
  }[]
}

export type ScoutFacts = {
  onWire: boolean
  name: string
  detail: string
  heat: HeatBucket | null
  adjusted: number | null
  beatsName: string | null
  beatsHeat: HeatBucket | null
  beatsScore: number | null
  whyNow: string | null
  minutes: string | null
  confidence: ConfidenceLevel | null
  killLine: string | null
}

export type BroadcastFacts =
  | { readonly kind: "matchup"; readonly facts: MatchupFacts }
  | { readonly kind: "scout"; readonly facts: ScoutFacts }

export type BroadcastLoader = (source: CardSource) => Promise<BroadcastFacts | null>

const EM = "—"
const EN = "–"
const ABSENT = "#a1a1aa"
const LIVE = "#3dcf7a"
const PROJECTED = "#d4b56a"

const HEAT_HEX: Record<HeatBucket, string> = {
  cold: "#3b82f6",
  warm: "#eab308",
  hot: "#f97316",
  fire: "#ef4444",
  burning: "#a855f7",
}

type BugFields = Omit<Scorebug, typeof scorebugBrand>

function seal(fields: BugFields): Scorebug {
  return fields as Scorebug
}

function rawKey(value: string): CardKey {
  return value as CardKey
}

function dash(value: string): string {
  const trimmed = value.trim()
  return trimmed ? trimmed : EM
}

function unavailable(key: CardKey): Broadcast {
  const bug = seal({
    key,
    line: "Score's not up.",
    kicker: "Over the Moon",
    badge: "Unavailable",
    accent: ABSENT,
    tone: "absent",
    homeName: EM,
    homeDetail: "",
    homeFigure: EM,
    awayName: EM,
    awayDetail: "",
    awayFigure: EM,
    foot: "Score's not up.",
  })
  return { bug, board: { kind: "absent", sentence: "Score's not up." } }
}

function unknownSquad(key: CardKey, leagueName: string): Broadcast {
  const bug = seal({
    key,
    line: "Unknown squad",
    kicker: leagueName.trim() || "League",
    badge: "Unknown squad",
    accent: ABSENT,
    tone: "absent",
    homeName: "Unknown squad",
    homeDetail: "",
    homeFigure: EM,
    awayName: EM,
    awayDetail: "",
    awayFigure: EM,
    foot: "Unknown squad",
  })
  return { bug, board: { kind: "absent", sentence: "Unknown squad" } }
}

function toneFor(label: MatchupFiguresLabel): ScorebugTone {
  if (label === "Live") return "live"
  if (label === "Final") return "final"
  return "projected"
}

type MatchupFiguresLabel = "Live" | "Final" | "Projected"

function accentFor(tone: ScorebugTone): string {
  if (tone === "live") return LIVE
  if (tone === "projected") return PROJECTED
  return ABSENT
}

function fromMatchup(key: CardKey, source: Extract<CardSource, { kind: "matchup" }>, facts: MatchupFacts): Broadcast {
  if (!facts.teamKnown) return unknownSquad(key, facts.leagueName)
  const score: MatchupScoreInput | null = facts.matchup
  const figures = matchupFigures(facts.slate, score, facts.viewedPeriod, facts.currentPeriod)
  const tone = toneFor(figures.label)
  if (!facts.matchup) {
    const name = dash(facts.teamName)
    const bug = seal({
      key,
      line: `${name} ${EN} No matchup this week.`,
      kicker: facts.periodLabel.trim() || `GW${facts.period}`,
      badge: figures.label,
      accent: accentFor(tone),
      tone,
      homeName: name,
      homeDetail: "",
      homeFigure: EM,
      awayName: EM,
      awayDetail: "",
      awayFigure: EM,
      foot: "No matchup this week.",
    })
    return {
      bug,
      board: {
        kind: "matchup",
        leagueId: source.leagueId,
        teamId: source.teamId,
        period: facts.period,
        periodCount: facts.periodCount,
        periodLabel: facts.periodLabel,
        lines: [],
      },
    }
  }
  const homeName = dash(facts.matchup.home)
  const awayName = dash(facts.matchup.away)
  const bug = seal({
    key,
    line: `${homeName} ${figures.home}${EN}${figures.away} ${awayName}`,
    kicker: facts.periodLabel.trim() || `GW${facts.period}`,
    badge: figures.label,
    accent: accentFor(tone),
    tone,
    homeName,
    homeDetail: facts.matchup.homeShort?.trim() ?? "",
    homeFigure: figures.home,
    awayName,
    awayDetail: facts.matchup.awayShort?.trim() ?? "",
    awayFigure: figures.away,
    foot: figures.proj ?? (facts.leagueName.trim() || "League"),
  })
  return {
    bug,
    board: {
      kind: "matchup",
      leagueId: source.leagueId,
      teamId: source.teamId,
      period: facts.period,
      periodCount: facts.periodCount,
      periodLabel: facts.periodLabel,
      lines: facts.lines.map((row) => ({
        position: row.position,
        home: dash(row.home),
        away: dash(row.away),
        homeFigure: formFigure(row.homePoints),
        awayFigure: formFigure(row.awayPoints),
      })),
    },
  }
}

function fromScout(key: CardKey, source: Extract<CardSource, { kind: "scout" }>, facts: ScoutFacts): Broadcast {
  const boardBase = {
    kind: "scout" as const,
    leagueId: source.leagueId,
    teamId: source.teamId,
    playerId: source.playerId,
  }
  if (!facts.onWire || facts.heat == null) {
    const name = dash(facts.name)
    const bug = seal({
      key,
      line: facts.name.trim() ? `${facts.name.trim()} · Off the wire` : "Off the wire",
      kicker: "Scout",
      badge: "Off the wire",
      accent: ABSENT,
      tone: "absent",
      homeName: name,
      homeDetail: facts.detail.trim(),
      homeFigure: EM,
      awayName: EM,
      awayDetail: "",
      awayFigure: EM,
      foot: "Off the wire",
    })
    return {
      bug,
      board: {
        ...boardBase,
        onWire: false,
        whyNow: "",
        minutes: "",
        beatsName: "",
        confidence: null,
        killLine: "",
      },
    }
  }
  const badge = heatLabel(facts.heat)
  const figure = formFigure(facts.adjusted)
  const beatsName = facts.beatsName?.trim() ?? ""
  const bug = seal({
    key,
    line: `${dash(facts.name)} · ${badge} ${figure}`,
    kicker: "Scout",
    badge,
    accent: HEAT_HEX[facts.heat],
    tone: "heat",
    homeName: dash(facts.name),
    homeDetail: facts.detail.trim(),
    homeFigure: figure,
    awayName: beatsName ? beatsName : EM,
    awayDetail: facts.beatsHeat ? heatLabel(facts.beatsHeat) : "",
    awayFigure: formFigure(facts.beatsScore),
    foot: facts.whyNow?.trim() || badge,
  })
  return {
    bug,
    board: {
      ...boardBase,
      onWire: true,
      whyNow: facts.whyNow?.trim() ?? "",
      minutes: facts.minutes?.trim() ?? "",
      beatsName,
      confidence: facts.confidence,
      killLine: facts.killLine?.trim() ?? "",
    },
  }
}

function rosterForm(player: FantraxPlayerSeries): FormScore {
  const recentGWs = player.points.slice(0, 3).map((pt) => pt.value)
  const recentMinutes = player.minutes.slice(0, 3)
  return computeFormScore({
    lastGW: recentGWs[0] ?? null,
    priorGW: recentGWs[1] ?? null,
    prior2GW: recentGWs[2] ?? null,
    minutesStability: computeMinutesStability(recentMinutes),
    startRate: 0.5,
    projBeat: false,
    gameweeksSinceLastReturn: gameweeksSinceLastReturn(recentGWs),
  })
}

function poolForm(player: FantraxPoolPlayer): FormScore {
  const projectedPts = player.points ?? 0
  let estimatedLastGW = projectedPts
  if (player.playedMinutes != null && player.playedMinutes > 0) {
    estimatedLastGW = projectedPts > 0 ? projectedPts : 5
  }
  const hasRecentStarts = player.playedMinutes != null && player.playedMinutes >= 60
  return computeFormScore({
    lastGW: estimatedLastGW > 0 ? estimatedLastGW : null,
    priorGW: null,
    prior2GW: null,
    minutesStability: player.playedMinutes && player.playedMinutes >= 60 ? 1.5 : 0.5,
    startRate: hasRecentStarts ? 0.9 : 0.5,
    projBeat: false,
    gameweeksSinceLastReturn: estimatedLastGW > 0 ? 0 : 2,
  })
}

function whyNowLine(player: FantraxPoolPlayer, formScore: number): string {
  const reasons: string[] = []
  if (formScore >= 61) reasons.push("Elite form")
  else if (formScore >= 36) reasons.push("Hot form")
  else if (formScore >= 16) reasons.push("Recent returns")
  if (player.stats) {
    const goals = player.stats.find((s) => s.code === "G")?.value ?? 0
    const assists = player.stats.find((s) => s.code === "AT")?.value ?? 0
    const cleanSheets = player.stats.find((s) => s.code === "CS")?.value ?? 0
    if (goals >= 2) reasons.push(`${goals}G`)
    if (assists >= 2) reasons.push(`${assists}A`)
    if (cleanSheets >= 1 && player.position.startsWith("D")) reasons.push(`${cleanSheets}CS`)
  }
  if (player.availability === "starting") reasons.push("nailed starter")
  else if (player.availability === "expected") reasons.push("expected to start")
  if (player.points != null && player.points >= 8) reasons.push(`${player.points.toFixed(1)} proj`)
  if (reasons.length === 0) reasons.push("Available pickup")
  return reasons.slice(0, 3).join(", ")
}

function minutesLine(player: FantraxPoolPlayer): string | null {
  if (player.playedMinutes != null && player.playedMinutes > 0) return `${player.playedMinutes}′ played`
  if (player.availability === "starting") return "Expected starter"
  return null
}

function benchToBeat(
  available: FantraxPoolPlayer,
  roster: readonly FantraxPlayerSeries[],
  rosterForms: Map<string, FormScore>,
): { player: FantraxPlayerSeries; form: FormScore } | null {
  const samePosition = roster.filter((player) => {
    const availPos = available.position.charAt(0).toUpperCase()
    const rosterPos = player.position.charAt(0).toUpperCase()
    return availPos === rosterPos
  })
  if (samePosition.length === 0) return null
  const benchCandidates = samePosition
    .map((player) => ({
      player,
      form: rosterForms.get(player.id) ?? rosterForm(player),
      isBench: player.status === "RESERVE" || player.status === "IR",
    }))
    .sort((a, b) => {
      if (a.isBench && !b.isBench) return -1
      if (!a.isBench && b.isBench) return 1
      return a.form.score - b.form.score
    })
  return benchCandidates[0] ?? null
}

function playerLine(position: string, home: FantraxRosterPlayer | null, away: FantraxRosterPlayer | null) {
  return {
    position,
    home: home?.name ?? "",
    away: away?.name ?? "",
    homePoints: home?.points ?? null,
    awayPoints: away?.points ?? null,
  }
}

async function loadMatchupFacts(source: Extract<CardSource, { kind: "matchup" }>): Promise<BroadcastFacts> {
  const { loadFantraxLeague } = await import("@/lib/fantrax")
  const snap = await loadFantraxLeague(source.leagueId, source.teamId, source.period)
  const team = snap.teams.find((row) => row.id === source.teamId)
  const raw = snap.matchup
  const owned = raw != null && (raw.homeId === source.teamId || raw.awayId === source.teamId)
  const matchup = owned && raw ? raw : null
  const lines = matchup
    ? [
        ...matchup.lines.map((line) => playerLine(line.position, line.home, line.away)),
        ...Array.from({ length: Math.max(matchup.homeBench.length, matchup.awayBench.length) }, (_, index) =>
          playerLine("BN", matchup.homeBench[index] ?? null, matchup.awayBench[index] ?? null),
        ),
      ]
    : []
  return {
    kind: "matchup",
    facts: {
      teamKnown: team != null,
      leagueName: snap.leagueName,
      teamName: team?.name ?? "",
      period: source.period,
      periodCount: snap.periodCount,
      periodLabel: snap.viewedPeriod === source.period ? snap.periodLabel : `GW${source.period}`,
      viewedPeriod: source.period,
      currentPeriod: snap.currentPeriod,
      slate: snap.slate,
      matchup: matchup
        ? {
            home: matchup.home,
            away: matchup.away,
            homeShort: matchup.homeShort ?? null,
            awayShort: matchup.awayShort ?? null,
            homeScore: matchup.homeScore,
            awayScore: matchup.awayScore,
            homeProjected: matchup.homeProjected,
            awayProjected: matchup.awayProjected,
          }
        : null,
      lines,
    },
  }
}

async function loadScoutFacts(source: Extract<CardSource, { kind: "scout" }>): Promise<BroadcastFacts> {
  const { loadFantraxForm } = await import("@/lib/fantrax")
  const form = await loadFantraxForm(source.leagueId, source.teamId)
  const wire = form.unowned.find(
    (player) => player.id === source.playerId && (player.wire === "FA" || player.wire === "WW"),
  )
  if (!wire) {
    const named =
      form.players.find((player) => player.id === source.playerId) ??
      form.unowned.find((player) => player.id === source.playerId) ??
      form.leagueOwned.find((player) => player.id === source.playerId)
    return {
      kind: "scout",
      facts: {
        onWire: false,
        name: named?.name ?? "",
        detail: named?.team ?? "",
        heat: null,
        adjusted: null,
        beatsName: null,
        beatsHeat: null,
        beatsScore: null,
        whyNow: null,
        minutes: null,
        confidence: null,
        killLine: null,
      },
    }
  }
  const rosterForms = new Map<string, FormScore>()
  for (const player of form.players) rosterForms.set(player.id, rosterForm(player))
  const formScore = poolForm(wire)
  let adjustment = 0
  try {
    const { getFixtureContext } = await import("@/lib/fixtures")
    const context = await getFixtureContext(wire.team)
    adjustment = context?.difficultyAdjustment ?? 0
  } catch {
    adjustment = 0
  }
  const adjusted = formScore.score + adjustment
  const bench = benchToBeat(wire, form.players, rosterForms)
  const gap = bench ? adjusted - bench.form.score : 0
  const hasRecentStarts = wire.playedMinutes != null && wire.playedMinutes >= 60
  const hasInjuryNews = Boolean(wire.availability === "injured" || wire.availability === "out" || wire.news)
  const confidence = bench
    ? determineConfidence(gap, hasRecentStarts ? 3 : 1, hasInjuryNews)
    : null
  const killLine = generateKillConditions(hasInjuryNews, wire.availability).join(" · ")
  return {
    kind: "scout",
    facts: {
      onWire: true,
      name: wire.name,
      detail: wire.team,
      heat: formScore.heat,
      adjusted,
      beatsName: bench?.player.name ?? null,
      beatsHeat: bench?.form.heat ?? null,
      beatsScore: bench?.form.score ?? null,
      whyNow: whyNowLine(wire, formScore.score),
      minutes: minutesLine(wire),
      confidence,
      killLine,
    },
  }
}

async function loadBroadcastFacts(source: CardSource): Promise<BroadcastFacts | null> {
  if (source.kind === "matchup") return loadMatchupFacts(source)
  return loadScoutFacts(source)
}

type BugSlot =
  | { readonly role: "kicker"; readonly text: string }
  | { readonly role: "badge"; readonly text: string; readonly accent: string }
  | { readonly role: "side"; readonly name: string; readonly detail: string; readonly figure: string }
  | { readonly role: "foot"; readonly text: string }

function bugSlots(bug: Scorebug): readonly BugSlot[] {
  return [
    { role: "kicker", text: bug.kicker },
    { role: "badge", text: bug.badge, accent: bug.accent },
    { role: "side", name: bug.homeName, detail: bug.homeDetail, figure: bug.homeFigure },
    { role: "side", name: bug.awayName, detail: bug.awayDetail, figure: bug.awayFigure },
    { role: "foot", text: bug.foot },
  ]
}

const FRAME_W = 1200
const FRAME_H = 630
const FIELD = "#0a0a0a"
const PANEL = "#141414"
const TYPE = "#fafafa"

function ScorebugFrame({ slots }: { slots: readonly BugSlot[] }) {
  const kicker = slots.find((slot) => slot.role === "kicker")
  const badge = slots.find((slot) => slot.role === "badge")
  const foot = slots.find((slot) => slot.role === "foot")
  const accent = badge?.role === "badge" ? badge.accent : ABSENT
  return (
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        background: FIELD,
      }}
    >
      <div style={{ display: "flex", background: PANEL, color: TYPE }}>
        <div style={{ width: "12px", background: accent, display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", width: "1140px", padding: "36px 48px 42px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                fontFamily: "IBM Plex Mono",
                fontSize: 24,
                fontWeight: 500,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: TYPE,
              }}
            >
              {kicker?.role === "kicker" ? kicker.text : " "}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "IBM Plex Mono",
                fontSize: 24,
                fontWeight: 500,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: accent,
              }}
            >
              {badge?.role === "badge" ? badge.text : " "}
            </div>
          </div>
          {slots
            .filter((slot) => slot.role === "side")
            .map((slot, index) =>
              slot.role === "side" ? (
                <div
                  key={`${slot.name}-${slot.figure}-${index}`}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 18 }}
                >
                  <div style={{ display: "flex", flexDirection: "column", width: "860px" }}>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        width: "860px",
                        fontFamily: "Barlow Condensed",
                        fontSize: 64,
                        fontWeight: 700,
                        lineHeight: 1,
                        color: TYPE,
                      }}
                    >
                      {slot.name}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        width: "860px",
                        marginTop: 8,
                        fontFamily: "IBM Plex Mono",
                        fontSize: 22,
                        fontWeight: 500,
                        color: TYPE,
                      }}
                    >
                      {slot.detail || " "}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontFamily: "IBM Plex Mono",
                      fontSize: 64,
                      fontWeight: 500,
                      lineHeight: 1,
                      color: TYPE,
                    }}
                  >
                    {slot.figure}
                  </div>
                </div>
              ) : null,
            )}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              width: "1044px",
              marginTop: 22,
              fontFamily: "IBM Plex Mono",
              fontSize: 24,
              fontWeight: 500,
              color: TYPE,
            }}
          >
            {foot?.role === "foot" ? foot.text : " "}
          </div>
        </div>
      </div>
    </div>
  )
}

function FallbackFrame({ line }: { line: string }) {
  return (
    <div
      style={{
        width: "1200px",
        height: "630px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: FIELD,
        color: TYPE,
        fontSize: 48,
      }}
    >
      {line || " "}
    </div>
  )
}

function fontBytes(bytes: Buffer): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

export async function paintScorebug(bug: Scorebug): Promise<ImageResponse> {
  const slots = bugSlots(bug)
  try {
    const [display, mono] = await Promise.all([
      readFile(join(process.cwd(), "src/lib/scorebug-fonts/BarlowCondensed-Bold.ttf")),
      readFile(join(process.cwd(), "src/lib/scorebug-fonts/IBMPlexMono-Medium.ttf")),
    ])
    return new ImageResponse(<ScorebugFrame slots={slots} />, {
      width: FRAME_W,
      height: FRAME_H,
      fonts: [
        { name: "Barlow Condensed", data: fontBytes(display), weight: 700, style: "normal" },
        { name: "IBM Plex Mono", data: fontBytes(mono), weight: 500, style: "normal" },
      ],
    })
  } catch {
    try {
      return new ImageResponse(<FallbackFrame line={bug.line} />, { width: FRAME_W, height: FRAME_H })
    } catch {
      return new ImageResponse(<div style={{ width: "1200px", height: "630px", display: "flex", background: FIELD }} />, {
        width: FRAME_W,
        height: FRAME_H,
      })
    }
  }
}

export async function readScorebug(key: string, load?: BroadcastLoader): Promise<Broadcast> {
  let source: CardSource | null = null
  try {
    source = parseCardKey(key)
  } catch {
    source = null
  }
  if (!source) return unavailable(rawKey(key))
  const minted = cardKey(source)
  const loader = load ?? loadBroadcastFacts
  try {
    const facts = await loader(source)
    if (!facts || facts.kind !== source.kind) return unavailable(minted)
    if (facts.kind === "matchup" && source.kind === "matchup") return fromMatchup(minted, source, facts.facts)
    if (facts.kind === "scout" && source.kind === "scout") return fromScout(minted, source, facts.facts)
    return unavailable(minted)
  } catch {
    return unavailable(minted)
  }
}
