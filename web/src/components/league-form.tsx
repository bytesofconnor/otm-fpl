// Description: Form page — teams, the owned pool, and the wire.
"use client"

import * as React from "react"
import Link from "next/link"
import type { FantraxFormSnapshot, FantraxPoolPlayer, PlayerWeekPts } from "@/lib/fantrax-shared"
import { OTM_LEAGUE_ID, managerChip, managerFilterLabel, pickupNotes, keyStats, seasonStats, playerHeadline, weekFpts, playerWeekPts, playerSeasonFpts, weekBar, weekPending } from "@/lib/fantrax-shared"
import { useConnectedLeague } from "@/lib/league-session"
import { clubChipTone } from "@/lib/clubs"
import { heatFromWeekPoints, type HeatBucket } from "@/lib/form-engine"
import { FormChart, CHART_PALETTE, PLAYER_SORTS, PLAYER_STAT_SORTS, type ChartRankBy } from "@/components/form-chart"
import { useLeagueStatus } from "@/components/league-status"
import { PageShell, pageWidth } from "@/components/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OtmLoader } from "@/components/otm-loader"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion"

const POSITIONS = ["G", "D", "M", "F"] as const
const POS_COLS = [
  { id: "G", code: "GK", name: "Keepers" },
  { id: "D", code: "DEF", name: "Defenders" },
  { id: "M", code: "MID", name: "Mids" },
  { id: "F", code: "FWD", name: "Forwards" },
] as const
const PANES = ["teams", "players", "wire"] as const
type FormPane = (typeof PANES)[number]

function asPlayerSort(value: string | null): ChartRankBy {
  if (value === "pos" || value === "club") return "points"
  return PLAYER_SORTS.includes(value as (typeof PLAYER_SORTS)[number]) ? (value as ChartRankBy) : "points"
}

function splitCsv(raw: string | null): string[] {
  if (!raw?.trim()) return []
  return raw.split(",").map((part) => part.trim()).filter(Boolean)
}

function ClubFilter({
  clubs,
  value,
  onChange,
}: {
  clubs: string[]
  value: string[]
  onChange: (clubs: string[]) => void
}): React.ReactElement | null {
  if (!clubs.length) return null
  function toggle(club: string) {
    onChange(value.includes(club) ? value.filter((row) => row !== club) : [...value, club])
  }
  return (
    <div className="flex w-full min-w-0 flex-wrap gap-1.5" role="group" aria-label="Filter by Premier League club">
      <Button
        type="button"
        variant={value.length ? "ghost" : "default"}
        size="sm"
        className="h-9 px-2.5 text-[13px]"
        onClick={() => onChange([])}
      >
        All clubs
      </Button>
      {clubs.map((club) => {
        const on = value.includes(club)
        const tone = clubChipTone(club)
        return (
          <Button
            key={club}
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 min-w-[2.75rem] border border-solid px-2.5 text-[13px] font-medium hover:opacity-90"
            style={{
              borderColor: tone.outline,
              backgroundColor: on ? tone.paint : "transparent",
              color: on ? tone.ink : undefined,
              boxShadow: `inset 0 0 0 1px ${tone.outline}`,
            }}
            aria-pressed={on}
            onClick={() => toggle(club)}
          >
            {club}
          </Button>
        )
      })}
    </div>
  )
}

function asPane(value: string | null): FormPane | null {
  if (value === "week" || value === "league" || value === "table") return "teams"
  return PANES.includes(value as FormPane) ? (value as FormPane) : null
}

function playerFormBits(player: FantraxPoolPlayer, week?: PlayerWeekPts, showHaul = true): {
  heat: HeatBucket
  chips: ReturnType<typeof keyStats>
  season: ReturnType<typeof seasonStats>
  why: string | null
  photoUrl?: string
  crestUrl?: string
} {
  return {
    heat: heatFromWeekPoints(week ? (week.scored ?? week.projected) : weekFpts(player)),
    chips: keyStats(player),
    season: player.stats?.length ? [] : seasonStats(player),
    why: showHaul ? playerHeadline(player) : null,
    photoUrl: player.headshotUrl,
    crestUrl: player.crestUrl,
  }
}

