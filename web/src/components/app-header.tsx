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
    <header className="sticky top-0 z-50 border-b-2 border-border bg-card pt-[env(safe-area-inset-top)] shadow-sm">
      <div className={`${pageWidth} flex h-[var(--header-h)] items-stretch gap-2 sm:gap-8`}>
        <Link href="/" className="tap flex shrink-0 items-center px-1" aria-label="Over the Moon, home">
          <BrandLockup wordmarkClassName="hidden sm:inline" />
        </Link>

        <nav className="flex flex-1 items-stretch justify-center" aria-label="Main navigation">
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
                  "relative h-full min-w-[5rem] rounded-none px-4 py-2 text-[13px] font-bold uppercase tracking-[0.14em] hover:bg-transparent sm:text-[12px]",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute inset-x-4 bottom-0 h-[3px] bg-foreground transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden="true"
                />
              </Button>
            )
          })}
        </nav>

        <div
          className={cn(
            "flex shrink-0 items-center gap-1.5 self-center",
            live ? "rounded-md bg-live px-2.5 py-1.5" : "",
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          {live ? <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" /> : null}
          <p
            className={cn(
              "text-[13px] font-bold uppercase tracking-[0.12em] sm:text-[14px]",
              live ? "text-white" : "text-muted-foreground",
            )}
          >
            {live ? <span className="sr-only">Live. </span> : null}
            {periodLabel}
          </p>
        </div>
      </div>
    </header>
  )
}
