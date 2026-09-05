"use client"

import { useEffect, useState } from "react"
import { OTM_LEAGUE_ID } from "@/lib/fantrax-shared"
import { heatLabel, heatEmoji, heatColor, type HeatBucket } from "@/lib/form-engine"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// SIA default teamId
const SIA_TEAM_ID = "yv00la6xmsxcq62w"

type RiskLevel = "low" | "medium" | "high"
type ConfidenceLevel = "low" | "medium" | "high"

type WaiverCandidate = {
  claimPriority: number
  player: {
    id: string
    name: string
    position: string
    club: string
  }
  reasoning: string
  formChip: HeatBucket
  formScore: number
  formScoreWithFixtures: number
  minutesContext: string | null
  fixtureContext: {
    bar: string
    summary: string
    avgDifficulty: number
    adjustment: number
  } | null
  dropCandidate: {
    name: string
    position: string
    formChip: HeatBucket
    formScore: number
  } | null
  riskAssessment: {
    level: RiskLevel
    factors: string[]
  }
  confidence: ConfidenceLevel
  killConditions: string[]
  fantraxProj: number | null
}

type WaiversResponse = {
  waivers: WaiverCandidate[]
  timestamp: string
  teamId: string
  teamName: string | null
  leagueId: string
  debug?: {
    totalUnowned: number
    afterWWFilter: number
    afterSignalFilter: number
    afterTeamExclusionFilter: number
    afterFixtureFilter: number
    afterBenchComparisonFilter: number
    afterFormGapFilter: number
    afterDropBanFilter: number
    finalCandidates: number
    minFormScoreGap: number
  }
}

