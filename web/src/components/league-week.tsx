// Description: This-week matchup board — facing XIs, availability, bench, and the rest of the slate.
"use client"

import * as React from "react"
import type {
  FantraxMatchup,
  FantraxMatchupLine,
  FantraxRosterPlayer,
  FantraxSlateGame,
  PlayerAvailability,
} from "@/lib/fantrax-shared"
import { remainingPts } from "@/lib/fantrax-shared"
import { ImageWithFallback } from "@/components/ui/image-with-fallback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { copyShare } from "@/lib/share"

const POS: Record<string, string> = { G: "GK", D: "DEF", M: "MID", F: "FWD" }

function pts(value: number | null | undefined): string {
  if (value == null) return "—"
  return value.toFixed(1)
}

function availabilityClass(kind: PlayerAvailability | undefined): string {
  if (kind === "starting") return "text-live"
  if (kind === "out" || kind === "injured") return "text-danger"
  return "text-muted-foreground"
}

function scoreClass(value: number | null | undefined): string {
  if (value == null) return "text-muted-foreground"
  if (value < 0) return "text-danger"
  return "text-foreground"
}

function Crest({ src, alt }: { src?: string; alt: string }): React.ReactElement | null {
  if (!src) return null
  return <ImageWithFallback src={src} alt={alt} className="h-7 w-7 shrink-0 object-contain sm:h-8 sm:w-8" fallback="/favicon.svg" />
}

function PlayerMeta({ player, align }: { player: FantraxRosterPlayer; align: "left" | "right" }): React.ReactElement {
  const fixture = [player.team, player.opponent, player.kickoff].filter(Boolean).join(" · ")
  const status = player.availabilityLabel
  return (
    <div className={`mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[13px] leading-snug text-muted-foreground ${align === "right" ? "justify-end" : ""}`}>
      <span className="truncate">{fixture}</span>
      {status ? (
        <span className={availabilityClass(player.availability)} title={player.news || undefined}>
          {status}
        </span>
      ) : null}
      {player.minutes != null ? <span>{player.minutes}&prime;</span> : null}
      {player.status === "IR" ? <span className="text-danger">IR</span> : null}
    </div>
  )
}

function StatChips({ player }: { player: FantraxRosterPlayer }): React.ReactElement | null {
  if (!player.stats?.length) return null
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {player.stats.map((stat) => (
        <span key={stat.code}>
          {stat.code} <span className="text-foreground">{stat.value.toFixed(1).replace(/\.0$/, "")}</span>
        </span>
      ))}
    </div>
  )
}

function EmptySlot({ align }: { align: "left" | "right" }): React.ReactElement {
  return (
    <div className={`flex min-h-14 items-center px-2 ${align === "right" ? "justify-end" : ""}`}>
      <span className="text-[13px] text-white/55">Empty</span>
    </div>
  )
}

