import { NextRequest, NextResponse } from "next/server"
import { OTM_LEAGUE_ID, parseLeagueId } from "@/lib/fantrax-shared"
import {
  collectWeeklyProjectionCandidates,
  resolveCurrentPeriod,
} from "@/lib/fantrax"
import { upsertProjectionSnapshots } from "@/lib/supabase"

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
    const collected = await collectWeeklyProjectionCandidates(leagueId, period)
    if (!collected.candidates.length) {
      results.push({
        period,
        success: true,
        inserted: 0,
        skipped: 0,
        skippedStarted: collected.skippedStarted,
        skippedNoProj: collected.skippedNoProj,
        total: 0,
      })
      continue
    }
    const result = await upsertProjectionSnapshots(collected.candidates)
    results.push({
      period,
      success: result.success,
      inserted: result.inserted,
      skipped: collected.candidates.length - result.inserted,
      skippedStarted: collected.skippedStarted,
      skippedNoProj: collected.skippedNoProj,
      total: collected.candidates.length,
      error: result.error,
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
      inserted: first?.inserted ?? 0,
      skipped: first?.skipped ?? 0,
      skippedStarted: first?.skippedStarted ?? 0,
      skippedNoProj: first?.skippedNoProj ?? 0,
      total: first?.total ?? 0,
      error: first?.error,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "capture_failed"
    console.error("Capture error:", message)
    return NextResponse.json({ error: "capture_failed", message }, { status: 500 })
  }
}
