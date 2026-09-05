"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { OTM_LEAGUE_ID } from "@/lib/fantrax-shared"
import { computeFormScoreSimple, heatEmoji, heatLabel, heatColor, type HeatBucket } from "@/lib/form-engine"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// SIA default teamId (cbarrett97 / Saints Intelligence Agency)
const SIA_TEAM_ID = "yv00la6xmsxcq62w"

type Player = {
  id: string
  name: string
  position: string
  club: string
  formHeat: HeatBucket
  formScore: number
  status: "ACTIVE" | "RESERVE" | "IR"
  points: number | null
}

type LineupData = {
  starters: Player[]
  bench: Player[]
  teamName: string
}

export function MatchupPrep() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<LineupData | null>(null)

  // Get teamId from query params, default to SIA
  const teamId = searchParams.get("teamId") || SIA_TEAM_ID

  useEffect(() => {
    async function fetchLineup() {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch form data for the team's roster
        const url = `/api/fantrax/form?leagueId=${OTM_LEAGUE_ID}&teamId=${teamId}`
        const res = await fetch(url)
        
        if (!res.ok) {
          throw new Error(`Failed to fetch lineup: ${res.statusText}`)
        }
        
        const json = await res.json()
        
        // Process players from roster
        const starters: Player[] = []
        const bench: Player[] = []
        
        for (const player of json.players || []) {
          const formScore = computeFormScoreSimple({
            lastGW: player.live ?? player.points,
            projBeat: (player.live ?? 0) > (player.points ?? 0),
          })
          
          const playerData: Player = {
            id: player.id,
            name: player.name,
            position: player.position,
            club: player.team,
            formHeat: formScore.heat,
            formScore: formScore.score,
            status: player.status || "ACTIVE",
            points: player.points,
          }
          
          if (player.status === "ACTIVE") {
            starters.push(playerData)
          } else {
            bench.push(playerData)
          }
        }
        
        setData({
          starters: starters.sort((a, b) => {
            const posOrder = { G: 0, D: 1, M: 2, F: 3 }
            return (posOrder[a.position[0] as keyof typeof posOrder] ?? 4) - 
                   (posOrder[b.position[0] as keyof typeof posOrder] ?? 4)
          }),
          bench: bench.sort((a, b) => b.formScore - a.formScore),
          teamName: json.teamName || "Your Team",
        })
      } catch (err) {
        console.error("Error fetching lineup:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchLineup()
  }, [teamId])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium">Loading lineup...</div>
          <div className="text-sm text-muted-foreground">Analyzing form</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
        <h2 className="text-lg font-semibold text-destructive">Error Loading Lineup</h2>
        <p className="mt-2 text-sm">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-8 text-center">
        <p className="text-lg font-medium">No lineup data</p>
      </div>
    )
  }

  // Find close calls (starters with cold/warm form vs hot bench players)
  const coldStarters = data.starters.filter(p => p.formHeat === "cold" || p.formHeat === "warm")
  const hotBench = data.bench.filter(p => p.formHeat === "hot" || p.formHeat === "fire" || p.formHeat === "burning")
  const closeCalls = coldStarters.filter(starter => 
    hotBench.some(bench => 
      bench.position === starter.position && bench.formScore > starter.formScore + 5
    )
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{data.teamName}</h2>
        <p className="text-sm text-muted-foreground">
          {data.starters.length} starters, {data.bench.length} bench
        </p>
      </div>

      {/* Close calls alert */}
      {closeCalls.length > 0 && (
        <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-4">
          <h3 className="font-semibold text-orange-700 dark:text-orange-300">
            ⚠️ {closeCalls.length} Start/Sit Decision{closeCalls.length > 1 ? "s" : ""}
          </h3>
          <p className="mt-1 text-sm text-orange-600 dark:text-orange-400">
            You have cold starters with hot bench players available
          </p>
        </div>
      )}

      {/* Lineup Heatmap */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Starting XI Heatmap
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.starters.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      </section>

      {/* Bench Order */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Bench Order (by Form)
        </h3>
        <div className="grid gap-2">
          {data.bench.map((player, idx) => (
            <PlayerCard key={player.id} player={player} rank={idx + 1} />
          ))}
        </div>
      </section>
    </div>
  )
}

function PlayerCard({ player, rank }: { player: Player; rank?: number }) {
  const chipColor = heatColor(player.formHeat)
  const chipLabel = heatLabel(player.formHeat)
  const chipEmoji = heatEmoji(player.formHeat)

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        player.status !== "ACTIVE" && "opacity-75"
      )}
    >
      {rank && (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
          {rank}
        </span>
      )}
      
      <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-md", chipColor)}>
        <span className="text-2xl" aria-hidden>
          {chipEmoji}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{player.name}</p>
        <p className="text-xs text-muted-foreground">
          {player.position} · {player.club}
        </p>
      </div>

      <div className="flex flex-col items-end text-right">
        <p className="text-xs font-medium text-muted-foreground">{chipLabel}</p>
        <p className="font-mono text-sm font-semibold">
          {typeof player.formScore === 'number' ? player.formScore.toFixed(1) : '—'}
        </p>
      </div>
    </div>
  )
}
