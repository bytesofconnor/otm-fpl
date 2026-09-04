// Description: Persistent app chrome — product mark, League/Form, live gameweek.
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactElement } from "react"
import { BrandLockup } from "@/components/brand"
import { useLeagueStatus } from "@/components/league-status"
import { pageWidth } from "@/components/page-shell"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/", label: "League" },
  { href: "/form", label: "Form" },
  { href: "/scout", label: "Scout" },
] as const

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Product header. The league name lives on the page; the bar is always Over the Moon.
 */
export function AppHeader(): ReactElement {
  const pathname = usePathname()
  const { periodLabel, live } = useLeagueStatus()

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/75 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className={`${pageWidth} flex h-[var(--header-h)] items-stretch gap-3 sm:gap-8`}>
        <Link href="/" className="tap flex shrink-0 items-center" aria-label="OTM FPL, home">
          <BrandLockup />
        </Link>

        <nav className="flex flex-1 items-stretch justify-center" aria-label="Primary">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Button
                key={item.href}
                variant="ghost"
                size="sm"
                render={<Link href={item.href} prefetch aria-current={active ? "page" : undefined} />}
                nativeButton={false}
                className={cn(
                  "relative h-full min-w-[4.5rem] rounded-none px-3 text-[12px] font-semibold uppercase tracking-[0.18em] hover:bg-transparent",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute inset-x-3 bottom-0 h-0.5 bg-live transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
              </Button>
            )
          })}
        </nav>

        <p
          className={cn(
            "flex shrink-0 items-center gap-1.5 self-center text-[13px] font-bold uppercase tracking-[0.12em]",
            live ? "font-medium text-live" : "text-muted-foreground",
          )}
        >
          {live ? <span className="otm-live-dot size-1.5 rounded-full bg-live" aria-hidden /> : null}
          {live ? <span className="sr-only">Live. </span> : null}
          {periodLabel}
        </p>
      </div>
    </header>
  )
}
