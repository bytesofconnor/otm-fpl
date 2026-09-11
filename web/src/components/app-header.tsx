// Description: Identity strip then League/Form/Scout — three columns, then tabs.
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactElement } from "react"
import { AuthMenu } from "@/components/auth-menu"
import { BrandLockup } from "@/components/brand"
import { useLeagueStatus } from "@/components/league-status"
import { pageWidth } from "@/components/page-shell"
import { useConnectedLeague } from "@/lib/league-session"
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

const stripType =
  "text-[11px] font-semibold uppercase leading-tight tracking-[0.14em] sm:text-[12px]"

export function AppHeader(): ReactElement {
  const pathname = usePathname()
  const { periodLabel, live } = useLeagueStatus()
  const { storedTeamShort, storedTeamName, storedTeamId, ready } = useConnectedLeague()
  const squadLabel = !ready
    ? ""
    : storedTeamShort || storedTeamName || (storedTeamId ? "Squad" : "Pick squad")

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/75 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className={pageWidth}>
        <div className="grid grid-cols-3 items-baseline gap-2 border-b border-border py-2.5">
          <Link href="/" className="tap min-w-0 text-foreground" aria-label="OTM FPL, home">
            <BrandLockup className="whitespace-normal text-[13px] leading-tight tracking-[0.14em] sm:text-[15px]" />
          </Link>
          {squadLabel ? (
            <Link
              href="/"
              className={cn(stripType, "min-w-0 justify-self-center text-center text-foreground")}
              title={storedTeamName || squadLabel}
            >
              {squadLabel}
            </Link>
          ) : (
            <span />
          )}
          <div
            className={cn(
              stripType,
              "flex min-w-0 flex-wrap items-center justify-end gap-x-1.5 text-right text-muted-foreground",
            )}
          >
            {live ? <span className="otm-live-dot size-1.5 rounded-full bg-live" aria-hidden /> : null}
            {live ? <span className="sr-only">Live. </span> : null}
            <span>{periodLabel}</span>
            <AuthMenu />
          </div>
        </div>

        <nav className="flex items-end gap-5 sm:gap-8" aria-label="Primary">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tap border-b-2 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] sm:text-[12px]",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