function WeekChips({
  periods,
  activeWeek,
  seasonView,
  seasonLabel = "Season",
  onSeason,
  onWeek,
}: {
  periods: number[]
  activeWeek: number
  seasonView?: boolean
  seasonLabel?: string
  onSeason?: () => void
  onWeek: (period: number) => void
}): React.ReactElement | null {
  if (periods.length <= 1 && !onSeason) return null
  return (
    <div className="flex flex-wrap gap-1">
      {onSeason ? (
        <Button type="button" variant={seasonView ? "default" : "ghost"} size="sm" onClick={onSeason}>
          {seasonLabel}
        </Button>
      ) : null}
      {periods.map((period) => (
        <Button
          key={period}
          type="button"
          variant={!seasonView && activeWeek === period ? "default" : "ghost"}
          size="sm"
          onClick={() => onWeek(period)}
        >
          GW{period}
        </Button>
      ))}
    </div>
  )
}

function readParams() {
  const params = new URLSearchParams(window.location.search)
  const posRaw = (params.get("pos") ?? "").toUpperCase().split("").filter((c): c is (typeof POSITIONS)[number] =>
    POSITIONS.includes(c as (typeof POSITIONS)[number]),
  )
  const pos = posRaw.length === POSITIONS.length ? [] : posRaw
  const hash = asPane(window.location.hash.replace("#", ""))
  const view = asPane(params.get("view"))
  return {
    pane: view ?? hash ?? "teams",
    q: params.get("q") ?? "",
    pos,
    team: params.get("team"),
    player: params.get("p"),
    mgr: splitCsv(params.get("mgr")),
    club: splitCsv(params.get("club")),
    wire: params.get("w"),
    gw: params.get("gw") === "all" ? ("season" as const) : params.get("gw") ? Number(params.get("gw")) : null,
    sort: asPlayerSort(params.get("sort")),
  } as const
}

/** If the chart header scrolled away under a long list, bring it back. Never push the page down. */
function raisePane() {
  const dock = document.getElementById("form-dock")
  const panel = document.getElementById("form-panel")
  if (!dock || !panel) return
  const dockBottom = dock.getBoundingClientRect().bottom
  const panelTop = panel.getBoundingClientRect().top
  if (panelTop < dockBottom - 2) {
    window.scrollBy({ top: panelTop - dockBottom, behavior: "auto" })
  }
}

/**
 * League Form: scored vs projected, the owned pool, and the wire — one dashboard pane at a time.
 */
