// Description: Simple rankings view that reads cookie-based ranking and shows ordered players.
"use client"

import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { AppBundle, AppPlayer } from '@/lib/types'
import { getBundle } from '@/lib/bundle-store'
import { ImageWithFallback } from '@/components/ui/image-with-fallback'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageShell } from '@/components/page-shell'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import LZString from 'lz-string'

// legacy fetch left here previously; switched to shared cache via getBundle

function useCookie(name: string) {
  const [value, setValue] = useState<string | null>(null)
  useEffect(() => {
    const cookies = document.cookie.split(';').map((c) => c.trim())
    const entry = cookies.find((c) => c.startsWith(`${encodeURIComponent(name)}=`))
    setValue(entry ? decodeURIComponent(entry.split('=')[1]) : null)
  }, [name])
  return value
}

type RankingState = { order: number[] }
function parseRanking(json: string | null): RankingState {
  try { return json ? JSON.parse(json) as RankingState : { order: [] } } catch { return { order: [] } }
}

function fantraxKey(p: AppPlayer): number {
  return p.fantraxProjection?.overallRank ?? 9999
}

function draftSocietyKey(p: AppPlayer): number {
  return typeof p.draftSocietyTop50Rank === 'number' ? p.draftSocietyTop50Rank : 9999
}

function lastSeasonKey(p: AppPlayer): number {
  // Lower is better; invert points so more points → smaller number
  const pts = p.lastSeason?.totalPoints
  return pts != null ? 1000 - Math.max(0, Math.min(pts, 1000)) : 9999
}

function computeConsensusOrder(players: AppPlayer[]): number[] {
  return players
    .slice()
    .sort((a, b) => {
      const fa = fantraxKey(a), fb = fantraxKey(b)
      if (fa !== fb) return fa - fb
      const da = draftSocietyKey(a), db = draftSocietyKey(b)
      if (da !== db) return da - db
      const la = lastSeasonKey(a), lb = lastSeasonKey(b)
      if (la !== lb) return la - lb
      return a.name.localeCompare(b.name)
    })
    .map((p) => p.id)
}

