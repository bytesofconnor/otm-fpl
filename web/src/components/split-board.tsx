// Description: Form board split — chart and list, draggable on large screens, remembered.
"use client"

import * as React from "react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

const STORAGE_KEY = "otm_form_list_pct"
const DEFAULT_PCT = 32
const MIN_PCT = 18
const MAX_PCT = 54

function clamp(value: number): number {
  return Math.min(MAX_PCT, Math.max(MIN_PCT, value))
}

/**
 * Header + optional toolbar on top. Below: plot and ranked list.
 * From md up, drag the gutter to grow or shrink the list. Double-click resets.
 */
export function SplitBoard({
  header,
  toolbar,
  chart,
  list,
  caption,
  className,
}: {
  header: ReactNode
  toolbar?: ReactNode
  chart: ReactNode
  list: ReactNode
  caption?: string
  className?: string
}): React.ReactElement {
  const boardRef = React.useRef<HTMLDivElement>(null)
  const dragging = React.useRef(false)
  const pctRef = React.useRef(DEFAULT_PCT)
  const [pct, setPct] = React.useState(DEFAULT_PCT)
  const [hot, setHot] = React.useState(false)

  React.useEffect(() => {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY))
    if (Number.isFinite(stored) && stored >= MIN_PCT && stored <= MAX_PCT) {
      pctRef.current = stored
      setPct(stored)
    }
  }, [])

  const apply = React.useCallback((next: number) => {
    const clamped = clamp(next)
    pctRef.current = clamped
    setPct(clamped)
  }, [])

  React.useEffect(() => {
    function fromPointer(event: PointerEvent) {
      if (!dragging.current || !boardRef.current) return
      const box = boardRef.current.getBoundingClientRect()
      if (box.width < 8) return
      apply(((box.right - event.clientX) / box.width) * 100)
    }
    function onUp() {
      if (!dragging.current) return
      dragging.current = false
      setHot(false)
      document.body.classList.remove("otm-resizing")
      window.localStorage.setItem(STORAGE_KEY, String(pctRef.current))
    }
    window.addEventListener("pointermove", fromPointer)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", fromPointer)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [apply])

  function startDrag(event: React.PointerEvent) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragging.current = true
    setHot(true)
    document.body.classList.add("otm-resizing")
  }

  function reset() {
    apply(DEFAULT_PCT)
    window.localStorage.setItem(STORAGE_KEY, String(DEFAULT_PCT))
  }

  function onHandleKey(event: React.KeyboardEvent) {
    const step = event.shiftKey ? 4 : 1.5
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      apply(pctRef.current + step)
      window.localStorage.setItem(STORAGE_KEY, String(pctRef.current))
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      apply(pctRef.current - step)
      window.localStorage.setItem(STORAGE_KEY, String(pctRef.current))
    } else if (event.key === "Home") {
      event.preventDefault()
      apply(MAX_PCT)
      window.localStorage.setItem(STORAGE_KEY, String(pctRef.current))
    } else if (event.key === "End") {
      event.preventDefault()
      apply(MIN_PCT)
      window.localStorage.setItem(STORAGE_KEY, String(pctRef.current))
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      reset()
    }
  }

  return (
    <Card
      size="flush"
      className={cn(
        "md:h-[calc(100dvh-var(--header-h)-env(safe-area-inset-top)-7.25rem)]",
        className,
      )}
    >
      <div className="shrink-0">{header}</div>
      {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
      <div ref={boardRef} className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-[220px] min-w-0 flex-1 flex-col sm:min-h-[260px] md:min-h-0">{chart}</div>
        {/* eslint-disable jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
        <div
          data-otm-split
          tabIndex={0}
          aria-orientation="vertical"
          aria-valuemin={MIN_PCT}
          aria-valuemax={MAX_PCT}
          aria-valuenow={Math.round(pct)}
          aria-label="Resize the list. Arrow keys nudge. Enter resets."
          title="Drag to pull the list in or out. Double-click or Enter to reset."
          onPointerDown={startDrag}
          onDoubleClick={reset}
          onKeyDown={onHandleKey}
          className={cn(
            "group/handle relative hidden w-3 shrink-0 cursor-col-resize touch-none items-stretch justify-center md:flex",
            "before:absolute before:inset-y-0 before:-left-2 before:-right-2 before:content-['']",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            hot ? "bg-muted" : "hover:bg-muted/80",
          )}
        >
          <span
            className={cn(
              "m-auto flex h-11 w-1.5 flex-col items-center justify-center gap-[3px] rounded-full bg-border transition-colors",
              "group-hover/handle:bg-foreground/25 group-focus-visible/handle:bg-foreground/30",
              hot && "bg-foreground/40",
            )}
            aria-hidden="true"
          >
            <span className="h-[3px] w-[3px] rounded-full bg-foreground/55" />
            <span className="h-[3px] w-[3px] rounded-full bg-foreground/55" />
            <span className="h-[3px] w-[3px] rounded-full bg-foreground/55" />
          </span>
        </div>
        {/* eslint-enable jsx-a11y/no-static-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
        <div
          className={cn(
            "otm-split-list flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-border",
            !hot && "md:transition-[flex-basis] md:duration-150 md:ease-out",
          )}
          style={{ ["--otm-list-pct" as string]: `${pct}%` }}
        >
          {list}
        </div>
      </div>
      {caption ? <p className="sr-only">{caption}</p> : null}
    </Card>
  )
}
