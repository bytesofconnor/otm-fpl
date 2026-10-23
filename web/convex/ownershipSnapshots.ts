import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Insert ownership snapshots (multiple captures per player/period allowed).
 */
export const insertOwnershipSnapshots = mutation({
  args: {
    snapshots: v.array(
      v.object({
        capture_id: v.string(),
        league_id: v.string(),
        period: v.number(),
        player_id: v.string(),
        player_name: v.union(v.string(), v.null()),
        position: v.union(v.string(), v.null()),
        club: v.union(v.string(), v.null()),
        availability: v.string(),
        waiver_day: v.union(v.number(), v.null()),
        owner_team_id: v.union(v.string(), v.null()),
        owner_short_code: v.union(v.string(), v.null()),
        captured_at: v.string(),
      }),
    ),
  },
  handler: async (ctx, { snapshots }) => {
    for (const snapshot of snapshots) {
      await ctx.db.insert("ownership_snapshots", snapshot)
    }

    return { success: true, inserted: snapshots.length }
  },
})

/**
 * Get latest ownership snapshots for a league and period.
 * Returns the most recent capture for each player.
 */
export const getLatestOwnershipSnapshots = query({
  args: {
    league_id: v.string(),
    period: v.number(),
  },
  handler: async (ctx, { league_id, period }) => {
    const allSnapshots = await ctx.db
      .query("ownership_snapshots")
      .withIndex("by_league_period", (q) => q.eq("league_id", league_id).eq("period", period))
      .collect()

    // Group by player_id and keep latest captured_at
    const byPlayer = new Map<string, typeof allSnapshots[0]>()
    for (const snapshot of allSnapshots) {
      const existing = byPlayer.get(snapshot.player_id)
      if (!existing || snapshot.captured_at > existing.captured_at) {
        byPlayer.set(snapshot.player_id, snapshot)
      }
    }

    return Array.from(byPlayer.values())
  },
})
