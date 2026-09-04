/**
 * Manual test for Scout Opportunities API
 * 
 * Run with: npx tsx scripts/test-scout-api.ts
 * 
 * Tests the /api/scout/opportunities endpoint with Over the Moon league
 * 
 * Usage:
 * 1. Start dev server: npm run dev
 * 2. In another terminal: npx tsx scripts/test-scout-api.ts <teamId>
 * 
 * Or test against production/preview deployment:
 * SCOUT_API_URL=https://your-app.vercel.app npx tsx scripts/test-scout-api.ts <teamId>
 */

const OTM_LEAGUE_ID = "8rnibtdamsxcq60v"

async function testScoutAPI(teamId: string) {
  const apiUrl = process.env.SCOUT_API_URL || "http://localhost:3000"
  const url = `${apiUrl}/api/scout/opportunities?leagueId=${OTM_LEAGUE_ID}&teamId=${teamId}`

  console.log(`\n🔍 Testing Scout Opportunities API\n`)
  console.log(`League: ${OTM_LEAGUE_ID}`)
  console.log(`Team: ${teamId}`)
  console.log(`URL: ${url}\n`)

  try {
    const start = Date.now()
    const response = await fetch(url)
    const elapsed = Date.now() - start

    console.log(`Status: ${response.status} (${elapsed}ms)`)

    if (!response.ok) {
      const error = await response.json()
      console.error(`\n❌ Error:`, error)
      process.exit(1)
    }

    const data = await response.json()

    console.log(`\n✅ Success!\n`)
    console.log(`Team: ${data.teamName || data.teamId}`)
    console.log(`Current Period: GW${data.currentPeriod}`)
    console.log(`Opportunities: ${data.opportunities.length}\n`)

    if (data.opportunities.length === 0) {
      console.log(`No opportunities found (roster may be strong, or filters too strict)`)
      return
    }

    // Show top 5 opportunities
    console.log(`Top ${Math.min(5, data.opportunities.length)} Opportunities:\n`)

    for (let i = 0; i < Math.min(5, data.opportunities.length); i++) {
      const opp = data.opportunities[i]
      console.log(`${i + 1}. ${opp.player.name} (${opp.player.club} · ${opp.player.position} · ${opp.player.availability})`)
      console.log(`   Form: ${opp.formChip.toUpperCase()} (${opp.formScore.toFixed(1)} pts)`)
      console.log(`   Why now: ${opp.whyNow}`)
      if (opp.beatsWho) {
        console.log(`   Beats: ${opp.beatsWho.benchPlayer} (${opp.beatsWho.benchFormChip}, ${opp.beatsWho.benchFormScore.toFixed(1)} pts)`)
      }
      console.log(`   Confidence: ${opp.confidence.toUpperCase()}`)
      console.log(`   Kill if: ${opp.killConditions.join("; ")}`)
      if (opp.fantraxProj) {
        console.log(`   Fantrax proj: ${opp.fantraxProj.toFixed(1)} pts`)
      }
      console.log()
    }

    // Stats
    console.log(`\n📊 Statistics:`)
    console.log(`Total opportunities: ${data.opportunities.length}`)
    
    const byPosition = data.opportunities.reduce((acc: Record<string, number>, opp: any) => {
      const pos = opp.player.position.charAt(0)
      acc[pos] = (acc[pos] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    console.log(`By position: ${JSON.stringify(byPosition)}`)

    const byHeat = data.opportunities.reduce((acc: Record<string, number>, opp: any) => {
      acc[opp.formChip] = (acc[opp.formChip] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    console.log(`By heat: ${JSON.stringify(byHeat)}`)

    const byConfidence = data.opportunities.reduce((acc: Record<string, number>, opp: any) => {
      acc[opp.confidence] = (acc[opp.confidence] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    console.log(`By confidence: ${JSON.stringify(byConfidence)}`)

    const byAvailability = data.opportunities.reduce((acc: Record<string, number>, opp: any) => {
      acc[opp.player.availability] = (acc[opp.player.availability] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    console.log(`By availability: ${JSON.stringify(byAvailability)}`)

    console.log(`\n✨ Scout API test passed!\n`)

  } catch (err) {
    console.error(`\n❌ Request failed:`, err)
    process.exit(1)
  }
}

// CLI usage
const teamId = process.argv[2]

if (!teamId) {
  console.error(`\nUsage: npx tsx scripts/test-scout-api.ts <teamId>\n`)
  console.error(`Example: npx tsx scripts/test-scout-api.ts abc123xyz\n`)
  console.error(`To find your team ID:`)
  console.error(`1. Go to https://www.fantrax.com`)
  console.error(`2. Open your team's roster`)
  console.error(`3. Look for teamId in URL or network requests\n`)
  process.exit(1)
}

testScoutAPI(teamId)
