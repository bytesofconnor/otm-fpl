import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Over the Moon Convex Schema
 * 
 * Mirrors the Supabase schema from supabase/migrations with indexes optimized for query patterns.
 * Includes the `assists` field in player_week_stats (missing in Supabase, fixes issue #76).
 */
export default defineSchema({
  // Projection snapshots: frozen weekly projections before fixtures progress
  projection_snapshots: defineTable({
    league_id: v.string(),
    period: v.number(),
    player_id: v.string(),
    team_id: v.string(),
    projected: v.number(),
    manager_projected: v.union(v.number(), v.null()),
    captured_at: v.string(),
  })
    .index("by_league_period", ["league_id", "period"])
    .index("by_league_period_player", ["league_id", "period", "player_id"]),

  // Player week stats: actual scored points, minutes, and detailed stats
  player_week_stats: defineTable({
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
    assists: v.union(v.number(), v.null()), // NEW: fixes #76
    key_passes: v.union(v.number(), v.null()),
    clean_sheets: v.union(v.number(), v.null()),
    saves: v.union(v.number(), v.null()),
    shots_on_target: v.union(v.number(), v.null()),
    captured_at: v.string(),
  })
    .index("by_league_period", ["league_id", "period"])
    .index("by_capture", ["capture_id"])
    .index("by_league_period_player", ["league_id", "period", "player_id"]),

  // Ownership snapshots: FA/WW/owned tracking for wire intelligence
  ownership_snapshots: defineTable({
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
  })
    .index("by_league_period", ["league_id", "period"])
    .index("by_capture", ["capture_id"])
    .index("by_league_period_player", ["league_id", "period", "player_id"]),

  // User profiles: league + team association per user
  profiles: defineTable({
    user_id: v.string(), // Auth provider user ID (Supabase auth.users.id or Convex Auth subject)
    league_id: v.string(),
    team_id: v.union(v.string(), v.null()),
    plan: v.string(), // "free" or "pro"
  })
    .index("by_user_id", ["user_id"]),
})
