/**
 * Import Supabase JSON exports into Convex
 * 
 * Usage:
 *   npx tsx scripts/import-supabase-export.ts [--dry-run]
 * 
 * Reads JSON exports from ../uploads/ and inserts them into Convex.
 * Requires CONVEX_DEPLOYMENT or NEXT_PUBLIC_CONVEX_URL to be set.
 */

import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"

const UPLOADS_DIR = join(process.cwd(), "..", "uploads")

function loadJson<T>(filename: string): T[] {
  const path = join(UPLOADS_DIR, filename)
  if (!existsSync(path)) {
    console.warn(`⚠️  ${filename} not found, skipping`)
    return []
  }
  const content = readFileSync(path, "utf-8")
  const data = JSON.parse(content)
  return Array.isArray(data) ? data : []
}

function getConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_CONVEX_URL or CONVEX_URL environment variable required. " +
      "Run `npx convex dev` first to generate .env.local, or set it manually."
    )
  }
  return url
}

async function importProjectionSnapshots(client: ConvexHttpClient, dryRun: boolean) {
  const rows = loadJson<{
    id: number
    league_id: string
    period: number
    player_id: string
    team_id: string
    projected: string | number
    manager_projected: string | number | null
    captured_at: string
    created_at: string
  }>("projection_snapshots_4e39.json")

  if (rows.length === 0) return

  console.log(`\n📊 Projection Snapshots: ${rows.length} rows`)

  const snapshots = rows.map((row) => ({
    league_id: row.league_id,
    period: row.period,
    player_id: row.player_id,
    team_id: row.team_id,
    projected: typeof row.projected === "string" ? parseFloat(row.projected) : row.projected,
    manager_projected: row.manager_projected == null ? null : 
      typeof row.manager_projected === "string" ? parseFloat(row.manager_projected) : row.manager_projected,
    captured_at: row.captured_at,
  }))

  if (dryRun) {
    console.log(`   [DRY RUN] Would insert ${snapshots.length} projection snapshots`)
    console.log(`   Sample:`, snapshots[0])
    return
  }

  const result = await client.mutation(api.projections.upsertProjectionSnapshots, { snapshots })
  console.log(`   ✓ Inserted ${result.inserted} projection snapshots`)
}

async function importPlayerWeekStats(client: ConvexHttpClient, dryRun: boolean) {
  const rows = loadJson<{
    id: number
    capture_id: string
    league_id: string
    period: number
    player_id: string
    player_name: string | null
    position: string | null
    club: string | null
    scored_fpts: string | number | null
    minutes_played: number | null
    started: boolean | null
    captured_at: string
    created_at: string
  }>("player_week_stats_4227.json")

  if (rows.length === 0) return

  console.log(`\n📈 Player Week Stats: ${rows.length} rows`)

  const stats = rows.map((row) => ({
    capture_id: row.capture_id,
    league_id: row.league_id,
    period: row.period,
    player_id: row.player_id,
    player_name: row.player_name,
    position: row.position,
    club: row.club,
    scored_fpts: row.scored_fpts == null ? null :
      typeof row.scored_fpts === "string" ? parseFloat(row.scored_fpts) : row.scored_fpts,
    minutes_played: row.minutes_played,
    started: row.started,
    goals: null, // Not in export, will be populated by future captures
    assists: null, // NEW field, fixes #76
    key_passes: null,
    clean_sheets: null,
    saves: null,
    shots_on_target: null,
    captured_at: row.captured_at,
  }))

  if (dryRun) {
    console.log(`   [DRY RUN] Would insert ${stats.length} player week stats`)
    console.log(`   Sample:`, stats[0])
    return
  }

  // Insert in batches to avoid timeout
  const BATCH_SIZE = 100
  let inserted = 0
  for (let i = 0; i < stats.length; i += BATCH_SIZE) {
    const batch = stats.slice(i, i + BATCH_SIZE)
    const result = await client.mutation(api.playerWeekStats.insertPlayerWeekStats, { stats: batch })
    inserted += result.inserted
    console.log(`   ✓ Inserted ${inserted}/${stats.length} player week stats`)
  }
}

async function importOwnershipSnapshots(client: ConvexHttpClient, dryRun: boolean) {
  const rows = loadJson<{
    id: number
    capture_id: string
    league_id: string
    period: number
    player_id: string
    player_name: string | null
    position: string | null
    club: string | null
    availability: string
    waiver_day: number | null
    owner_team_id: string | null
    owner_short_code: string | null
    captured_at: string
    created_at: string
  }>("ownership_snapshots_71e9.json")

  if (rows.length === 0) return

  console.log(`\n👥 Ownership Snapshots: ${rows.length} rows`)

  const snapshots = rows.map((row) => ({
    capture_id: row.capture_id,
    league_id: row.league_id,
    period: row.period,
    player_id: row.player_id,
    player_name: row.player_name,
    position: row.position,
    club: row.club,
    availability: row.availability,
    waiver_day: row.waiver_day,
    owner_team_id: row.owner_team_id,
    owner_short_code: row.owner_short_code,
    captured_at: row.captured_at,
  }))

  if (dryRun) {
    console.log(`   [DRY RUN] Would insert ${snapshots.length} ownership snapshots`)
    console.log(`   Sample:`, snapshots[0])
    return
  }

  // Insert in batches
  const BATCH_SIZE = 100
  let inserted = 0
  for (let i = 0; i < snapshots.length; i += BATCH_SIZE) {
    const batch = snapshots.slice(i, i + BATCH_SIZE)
    const result = await client.mutation(api.ownershipSnapshots.insertOwnershipSnapshots, { snapshots: batch })
    inserted += result.inserted
    console.log(`   ✓ Inserted ${inserted}/${snapshots.length} ownership snapshots`)
  }
}

async function importProfiles(client: ConvexHttpClient, dryRun: boolean) {
  const rows = loadJson<{
    id: string // UUID from auth.users
    league_id: string
    team_id: string | null
    plan: string
    created_at: string
    updated_at: string
  }>("profiles_cdf1.json")

  if (rows.length === 0) return

  console.log(`\n👤 Profiles: ${rows.length} rows`)

  for (const row of rows) {
    if (dryRun) {
      console.log(`   [DRY RUN] Would upsert profile for user ${row.id}`)
      console.log(`   Sample:`, row)
      continue
    }

    await client.mutation(api.profiles.upsertProfile, {
      user_id: row.id,
      league_id: row.league_id,
      team_id: row.team_id,
      plan: row.plan,
    })
    console.log(`   ✓ Upserted profile for user ${row.id}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")

  if (dryRun) {
    console.log("🔍 DRY RUN MODE: No data will be inserted\n")
  }

  const url = getConvexUrl()
  console.log(`Connecting to Convex: ${url}`)
  const client = new ConvexHttpClient(url)

  console.log("\n" + "=".repeat(60))
  console.log("Importing Supabase data to Convex")
  console.log("=".repeat(60))

  try {
    await importProjectionSnapshots(client, dryRun)
    await importPlayerWeekStats(client, dryRun)
    await importOwnershipSnapshots(client, dryRun)
    await importProfiles(client, dryRun)

    console.log("\n" + "=".repeat(60))
    console.log("✅ Import complete!")
    console.log("=".repeat(60) + "\n")
  } catch (err) {
    console.error("\n❌ Import failed:", err)
    process.exit(1)
  }
}

main()
