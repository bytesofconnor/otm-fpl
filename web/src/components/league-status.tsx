// Description: Lightweight league meta for the sticky header (gameweek + live state).
"use client"

import * as React from "react"
import { OTM_LEAGUE_NAME } from "@/lib/fantrax-shared"

export type LeagueStatusValue = {
  leagueName: string
  periodLabel: string
  live: boolean
}

type LeagueStatusContextValue = LeagueStatusValue & {
  setStatus: (next: LeagueStatusValue | null) => void
}

const DEFAULT: LeagueStatusValue = { leagueName: OTM_LEAGUE_NAME, periodLabel: "26/27", live: false }

const LeagueStatusContext = React.createContext<LeagueStatusContextValue>({
  ...DEFAULT,
  setStatus: () => undefined,
})

/**
 * Provides current gameweek status to chrome that sits outside the league page.
 */
export function LeagueStatusProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [status, setStatusState] = React.useState<LeagueStatusValue>(DEFAULT)
  const setStatus = React.useCallback((next: LeagueStatusValue | null) => {
    setStatusState(next ?? DEFAULT)
  }, [])
  const value = React.useMemo(() => ({ ...status, setStatus }), [status, setStatus])
  return <LeagueStatusContext.Provider value={value}>{children}</LeagueStatusContext.Provider>
}

export function useLeagueStatus(): LeagueStatusContextValue {
  return React.useContext(LeagueStatusContext)
}
