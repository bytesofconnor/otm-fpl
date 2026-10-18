import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Insert player week stats (multiple captures per player/period allowed).
 */
export const insertPlayerWeekStats = mutation({
  args: {
    stats: v.array(
      v.object({
        capture_id: v.string(),
        league_id: v.string(),
        period: v.number(),
        player_id: v.string(),
        player_name: v.union(v.string(), v.null()),
        position: v.union(v.string(), v.null()),
        club: v.union(v.string(), v.null()),
        scored_fpts: v.union(v.number(), v.null()),
        minutes_played: v.union(v.number(), v.null()),
        started: v.union(v.boolean(), v.null()),
        goals: v.union(v.number(), v.null()),
        assists: v.union(v.number(), v.null()),
        key_passes: v.union(v.number(), v.null()),
        clean_sheets: v.union(v.number(), v.null()),
        saves: v.union(v.number(), v.null()),
        shots_on_target: v.union(v.number(), v.null()),
        captured_at: v.string(),
      }),
    ),
  },
  handler: async (ctx, { stats }) => {
    for (const stat of stats) {
      await ctx.db.insert("player_week_stats", stat)
    }

    return { success: true, inserted: stats.length }
  },
})

/**
 * Get latest player week stats for a league and period.
 * Returns the most recent capture for each player.
 */
export const getLatestPlayerWeekStats = query({
  args: {
    league_id: v.string(),
    period: v.number(),
  },
  handler: async (ctx, { league_id, period }) => {
    const allStats = await ctx.db
      .query("player_week_stats")
      .withIndex("by_league_period", (q) => q.eq("league_id", league_id).eq("period", period))
      .collect()

    // Group by player_id and keep latest capture_at
    const byPlayer = new Map<string, typeof allStats[0]>()
    for (const stat of allStats) {
      const existing = byPlayer.get(stat.player_id)
      if (!existing || stat.captured_at > existing.captured_at) {
        byPlayer.set(stat.player_id, stat)
      }
    }

    return Array.from(byPlayer.values())
  },
})
