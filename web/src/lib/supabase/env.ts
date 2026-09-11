/** Public Supabase URL + publishable key. Missing means Auth UI stays hidden. */
export function getSupabasePublicEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  if (!url || !key) return null
  return { url, key }
}

export function isSupabaseAuthConfigured(): boolean {
  return getSupabasePublicEnv() != null
}
