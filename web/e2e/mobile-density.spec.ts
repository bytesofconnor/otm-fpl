import { expect, test, type Page } from "@playwright/test"

const longPlayer = "Caoimhin Kelleher-Montgomery"

const rosterPlayer = (id: string, name: string) => ({
  id,
  name,
  shortName: name.split(" ").slice(-1)[0],
  position: "G",
  team: "LIV",
  points: 4.5,
  projected: 6.2,
  minutes: 90,
  status: "ACTIVE",
  opponent: "HUL",
  kickoff: "Sat 15:00",
  availability: "starting",
  availabilityLabel: "Expected: 1 @HUL 1 F",
})

const league = {
  leagueId: "test-league-123",
  leagueName: "Test Fantasy League",
  scoringType: "H2H points",
  teamCount: 2,
  currentPeriod: 8,
  viewedPeriod: 8,
  periodCount: 38,
  periodLabel: "GW8",
  salaryCap: null,
  draftType: null,
  draftState: "COMPLETED",
  liveStarted: true,
  teams: [
    { id: "team1", name: "Saints Intelligence Agency", shortName: "SIA", owner: "Connor" },
    { id: "team2", name: "Last Family Academy", shortName: "NSSA", owner: "Alex" },
  ],
  standings: [],
  matchup: {
    home: "Saints Intelligence Agency",
    away: "Last Family Academy",
    homeId: "team1",
    awayId: "team2",
    homeScore: "62.8",
    awayScore: "56.3",
    homeProjected: "70",
    awayProjected: "64",
    homeOptimal: "84",
    awayOptimal: "72",
    homeShort: "SIA",
    awayShort: "NSSA",
    period: 8,
    periodLabel: "GW8",
    homeBench: [],
    awayBench: [],
    lines: [{ position: "G", home: rosterPlayer("h0", longPlayer), away: rosterPlayer("a0", "Alisson Becker") }],
  },
  roster: [],
  waivers: [],
  slate: [],
  transactions: [],
  draftPicks: [],
  scoringChips: [],
}

const scout = {
  leagueId: "test-league-123",
  teamId: "team1",
  teamName: "Saints Intelligence Agency",
  timestamp: "2026-10-29T00:00:00.000Z",
  currentPeriod: 8,
  opportunities: [
    {
      player: { id: "p1", name: "Antonin Kinsky", club: "TOT", position: "G", availability: "FA" },
      whyNow: "Recent returns, expected to start",
      formChip: "warm",
      formScore: 26.5,
      formScoreWithFixtures: 27.5,
      minutesContext: "Expected starter",
      fixtureContext: {
        bar: "🟢⚪🟢⚪🟢",
        summary: "Favorable fixtures ahead",
        avgDifficulty: 2.4,
        adjustment: 1,
      },
      beatsWho: { benchPlayer: "Caoimhin Kelleher", benchFormChip: "cold", benchFormScore: 5.5 },
      confidence: "MEDIUM",
      killConditions: [],
    },
  ],
}

async function assertWidth(page: Page) {
  const box = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }))
  expect(box.inner).toBe(390)
  expect(box.scroll).toBe(390)
}

test.describe("scout chips and league density", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("otm_fantrax_team_id", "team1")
      localStorage.setItem("otm_fantrax_team_short", "SIA")
    })
    await page.route("**/api/**", async (route) => {
      const url = route.request().url()
      if (url.includes("/api/fantrax/league")) return route.fulfill({ json: league })
      if (url.includes("/api/scout/opportunities")) return route.fulfill({ json: scout })
      if (url.includes("/api/scout/teams")) {
        return route.fulfill({
          json: { leagueId: "test-league-123", leagueName: "Test", teams: league.teams },
        })
      }
      return route.fulfill({ json: {} })
    })
  })

  test("heat chips are a single text line and lineup names stay whole", async ({ page }) => {
    await page.goto("/scout?teamId=team1")
    const warm = page.getByText("Warm", { exact: true })
    await expect(warm).toBeVisible()
    const chip = await warm.evaluate((el) => {
      const row = el.parentElement
      const cs = getComputedStyle(el)
      return {
        rowClass: row?.className ?? "",
        fontSize: Number.parseFloat(cs.fontSize),
      }
    })
    expect(chip.rowClass).not.toContain("text-lg")
    expect(chip.rowClass).not.toContain("px-3")
    expect(chip.fontSize).toBeLessThanOrEqual(14)
    await assertWidth(page)

    await page.goto("/")
    const name = page.getByRole("button", { name: new RegExp(longPlayer) })
    await expect(name).toBeVisible()
    const row = await name.evaluate((el) => {
      const label = [...el.querySelectorAll("span")].find((span) => span.textContent === "Caoimhin Kelleher-Montgomery")
      const cs = label ? getComputedStyle(label) : getComputedStyle(el)
      return {
        overflow: cs.textOverflow,
        paddingTop: Number.parseFloat(getComputedStyle(el).paddingTop),
      }
    })
    expect(row.overflow).not.toBe("ellipsis")
    expect(row.paddingTop).toBeLessThanOrEqual(4)
    await assertWidth(page)
  })
})
