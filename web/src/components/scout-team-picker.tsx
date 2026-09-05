"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { OTM_LEAGUE_ID } from "@/lib/fantrax-shared"
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TeamsResponse | null>(null)

  useEffect(() => {
    async function fetchTeams() {
      try {
        setLoading(true)
        setError(null)
        const url = `/api/scout/teams?leagueId=${OTM_LEAGUE_ID}`
        const res = await fetch(url)
        
        if (!res.ok) {
          throw new Error(`Failed to fetch teams: ${res.statusText}`)
        }
        
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error("Error fetching teams:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchTeams()
  }, [])

  function handleTeamChange(teamId: string | null) {
    if (!teamId) return
    
    const params = new URLSearchParams(searchParams.toString())
    params.set("teamId", teamId)
    router.push(`${basePath}?${params.toString()}`)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Loading teams...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {error || "Failed to load teams"}
      </div>
    )
  }

  const currentTeam = data.teams.find((t) => t.id === currentTeamId)
  const displayName = currentTeam
    ? currentTeam.owner || currentTeam.shortName || currentTeam.name
    : "Select team"

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <label htmlFor="team-picker" className="text-sm font-medium">
        Manager:
      </label>
      <Select value={currentTeamId ?? undefined} onValueChange={handleTeamChange}>
        <SelectTrigger
          id="team-picker"
          className="w-full sm:w-[280px]"
          aria-label="Select a manager to view their Scout intelligence"
        >
          <SelectValue placeholder="Select a manager">{displayName}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {data.teams.map((team) => {
            const label = team.owner || team.shortName || team.name
            const subtitle = team.owner && team.name !== team.owner ? team.name : null
            
            return (
              <SelectItem key={team.id} value={team.id}>
                <div className="flex flex-col">
                  <span>{label}</span>
                  {subtitle && (
                    <span className="text-xs text-muted-foreground">{subtitle}</span>
                  )}
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </div>
  )
}
