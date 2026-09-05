/**
 * Fixture Context Layer for Scout
 * 
 * Fetches Premier League fixture difficulty from FPL API (free, no auth required).
 * Blends opponent difficulty into Scout recommendations.
 */

// FPL API fixture endpoint (free, public)
const FPL_FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/"
const FPL_BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/"

/**
 * FPL Fixture shape from API
 */
export type FPLFixture = {
  id: number
  event: number | null // gameweek number (null if not scheduled yet)
  team_h: number // home team id
  team_a: number // away team id
  team_h_difficulty: number // 1-5 scale (5 = hardest)
  team_a_difficulty: number // 1-5 scale
  kickoff_time: string | null
  finished: boolean
  started: boolean
}

/**
 * FPL Team shape from bootstrap-static
 */
export type FPLTeam = {
  id: number
  name: string
  short_name: string
  code: number
}

/**
 * Fixture difficulty context for a player's club
 */
export type FixtureContext = {
  clubShortName: string
  next5Fixtures: Array<{
    opponent: string
    home: boolean
    difficulty: number // 1-5 scale
    gameweek: number | null
  }>
  avgDifficulty: number // average of next 5
  difficultyAdjustment: number // -10 to +10 (easy fixtures boost, hard fixtures penalty)
}

// Cache teams and fixtures for 1 hour
let teamsCache: { teams: FPLTeam[]; fetchedAt: number } | null = null
let fixturesCache: { fixtures: FPLFixture[]; fetchedAt: number } | null = null
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

/**
 * Fetch FPL teams from bootstrap-static endpoint
 */
async function fetchFPLTeams(): Promise<FPLTeam[]> {
  const now = Date.now()
  
  // Return cached if fresh
  if (teamsCache && now - teamsCache.fetchedAt < CACHE_TTL) {
    return teamsCache.teams
  }

  try {
    const res = await fetch(FPL_BOOTSTRAP_URL, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    })
    
    if (!res.ok) {
      console.warn(`FPL bootstrap fetch failed: ${res.statusText}`)
      return []
    }
    
    const data = await res.json()
    const teams = data.teams as FPLTeam[]
    
    teamsCache = { teams, fetchedAt: now }
    return teams
  } catch (err) {
    console.error("Error fetching FPL teams:", err)
    return []
  }
}

/**
 * Fetch upcoming FPL fixtures
 */
async function fetchFPLFixtures(): Promise<FPLFixture[]> {
  const now = Date.now()
  
  // Return cached if fresh
  if (fixturesCache && now - fixturesCache.fetchedAt < CACHE_TTL) {
    return fixturesCache.fixtures
  }

  try {
    const res = await fetch(FPL_FIXTURES_URL, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    })
    
    if (!res.ok) {
      console.warn(`FPL fixtures fetch failed: ${res.statusText}`)
      return []
    }
    
    const fixtures = await res.json() as FPLFixture[]
    
    fixturesCache = { fixtures, fetchedAt: now }
    return fixtures
  } catch (err) {
    console.error("Error fetching FPL fixtures:", err)
    return []
  }
}

/**
 * Map Fantrax club name to FPL team short name
 * This handles naming variations between Fantrax and FPL
 */
function mapFantraxClubToFPL(fantraxClub: string): string | null {
  const mapping: Record<string, string> = {
    "Arsenal": "ARS",
    "Aston Villa": "AVL",
    "AVL": "AVL",
    "Bournemouth": "BOU",
    "BOU": "BOU",
    "AFC Bournemouth": "BOU",
    "Brentford": "BRE",
    "BRE": "BRE",
    "Brighton": "BHA",
    "BHA": "BHA",
    "Brighton & Hove Albion": "BHA",
    "Chelsea": "CHE",
    "CHE": "CHE",
    "Crystal Palace": "CRY",
    "CRY": "CRY",
    "Everton": "EVE",
    "EVE": "EVE",
    "Fulham": "FUL",
    "FUL": "FUL",
    "Hull": "HUL",
    "HUL": "HUL",
    "Hull City": "HUL",
    "Ipswich": "IPS",
    "IPS": "IPS",
    "Ipswich Town": "IPS",
    "Leicester": "LEI",
    "LEI": "LEI",
    "Leicester City": "LEI",
    "Liverpool": "LIV",
    "LIV": "LIV",
    "Manchester City": "MCI",
    "MCI": "MCI",
    "Man City": "MCI",
    "Manchester United": "MUN",
    "MUN": "MUN",
    "Man Utd": "MUN",
    "Man United": "MUN",
    "Newcastle": "NEW",
    "NEW": "NEW",
    "Newcastle United": "NEW",
    "Nottingham Forest": "NFO",
    "NFO": "NFO",
    "Nott'm Forest": "NFO",
    "Coventry": "COV",
    "COV": "COV",
    "Coventry City": "COV",
    "Southampton": "SOU",
    "SOU": "SOU",
    "Tottenham": "TOT",
    "TOT": "TOT",
    "Tottenham Hotspur": "TOT",
    "West Ham": "WHU",
    "WHU": "WHU",
    "West Ham United": "WHU",
    "Wolves": "WOL",
    "WOL": "WOL",
    "Wolverhampton": "WOL",
    "Wolverhampton Wanderers": "WOL",
  }
  
  return mapping[fantraxClub] || null
}

