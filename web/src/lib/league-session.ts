"use client"

import * as React from "react"
import {
  LEAGUE_STORAGE_KEY,
  MEMBERSHIP_EVENT,
  OTM_LEAGUE_ID,
  TEAM_NAME_STORAGE_KEY,
  TEAM_SHORT_STORAGE_KEY,
  TEAM_STORAGE_KEY,
  parseLeagueId,
  teamCode,
} from "@/lib/fantrax-shared"

export function readStoredLeagueId(): string {
  return parseLeagueId(window.localStorage.getItem(LEAGUE_STORAGE_KEY) ?? "") || OTM_LEAGUE_ID
}

export function readStoredTeamId(): string {
  return window.localStorage.getItem(TEAM_STORAGE_KEY) ?? ""
}

export function readStoredTeamName(): string {
  return window.localStorage.getItem(TEAM_NAME_STORAGE_KEY) ?? ""
}

export function readStoredTeamShort(): string {
  return window.localStorage.getItem(TEAM_SHORT_STORAGE_KEY) ?? ""
}

export function writeStoredLeagueId(leagueId: string): void {
  window.localStorage.setItem(LEAGUE_STORAGE_KEY, leagueId)
}

export function writeStoredTeamId(teamId: string): void {
  if (!teamId) {
    window.localStorage.removeItem(TEAM_STORAGE_KEY)
    window.localStorage.removeItem(TEAM_NAME_STORAGE_KEY)
    window.localStorage.removeItem(TEAM_SHORT_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(TEAM_STORAGE_KEY, teamId)
}

export function writeStoredTeamName(name: string): void {
  if (!name) {
    window.localStorage.removeItem(TEAM_NAME_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(TEAM_NAME_STORAGE_KEY, name)
}

export function writeStoredTeamShort(short: string): void {
  if (!short) {
    window.localStorage.removeItem(TEAM_SHORT_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(TEAM_SHORT_STORAGE_KEY, short)
}

export function writeLocalMembership(
  leagueId: string,
  teamId: string,
  teamName?: string,
  teamShort?: string,
): void {
  writeStoredLeagueId(leagueId)
  writeStoredTeamId(teamId)
  if (!teamId) {
    writeStoredTeamName("")
    writeStoredTeamShort("")
    return
  }
  if (teamName !== undefined) writeStoredTeamName(teamName)
  if (teamShort !== undefined) writeStoredTeamShort(teamShort)
  else if (teamName) writeStoredTeamShort(teamCode(teamName))
}

function emitMembership(): void {
  window.dispatchEvent(new Event(MEMBERSHIP_EVENT))
}

export function rememberSquad(name: string, shortName?: string | null): void {
  const short = teamCode(name, shortName)
  const same = name === readStoredTeamName() && short === readStoredTeamShort()
  if (same) return
  writeStoredTeamName(name)
  writeStoredTeamShort(short)
  emitMembership()
}

export function persistMembership(
  leagueId: string,
  teamId: string,
  teamName?: string,
  teamShort?: string | null,
): void {
  writeLocalMembership(
    leagueId,
    teamId,
    teamName,
    teamId && teamName ? teamCode(teamName, teamShort) : teamShort ?? "",
  )
  emitMembership()
  void fetch("/api/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leagueId, teamId: teamId || null }),
  }).catch(() => {
    /* Signed out is fine — localStorage still holds the connection. */
  })
}

export type ConnectedLeague = {
  leagueId: string
  storedTeamId: string
  storedTeamName: string
  storedTeamShort: string
  ready: boolean
  email: string | null
  plan: "free" | "pro"
}

/** Connected league + squad: account profile when signed in, otherwise this browser. */
export function useConnectedLeague(): ConnectedLeague {
  const [leagueId, setLeagueId] = React.useState(OTM_LEAGUE_ID)
  const [storedTeamId, setStoredTeamId] = React.useState("")
  const [storedTeamName, setStoredTeamName] = React.useState("")
  const [storedTeamShort, setStoredTeamShort] = React.useState("")
  const [email, setEmail] = React.useState<string | null>(null)
  const [plan, setPlan] = React.useState<"free" | "pro">("free")
  const [ready, setReady] = React.useState(false)

  const applyLocal = React.useCallback(() => {
    setLeagueId(readStoredLeagueId())
    setStoredTeamId(readStoredTeamId())
    setStoredTeamName(readStoredTeamName())
    setStoredTeamShort(readStoredTeamShort())
  }, [])

  React.useEffect(() => {
    let cancelled = false
    const localLeague = readStoredLeagueId()
    const localTeam = readStoredTeamId()
    const localName = readStoredTeamName()
    const localShort = readStoredTeamShort() || (localName ? teamCode(localName) : "")

    async function boot() {
      try {
        const res = await fetch("/api/me")
        if (res.ok) {
          const body = (await res.json()) as {
            leagueId?: string
            teamId?: string | null
            email?: string | null
            plan?: string
          }
          if (cancelled) return
          const league = parseLeagueId(body.leagueId ?? "") || localLeague
          const team = body.teamId || localTeam
          writeLocalMembership(league, team, team ? localName : "", team ? localShort : "")
          if (body.email && !body.teamId && localTeam) {
            persistMembership(league, localTeam, localName, localShort)
          }
          setLeagueId(league)
          setStoredTeamId(team)
          setStoredTeamName(team ? localName : "")
          setStoredTeamShort(team ? localShort : "")
          setEmail(body.email ?? null)
          setPlan(body.plan === "pro" ? "pro" : "free")
          setReady(true)
          return
        }
      } catch {
        /* fall through to local */
      }
      if (cancelled) return
      setLeagueId(localLeague)
      setStoredTeamId(localTeam)
      setStoredTeamName(localName)
      setStoredTeamShort(localShort)
      setEmail(null)
      setPlan("free")
      setReady(true)
    }

    void boot()
    const onChange = () => {
      if (!cancelled) applyLocal()
    }
    window.addEventListener(MEMBERSHIP_EVENT, onChange)
    window.addEventListener("storage", onChange)
    return () => {
      cancelled = true
      window.removeEventListener(MEMBERSHIP_EVENT, onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [applyLocal])

  return { leagueId, storedTeamId, storedTeamName, storedTeamShort, ready, email, plan }
}
