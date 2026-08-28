// Description: Lists predicted GW1 lineups (YES flags) grouped by team using annotated app_bundle.json.
"use client"

import * as React from 'react'
import type { AppBundle, AppPlayer } from '@/lib/types'
import { getBundle } from '@/lib/bundle-store'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PageShell } from '@/components/page-shell'

const POS_ORDER: Record<string, number> = { GKP: 0, DEF: 1, MID: 2, FWD: 3 }

export default function PredictedPage() {
  const [bundle, setBundle] = React.useState<AppBundle | null>(null)
  const [selectedTeams, setSelectedTeams] = React.useState<string[]>([])
  React.useEffect(() => { getBundle().then(setBundle).catch(console.error) }, [])

  const grouped = React.useMemo(() => {
    const map = new Map<number, AppPlayer[]>()
    if (!bundle) return map
    for (const p of bundle.players) {
      if (p.predictedGW1 === true) {
        const arr = map.get(p.team.id) ?? []
        arr.push(p)
        map.set(p.team.id, arr)
      }
    }
    return map
  }, [bundle])

  const allTeams = React.useMemo(() => {
    const s = new Set<string>()
    bundle?.players.forEach((p) => s.add(p.team.shortName))
    return Array.from(s).sort()
  }, [bundle])

  const selected = new Set(selectedTeams)

  const teams = React.useMemo(() => Array.from(grouped.entries())
    .map(([teamId, players]) => ({ teamId, teamName: players[0]?.team.name ?? String(teamId), players }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName))
    .filter((t) => {
      if (selected.size === 0) return true
      const code = t.players[0]?.team.shortName
      return code ? selected.has(code) : true
    }), [grouped, selectedTeams])

  return (
    <PageShell>
      {!bundle ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : null}
      <div className="mb-6">
        <h1 className="otm-title text-2xl">Lineups</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Predicted XIs for the current gameweek.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ToggleGroup
            multiple
            value={selectedTeams}
            onValueChange={(next) => setSelectedTeams(Array.isArray(next) ? next : [])}
            variant="outline"
            size="sm"
            className="flex-wrap"
          >
            {allTeams.map((code) => (
              <ToggleGroupItem key={code} value={code}>
                {code}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {selectedTeams.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setSelectedTeams([])}>Clear</Button>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {teams.map(({ teamId, teamName, players }) => {
          const ordered = players
            .slice()
            .sort((a, b) => (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9) || a.name.localeCompare(b.name))
            .slice(0, 11)
          return (
            <Card key={teamId} size="flush" className="p-4">
              <div className="mb-3 otm-title text-lg">
                {teamName}{" "}
                <span className="text-[12px] font-normal tracking-normal text-muted-foreground">({ordered.length} of 11)</span>
              </div>
              <ol className="space-y-2">
                {ordered.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 border-b border-border pb-2 text-sm last:border-b-0">
                    <ImageWithFallback src={p.images.avatar ?? undefined} alt="" className="h-5 w-5 rounded-full" />
                    <span>{p.name}</span>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{p.position}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )
        })}
      </div>
    </PageShell>
  )
}
