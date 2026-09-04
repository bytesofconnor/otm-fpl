import { NextRequest, NextResponse } from "next/server"
import { OTM_LEAGUE_ID, parseLeagueId } from "@/lib/fantrax-shared"
import {
  collectWeeklyProjectionCandidates,
  resolveCurrentPeriod,
} from "@/lib/fantrax"
import { 
  collectPlayerWeekStats, 
  collectOwnershipSnapshots 
} from "@/lib/fantrax-history"
import { 
  upsertProjectionSnapshots,
  insertPlayerWeekStats,
  insertOwnershipSnapshots 
} from "@/lib/supabase"

export const maxDuration = 60

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return process.env.NODE_ENV === "development"
  }
  return request.headers.get("authorization") === `Bearer ${secret}`
}

function parsePeriod(value: string | null | undefined): number | null {
  if (value == null || value === "") return null
  const period = Number(value)
  if (!Number.isInteger(period) || period < 1) return null
  return period
}

async function capturePeriods(leagueId: string, periods: number[]) {
  const results = []
  for (const period of periods) {
    // 1. Capture projections (first-wins)
    const collected = await collectWeeklyProjectionCandidates(leagueId, period)
    const projResult = await upsertProjectionSnapshots(collected.candidates)
    
    // 2. Capture player week stats (scored FPts, minutes, started)
    const statsCollected = await collectPlayerWeekStats(leagueId, period)
    const statsResult = await insertPlayerWeekStats(statsCollected.stats)
    
    // 3. Capture ownership snapshots (FA/WW/owned) using same captureId
    const ownershipCollected = await collectOwnershipSnapshots(leagueId, period, statsCollected.captureId)
    const ownershipResult = await insertOwnershipSnapshots(ownershipCollected.snapshots)
    
    results.push({
      period,
      success: projResult.success && statsResult.success && ownershipResult.success,
      projections: {
        inserted: projResult.inserted,
        skipped: collected.candidates.length - projResult.inserted,
        skippedStarted: collected.skippedStarted,
        skippedNoProj: collected.skippedNoProj,
        total: collected.candidates.length,
      },
      stats: {
        inserted: statsResult.inserted,
        total: statsCollected.stats.length,
      },
      ownership: {
        inserted: ownershipResult.inserted,
        total: ownershipCollected.snapshots.length,
      },
      captureId: statsCollected.captureId,
      error: projResult.error || statsResult.error || ownershipResult.error,
    })
  }
  return results
}

/**
 * Vercel Cron hits GET. Defaults to Over the Moon and the live Fantrax period,
 * plus the next period so next GW can freeze before it becomes current.
 * Query: leagueId, period (optional — omit to capture current and next).
 */
export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const leagueId = parseLeagueId(request.nextUrl.searchParams.get("leagueId") ?? "") || OTM_LEAGUE_ID
  const requested = parsePeriod(request.nextUrl.searchParams.get("period"))
  const currentPeriod = requested ?? (await resolveCurrentPeriod(leagueId))
  const periods = requested != null ? [requested] : [currentPeriod, currentPeriod + 1]

  try {
    const results = await capturePeriods(leagueId, periods)
    return NextResponse.json({
      success: results.every((row) => row.success),
      leagueId,
      currentPeriod,
      results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "capture_failed"
    console.error("Capture error:", message)
    return NextResponse.json({ error: "capture_failed", message }, { status: 500 })
  }
}

/**
 * Manual capture. Same auth as cron. Body: { leagueId?, period? }
 */
export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { leagueId?: string; period?: number }
    const leagueId = parseLeagueId(body.leagueId ?? "") || OTM_LEAGUE_ID
    const period = body.period ?? (await resolveCurrentPeriod(leagueId))
    if (!Number.isInteger(period) || period < 1) {
      return NextResponse.json({ error: "invalid_period" }, { status: 400 })
    }
    const results = await capturePeriods(leagueId, [period])
    const first = results[0]
    return NextResponse.json({
      leagueId,
      success: first?.success ?? false,
      period: first?.period ?? period,
      projections: first?.projections ?? { inserted: 0, skipped: 0, skippedStarted: 0, skippedNoProj: 0, total: 0 },
      stats: first?.stats ?? { inserted: 0, total: 0 },
      ownership: first?.ownership ?? { inserted: 0, total: 0 },
      captureId: first?.captureId,
      error: first?.error,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "capture_failed"
    console.error("Capture error:", message)
    return NextResponse.json({ error: "capture_failed", message }, { status: 500 })
  }
}
