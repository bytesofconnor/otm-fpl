"use client"

import { useEffect, useState } from "react"
import { OTM_LEAGUE_ID } from "@/lib/fantrax-shared"
import { heatLabel, heatEmoji, heatColor, type HeatBucket } from "@/lib/form-engine"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// SIA default teamId (cbarrett97 / Saints Intelligence Agency)
const SIA_TEAM_ID = "yv00la6xmsxcq62w"

type Opportunity = {
  player: {
    id: string
    name: string
    position: string
    club: string
    availability: string
  }
  whyNow: string
  formChip: HeatBucket
  formScore: number
  formScoreWithFixtures: number
  minutesContext: string
  fixtureContext: {
    bar: string
    summary: string
    avgDifficulty: number
    adjustment: number
  } | null
  beatsWho: {
    name: string
    position: string
    formScore: number
  }
  confidence: string
  killConditions: string[]
}

type OpportunitiesResponse = {
  opportunities: Opportunity[]
  timestamp: string
  teamId: string | null
  teamName: string | null
  leagueId: string
  debug?: {
    totalUnowned: number
    afterWireFilter: number
    afterSignalFilter: number
    afterTeamExclusionFilter: number
    afterFixtureFilter: number
    afterBenchComparisonFilter: number
    afterFormGapFilter: number
    afterDropBanFilter: number
    finalCandidates: number
  }
}

export function OpportunityBoard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<OpportunitiesResponse | null>(null)

  useEffect(() => {
    async function fetchOpportunities() {
      try {
        setLoading(true)
        setError(null)
        const url = `/api/scout/opportunities?teamId=${SIA_TEAM_ID}&leagueId=${OTM_LEAGUE_ID}`
        const res = await fetch(url)
        
        if (!res.ok) {
          throw new Error(`Failed to fetch opportunities: ${res.statusText}`)
        }
        
        const json = await res.json()
        setData(json)
      } catch (err) {
        console.error("Error fetching opportunities:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchOpportunities()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium">Loading opportunities...</div>
          <div className="text-sm text-muted-foreground">Analyzing wire targets</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
        <h2 className="text-lg font-semibold text-destructive">Error Loading Opportunities</h2>
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

  if (!data || data.opportunities.length === 0) {
    // Better empty state messaging based on context
    let emptyMessage = "All available players are below your roster quality."
    let emptyHint = "Check back after fixtures or adjust your roster."
    
    if (!data) {
      emptyMessage = "Unable to load opportunities"
      emptyHint = "Please try refreshing the page."
    } else if (!data.teamName && data.teamId) {
      emptyMessage = "Team not found"
      emptyHint = "Please verify your team ID or contact support."
    }
    
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-8 text-center">
        <p className="text-lg font-medium">No opportunities found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {emptyHint}
        </p>
        {data?.debug && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              Debug info (click to expand)
            </summary>
            <pre className="mt-2 overflow-auto rounded-md bg-muted p-2 text-xs">
              {JSON.stringify(data.debug, null, 2)}
            </pre>
          </details>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.opportunities.length} opportunities ranked by form
        </p>
        <p className="text-xs text-muted-foreground">
          Updated {new Date(data.timestamp).toLocaleTimeString()}
        </p>
      </div>

      <div className="grid gap-4">
        {data.opportunities.map((opp, idx) => (
          <OpportunityCard key={opp.player.id} opportunity={opp} rank={idx + 1} />
        ))}
      </div>
    </div>
  )
}

function OpportunityCard({ opportunity, rank }: { opportunity: Opportunity; rank: number }) {
  const { player, whyNow, formChip, formScore, formScoreWithFixtures, minutesContext, fixtureContext, beatsWho, confidence, killConditions } = opportunity
  const chipColor = heatColor(formChip)
  const chipLabel = heatLabel(formChip)
  const chipEmoji = heatEmoji(formChip)

  return (
    <article
      className={cn(
        "relative rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-6",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      )}
      aria-label={`Opportunity ${rank}: ${player.name}, ${player.position}, ${player.club}`}
    >
      {/* Rank badge */}
      <div className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
        {rank}
      </div>

      {/* Player header */}
      <div className="mb-3 pr-12">
        <h2 className="text-xl font-bold tracking-tight">{player.name}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold">{player.position}</span>
          <span aria-hidden>·</span>
          <span>{player.club}</span>
          <span aria-hidden>·</span>
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium uppercase">
            {player.availability}
          </span>
        </div>
      </div>

      {/* Form chip */}
      <div className={`mb-4 inline-flex items-center gap-2 rounded-md px-3 py-1.5 ${chipColor}`}>
        <span className="text-lg" aria-hidden>
          {chipEmoji}
        </span>
        <span className="font-semibold">
          {chipLabel}
        </span>
        <span className="text-sm font-medium text-white/90">
          {formScoreWithFixtures.toFixed(1)}
          {fixtureContext && fixtureContext.adjustment !== 0 && (
            <span className="ml-1 text-xs opacity-75">
              ({formScore.toFixed(1)} {fixtureContext.adjustment > 0 ? '+' : ''}{fixtureContext.adjustment})
            </span>
          )}
        </span>
      </div>

      {/* Fixture context */}
      {fixtureContext && (
        <div className="mb-4 rounded-md border border-border bg-muted/20 p-3">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Next 5 Fixtures
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-2xl tracking-wider" aria-label="Fixture difficulty: green is easy, white is medium, black is hard">
              {fixtureContext.bar}
            </span>
            <div className="flex-1">
              <p className="text-sm leading-tight">{fixtureContext.summary}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Avg difficulty: {fixtureContext.avgDifficulty.toFixed(1)}/5.0
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Why now */}
      <div className="mb-4">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Why Now
        </h3>
        <p className="text-sm leading-relaxed">{whyNow}</p>
      </div>

      {/* Minutes context */}
      {minutesContext && (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Playing Time
          </h3>
          <p className="text-sm leading-relaxed">{minutesContext}</p>
        </div>
      )}

      {/* Beats who */}
      <div className="mb-4 rounded-md border border-border bg-muted/30 p-3">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Replaces
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{beatsWho.name}</p>
            <p className="text-xs text-muted-foreground">{beatsWho.position}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-destructive">
              Form: {beatsWho.formScore.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">
              Gap: +{(formScore - beatsWho.formScore).toFixed(1)}
            </p>
          </div>
        </div>
      </div>

      {/* Confidence */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Confidence:
          </span>
          <span
            className={cn(
              "rounded-sm px-2 py-0.5 text-xs font-bold uppercase",
              confidence === "HIGH" && "bg-green-500/20 text-green-700 dark:text-green-300",
              confidence === "MEDIUM" && "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
              confidence === "LOW" && "bg-orange-500/20 text-orange-700 dark:text-orange-300"
            )}
          >
            {confidence}
          </span>
        </div>
      </div>

      {/* Kill conditions */}
      {killConditions.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
            Kill Conditions ({killConditions.length})
          </summary>
          <ul className="mt-2 space-y-1 pl-4" aria-label="Reasons to drop this recommendation">
            {killConditions.map((condition, idx) => (
              <li key={idx} className="text-sm text-muted-foreground">
                • {condition}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  )
}