export function LeagueForm(): React.ReactElement {
  const { setStatus } = useLeagueStatus()
  const membership = useConnectedLeague()
  const [leagueId, setLeagueId] = React.useState(OTM_LEAGUE_ID)
  const [teamId, setTeamId] = React.useState("")
  const [data, setData] = React.useState<FantraxFormSnapshot | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [managerId, setManagerId] = React.useState<string | null>(null)
  const [poolPlayerId, setPoolPlayerId] = React.useState<string | null>(null)
  const [wireId, setWireId] = React.useState<string | null>(null)
  const [pane, setPane] = React.useState<FormPane>("teams")
  const [query, setQuery] = React.useState("")
  const [positions, setPositions] = React.useState<string[]>([])
  const [ownerFilter, setOwnerFilter] = React.useState<string[]>([])
  const [clubFilter, setClubFilter] = React.useState<string[]>([])
  const [playerSort, setPlayerSort] = React.useState<ChartRankBy>("points")
  const [weekFocus, setWeekFocus] = React.useState<number | "season" | null>(null)
  const [dir, setDir] = React.useState<1 | -1>(1)
  const [searchExpanded, setSearchExpanded] = React.useState(false)
  const hydrated = React.useRef(false)
  const paneRef = React.useRef(pane)
  const swipe = React.useRef<{ x: number; y: number; id: number } | null>(null)
  const reduceMotion = useReducedMotion()
  paneRef.current = pane

  React.useEffect(() => {
    if (!PANES.includes(pane)) setPane("teams")
  }, [pane])

  React.useEffect(() => {
    const incoming = readParams()
    setPane(incoming.pane)
    setQuery(incoming.q)
    setPositions(incoming.pos)
    if (incoming.mgr.length) setOwnerFilter(incoming.mgr)
    if (incoming.club.length) setClubFilter(incoming.club)
    if (incoming.gw != null && !Number.isNaN(incoming.gw)) setWeekFocus(incoming.gw)
    setPlayerSort(incoming.sort)
  }, [])

  React.useEffect(() => {
    if (!membership.ready) return
    setLeagueId(membership.leagueId)
    setTeamId(membership.storedTeamId)
  }, [membership.ready, membership.leagueId, membership.storedTeamId])

  React.useEffect(() => {
    if (!membership.ready || !leagueId) return
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({ leagueId })
    if (teamId) qs.set("teamId", teamId)
    fetch(`/api/fantrax/form?${qs}`, { signal: ctrl.signal })
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body?.message || "Could not load form")
        const next = body as FantraxFormSnapshot
        const incoming = readParams()
        setData(next)
        const you = next.managers.find((m) => m.you)
        setManagerId(incoming.team || you?.teamId || next.managers[0]?.teamId || null)
        setPoolPlayerId(incoming.player || null)
        setWireId(incoming.wire || next.unowned[0]?.id || null)
        if (incoming.mgr.length) setOwnerFilter(incoming.mgr)
        if (incoming.club.length) setClubFilter(incoming.club)
        setPlayerSort(incoming.sort)
        if (incoming.gw != null && !Number.isNaN(incoming.gw)) setWeekFocus(incoming.gw)
        else setWeekFocus((prev) => prev ?? "season")
        setStatus({ leagueName: next.leagueName, periodLabel: `GW${next.currentPeriod}`, live: false })
        hydrated.current = true
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === "AbortError") return
        setError(err instanceof Error ? err.message : "Could not load form")
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [membership.ready, leagueId, teamId, setStatus])

  React.useEffect(() => {
    const onHash = () => {
      const next = asPane(window.location.hash.replace("#", ""))
      if (next) setPane(next)
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  React.useEffect(() => {
    if (!hydrated.current) return
    const params = new URLSearchParams()
    if (pane !== "teams" && PANES.includes(pane)) params.set("view", pane)
    if (query.trim()) params.set("q", query.trim())
    if (positions.length) params.set("pos", positions.join(""))
    if (managerId) params.set("team", managerId)
    if (poolPlayerId) params.set("p", poolPlayerId)
    if (ownerFilter.length) params.set("mgr", ownerFilter.join(","))
    if (clubFilter.length) params.set("club", clubFilter.join(","))
    if (playerSort !== "points") params.set("sort", playerSort)
    if (wireId) params.set("w", wireId)
    if (weekFocus === "season") params.set("gw", "all")
    else if (typeof weekFocus === "number") params.set("gw", String(weekFocus))
    const qs = params.toString()
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
      history.replaceState(null, "", next)
    }
  }, [pane, query, positions, managerId, poolPlayerId, ownerFilter, clubFilter, playerSort, wireId, weekFocus, data])

  React.useEffect(() => {
    if (positions.length === POSITIONS.length) setPositions([])
  }, [positions])

  const go = React.useCallback((target: FormPane, hint?: 1 | -1) => {
    const from = PANES.indexOf(paneRef.current)
    const to = PANES.indexOf(target)
    if (to < 0 || target === paneRef.current) return
    setDir(hint ?? (to >= from ? 1 : -1))
    setPane(target)
    raisePane()
  }, [managerId])

  const step = React.useCallback((delta: -1 | 1) => {
    const i = PANES.indexOf(paneRef.current)
    go(PANES[(i + delta + PANES.length) % PANES.length], delta)
  }, [go])

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const el = event.target as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return
      if (el?.closest("[data-otm-split]")) return
      if (event.metaKey || event.ctrlKey) return
      if (event.key === "[" || event.key === "ArrowLeft") {
        event.preventDefault()
        step(-1)
      } else if (event.key === "]" || event.key === "ArrowRight") {
        event.preventDefault()
        step(1)
      } else if (event.key >= "1" && event.key <= String(PANES.length)) {
        event.preventDefault()
        go(PANES[Number(event.key) - 1])
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [go, step])

  function onSwipeStart(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse") return
    if ((event.target as HTMLElement | null)?.closest("[data-otm-split], input, textarea, select, button")) return
    swipe.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
  }

  function onSwipeEnd(event: React.PointerEvent<HTMLDivElement>) {
    const start = swipe.current
    swipe.current = null
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.6) return
    step(dx < 0 ? 1 : -1)
  }

  function focusRoster(id: string | null) {
    if (!id || !data) return
    setOwnerFilter([id])
    setManagerId(id)
    const onRoster = data.leagueOwned.some((p) => p.id === poolPlayerId && p.ownerTeamId === id)
    if (!onRoster) setPoolPlayerId(null)
  }

  function openManagerPlayers(id: string | null) {
    focusRoster(id)
    go("players")
  }

  function openAllPlayers() {
    setOwnerFilter([])
    setClubFilter([])
    go("players")
  }

  function clearFilters() {
    setPositions([])
    setQuery("")
    setClubFilter([])
    setOwnerFilter([])
    setSearchExpanded(false)
  }

  if (!leagueId) {
    return (
      <PageShell>
        <p className="text-[15px] text-muted-foreground">Could not load a league. Open League and connect one.</p>
        <Button className="mt-4" nativeButton={false} render={<Link href="/" />}>
          Open league
        </Button>
      </PageShell>
    )
  }

  if (loading && !data) {
    return (
      <PageShell>
        <OtmLoader label="Form" hint="Charting the league" />
      </PageShell>
    )
  }

  if (error && !data) {
    return (
      <PageShell>
        <p className="text-[14px] text-danger">{error}</p>
      </PageShell>
    )
  }

  if (!data) return <div />

  const scoringWeeks = Array.from({ length: Math.max(1, data.currentPeriod) }, (_, i) => i + 1)
  const weekPeriods = scoringWeeks
  const totalsView = weekFocus === "season"
  const seasonView = totalsView && weekPeriods.length > 1
  const activeWeek =
    typeof weekFocus === "number" && weekFocus >= 1 && weekFocus <= data.currentPeriod
      ? weekFocus
      : data.currentPeriod
  const weekIndex = weekPeriods.indexOf(activeWeek)
  const managerPoints = data.managers.map((m) => {
    const played = m.points.filter((row) => row.period <= data.currentPeriod)
    return seasonView ? played : [played[Math.max(0, weekIndex)]].filter(Boolean)
  })
  const viewingCurrent = !totalsView && activeWeek === data.currentPeriod
  const gwComplete =
    totalsView ||
    (!seasonView &&
      (activeWeek < data.currentPeriod ||
        (viewingCurrent && data.periodFinished) ||
        managerPoints.every((pts) => pts.length > 0 && pts.every((pt) => !pt.projected))))
  const weekOf = (p: FantraxPoolPlayer) => playerWeekPts(p, activeWeek, data.currentPeriod)
  const clubs = [...new Set(data.leagueOwned.map((p) => p.team).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const unownedFiltered = data.unowned.filter((p) => {
    if (clubFilter.length && !clubFilter.includes(p.team)) return false
    if (positions.length && !positions.includes(p.position)) return false
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return `${p.name} ${p.team} ${p.wire ?? ""}`.toLowerCase().includes(q)
  })
  const leagueOwned = data.leagueOwned.filter((p) => {
    if (clubFilter.length && !clubFilter.includes(p.team)) return false
    if (totalsView) {
      if (playerSeasonFpts(p) == null) return false
    } else {
      const week = weekOf(p)
      if (week.projected == null && week.scored == null) return false
    }
    if (positions.length && !positions.includes(p.position)) return false
    if (!query.trim()) return true
    const manager = data.managers.find((m) => m.teamId === p.ownerTeamId)
    return `${p.name} ${p.team} ${manager?.name ?? ""} ${manager?.shortName ?? ""} ${manager?.owner ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
  })
  const listedPlayers = leagueOwned.filter(
    (p) => !ownerFilter.length || (p.ownerTeamId != null && ownerFilter.includes(p.ownerTeamId)),
  )
  const rosterManagers = data.managers.filter((m) => ownerFilter.includes(m.teamId))
  const filterHeadline = [
    rosterManagers.length ? rosterManagers.map((m) => managerChip(m, data.managers)).join(" · ") : null,
    clubFilter.length ? clubFilter.join(" · ") : null,
    positions.length ? positions.map((id) => POS_COLS.find((col) => col.id === id)?.code ?? id).join(" · ") : null,
  ]
    .filter(Boolean)
    .join(" · ")
  const listSort: ChartRankBy = totalsView
    ? playerSort === "scored" || playerSort === "left"
      ? "points"
      : playerSort
    : gwComplete && playerSort === "left"
      ? "scored"
      : playerSort
  const jumps: Array<{ id: FormPane; label: string; count?: number }> = [
    { id: "teams", label: "Table" },
    { id: "players", label: "Players", count: listedPlayers.length },
    { id: "wire", label: "Wire", count: (unownedFiltered.length ? unownedFiltered : data.unowned).length },
  ]

  return (
    <div className="relative">
      <div className="fixed inset-0 z-0 bg-background pointer-events-none" aria-hidden="true" />
      <a href="#form-panel" className="skip-link">
        Skip to chart
      </a>
      <div id="form-dock" className="sticky top-[calc(var(--header-h)+env(safe-area-inset-top))] z-40 border-b border-border bg-card/95 backdrop-blur-sm sm:bg-card">
        <div className={`${pageWidth} py-2 sm:py-2.5`}>
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <LayoutGroup id="form-tabs">
            <Tabs
              value={pane}
              onValueChange={(next) => {
                if (typeof next === "string") go(next as FormPane)
              }}
              className="min-w-0 flex-1 gap-0"
            >
              <TabsList variant="line" className="relative h-12 w-full justify-start gap-1.5 rounded-none bg-transparent p-0 md:gap-2.5" role="tablist" aria-label="Form views">
                {jumps.map((item) => (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className="tap relative h-12 flex-none rounded-none px-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] after:!hidden sm:px-3 md:px-3.5 md:text-[12px] md:tracking-[0.14em]"
                    role="tab"
                    aria-selected={pane === item.id}
                    aria-controls={`form-panel-${item.id}`}
                    style={{ minHeight: '44px' }}
                  >
                    <span className="whitespace-nowrap">{item.label}</span>
                    {item.count != null ? (
                      <span className="ml-1.5 font-mono text-[11px] font-normal text-muted-foreground/80">{item.count}</span>
                    ) : null}
                    {pane === item.id ? (
                      <motion.span
                        layoutId="form-tab-ink"
                        className="absolute inset-x-2 bottom-0 h-0.5 bg-foreground md:inset-x-3"
                        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                        aria-hidden="true"
                      />
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            </LayoutGroup>
            <div className="hidden shrink-0 items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-1 sm:flex" role="group" aria-label="Navigate between charts">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10"
                      aria-label="Previous chart (Left arrow or [ key)"
                      onClick={() => step(-1)}
                    >
                      <ChevronLeft className="size-5" />
                    </Button>
                  }
                />
                <TooltipContent>Previous graph (← or [)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-10"
                      aria-label="Next chart (Right arrow or ] key)"
                      onClick={() => step(1)}
                    >
                      <ChevronRight className="size-5" />
                    </Button>
                  }
                />
                <TooltipContent>Next graph (→ or ])</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {pane !== "teams" ? (
            <div className="mt-3 pb-1.5 sm:mt-3.5" role="search">
              {/* Mobile: Compact search - expands when tapped */}
              <div className="flex flex-col gap-2.5 md:hidden">
                <div className="flex items-center gap-2">
                  {!searchExpanded && !query ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="tap h-11 flex-1"
                      onClick={() => setSearchExpanded(true)}
                      aria-label="Open search"
                    >
                      <Search className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span className="text-[14px] text-muted-foreground">Search</span>
                    </Button>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-muted/70 px-2.5 py-1 focus-within:border-foreground/30">
                      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <Input
                        id="form-search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onBlur={() => {
                          if (!query.trim()) setSearchExpanded(false)
                        }}
                        placeholder="Player, manager, or club"
                        spellCheck={false}
                        autoComplete="off"
                        autoCorrect="off"
                        className="h-9 min-w-0 flex-1 border-0 bg-transparent px-0 text-[15px] shadow-none ring-0 focus-visible:border-transparent focus-visible:ring-0"
                        aria-label="Search players, managers, or clubs"
                      />
                    </div>
                  )}
                  {(!searchExpanded && !query) && (
                    <>
                      <ToggleGroup
                        multiple
                        value={positions}
                        onValueChange={(next) => {
                          const list = (Array.isArray(next) ? next : []).filter((id): id is (typeof POSITIONS)[number] =>
                            POSITIONS.includes(id as (typeof POSITIONS)[number]),
                          )
                          setPositions(list.length === POSITIONS.length ? [] : list)
                        }}
                        variant="outline"
                        size="sm"
                        spacing={0}
                        className="shrink-0 rounded-lg border border-border bg-card p-0.5"
                        aria-label="Filter by position"
                      >
                        {POS_COLS.map((col) => (
                          <ToggleGroupItem 
                            key={col.id} 
                            value={col.id} 
                            aria-label={`Filter to ${col.name}`} 
                            title={col.name}
                            className="tap h-10 min-w-[2.875rem] px-2.5 text-[13px]"
                          >
                            {col.code}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="tap h-11 min-w-[4.5rem] shrink-0 px-3"
                        onClick={clearFilters}
                        disabled={!positions.length && !query && !clubFilter.length && !ownerFilter.length}
                        aria-label="Clear all filters"
                      >
                        Clear
                      </Button>
                    </>
                  )}
                </div>
                {(searchExpanded || query) && (
                  <div className="flex items-center gap-2">
                    <ToggleGroup
                      multiple
                      value={positions}
                      onValueChange={(next) => {
                        const list = (Array.isArray(next) ? next : []).filter((id): id is (typeof POSITIONS)[number] =>
                          POSITIONS.includes(id as (typeof POSITIONS)[number]),
                        )
                        setPositions(list.length === POSITIONS.length ? [] : list)
                      }}
                      variant="outline"
                      size="sm"
                      spacing={0}
                      className="flex-1 rounded-lg border border-border bg-card p-0.5"
                      aria-label="Filter by position"
                    >
                      {POS_COLS.map((col) => (
                        <ToggleGroupItem 
                          key={col.id} 
                          value={col.id} 
                          aria-label={`Filter to ${col.name}`} 
                          title={col.name}
                          className="tap h-10 flex-1 px-2.5 text-[13px]"
                        >
                          {col.code}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="tap h-11 min-w-[4.5rem] shrink-0 px-3"
                      onClick={clearFilters}
                      disabled={!positions.length && !query && !clubFilter.length && !ownerFilter.length}
                      aria-label="Clear all filters"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              {/* Desktop: Full search bar */}
              <div className="hidden min-h-12 flex-row items-center gap-3 rounded-md border border-border bg-muted/70 px-3 py-1.5 focus-within:border-foreground/30 md:flex">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <label htmlFor="form-search-desktop" className="sr-only">Search players, managers, or clubs</label>
                  <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="form-search-desktop"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Player, manager, or club"
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    className="h-10 min-w-0 flex-1 border-0 bg-transparent px-0 text-[15px] shadow-none ring-0 focus-visible:border-transparent focus-visible:ring-0"
                    aria-label="Search players, managers, or clubs"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 shrink-0">
                  <ToggleGroup
                    multiple
                    value={positions}
                    onValueChange={(next) => {
                      const list = (Array.isArray(next) ? next : []).filter((id): id is (typeof POSITIONS)[number] =>
                        POSITIONS.includes(id as (typeof POSITIONS)[number]),
                      )
                      setPositions(list.length === POSITIONS.length ? [] : list)
                    }}
                    variant="outline"
                    size="sm"
                    spacing={0}
                    className="tap shrink-0 rounded-lg border border-border bg-card p-0.5"
                    aria-label="Filter by position"
                  >
                    {POS_COLS.map((col) => (
                      <ToggleGroupItem 
                        key={col.id} 
                        value={col.id} 
                        aria-label={`Filter to ${col.name}`} 
                        title={col.name}
                        className="tap h-9 min-w-[2.75rem] px-2"
                      >
                        {col.code}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="tap h-9 min-w-[4rem] shrink-0"
                    onClick={clearFilters}
                    disabled={!positions.length && !query && !clubFilter.length && !ownerFilter.length}
                    aria-label="Clear all filters"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              {clubs.length ? (
                <div className="mt-2 min-w-0">
                  <ClubFilter clubs={clubs} value={clubFilter} onChange={setClubFilter} />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <PageShell className="pt-2 sm:pt-4 md:pt-6 overflow-x-clip">
        <div
          id="form-panel"
          role="tabpanel"
          aria-labelledby={`form-tab-${pane}`}
          tabIndex={-1}
          className="outline-none max-w-full"
          onPointerDown={onSwipeStart}
          onPointerUp={onSwipeEnd}
          onPointerCancel={() => {
            swipe.current = null
          }}
          aria-live="polite"
          aria-atomic="false"
        >
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={pane}
              custom={dir}
              initial={reduceMotion ? false : "enter"}
              animate="center"
              exit="exit"
              variants={{
                enter: (d: 1 | -1) => ({ opacity: 0, x: d * 40 }),
                center: { opacity: 1, x: 0 },
                exit: (d: 1 | -1) => ({ opacity: 0, x: d * -28 }),
              }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
          {pane === "wire" ? (
            unownedFiltered.length || data.unowned.length ? (
              <FormChart
                title="Wire · pickup score"
                caption="Who to add. Pickup weighs projected FPts, G/AT/KP/CS, chance of minutes, and FA vs waivers. FA can be claimed now; WW waits."
                unit="score"
                xLabels={[`GW${activeWeek}`]}
                activeId={wireId}
                onSelect={setWireId}
                plotLimit={16}
                series={[...(unownedFiltered.length ? unownedFiltered : data.unowned)]
                  .sort((a, b) => (b.pickup ?? 0) - (a.pickup ?? 0))
                  .map((p) => {
                    const bits = playerFormBits(p)
                    return {
                    id: p.id,
                    label: p.name,
                    color: CHART_PALETTE[0],
                    hint: [`${p.points != null ? p.points.toFixed(1) : "—"} FPts`, ...pickupNotes(p)].filter(Boolean).join(" · "),
                    values: [p.pickup ?? p.points],
                    heat: bits.heat,
                    chips: bits.chips,
                    seasonChips: bits.season,
                    why: bits.why,
                    photoUrl: bits.photoUrl,
                    crestUrl: bits.crestUrl,
                    position: p.position,
                    }
                  })}
              />
            ) : (
              <Card size="flush" className="px-5 py-12 text-[14px] text-muted-foreground sm:px-6">
                No unowned players match this search.
              </Card>
            )
          ) : pane === "players" ? (
              <FormChart
                title={totalsView ? "Players · season total" : `Players · GW${activeWeek}`}
                headline={filterHeadline || "All players"}
                caption={
                  totalsView
                    ? "Fantrax FPts for the season so far. Pick a GW to isolate it. Squad, club, and position filters stack."
                    : viewingCurrent && !gwComplete
                      ? "Dots follow whoever is on screen. Squad, club, position, and GW filters all apply together."
                      : `Finished GW${activeWeek} — that week's FPts. Squad, club, and position filters stack.`
                }
                unit="FPts"
                xLabels={[totalsView ? "Total" : `GW${activeWeek}`]}
                weekLabel={totalsView ? "Total" : `GW${activeWeek}`}
                isLive={viewingCurrent && !gwComplete}
                gwComplete={gwComplete}
                activeId={poolPlayerId}
                onSelect={(id) => setPoolPlayerId((prev) => (prev === id ? null : id))}
                onFilterClub={(club) => {
                  setClubFilter((prev) => (prev.includes(club) ? prev.filter((row) => row !== club) : [...prev, club]))
                }}
                action={
                  clubFilter.length || ownerFilter.length || positions.length ? (
                    <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : null
                }
                toolbar={
                  <div className="flex w-full flex-col gap-2 sm:gap-2.5">
                    <WeekChips
                      periods={scoringWeeks}
                      activeWeek={activeWeek}
                      seasonView={totalsView}
                      seasonLabel="Total"
                      onSeason={() => setWeekFocus("season")}
                      onWeek={setWeekFocus}
                    />
                    <ToggleGroup
                      multiple
                      value={ownerFilter.length ? ownerFilter : ["all"]}
                      onValueChange={(ids) => {
                        const raw = (Array.isArray(ids) ? ids : []).filter((id): id is string => typeof id === "string")
                        const teams = raw.filter((id) => id !== "all")
                        if (raw.includes("all") && ownerFilter.length) {
                          setOwnerFilter([])
                          return
                        }
                        setOwnerFilter(teams)
                        if (poolPlayerId && teams.length) {
                          const stillListed = data.leagueOwned.some(
                            (p) => p.id === poolPlayerId && p.ownerTeamId != null && teams.includes(p.ownerTeamId),
                          )
                          if (!stillListed) setPoolPlayerId(null)
                        }
                      }}
                      variant="outline"
                      size="sm"
                      spacing={1}
                      className="flex flex-wrap"
                      aria-label="Filter by fantasy squad"
                    >
                      <ToggleGroupItem value="all" title="Every owned player">
                        All
                      </ToggleGroupItem>
                      {data.managers.map((m) => (
                        <ToggleGroupItem
                          key={m.teamId}
                          value={m.teamId}
                          title={m.owner ? `${m.name} · ${m.owner}` : m.name}
                          className="lowercase"
                        >
                          {managerFilterLabel(m, data.managers)}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <ToggleGroup
                      multiple
                      value={positions}
                      onValueChange={(next) => {
                        const list = (Array.isArray(next) ? next : []).filter((id): id is (typeof POSITIONS)[number] =>
                          POSITIONS.includes(id as (typeof POSITIONS)[number]),
                        )
                        setPositions(list.length === POSITIONS.length ? [] : list)
                      }}
                      variant="outline"
                      size="sm"
                      spacing={0}
                      className="rounded-lg border border-border bg-card p-0.5"
                      aria-label="Filter by position"
                    >
                      {POS_COLS.map((col) => (
                        <ToggleGroupItem
                          key={col.id}
                          value={col.id}
                          aria-label={`Filter to ${col.name}`}
                          title={col.name}
                          className="h-8 min-h-8 px-2.5 text-[13px]"
                        >
                          {col.code}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <ToggleGroup
                      value={["points", "scored", "left", "name"].includes(listSort) ? [listSort] : []}
                      onValueChange={(ids) => {
                        const next = asPlayerSort(ids[0] ?? "points")
                        setPlayerSort(next)
                      }}
                      variant="outline"
                      size="sm"
                      spacing={0}
                      className="rounded-lg border border-border bg-card p-0.5"
                      aria-label="Sort players in view"
                    >
                      <ToggleGroupItem value="points" title={totalsView ? "Season total, highest first" : "This GW: scored, or the projection if they have not played yet"}>
                        Points
                      </ToggleGroupItem>
                      {!gwComplete ? (
                        <ToggleGroupItem value="scored" title="Scored so far, highest first">
                          Scored
                        </ToggleGroupItem>
                      ) : null}
                      {!gwComplete ? (
                        <ToggleGroupItem value="left" title="Still to play, highest first">
                          Left
                        </ToggleGroupItem>
                      ) : null}
                      <ToggleGroupItem value="name" title="Name A–Z">
                        A–Z
                      </ToggleGroupItem>
                    </ToggleGroup>
                    <Select
                      value={PLAYER_STAT_SORTS.some((row) => row.id === listSort) ? listSort : null}
                      onValueChange={(id) => {
                        if (typeof id === "string") setPlayerSort(asPlayerSort(id))
                      }}
                    >
                      <SelectTrigger
                        size="sm"
                        className="h-8 min-h-8 rounded-lg border-border px-2.5 text-[13px] shadow-none"
                        aria-label="Sort by stat"
                      >
                        <SelectValue placeholder="Stat">
                          {PLAYER_STAT_SORTS.find((row) => row.id === listSort)?.label ?? null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent align="start" alignItemWithTrigger={false}>
                        {PLAYER_STAT_SORTS.map((row) => (
                          <SelectItem key={row.id} value={row.id}>
                            {row.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                }
                rankBy={listSort}
                series={listedPlayers.map((p) => {
                    const ownerIndex = Math.max(0, data.managers.findIndex((m) => m.teamId === p.ownerTeamId))
                    const owner = data.managers[ownerIndex]
                    const week = weekOf(p)
                    const bar = weekBar(p, week)
                    const pending = !totalsView && weekPending(p, week, gwComplete || !viewingCurrent)
                    const total = playerSeasonFpts(p)
                    const currentWeek = playerWeekPts(p, data.currentPeriod, data.currentPeriod)
                    const bits = playerFormBits(p, currentWeek, viewingCurrent)
                    return {
                      id: p.id,
                      label: p.name,
                      color: CHART_PALETTE[ownerIndex % CHART_PALETTE.length],
                      club: p.team,
                      owner: owner?.name,
                      ownerId: p.ownerTeamId,
                      position: p.position,
                      hint: [p.position, owner ? managerChip(owner, data.managers) : null].filter(Boolean).join(" · "),
                      values: [totalsView ? total : pending ? bar.forecast : bar.scored],
                      live: [totalsView ? total : pending ? null : bar.scored],
                      pending,
                      heat: bits.heat,
                      chips: bits.chips,
                      seasonChips: bits.season,
                      why: bits.why,
                      photoUrl: bits.photoUrl,
                      crestUrl: bits.crestUrl,
                    }
                  })}
              />
          ) : (
            <FormChart
              splitAt="lg"
              title={seasonView ? "League · season" : `League · GW${activeWeek}`}
              caption={
                seasonView
                  ? "Season FPts after each gameweek. Tap a team to highlight their line."
                  : `Table through GW${activeWeek}. Lines are still running season totals.`
              }
              unit="pts"
              xLabels={weekPeriods.map((p) => `GW${p}`)}
              weekLabel={seasonView ? "Season" : `GW${activeWeek}`}
              isLive={!seasonView && activeWeek === data.currentPeriod && !gwComplete}
              activeId={managerId}
              totals={false}
              rankIndex={seasonView || weekIndex < 0 ? null : weekIndex}
              action={
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" variant="outline" size="sm" onClick={() => openManagerPlayers(managerId)}>
                    Their players
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={openAllPlayers}>
                    All players
                  </Button>
                </div>
              }
              onTick={(index) => {
                const period = weekPeriods[index]
                if (period) setWeekFocus(period)
              }}
              toolbar={
                <WeekChips
                  periods={scoringWeeks}
                  activeWeek={activeWeek}
                  seasonView={seasonView}
                  onSeason={() => setWeekFocus("season")}
                  onWeek={setWeekFocus}
                />
              }
              onSelect={(id) => setManagerId(id)}
              series={data.managers.map((m) => ({
                id: m.teamId,
                label: m.name,
                code: managerChip(m, data.managers),
                hint: m.you ? "You" : undefined,
                values: weekPeriods.map((period) => {
                  const row = m.cumulative.find((pt) => pt.period === period)
                  if (!row) return null
                  return row.live ?? row.forecast ?? row.value
                }),
                emphasis: m.you,
              }))}
            />
          )}
            </motion.div>
          </AnimatePresence>
        </div>
      </PageShell>
    </div>
  )
}
