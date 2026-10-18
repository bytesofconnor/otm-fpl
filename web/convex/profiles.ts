import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

/**
 * Get user profile by user_id.
 */
export const getProfile = query({
  args: {
    user_id: v.string(),
  },
  handler: async (ctx, { user_id }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", user_id))
      .first()

    return profile
  },
})

/**
 * Upsert user profile.
 */
export const upsertProfile = mutation({
  args: {
    user_id: v.string(),
    league_id: v.string(),
    team_id: v.union(v.string(), v.null()),
    plan: v.string(),
  },
  handler: async (ctx, { user_id, league_id, team_id, plan }) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", user_id))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { league_id, team_id, plan })
      return { profile: { ...existing, league_id, team_id, plan }, created: false }
    }

    const id = await ctx.db.insert("profiles", {
      user_id,
      league_id,
      team_id,
      plan,
    })

    const profile = await ctx.db.get(id)
    return { profile, created: true }
  },
})

/**
 * Update profile fields.
 */
export const updateProfile = mutation({
  args: {
    user_id: v.string(),
    league_id: v.optional(v.string()),
    team_id: v.optional(v.union(v.string(), v.null())),
    plan: v.optional(v.string()),
  },
  handler: async (ctx, { user_id, ...updates }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("user_id", user_id))
      .first()

    if (!profile) {
      throw new Error("Profile not found")
    }

    const patch: Record<string, unknown> = {}
    if (updates.league_id !== undefined) patch.league_id = updates.league_id
    if (updates.team_id !== undefined) patch.team_id = updates.team_id
    if (updates.plan !== undefined) patch.plan = updates.plan

    await ctx.db.patch(profile._id, patch)

    return { success: true }
  },
})
