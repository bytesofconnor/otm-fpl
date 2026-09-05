// Description: Form page — one pane at a time. Teams, league pool, a roster, wire.
"use client"

import * as React from "react"
import Link from "next/link"
import type { FantraxFormSnapshot } from "@/lib/fantrax-shared"
import { OTM_LEAGUE_ID, parseLeagueId, managerChip, pickupNotes } from "@/lib/fantrax-shared"
import { FormChart, PoolChart, CHART_PALETTE } from "@/components/form-chart"
import { useLeagueStatus } from "@/components/league-status"
import { copyShare } from "@/lib/share"
import { PageShell, pageWidth } from "@/components/page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion"

const LEAGUE_KEY = "otm_fantrax_league_id"
const TEAM_KEY = "otm_fantrax_team_id"
const POSITIONS = ["G", "D", "M", "F"] as const
const POS_COLS = [
  { id: "G", code: "GK", name: "Keepers" },
  { id: "D", code: "DEF", name: "Defenders" },
  { id: "M", code: "MID", name: "Mids" },
  { id: "F", code: "FWD", name: "Forwards" },
] as const
const PANES = ["teams", "league", "players", "wire"] as const
type FormPane = (typeof PANES)[number]

function asPane(value: string | null): FormPane | null {
  if (value === "week") return "teams"
  return PANES.includes(value as FormPane) ? (value as FormPane) : null
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
    mgr: params.get("mgr"),
    club: params.get("club"),
    wire: params.get("w"),
    gw: params.get("gw") === "all" ? ("season" as const) : params.get("gw") ? Number(params.get("gw")) : null,
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
  const [ownerFilter, setOwnerFilter] = React.useState<string | null>(null)
  const [clubFilter, setClubFilter] = React.useState<string | null>(null)
  const [weekFocus, setWeekFocus] = React.useState<number | "season" | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [dir, setDir] = React.useState<1 | -1>(1)
  const [searchExpanded, setSearchExpanded] = React.useState(false)
  const hydrated = React.useRef(false)
  const paneRef = React.useRef(pane)
  const swipe = React.useRef<{ x: number; y: number; id: number } | null>(null)
  const reduceMotion = useReducedMotion()
  paneRef.current = pane

  React.useEffect(() => {
    const storedLeague = parseLeagueId(window.localStorage.getItem(LEAGUE_KEY) ?? "")
    const storedTeam = window.localStorage.getItem(TEAM_KEY) ?? ""
    setLeagueId(storedLeague || OTM_LEAGUE_ID)
    setTeamId(storedTeam)
    const incoming = readParams()
    setPane(incoming.pane)
    setQuery(incoming.q)
    setPositions(incoming.pos)
    if (incoming.mgr) setOwnerFilter(incoming.mgr)
    if (incoming.club) setClubFilter(incoming.club)
    if (incoming.gw != null && !Number.isNaN(incoming.gw)) setWeekFocus(incoming.gw)
  }, [])

  React.useEffect(() => {
    if (!leagueId) return
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
        if (incoming.mgr) setOwnerFilter(incoming.mgr)
        if (incoming.club) setClubFilter(incoming.club)
        if (incoming.gw != null && !Number.isNaN(incoming.gw)) setWeekFocus(incoming.gw)
        else setWeekFocus((prev) => prev ?? next.currentPeriod)
        setStatus({ leagueName: next.leagueName, periodLabel: `GW${next.currentPeriod}`, live: false })
        hydrated.current = true
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === "AbortError") return
        setError(err instanceof Error ? err.message : "Could not load form")
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [leagueId, teamId, setStatus])

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
    if (pane !== "teams") params.set("view", pane)
    if (query.trim()) params.set("q", query.trim())
    if (positions.length) params.set("pos", positions.join(""))
    if (managerId) params.set("team", managerId)
    if (poolPlayerId) params.set("p", poolPlayerId)
    if (ownerFilter) params.set("mgr", ownerFilter)
    if (clubFilter) params.set("club", clubFilter)
    if (wireId) params.set("w", wireId)
    if (weekFocus === "season") params.set("gw", "all")
    else if (typeof weekFocus === "number" && (data?.managers[0]?.points.length ?? 0) > 1) {
      params.set("gw", String(weekFocus))
    }
    const qs = params.toString()
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
      history.replaceState(null, "", next)
    }
  }, [pane, query, positions, managerId, poolPlayerId, ownerFilter, clubFilter, wireId, weekFocus, data])

  React.useEffect(() => {
    if (positions.length === POSITIONS.length) setPositions([])
  }, [positions])

  const go = React.useCallback((target: FormPane, hint?: 1 | -1) => {
    const from = PANES.indexOf(paneRef.current)
    const to = PANES.indexOf(target)
    if (to < 0 || target === paneRef.current) return
    setDir(hint ?? (to >= from ? 1 : -1))
    if (target === "league") setPoolPlayerId(null)
    if (target === "players") {
      setOwnerFilter((prev) => prev ?? managerId)
    }
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
      } else if (event.key >= "1" && event.key <= "4") {
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
    setOwnerFilter(id)
    setManagerId(id)
    const onRoster = data.leagueOwned.some((p) => p.id === poolPlayerId && p.ownerTeamId === id)
    if (!onRoster) setPoolPlayerId(null)
  }

  function openManagerPlayers(id: string | null) {
    focusRoster(id)
    go("players")
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
      <PageShell className="space-y-4">
        <Skeleton className="h-12 w-full rounded-[var(--radius-panel)]" />
        <Skeleton className="h-[28rem] w-full rounded-[var(--radius-panel)]" />
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

  const showingPlayers = pane === "players"
  const weekPeriods = data.managers[0]?.points.map((p) => p.period) ?? []
  const seasonView = weekFocus === "season" && weekPeriods.length > 1
  const activeWeek =
    typeof weekFocus === "number" && weekPeriods.includes(weekFocus) ? weekFocus : data.currentPeriod
  const weekIndex = weekPeriods.indexOf(activeWeek)
  const managerPoints = data.managers.map((m) => (seasonView ? m.points : [m.points[Math.max(0, weekIndex)]].filter(Boolean)))
  const managerLabels = seasonView ? weekPeriods.map((p) => `GW${p}`) : [`GW${activeWeek}`]
  const unownedFiltered = data.unowned.filter((p) => {
    if (positions.length && !positions.includes(p.position)) return false
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return `${p.name} ${p.team} ${p.wire ?? ""}`.toLowerCase().includes(q)
  })
  const leagueOwned = data.leagueOwned.filter((p) => {
    if (p.points == null) return false
    if (positions.length && !positions.includes(p.position)) return false
    if (!query.trim()) return true
    const manager = data.managers.find((m) => m.teamId === p.ownerTeamId)
    return `${p.name} ${p.team} ${manager?.name ?? ""} ${manager?.shortName ?? ""} ${manager?.owner ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
  })
  const you = data.managers.find((m) => m.you)
  const rosterId = ownerFilter ?? managerId ?? you?.teamId ?? data.managers[0]?.teamId ?? null
  const rosterManager = data.managers.find((m) => m.teamId === rosterId) ?? you ?? data.managers[0]
  const rosterPlayers = leagueOwned.filter(
    (p) => p.ownerTeamId === rosterId && (!clubFilter || p.team === clubFilter),
  )
  const leagueGroups = data.managers.map((m, i) => ({
    id: m.teamId,
    code: managerChip(m, data.managers),
    name: m.name,
    players: leagueOwned
      .filter((p) => p.ownerTeamId === m.teamId)
      .map((p) => ({
        id: p.id,
        name: p.name,
        value: p.points as number,
        scored: p.live ?? null,
        club: p.team,
        position: p.position,
        color: CHART_PALETTE[i % CHART_PALETTE.length],
        owner: m.name,
        ownerId: m.teamId,
      })),
  }))
  const rosterColor = CHART_PALETTE[Math.max(0, data.managers.findIndex((m) => m.teamId === rosterId)) % CHART_PALETTE.length]
  const jumps: Array<{ id: FormPane; label: string; count?: number }> = [
    { id: "teams", label: "Teams" },
    { id: "league", label: "League", count: leagueOwned.length },
    { id: "players", label: "Players", count: rosterPlayers.length },
    { id: "wire", label: "Wire", count: (unownedFiltered.length ? unownedFiltered : data.unowned).length },
  ]

  const league = data
  function shareCaption(): string {
    const bits = ["OTM Form"]
    if (pane === "wire") bits.push("Wire")
    else if (pane === "league") bits.push("League")
    else bits.push(showingPlayers ? "Players" : "Teams")
    if (positions.length) bits.push(positions.join("/"))
    if (ownerFilter) bits.push(league.managers.find((m) => m.teamId === ownerFilter)?.name ?? "manager")
    if (clubFilter) bits.push(clubFilter)
    if (query.trim()) bits.push(`“${query.trim()}”`)
    const pinned =
      pane === "wire"
        ? league.unowned.find((p) => p.id === wireId)
        : league.leagueOwned.find((p) => p.id === poolPlayerId)
    const manager = league.managers.find((m) => m.teamId === managerId)
    if (pane === "wire" && pinned) {
      bits.push(`${pinned.name} · ${pinned.points?.toFixed(1) ?? "—"} FPts · ${pinned.wire ?? "FA"}`)
    } else if ((showingPlayers || pane === "league") && pinned) {
      bits.push(`${pinned.name} · ${pinned.team} ${pinned.position} · ${pinned.points?.toFixed(1) ?? "—"} FPts`)
    } else if (manager) {
      const slice = managerPoints[league.managers.indexOf(manager)]
      const last = slice?.at(-1)
      bits.push(
        `${manager.name} · ${seasonView ? "season" : `GW${activeWeek}`} · ${last?.live != null ? `${last.live} scored` : "—"} / ${last?.forecast ?? last?.value ?? "—"} proj`,
      )
    }
    return bits.join(" · ")
  }

  async function onCopy() {
    const ok = await copyShare(shareCaption(), window.location.href)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="relative">
      <div className="fixed inset-0 z-0 bg-background pointer-events-none" aria-hidden="true" />
      <a href="#form-panel" className="skip-link">
        Skip to chart
      </a>
      <div id="form-dock" className="sticky top-[calc(var(--header-h)+env(safe-area-inset-top))] z-40 border-b border-border bg-card/95 backdrop-blur-sm sm:bg-card overflow-x-clip">
        <div className={pageWidth}>
          <div className="flex items-stretch justify-between gap-1 sm:gap-2 md:gap-4 overflow-x-clip">
            <LayoutGroup id="form-tabs">
            <Tabs
              value={pane}
              onValueChange={(next) => {
                if (typeof next === "string") go(next as FormPane)
              }}
              className="min-w-0 flex-1 gap-0 overflow-x-clip"
            >
              <TabsList variant="line" className="h-14 w-full justify-start gap-0.5 rounded-none bg-transparent p-0 sm:h-12 md:h-14 sm:gap-1 md:gap-2 overflow-x-clip" role="tablist" aria-label="Form views">
                {jumps.map((item) => (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className="tap relative h-14 flex-none rounded-none px-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] after:!hidden sm:h-12 sm:px-2 sm:text-[11px] md:h-14 md:px-3 md:text-[12px] md:tracking-[0.14em]"
                    role="tab"
                    aria-selected={pane === item.id}
                    aria-controls={`form-panel-${item.id}`}
                    style={{ minHeight: '44px' }}
                  >
                    <span className="whitespace-nowrap">{item.label}</span>
                    {item.count != null ? (
                      <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground/80 sm:ml-1 sm:text-[11px]">{item.count}</span>
                    ) : null}
                    {pane === item.id ? (
                      <motion.span
                        layoutId="form-tab-ink"
                        className="absolute inset-x-2 bottom-0 h-0.5 bg-foreground sm:inset-x-2 md:inset-x-3"
                        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                        aria-hidden="true"
                      />
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            </LayoutGroup>
            <div className="hidden sm:flex shrink-0 items-center self-center rounded-md bg-muted/80 p-0.5 ring-1 ring-border/80" role="group" aria-label="Navigate between charts">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
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
          <div className="flex items-center justify-end gap-2 border-t border-border/50 px-3 py-1.5 sm:hidden">
            <Button type="button" variant="ghost" size="sm" className="tap h-9 shrink-0 px-3 text-[13px]" onClick={() => void onCopy()} aria-label="Copy share link">
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          {pane !== "teams" ? (
            <div className="mb-2 sm:mb-3" role="search">
              {/* Mobile: Compact search - expands when tapped */}
              <div className="flex gap-1.5 md:hidden overflow-x-clip">
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
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-muted/70 p-1.5 ring-1 ring-border/70 focus-within:ring-foreground/20 overflow-hidden">
                    <Search className="ml-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <Input
                      id="form-search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onBlur={() => {
                        if (!query.trim()) setSearchExpanded(false)
                      }}
                      placeholder="Player or club"
                      spellCheck={false}
                      autoComplete="off"
                      autoCorrect="off"
                      className="h-9 min-w-0 flex-1 border-0 bg-transparent text-[15px] shadow-none ring-0 focus-visible:border-transparent focus-visible:ring-0"
                      aria-label="Search players, managers, or clubs"
                    />
                  </div>
                )}
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
                  className="shrink-0 rounded-lg bg-card p-0.5 ring-1 ring-border/80"
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
                  onClick={() => {
                    setPositions([])
                    setQuery("")
                    setClubFilter(null)
                    setSearchExpanded(false)
                  }}
                  disabled={!positions.length && !query && !clubFilter}
                  aria-label="Clear all filters"
                >
                  Clear
                </Button>
              </div>

              {/* Desktop: Full search bar */}
              <div className="hidden min-h-[3.5rem] flex-row items-center gap-1.5 rounded-md bg-muted/70 p-1.5 ring-1 ring-border/70 focus-within:ring-foreground/20 md:flex md:gap-0 md:p-0 md:pr-1.5 overflow-x-clip">
                <div className="flex min-w-0 flex-1 items-center overflow-hidden">
                  <label htmlFor="form-search-desktop" className="sr-only">Search players, managers, or clubs</label>
                  <Search className="ml-3 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="form-search-desktop"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Player, manager, or club"
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[15px] shadow-none ring-0 focus-visible:border-transparent focus-visible:ring-0"
                    aria-label="Search players, managers, or clubs"
                  />
                </div>
                <div className="flex items-center justify-end gap-1 shrink-0">
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
                    className="tap rounded-lg bg-card p-0.5 ring-1 ring-border/80 shrink-0"
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
                    onClick={() => {
                      setPositions([])
                      setQuery("")
                      setClubFilter(null)
                    }}
                    disabled={!positions.length && !query && !clubFilter}
                    aria-label="Clear all filters"
                  >
                    Clear
                  </Button>
                </div>
              </div>
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
          {pane === "league" ? (
            <PoolChart
              title={
                positions.length === 1
                  ? `The league · ${POS_COLS.find((c) => c.id === positions[0])?.name ?? "position"}`
                  : "The league · every owned player"
              }
                caption="Fill is scored. The gap is what’s still in this week — Fantrax overwrites proj with actual once a player is done. This roster opens that squad on Players."
              unit="FPts"
              groups={leagueGroups}
              activeId={managerId}
              activePlayerId={poolPlayerId}
              keepEmpty={!query.trim()}
              action={
                <Button type="button" variant="outline" size="sm" onClick={() => openManagerPlayers(managerId)}>
                  This roster
                </Button>
              }
              onSelect={(id) => {
                setManagerId(id)
                setPoolPlayerId(null)
              }}
              onSelectPlayer={(id, team) => {
                setPoolPlayerId((prev) => (prev === id ? null : id))
                setManagerId(team)
              }}
            />
          ) : pane === "wire" ? (
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
                  .map((p) => ({
                    id: p.id,
                    label: p.name,
                    color: CHART_PALETTE[0],
                    hint: [`${p.points != null ? p.points.toFixed(1) : "—"} FPts`, ...pickupNotes(p)].filter(Boolean).join(" · "),
                    values: [p.pickup ?? p.points],
                  }))}
              />
            ) : (
              <Card size="flush" className="px-5 py-12 text-[14px] text-muted-foreground sm:px-6">
                No unowned players match this search.
              </Card>
            )
          ) : pane === "players" ? (
            rosterPlayers.length ? (
              <FormChart
                title={
                  positions.length === 1
                    ? `Roster · ${POS_COLS.find((c) => c.id === positions[0])?.name ?? "position"}`
                    : "Roster · this week"
                }
                headline={rosterManager?.name}
                caption="Fill is scored. Gap is still to play. Finished players collapse to one dim dot. Click a player to pin them."
                unit="FPts"
                xLabels={[`GW${activeWeek}`]}
                activeId={poolPlayerId}
                onSelect={(id) => setPoolPlayerId((prev) => (prev === id ? null : id))}
                onFilterClub={(club) => {
                  setClubFilter((prev) => (prev === club ? null : club))
                }}
                action={
                  clubFilter ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setClubFilter(null)}>
                      {clubFilter} ×
                    </Button>
                  ) : null
                }
                toolbar={
                  <ToggleGroup
                    value={rosterId ? [rosterId] : []}
                    onValueChange={(ids) => {
                      const id = ids[0]
                      if (id) focusRoster(id)
                    }}
                    variant="outline"
                    size="sm"
                    spacing={1}
                    className="flex flex-wrap"
                  >
                    {data.managers.map((m) => (
                      <ToggleGroupItem
                        key={m.teamId}
                        value={m.teamId}
                        title={m.owner ? `${m.name} · ${m.owner}` : m.name}
                      >
                        {managerChip(m, data.managers)}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                }
                rankByRemaining
                series={rosterPlayers
                  .slice()
                  .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
                  .map((p) => ({
                    id: p.id,
                    label: p.name,
                    color: rosterColor,
                    club: p.team,
                    owner: rosterManager?.name,
                    ownerId: rosterId ?? undefined,
                    hint: [p.team, p.position].filter(Boolean).join(" · "),
                    values: [p.points],
                    live: [p.live ?? null],
                  }))}
              />
            ) : (
              <Card size="flush" className="px-5 py-12 text-[14px] text-muted-foreground sm:px-6">
                No players match this search.
              </Card>
            )
          ) : (
            <FormChart
              title={
                seasonView
                  ? "Managers · season · scored vs projected"
                  : `Managers · GW${activeWeek} · scored vs projected`
              }
              caption={
                seasonView
                  ? "Weekly totals, not cumulative. Filled = scored that GW. Gap = that week’s leftover. Click a GW label to isolate it."
                  : "Filled = scored. Gap = still to play this week. Teams that are done sit on one dot."
              }
              unit="pts"
              xLabels={managerLabels}
              activeId={managerId}
              action={
                <Button type="button" variant="outline" size="sm" onClick={() => openManagerPlayers(managerId)}>
                  Their players
                </Button>
              }
              onTick={
                seasonView
                  ? (index) => {
                      const period = weekPeriods[index]
                      if (period) setWeekFocus(period)
                    }
                  : undefined
              }
              toolbar={
                weekPeriods.length > 1 ? (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant={seasonView ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setWeekFocus("season")}
                    >
                      Season
                    </Button>
                    {weekPeriods.map((period) => (
                      <Button
                        key={period}
                        type="button"
                        variant={!seasonView && activeWeek === period ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setWeekFocus(period)}
                      >
                        GW{period}
                      </Button>
                    ))}
                  </div>
                ) : undefined
              }
              onSelect={(id) => {
                setManagerId(id)
              }}
              series={data.managers.map((m, mi) => ({
                id: m.teamId,
                label: m.name,
                code: managerChip(m, data.managers),
                hint: m.you ? "You" : undefined,
                values: (managerPoints[mi] ?? []).map((p) => p.forecast ?? p.value),
                live: (managerPoints[mi] ?? []).map((p) => p.live ?? null),
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
