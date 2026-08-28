// Description: Over the Moon mark — a thick waxing crescent, kit-letter wordmark.
import type { ReactElement } from "react"
import { cn } from "@/lib/utils"

/**
 * Heavy crescent. Reads as a moon at 22px, not a thin ring.
 */
export function MoonMark({ className }: { className?: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-6 shrink-0 text-foreground", className)}
      aria-hidden
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12 1.6A10.4 10.4 0 1 0 12 22.4 10.4 10.4 0 1 0 12 1.6Zm5.55 3.15A8.4 8.4 0 1 1 17.55 19.25 9.2 9.2 0 1 0 17.55 4.75Z"
      />
    </svg>
  )
}

/** Crescent + wordmark. Same lockup in the header and footer. */
export function BrandLockup({
  className,
  wordmarkClassName,
  showWordmark = true,
}: {
  className?: string
  wordmarkClassName?: string
  showWordmark?: boolean
}): ReactElement {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <MoonMark />
      {showWordmark ? (
        <span
          className={cn(
            "text-[13px] font-bold uppercase tracking-[0.12em] text-foreground",
            wordmarkClassName,
          )}
        >
          Over the Moon
        </span>
      ) : null}
    </span>
  )
}