export function WaiverBoard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<WaiversResponse | null>(null)

  useEffect(() => {
    async function fetchWaivers() {
      try {
        setLoading(true)
        setError(null)
        const url = `/api/scout/waivers?teamId=${SIA_TEAM_ID}&leagueId=${OTM_LEAGUE_ID}`
        const res = await fetch(url)
        
        if (!res.ok) {
          throw new Error(`Failed to fetch waivers: ${res.statusText}`)
        }
        
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error("Error fetching waivers:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchWaivers()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="space-y-3 text-center">
          <div
            className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"
            role="status"
            aria-label="Loading waiver recommendations"
          />
          <p className="text-sm text-muted-foreground">Loading waiver priorities...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
        <p className="font-medium text-destructive">Failed to load waiver recommendations</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
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

  if (!data || data.waivers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No waiver wire targets found. All available players are either FA or don&apos;t meet minimum form thresholds.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Team header */}
      {data.teamName && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Waiver priorities for <span className="font-medium text-foreground">{data.teamName}</span>
          </p>
        </div>
      )}

      {/* Waiver cards */}
      <div className="space-y-4">
        {data.waivers.map((waiver) => (
          <WaiverCard key={waiver.player.id} waiver={waiver} />
        ))}
      </div>

      {/* Debug info */}
      {data.debug && (
        <details className="rounded-lg border border-border bg-muted/50 p-4 text-xs">
          <summary className="cursor-pointer font-medium text-muted-foreground">
            Debug Info
          </summary>
          <pre className="mt-2 overflow-x-auto text-muted-foreground">
            {JSON.stringify(data.debug, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}

function WaiverCard({ waiver }: { waiver: WaiverCandidate }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Priority badge + player info */}
      <div className="flex items-start gap-3">
        {/* Priority badge */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold",
            waiver.claimPriority === 1 && "bg-yellow-500/20 text-yellow-500 ring-2 ring-yellow-500/50",
            waiver.claimPriority === 2 && "bg-orange-500/20 text-orange-500 ring-2 ring-orange-500/50",
            waiver.claimPriority === 3 && "bg-red-500/20 text-red-500 ring-2 ring-red-500/50",
            waiver.claimPriority > 3 && "bg-muted text-muted-foreground",
          )}
          aria-label={`Claim priority ${waiver.claimPriority}`}
        >
          {waiver.claimPriority}
        </div>

        {/* Player name + position */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{waiver.player.name}</h3>
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {waiver.player.position}
            </span>
            <span className="text-xs text-muted-foreground">{waiver.player.club}</span>
          </div>

          {/* Reasoning */}
          <p className="mt-1 text-sm text-muted-foreground">{waiver.reasoning}</p>
        </div>
      </div>

      {/* Form score + fixture context */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Form:</span>
          <span className={cn("font-medium", heatColor(waiver.formChip))}>
            {heatEmoji(waiver.formChip)} {heatLabel(waiver.formChip)}
          </span>
          <span className="text-muted-foreground">
            ({waiver.formScoreWithFixtures.toFixed(1)})
          </span>
        </div>

        {waiver.fixtureContext && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Fixtures:</span>
            <span title={waiver.fixtureContext.summary}>
              {waiver.fixtureContext.bar}
            </span>
            {waiver.fixtureContext.adjustment !== 0 && (
              <span className={cn(
                "text-xs font-medium",
                waiver.fixtureContext.adjustment > 0 ? "text-green-500" : "text-red-500"
              )}>
                ({waiver.fixtureContext.adjustment > 0 ? "+" : ""}{waiver.fixtureContext.adjustment.toFixed(1)})
              </span>
            )}
          </div>
        )}

        {waiver.minutesContext && (
          <div className="text-muted-foreground">{waiver.minutesContext}</div>
        )}
      </div>

      {/* Drop candidate */}
      {waiver.dropCandidate && (
        <div className="mt-3 rounded border border-dashed border-muted-foreground/30 bg-muted/30 p-2 text-sm">
          <span className="font-medium text-muted-foreground">Drop:</span>{" "}
          <span className="text-foreground">{waiver.dropCandidate.name}</span>
          {" "}
          <span className="text-muted-foreground">
            ({waiver.dropCandidate.position}, {heatLabel(waiver.dropCandidate.formChip)} {waiver.dropCandidate.formScore.toFixed(1)})
          </span>
        </div>
      )}

      {/* Risk assessment + confidence */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Risk:</span>
          <span
            className={cn(
              "rounded px-2 py-0.5 font-medium",
              waiver.riskAssessment.level === "low" && "bg-green-500/20 text-green-500",
              waiver.riskAssessment.level === "medium" && "bg-yellow-500/20 text-yellow-500",
              waiver.riskAssessment.level === "high" && "bg-red-500/20 text-red-500",
            )}
          >
            {waiver.riskAssessment.level.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Confidence:</span>
          <span
            className={cn(
              "rounded px-2 py-0.5 font-medium",
              waiver.confidence === "high" && "bg-blue-500/20 text-blue-500",
              waiver.confidence === "medium" && "bg-yellow-500/20 text-yellow-500",
              waiver.confidence === "low" && "bg-muted text-muted-foreground",
            )}
          >
            {waiver.confidence.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Risk factors */}
      {waiver.riskAssessment.factors.length > 0 && (
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {waiver.riskAssessment.factors.map((factor, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <span className="text-muted-foreground/50">•</span>
              <span>{factor}</span>
            </div>
          ))}
        </div>
      )}

      {/* Kill conditions */}
      {waiver.killConditions.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
            Kill Conditions
          </summary>
          <ul className="mt-2 space-y-1 pl-4 text-muted-foreground">
            {waiver.killConditions.map((condition, idx) => (
              <li key={idx} className="list-disc">
                {condition}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Fantrax projection footnote */}
      {waiver.fantraxProj !== null && (
        <div className="mt-3 border-t border-dashed border-muted-foreground/20 pt-2 text-xs text-muted-foreground">
          Fantrax proj: {waiver.fantraxProj.toFixed(1)} pts
        </div>
      )}
    </div>
  )
}
