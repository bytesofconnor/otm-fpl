// Description: Shared page width and padding so League, Form, and legal pages sit on one grid.
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export const pageWidth = "mx-auto max-w-[96rem] px-4 sm:px-8"

export function PageShell({
  children,
  width = "wide",
  className,
}: {
  children: ReactNode
  width?: "wide" | "article"
  className?: string
}): React.ReactElement {
  return (
    <div
      className={cn(
        "mx-auto px-4 py-5 sm:px-8 sm:py-8",
        width === "wide" ? "max-w-[96rem]" : "max-w-[42rem]",
        className,
      )}
    >
      {children}
    </div>
  )
}
