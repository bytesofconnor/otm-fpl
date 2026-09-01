// Description: League HQ — Over the Moon by default, optional other Fantrax league, this-week matchup first.
"use client"

import * as React from "react"
import type { FantraxLeagueSnapshot } from "@/lib/fantrax-shared"
import { OTM_LEAGUE_ID, parseLeagueId } from "@/lib/fantrax-shared"
import { LeagueWeek } from "@/components/league-week"
import { useLeagueStatus } from "@/components/league-status"
import { PageShell } from "@/components/page-shell"
import { ImageWithFallback } from "@/components/ui/image-with-fallback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"

const LEAGUE_KEY = "otm_fantrax_league_id"
const TEAM_KEY = "otm_fantrax_team_id"

function readStored(key: string): string {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(key) ?? ""
}

function tableLocked(snap: FantraxLeagueSnapshot): boolean {
  if (!snap.standings.length) return true
  return snap.standings.every((row) => row.rank === 1) && snap.standings.every((row) => /0[–-]0/.test(row.record))
}

/**
 * League HQ: this-week board first, table/wire and season below, optional other-league connect.
 */
export function LeagueHome(): React.ReactElement {
  const { setStatus } = useLeagueStatus()
  const [leagueInput, setLeagueInput] = React.useState("")
  const [leagueId, setLeagueId] = React.useState(OTM_LEAGUE_ID)
  const [teamId, setTeamId] = React.useState("")
  const [period, setPeriod] = React.useState<number | null>(null)
  const [data, setData] = React.useState<FantraxLeagueSnapshot | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [switching, setSwitching] = React.useState(false)
  const snap = data
  const custom = leagueId !== OTM_LEAGUE_ID

  React.useEffect(() => {
    const storedLeague = parseLeagueId(readStored(LEAGUE_KEY))
    const storedTeam = readStored(TEAM_KEY)
    setLeagueId(storedLeague || OTM_LEAGUE_ID)
    if (storedTeam) setTeamId(storedTeam)
  }, [])

  React.useEffect(() => {
    if (!leagueId) {
      setData(null)
      setStatus(null)
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams({ leagueId })
    if (teamId) qs.set("teamId", teamId)
    if (period) qs.set("period", String(period))
    fetch(`/api/fantrax/league?${qs}`, { signal: ctrl.signal })
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body?.message || "Could not load that league")
        const next = body as FantraxLeagueSnapshot
        setData(next)
        if (!teamId && next.teams.length >= 1) {
          const first = next.teams[0].id
          setTeamId(first)
          window.localStorage.setItem(TEAM_KEY, first)
        }
        setStatus({
          leagueName: next.leagueName,
          periodLabel: next.viewedPeriod ? `GW${next.viewedPeriod}` : "26/27",
          live: next.liveStarted,
        })
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === "AbortError") return
        setData(null)
        setError(err instanceof Error ? err.message : "Could not load that league")
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [leagueId, teamId, period, setStatus])

  function connect(event: React.FormEvent) {
    event.preventDefault()
    const id = parseLeagueId(leagueInput)
    if (!id) {
      setError("Paste a Fantrax league ID or league URL")
      return
    }
    window.localStorage.setItem(LEAGUE_KEY, id)
    setPeriod(null)
    setLeagueId(id)
    setError(null)
    setSwitching(false)
  }

  function useDefaultLeague() {
    window.localStorage.removeItem(LEAGUE_KEY)
    window.localStorage.removeItem(TEAM_KEY)
    setLeagueId(OTM_LEAGUE_ID)
    setTeamId("")
    setLeagueInput("")
    setPeriod(null)
    setError(null)
    setSwitching(false)
  }

  function chooseTeam(id: string) {
    setTeamId(id)
    window.localStorage.setItem(TEAM_KEY, id)
  }

  if (leagueId && !snap && (loading || !error)) {
    return (
      <PageShell className="space-y-4">
        <Skeleton className="h-12 w-full rounded-[var(--radius-panel)]" />
        <Skeleton className="h-[28rem] w-full rounded-[var(--radius-panel)]" />
      </PageShell>
    )
  }

  if (!snap) {
    return (
      <PageShell>
        <ConnectForm
          leagueInput={leagueInput}
          setLeagueInput={setLeagueInput}
          loading={loading}
          onConnect={connect}
          onReset={custom ? useDefaultLeague : undefined}
        />
        {error ? <p className="mt-4 text-[13px] text-danger" role="alert">{error}</p> : null}
      </PageShell>
    )
  }

  const locked = tableLocked(snap)
  const selectedTeam = snap.teams.find((t) => t.id === teamId)

  return (
    <PageShell>
      <div className="mb-6">
        {snap.teams.length > 0 && selectedTeam ? (
          <div className="rounded-lg border-2 border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="otm-kicker mb-1">Your team</div>
                <h2 className="otm-title truncate text-[1.25rem] leading-tight sm:text-[1.5rem]">{selectedTeam.name}</h2>
                {snap.teams.length > 1 ? (
                  <div>
                    <label htmlFor="team-select" className="sr-only">Change team</label>
                    <Select value={teamId} onValueChange={(id) => { if (typeof id === "string") chooseTeam(id) }}>
                      <SelectTrigger id="team-select" className="mt-3 h-11 w-full text-[14px] sm:text-[15px]">
                        <span className="truncate">Change team</span>
                      </SelectTrigger>
                      <SelectContent>
                        {snap.teams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
              {custom ? (
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={useDefaultLeague}>
                  Our league
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  aria-expanded={switching}
                  aria-controls="league-connect-form"
                  onClick={() => setSwitching((open) => !open)}
                >
                  {switching ? "Cancel" : "Switch"}
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {switching ? (
        <div id="league-connect-form">
          <ConnectForm
            leagueInput={leagueInput}
            setLeagueInput={setLeagueInput}
            loading={loading}
            onConnect={connect}
          />
        </div>
      ) : null}
      {error ? <p className="mb-3 text-[13px] text-danger" role="alert">{error}</p> : null}

      <LeagueWeek
        matchup={snap.matchup}
        slate={snap.slate}
        teamId={teamId}
        periodLabel={snap.periodLabel}
        period={snap.viewedPeriod ?? snap.currentPeriod ?? 1}
        periodCount={snap.periodCount}
        live={snap.liveStarted}
        onPeriod={setPeriod}
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-12">
        <Card size="flush" className="p-5 sm:p-6 lg:col-span-7" role="region" aria-labelledby="standings-heading">
          <h2 id="standings-heading" className="otm-kicker text-[13px]">{locked ? "The field" : "Table"}</h2>
          {locked ? (
            <ul className="mt-4 space-y-1">
              {snap.standings.map((row) => (
                <li
                  key={row.teamId}
                  className={`otm-row flex items-center gap-3 rounded-md px-2.5 py-3 text-[15px] ${row.you ? "bg-muted font-semibold text-foreground" : "text-foreground"}`}
                >
                  {row.logoUrl ? (
                    <img src={row.logoUrl} alt="" className="h-7 w-7 rounded-md object-cover ring-1 ring-border" />
                  ) : (
                    <span className="h-7 w-7 rounded-md border-2 border-border" aria-hidden="true" />
                  )}
                  <span className="truncate">{row.teamName}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ol className="mt-4 space-y-1">
              {snap.standings.map((row) => (
                <li
                  key={row.teamId}
                  className={`otm-row flex items-center justify-between gap-3 rounded-md px-2.5 py-3 text-[15px] ${
                    row.you ? "bg-muted font-semibold text-foreground" : "text-foreground"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-md font-mono text-[13px] font-bold ${
                        row.you ? "bg-foreground text-background" : "bg-muted text-foreground"
                      }`}
                      aria-label={`Rank ${row.rank}`}
                    >
                      {row.rank}
                    </span>
                    <span className="truncate">{row.teamName}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[14px] tabular-nums font-semibold">
                    {row.record}
                    {row.points !== "—" && row.points !== row.record ? <span className="ml-3 font-medium text-muted-foreground">{row.points}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card size="flush" className="p-5 sm:p-6 lg:col-span-5" role="region" aria-labelledby="waivers-heading">
          <h2 id="waivers-heading" className="otm-kicker text-[13px]">Waivers</h2>
          {snap.waivers.length ? (
            <ul className="mt-4 space-y-1">
              {snap.waivers.map((p) => (
                <li key={p.id} className="otm-row flex items-baseline justify-between gap-3 rounded-md px-2.5 py-3 text-[15px]">
                  <span className="truncate font-semibold text-foreground">{p.name}</span>
                  <span className="shrink-0 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{p.team}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[15px] font-medium text-muted-foreground">Nobody on waivers right now.</p>
          )}
        </Card>
      </div>

      <Card size="flush" className="mt-5" role="region" aria-labelledby="season-heading">
      <details>
        <summary id="season-heading" className="tap cursor-pointer px-5 py-4 text-[15px] font-semibold text-foreground">
          Season
          {snap.draftType ? ` · ${snap.draftType}` : ""}
          {snap.salaryCap ? ` · cap ${snap.salaryCap}` : ""}
        </summary>
        <div className="space-y-6 border-t-2 border-border px-5 py-5">
          {snap.scoringChips.length ? (
            <section aria-labelledby="scoring-heading">
              <h3 id="scoring-heading" className="otm-kicker text-[13px]">How it scores</h3>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[14px] font-medium text-muted-foreground">
                {snap.scoringChips.map((chip) => (
                  <span key={chip.code}>
                    {chip.code} <span className="font-bold text-foreground">{chip.value}</span>
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {snap.draftPicks.length ? (
            <section aria-labelledby="draft-heading">
              <h3 id="draft-heading" className="otm-kicker text-[13px]">Round 1</h3>
              <ol className="mt-3 space-y-1">
                {snap.draftPicks.map((pick) => (
                  <li key={pick.pick} className="flex items-baseline gap-3 border-b border-border py-2 text-[14px]">
                    <span className="w-6 font-mono text-[12px] font-bold text-muted-foreground" aria-label={`Pick ${pick.pick}`}>{pick.pick}</span>
                    <span className="min-w-0 truncate font-medium text-foreground">
                      {pick.playerName}
                      <span className="ml-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {pick.playerTeam} · {pick.teamName}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {snap.transactions.length ? (
            <section aria-labelledby="transactions-heading">
              <h3 id="transactions-heading" className="otm-kicker text-[13px]">Recent moves</h3>
              <ul className="mt-3 space-y-2">
                {snap.transactions.map((tx, i) => (
                  <li key={`${tx.id}-${i}`} className="flex items-baseline justify-between gap-3 text-[14px]">
                    <span className="min-w-0">
                      <span className="font-medium text-muted-foreground">{tx.kind === "claim" ? "Claimed" : "Dropped"}</span>{" "}
                      <span className="font-semibold text-foreground">{tx.playerName}</span>
                      <span className="ml-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{tx.playerTeam}</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-medium text-muted-foreground">{tx.teamName}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </details>
      </Card>
    </PageShell>
  )
}

function ConnectForm({
  leagueInput,
  setLeagueInput,
  loading,
  onConnect,
  onReset,
}: {
  leagueInput: string
  setLeagueInput: (value: string) => void
  loading: boolean
  onConnect: (event: React.FormEvent) => void
  onReset?: () => void
}): React.ReactElement {
  return (
    <Card size="flush" className="mb-3 p-3">
    <form onSubmit={onConnect} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label htmlFor="league-input" className="min-w-0 flex-1">
        <span className="otm-kicker">Another Fantrax league</span>
        <Input
          id="league-input"
          value={leagueInput}
          onChange={(e) => setLeagueInput(e.target.value)}
          placeholder="League ID or fantrax.com/fantasy/league/…"
          className="mt-1 h-11 text-[16px]"
          aria-describedby="league-input-hint"
        />
        <span id="league-input-hint" className="sr-only">
          Enter a Fantrax league ID or full league URL to connect to another league
        </span>
      </label>
      <div className="flex gap-2">
        <Button type="submit" className="h-11" disabled={loading}>
          {loading ? "Loading…" : "Connect"}
        </Button>
        {onReset ? (
          <Button type="button" variant="outline" className="h-11" onClick={onReset}>
            Our league
          </Button>
        ) : null}
      </div>
    </form>
    </Card>
  )
}
