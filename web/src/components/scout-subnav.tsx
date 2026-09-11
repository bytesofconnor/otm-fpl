"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import type { ReactElement } from "react"
import { useConnectedLeague } from "@/lib/league-session"
import { cn } from "@/lib/utils"

const ITEMS = [
  { href: "/scout", label: "Wire" },
  { href: "/scout/waivers", label: "Waivers" },
  { href: "/scout/matchup", label: "Matchup" },
] as const

function isActive(pathname: string, href: string): boolean {
  if (href === "/scout") return pathname === "/scout"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function ScoutSubnav({ room }: { room: "Wire" | "Waivers" | "Matchup" }): ReactElement {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { storedTeamName, storedTeamShort, ready } = useConnectedLeague()
  const team = searchParams.get("teamId")
  const suffix = team ? `?teamId=${encodeURIComponent(team)}` : ""
  const squad = ready ? storedTeamShort || storedTeamName : ""

  return (
    <div className="space-y-5">
      <nav className="flex gap-5 sm:gap-6" aria-label="Scout">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={`${item.href}${suffix}`}
              className={cn(
                "tap pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] sm:text-[12px]",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      <p className="otm-kicker">
        {room}
        {squad ? ` · ${squad}` : ""}
      </p>
    </div>
  )
}
