// Description: Draft compare UI – show two players, one-click to prefer, update cookie-based ranking.
"use client"

import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
// removed button usage for card click selection
import { ImageWithFallback } from '@/components/ui/image-with-fallback'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PageShell } from '@/components/page-shell'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormationMini } from '@/components/ui/formation-mini'
import type { AppBundle, AppPlayer } from '@/lib/types'
import { getBundle } from '@/lib/bundle-store'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import LZString from 'lz-string'

function readBundleFromWindow(): AppBundle | null {
  // The page will fetch the JSON via fetch() on mount; SSR reads are not allowed in client.
  return null
}

// Shared cached bundle loader lives in bundle-store

function useCookie(name: string) {
  const [value, setValue] = useState<string | null>(null)
  useEffect(() => {
    const cookies = document.cookie.split(';').map((c) => c.trim())
    const entry = cookies.find((c) => c.startsWith(`${encodeURIComponent(name)}=`))
    setValue(entry ? decodeURIComponent(entry.split('=')[1]) : null)
  }, [name])
  const write = React.useCallback((val: string) => {
    const d = new Date()
    d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000)
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(val)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`
    setValue(val)
  }, [name])
  return [value, write] as const
}

type RankingState = { order: number[] }

function parseRanking(json: string | null): RankingState {
  try { return json ? JSON.parse(json) as RankingState : { order: [] } } catch { return { order: [] } }
}

function computeQualityScore(player: AppPlayer): number {
  // Lower is better. Prefer Fantrax overall rank, then Draft Society rank, then last season points proxy.
  let score = Number.POSITIVE_INFINITY
  if (player.fantraxProjection?.overallRank != null) {
    score = Math.min(score, player.fantraxProjection.overallRank)
  }
  if (typeof player.draftSocietyTop50Rank === 'number') {
    score = Math.min(score, 50 + player.draftSocietyTop50Rank)
  }
  if (player.lastSeason?.totalPoints != null) {
    // Convert points (higher is better) into a rough rankish score in the ~100-500 range
    const bounded = Math.min(400, Math.max(0, player.lastSeason.totalPoints))
    score = Math.min(score, 500 - bounded)
  }
  return score
}

function pickPairSmart(
  players: AppPlayer[],
  ranking: RankingState,
  lastPair?: [number, number],
  topLimit: number = 120,
  focusStartIndex?: number | null
): [AppPlayer, AppPlayer] | null {
  if (players.length < 2) return null
  const byId = new Map<number, AppPlayer>()
  for (const p of players) byId.set(p.id, p)

  // 1) Focus on the top candidates by composite quality
  const sorted = players
    .map((p) => ({ p, q: computeQualityScore(p) }))
    .sort((a, b) => a.q - b.q)
    .slice(0, Math.min(topLimit, players.length))
    .map((x) => x.p)

  if (sorted.length < 2) return null

  const idToIndex = new Map<number, number>()
  sorted.forEach((p, i) => idToIndex.set(p.id, i))

  // Helper to filter a subset window (optionally current draft round focus)
  const inFocusWindow = (p: AppPlayer): boolean => {
    if (focusStartIndex == null) return true
    const idx = idToIndex.get(p.id)!
    return idx >= focusStartIndex && idx < focusStartIndex + 12
  }

  const focusSubset = sorted.filter(inFocusWindow)

  // 2) Try to refine adjacent items that the user already has in their ranking within the focus window
  const rankedInWindow = ranking.order.filter((id) => idToIndex.has(id))
  const chooseAdjacent = (candidates: AppPlayer[]): [AppPlayer, AppPlayer] | null => {
    const candidateIds = new Set(candidates.map((p) => p.id))
    const rankedSeq = rankedInWindow.filter((id) => candidateIds.has(id))
    if (rankedSeq.length < 2) return null
    // pick a random adjacent pair
    for (let tries = 0; tries < 20; tries++) {
      const i = Math.floor(Math.random() * (rankedSeq.length - 1))
      const aId = rankedSeq[i]
      const bId = rankedSeq[i + 1]
      if (aId === bId) continue
      if (lastPair && ((aId === lastPair[0] && bId === lastPair[1]) || (aId === lastPair[1] && bId === lastPair[0]))) continue
      const a = byId.get(aId)!
      const b = byId.get(bId)!
      return [a, b]
    }
    return null
  }

  // First try adjacent within focus round, then anywhere within top window
  let adjacent = focusSubset.length >= 2 ? chooseAdjacent(focusSubset) : null
  if (!adjacent) adjacent = chooseAdjacent(sorted)
  if (adjacent) return adjacent

  // 3) Mix one ranked with one unranked of similar quality to place newcomers
  const rankedSet = new Set(ranking.order)
  const unranked = sorted.filter((p) => !rankedSet.has(p.id))
  if (rankedInWindow.length >= 1 && unranked.length >= 1) {
    for (let tries = 0; tries < 30; tries++) {
      // Prefer a ranked id from the focus window if present
      const rankedPool = focusSubset.length ? focusSubset.filter((p) => rankedSet.has(p.id)) : sorted.filter((p) => rankedSet.has(p.id))
      const rId = (rankedPool.length ? rankedPool : sorted.filter((p) => rankedSet.has(p.id)))[Math.floor(Math.random() * (rankedPool.length ? rankedPool.length : rankedInWindow.length))]?.id ?? rankedInWindow[Math.floor(Math.random() * rankedInWindow.length)]
      const rIdx = idToIndex.get(rId)!
      // pick an unranked near the ranked player's index (within a small window)
      const window = 6
      const lo = Math.max(0, rIdx - window)
      const hi = Math.min(sorted.length - 1, rIdx + window)
      const unrankedPool = (focusSubset.length ? unranked.filter((p) => focusSubset.some((fp) => fp.id === p.id)) : unranked)
      const candidates = unrankedPool.filter((p) => {
        const idx = idToIndex.get(p.id)!
        return idx >= lo && idx <= hi
      })
      const other = (candidates.length ? candidates : unrankedPool)[Math.floor(Math.random() * (candidates.length ? candidates.length : unrankedPool.length))]
      const aId = rId
      const bId = other.id
      if (aId === bId) continue
      if (lastPair && ((aId === lastPair[0] && bId === lastPair[1]) || (aId === lastPair[1] && bId === lastPair[0]))) continue
      return [byId.get(aId)!, byId.get(bId)!]
    }
  }

  // 4) Fallback: pick two random from the top window, avoiding repeats
  const fallbackPool = focusSubset.length >= 2 ? focusSubset : sorted
  for (let tries = 0; tries < 30; tries++) {
    const a = fallbackPool[Math.floor(Math.random() * fallbackPool.length)]
    const b = fallbackPool[Math.floor(Math.random() * fallbackPool.length)]
    if (a.id === b.id) continue
    if (lastPair && ((a.id === lastPair[0] && b.id === lastPair[1]) || (a.id === lastPair[1] && b.id === lastPair[0]))) continue
    return [a, b]
  }
  // Final fallback
  return [fallbackPool[0], fallbackPool[1]]
}

function updateRanking(current: number[], winner: number, loser: number): number[] {
  // Simple rule: ensure winner appears before loser; if absent, insert near top/bottom
  const arr = current.slice()
  const wi = arr.indexOf(winner)
  const li = arr.indexOf(loser)
  if (wi === -1 && li === -1) {
    arr.unshift(winner)
    arr.push(loser)
    return arr
  }
  if (wi === -1) {
    const pos = Math.max(0, li - 1)
    arr.splice(pos, 0, winner)
    return arr
  }
  if (li === -1) {
    arr.push(loser)
    return arr
  }
  if (wi > li) {
    arr.splice(wi, 1)
    const newLi = arr.indexOf(loser)
    arr.splice(newLi, 0, winner)
  }
  return arr
}

function TeamChip({ code }: { code: string }) {
  return (
    <Badge variant="outline" className="uppercase tracking-[0.14em]" title={code}>
      {code}
    </Badge>
  )
}

function PlayerHeader({ p }: { p: AppPlayer }) {
  // Compact avatar header; full-card background image is handled by the card container
  const src = p.images.avatar ?? p.images.card ?? undefined
  return (
    <div className="relative h-12 w-12">
      <ImageWithFallback src={src} alt="" className="h-12 w-12 rounded-full object-cover" />
    </div>
  )
}

export default function ComparePage() {
  const router = useRouter()
  const [bundle, setBundle] = useState<AppBundle | null>(readBundleFromWindow())
  const [rankCookie, setRankCookie] = useCookie('otm_ranking')
  const ranking = useMemo(() => parseRanking(rankCookie), [rankCookie])
  const [pair, setPair] = useState<[AppPlayer, AppPlayer] | null>(null)
  const roundCursorRef = useRef(0) // cycles 0..9 focusing each draft round window
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set())
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set())
  const [choosingId, setChoosingId] = useState<number | null>(null)
  const [mobileVideoOpenId, setMobileVideoOpenId] = useState<number | null>(null)
  const [mobileVideoById, setMobileVideoById] = useState<Record<number, string>>({})

  useEffect(() => {
    getBundle().then(setBundle).catch(console.error)
  }, [])
  // Warm rankings route so top-right button is instant
  useEffect(() => {
    try { router.prefetch('/rankings'); router.prefetch('/') } catch {}
  }, [router])

  // Inbound share link handling (hash r=...) – offer to replace or merge
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    const m = hash.match(/[#&]r=([^&]+)/)
    if (!m) return
    try {
      const json = LZString.decompressFromEncodedURIComponent(m[1])
      const parsed = JSON.parse(json || '{}') as { order?: number[] }
      if (!Array.isArray(parsed.order)) return
      const incoming = parsed.order as number[]
      const current = ranking.order
      if (incoming.length === 0) return
      const proceed = confirm('Import shared ranking?\n\nOK = Replace mine\nCancel = Merge')
      if (proceed) {
        setRankCookie(JSON.stringify({ order: incoming }))
      } else {
        const set = new Set<number>()
        const merged: number[] = []
        for (const id of incoming) { if (!set.has(id)) { set.add(id); merged.push(id) } }
        for (const id of current) { if (!set.has(id)) { set.add(id); merged.push(id) } }
        setRankCookie(JSON.stringify({ order: merged }))
      }
      // cleanup hash so it doesn't re-trigger
      history.replaceState(null, '', window.location.pathname)
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyFilters = React.useCallback((players: AppPlayer[]): AppPlayer[] => {
    const hasPos = selectedPositions.size > 0
    const hasTeam = selectedTeams.size > 0
    if (!hasPos && !hasTeam) return players
    return players.filter((p) => {
      const posOk = !hasPos || selectedPositions.has(p.position)
      const teamOk = !hasTeam || selectedTeams.has(p.team.shortName)
      return posOk && teamOk
    })
  }, [selectedPositions, selectedTeams])

  useEffect(() => {
    if (!bundle) return
    const focusStart = roundCursorRef.current * 12
    const pool = applyFilters(bundle.players)
    setPair((prev) =>
      pickPairSmart(pool, ranking, prev ? [prev[0].id, prev[1].id] : undefined, 120, focusStart)
    )
  }, [bundle, ranking, selectedPositions, selectedTeams, applyFilters])

  // Formation + slot helpers (must be before any early return)
  const teamIdToPredicted = React.useMemo(() => {
    const map = new Map<number, AppPlayer[]>()
    if (bundle) {
      for (const pl of bundle.players) {
        if (pl.predictedGW1 === true) {
          const arr = map.get(pl.team.id) ?? []
          arr.push(pl)
          map.set(pl.team.id, arr)
        }
      }
    }
    return map
  }, [bundle])

  function getFormationString(teamId: number): string | null {
    const list = teamIdToPredicted.get(teamId)
    if (!list || list.length === 0) return null
    const counts: Record<string, number> = { GKP: 0, DEF: 0, MID: 0, FWD: 0 }
    for (const pl of list) counts[pl.position] = (counts[pl.position] ?? 0) + 1
    // Show formation even if GK not identified
    return `${counts.DEF}-${counts.MID}-${counts.FWD}`
  }

  function getRowSlot(p: AppPlayer): string | null {
    const list = teamIdToPredicted.get(p.team.id)
    if (!list) return null
    const row = list.filter((x) => x.position === p.position).sort((a, b) => a.name.localeCompare(b.name))
    const idx = row.findIndex((x) => x.id === p.id)
    if (idx === -1) return null
    return `${p.position} ${idx + 1}/${row.length}`
  }

  const onPick = (winner: AppPlayer, loser: AppPlayer) => {
    const nextOrder = updateRanking(ranking.order, winner.id, loser.id)
    setRankCookie(JSON.stringify({ order: nextOrder }))
    // advance pair
    if (bundle) {
      // rotate focus round to ensure coverage across first 10 rounds
      roundCursorRef.current = (roundCursorRef.current + 1) % 10
      const focusStart = roundCursorRef.current * 12
      const pool = applyFilters(bundle.players)
      setPair(pickPairSmart(pool, { order: nextOrder }, [winner.id, loser.id], 120, focusStart))
    }
  }

  const handleSelect = (winner: AppPlayer, loser: AppPlayer) => {
    // longer, more expressive animation before advancing
    setChoosingId(winner.id)
    setTimeout(() => {
      onPick(winner, loser)
      setChoosingId(null)
    }, 700)
  }

  // Build options (must be declared before any early return to satisfy hooks rules)
  const allPositions = useMemo(() => {
    const s = new Set<string>()
    bundle?.players.forEach((p) => s.add(p.position))
    return Array.from(s)
  }, [bundle])
  const allTeams = useMemo(() => {
    const s = new Set<string>()
    bundle?.players.forEach((p) => s.add(p.team.shortName))
    return Array.from(s).sort()
  }, [bundle])

  // reuse team colors from compare page for chips
  const TEAM_COLORS: Record<string, string> = {
    ARS: '#EF0107',
    MUN: '#DA020E',
    CHE: '#034694',
    LIV: '#C8102E',
    MCI: '#6CABDD',
    NEW: '#241F20',
    CRY: '#1B458F',
    AVL: '#670E36',
    BOU: '#DA291C',
    BRE: '#E30613',
    WHU: '#7A263A',
    BHA: '#0057B8',
    EVE: '#003399',
    NFO: '#DD0000',
    TOT: '#132257',
    FUL: '#000000',
    WOL: '#FDB913',
    LEE: '#FFCD00',
    BRN: '#6C1D45',
    SUN: '#E2231A',
  }

  if (!bundle || !pair) return <PageShell><p className="text-muted-foreground">Loading…</p></PageShell>

  const [a, b] = pair

  const toggleSet = (prev: Set<string>, key: string): Set<string> => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  }

  const clearFilters = () => { setSelectedPositions(new Set()); setSelectedTeams(new Set()) }

  function FilterChip({
    label,
    active,
    onClick,
    color,
  }: { label: string; active: boolean; onClick: () => void; color?: string }) {
    const activeStyles: React.CSSProperties | undefined = color
      ? { backgroundColor: `${color}33`, borderColor: color, color }
      : undefined
    return (
      <Button
        type="button"
        variant={active ? "default" : "outline"}
        size="sm"
        onClick={onClick}
        aria-pressed={active}
        className="uppercase tracking-[0.12em]"
        style={active ? activeStyles : undefined}
      >
        {label}
      </Button>
    )
  }

  function MobileHighlightThumb({ p }: { p: AppPlayer }) {
    const [vid, setVid] = React.useState<string | null>(p.highlight?.videoId ?? mobileVideoById[p.id] ?? null)
    React.useEffect(() => {
      if (vid) return
      const query = `${p.name} ${p.team.name} highlights`
      fetch(`/api/highlights?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.videoId) {
            setVid(d.videoId)
            setMobileVideoById((prev) => ({ ...prev, [p.id]: d.videoId }))
          }
        })
        .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [p.id])
    if (!vid) return null
    return (
      <Button
        type="button"
        variant="outline"
        onClick={(e) => { e.stopPropagation(); setMobileVideoOpenId(mobileVideoOpenId === p.id ? null : p.id) }}
        className="absolute right-3 top-3 z-30 h-auto overflow-hidden p-0 md:hidden"
        aria-label="Play highlights"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`} alt="" className="h-14 w-20 object-cover" />
      </Button>
    )
  }


  return (
    <PageShell>
      <div className="mb-4 flex items-end justify-between gap-2 relative z-30">
        <div>
          <h1 className="otm-title text-2xl">Compare</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">A tool for the wire and the board — not the whole product.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="md:hidden h-8 px-3" variant="ghost" onClick={() => setFiltersOpen(true)}>Filter</Button>
        </div>
      </div>
      {/* Desktop filters row (full width, larger chips, not under nav) */}
      <div className="hidden md:flex items-center gap-3 mt-3 relative z-20">
        <ToggleGroup
          multiple
          value={Array.from(selectedPositions)}
          onValueChange={(next) => setSelectedPositions(new Set(Array.isArray(next) ? next : []))}
          variant="outline"
          size="sm"
        >
          {allPositions.map((pos) => (
            <ToggleGroupItem key={pos} value={pos} className="uppercase tracking-[0.12em]">
              {pos}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div
          className="flex items-center gap-2 overflow-x-auto scrollbar-thin pr-24 whitespace-nowrap flex-1 py-1"
          style={{ overscrollBehaviorX: 'contain', WebkitOverflowScrolling: 'touch' }}
        >
          {allTeams.map((t) => (
            <FilterChip
              key={t}
              label={t}
              active={selectedTeams.has(t)}
              onClick={() => setSelectedTeams((s) => toggleSet(s, t))}
              color={TEAM_COLORS[t] ?? '#22d3ee'}
            />
          ))}
        </div>
        {(selectedPositions.size || selectedTeams.size) ? (
          <Button variant="ghost" size="sm" className="shrink-0" onClick={clearFilters}>Clear</Button>
        ) : null}
      </div>
      <p className="mb-6 text-[13px] text-muted-foreground">
        Rankings stay on this device. Share/Sync from Rankings if you need them elsewhere.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {[a, b].map((p) => (
          <motion.div
            key={p.id}
            role="button"
            onClick={() => handleSelect(p, p.id === a.id ? b : a)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.995 }}
            animate={choosingId == null
              ? { opacity: 1 }
              : (choosingId === p.id
                ? { opacity: 1 }
                : { opacity: 0.35 })}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="h-full"
          >
            <Card
              size="flush"
              className={`group relative h-full min-h-[280px] cursor-pointer p-5 md:min-h-[380px] ${
                choosingId === p.id ? "border-gold" : "hover:border-gold"
              }`}
            >
            <div className="relative z-10 flex items-center gap-3 mb-5">
              <PlayerHeader p={p} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="otm-title text-2xl truncate">{p.name}</span>
                  {typeof p.draftSocietyTop50Rank === 'number' ? (
                    <span className="font-mono text-[12px] text-gold" title={`Draft Society #${p.draftSocietyTop50Rank}`}>
                      #{p.draftSocietyTop50Rank}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground flex items-center gap-2">
                  <TeamChip code={p.team.shortName} />
                  <span>{p.position}</span>
                  <span>£{p.price.toFixed(1)}m</span>
                </div>
                {p.fantraxProjection ? (
                  <div className="mt-2 font-mono text-[11px] text-gold md:hidden">
                    #{p.fantraxProjection.overallRank} · PP/90 {p.fantraxProjection.pp90.toFixed(2)}
                  </div>
                ) : null}
              </div>
            </div>
            <MobileHighlightThumb p={p} />
            <div className="grid grid-cols-4 gap-px border border-border bg-border text-center hidden md:grid">
              <Stat label="Pts" value={p.lastSeason ? p.lastSeason.totalPoints : p.stats.points} />
              <Stat label="G" value={p.lastSeason ? p.lastSeason.goals : p.stats.goals} />
              <Stat label="A" value={p.lastSeason ? p.lastSeason.assists : p.stats.assists} />
              <Stat label="CS" value={p.lastSeason ? p.lastSeason.cleanSheets : p.stats.cleanSheets} />
            </div>
            {(() => {
              const pts = p.lastSeason ? p.lastSeason.totalPoints : p.stats.points
              const g = p.lastSeason ? p.lastSeason.goals : p.stats.goals
              const aVal = p.lastSeason ? p.lastSeason.assists : p.stats.assists
              const cs = p.lastSeason ? p.lastSeason.cleanSheets : p.stats.cleanSheets
              return (
                <div className="mt-3 grid grid-cols-4 gap-px border border-border bg-border md:hidden">
                  <Stat label="Pts" value={pts} />
                  <Stat label="G" value={g} />
                  <Stat label="A" value={aVal} />
                  <Stat label="CS" value={cs} />
                </div>
              )
            })()}
            {p.fantraxProjection ? (
              <div className="mt-4 hidden md:block font-mono text-[12px] text-muted-foreground">
                Fantrax #{p.fantraxProjection.overallRank}
                <span className="mx-2 text-muted-foreground">/</span>
                Pos #{p.fantraxProjection.posRank}
                <span className="mx-2 text-muted-foreground">/</span>
                {p.fantraxProjection.points.toFixed(0)} pts
                <span className="mx-2 text-muted-foreground">/</span>
                {p.fantraxProjection.pp90.toFixed(2)} pp90
              </div>
            ) : null}
            <div className="mt-3 text-[12px] text-muted-foreground hidden md:block">
              {p.lastSeason ? (
                <>Last season {p.lastSeason.season}: {p.lastSeason.totalPoints} pts, {p.lastSeason.goals} G, {p.lastSeason.assists} A</>
              ) : (
                <>No prior season data</>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
              {p.predictedGW1 === true ? (
                <Badge variant="live">Predicted starter</Badge>
              ) : p.predictedGW1 === false ? (
                <span>Not in predicted XI</span>
              ) : (
                <span>XI status unknown</span>
              )}
              {p.gw1InjuryTag ? <span className="ml-2 uppercase tracking-wider">{p.gw1InjuryTag}</span> : null}
              {(() => {
                const form = getFormationString(p.team.id)
                const slot = getRowSlot(p)
                if (!form && !slot) return null
                return <span className="ml-2">{form ? form : ''}{form && slot ? ' · ' : ''}{slot ?? ''}</span>
              })()}
            </div>
            {p.predictedGW1 === true ? (
              <div className="mt-3">
                {(() => {
                  const form = getFormationString(p.team.id)
                  const role = getRowSlot(p)
                  if (!form || !role) return null
                  return <FormationMini formation={form} playerPosition={p.position as 'GKP'|'DEF'|'MID'|'FWD'} role={role} aspectRatio="5 / 2" />
                })()}
              </div>
            ) : null}
            {(() => { const vid = p.highlight?.videoId ?? mobileVideoById[p.id]; return vid ? (
              <>
                <div className="mt-3 hidden md:block">
                  <YouTubeEmbed videoId={vid} title={`${p.name} highlights`} />
                </div>
                {mobileVideoOpenId === p.id ? (
                  <div className="mt-2 md:hidden">
                    <YouTubeEmbed videoId={vid} title={`${p.name} highlights`} />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="hidden md:block">
                <DynamicHighlight query={`${p.name} ${p.team.name} highlights`} />
              </div>
            )})()}
            <div className="mt-3 text-[12px] text-muted-foreground hidden md:block">
              Next 3: {p.upcoming.next3.map((f) => `${f.isHome ? 'H' : 'A'} ${f.opponent}${typeof f.difficulty === 'number' ? ` ${f.difficulty}` : ''}`).join(' · ')}
            </div>
            <div className="mt-auto pt-4 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tap to prefer</div>
            </Card>
          </motion.div>
        ))}
      </div>
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-h-[80vh] overflow-auto sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3 pr-8">
              <DialogTitle>Filters</DialogTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
            </div>
          </DialogHeader>
            <div className="mb-3">
              <div className="otm-kicker mb-1">Positions</div>
              <ToggleGroup
                multiple
                value={Array.from(selectedPositions)}
                onValueChange={(next) => setSelectedPositions(new Set(Array.isArray(next) ? next : []))}
                variant="outline"
                size="sm"
                className="flex-wrap"
              >
                {allPositions.map((pos) => (
                  <ToggleGroupItem key={pos} value={pos} className="uppercase tracking-[0.12em]">
                    {pos}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div>
              <div className="otm-kicker mb-1">Teams</div>
              <div className="flex flex-wrap gap-2">
                {allTeams.map((t) => (
                  <FilterChip
                    key={t}
                    label={t}
                    active={selectedTeams.has(t)}
                    onClick={() => setSelectedTeams((s) => toggleSet(s, t))}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setFiltersOpen(false)}>Close</Button>
              <Button onClick={() => setFiltersOpen(false)}>Apply</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-card p-2 text-center">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-[15px]">{value ?? '–'}</div>
    </div>
  )
}

function DynamicHighlight({ query }: { query: string }) {
  const [videoId, setVideoId] = React.useState<string | null>(null)
  const [queried, setQueried] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    setQueried(false)
    fetch(`/api/highlights?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d?.videoId) setVideoId(d.videoId)
        setQueried(true)
      })
      .catch(() => setQueried(true))
    return () => {
      cancelled = true
    }
  }, [query])

  if (videoId) {
    return (
      <div className="mt-3">
        <YouTubeEmbed videoId={videoId} title={`Highlights`} />
      </div>
    )
  }
  if (!queried) {
    return <VideoSkeleton />
  }
  return (
    <div className="mt-3 text-xs">
      <a
        className="underline"
        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`}
        target="_blank"
        rel="noreferrer"
      >
        Search highlights on YouTube
      </a>
    </div>
  )
}

function VideoSkeleton() {
  return <Skeleton className="mt-3 aspect-video w-full rounded-md" />
}

function YouTubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  const [loaded, setLoaded] = React.useState(false)
  return (
    <div className="relative">
      {!loaded && <VideoSkeleton />}
      <iframe
        className={`aspect-video w-full rounded-md border border-border ${loaded ? "" : "invisible absolute inset-0"}`}
        src={`https://www.youtube.com/embed/${videoId}`}
        title={title}
        onLoad={() => setLoaded(true)}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  )
}


