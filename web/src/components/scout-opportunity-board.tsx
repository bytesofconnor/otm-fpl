"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
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

interface NearMiss {
  playerName: string
  formGap: number
  blockedBy: "form_gap" | "drop_ban"
  dropCandidate?: string
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
    minFormScoreGap: number
    topNearMisses: NearMiss[]
  }
}

export function OpportunityBoard() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<OpportunitiesResponse | null>(null)

  // Get teamId from query params, default to SIA
  const teamId = searchParams.get("teamId") || SIA_TEAM_ID

  useEffect(() => {
    async function fetchOpportunities() {
      try {
        setLoading(true)
        setError(null)
        const url = `/api/scout/opportunities?teamId=${teamId}&leagueId=${OTM_LEAGUE_ID}`
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
  }, [teamId])

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

  if (!data || !data.opportunities || data.opportunities.length === 0) {
    // When no true opportunities but we have near-misses, show them as first-class cards
    const hasNearMisses = data?.debug?.topNearMisses && data.debug.topNearMisses.length > 0
    
    if (hasNearMisses) {
      const dropBanBlocked = data.debug!.topNearMisses.filter(
        (miss) => miss.blockedBy === "drop_ban"
      )
      const formGapBlocked = data.debug!.topNearMisses.filter(
        (miss) => miss.blockedBy === "form_gap"
      )
      
      return (
        <div className="space-y-6">
          {/* Header explaining why these are near-misses */}
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
            <h3 className="flex items-center gap-2 font-semibold text-yellow-700 dark:text-yellow-300">
              <span className="text-xl">⚠️</span>
              No Immediate Pickups Available
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {dropBanBlocked.length > 0 
                ? `${dropBanBlocked.length} upgrade${dropBanBlocked.length > 1 ? 's' : ''} would require dropping a protected player (Garner, Truffert, or Havertz).`
                : `${formGapBlocked.length} player${formGapBlocked.length > 1 ? 's' : ''} available but below minimum form threshold.`
              }
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Showing closest upgrades for context. Consider these if form changes significantly.
            </p>
          </div>

          {/* Near-miss cards */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Blocked Upgrades ({data.debug!.topNearMisses.length})
            </h3>
            <div className="grid gap-4">
              {data.debug!.topNearMisses.map((nearMiss, idx) => (
                <NearMissCard key={`${nearMiss.playerName}-${idx}`} nearMiss={nearMiss} rank={idx + 1} />
              ))}
            </div>
          </div>

          {/* Next actions section */}
          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="text-lg">💡</span>
              Potential Next Actions
            </h3>
            <div className="space-y-3 text-sm">
              {dropBanBlocked.length > 0 && (
                <div className="flex gap-3">
                  <span className="text-xl" aria-hidden>🔒</span>
                  <div>
                    <p className="font-medium">Consider Adjusting Protected Players</p>
                    <p className="mt-1 text-muted-foreground">
                      {dropBanBlocked.slice(0, 2).map(m => m.playerName).join(' and ')} could be strong pickups, but {dropBanBlocked.slice(0, 2).map(m => m.dropCandidate).filter((v, i, a) => a.indexOf(v) === i).join(', ')} {dropBanBlocked.slice(0, 2).filter((v, i, a) => a.findIndex(t => t.dropCandidate === v.dropCandidate) === i).length === 1 ? 'is' : 'are'} protected. Only adjust if these players become essential.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex gap-3">
                <span className="text-xl" aria-hidden>📊</span>
                <div>
                  <p className="font-medium">Check Waiver Wire Priorities</p>
                  <p className="mt-1 text-muted-foreground">
                    Visit <a href="/scout/waivers" className="text-primary underline-offset-4 hover:underline">Scout Waivers</a> to see prioritized waiver wire targets. WW claims don&apos;t require drops until after the claim period.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="text-xl" aria-hidden>⚡</span>
                <div>
                  <p className="font-medium">Review Start/Sit Decisions</p>
                  <p className="mt-1 text-muted-foreground">
                    Head to <a href="/scout/matchup" className="text-primary underline-offset-4 hover:underline">Matchup Prep</a> to see your lineup heatmap and identify any cold starters who could be benched for hot bench players.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="text-xl" aria-hidden>📅</span>
                <div>
                  <p className="font-medium">Monitor After Fixtures</p>
                  <p className="mt-1 text-muted-foreground">
                    Form changes after each gameweek. Check back after the next round of fixtures when new returns and minutes data updates the rankings.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Info section about the scout */}
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <h4 className="mb-2 text-sm font-semibold">How Scout Works</h4>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Scout recommends FA pickups when they significantly outperform your bench players by form score (goals, assists, clean sheets, minutes). 
              Protected players are never suggested for drops. When no immediate upgrades exist, near-misses show potential moves to consider if circumstances change.
            </p>
          </div>

          {/* Debug toggle (collapsed by default) */}
          {data.debug && (
            <details className="rounded-lg border border-border bg-muted/20 p-4">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                Debug Info (Technical Details)
              </summary>
              <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(data.debug, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )
    }
    
    // True empty state (no opportunities, no near-misses) - very rare
    let emptyMessage = "No players available meet upgrade criteria."
    let emptyHint = "Check back after fixtures, or visit Waivers and Matchup Prep for other opportunities."
    
    if (!data) {
      emptyMessage = "Unable to load opportunities"
      emptyHint = "Please try refreshing the page."
    } else if (!data.teamName && data.teamId) {
      emptyMessage = "Team not found"
      emptyHint = "Please verify your team ID or contact support."
    }
    
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-muted/20 p-8 text-center">
          <p className="text-lg font-medium">No opportunities found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {emptyMessage}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {emptyHint}
          </p>
        </div>

        {/* Still show next actions even in true empty state */}
        <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <span className="text-lg">💡</span>
            Where to Look Next
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <span className="text-xl" aria-hidden>📊</span>
              <div>
                <p className="font-medium">Waiver Wire</p>
                <p className="mt-1 text-muted-foreground">
                  Visit <a href="/scout/waivers" className="text-primary underline-offset-4 hover:underline">Scout Waivers</a> for prioritized waiver wire targets.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <span className="text-xl" aria-hidden>⚡</span>
              <div>
                <p className="font-medium">Matchup Prep</p>
                <p className="mt-1 text-muted-foreground">
                  Check <a href="/scout/matchup" className="text-primary underline-offset-4 hover:underline">Matchup Prep</a> for lineup optimization and start/sit decisions.
                </p>
              </div>
            </div>
          </div>
        </div>

        {data?.debug && (
          <details className="rounded-lg border border-border bg-muted/20 p-4">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              Debug info (click to expand)
            </summary>
            <pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">
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
        {data.timestamp && (
          <p className="text-xs text-muted-foreground">
            Updated {new Date(data.timestamp).toLocaleTimeString()}
          </p>
        )}
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
          {typeof formScoreWithFixtures === 'number' ? formScoreWithFixtures.toFixed(1) : '—'}
          {fixtureContext && typeof fixtureContext.adjustment === 'number' && fixtureContext.adjustment !== 0 && (
            <span className="ml-1 text-xs opacity-75">
              ({typeof formScore === 'number' ? formScore.toFixed(1) : '—'} {fixtureContext.adjustment > 0 ? '+' : ''}{fixtureContext.adjustment})
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
                Avg difficulty: {typeof fixtureContext.avgDifficulty === 'number' ? fixtureContext.avgDifficulty.toFixed(1) : '—'}/5.0
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
              Form: {typeof beatsWho.formScore === 'number' ? beatsWho.formScore.toFixed(1) : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              Gap: {(typeof formScore === 'number' && typeof beatsWho.formScore === 'number') 
                ? `+${(formScore - beatsWho.formScore).toFixed(1)}` 
                : '—'}
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

function NearMissCard({ nearMiss, rank }: { nearMiss: NearMiss; rank: number }) {
  const isDropBanBlocked = nearMiss.blockedBy === "drop_ban"
  
  return (
    <article
      className={cn(
        "relative rounded-lg border bg-card p-4 shadow-sm sm:p-6",
        "opacity-75", // Dimmed to show it's not a true opportunity
        isDropBanBlocked 
          ? "border-orange-500/30 bg-orange-500/5" 
          : "border-muted-foreground/20"
      )}
      aria-label={`Near-miss ${rank}: ${nearMiss.playerName} - blocked by ${isDropBanBlocked ? 'protected player' : 'form gap'}`}
    >
      {/* Rank badge */}
      <div className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground opacity-50">
        {rank}
      </div>

      {/* Player header */}
      <div className="mb-3 pr-12">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">{nearMiss.playerName}</h2>
          <span className="rounded-sm bg-muted px-2 py-0.5 text-xs font-medium uppercase text-muted-foreground">
            Near-miss
          </span>
        </div>
      </div>

      {/* Blocked reason banner */}
      <div className={cn(
        "mb-4 rounded-md border p-3",
        isDropBanBlocked 
          ? "border-orange-500/50 bg-orange-500/10" 
          : "border-yellow-500/50 bg-yellow-500/10"
      )}>
        <div className="flex items-start gap-2">
          <span className="text-lg" aria-hidden>
            {isDropBanBlocked ? "🔒" : "📊"}
          </span>
          <div className="flex-1">
            <p className={cn(
              "text-sm font-semibold",
              isDropBanBlocked 
                ? "text-orange-700 dark:text-orange-300" 
                : "text-yellow-700 dark:text-yellow-300"
            )}>
              {isDropBanBlocked ? "Blocked: Protected Player" : "Blocked: Form Gap Too Small"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isDropBanBlocked 
                ? `Would require dropping ${nearMiss.dropCandidate || "a protected player"} (untouchable)`
                : `Form advantage (${typeof nearMiss.formGap === 'number' ? `+${nearMiss.formGap.toFixed(1)}` : '—'}) below minimum threshold`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Form gap display */}
      <div className="mb-4 rounded-md border border-border bg-muted/30 p-3">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Would Replace
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{nearMiss.dropCandidate || "Bench player"}</p>
            <p className="text-xs text-muted-foreground">Protected roster spot</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-muted-foreground">
              Form gap: {typeof nearMiss.formGap === 'number' ? `+${nearMiss.formGap.toFixed(1)}` : '—'}
            </p>
            {isDropBanBlocked && (
              <p className="text-xs font-bold text-orange-600 dark:text-orange-400">
                DROP BANNED
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Why blocked explanation */}
      <div className="text-sm text-muted-foreground">
        <p>
          {isDropBanBlocked 
            ? `${nearMiss.dropCandidate || "This player"} is on your protected list. Consider adjusting your drop bans if ${nearMiss.playerName} becomes essential.`
            : "Not enough of an upgrade to recommend. Check back after fixtures or if form changes significantly."
          }
        </p>
      </div>
    </article>
  )
}
