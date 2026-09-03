// Description: Product wordmark — words only, no moon glyph.
import type { ReactElement } from "react"
import { cn } from "@/lib/utils"

/** Kit-letter wordmark. Header and footer share this. */
export function BrandLockup({
  className,
  wordmarkClassName,
}: {
  className?: string
  wordmarkClassName?: string
  showWordmark?: boolean
}): ReactElement {
  return (
    <span
      className={cn(
        "otm-title text-[15px] tracking-[0.14em] text-foreground sm:text-[16px]",
        className,
        wordmarkClassName,
      )}
    >
      OTM FPL
    </span>
  )
}
