// Description: Premier League club codes, aliases, and chip colors for filters.

/** Fantrax short codes that don't match FPL's `teams.short_name`. */
const CLUB_ALIASES: Record<string, string> = {
  BRF: "BRE",
  NOT: "NFO",
  FOR: "NFO",
  NFFC: "NFO",
  SHU: "SHU",
  WBA: "WBA",
}

export function canonicalClub(code: string): string {
  const key = code.trim().toUpperCase()
  if (!key || key === "—" || key === "-") return key
  return CLUB_ALIASES[key] ?? key
}

/** Primary kit colour per FPL/Fantrax short code. */
export const CLUB_COLORS: Record<string, string> = {
  ARS: "#EF0107",
  AVL: "#670E36",
  BOU: "#DA291C",
  BRE: "#E30613",
  BRF: "#E30613",
  BHA: "#0057B8",
  CHE: "#034694",
  COV: "#59B5E3",
  CRY: "#1B458F",
  EVE: "#003399",
  FUL: "#000000",
  HUL: "#F18A00",
  IPS: "#0033A0",
  LEE: "#FFCD00",
  LIV: "#C8102E",
  MCI: "#6CABDD",
  MUN: "#DA020E",
  NEW: "#241F20",
  NFO: "#DD0000",
  NOT: "#DD0000",
  SUN: "#E2231A",
  TOT: "#132257",
  WHU: "#7A263A",
  WOL: "#FDB913",
  BRN: "#6C1D45",
}

function hexLum(hex: string): number {
  const raw = hex.replace("#", "")
  if (raw.length !== 6) return 0.5
  const n = Number.parseInt(raw, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

export function clubChipTone(code: string): { paint: string; ink: string; outline: string } {
  const key = code.trim().toUpperCase()
  const paint = CLUB_COLORS[key] ?? CLUB_COLORS[canonicalClub(key)] ?? "#737373"
  const lum = hexLum(paint)
  const ink = lum > 0.62 ? "#0a0a0a" : "#fafafa"
  const outline = lum < 0.14 ? "#d4d4d4" : paint
  return { paint, ink, outline }
}

/** After a 250×250 FPL portrait 403s, the 110×140 cut often still exists. */
export function nextPlayerPhotoUrl(current: string | undefined, fallback?: string): string | undefined {
  if (!current) return fallback || undefined
  const smaller = current.replace("/photos/players/250x250/", "/photos/players/110x140/")
  if (smaller !== current) return smaller
  if (fallback && fallback !== current) return fallback
  return undefined
}
