// Description: Over-the-Moon wait state — one spinning football. Not grey boxes.
"use client"

import type { ReactElement } from "react"
import { cn } from "@/lib/utils"

/**
 * Full-page / board wait. Use instead of two skeleton slabs.
 */
export function OtmLoader({
  label = "Loading",
  hint,
  className,
}: {
  label?: string
  hint?: string
  className?: string
}): ReactElement {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex min-h-[22rem] flex-col items-center justify-center gap-5 px-4 py-10", className)}
    >
      <span className="otm-loader-emoji" aria-hidden>
        ⚽
      </span>
      <div className="text-center">
        <p className="otm-kicker text-foreground/85">{label}</p>
        {hint ? <p className="mt-1.5 text-[13px] text-muted-foreground">{hint}</p> : null}
      </div>
      <span className="sr-only">{hint ? `${label}. ${hint}` : label}</span>
    </div>
  )
}
