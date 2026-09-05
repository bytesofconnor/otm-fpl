// Description: Shared page width and padding so League, Form, and legal pages sit on one grid.
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export const pageWidth = "mx-auto max-w-[96rem] px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))] md:px-[max(2rem,env(safe-area-inset-left))] md:pr-[max(2rem,env(safe-area-inset-right))]"

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
        "mx-auto px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))] sm:py-5 sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-[max(2rem,env(safe-area-inset-left))] md:pr-[max(2rem,env(safe-area-inset-right))] md:py-8 md:pb-[max(2rem,env(safe-area-inset-bottom))]",
        width === "wide" ? "max-w-[96rem]" : "max-w-[42rem]",
        className,
      )}
    >
      {children}
    </div>
  )
}
