// Description: Interactive Form charts — clickable dots, live tooltips, ranked lists, keyboard-friendly.
"use client"

import * as React from "react"
import type { ReactElement } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { remainingPts } from "@/lib/fantrax-shared"
import { nextPlayerPhotoUrl } from "@/lib/clubs"
import type { StatChip } from "@/lib/fantrax-shared"
import { heatEmoji, heatLabel, type HeatBucket } from "@/lib/form-engine"
import { SplitBoard } from "@/components/split-board"
import { ImageWithFallback } from "@/components/ui/image-with-fallback"
import { cn } from "@/lib/utils"

export type ChartSeries = {
  id: string
  label: string
  /** Projected (or sole) values. When `live` is set, these are the rings. */
  values: Array<number | null>
  /** Actually scored. Solid dots. Omit on charts that are projection-only. */
  live?: Array<number | null>
  emphasis?: boolean
  hint?: string
  code?: string
  color?: string
  owner?: string
  ownerId?: string
  club?: string
  heat?: HeatBucket
  chips?: StatChip[]
  why?: string | null
  position?: string
  photoUrl?: string
  crestUrl?: string
  seasonChips?: StatChip[]
  /** Player has not played this GW — list separately, do not mix into scored rank. */
  pending?: boolean
}

export type ChartRankBy =
  | "points"
  | "scored"
  | "left"
  | "pos"
  | "name"
  | "club"
  | "goals"
  | "assists"
  | "cs"
  | "minutes"
  | "kp"
  | "saves"
  | "sot"

export const PLAYER_STAT_SORTS = [
  { id: "goals", label: "Goals", chips: ["G"] },
  { id: "assists", label: "Assists", chips: ["A"] },
  { id: "cs", label: "Clean sheets", chips: ["CS"] },
  { id: "minutes", label: "Minutes", chips: ["Min"] },
  { id: "kp", label: "Key passes", chips: ["KP"] },
  { id: "saves", label: "Saves", chips: ["Sv"] },
  { id: "sot", label: "Shots on target", chips: ["SoT"] },
] as const

export const PLAYER_SORTS = [
  "points",
  "scored",
  "left",
  "name",
  ...PLAYER_STAT_SORTS.map((row) => row.id),
] as const

const POS_RANK: Record<string, number> = { G: 0, D: 1, M: 2, F: 3 }

const STAT_CHIP: Record<(typeof PLAYER_STAT_SORTS)[number]["id"], readonly string[]> = {
  goals: ["G"],
  assists: ["A"],
  cs: ["CS"],
  minutes: ["Min"],
  kp: ["KP"],
  saves: ["Sv"],
  sot: ["SoT"],
}

function seriesStat(s: ChartSeries, labels: readonly string[]): number {
  const chips = [...(s.chips ?? []), ...(s.seasonChips ?? [])]
  for (const label of labels) {
    const chip = chips.find((row) => row.label === label)
    if (!chip) continue
    const n = Number(chip.value)
    if (Number.isFinite(n)) return n
  }
  return -1
}

/** Distinct series colors that still read on night ink. */
export const CHART_PALETTE = [
  "#7dcea0",
  "#3dcf7a",
  "#e11d48",
  "#5b8def",
  "#ea580c",
  "#c084fc",
  "#e0b43a",
  "#22d3ee",
  "#db2777",
  "#86efac",
  "#fb923c",
  "#93c5fd",
  "#e6c35c",
  "#94a3b8",
]

