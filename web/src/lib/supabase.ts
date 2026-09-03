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