function PlayerBlock({
  player,
  align,
  expanded,
  onToggle,
  hot,
}: {
  player: FantraxRosterPlayer | null
  align: "left" | "right"
  expanded: boolean
  onToggle: () => void
  hot?: boolean
}): React.ReactElement {
  if (!player) return <EmptySlot align={align} />
  const left = remainingPts(player.projected ?? player.points, player.points)
  const meta = [player.availabilityLabel, player.kickoff].filter(Boolean).join(" · ")
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onToggle}
      className={`otm-kit h-auto min-h-[44px] w-full min-w-0 flex-col items-stretch justify-start gap-0 px-2 py-2 text-left hover:bg-white/10 ${
        align === "right" ? "text-right" : "text-left"
      } ${hot ? "otm-kit-hot" : ""}`}
    >
      <div className={`flex items-start gap-2.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <Crest src={player.headshotUrl} alt={player.team} />
        <span className="min-w-0 flex-1 whitespace-normal break-words text-[15px] font-semibold leading-tight tracking-tight text-white sm:text-[16px] line-clamp-2">{player.name}</span>
        <span className="w-[3.5rem] shrink-0 text-right sm:w-[4rem]">
          <span className={`otm-score block text-[1.2rem] leading-none tabular-nums sm:text-[1.45rem] ${hot ? "text-white" : "text-white/90"}`}>
            {pts(player.points)}
          </span>
          {left >= 0.4 ? (
            <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-white/70">+{left.toFixed(1)}</span>
          ) : null}
        </span>
      </div>
      {meta ? (
        <div className={`mt-1 whitespace-normal text-[12px] leading-snug ${availabilityClass(player.availability)} ${align === "right" ? "text-right" : ""}`}>
          {meta}
        </div>
      ) : null}
      {expanded ? (
        <>
          <PlayerMeta player={player} align={align} />
          <StatChips player={player} />
        </>
      ) : null}
    </Button>
  )
}

function groupLines(lines: FantraxMatchupLine[]): Array<{ position: string; lines: FantraxMatchupLine[] }> {
  const groups: Array<{ position: string; lines: FantraxMatchupLine[] }> = []
  for (const line of lines) {
    const last = groups[groups.length - 1]
    if (last && last.position === line.position) last.lines.push(line)
    else groups.push({ position: line.position, lines: [line] })
  }
  return groups
}

function FacingRows({
  lines,
  expandedId,
  setExpandedId,
}: {
  lines: FantraxMatchupLine[]
  expandedId: string | null
  setExpandedId: (id: string | null) => void
}): React.ReactElement {
  return (
    <div>
      {groupLines(lines).map((group) => (
        <div key={group.position}>
          {group.position !== "BN" ? (
            <div className="otm-pitch-line px-1">{POS[group.position] ?? group.position}</div>
          ) : null}
          {group.lines.map((line, i) => {
            const homePts = line.home?.points
            const awayPts = line.away?.points
            const homeHot = homePts != null && awayPts != null && homePts > awayPts
            const awayHot = homePts != null && awayPts != null && awayPts > homePts
            return (
            <div
              key={`${line.position}-${line.home?.id ?? "h"}-${line.away?.id ?? "a"}-${i}`}
              className="grid grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)] items-start gap-1 py-0.5 sm:gap-2"
            >
              <PlayerBlock
                player={line.home}
                align="left"
                hot={homeHot}
                expanded={expandedId === line.home?.id}
                onToggle={() => setExpandedId(expandedId === line.home?.id ? null : line.home?.id ?? null)}
              />
              <span className="mt-5 h-8 w-px justify-self-center bg-white/35" aria-hidden />
              <PlayerBlock
                player={line.away}
                align="right"
                hot={awayHot}
                expanded={expandedId === line.away?.id}
                onToggle={() => setExpandedId(expandedId === line.away?.id ? null : line.away?.id ?? null)}
              />
            </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Bench({ matchup, expandedId, setExpandedId }: { matchup: FantraxMatchup; expandedId: string | null; setExpandedId: (id: string | null) => void }): React.ReactElement | null {
  if (!matchup.homeBench.length && !matchup.awayBench.length) return null
  const n = Math.max(matchup.homeBench.length, matchup.awayBench.length)
  const lines: FantraxMatchupLine[] = Array.from({ length: n }, (_, i) => ({
    position: "BN",
    home: matchup.homeBench[i] ?? null,
    away: matchup.awayBench[i] ?? null,
  }))
  return (
    <div className="mt-2 border-t border-white/25 pt-3">
            <div className="otm-pitch-line mb-1">Bench</div>
      <FacingRows lines={lines} expandedId={expandedId} setExpandedId={setExpandedId} />
    </div>
  )
}

function TeamMark({
  name,
  shortName,
  owner,
  logoUrl,
  align,
  you,
}: {
  name: string
  shortName?: string
  owner?: string
  logoUrl?: string
  align: "left" | "right"
  you?: boolean
}): React.ReactElement {
  return (
    <div className={`flex min-w-0 items-center gap-2.5 sm:gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      {logoUrl ? (
        <ImageWithFallback src={logoUrl} alt="" className="h-11 w-8 shrink-0 rounded-md bg-black/20 object-cover ring-2 ring-white/40 sm:h-16 sm:w-12" fallback="/favicon.svg" />
      ) : (
        <div className="h-11 w-8 shrink-0 rounded-md bg-black/20 ring-2 ring-white/25 sm:h-16 sm:w-12" />
      )}
      <div className="min-w-0 flex-1">
        <div className={`flex flex-wrap items-center gap-2 ${align === "right" ? "justify-end" : ""}`}>
          <span className="otm-kicker whitespace-nowrap text-white/70">{shortName || (align === "left" ? "Home" : "Away")}</span>
          {you ? <Badge variant="live">You</Badge> : null}
        </div>
        <div className="otm-title mt-0.5 whitespace-normal break-words text-[1rem] leading-tight text-white sm:text-[1.35rem] line-clamp-2">{name}</div>
        {owner ? <div className="mt-0.5 hidden whitespace-normal break-words text-[13px] text-white/70 sm:block line-clamp-2">{owner}</div> : null}
      </div>
    </div>
  )
}

function sideRemaining(players: FantraxRosterPlayer[]): number {
  return players
    .filter((p) => p.status === "ACTIVE")
    .reduce((sum, p) => sum + remainingPts(p.projected ?? p.points, p.points), 0)
}