function hexLuma(color: string): number {
  const hex = color.trim().replace("#", "")
  if (hex.length < 6) return 0.5
  const r = Number.parseInt(hex.slice(0, 2), 16) / 255
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255
  if (![r, g, b].every(Number.isFinite)) return 0.5
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function onFillInk(color: string): string {
  return hexLuma(color) > 0.55 ? "#0c0c0c" : "#f6f6f6"
}

function useDesktopPlot(): boolean {
  const [desktop, setDesktop] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const sync = () => setDesktop(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  return desktop
}

function useMobilePlot(): boolean {
  const [mobile, setMobile] = React.useState(false)
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const sync = () => setMobile(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  return mobile
}

type Tip = { x: number; y: number; w: number; title: string; body: string; color: string }

function ChartTooltip({ tip }: { tip: Tip | null }): ReactElement | null {
  if (!tip) return null
  const pad = 12
  const maxW = Math.min(252, Math.max(96, tip.w - pad * 2))
  const half = maxW / 2
  const x = Math.min(Math.max(tip.x, pad + half), Math.max(pad + half, tip.w - pad - half))
  const below = tip.y < 88
  return (
    <div
      className="pointer-events-none absolute z-20 w-max max-w-[min(252px,calc(100%-24px))] rounded-md bg-foreground px-3.5 py-2.5 text-[13px] text-background shadow-[var(--shadow-lg)]"
      style={{
        left: x,
        top: below ? tip.y + 14 : tip.y - 10,
        transform: below ? "translate(-50%, 0)" : "translate(-50%, -100%)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: tip.color }} />
        <span className="truncate font-semibold tracking-tight text-background">{tip.title}</span>
      </div>
      <div className="mt-0.5 font-mono tabular-nums text-background/70">{tip.body}</div>
    </div>
  )
}

function useSvgTip(ref: React.RefObject<HTMLDivElement | null>) {
  const [tip, setTip] = React.useState<Tip | null>(null)
  const show = React.useCallback(
    (event: React.PointerEvent, next: Omit<Tip, "x" | "y" | "w">) => {
      const box = ref.current?.getBoundingClientRect()
      if (!box) return
      setTip({
        ...next,
        x: event.clientX - box.left,
        y: event.clientY - box.top,
        w: box.width,
      })
    },
    [ref],
  )
  return { tip, show, hide: () => setTip(null) }
}

function TitleSelect({
  value,
  label,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: string | null
  label: string
  options: Array<{ id: string; label: string; color: string; you?: boolean }>
  onChange: (id: string) => void
  ariaLabel: string
  className?: string
}): ReactElement {
  return (
    <Select
      value={value}
      onValueChange={(id) => {
        if (typeof id === "string") onChange(id)
      }}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          "otm-title h-auto min-h-[2.7rem] w-full max-w-full items-start justify-start gap-2 rounded-md border-0 bg-transparent py-0 pl-0 pr-1 shadow-none",
          "text-left text-[1.35rem] leading-tight sm:text-[1.35rem] sm:leading-snug md:text-[1.5rem]",
          "hover:bg-muted/50 hover:border-transparent",
          "focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ring/40",
          "*:data-[slot=select-value]:block *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-none",
          "[&_svg]:mt-1.5 [&_svg]:text-muted-foreground [&_svg:not([class*='size-'])]:size-5",
          className,
        )}
      >
        <SelectValue>
          <span className="block min-w-0 whitespace-normal [overflow-wrap:break-word] [word-break:normal] line-clamp-2">
            {label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className="min-w-[min(calc(100vw-2rem),22rem)]">
        {options.map((row) => (
          <SelectItem key={row.id} value={row.id}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: row.color }} />
              <span className="truncate">{row.label}</span>
              {row.you ? <span className="text-[11px] uppercase tracking-wide text-muted-foreground">You</span> : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function FocusStats({
  scored,
  projected,
  unit,
  color,
  split,
  gwComplete,
}: {
  scored: number | null
  projected: number | null
  unit: string
  color: string
  split: boolean
  gwComplete?: boolean
}): ReactElement {
  const left = remainingPts(projected, scored)
  if (!split) {
    return (
      <div className="text-right">
        <p className="otm-kicker">{unit}</p>
        <p className="otm-score mt-0.5 text-[1.85rem] leading-none sm:text-[1.65rem]" style={{ color }}>
          {projected != null ? projected.toFixed(1) : "—"}
        </p>
      </div>
    )
  }
  if (gwComplete) {
    return (
      <div className="text-right">
        <p className="otm-kicker">Scored</p>
        <p className="otm-score mt-0.5 text-[1.85rem] leading-none sm:text-[1.65rem]" style={{ color }}>
          {scored != null ? scored.toFixed(1) : "—"}
        </p>
      </div>
    )
  }
  return (
    <div className="flex items-end gap-4 sm:gap-5">
      <div className="text-right">
        <p className="otm-kicker">Scored</p>
        <p className="otm-score mt-0.5 text-[1.85rem] leading-none sm:text-[1.65rem]" style={{ color }}>
          {scored != null ? scored.toFixed(1) : "—"}
        </p>
      </div>
      <div className="text-right">
        <p className="otm-kicker">Left</p>
        <p className="otm-score mt-0.5 text-[1.85rem] leading-none text-foreground/45 sm:text-[1.65rem]">
          {left >= 0.05 ? left.toFixed(1) : "—"}
        </p>
      </div>
    </div>
  )
}

function ScoreMeter({
  label,
  share,
  color,
  muted,
}: {
  label: string
  share: number
  color: string
  muted?: boolean
}): ReactElement {
  const width = Math.max(0, Math.min(100, share * 100))
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/70">
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, backgroundColor: color, opacity: muted ? 0.4 : 1 }}
        />
      </div>
      <span className={`w-[4.25rem] shrink-0 text-right font-mono text-[13px] tabular-nums ${muted ? "text-muted-foreground" : "text-foreground"}`}>
        {label}
      </span>
    </div>
  )
}

function HorizontalBar({
  scored,
  projected,
  color,
  maxValue,
  gwComplete,
}: {
  scored: number | null
  projected: number | null
  color: string
  maxValue: number
  gwComplete?: boolean
}): ReactElement {
  const scoredVal = scored ?? 0
  const projVal = projected ?? 0
  const remaining = gwComplete ? 0 : Math.max(0, projVal - scoredVal)
  const scale = Math.max(maxValue, scoredVal, projVal, 1)
  const scoredPercent = (scoredVal / scale) * 100
  const remainingPercent = (remaining / scale) * 100
  
  return (
    <div className="relative h-8 w-full overflow-hidden rounded-md bg-muted/50 ring-1 ring-border/50">
      {/* Banked segment */}
      {scoredPercent > 0 ? (
        <div 
          className="absolute inset-y-0 left-0 transition-all"
          style={{ 
            width: `${scoredPercent}%`,
            backgroundColor: color,
            opacity: 1
          }}
          aria-label={`Scored ${scoredVal.toFixed(1)}`}
        />
      ) : null}
      {/* Still to play segment */}
      {remainingPercent > 0 ? (
        <div 
          className="absolute inset-y-0 transition-all"
          style={{ 
            left: `${scoredPercent}%`,
            width: `${remainingPercent}%`,
            backgroundColor: color,
            opacity: 0.3
          }}
          aria-label={`${remaining.toFixed(1)} still coming`}
        />
      ) : null}
      {/* Values overlay */}
      <div className="absolute inset-0 flex items-center justify-between px-2 text-[11px] font-semibold tabular-nums">
        <span style={{ color: scoredPercent > 12 ? onFillInk(color) : undefined }} className={scoredPercent > 12 ? undefined : "text-foreground"}>
          {scored != null || projected != null ? (scoredVal > 0 || remaining <= 0 ? scoredVal.toFixed(1) : "") : ""}
        </span>
        <span className="text-foreground/70">
          {remaining > 0 ? `+${remaining.toFixed(1)}` : ""}
        </span>
      </div>
    </div>
  )
}

function avatarClipId(seriesId: string, point: number): string {
  return `otm-face-${seriesId.replace(/[^a-zA-Z0-9_-]/g, "")}-${point}`
}

function FaceMark({
  cx,
  cy,
  r,
  href,
  color,
  on,
  clipId,
}: {
  cx: number
  cy: number
  r: number
  href: string
  color: string
  on: boolean
  clipId: string
}): ReactElement {
  const [src, setSrc] = React.useState(href)
  React.useEffect(() => {
    setSrc(href)
  }, [href])
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <circle cx={cx} cy={cy} r={Math.max(1, r - 1.25)} />
        </clipPath>
      </defs>
      <image
        href={src}
        x={cx - r}
        y={cy - r}
        width={r * 2}
        height={r * 2}
        clipPath={`url(#${clipId})`}
        preserveAspectRatio="xMidYMin slice"
        className="pointer-events-none"
        onError={() => {
          const next = nextPlayerPhotoUrl(src)
          if (next && next !== src) setSrc(next)
        }}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={on ? 2.4 : 1.55}
        className="pointer-events-none"
      />
    </>
  )
}

function PlayerFace({
  src,
  alt,
  color,
  size = "sm",
  fallback,
}: {
  src?: string
  alt: string
  color?: string
  size?: "sm" | "md"
  fallback?: string
}): ReactElement {
  const dim = size === "md" ? "h-12 w-12 sm:h-14 sm:w-14" : "h-9 w-9 sm:h-10 sm:w-10"
  return (
    <span
      className={`${dim} shrink-0 overflow-hidden rounded-full bg-muted`}
      style={color ? { boxShadow: `0 0 0 1.5px ${color}` } : undefined}
    >
      <ImageWithFallback src={src} alt={alt} fallback={fallback ?? "/player-fallback.svg"} className="h-full w-full object-cover object-top" />
    </span>
  )
}

function StatLine({ chips, prefix }: { chips?: StatChip[]; prefix?: string }): ReactElement | null {
  if (!chips?.length) return null
  return (
    <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
      {prefix ? <span className="font-sans text-[10px] uppercase tracking-[0.12em]">{prefix}</span> : null}
      {chips.map((chip) => (
        <span key={`${prefix ?? ""}-${chip.label}-${chip.value}`}>
          <span className="text-foreground">{chip.value}</span> {chip.label}
        </span>
      ))}
    </span>
  )
}

function SeriesIdentity({
  label,
  heat,
  chips,
  why,
  meta,
}: {
  label: string
  heat?: HeatBucket
  chips?: StatChip[]
  why?: string | null
  meta?: string | null
}): ReactElement {
  return (
    <span className="min-w-0 flex-1 text-left whitespace-normal">
      <span className="flex items-baseline gap-1.5">
        <span className="min-w-0 truncate font-medium" title={label}>
          {label}
        </span>
        {heat ? (
          <span className="shrink-0 text-[13px] leading-none" title={heatLabel(heat)} aria-label={heatLabel(heat)}>
            {heatEmoji(heat)}
          </span>
        ) : null}
      </span>
      {meta ? <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{meta}</span> : null}
      <StatLine chips={chips} />
      {why ? <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">{why}</span> : null}
    </span>
  )
}

function lastValue(values: Array<number | null>): number | null {
  return values.filter((v): v is number => v != null).slice(-1)[0] ?? null
}

function sumKnown(values: Array<number | null> | undefined): number | null {
  if (!values?.length) return null
  const nums = values.filter((v): v is number => v != null)
  if (!nums.length) return null
  return nums.reduce((n, v) => n + v, 0)
}

function seriesLive(s: ChartSeries, totals: boolean): number | null {
  const live = s.live ?? []
  return totals ? sumKnown(live) : lastValue(live)
}

function seriesProjected(s: ChartSeries, totals: boolean): number | null {
  return totals ? sumKnown(s.values) : lastValue(s.values)
}

function seriesAt(
  s: ChartSeries,
  totals: boolean,
  index: number | null | undefined,
  field: "live" | "values",
): number | null {
  if (index != null && index >= 0) {
    const arr = field === "live" ? s.live : s.values
    return arr?.[index] ?? null
  }
  return field === "live" ? seriesLive(s, totals) : seriesProjected(s, totals)
}

function compareSeries(
  a: ChartSeries,
  b: ChartSeries,
  rankBy: ChartRankBy,
  split: boolean,
  totals: boolean,
  rankIndex?: number | null,
): number {
  const aLive = seriesAt(a, totals, rankIndex, "live")
  const bLive = seriesAt(b, totals, rankIndex, "live")
  const aVal = seriesAt(a, totals, rankIndex, "values")
  const bVal = seriesAt(b, totals, rankIndex, "values")
  const byPoints = (bVal ?? bLive ?? -1) - (aVal ?? aLive ?? -1)
  const byScored = (bLive ?? bVal ?? -1) - (aLive ?? aVal ?? -1)
  if (Boolean(a.pending) !== Boolean(b.pending)) return a.pending ? 1 : -1
  if (rankBy === "left" && split) {
    return remainingPts(bVal, bLive) - remainingPts(aVal, aLive) || (bLive ?? -1) - (aLive ?? -1)
  }
  if (rankBy === "scored") {
    if (totals) return byScored || byPoints
    return (bLive ?? 0) - (aLive ?? 0) || byPoints || a.label.localeCompare(b.label)
  }
  if (rankBy === "points") {
    const aWeek = Math.max(aLive ?? 0, aVal ?? 0)
    const bWeek = Math.max(bLive ?? 0, bVal ?? 0)
    return bWeek - aWeek || byPoints || a.label.localeCompare(b.label)
  }
  if (rankBy === "name") {
    return a.label.localeCompare(b.label)
  }
  if (rankBy === "club") {
    return (a.club ?? "").localeCompare(b.club ?? "") || byPoints || a.label.localeCompare(b.label)
  }
  if (rankBy === "pos") {
    const ap = POS_RANK[a.position ?? ""] ?? 9
    const bp = POS_RANK[b.position ?? ""] ?? 9
    return ap - bp || byPoints || a.label.localeCompare(b.label)
  }
  if (rankBy in STAT_CHIP) {
    const labels = STAT_CHIP[rankBy as keyof typeof STAT_CHIP]
    return seriesStat(b, labels) - seriesStat(a, labels) || byPoints || a.label.localeCompare(b.label)
  }
  return byPoints
}

function WeekIndicator({ label, isLive }: { label: string; isLive?: boolean }): ReactElement {
  return (
    <div className="flex items-center justify-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
      <span className="font-mono text-[15px] font-semibold tracking-tight text-foreground sm:text-[16px]">
        {label}
      </span>
      {isLive ? (
        <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-green-600 dark:text-green-400">
          Live
        </span>
      ) : null}
    </div>
  )
}

function formatTick(tick: number): string {
  if (tick === 0 || tick >= 10) return tick.toFixed(0)
  return tick.toFixed(1)
}


/** Ultra-short stable code for mobile x-axis. Fixed 2-3 chars, no reflow. */
function mobileLabel(label: string, code?: string): string {
  if (code) return code.slice(0, 3).toUpperCase()
  const parts = label.replace(/['']/g, "").trim().split(/\s+/)
  if (parts.length >= 2) {
    // Use initials for multi-word names: "John Smith" -> "JS"
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase()
  }
  // Single word: first 2-3 chars
  return label.slice(0, 3).toUpperCase()
}

/**
 * Spread overlapping points in a column so equal values stay distinct.
 */
function dodgeColumn<T extends { value: number }>(
  items: T[],
  xCenter: number,
  colW: number,
  yOf: (value: number) => number,
  radius = 3.4,
): Array<T & { cx: number; cy: number }> {
  const minD = radius * 2 + 1.2
  const maxOff = Math.max(0, colW / 2 - 5.5)
  const placed: Array<T & { cx: number; cy: number }> = []
  const sorted = [...items].sort((a, b) => b.value - a.value)
  for (const item of sorted) {
    const cy = yOf(item.value)
    const step = Math.min(7, Math.max(4, colW / 8))
    const candidates = [0]
    for (let k = 1; k * step <= maxOff + 0.1; k += 1) {
      candidates.push(k * step, -k * step)
    }
    let cx = xCenter
    let rowY = cy
    outer: for (let row = 0; row < 6; row += 1) {
      rowY = cy + (row % 2 === 0 ? 1 : -1) * Math.floor((row + 1) / 2) * minD * 0.55
      for (const off of candidates) {
        const nx = xCenter + off
        if (
          placed.every((q) => {
            const dx = nx - q.cx
            const dy = rowY - q.cy
            return dx * dx + dy * dy >= minD * minD
          })
        ) {
          cx = nx
          break outer
        }
      }
    }
    placed.push({ ...item, cx, cy: rowY })
  }
  return placed
}

/**
 * Renders every series at once. Click a dot or a row to focus it.
 */
export function FormChart({
  title,
  caption,
  series,
  xLabels,
  unit,
  activeId,
  onSelect,
  onBack,
  backLabel,
  plotLimit,
  plotIds,
  rankIndex,
  totals: totalsProp,
  toolbar,
  onTick,
  action,
  onFilterOwner: _onFilterOwner,
  onFilterClub,
  headline,
  rankBy,
  rankByRemaining,
  weekLabel,
  isLive,
  gwComplete,
  splitAt,
}: {
  title: string
  caption: string
  series: ChartSeries[]
  xLabels: string[]
  unit: string
  activeId?: string | null
  onSelect?: (id: string) => void
  onBack?: () => void
  backLabel?: string
  plotLimit?: number
  /** Draw only these series on the plot; the ranked list still uses every series. */
  plotIds?: string[]
  /** Rank and list values by this x-index instead of the whole series. */
  rankIndex?: number | null
  /** Sum series for ranking. Default is true when there is more than one x tick. Set false for running totals. */
  totals?: boolean
  toolbar?: React.ReactNode
  /** Click a week label (season view) to isolate that GW. */
  onTick?: (index: number) => void
  action?: React.ReactNode
  onFilterOwner?: (id: string) => void
  onFilterClub?: (club: string) => void
  headline?: string
  rankBy?: ChartRankBy
  /** @deprecated Use rankBy="left" */
  rankByRemaining?: boolean
  /** Week label to display at top of chart (e.g. "GW3" or "through GW3") */
  weekLabel?: string
  /** Whether the current period is live */
  isLive?: boolean
  /** Whether the gameweek is complete (all managers scored, not projected) */
  gwComplete?: boolean
  /** Stack the plot over the list until this breakpoint. Table uses lg so tablets stay full-width. */
  splitAt?: "md" | "lg"
}): ReactElement {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLOListElement>(null)
  const { tip, show, hide } = useSvgTip(wrapRef)
  const desktop = useDesktopPlot()
  const mobile = useMobilePlot()
  const width = desktop ? 1080 : 720
  const strip = xLabels.length <= 1 && series.length > 1
  const playerStrip = strip && series.some((s) => s.position)
  const managerStrip = strip && !playerStrip
  const height = desktop ? (playerStrip ? 440 : managerStrip ? 400 : 380) : playerStrip ? 470 : 420
  const pad = playerStrip
    ? { top: 34, right: 18, bottom: 34, left: 40 }
    : managerStrip
      ? { top: 28, right: 16, bottom: 8, left: 40 }
      : { top: 16, right: 12, bottom: 12, left: 40 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const min = 0
  const split = series.some((s) => s.live !== undefined)
  const totals = totalsProp ?? xLabels.length > 1
  const sortKey: ChartRankBy = rankByRemaining ? "left" : rankBy ?? (split ? "scored" : "points")
  const ranked = [...series].sort((a, b) => compareSeries(a, b, sortKey, split, totals, rankIndex))
  const [visibleIds, setVisibleIds] = React.useState<string[] | null>(null)
  const rankKey = ranked.map((s) => s.id).join()
  React.useEffect(() => {
    if (!playerStrip) {
      setVisibleIds(null)
      return
    }
    const root = listRef.current
    if (!root) return
    const seen = new Set<string>()
    const obs = new IntersectionObserver(
      (entries) => {
        let changed = false
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.id
          if (!id) continue
          if (entry.isIntersecting) {
            if (!seen.has(id)) {
              seen.add(id)
              changed = true
            }
          } else if (seen.delete(id)) {
            changed = true
          }
        }
        if (changed) setVisibleIds([...seen])
      },
      { root, threshold: 0.25, rootMargin: "12px 0px" },
    )
    const nodes = root.querySelectorAll("[data-id]")
    nodes.forEach((node) => obs.observe(node))
    return () => obs.disconnect()
  }, [playerStrip, rankKey])
  const plotted = (() => {
    const played = ranked.filter((s) => !s.pending)
    const pool =
      playerStrip && visibleIds && visibleIds.length
        ? ranked.filter((s) => visibleIds.includes(s.id) && !s.pending)
        : playerStrip
          ? played.slice(0, 10)
          : played
    const rows = pool.length ? pool : played.slice(0, 12)
    if (!plotLimit || rows.length <= plotLimit) return rows
    const head = rows.slice(0, plotLimit)
    if (activeId && !head.some((s) => s.id === activeId)) {
      const extra = ranked.find((s) => s.id === activeId)
      if (extra) return [...head.slice(0, plotLimit - 1), extra]
    }
    return head
  })()
  const drawn = plotIds?.length ? ranked.filter((s) => plotIds.includes(s.id)) : plotted
  const paintOrder = activeId
    ? [...drawn].sort((a, b) => Number(a.id === activeId) - Number(b.id === activeId))
    : drawn
  const scaleFrom = plotIds?.length && drawn.length ? drawn : playerStrip && plotted.length ? plotted : series
  const nums = scaleFrom.flatMap((s) => [
    ...s.values.filter((v): v is number => v != null),
    ...(s.live ?? []).filter((v): v is number => v != null),
  ])
  const max = Math.max(1, ...nums)
  const dense = strip && plotted.length > 18
  const xAt = (pointIndex: number, seriesIndex: number) => {
    if (strip) return pad.left + ((seriesIndex + 0.5) / Math.max(1, plotted.length)) * innerW
    if (xLabels.length <= 1) return pad.left + innerW / 2
    return pad.left + (pointIndex / (xLabels.length - 1)) * innerW
  }
  const y = (v: number) => pad.top + innerH - ((v - min) / (max - min)) * innerH
  const colors = new Map(series.map((s, i) => [s.id, s.color ?? CHART_PALETTE[i % CHART_PALETTE.length]]))
  const focused = activeId ? series.find((s) => s.id === activeId) ?? null : null
  const activeColor = focused ? colors.get(focused.id) ?? CHART_PALETTE[0] : CHART_PALETTE[0]
  const heading = focused?.label ?? headline ?? title
  const canPick = Boolean(onSelect) && ranked.length > 1 && ranked.length <= 24

  function pathFor(values: Array<number | null>, seriesIndex: number): string {
    const parts: string[] = []
    values.forEach((value, i) => {
      if (value == null) return
      parts.push(`${parts.length === 0 ? "M" : "L"} ${xAt(i, seriesIndex).toFixed(1)} ${y(value).toFixed(1)}`)
    })
    return parts.join(" ")
  }

  const ticks = 4
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => min + ((max - min) * i) / ticks)

  return (
    <SplitBoard
      splitAt={splitAt}
      caption={caption}
      header={
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:gap-4 sm:px-4 sm:py-4 md:px-6">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {focused?.position ? <PlayerFace src={focused.photoUrl} fallback={focused.crestUrl} alt="" color={activeColor} size="md" /> : null}
            <div className="min-w-0 flex-1">
            {onBack ? (
              <Button type="button" variant="ghost" size="sm" className="tap -ml-2 h-auto px-2 py-1 text-[13px] sm:text-[14px]" onClick={onBack}>
                {backLabel ?? "All managers"}
              </Button>
            ) : null}
            {canPick ? (
              <TitleSelect
                className={onBack ? "mt-0.5" : undefined}
                value={focused?.id ?? null}
                label={heading}
                ariaLabel="Change team"
                onChange={(id) => onSelect?.(id)}
                options={ranked.map((s) => ({
                  id: s.id,
                  label: s.label,
                  color: colors.get(s.id) ?? CHART_PALETTE[0],
                  you: s.hint === "You" || s.emphasis,
                }))}
              />
            ) : (
              <h3 className={`otm-title text-[1.35rem] leading-tight sm:text-[1.35rem] sm:leading-snug md:text-[1.5rem] ${onBack ? "mt-0.5" : ""}`}>
                <span className="block min-h-[2.7rem] whitespace-normal [overflow-wrap:break-word] [word-break:normal] line-clamp-2">{heading}</span>
              </h3>
            )}
            {focused?.hint && focused.hint !== "You" ? (
              <p className="mt-1 whitespace-normal [overflow-wrap:break-word] [word-break:normal] line-clamp-2 text-[13px] text-muted-foreground sm:text-[13px]">{focused.hint}</p>
            ) : focused?.hint === "You" ? (
              <p className="mt-1 text-[13px] text-muted-foreground sm:text-[13px]">Your team</p>
            ) : null}
            {focused?.chips?.length ? <StatLine chips={focused.chips} prefix="YTD" /> : null}
            {focused?.seasonChips?.length ? <StatLine chips={focused.seasonChips} prefix="Season" /> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-end gap-3 sm:gap-4">
            {focused ? (
              <FocusStats
                split={Boolean(split)}
                color={activeColor}
                unit={unit}
                scored={seriesAt(focused, totals, rankIndex, "live")}
                projected={seriesAt(focused, totals, rankIndex, "values")}
                gwComplete={gwComplete}
              />
            ) : null}
            {action}
          </div>
        </div>
      }
      toolbar={toolbar ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-2 sm:px-6">
          {toolbar}
        </div>
      ) : undefined}
      chart={mobile && strip ? null : (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {weekLabel && xLabels.length <= 1 ? <WeekIndicator label={weekLabel} isLive={isLive} /> : null}
      <div ref={wrapRef} className="relative min-h-0 w-full flex-1 overflow-hidden" onPointerLeave={hide}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full touch-pan-y"
          role="img"
          aria-label={title}
        >
          {!strip && rankIndex != null && rankIndex >= 0 && rankIndex < xLabels.length ? (
            <line
              x1={xAt(rankIndex, 0)}
              x2={xAt(rankIndex, 0)}
              y1={pad.top}
              y2={pad.top + innerH}
              stroke="var(--foreground)"
              strokeWidth="1"
              strokeOpacity="0.18"
            />
          ) : null}
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth="1" strokeOpacity="0.7" />
              <text
                x={pad.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--muted-foreground)"
                fontSize={desktop ? "10" : "11"}
                fontWeight={desktop ? "normal" : "500"}
                fontFamily="var(--font-mono-otm), ui-monospace, monospace"
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}
          {paintOrder.map((s, si) => {
            const on = s.id === activeId
            const color = colors.get(s.id) ?? CHART_PALETTE[0]
            const drawLine = !strip && s.values.filter((v) => v != null).length > 1
            const drawLiveLine = false
            const tipFor = (i: number) => {
              if (!split) {
                const value = s.values[i]
                return {
                  title: s.label,
                  body: `${value != null ? value.toFixed(1) : "—"} ${unit}${s.hint ? ` · ${s.hint}` : ""}`,
                  color,
                }
              }
              const proj = s.values[i]
              const scored = s.live?.[i]
              const parts = [
                scored != null ? `${scored.toFixed(1)} scored` : null,
                proj != null ? `${proj.toFixed(1)} ${unit} proj` : null,
              ].filter(Boolean)
              return { title: s.label, body: [parts.join(" · "), s.hint].filter(Boolean).join(" · ") || "—", color }
            }
            return (
              <g key={s.id} opacity={on || !activeId ? 1 : playerStrip ? (dense ? 0.62 : 0.78) : 0.28}>
                {drawLiveLine ? (
                  <path
                    d={pathFor(s.live ?? [], si)}
                    fill="none"
                    stroke={color}
                    strokeWidth={on ? 2.4 : 1.6}
                    strokeOpacity={0.45}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ) : null}
                {drawLine ? (
                  <path
                    d={pathFor(s.values, si)}
                    fill="none"
                    stroke={color}
                    strokeWidth={on ? 3 : 1.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ) : null}
                {s.values.map((value, i) => {
                  if (value == null && (s.live?.[i] ?? null) == null) return null
                  const cx = xAt(i, si)
                  const face = playerStrip ? s.photoUrl || s.crestUrl : undefined
                  const faceR = on ? 24 : drawn.length > 14 ? 18 : 21
                  if (managerStrip) {
                    const colW = innerW / Math.max(1, drawn.length)
                    const barW = Math.max(14, Math.min(44, colW * 0.62))
                    const scored = s.live?.[i] ?? null
                    const proj = value
                    const top = Math.max(scored ?? 0, proj ?? 0, 0)
                    const yBase = y(0)
                    const yTop = y(top)
                    const yLive = scored != null ? y(Math.max(0, scored)) : yBase
                    const barH = Math.max(4, yBase - yTop)
                    const scoredH = scored != null ? Math.max(0, yBase - yLive) : 0
                    const label = (scored ?? proj)?.toFixed(scored != null && scored % 1 !== 0 ? 1 : 0)
                    const x0 = cx - barW / 2
                    return (
                      <g key={`${s.id}-${i}`}>
                        <rect
                          x={cx - colW / 2}
                          y={pad.top}
                          width={colW}
                          height={innerH}
                          fill="transparent"
                          className="cursor-pointer"
                          onPointerEnter={(e) => show(e, tipFor(i))}
                          onPointerMove={(e) => show(e, tipFor(i))}
                          onClick={() => onSelect?.(s.id)}
                        />
                        <rect
                          x={x0}
                          y={yTop}
                          width={barW}
                          height={barH}
                          rx={5}
                          fill={color}
                          fillOpacity={on ? 0.22 : 0.14}
                          className="pointer-events-none"
                        />
                        {scoredH > 0 ? (
                          <rect
                            x={x0}
                            y={yLive}
                            width={barW}
                            height={scoredH}
                            rx={5}
                            fill={color}
                            fillOpacity={on ? 1 : 0.92}
                            className="pointer-events-none"
                          />
                        ) : null}
                        {s.emphasis || s.hint === "You" ? (
                          <rect
                            x={x0}
                            y={yTop}
                            width={barW}
                            height={barH}
                            rx={5}
                            fill="none"
                            stroke="var(--foreground)"
                            strokeWidth={on ? 2 : 1.4}
                            strokeOpacity={0.9}
                            className="pointer-events-none"
                          />
                        ) : on ? (
                          <rect
                            x={x0}
                            y={yTop}
                            width={barW}
                            height={barH}
                            rx={5}
                            fill="none"
                            stroke={color}
                            strokeWidth={2}
                            className="pointer-events-none"
                          />
                        ) : null}
                        {label ? (
                          <text
                            x={cx}
                            y={Math.max(pad.top + 11, yTop - 8)}
                            textAnchor="middle"
                            fill={on ? "var(--foreground)" : "var(--muted-foreground)"}
                            fontSize={desktop ? "11" : "12"}
                            fontWeight={on ? 700 : 600}
                            fontFamily="var(--font-mono-otm), ui-monospace, monospace"
                            className="pointer-events-none"
                          >
                            {label}
                          </text>
                        ) : null}
                      </g>
                    )
                  }
                  if (!split) {
                    const cy = y(value ?? 0)
                    return (
                      <g key={`${s.id}-${i}`}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={face ? faceR + 6 : 10}
                          fill="transparent"
                          className="cursor-pointer"
                          onPointerEnter={(e) => show(e, tipFor(i))}
                          onPointerMove={(e) => show(e, tipFor(i))}
                          onClick={() => onSelect?.(s.id)}
                        />
                        {face ? (
                          <FaceMark cx={cx} cy={cy} r={faceR} href={face} color={color} on={on} clipId={avatarClipId(s.id, i)} />
                        ) : (
                          <circle cx={cx} cy={cy} r={on ? 7 : 5} fill={color} stroke="var(--background)" strokeWidth={on ? 1.6 : 1.2} className="pointer-events-none" />
                        )}
                      </g>
                    )
                  }
                  const scored = s.live?.[i] ?? null
                  const proj = value
                  const caughtUp = scored != null && proj != null && Math.abs(proj - scored) < 0.4
                  const yProj = proj != null ? y(proj) : null
                  const yLive = scored != null ? y(scored) : null
                  const markY = yLive ?? yProj ?? 0
                  const ringR = on ? (dense ? 6 : 8) : dense ? 4 : 6.5
                  const fillR = on ? (dense ? 4 : 6) : dense ? 2.8 : 4.5
                  return (
                    <g key={`${s.id}-${i}`} opacity={caughtUp && !on && !face ? 0.3 : 1}>
                      {yLive != null && yProj != null && !caughtUp && !face ? (
                        <line x1={cx} x2={cx} y1={yLive} y2={yProj} stroke={color} strokeWidth={on ? 2.4 : dense ? 1.4 : 1.8} strokeOpacity={0.9} />
                      ) : null}
                      <circle
                        cx={cx}
                        cy={markY}
                        r={face ? faceR + 6 : dense ? 5 : 12}
                        fill="transparent"
                        className="cursor-pointer"
                        onPointerEnter={(e) => show(e, tipFor(i))}
                        onPointerMove={(e) => show(e, tipFor(i))}
                        onClick={() => onSelect?.(s.id)}
                      />
                      {face ? (
                        <FaceMark cx={cx} cy={markY} r={faceR} href={face} color={color} on={on} clipId={avatarClipId(s.id, i)} />
                      ) : (
                        <>
                          {yProj != null && !caughtUp ? (
                            <circle cx={cx} cy={yProj} r={ringR} fill="none" stroke={color} strokeWidth={on ? 1.8 : dense ? 1 : 1.4} className="pointer-events-none" />
                          ) : null}
                          {yLive != null ? (
                            <circle cx={cx} cy={yLive} r={fillR} fill={color} stroke="var(--background)" strokeWidth="1.25" className="pointer-events-none" />
                          ) : null}
                          {caughtUp && yProj != null ? (
                            <circle cx={cx} cy={yProj} r={fillR} fill={color} stroke="var(--background)" strokeWidth="1.25" className="pointer-events-none" />
                          ) : null}
                        </>
                      )}
                    </g>
                  )
                })}
              </g>
            )
          })}
          {!strip
            ? xLabels.map((label, i) => {
                const tickOn = rankIndex === i
                return (
                <text
                  key={`${label}-${i}`}
                  x={xAt(i, 0)}
                  y={height - 6}
                  textAnchor="middle"
                  fill={tickOn ? "var(--foreground)" : "var(--muted-foreground)"}
                  fontSize={desktop ? "10" : "11"}
                  fontWeight={tickOn ? "700" : desktop ? "normal" : "500"}
                  fontFamily="var(--font-mono-otm), ui-monospace, monospace"
                  className={onTick ? "cursor-pointer" : undefined}
                  onClick={() => onTick?.(i)}
                >
                  {label}
                </text>
                )
              })
            : null}
        </svg>
        <ChartTooltip tip={tip} />
      </div>
      {/* Strip axis labels — managers only. Player names live in the list. */}
      {strip && !playerStrip ? (
        <div className="min-w-0 border-t border-border">
          <div
            className="grid w-full max-w-full"
          style={{
            gridTemplateColumns: `${pad.left}px repeat(${Math.max(1, plotted.length)}, minmax(0, 1fr)) ${pad.right}px`,
          }}
          >
            <div />
            {plotted.map((s) => (
              <Button
                key={s.id}
                type="button"
                variant="ghost"
                size="sm"
                title={s.label}
                aria-label={s.label}
                onClick={() => onSelect?.(s.id)}
                className={`tap h-auto min-h-[56px] w-full justify-center rounded-none px-1 py-3 text-center text-[13px] font-semibold leading-tight tracking-wide sm:text-[12px] md:text-[13px] ${
                  s.id === activeId ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <span className="block max-w-full break-words hyphens-auto" lang="en">
                  {mobileLabel(s.label, s.code)}
                </span>
              </Button>
            ))}
            <div />
          </div>
        </div>
      ) : null}
      </div>
      )}
      list={
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {ranked.some((s) => s.pending) ? (
        <p className="border-b border-border px-4 py-2 text-[12px] text-muted-foreground">
          This GW FPts scored. Players who have not played yet are listed at the bottom.
        </p>
      ) : split && !gwComplete ? (
        <p className="border-b border-border px-4 py-2 text-[12px] text-muted-foreground">
          Solid is scored. Faint <span className="font-mono">+n</span> is still coming.
        </p>
      ) : null}
      {ranked.length === 0 ? (
        <p className="px-4 py-12 text-[14px] text-muted-foreground sm:px-6">No players match this filter.</p>
      ) : (
      <ol
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {ranked.map((s, rank) => {
            const on = s.id === activeId
            const color = colors.get(s.id) ?? CHART_PALETTE[0]
            const value = seriesAt(s, totals, rankIndex, "values")
            const scored = seriesAt(s, totals, rankIndex, "live")
          const playedMax = Math.max(
            1,
            ...ranked.filter((x) => !x.pending).map((x) => seriesAt(x, totals, rankIndex, "live") ?? seriesAt(x, totals, rankIndex, "values") ?? 0),
          )
          const prev = ranked[rank - 1]
          const showPendingHead = Boolean(s.pending) && !prev?.pending
          const playedRank = ranked.slice(0, rank).filter((x) => !x.pending).length
          const pendingRank = ranked.slice(0, rank).filter((x) => x.pending).length
          const mark = s.pending ? pendingRank + 1 : playedRank + 1
          return (
            <li key={s.id} data-id={s.id}>
              {showPendingHead ? (
                <p className="border-t border-border bg-muted/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:px-6">
                  Not played yet
                </p>
              ) : null}
              <div
                className={`otm-row flex w-full flex-col gap-2 px-4 py-3 text-[15px] sm:px-4 sm:text-[14px] md:px-6 ${
                  on ? "bg-muted text-foreground" : "text-foreground"
                }`}
              >
                <div className="flex w-full min-w-0 items-start gap-2.5 sm:gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onSelect?.(s.id)}
                    className="tap h-auto min-h-11 min-w-0 flex-1 shrink items-start justify-start gap-2.5 whitespace-normal rounded-none px-0 py-0 text-left font-normal sm:min-h-10 sm:gap-3"
                  >
                    <span className="w-7 shrink-0 font-mono text-[13px] text-muted-foreground sm:w-5 sm:text-[11px]">{mark}</span>
                    {s.position ? (
                      <PlayerFace src={s.photoUrl} fallback={s.crestUrl} alt="" color={color} />
                    ) : split ? (
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-sm border sm:h-2 sm:w-2"
                        style={{ borderColor: color, background: scored != null && scored > 0 ? color : "transparent" }}
                      />
                    ) : (
                      <span className="mt-1 h-3 w-3 shrink-0 rounded-sm sm:h-2 sm:w-2" style={{ background: color }} />
                    )}
                    <SeriesIdentity
                      label={s.label}
                      heat={s.heat}
                      chips={s.chips}
                      why={s.why}
                      meta={[s.position, s.owner].filter(Boolean).join(" · ") || null}
                    />
                    {s.hint === "You" ? <Badge variant="you" className="shrink-0">You</Badge> : null}
                  </Button>
                  {s.club && onFilterClub ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onFilterClub(s.club!)}
                      className="tap mt-0.5 h-auto shrink-0 px-1.5 py-1 text-[12px] font-normal text-muted-foreground"
                    >
                      {s.club}
                    </Button>
                  ) : s.club ? (
                    <span className="mt-0.5 shrink-0 text-[12px] text-muted-foreground">{s.club}</span>
                  ) : null}
                </div>
                {s.position ? (
                  <div className="pl-10 sm:pl-8">
                    <ScoreMeter
                      color={color}
                      muted={Boolean(s.pending)}
                      share={s.pending ? (value ?? 0) / playedMax : (scored ?? 0) / playedMax}
                      label={s.pending ? (value != null ? `proj ${value.toFixed(1)}` : "—") : scored != null ? scored.toFixed(1) : "—"}
                    />
                  </div>
                ) : split ? (
                  <div className="pl-10 sm:pl-8">
                    <HorizontalBar
                      scored={scored}
                      projected={value}
                      color={color}
                      maxValue={Math.max(1, ...ranked.map((x) => seriesAt(x, totals, rankIndex, "values") ?? 0))}
                      gwComplete={gwComplete}
                    />
                  </div>
                ) : (
                  <span className="pl-10 font-mono text-[14px] tabular-nums sm:pl-8 sm:text-[13px]" style={{ color: on ? color : undefined }}>
                    {value != null ? value.toFixed(1) : "—"}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      )}
      </div>
      }
    />
  )
}

export type PoolPlayer = {
  id: string
  name: string
  /** Weekly projection — the ring. */
  value: number
  /** Actually scored this week. Null until Fantrax has posted a live total. */
  scored?: number | null
  club?: string
  position?: string
  color?: string
  owner?: string
  ownerId?: string
}

export type PoolGroup = {
  id: string
  code: string
  name: string
  players: PoolPlayer[]
}

export type PoolSwatch = {
  id: string
  label: string
  color: string
  count?: number
}

/**
 * Players as a tap target in columns — managers on League and Players, filters slice the pool.
 */
export function PoolChart({
  title,
  caption,
  groups,
  unit,
  activeId,
  activePlayerId,
  query,
  positions,
  onSelect,
  onSelectPlayer,
  onFilterOwner,
  onFilterClub,
  listAll,
  keepEmpty,
  swatches,
  onSwatch,
  activeSwatch,
  action,
  gwComplete,
}: {
  title: string
  caption: string
  groups: PoolGroup[]
  unit: string
  activeId?: string | null
  activePlayerId?: string | null
  query?: string
  positions?: string[]
  onSelect?: (id: string) => void
  onSelectPlayer?: (playerId: string, teamId: string) => void
  onFilterOwner?: (id: string) => void
  onFilterClub?: (club: string) => void
  /** Rank the full visible pool, not only the highlighted column. */
  listAll?: boolean
  /** Keep columns with no players so managers can be compared even when a position is empty. */
  keepEmpty?: boolean
  swatches?: PoolSwatch[]
  onSwatch?: (id: string) => void
  activeSwatch?: string | null
  action?: React.ReactNode
  /** Whether the gameweek is complete (all managers scored, not projected) */
  gwComplete?: boolean
}): ReactElement {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const { tip, show, hide } = useSvgTip(wrapRef)
  const desktop = useDesktopPlot()
  const [isMobile, setIsMobile] = React.useState(false)
  
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  
  const width = desktop ? 1080 : 720
  const height = desktop ? 400 : 440
  const pad = { top: 16, right: 8, bottom: 12, left: 40 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const q = (query ?? "").trim().toLowerCase()
  const posSet = positions?.length ? new Set(positions) : null
  const visible = groups
    .map((g) => ({
      ...g,
      players: g.players.filter((p) => {
        if (posSet && p.position && !posSet.has(p.position)) return false
        if (!q) return true
        return `${p.name} ${p.club ?? ""} ${p.owner ?? ""} ${g.name} ${g.code}`.toLowerCase().includes(q)
      }),
    }))
    .filter((g) => keepEmpty || g.players.length > 0)
  const nums = visible.flatMap((g) =>
    g.players.flatMap((p) => [p.value, p.scored].filter((v): v is number => v != null)),
  )
  const max = Math.max(1, ...nums)
  const min = 0
  const y = (v: number) => pad.top + innerH - ((v - min) / (max - min)) * innerH
  const colW = visible.length ? innerW / visible.length : innerW
  const x = (i: number) => pad.left + colW * i + colW / 2
  const ticks = 4
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => min + ((max - min) * i) / ticks)
  const allPlayers = visible.flatMap((g) => g.players.map((p) => ({ ...p, groupId: g.id, groupName: g.name })))
  const highlighted = visible.find((g) => g.id === activeId) ?? visible[0]
  const hasLive = groups.some((g) => g.players.some((p) => p.scored != null))
  const listPlayers = (listAll ? allPlayers : highlighted?.players ?? [])
    .slice()
    .sort((a, b) => {
      const aLeft = remainingPts(a.value, a.scored)
      const bLeft = remainingPts(b.value, b.scored)
      if (hasLive) return bLeft - aLeft || (b.scored ?? 0) - (a.scored ?? 0)
      return b.value - a.value
    })
  const picked = activePlayerId ? (allPlayers.find((p) => p.id === activePlayerId) ?? null) : null
  const colorOf = (id: string) => CHART_PALETTE[groups.findIndex((g) => g.id === id) % CHART_PALETTE.length]
  const playerColor = (p: PoolPlayer, groupId: string) => p.color ?? colorOf(groupId)
  const activeColor = picked ? playerColor(picked, picked.groupId ?? highlighted?.id ?? "") : CHART_PALETTE[0]
  const pickedScored = picked?.scored ?? null
  const usePlayerColors = groups.some((g) => g.players.some((p) => p.color))
  const heading = picked?.name ?? highlighted?.name ?? title
  const canPickTeam = !picked && Boolean(onSelect) && visible.length > 1

  return (
    <SplitBoard
      caption={caption}
      header={
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:gap-4 sm:px-4 sm:py-4 md:px-6">
          <div className="min-w-0 flex-1">
            {canPickTeam ? (
              <TitleSelect
                value={highlighted?.id ?? null}
                label={heading}
                ariaLabel="Change team"
                onChange={(id) => onSelect?.(id)}
                options={visible.map((g) => ({
                  id: g.id,
                  label: g.name,
                  color: colorOf(g.id),
                }))}
              />
            ) : (
              <h3 className="otm-title text-[1.35rem] leading-tight sm:text-[1.35rem] sm:leading-snug md:text-[1.5rem]">
                <span className="block min-h-[2.7rem] whitespace-normal [overflow-wrap:break-word] [word-break:normal] line-clamp-2">{heading}</span>
              </h3>
            )}
            <p className="mt-1 whitespace-normal [overflow-wrap:break-word] [word-break:normal] line-clamp-2 text-[13px] text-muted-foreground sm:text-[13px]">
              {picked
                ? [picked.owner, picked.club, picked.position].filter(Boolean).join(" · ") || highlighted?.name
                : highlighted
                  ? `${highlighted.players.length} player${highlighted.players.length === 1 ? "" : "s"}`
                  : null}
            </p>
          </div>
          <div className="flex shrink-0 items-end gap-3 sm:gap-4">
            {picked ? (
              <FocusStats
                split={hasLive}
                color={activeColor}
                unit={unit}
                scored={pickedScored}
                projected={picked.value}
                gwComplete={gwComplete}
              />
            ) : null}
            {action}
          </div>
        </div>
      }
      chart={isMobile ? null : (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <>
      <div ref={wrapRef} className="relative min-h-0 w-full flex-1 overflow-hidden" onPointerLeave={hide}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full touch-pan-y"
          role="img"
          aria-label={title}
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth="1" strokeOpacity="0.7" />
              <text
                x={pad.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--muted-foreground)"
                fontSize={desktop ? "10" : "11"}
                fontWeight={desktop ? "normal" : "500"}
                fontFamily="var(--font-mono-otm), ui-monospace, monospace"
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}
          {visible.map((g, gi) => {
            const teamOn = g.id === highlighted?.id
            const groupColor = colorOf(g.id)
            const tint = usePlayerColors ? "var(--foreground)" : groupColor
            const laid = dodgeColumn(g.players, x(gi), colW, y, g.players.length > 22 ? 2.6 : 3.4)
            return (
              <g key={g.id}>
                <rect
                  x={pad.left + colW * gi}
                  y={pad.top}
                  width={colW}
                  height={innerH}
                  fill={teamOn ? tint : "transparent"}
                  fillOpacity={teamOn ? 0.08 : 0}
                  className="cursor-pointer"
                  onClick={() => onSelect?.(g.id)}
                />
                {gi > 0 ? (
                  <line
                    x1={pad.left + colW * gi}
                    x2={pad.left + colW * gi}
                    y1={pad.top}
                    y2={pad.top + innerH}
                    stroke="var(--line)"
                    strokeWidth="1"
                  />
                ) : null}
                {laid.map((p) => {
                  const on = p.id === activePlayerId
                  const color = playerColor(p, g.id)
                  const scored = p.scored ?? null
                  const caughtUp = scored != null && Math.abs(p.value - scored) < 0.4
                  const yProj = p.cy
                  const yLive = scored != null && scored > 0 ? y(scored) : null
                  const fade =
                    (on || !activePlayerId ? 1 : teamOn || listAll ? 0.72 : 0.4) * (caughtUp && !on ? 0.32 : 1)
                  const left = remainingPts(p.value, scored)
                  const parts = [
                    scored != null ? `${scored.toFixed(1)} scored` : "— scored",
                    left >= 0.05 ? `${left.toFixed(1)} left` : "done",
                    p.owner,
                    p.club,
                    p.position,
                  ].filter(Boolean)
                  const body = parts.join(" · ")
                  const hit = (cy: number) => (
                    <circle
                      cx={p.cx}
                      cy={cy}
                      r="9"
                      fill="transparent"
                      className="cursor-pointer"
                      onPointerEnter={(e) => {
                        e.stopPropagation()
                        show(e, { title: p.name, body, color })
                      }}
                      onPointerMove={(e) => {
                        e.stopPropagation()
                        show(e, { title: p.name, body, color })
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectPlayer?.(p.id, p.ownerId ?? g.id)
                      }}
                    />
                  )
                  return (
                    <g key={p.id} opacity={fade}>
                      {yLive != null && !caughtUp ? (
                        <line
                          x1={p.cx}
                          x2={p.cx}
                          y1={yLive}
                          y2={yProj}
                          stroke={color}
                          strokeWidth={on ? 1.6 : 1.1}
                          strokeOpacity={0.9}
                          className="pointer-events-none"
                        />
                      ) : null}
                      {hit(yProj)}
                      {yLive != null ? hit(yLive) : null}
                      {!caughtUp ? (
                        <circle
                          cx={p.cx}
                          cy={yProj}
                          r={on ? 7 : 5.5}
                          fill="none"
                          stroke={color}
                          strokeWidth={on ? 1.7 : 1.3}
                          className="pointer-events-none"
                        />
                      ) : null}
                      {yLive != null ? (
                        <circle cx={p.cx} cy={yLive} r={on ? 5.5 : 4} fill={color} className="pointer-events-none" />
                      ) : null}
                      {caughtUp ? (
                        <circle cx={p.cx} cy={yProj} r={on ? 6 : 4.5} fill={color} className="pointer-events-none" />
                      ) : null}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
        <ChartTooltip tip={tip} />
      </div>
      <div className="min-w-0 border-t border-border">
        <div
          className="grid w-full max-w-full"
          style={{
            gridTemplateColumns: `${pad.left}px repeat(${Math.max(1, visible.length)}, minmax(0, 1fr)) ${pad.right}px`,
          }}
        >
          <div />
          {visible.map((g, gi) => {
            const on = g.id === highlighted?.id
            return (
              <Button
                key={g.id}
                type="button"
                variant="ghost"
                aria-pressed={on}
                title={`${g.code} · ${g.name}`}
                onClick={() => onSelect?.(g.id)}
                className={`tap h-14 min-w-0 flex-col gap-0.5 rounded-none px-0.5 sm:h-12 sm:px-1 ${
                  gi > 0 ? "border-l border-border" : ""
                } ${on ? "bg-background font-semibold text-foreground" : "text-muted-foreground"}`}
              >
                <span className="max-w-full truncate px-0.5 text-[12px] font-medium tracking-wide sm:text-[12px]">{g.code}</span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground sm:text-[10px]">{g.players.length}</span>
              </Button>
            )
          })}
          <div />
        </div>
      </div>
      {swatches || !listAll ? (
      <div className="border-t border-border px-3 py-2.5 md:hidden sm:px-4">
        <p className="otm-kicker">
          {swatches ? "Filter by manager" : "Jump to a team"}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {(swatches ?? groups).map((g) => {
            const id = g.id
            const label = "label" in g ? g.label : g.name
            const color = "color" in g && g.color ? g.color : colorOf(id)
            const count = "count" in g ? g.count : visible.find((v) => v.id === id)?.players.length
            const on = swatches ? id === (activeSwatch ?? null) : id === highlighted?.id
            return (
              <Button
                key={id}
                type="button"
                variant={on ? "default" : "outline"}
                size="sm"
                aria-pressed={on}
                onClick={() => (swatches ? onSwatch?.(id) : onSelect?.(id))}
                className="tap h-11 gap-2 px-3 text-[14px] sm:h-9 sm:gap-1.5 sm:px-2.5 sm:text-[13px]"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm sm:h-2 sm:w-2" style={{ background: color }} />
                <span className="truncate">{label}</span>
                {count != null ? <span className="font-mono text-[12px] opacity-70 sm:text-[11px]">{count}</span> : null}
              </Button>
            )
          })}
        </div>
      </div>
      ) : null}
      </>
      </div>
      )}
      list={
      <div className="flex min-h-0 flex-1 flex-col">
      {!gwComplete ? (
        <p className="border-b border-border px-4 py-2 text-[12px] text-muted-foreground">
          Solid is scored. Faint <span className="font-mono">+n</span> is still coming.
        </p>
      ) : null}
      <div className="flex items-baseline gap-3 border-b border-border px-4 py-2.5 otm-kicker sm:py-2">
        <span className="w-6 sm:w-5">#</span>
        <span className="min-w-0 flex-1">Player</span>
        {onFilterOwner ? <span className="hidden max-w-[28%] sm:block">Manager</span> : null}
        {onFilterClub ? <span className="hidden shrink-0 sm:block">Club</span> : null}
      </div>
      <ol className="min-h-0 flex-1 md:max-h-none md:overflow-auto">
        {listPlayers.map((p, rank) => {
          const on = p.id === activePlayerId
          const listed = p as PoolPlayer & { groupId?: string }
          const groupId = listed.groupId ?? highlighted?.id ?? ""
          const color = playerColor(p, groupId)
          const scored = p.scored ?? null
          const maxInList = Math.max(...listPlayers.map(x => x.value))
          return (
            <li key={p.id}>
              <div
                className={`flex w-full flex-col gap-2 px-4 py-3 text-[15px] transition-colors hover:bg-accent/70 sm:px-4 sm:text-[14px] md:px-6 md:text-[15px] ${
                  on ? "bg-muted text-foreground" : "text-foreground"
                }`}
              >
                <div className="flex w-full items-center gap-2.5 sm:gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onSelectPlayer?.(p.id, p.ownerId ?? groupId)}
                    className="tap h-auto min-h-11 min-w-0 flex-1 justify-start gap-2.5 rounded-none px-0 py-0 text-left font-normal sm:min-h-10 sm:gap-3 md:text-[15px]"
                  >
                    <span className="w-7 font-mono text-[13px] text-muted-foreground sm:w-5 sm:text-[11px]">{rank + 1}</span>
                    <span
                      className="h-3 w-3 shrink-0 border sm:h-2 sm:w-2"
                      style={{ borderColor: color, background: scored != null && scored > 0 ? color : "transparent" }}
                    />
                    <span className="min-w-0 flex-1 whitespace-normal break-words line-clamp-2 text-left" title={p.name}>{p.name}</span>
                  </Button>
                  {p.owner && p.ownerId && onFilterOwner ? (
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => onFilterOwner(p.ownerId!)}
                      className="tap hidden h-auto min-h-11 max-w-[28%] min-w-0 whitespace-normal break-words px-2 py-2.5 text-left text-[14px] font-normal text-muted-foreground sm:inline-flex sm:min-h-10 sm:px-1.5 sm:py-2 sm:text-[12px] line-clamp-2"
                      title={p.owner}
                    >
                      {p.owner}
                    </Button>
                  ) : null}
                  {p.club && onFilterClub ? (
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => onFilterClub(p.club!)}
                      className="tap hidden h-auto min-h-11 shrink-0 px-2.5 py-2.5 text-[14px] font-normal text-muted-foreground sm:inline-flex sm:min-h-10 sm:px-1.5 sm:py-2 sm:text-[12px]"
                    >
                      {p.club}
                    </Button>
                  ) : p.club || p.position ? (
                    <span className="hidden text-[13px] text-muted-foreground sm:inline sm:text-[12px]">
                      {[p.club, p.position].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </div>
                <div className="pl-10 sm:pl-8">
                  <HorizontalBar
                    scored={scored}
                    projected={p.value}
                    color={color}
                    maxValue={maxInList}
                    gwComplete={gwComplete}
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      </div>
      }
    />
  )
}
