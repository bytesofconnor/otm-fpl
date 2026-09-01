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
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
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
  return <ImageWithFallback src={src} alt={alt} className="h-5 w-5 shrink-0 object-contain opacity-80" fallback="/favicon.svg" />
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
    <div className={`flex min-h-11 items-center px-1 ${align === "right" ? "justify-end" : ""}`}>
      <span className="text-[13px] text-muted-foreground/80">Empty</span>
    </div>
  )
}

function PlayerBlock({
  player,
  align,
  expanded,
  onToggle,
}: {
  player: FantraxRosterPlayer | null
  align: "left" | "right"
  expanded: boolean
  onToggle: () => void
}): React.ReactElement {
  if (!player) return <EmptySlot align={align} />
  const left = remainingPts(player.projected ?? player.points, player.points)
  const meta = [player.availabilityLabel, player.kickoff].filter(Boolean).join(" · ")
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onToggle}
      className={`h-auto min-h-[3rem] w-full min-w-0 flex-col items-stretch justify-start gap-0 rounded-md px-2 py-2.5 whitespace-normal ${align === "right" ? "text-right" : "text-left"}`}
    >
      <div className={`flex items-center gap-2.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <Crest src={player.headshotUrl} alt={player.team} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-snug text-foreground sm:text-[16px]">{player.name}</span>
        <span className="shrink-0 text-right">
          <span className={`block font-mono text-[15px] tabular-nums font-bold ${scoreClass(player.points)}`}>{pts(player.points)}</span>
          {left >= 0.4 ? (
            <span className="block font-mono text-[12px] tabular-nums font-medium text-muted-foreground">+{left.toFixed(1)}</span>
          ) : null}
        </span>
      </div>
      {meta ? (
        <div className={`mt-1 text-[13px] font-medium leading-snug ${availabilityClass(player.availability)} ${align === "right" ? "text-right" : ""}`}>
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
        <div key={group.position} className="border-t-2 border-border">
          {group.position !== "BN" ? (
            <div className="flex items-center gap-3 px-2 py-3">
              <Separator className="flex-1" />
              <span className="otm-kicker text-[13px]">{POS[group.position] ?? group.position}</span>
              <Separator className="flex-1" />
            </div>
          ) : null}
          {group.lines.map((line, i) => (
            <div
              key={`${line.position}-${line.home?.id ?? "h"}-${line.away?.id ?? "a"}-${i}`}
              className="grid grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)] items-start gap-2 border-t border-border py-1"
            >
              <PlayerBlock
                player={line.home}
                align="left"
                expanded={expandedId === line.home?.id}
                onToggle={() => setExpandedId(expandedId === line.home?.id ? null : line.home?.id ?? null)}
              />
              <span />
              <PlayerBlock
                player={line.away}
                align="right"
                expanded={expandedId === line.away?.id}
                onToggle={() => setExpandedId(expandedId === line.away?.id ? null : line.away?.id ?? null)}
              />
            </div>
          ))}
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
    <div className="mt-3 border-t-2 border-border pt-4 opacity-90">
            <div className="mb-2 px-2 otm-kicker text-[13px]">Bench</div>
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
}: {
  name: string
  shortName?: string
  owner?: string
  logoUrl?: string
  align: "left" | "right"
}): React.ReactElement {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      {logoUrl ? (
        <ImageWithFallback src={logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-background object-cover shadow-sm ring-2 ring-border sm:h-12 sm:w-12" fallback="/favicon.svg" />
      ) : (
        <div className="h-10 w-10 shrink-0 rounded-lg border-2 border-border bg-muted/60 sm:h-12 sm:w-12" />
      )}
      <div className="min-w-0">
        <div className="otm-kicker text-[12px]">{shortName || (align === "left" ? "Home" : "Away")}</div>
        <div className="otm-title mt-0.5 truncate text-[1.05rem] leading-tight sm:text-[1.35rem]">{name}</div>
        {owner ? <div className="mt-0.5 hidden truncate text-[13px] font-medium text-muted-foreground sm:block">{owner}</div> : null}
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
  onPeriod,
}: {
  matchup: FantraxMatchup | null
  slate: FantraxSlateGame[]
  teamId: string
  periodLabel: string
  period: number
  periodCount: number
  live: boolean
  onPeriod: (next: number) => void
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
    <Card size="flush">
      <div className="border-b-2 border-border px-4 py-5 sm:px-7 sm:py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="otm-title text-[1.6rem] leading-tight sm:text-[2rem]">This week</h2>
            <div className="mt-2 flex items-center gap-2">
              {live ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-live px-2 py-1 text-[12px] font-bold uppercase tracking-wider text-white">
                  <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden />
                  Live
                </span>
              ) : null}
              <span className="text-[14px] font-semibold text-foreground sm:text-[15px]">
                {periodLabel || `GW${period}`}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="tap h-11 w-11 p-0 text-[20px] font-bold"
              aria-label="Previous gameweek"
              disabled={period <= 1}
              onClick={() => onPeriod(period - 1)}
            >
              ‹
            </Button>
            <Button
              type="button"
              variant="outline"
              className="tap h-11 w-11 p-0 text-[20px] font-bold"
              aria-label="Next gameweek"
              disabled={period >= periodCount}
              onClick={() => onPeriod(period + 1)}
            >
              ›
            </Button>
          </div>
        </div>
        {matchup ? (
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => void onCopy()}>
            {copied ? "Copied" : "Copy matchup"}
          </Button>
        ) : null}
      </div>

      {matchup ? (
        <div className="p-5 sm:p-7">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
            <TeamMark name={matchup.home} shortName={matchup.homeShort} owner={matchup.homeOwner} logoUrl={matchup.homeLogo} align="left" />
            <div className="text-center">
              <div className="inline-flex min-w-[10rem] flex-col items-center rounded-lg bg-foreground px-5 py-3 text-background shadow-lg sm:min-w-[14rem] sm:px-7 sm:py-4">
                <div className={live ? "otm-kicker text-[#5dd4a8]" : "otm-kicker text-background/60"}>{live ? "Live" : "Projected"}</div>
                <div className="otm-score mt-1.5 text-[2.25rem] leading-none sm:text-[3.75rem]">
                  {live ? matchup.homeScore ?? "0" : matchup.homeProjected ?? "—"}
                  <span className="mx-1.5 text-[0.7em] font-bold text-background/50 sm:mx-2">–</span>
                  {live ? matchup.awayScore ?? "0" : matchup.awayProjected ?? "—"}
                </div>
                {live && (matchup.homeProjected || matchup.awayProjected) ? (
                  <div className="mt-2 font-mono text-[12px] text-background/60">
                    proj {matchup.homeProjected} – {matchup.awayProjected}
                  </div>
                ) : null}
              </div>
            </div>
            <TeamMark name={matchup.away} shortName={matchup.awayShort} owner={matchup.awayOwner} logoUrl={matchup.awayLogo} align="right" />
          </div>
          {leftover || insight ? (
            <div className="mt-5 space-y-1 text-center text-[13px] text-muted-foreground">
              {leftover ? <p className="text-foreground">{leftover}</p> : null}
              {insight ? <p>{insight}</p> : null}
            </div>
          ) : null}

          {matchup.lines.length ? (
            <div className="mt-6">
              <FacingRows lines={matchup.lines} expandedId={expandedId} setExpandedId={setExpandedId} />
              <Bench matchup={matchup} expandedId={expandedId} setExpandedId={setExpandedId} />
              <p className="mt-4 text-[13px] text-muted-foreground">Tap a name for the projection breakdown.</p>
            </div>
          ) : (
            <p className="mt-6 border-t border-border pt-4 text-[13px] text-muted-foreground">Select your team to load this week’s XI.</p>
          )}
        </div>
      ) : (
        <p className="px-5 py-8 text-[14px] text-muted-foreground sm:px-6">
          {teamId ? "No matchup in this gameweek." : "Pick your team to open this week’s fixture."}
        </p>
      )}

      {slate.length ? (
        <div className="border-t-2 border-border">
          <div className="px-5 py-4 sm:px-7">
            <h3 className="otm-kicker">All matchups</h3>
          </div>
          <div className="grid grid-cols-1 border-t border-border sm:grid-cols-2 lg:grid-cols-3">
            {slate.map((game) => (
              <div
                key={`${game.awayId}-${game.homeId}`}
                className={`border-b border-border px-5 py-4 last:border-b-0 transition-colors hover:bg-accent/60 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0 ${
                  game.yours ? "bg-muted shadow-[inset_3px_0_0_0_var(--foreground)]" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-3 text-[14px] sm:text-[15px]">
                  <span className={`truncate font-medium ${game.yours ? "text-foreground" : "text-foreground"}`}>{game.home}</span>
                  <span className={`shrink-0 font-mono text-[14px] tabular-nums font-semibold ${scoreClass(Number(live ? game.homeScore : game.homeProjected))}`}>
                    {live ? game.homeScore ?? "0" : game.homeProjected ?? "—"}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-3 text-[14px] sm:text-[15px]">
                  <span className={`truncate font-medium ${game.yours ? "text-foreground" : "text-foreground"}`}>{game.away}</span>
                  <span className={`shrink-0 font-mono text-[14px] tabular-nums font-semibold ${scoreClass(Number(live ? game.awayScore : game.awayProjected))}`}>
                    {live ? game.awayScore ?? "0" : game.awayProjected ?? "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  )
}
