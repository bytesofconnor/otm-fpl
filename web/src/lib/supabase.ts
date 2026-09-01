// Description: Supabase client for server-side database access

import { createClient } from "@supabase/supabase-js"

export type ProjectionSnapshot = {
  id: number
  league_id: string
  period: number
  player_id: string
  team_id: string
  projected: number
  manager_projected: number | null
  captured_at: string
  created_at: string
}

/**
 * Creates a Supabase client with service role key for server-side writes.
 * Only use this in server-side code (API routes, server actions).
 * Never expose the service role key to the client.
 */
export function createServerSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/**
 * Upserts projection snapshots. First snapshot wins due to unique constraint.
 * If a snapshot already exists for (league_id, period, player_id), it will not be overwritten.
 */
export async function upsertProjectionSnapshots(
  snapshots: Omit<ProjectionSnapshot, "id" | "created_at">[]
): Promise<{ success: boolean; inserted: number; error?: string }> {
  const client = createServerSupabaseClient()
  if (!client) {
    return { success: false, inserted: 0, error: "Supabase not configured" }
  }

  try {
    // Use insert with onConflict: ignore to respect first-snapshot-wins rule
    const { data, error } = await client
      .from("projection_snapshots")
      .upsert(snapshots, {
        onConflict: "league_id,period,player_id",
        ignoreDuplicates: true,
      })
      .select()

    if (error) {
      console.error("Supabase upsert error:", error)
      return { success: false, inserted: 0, error: error.message }
    }

    return { success: true, inserted: data?.length ?? 0 }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to upsert projection snapshots:", message)
    return { success: false, inserted: 0, error: message }
  }
}

/**
 * Fetches projection snapshots for a given league and period.
 * Returns a map of player_id -> snapshot for easy lookup.
 */
export async function getProjectionSnapshots(
  leagueId: string,
  period: number
): Promise<Map<string, ProjectionSnapshot> | null> {
  const client = createServerSupabaseClient()
  if (!client) {
    return null
  }

  try {
    const { data, error } = await client
      .from("projection_snapshots")
      .select("*")
      .eq("league_id", leagueId)
      .eq("period", period)

    if (error) {
      console.error("Supabase fetch error:", error)
      return null
    }

    const map = new Map<string, ProjectionSnapshot>()
    for (const row of data ?? []) {
      map.set(row.player_id, row)
    }

    return map
  } catch (err) {
    console.error("Failed to fetch projection snapshots:", err)
    return null
  }
}

/**
 * Checks if a snapshot already exists for the given league, period, and player.
 * Used to enforce first-snapshot-wins logic.
 */
export async function snapshotExists(
  leagueId: string,
  period: number,
  playerId: string
): Promise<boolean> {
  const client = createServerSupabaseClient()
  if (!client) {
    return false
  }

  try {
    const { data, error } = await client
      .from("projection_snapshots")
      .select("id")
      .eq("league_id", leagueId)
      .eq("period", period)
      .eq("player_id", playerId)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error("Supabase exists check error:", error)
      return false
    }

    return data != null
  } catch (err) {
    console.error("Failed to check snapshot existence:", err)
    return false
  }
}
