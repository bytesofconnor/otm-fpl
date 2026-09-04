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
 * Service-role client for server-side reads and writes. Never expose this to the browser.
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
 * Upserts projection snapshots. First snapshot wins via unique (league_id, period, player_id).
 */
export async function upsertProjectionSnapshots(
  snapshots: Omit<ProjectionSnapshot, "id" | "created_at">[],
): Promise<{ success: boolean; inserted: number; error?: string }> {
  const client = createServerSupabaseClient()
  if (!client) {
    return { success: false, inserted: 0, error: "Supabase not configured" }
  }

  try {
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
 * Fetches projection snapshots for a league and period as player_id -> snapshot.
 */
export async function getProjectionSnapshots(
  leagueId: string,
  period: number,
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

// ============================================================================
// History Capture: Player Week Stats & Ownership Snapshots
// ============================================================================

export type PlayerWeekStat = {
  id?: number
  capture_id: string
  league_id: string
  period: number
  player_id: string
  player_name?: string | null
  position?: string | null
  club?: string | null
  scored_fpts?: number | null
  minutes_played?: number | null
  started?: boolean | null
  captured_at?: string
  created_at?: string
}

export type OwnershipSnapshot = {
  id?: number
  capture_id: string
  league_id: string
  period: number
  player_id: string
  player_name?: string | null
  position?: string | null
  club?: string | null
  availability: string
  waiver_day?: number | null
  owner_team_id?: string | null
  owner_short_code?: string | null
  captured_at?: string
  created_at?: string
}

/**
 * Inserts player week stats (scored FPts, minutes, started).
 * Multiple captures per player/period allowed; use capture_id to correlate.
 */
export async function insertPlayerWeekStats(
  stats: Omit<PlayerWeekStat, "id" | "created_at">[],
): Promise<{ success: boolean; inserted: number; error?: string }> {
  const client = createServerSupabaseClient()
  if (!client) {
    return { success: false, inserted: 0, error: "Supabase not configured" }
  }

  try {
    const { data, error } = await client
      .from("player_week_stats")
      .insert(stats)
      .select()

    if (error) {
      console.error("Supabase insert player_week_stats error:", error)
      return { success: false, inserted: 0, error: error.message }
    }

    return { success: true, inserted: data?.length ?? 0 }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to insert player week stats:", message)
    return { success: false, inserted: 0, error: message }
  }
}

/**
 * Inserts ownership snapshots (FA/WW/owner tracking).
 * Multiple captures per player/period allowed; use capture_id to correlate.
 */
export async function insertOwnershipSnapshots(
  snapshots: Omit<OwnershipSnapshot, "id" | "created_at">[],
): Promise<{ success: boolean; inserted: number; error?: string }> {
  const client = createServerSupabaseClient()
  if (!client) {
    return { success: false, inserted: 0, error: "Supabase not configured" }
  }

  try {
    const { data, error} = await client
      .from("ownership_snapshots")
      .insert(snapshots)
      .select()

    if (error) {
      console.error("Supabase insert ownership_snapshots error:", error)
      return { success: false, inserted: 0, error: error.message }
    }

    return { success: true, inserted: data?.length ?? 0 }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("Failed to insert ownership snapshots:", message)
    return { success: false, inserted: 0, error: message }
  }
}

/**
 * Fetch latest player week stats for a league and period
 */
export async function getLatestPlayerWeekStats(
  leagueId: string,
  period: number,
): Promise<Map<string, PlayerWeekStat> | null> {
  const client = createServerSupabaseClient()
  if (!client) {
    return null
  }

  try {
    const { data, error } = await client
      .from("latest_player_week_stats")
      .select("*")
      .eq("league_id", leagueId)
      .eq("period", period)

    if (error) {
      console.error("Supabase fetch player_week_stats error:", error)
      return null
    }

    const map = new Map<string, PlayerWeekStat>()
    for (const row of data ?? []) {
      map.set(row.player_id, row)
    }

    return map
  } catch (err) {
    console.error("Failed to fetch player week stats:", err)
    return null
  }
}

/**
 * Fetch latest ownership snapshots for a league and period
 */
export async function getLatestOwnershipSnapshots(
  leagueId: string,
  period: number,
): Promise<Map<string, OwnershipSnapshot> | null> {
  const client = createServerSupabaseClient()
  if (!client) {
    return null
  }

  try {
    const { data, error } = await client
      .from("latest_ownership_snapshots")
      .select("*")
      .eq("league_id", leagueId)
      .eq("period", period)

    if (error) {
      console.error("Supabase fetch ownership_snapshots error:", error)
      return null
    }

    const map = new Map<string, OwnershipSnapshot>()
    for (const row of data ?? []) {
      map.set(row.player_id, row)
    }

    return map
  } catch (err) {
    console.error("Failed to fetch ownership snapshots:", err)
    return null
  }
}