/**
 * Get fixture context for a player's club
 * Returns difficulty ratings and adjustment for next 5 fixtures
 */
export async function getFixtureContext(fantraxClubName: string): Promise<FixtureContext | null> {
  const fplShortName = mapFantraxClubToFPL(fantraxClubName)
  
  if (!fplShortName) {
    console.warn(`Could not map Fantrax club "${fantraxClubName}" to FPL`)
    return null
  }

  const [teams, allFixtures] = await Promise.all([
    fetchFPLTeams(),
    fetchFPLFixtures(),
  ])
  
  if (teams.length === 0 || allFixtures.length === 0) {
    console.warn("No FPL data available for fixture context")
    return null
  }

  // Find the team by short name
  const team = teams.find(t => t.short_name === fplShortName)
  
  if (!team) {
    console.warn(`FPL team not found for short name "${fplShortName}"`)
    return null
  }

  // Get upcoming fixtures for this team (not finished, sorted by kickoff)
  const upcomingFixtures = allFixtures
    .filter(f => !f.finished && (f.team_h === team.id || f.team_a === team.id))
    .sort((a, b) => {
      const timeA = a.kickoff_time ? new Date(a.kickoff_time).getTime() : Infinity
      const timeB = b.kickoff_time ? new Date(b.kickoff_time).getTime() : Infinity
      return timeA - timeB
    })
    .slice(0, 5) // Next 5 fixtures

  if (upcomingFixtures.length === 0) {
    return {
      clubShortName: fplShortName,
      next5Fixtures: [],
      avgDifficulty: 3,
      difficultyAdjustment: 0,
    }
  }

  // Build next5Fixtures with opponent names
  const next5Fixtures = upcomingFixtures.map(fixture => {
    const isHome = fixture.team_h === team.id
    const opponentId = isHome ? fixture.team_a : fixture.team_h
    const opponent = teams.find(t => t.id === opponentId)
    const difficulty = isHome ? fixture.team_h_difficulty : fixture.team_a_difficulty

    return {
      opponent: opponent?.short_name || "???",
      home: isHome,
      difficulty,
      gameweek: fixture.event,
    }
  })

  // Calculate average difficulty (1-5 scale, where 5 = hardest)
  const avgDifficulty = next5Fixtures.reduce((sum, f) => sum + f.difficulty, 0) / next5Fixtures.length

  // Difficulty adjustment for Scout scoring
  // Easy run (avg < 2.5): +5 to +10 boost
  // Average run (2.5-3.5): 0 adjustment
  // Tough run (avg > 3.5): -5 to -10 penalty
  let difficultyAdjustment = 0
  
  if (avgDifficulty < 2.5) {
    // Easy fixtures: boost form score
    difficultyAdjustment = Math.round((2.5 - avgDifficulty) * 8) // +4 to +10
  } else if (avgDifficulty > 3.5) {
    // Hard fixtures: penalize form score
    difficultyAdjustment = Math.round((3.5 - avgDifficulty) * 8) // -4 to -10
  }

  return {
    clubShortName: fplShortName,
    next5Fixtures,
    avgDifficulty: Math.round(avgDifficulty * 10) / 10, // round to 1 decimal
    difficultyAdjustment,
  }
}

/**
 * Format fixture difficulty as emoji bar
 * ⚫ = Hard (4-5), ⚪ = Medium (3), 🟢 = Easy (1-2)
 */
export function formatFixtureDifficultyBar(fixtures: FixtureContext["next5Fixtures"]): string {
  return fixtures.map(f => {
    if (f.difficulty >= 4) return "⚫"
    if (f.difficulty >= 3) return "⚪"
    return "🟢"
  }).join("")
}

/**
 * Get fixture context summary text
 */
export function getFixtureSummary(context: FixtureContext): string {
  const easy = context.next5Fixtures.filter(f => f.difficulty <= 2).length
  const hard = context.next5Fixtures.filter(f => f.difficulty >= 4).length

  if (easy >= 4) return "Very favorable fixture run"
  if (easy >= 3) return "Favorable fixtures ahead"
  if (hard >= 4) return "Very tough fixture run"
  if (hard >= 3) return "Tough fixtures ahead"
  return "Mixed fixture difficulty"
}
