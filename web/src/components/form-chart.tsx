// Description: Interactive Form charts — clickable dots, live tooltips, ranked lists, keyboard-friendly.
"use client"

import * as React from "react"
import type { ReactElement } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { remainingPts } from "@/lib/fantrax-shared"
import { SplitBoard } from "@/components/split-board"

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
}

/** Distinct, high-contrast series colors — sportsboard, not pastel. */
export const CHART_PALETTE = [
  "#e8f0e4",
  "#3dcf7a",
  "#e11d48",
  "#5b8def",
  "#ea580c",
  "#c084fc",
  "#f0c14b",
  "#22d3ee",
  "#db2777",
  "#86efac",
  "#fb923c",
  "#93c5fd",
  "#fde68a",
  "#94a3b8",
]

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

function FocusStats({
  scored,
  projected,
  unit,
  color,
  split,
}: {
  scored: number | null
  projected: number | null
  unit: string
  color: string
  split: boolean
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

function lastValue(values: Array<number | null>): number | null {
  return values.filter((v): v is number => v != null).slice(-1)[0] ?? null
}

function formatTick(tick: number): string {
  if (tick === 0 || tick >= 10) return tick.toFixed(0)
  return tick.toFixed(1)
}

/** Last name, owner handle, or team code so the plot axis stays readable. */
function shortLabel(label: string, code?: string): string {
  if (code && code.length <= 14) return code
  const parts = label.replace(/['’]/g, "").trim().split(/\s+/)
  if (parts.length >= 2) return parts[parts.length - 1].slice(0, 9)
  return label.slice(0, 8)
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
  toolbar,
  onTick,
  action,
  onFilterOwner,
  onFilterClub,
  headline,
  rankByRemaining,
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
  toolbar?: React.ReactNode
  /** Click a week label (season view) to isolate that GW. */
  onTick?: (index: number) => void
  action?: React.ReactNode
  onFilterOwner?: (id: string) => void
  onFilterClub?: (club: string) => void
  headline?: string
  /** Rank the list by remaining projection, not by scored/projected total. */
  rankByRemaining?: boolean
}): ReactElement {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLOListElement>(null)
  const { tip, show, hide } = useSvgTip(wrapRef)
  const desktop = useDesktopPlot()
  const width = desktop ? 1080 : 720
  const height = desktop ? 380 : 500
  const pad = { top: 12, right: 12, bottom: 10, left: 36 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const nums = series.flatMap((s) => [
    ...s.values.filter((v): v is number => v != null),
    ...(s.live ?? []).filter((v): v is number => v != null),
  ])
  const max = Math.max(1, ...nums)
  const min = 0
  const strip = xLabels.length <= 1 && series.length > 1
  const split = series.some((s) => s.live !== undefined)
  const ranked = [...series].sort((a, b) => {
    const aLive = lastValue(a.live ?? [])
    const bLive = lastValue(b.live ?? [])
    const aVal = lastValue(a.values)
    const bVal = lastValue(b.values)
    if (rankByRemaining && split) {
      return remainingPts(bVal, bLive) - remainingPts(aVal, aLive) || (bLive ?? -1) - (aLive ?? -1)
    }
    if (split) return (bLive ?? bVal ?? -1) - (aLive ?? aVal ?? -1)
    return (bVal ?? -1) - (aVal ?? -1)
  })
  const plotted = (() => {
    if (!plotLimit || ranked.length <= plotLimit) return ranked
    const head = ranked.slice(0, plotLimit)
    if (activeId && !head.some((s) => s.id === activeId)) {
      const extra = ranked.find((s) => s.id === activeId)
      if (extra) return [...head.slice(0, plotLimit - 1), extra]
    }
    return head
  })()
  const dense = strip && plotted.length > 18
  React.useEffect(() => {
    const list = listRef.current
    if (!list || !activeId) return
    const row = list.querySelector<HTMLElement>(`[data-id="${CSS.escape(activeId)}"]`)
    if (!row) return
    const listBox = list.getBoundingClientRect()
    const rowBox = row.getBoundingClientRect()
    if (rowBox.top < listBox.top || rowBox.bottom > listBox.bottom) {
      list.scrollTop += rowBox.top - listBox.top - listBox.height / 2 + rowBox.height / 2
    }
  }, [activeId])
  const xAt = (pointIndex: number, seriesIndex: number) => {
    if (strip) return pad.left + ((seriesIndex + 0.5) / plotted.length) * innerW
    if (xLabels.length <= 1) return pad.left + innerW / 2
    return pad.left + (pointIndex / (xLabels.length - 1)) * innerW
  }
  const y = (v: number) => pad.top + innerH - ((v - min) / (max - min)) * innerH
  const colors = new Map(series.map((s, i) => [s.id, s.color ?? CHART_PALETTE[i % CHART_PALETTE.length]]))
  const focused = activeId ? series.find((s) => s.id === activeId) ?? null : null
  const activeColor = focused ? colors.get(focused.id) ?? CHART_PALETTE[0] : CHART_PALETTE[0]

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
      caption={caption}
      header={
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:gap-4 sm:px-4 sm:py-4 md:px-6">
          <div className="min-w-0 flex-1">
            {onBack ? (
              <Button type="button" variant="ghost" size="sm" className="tap -ml-2 h-auto px-2 py-1 text-[13px] sm:text-[14px]" onClick={onBack}>
                {backLabel ?? "All managers"}
              </Button>
            ) : null}
            <h3 className={`otm-title text-[1.35rem] leading-tight sm:text-[1.35rem] sm:leading-snug md:text-[1.5rem] ${onBack ? "mt-0.5" : ""}`}>
              <span className="line-clamp-2 break-words">{focused?.label ?? headline ?? title}</span>
            </h3>
            {focused?.hint && focused.hint !== "You" ? (
              <p className="mt-1 line-clamp-1 break-words text-[13px] text-muted-foreground sm:truncate sm:text-[13px]">{focused.hint}</p>
            ) : focused?.hint === "You" ? (
              <p className="mt-1 text-[13px] text-muted-foreground sm:text-[13px]">Your team</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-end gap-3 sm:gap-4">
            {focused ? (
              <FocusStats
                split={Boolean(split)}
                color={activeColor}
                unit={unit}
                scored={lastValue(focused.live ?? [])}
                projected={lastValue(focused.values)}
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
      chart={
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={wrapRef} className="relative min-h-[260px] flex-1 overflow-visible md:min-h-0" onPointerLeave={hide}>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full touch-pan-y md:absolute md:inset-0 md:h-full" role="img" aria-label={title}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth="1" strokeOpacity="0.7" />
              <text
                x={pad.left - 6}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--muted-foreground)"
                fontSize="10"
                fontFamily="var(--font-mono-otm), ui-monospace, monospace"
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}
          {plotted.map((s, si) => {
            const on = s.id === activeId
            const color = colors.get(s.id) ?? CHART_PALETTE[0]
            const drawLine = !strip && !split && s.values.filter((v) => v != null).length > 1
            const drawLiveLine = !strip && split && (s.live ?? []).filter((v) => v != null && v > 0).length > 1
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
              <g key={s.id} opacity={on || !activeId ? 1 : dense ? 0.62 : 0.78}>
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
                    strokeWidth={on ? 2.6 : 1.4}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ) : null}
                {s.values.map((value, i) => {
                  if (value == null && (s.live?.[i] ?? null) == null) return null
                  const cx = xAt(i, si)
                  if (!split) {
                    return (
                      <g key={`${s.id}-${i}`}>
                        <circle
                          cx={cx}
                          cy={y(value ?? 0)}
                          r="10"
                          fill="transparent"
                          className="cursor-pointer"
                          onPointerEnter={(e) => show(e, tipFor(i))}
                          onPointerMove={(e) => show(e, tipFor(i))}
                          onClick={() => onSelect?.(s.id)}
                        />
                        <circle cx={cx} cy={y(value ?? 0)} r={on ? 7 : 5} fill={color} className="pointer-events-none" />
                      </g>
                    )
                  }
                  const scored = s.live?.[i] ?? null
                  const proj = value
                  const caughtUp = scored != null && proj != null && Math.abs(proj - scored) < 0.4
                  const yProj = proj != null ? y(proj) : null
                  const yLive = scored != null && scored > 0 ? y(scored) : null
                  const ringR = on ? (dense ? 6 : 8) : dense ? 4 : 6.5
                  const fillR = on ? (dense ? 4 : 6) : dense ? 2.8 : 4.5
                  return (
                    <g key={`${s.id}-${i}`} opacity={caughtUp && !on ? 0.3 : 1}>
                      {yLive != null && yProj != null && !caughtUp ? (
                        <line x1={cx} x2={cx} y1={yLive} y2={yProj} stroke={color} strokeWidth={on ? 2.4 : dense ? 1.4 : 1.8} strokeOpacity={0.9} />
                      ) : null}
                      <circle
                        cx={cx}
                        cy={yProj ?? yLive ?? 0}
                        r={dense ? 5 : 12}
                        fill="transparent"
                        className="cursor-pointer"
                        onPointerEnter={(e) => show(e, tipFor(i))}
                        onPointerMove={(e) => show(e, tipFor(i))}
                        onClick={() => onSelect?.(s.id)}
                      />
                      {yProj != null && !caughtUp ? (
                        <circle cx={cx} cy={yProj} r={ringR} fill="none" stroke={color} strokeWidth={on ? 1.8 : dense ? 1 : 1.4} className="pointer-events-none" />
                      ) : null}
                      {yLive != null ? (
                        <circle cx={cx} cy={yLive} r={fillR} fill={color} className="pointer-events-none" />
                      ) : null}
                      {caughtUp && yProj != null ? (
                        <circle cx={cx} cy={yProj} r={fillR} fill={color} className="pointer-events-none" />
                      ) : null}
                    </g>
                  )
                })}
              </g>
            )
          })}
          {!strip
            ? xLabels.map((label, i) => (
                <text
                  key={`${label}-${i}`}
                  x={xAt(i, 0)}
                  y={height - 8}
                  textAnchor="middle"
                  fill="var(--muted-foreground)"
                  fontSize="10"
                  fontFamily="var(--font-mono-otm), ui-monospace, monospace"
                  className={onTick ? "cursor-pointer" : undefined}
                  onClick={() => onTick?.(i)}
                >
                  {label}
                </text>
              ))
            : null}
        </svg>
        <ChartTooltip tip={tip} />
      </div>
      {strip ? (
        <div
          className="grid border-t border-border"
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
              onClick={() => onSelect?.(s.id)}
              className={`tap h-auto min-h-[48px] min-w-0 justify-center rounded-none px-0.5 py-2.5 text-center text-[10px] font-medium leading-tight tracking-wide sm:text-[10px] md:text-[11px] ${
                s.id === activeId ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <span className="block max-w-full break-words hyphens-auto" lang="en">{s.code ?? shortLabel(s.label)}</span>
            </Button>
          ))}
          <div />
        </div>
      ) : null}
      </div>
      }
      list={
      <div className="flex min-h-0 flex-1 flex-col">
      {split ? (
        <div className="flex justify-end gap-3 border-b border-border px-4 py-2.5 otm-kicker sm:py-2">
          <span className="w-16 text-right sm:w-14">Scored</span>
          <span className="w-16 text-right sm:w-14">Left</span>
        </div>
      ) : null}
      <ol
        ref={listRef}
        className="min-h-0 max-h-64 flex-1 overflow-auto md:max-h-none"
      >
        {ranked.map((s, rank) => {
          const on = s.id === activeId
          const color = colors.get(s.id) ?? CHART_PALETTE[0]
          const value = lastValue(s.values)
          const scored = lastValue(s.live ?? [])
          return (
            <li key={s.id} data-id={s.id}>
              <div
                className={`otm-row flex w-full items-center gap-2.5 px-4 py-2 text-[15px] sm:gap-3 sm:px-4 sm:text-[14px] md:px-6 ${
                  on ? "bg-muted text-foreground" : "text-foreground"
                }`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onSelect?.(s.id)}
                  className="tap h-auto min-h-0 min-w-0 flex-1 justify-start gap-2.5 rounded-none px-0 py-2 text-left font-normal sm:gap-3"
                >
                  <span className="w-6 font-mono text-[12px] text-muted-foreground sm:w-5 sm:text-[11px]">{rank + 1}</span>
                  {split ? (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm border sm:h-2 sm:w-2"
                      style={{ borderColor: color, background: scored != null && scored > 0 ? color : "transparent" }}
                    />
                  ) : (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm sm:h-2 sm:w-2" style={{ background: color }} />
                  )}
                  <span className="min-w-0 flex-1 break-words line-clamp-2" title={s.label}>{s.label}</span>
                  {s.hint === "You" ? <Badge variant="you" className="hidden sm:inline-flex">You</Badge> : null}
                </Button>
                {s.owner && s.ownerId && onFilterOwner ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onFilterOwner(s.ownerId!)}
                    className="tap hidden h-auto min-h-0 max-w-[28%] min-w-0 truncate px-0 py-0 text-left text-[13px] font-normal text-muted-foreground sm:inline-flex sm:text-[12px]"
                    title={s.owner}
                  >
                    {s.owner}
                  </Button>
                ) : s.hint && s.hint !== "You" ? (
                  <span className="hidden min-w-0 max-w-[45%] truncate text-[13px] text-muted-foreground sm:inline sm:text-[12px]" title={s.hint}>{s.hint}</span>
                ) : null}
                {s.club && onFilterClub ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onFilterClub(s.club!)}
                    className="tap hidden h-auto min-h-0 shrink-0 px-0 py-0 text-[13px] font-normal text-muted-foreground sm:inline-flex sm:text-[12px]"
                  >
                    {s.club}
                  </Button>
                ) : null}
                {split ? (
                  <span className="flex items-baseline gap-2.5 font-mono tabular-nums sm:gap-3">
                    <span className="w-14 text-right text-[14px] sm:w-14 sm:text-[13px]" style={{ color: on ? color : undefined }}>
                      {scored != null ? scored.toFixed(1) : "—"}
                    </span>
                    <span className="w-14 text-right text-[14px] text-foreground/50 sm:w-14 sm:text-[13px]">
                      {remainingPts(value, scored) >= 0.05 ? remainingPts(value, scored).toFixed(1) : "—"}
                    </span>
                  </span>
                ) : (
                  <span className="font-mono text-[14px] tabular-nums sm:text-[13px]" style={{ color: on ? color : undefined }}>
                    {value != null ? value.toFixed(1) : "—"}
                  </span>
                )}
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
}): ReactElement {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const { tip, show, hide } = useSvgTip(wrapRef)
  const desktop = useDesktopPlot()
  const width = desktop ? 1080 : 720
  const height = desktop ? 400 : 520
  const pad = { top: 12, right: 8, bottom: 8, left: 36 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const q = (query ?? "").trim().toLowerCase()
  const posSet = positions?.length ? new Set(positions) : null
  const visible = groups
    .map((g) => ({
      ...g,
      players: g.players.filter((p) => {
        if (posSet && p.position && !posSet.has(p.position[0] ?? "")) return false
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

  return (
    <SplitBoard
      caption={caption}
      header={
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:gap-4 sm:px-4 sm:py-4 md:px-6">
          <div className="min-w-0 flex-1">
            <h3 className="otm-title text-[1.35rem] leading-tight sm:text-[1.35rem] sm:leading-snug md:text-[1.5rem]">
              <span className="line-clamp-2 break-words">{picked?.name ?? highlighted?.name ?? title}</span>
            </h3>
            <p className="mt-1 line-clamp-1 break-words text-[13px] text-muted-foreground sm:truncate sm:text-[13px]">
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
              />
            ) : null}
            {action}
          </div>
        </div>
      }
      chart={
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={wrapRef} className="relative min-h-[260px] flex-1 overflow-visible md:min-h-0" onPointerLeave={hide}>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full touch-pan-y md:absolute md:inset-0 md:h-full" role="img" aria-label={title}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth="1" strokeOpacity="0.7" />
              <text
                x={pad.left - 6}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--muted-foreground)"
                fontSize="10"
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
      <div
        className="grid border-t border-border"
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
              className={`h-10 min-w-0 flex-col gap-0.5 rounded-none px-0.5 ${
                gi > 0 ? "border-l border-border" : ""
              } ${on ? "bg-background font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              <span className="max-w-full truncate px-0.5 text-[10px] font-medium tracking-wide sm:text-[11px]">{g.code}</span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{g.players.length}</span>
            </Button>
          )
        })}
        <div />
      </div>
      {swatches || !listAll ? (
      <div className="border-t border-border px-3 py-2 lg:hidden sm:px-4">
        <p className="otm-kicker">
          {swatches ? "Filter by manager" : "Jump to a team"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
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
              >
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} />
                <span className="truncate">{label}</span>
                {count != null ? <span className="font-mono text-[11px] opacity-70">{count}</span> : null}
              </Button>
            )
          })}
        </div>
      </div>
      ) : null}
      </div>
      }
      list={
      <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-baseline gap-3 border-b border-border px-4 py-2.5 otm-kicker sm:py-2">
        <span className="w-6 sm:w-5">#</span>
        <span className="min-w-0 flex-1">Player</span>
        {onFilterOwner ? <span className="hidden max-w-[28%] sm:block">Manager</span> : null}
        {onFilterClub ? <span className="hidden shrink-0 sm:block">Club</span> : null}
        <span className="w-16 text-right sm:w-14">Scored</span>
        <span className="w-16 text-right sm:w-14">Left</span>
      </div>
      <ol className="min-h-0 max-h-64 flex-1 overflow-auto md:max-h-none">
        {listPlayers.map((p, rank) => {
          const on = p.id === activePlayerId
          const listed = p as PoolPlayer & { groupId?: string }
          const groupId = listed.groupId ?? highlighted?.id ?? ""
          const color = playerColor(p, groupId)
          const scored = p.scored ?? null
          return (
            <li key={p.id}>
              <div
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-[15px] transition-colors hover:bg-accent/70 sm:gap-3 sm:px-4 sm:text-[14px] md:px-6 md:text-[15px] ${
                  on ? "bg-muted text-foreground" : "text-foreground"
                }`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onSelectPlayer?.(p.id, p.ownerId ?? groupId)}
                  className="tap h-auto min-h-0 min-w-0 flex-1 justify-start gap-2.5 rounded-none px-0 py-2 text-left font-normal sm:gap-3 md:text-[15px]"
                >
                  <span className="w-6 font-mono text-[12px] text-muted-foreground sm:w-5 sm:text-[11px]">{rank + 1}</span>
                  <span
                    className="h-2.5 w-2.5 shrink-0 border sm:h-2 sm:w-2"
                    style={{ borderColor: color, background: scored != null && scored > 0 ? color : "transparent" }}
                  />
                  <span className="min-w-0 flex-1 break-words line-clamp-2" title={p.name}>{p.name}</span>
                </Button>
                {p.owner && p.ownerId && onFilterOwner ? (
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => onFilterOwner(p.ownerId!)}
                    className="tap hidden h-auto min-h-0 max-w-[28%] min-w-0 truncate px-0 py-0 text-left text-[13px] font-normal text-muted-foreground sm:inline-flex sm:text-[12px]"
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
                    className="tap hidden h-auto min-h-0 shrink-0 px-0 py-0 text-[13px] font-normal text-muted-foreground sm:inline-flex sm:text-[12px]"
                  >
                    {p.club}
                  </Button>
                ) : p.club || p.position ? (
                  <span className="hidden text-[13px] text-muted-foreground sm:inline sm:text-[12px]">
                    {[p.club, p.position].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
                <span className="flex items-baseline gap-2.5 font-mono tabular-nums sm:gap-3">
                  <span className="w-14 text-right text-[14px] sm:w-14 sm:text-[13px]" style={{ color: on ? color : undefined }}>
                    {scored != null ? scored.toFixed(1) : "—"}
                  </span>
                  <span className="w-14 text-right text-[14px] text-foreground/50 sm:w-14 sm:text-[13px]">
                    {remainingPts(p.value, scored) >= 0.05 ? remainingPts(p.value, scored).toFixed(1) : "—"}
                  </span>
                </span>
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
