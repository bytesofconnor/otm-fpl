// Description: League HQ — Over the Moon by default, optional other Fantrax league, this-week matchup first.
"use client"

import * as React from "react"
import type { FantraxLeagueSnapshot } from "@/lib/fantrax-shared"
import { OTM_LEAGUE_ID, parseLeagueId, teamCode } from "@/lib/fantrax-shared"
import { persistMembership, rememberSquad, useConnectedLeague } from "@/lib/league-session"
import { LeagueWeek } from "@/components/league-week"
import { useLeagueStatus } from "@/components/league-status"
import { PageShell } from "@/components/page-shell"
import { ImageWithFallback } from "@/components/ui/image-with-fallback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OtmLoader } from "@/components/otm-loader"
import { Card } from "@/components/ui/card"

function tableLocked(snap: FantraxLeagueSnapshot): boolean {
  if (!snap.standings.length) return true
  return snap.standings.every((row) => row.rank === 1) && snap.standings.every((row) => /0[–-]0/.test(row.record))
}

/**
 * League HQ: this-week board first, table/wire and season below, optional other-league connect.
 */
export function LeagueHome(): React.ReactElement {
  const { setStatus } = useLeagueStatus()
  const membership = useConnectedLeague()
  const bootstrapped = React.useRef(false)
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
    if (!membership.ready || bootstrapped.current) return
    bootstrapped.current = true
    setLeagueId(membership.leagueId)
    if (membership.storedTeamId) setTeamId(membership.storedTeamId)
  }, [membership.ready, membership.leagueId, membership.storedTeamId])

  React.useEffect(() => {
    if (!membership.ready) return
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
        if (!teamId && next.teams.length === 1) {
          const only = next.teams[0]
          setTeamId(only.id)
          persistMembership(leagueId, only.id, only.name, only.shortName)
        } else if (teamId) {
          const named = next.teams.find((t) => t.id === teamId)
          if (named?.name) rememberSquad(named.name, named.shortName)
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
  }, [membership.ready, leagueId, teamId, period, setStatus])

  function connect(event: React.FormEvent) {
    event.preventDefault()
    const id = parseLeagueId(leagueInput)
    if (!id) {
      setError("Paste a Fantrax league ID or league URL")
      return
    }
    persistMembership(id, "")
    setTeamId("")
    setPeriod(null)
    setLeagueId(id)
    setError(null)
    setSwitching(false)
  }

  function useDefaultLeague() {
    persistMembership(OTM_LEAGUE_ID, "")
    setLeagueId(OTM_LEAGUE_ID)
    setTeamId("")
    setLeagueInput("")
    setPeriod(null)
    setError(null)
    setSwitching(false)
  }

  function chooseTeam(id: string) {
    const named = snap?.teams.find((t) => t.id === id)
    setTeamId(id)
    persistMembership(leagueId, id, named?.name ?? "", named?.shortName)
  }

  if (!membership.ready || (leagueId && !snap && (loading || !error))) {
    return (
      <PageShell>
        <OtmLoader label="This week" hint="Pulling the slate from Fantrax" />
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
        {error ? <p className="mt-4 text-[13px] text-danger">{error}</p> : null}
      </PageShell>
    )
  }

  const locked = tableLocked(snap)
  const needsSquad = !teamId && snap.teams.length > 1

  if (needsSquad) {
    return (
      <PageShell width="article">
        <p className="otm-kicker">{custom ? snap.leagueName : "Over the Moon"}</p>
        <h1 className="otm-title mt-2 text-3xl">Who do you manage?</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">
          This week opens after you pick. Form and Scout follow.
        </p>
        <ul className="mt-8 space-y-2">
          {snap.teams.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => chooseTeam(t.id)}
                className="tap flex w-full items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-left hover:border-foreground/40"
              >
                <span className="min-w-0 font-semibold">{teamCode(t.name, t.shortName)}</span>
                {t.owner ? <span className="shrink-0 text-[12px] text-muted-foreground">{t.owner}</span> : null}
              </button>
            </li>
          ))}
        </ul>
        {custom ? (
          <button type="button" className="tap mt-8 text-[11px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground" onClick={useDefaultLeague}>
            Back to Over the Moon
          </button>
        ) : (
          <button
            type="button"
            className="tap mt-8 text-[11px] text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
            onClick={() => setSwitching((open) => !open)}
          >
            {switching ? "Cancel" : "Not Over the Moon?"}
          </button>
        )}
        {switching ? (
          <div className="mt-4">
            <ConnectForm
              leagueInput={leagueInput}
              setLeagueInput={setLeagueInput}
              loading={loading}
              onConnect={connect}
            />
          </div>
        ) : null}
        {error ? <p className="mt-4 text-[13px] text-danger">{error}</p> : null}
      </PageShell>
    )
  }

  return (
    <PageShell>
      {error ? <p className="mb-3 text-[13px] text-danger">{error}</p> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <LeagueWeek
          matchup={snap.matchup}
          slate={snap.slate}
          teamId={teamId}
          periodLabel={snap.periodLabel}
          period={snap.viewedPeriod ?? snap.currentPeriod ?? 1}
          periodCount={snap.periodCount}
          live={snap.liveStarted}
          isCurrentWeek={(snap.viewedPeriod ?? snap.currentPeriod) === snap.currentPeriod}
          onPeriod={setPeriod}
          loading={loading}
        />

        <div>
        <Card size="flush" className="p-5 sm:p-6">
          <h2 className="otm-kicker">{locked ? "The field" : "Table"}</h2>
          {locked ? (
            <ul className="mt-3">
              {snap.standings.map((row) => (
                <li
                  key={row.teamId}
                  className={`otm-row flex items-center gap-3 rounded-md px-1.5 py-2.5 text-[14px] ${row.you ? "bg-muted text-foreground" : "text-muted-foreground"}`}
                >
                  {row.logoUrl ? (
                    <ImageWithFallback src={row.logoUrl} alt="" className="h-6 w-6 rounded-md object-cover ring-1 ring-border" fallback="/favicon.svg" />
                  ) : (
                    <span className="h-6 w-6 rounded-md border border-border" />
                  )}
                  <span className={`min-w-0 whitespace-normal break-words ${row.you ? "font-medium text-foreground" : ""}`}>{row.teamName}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ol className="mt-3">
              {snap.standings.map((row) => (
                <li
                  key={row.teamId}
                  className={`otm-row flex items-center justify-between gap-3 rounded-md px-1.5 py-2.5 text-[14px] ${
                    row.you ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[11px] ${
                        row.you ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {row.rank}
                    </span>
                    <span className={`min-w-0 whitespace-normal break-words ${row.you ? "font-medium text-foreground" : ""}`}>
                      {teamCode(row.teamName, snap.teams.find((t) => t.id === row.teamId)?.shortName)}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[12px] tabular-nums">
                    {row.record}
                    {row.points !== "—" && row.points !== row.record ? <span className="ml-3 text-muted-foreground">{row.points}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
          <button
            type="button"
            className="tap underline decoration-border underline-offset-4 hover:text-foreground"
            onClick={() => {
              persistMembership(leagueId, "")
              setTeamId("")
            }}
          >
            Switch squad
          </button>
          {custom ? (
            <button type="button" className="tap underline decoration-border underline-offset-4 hover:text-foreground" onClick={useDefaultLeague}>
              Back to Over the Moon
            </button>
          ) : (
            <button
              type="button"
              className="tap underline decoration-border underline-offset-4 hover:text-foreground"
              aria-expanded={switching}
              onClick={() => setSwitching((open) => !open)}
            >
              {switching ? "Cancel" : "Not this league?"}
            </button>
          )}
        </p>
        {switching ? (
          <div className="mt-4">
            <ConnectForm
              leagueInput={leagueInput}
              setLeagueInput={setLeagueInput}
              loading={loading}
              onConnect={connect}
            />
          </div>
        ) : null}

        <Card size="flush" className="mt-6 p-5 sm:p-6">
          <h2 className="otm-kicker">Waivers</h2>
          {snap.waivers.length ? (
            <ul className="mt-3">
              {snap.waivers.map((p) => (
                <li key={p.id} className="otm-row flex items-baseline justify-between gap-3 rounded-md px-1.5 py-2.5 text-[14px]">
                  <span className="min-w-0 whitespace-normal break-words text-foreground">{p.name}</span>
                  <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">{p.team}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[14px] text-muted-foreground">Nobody on waivers right now.</p>
          )}
        </Card>
        </div>
      </div>

      <Card size="flush" className="mt-4">
      <details>
        <summary className="tap cursor-pointer px-5 py-3 text-[14px] text-muted-foreground">
          Season
          {snap.draftType ? ` · ${snap.draftType}` : ""}
          {snap.salaryCap ? ` · cap ${snap.salaryCap}` : ""}
        </summary>
        <div className="space-y-6 border-t border-border px-5 py-5">
          {snap.scoringChips.length ? (
            <div>
              <h3 className="otm-kicker">How it scores</h3>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[13px]">
                {snap.scoringChips.map((chip) => (
                  <span key={chip.code}>
                    {chip.code} <span className="text-foreground">{chip.value}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {snap.draftPicks.length ? (
            <div>
              <h3 className="otm-kicker">Round 1</h3>
              <ol className="mt-2">
                {snap.draftPicks.map((pick) => (
                  <li key={pick.pick} className="flex items-baseline gap-3 border-b border-border py-1.5 text-[13px]">
                    <span className="w-5 shrink-0 font-mono text-[11px] text-muted-foreground">{pick.pick}</span>
                    <span className="min-w-0 whitespace-normal break-words">
                      {pick.playerName}
                      <span className="ml-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                        {pick.playerTeam} · {pick.teamName}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {snap.transactions.length ? (
            <div>
              <h3 className="otm-kicker">Recent moves</h3>
              <ul className="mt-2 space-y-2">
                {snap.transactions.map((tx, i) => (
                  <li key={`${tx.id}-${i}`} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span>
                      <span className="text-muted-foreground">{tx.kind === "claim" ? "Claimed" : "Dropped"}</span> {tx.playerName}
                      <span className="ml-2 text-[11px] uppercase tracking-wider text-muted-foreground">{tx.playerTeam}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-muted-foreground">{tx.teamName}</span>
                  </li>
                ))}
              </ul>
            </div>
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
        />
      </label>
      <div className="flex gap-2">
        <Button type="submit" className="h-11">
          {loading ? "Loading…" : "Connect"}
        </Button>
        {onReset ? (
          <Button type="button" variant="outline" className="h-11" onClick={onReset}>
            Back to Over the Moon
          </Button>
        ) : null}
      </div>
    </form>
    </Card>
  )
}