function stillOut(players: FantraxRosterPlayer[]): FantraxRosterPlayer[] {
  return players.filter((p) => p.status === "ACTIVE" && remainingPts(p.projected ?? p.points, p.points) >= 0.4)
}

function leftoverCopy(matchup: FantraxMatchup, teamId: string): string | null {
  const youHome = matchup.homeId === teamId
  const you = youHome ? matchup.lines.map((l) => l.home).concat(matchup.homeBench) : matchup.lines.map((l) => l.away).concat(matchup.awayBench)
  const them = youHome ? matchup.lines.map((l) => l.away).concat(matchup.awayBench) : matchup.lines.map((l) => l.home).concat(matchup.homeBench)
  const yours = you.filter((p): p is FantraxRosterPlayer => p != null)
  const theirs = them.filter((p): p is FantraxRosterPlayer => p != null)
  const youLeft = sideRemaining(yours)
  const themLeft = sideRemaining(theirs)
  const pending = stillOut(yours)
  const bits: string[] = []
  if (youLeft >= 0.4 || themLeft >= 0.4) {
    bits.push(`${youLeft.toFixed(1)} still to play · they have ${themLeft.toFixed(1)}`)
  }
  if (pending.length) {
    bits.push(pending.map((p) => p.shortName || p.name.split(" ").slice(-1)[0]).join(", "))
  }
  return bits.length ? bits.join(" · ") : null
}

function optimalCopy(matchup: FantraxMatchup, teamId: string): string | null {
  const youHome = matchup.homeId === teamId
  const proj = Number(youHome ? matchup.homeProjected : matchup.awayProjected)
  const opt = Number(youHome ? matchup.homeOptimal : matchup.awayOptimal)
  if (!Number.isFinite(proj) || !Number.isFinite(opt)) return null
  const delta = opt - proj
  if (delta < 0.5) return null
  return `Optimal XI is ${opt.toFixed(1)}. ${delta.toFixed(1)} still on the bench.`
}

/**
 * Renders the current (or selected) gameweek: scoreboard, facing XIs, bench, league slate.
 */
