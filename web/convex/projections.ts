import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Upsert projection snapshots. First snapshot wins (earliest capture_at for each league/period/player).
 */
export const upsertProjectionSnapshots = mutation({
  args: {
    snapshots: v.array(
      v.object({
        league_id: v.string(),
        period: v.number(),
        player_id: v.string(),
        team_id: v.string(),
        projected: v.number(),
        manager_projected: v.union(v.number(), v.null()),
        captured_at: v.string(),
      }),
    ),
  },
  handler: async (ctx, { snapshots }) => {
    let inserted = 0

    for (const snapshot of snapshots) {
      // Check if already exists
      const existing = await ctx.db
        .query("projection_snapshots")
        .withIndex("by_league_period_player", (q) =>
          q
            .eq("league_id", snapshot.league_id)
            .eq("period", snapshot.period)
            .eq("player_id", snapshot.player_id),
        )
        .first()

      if (!existing) {
        await ctx.db.insert("projection_snapshots", snapshot)
        inserted++
      }
    }

    return { success: true, inserted }
  },
})

/**
 * Get projection snapshots for a league and period.
 */
export const getProjectionSnapshots = query({
  args: {
    league_id: v.string(),
    period: v.number(),
  },
  handler: async (ctx, { league_id, period }) => {
    const snapshots = await ctx.db
      .query("projection_snapshots")
      .withIndex("by_league_period", (q) => q.eq("league_id", league_id).eq("period", period))
      .collect()

    return snapshots
  },
})
