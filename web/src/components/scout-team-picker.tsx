"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { persistMembership, useConnectedLeague } from "@/lib/league-session"
import { preferredTeamId } from "@/lib/scout-config"
import { PhoneSheet, PickerOption } from "@/components/ui/phone-sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Team = {
  id: string
  name: string
  owner: string | null
  shortName: string | null
}

type TeamsResponse = {
  leagueId: string
  leagueName: string
  teams: Team[]
}

interface ScoutTeamPickerProps {
  currentTeamId: string | null
  basePath: string
}

export function ScoutTeamPicker({ currentTeamId, basePath }: ScoutTeamPickerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { leagueId, storedTeamId, ready } = useConnectedLeague()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TeamsResponse | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (!ready) return

    async function fetchTeams() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/scout/teams?leagueId=${encodeURIComponent(leagueId)}`)
        if (!res.ok) {
          throw new Error(`Failed to fetch teams: ${res.statusText}`)
        }
        const json = (await res.json()) as TeamsResponse
        setData(json)
        const nextId = preferredTeamId(json.teams, [currentTeamId, storedTeamId])
        if (nextId && nextId !== currentTeamId) {
          const named = json.teams.find((t) => t.id === nextId)
          persistMembership(leagueId, nextId, named?.name, named?.shortName)
          const params = new URLSearchParams(window.location.search)
          params.set("teamId", nextId)
          router.replace(`${basePath}?${params.toString()}`)
        }
      } catch (err) {
        console.error("Error fetching teams:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    void fetchTeams()
  }, [ready, leagueId, storedTeamId, currentTeamId, basePath, router])

  function handleTeamChange(teamId: string | null) {
    if (!teamId) return
    const named = data?.teams.find((t) => t.id === teamId)
    persistMembership(leagueId, teamId, named?.name, named?.shortName)
    const params = new URLSearchParams(searchParams.toString())
    params.set("teamId", teamId)
    router.push(`${basePath}?${params.toString()}`)
  }

  if (!ready || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Loading squads…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
        {error || "Could not load squads"}
      </div>
    )
  }

  if (!currentTeamId && !storedTeamId) {
    return (
      <p className="text-[15px] text-muted-foreground">
        <Link href="/" className="text-foreground underline underline-offset-4">
          Open League
        </Link>{" "}
        and pick a squad first. Scout follows that pick.
      </p>
    )
  }

  const currentTeam = data.teams.find((t) => t.id === currentTeamId)
  const displayName = currentTeam?.name ?? "Your squad"

  return (
    <details className="text-[13px] text-muted-foreground">
      <summary className="tap cursor-pointer underline decoration-border underline-offset-4 hover:text-foreground">
        Scouting another squad
      </summary>
      <div className="mt-3">
        <div className="md:hidden">
          <button
            type="button"
            className="tap flex min-h-11 w-full items-center justify-between rounded-md border border-input bg-card px-3 text-left text-sm"
            aria-label="Your squad"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen(true)}
          >
            <span className="min-w-0 whitespace-normal break-words">{displayName}</span>
          </button>
          <PhoneSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Your squad">
            <ul>
              {data.teams.map((team) => (
                <li key={team.id}>
                  <PickerOption
                    selected={team.id === currentTeamId}
                    onClick={() => {
                      handleTeamChange(team.id)
                      setSheetOpen(false)
                    }}
                  >
                    <span className="min-w-0 flex-1 whitespace-normal break-words">
                      {team.name}
                      {team.owner ? <span className="mt-0.5 block text-xs text-muted-foreground">{team.owner}</span> : null}
                    </span>
                  </PickerOption>
                </li>
              ))}
            </ul>
          </PhoneSheet>
        </div>
        <div className="hidden md:block">
          <label htmlFor="team-picker" className="sr-only">
            Your squad
          </label>
          <Select value={currentTeamId || ""} onValueChange={handleTeamChange}>
            <SelectTrigger id="team-picker" className="w-full sm:w-[280px]" aria-label="Your squad">
              <SelectValue placeholder="Your squad">{displayName}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {data.teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  <div className="flex flex-col">
                    <span className="whitespace-normal break-words">{team.name}</span>
                    {team.owner ? <span className="text-xs text-muted-foreground">{team.owner}</span> : null}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </details>
  )
}
