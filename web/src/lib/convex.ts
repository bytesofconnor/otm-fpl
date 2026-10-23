/**
 * Convex client for Over the Moon
 * 
 * Replaces Supabase for data persistence. Server-side uses ConvexHttpClient for mutations,
 * client-side can use standard Convex React hooks if needed.
 */

import { ConvexHttpClient } from "convex/browser"
import { api } from "../../convex/_generated/api"

/**
 * Get Convex deployment URL from environment.
 */
export function getConvexUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) {
    console.warn("NEXT_PUBLIC_CONVEX_URL not configured")
    return null
  }
  return url
}

/**
 * Create server-side Convex client for mutations in API routes.
 */
export function createServerConvexClient(): ConvexHttpClient | null {
  const url = getConvexUrl()
  if (!url) return null
  return new ConvexHttpClient(url)
}

// ============================================================================
// Projection Snapshots
// ============================================================================

export type ProjectionSnapshot = {
  _id: string
  _creationTime: number
  league_id: string
  period: number
  player_id: string
  team_id: string
  projected: number
  manager_projected: number | null
  captured_at: string
}

export async function upsertProjectionSnapshots(
  snapshots: Omit<ProjectionSnapshot, "_id" | "_creationTime">[],
): Promise<{ success: boolean; inserted: number; error?: string }> {
  const client = createServerConvexClient()
  if (!client) {
    return { success: false, inserted: 0, error: "Convex not configured" }
  }

  try {
    const result = await client.mutation(api.projections.upsertProjectionSnapshots, { snapshots })
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to upsert projection snapshots:", message)
    return { success: false, inserted: 0, error: message }
  }
}

export async function getProjectionSnapshots(
  leagueId: string,
  period: number,
): Promise<Map<string, ProjectionSnapshot> | null> {
  const client = createServerConvexClient()
  if (!client) {
    return null
  }

  try {
    const snapshots = await client.query(api.projections.getProjectionSnapshots, {
      league_id: leagueId,
      period,
    })

    const map = new Map<string, ProjectionSnapshot>()
    for (const row of snapshots) {
      map.set(row.player_id, row)
    }

    return map
  } catch (err) {
    console.error("Failed to fetch projection snapshots:", err)
    return null
  }
}

// ============================================================================
// Player Week Stats
// ============================================================================

export type PlayerWeekStat = {
  _id?: string
  _creationTime?: number
  capture_id: string
  league_id: string
  period: number
  player_id: string
  player_name: string | null
  position: string | null
  club: string | null
  scored_fpts: number | null
  minutes_played: number | null
  started: boolean | null
  goals: number | null
  assists: number | null
  key_passes: number | null
  clean_sheets: number | null
  saves: number | null
  shots_on_target: number | null
  captured_at: string
}

export async function insertPlayerWeekStats(
  stats: Omit<PlayerWeekStat, "_id" | "_creationTime">[],
): Promise<{ success: boolean; inserted: number; error?: string }> {
  const client = createServerConvexClient()
  if (!client) {
    return { success: false, inserted: 0, error: "Convex not configured" }
  }

  try {
    const result = await client.mutation(api.playerWeekStats.insertPlayerWeekStats, { stats })
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to insert player week stats:", message)
    return { success: false, inserted: 0, error: message }
  }
}

export async function getLatestPlayerWeekStats(
  leagueId: string,
  period: number,
): Promise<Map<string, PlayerWeekStat> | null> {
  const client = createServerConvexClient()
  if (!client) {
    return null
  }

  try {
    const stats = await client.query(api.playerWeekStats.getLatestPlayerWeekStats, {
      league_id: leagueId,
      period,
    })

    const map = new Map<string, PlayerWeekStat>()
    for (const row of stats) {
      map.set(row.player_id, row)
    }

    return map
  } catch (err) {
    console.error("Failed to fetch player week stats:", err)
    return null
  }
}

// ============================================================================
// Ownership Snapshots
// ============================================================================

export type OwnershipSnapshot = {
  _id?: string
  _creationTime?: number
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
}

export async function insertOwnershipSnapshots(
  snapshots: Omit<OwnershipSnapshot, "_id" | "_creationTime">[],
): Promise<{ success: boolean; inserted: number; error?: string }> {
  const client = createServerConvexClient()
  if (!client) {
    return { success: false, inserted: 0, error: "Convex not configured" }
  }

  try {
    const result = await client.mutation(api.ownershipSnapshots.insertOwnershipSnapshots, { snapshots })
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to insert ownership snapshots:", message)
    return { success: false, inserted: 0, error: message }
  }
}

export async function getLatestOwnershipSnapshots(
  leagueId: string,
  period: number,
): Promise<Map<string, OwnershipSnapshot> | null> {
  const client = createServerConvexClient()
  if (!client) {
    return null
  }

  try {
    const snapshots = await client.query(api.ownershipSnapshots.getLatestOwnershipSnapshots, {
      league_id: leagueId,
      period,
    })

    const map = new Map<string, OwnershipSnapshot>()
    for (const row of snapshots) {
      map.set(row.player_id, row)
    }

    return map
  } catch (err) {
    console.error("Failed to fetch ownership snapshots:", err)
    return null
  }
}

// ============================================================================
// User Profiles (optional for single-user app)
// ============================================================================

export type Profile = {
  _id: string
  _creationTime: number
  user_id: string
  league_id: string
  team_id: string | null
  plan: string
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const client = createServerConvexClient()
  if (!client) {
    return null
  }

  try {
    const profile = await client.query(api.profiles.getProfile, { user_id: userId })
    return profile
  } catch (err) {
    console.error("Failed to fetch profile:", err)
    return null
  }
}

export async function upsertProfile(
  userId: string,
  leagueId: string,
  teamId: string | null,
  plan: string,
): Promise<{ profile: Profile | null; created: boolean }> {
  const client = createServerConvexClient()
  if (!client) {
    return { profile: null, created: false }
  }

  try {
    const result = await client.mutation(api.profiles.upsertProfile, {
      user_id: userId,
      league_id: leagueId,
      team_id: teamId,
      plan,
    })
    return result
  } catch (err) {
    console.error("Failed to upsert profile:", err)
    return { profile: null, created: false }
  }
}

export async function updateProfile(
  userId: string,
  updates: {
    league_id?: string
    team_id?: string | null
    plan?: string
  },
): Promise<{ success: boolean }> {
  const client = createServerConvexClient()
  if (!client) {
    return { success: false }
  }

  try {
    await client.mutation(api.profiles.updateProfile, {
      user_id: userId,
      ...updates,
    })
    return { success: true }
  } catch (err) {
    console.error("Failed to update profile:", err)
    return { success: false }
  }
}