export function LeagueWeek({
  matchup,
  slate,
  teamId,
  periodLabel,
  period,
  periodCount,
  live,
  isCurrentWeek,
  onPeriod,
  loading = false,
}: {
  matchup: FantraxMatchup | null
  slate: FantraxSlateGame[]
  teamId: string
  periodLabel: string
  period: number
  periodCount: number
  live: boolean
  isCurrentWeek: boolean
  onPeriod: (next: number) => void
  loading?: boolean
}): React.ReactElement {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const leftover = matchup && teamId ? leftoverCopy(matchup, teamId) : null
  const insight = matchup && teamId ? optimalCopy(matchup, teamId) : null

  async function onCopy() {
    if (!matchup) return
    const home = live ? matchup.homeScore ?? "0" : matchup.homeProjected ?? "—"
    const away = live ? matchup.awayScore ?? "0" : matchup.awayProjected ?? "—"
    const caption = [
      "OTM",
      matchup.periodLabel || "This week",
      `${matchup.homeShort || matchup.home} ${home}–${away} ${matchup.awayShort || matchup.away}`,
      live && matchup.homeProjected ? `proj ${matchup.homeProjected}–${matchup.awayProjected}` : null,
    ]
      .filter(Boolean)
      .join(" · ")
    const ok = await copyShare(caption, window.location.href)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <Card size="flush" className="otm-pitch">
      <div className="flex items-center justify-between gap-3 border-b border-white/25 px-4 py-4 sm:px-7">
        <div className="min-w-0 flex-1">
          <h2 className="otm-title text-[1.6rem] text-white sm:text-[2rem]">{isCurrentWeek ? "This week" : periodLabel || `GW${period}`}</h2>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
            {live && isCurrentWeek ? <Badge variant="live" className="text-[11px]">Live</Badge> : null}
            <span className="font-semibold text-white">{periodLabel || `GW${period}`}</span>
            <span className="text-white/60">·</span>
            <span className="text-white/75">
              {period === periodCount ? "Final week" : period === 1 ? "First week" : `Week ${period} of ${periodCount}`}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous gameweek"
            disabled={period <= 1 || loading}
            className="size-11 text-white hover:bg-white/15 hover:text-white disabled:opacity-40"
            onClick={() => onPeriod(period - 1)}
          >
            <span className="text-[28px] leading-none">‹</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next gameweek"
            disabled={period >= periodCount || loading}
            className="size-11 text-white hover:bg-white/15 hover:text-white disabled:opacity-40"
            onClick={() => onPeriod(period + 1)}
          >
            <span className="text-[28px] leading-none">›</span>
          </Button>
          {matchup ? (
            <Button type="button" variant="outline" size="sm" className="ml-1 h-11 min-h-[44px] min-w-[4.5rem] whitespace-nowrap border-white/40 bg-black/25 px-3 text-[14px] text-white hover:bg-black/35 hover:text-white" onClick={() => void onCopy()} aria-label="Copy matchup score">
              {copied ? "Copied" : "Copy"}
            </Button>
          ) : null}
        </div>
      </div>

      {matchup ? (
        <div className="p-4 sm:p-7">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
            <TeamMark name={matchup.home} shortName={matchup.homeShort} owner={matchup.homeOwner} logoUrl={matchup.homeLogo} align="left" you={matchup.homeId === teamId} />
            <div className="min-w-[6rem] shrink-0 text-center sm:min-w-[10rem]">
              <div className={live ? "otm-kicker text-[#b8ffcf]" : "otm-kicker text-white/70"}>{live ? "Live" : "Projected"}</div>
              <div className="otm-score mt-1 text-[2.2rem] leading-none text-white sm:text-[3.6rem]">
                {live ? matchup.homeScore ?? "0" : matchup.homeProjected ?? "—"}
                <span className="mx-1 text-[0.55em] font-semibold text-white/50 sm:mx-1.5">–</span>
                {live ? matchup.awayScore ?? "0" : matchup.awayProjected ?? "—"}
              </div>
              <span className="mx-auto mt-2 block h-0.5 w-14 bg-white/70 sm:w-20" aria-hidden />
              {live && (matchup.homeProjected || matchup.awayProjected) ? (
                <div className="mt-2 font-mono text-[11px] text-white/70">
                  proj {matchup.homeProjected} – {matchup.awayProjected}
                </div>
              ) : null}
            </div>
            <TeamMark name={matchup.away} shortName={matchup.awayShort} owner={matchup.awayOwner} logoUrl={matchup.awayLogo} align="right" you={matchup.awayId === teamId} />
          </div>
          {leftover || insight ? (
            <div className="mt-5 space-y-1 text-center text-[13px] text-white/75">
              {leftover ? <p className="text-white">{leftover}</p> : null}
              {insight ? <p>{insight}</p> : null}
            </div>
          ) : null}

          {matchup.lines.length ? (
            <div className="mt-6">
              <FacingRows lines={matchup.lines} expandedId={expandedId} setExpandedId={setExpandedId} />
              <Bench matchup={matchup} expandedId={expandedId} setExpandedId={setExpandedId} />
              <p className="mt-4 text-[13px] text-white/70">Tap a name for the projection breakdown.</p>
            </div>
          ) : (
            <p className="mt-6 border-t border-white/25 pt-4 text-[13px] text-white/70">Select your team to load this week’s XI.</p>
          )}
        </div>
      ) : (
        <p className="px-5 py-8 text-[14px] text-white/75 sm:px-6">
          {teamId ? "No matchup in this gameweek." : "Pick your team to open this week’s fixture."}
        </p>
      )}

      {slate.length ? (
        <div className="grid grid-cols-1 border-t border-white/25 sm:grid-cols-2 lg:grid-cols-3">
          {slate.map((game) => (
            <div
              key={`${game.awayId}-${game.homeId}`}
              className={`border-b border-white/20 px-5 py-4 last:border-b-0 transition-colors hover:bg-black/15 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0 ${
                game.yours ? "bg-black/20 shadow-[inset_3px_0_0_0_#b8ffcf]" : ""
              }`}
            >
              <div className="flex items-baseline justify-between gap-3 text-[13px] text-white">
                <span className={`min-w-0 whitespace-normal break-words line-clamp-2 ${game.yours ? "font-semibold" : "text-white/80"}`}>{game.home}</span>
                <span className={`otm-score shrink-0 text-[1.05rem] tabular-nums ${scoreClass(Number(live ? game.homeScore : game.homeProjected))}`}>
                  {live ? game.homeScore ?? "0" : game.homeProjected ?? "—"}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3 text-[13px] text-white">
                <span className={`min-w-0 whitespace-normal break-words line-clamp-2 ${game.yours ? "font-semibold" : "text-white/80"}`}>{game.away}</span>
                <span className={`otm-score shrink-0 text-[1.05rem] tabular-nums ${scoreClass(Number(live ? game.awayScore : game.awayProjected))}`}>
                  {live ? game.awayScore ?? "0" : game.awayProjected ?? "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  )
}