export default function RankingsPage() {
  const router = useRouter()
  const [bundle, setBundle] = useState<AppBundle | null>(null)
  const rankCookie = useCookie('otm_ranking')
  const initialOrder = useMemo(() => parseRanking(rankCookie).order, [rankCookie])
  const [order, setOrder] = useState<number[]>([])
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  // drag state removed; we will use simple up/down controls

  useEffect(() => { getBundle().then(setBundle).catch(console.error) }, [])
  // Warm the compare route so BACK navigates instantly
  useEffect(() => { try { router.prefetch('/compare') } catch {} }, [router])
  useEffect(() => { setOrder(initialOrder) }, [initialOrder])
  // Seed a default order (Fantrax → DraftSociety → last-season) if user has no ranking yet
  useEffect(() => {
    if (!bundle) return
    if (order.length === 0) {
      const seeded = computeConsensusOrder(bundle.players)
      commitOrder(seeded)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle])
  const PAGE_SIZE = 100
  const [page, setPage] = useState(1)

  const byId = new Map<number, AppPlayer>(Array.isArray(bundle?.players) ? bundle!.players.map((p) => [p.id, p]) : [])
  const ranked = order.map((id) => byId.get(id)).filter(Boolean) as AppPlayer[]
  const unranked = (Array.isArray(bundle?.players) ? bundle!.players : []).filter((p) => !order.includes(p.id)).slice(0, 50)

  const totalPages = Math.max(1, Math.ceil((order.length || ranked.length) / PAGE_SIZE))
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])
  const startIdx = (page - 1) * PAGE_SIZE
  const endIdx = Math.min(ranked.length, startIdx + PAGE_SIZE)
  const rankedPage = ranked.slice(startIdx, endIdx)

  if (!bundle) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-3 h-4 w-64" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </PageShell>
    )
  }

  function toCsv(rows: string[][]): string {
    return rows.map((r) => r.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  }

  function handleExportCsv() {
    if (!bundle) return
    const all = [...ranked, ...bundle.players.filter((p) => !order.includes(p.id))]
    const rows: string[][] = all.map((p: AppPlayer) => {
      const fullName = p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : p.name
      return [fullName, p.team.shortName]
    })
    const csv = toCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fantrax_rankings.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function writeCookie(name: string, value: string) {
    const d = new Date(); d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000)
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`
  }

  function deleteCookie(name: string) {
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`
  }

  function commitOrder(next: number[]) {
    setOrder(next)
    writeCookie('otm_ranking', JSON.stringify({ order: next }))
  }

  function shareLink(): void {
    try {
      const payload = JSON.stringify({ order })
      const compressed = LZString.compressToEncodedURIComponent(payload)
      const url = `${location.origin}/compare#r=${compressed}`
      if (navigator.share) {
        navigator.share({ title: 'OTM FPL ranking', url }).catch(() => {
          navigator.clipboard?.writeText(url).catch(() => {})
          alert('Link copied to clipboard')
        })
      } else {
        navigator.clipboard?.writeText(url).catch(() => {})
        alert('Link copied to clipboard')
      }
    } catch {
      // noop
    }
  }

  // QR code support removed per request – keeping share link only

  // no-op: previous DnD helper removed

  function moveUp(id: number) {
    const idx = order.indexOf(id)
    if (idx <= 0) return
    const next = order.slice()
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    commitOrder(next)
  }

  function moveDown(id: number) {
    const idx = order.indexOf(id)
    if (idx === -1 || idx >= order.length - 1) return
    const next = order.slice()
    ;[next[idx + 1], next[idx]] = [next[idx], next[idx + 1]]
    commitOrder(next)
  }

  function roundIndex(position1Based: number): number {
    return Math.floor((position1Based - 1) / 12) // 0-based round
  }

  const ROUND_COLORS = ['#22c55e', '#06b6d4', '#f59e0b', '#ef4444', '#a855f7', '#10b981', '#3b82f6', '#eab308', '#f97316', '#14b8a6']

  return (
    <PageShell>
      <header className="mb-6 relative z-20">
        <div className="mb-4">
          <h1 className="otm-title text-2xl">Rankings</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Your board. Export to Fantrax when it is locked.</p>
        </div>
        {/* Action row below on desktop */}
        <div className="hidden md:flex items-center gap-2 mt-3">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  className="h-11 min-w-[132px] justify-center rounded-full px-4"
                  variant="ghost"
                  onClick={handleExportCsv}
                  aria-label="Export rankings as CSV"
                >
                  Export CSV
                </Button>
              }
            />
            <TooltipContent className="max-w-[240px]">
              CSV is formatted for Fantrax: Rankings → Import Rankings. Each row is &quot;First Last,TEAM&quot;.
            </TooltipContent>
          </Tooltip>
          <Button
            variant="destructive"
            className="h-11 w-11 min-w-0 justify-center rounded-full px-3 text-lg"
            onClick={() => setConfirmResetOpen(true)}
            aria-label="Reset rankings to default"
          >
            ↺
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  className="h-11 min-w-[132px] justify-center rounded-full px-4"
                  onClick={shareLink}
                  aria-label="Share or sync rankings"
                >
                  Share/Sync
                </Button>
              }
            />
            <TooltipContent>Create a shareable link to sync this ranking across devices.</TooltipContent>
          </Tooltip>
        </div>
        {/* Mobile action stack */}
        <div className="mt-3 grid grid-cols-2 gap-2 md:hidden">
          <Button
            className="rounded-xl h-12 text-base"
            variant="ghost"
            onClick={handleExportCsv}
            aria-label="Export rankings as CSV"
          >
            Export CSV
          </Button>
          <Button
            className="rounded-xl h-12 text-base"
            variant="ghost"
            onClick={shareLink}
            aria-label="Share or sync rankings"
          >
            Share/Sync
          </Button>
          <Button
            className="rounded-xl h-12 text-base col-span-2"
            variant="destructive"
            onClick={() => setConfirmResetOpen(true)}
            aria-label="Reset rankings to default"
          >
            Reset
          </Button>
        </div>
      </header>
      <Dialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset rankings?</DialogTitle>
            <DialogDescription>This clears your saved board and restores the default consensus order.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmResetOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!bundle) { setConfirmResetOpen(false); return }
                deleteCookie('otm_ranking')
                const seeded = computeConsensusOrder(bundle.players)
                commitOrder(seeded)
                setConfirmResetOpen(false)
              }}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <nav className="flex items-center justify-between mb-2" aria-label="Rankings pagination">
        <div className="text-sm text-muted-foreground" aria-live="polite" aria-atomic="true">
          Showing {startIdx + 1}–{endIdx} of {ranked.length}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={page <= 1} 
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            Prev
          </Button>
          <span className="text-sm" aria-current="page">Page {page}/{totalPages}</span>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={page >= totalPages} 
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            Next
          </Button>
        </div>
      </nav>
      <motion.ol layout className="mb-10 columns-1 sm:columns-2 lg:columns-3 gap-6 [column-fill:balance]">
        {rankedPage.map((p, idx0) => {
          const idx = startIdx + idx0
          return (
          <motion.li
            key={p.id}
            layout
            className="relative mb-2 w-full break-inside-avoid"
            whileHover={{ y: -2, scale: 1.01, rotateX: 1, rotateY: -1 }}
            animate={dragId === p.id ? { scale: 1.02, rotateX: 4, rotateY: -4 } : dragOverId === p.id && dragId != null ? { scale: 1.005 } : { scale: 1, rotateX: 0, rotateY: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
          >
            <Card
              size="flush"
              className={`relative flex cursor-pointer flex-row items-center gap-4 overflow-hidden p-3 select-none sm:gap-3 sm:p-2 hover:border-gold ${dragId === p.id ? "border-gold" : ""} ${dragOverId === p.id && dragId != null ? "border-gold" : ""}`}
              style={{
                borderLeftWidth: 3,
                borderLeftColor: ROUND_COLORS[roundIndex(idx + 1)],
              }}
            >
            {/* removed full-card drag overlay to keep buttons clickable */}
            {dragOverId === p.id && dragId != null ? (
              <motion.div
                className="pointer-events-none absolute inset-0 rounded"
                style={{
                  background:
                    'radial-gradient(120% 160% at 0% 0%, rgba(250,204,21,0.18) 0%, rgba(250,204,21,0.06) 50%, rgba(0,0,0,0) 70%)',
                  outline: '2px dashed rgba(250,204,21,0.85)',
                  outlineOffset: '-2px',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            ) : null}
            <span className="w-8 sm:w-6 text-right font-mono text-[13px] text-muted-foreground">{idx + 1}</span>
            {idx % 12 === 0 ? (
              <Badge
                variant="outline"
                className="ml-1"
                style={{ backgroundColor: `${ROUND_COLORS[roundIndex(idx + 1)]}33`, color: "#ccc" }}
                title={`Round ${roundIndex(idx + 1) + 1}`}
              >
                R{roundIndex(idx + 1) + 1}
              </Badge>
            ) : null}
            <ImageWithFallback src={p.images.avatar ?? undefined} alt="" className="h-8 w-8 sm:h-6 sm:w-6 rounded-full" />
            <div
              className="flex-1 min-w-0 flex items-center gap-2 flex-wrap"
              draggable
              onDragStart={(e: React.DragEvent) => {
                e.dataTransfer.effectAllowed = 'move'
                setDragId(p.id)
                setDragOverId(p.id)
              }}
              onDragOver={(e: React.DragEvent) => {
                e.preventDefault()
                if (dragOverId !== p.id) setDragOverId(p.id)
              }}
              onDragEnter={(e: React.DragEvent) => {
                e.preventDefault()
                if (dragOverId !== p.id) setDragOverId(p.id)
              }}
              onDragLeave={() => {
                // do not clear immediately to avoid flicker when moving into buttons
              }}
              onDrop={(e: React.DragEvent) => {
                e.preventDefault()
                if (dragId == null || dragId === p.id) { setDragId(null); setDragOverId(null); return }
                const a = dragId
                const b = p.id
                const next = order.slice()
                const ai = next.indexOf(a)
                const bi = next.indexOf(b)
                if (ai !== -1 && bi !== -1) {
                  ;[next[ai], next[bi]] = [next[bi], next[ai]]
                  commitOrder(next)
                }
                setDragId(null)
                setDragOverId(null)
              }}
              onDragEnd={() => { setDragId(null); setDragOverId(null) }}
            >
              <span className={`truncate text-base sm:text-sm ${dragId === p.id ? 'opacity-70' : ''}`}>{p.name}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{p.team.shortName} · {p.position}</span>
              {p.fantraxProjection?.pp90 != null ? (() => {
              const v = p.fantraxProjection!.pp90
              let cls = 'text-muted-foreground'
              if (v >= 12) cls = 'text-live'
              else if (v >= 10) cls = 'text-gold'
              else if (v >= 8) cls = 'text-muted-foreground'
              else cls = 'text-muted-foreground'
              return (
                <span
                  className={`font-mono text-[11px] whitespace-nowrap ${cls}`}
                  title="Projected points per 90"
                >
                  PP/90 {v.toFixed(2)}
                </span>
              )
            })() : null}
            </div>
            <span className={`ml-auto shrink-0 flex items-center gap-2 sm:gap-1 relative z-10 ${dragOverId === p.id && dragId != null ? 'ring-2 ring-emerald-500/40 rounded' : ''}`}> 
              <Button
                variant="outline"
                size="icon-sm"
                className="size-11 sm:size-8"
                aria-label={`Move ${p.name} up in ranking`}
                onClick={() => moveUp(p.id)}
                disabled={idx === 0}
              >
                ↑
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="size-11 sm:size-8"
                aria-label={`Move ${p.name} down in ranking`}
                onClick={() => moveDown(p.id)}
                disabled={idx >= ranked.length - 1}
              >
                ↓
              </Button>
            </span>
            </Card>
          </motion.li>
          )
        })}
      </motion.ol>
      <nav className="flex items-center justify-center gap-3 mt-4" aria-label="Rankings pagination">
        <Button 
          variant="outline" 
          size="sm" 
          disabled={page <= 1} 
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          aria-label="Previous page"
        >
          Prev
        </Button>
        <span className="text-sm text-muted-foreground" aria-current="page">
          Page {page}/{totalPages}
        </span>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={page >= totalPages} 
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          aria-label="Next page"
        >
          Next
        </Button>
      </nav>

      <section className="mt-8" aria-labelledby="unranked-heading">
        <h2 id="unranked-heading" className="text-lg font-medium mb-3">Unranked suggestions</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {unranked.map((p) => (
            <li key={p.id} className="text-sm">
              {p.name} <span className="text-muted-foreground">({p.team.shortName})</span>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  )
}


