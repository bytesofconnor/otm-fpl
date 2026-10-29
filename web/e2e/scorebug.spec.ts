import { expect, test } from "@playwright/test"
import { mockFantraxAPIs, mockScoutAPI } from "./helpers/api-mocks.js"

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
    lines: [],
  },
  roster: [],
  waivers: [],
  slate: [],
  transactions: [],
  draftPicks: [],
  scoringChips: [],
}

test.describe("scorebug share", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("league pitch shows a 44px share control without horizontal scroll", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("otm_fantrax_team_id", "team1")
    })
    await mockFantraxAPIs(page)
    await page.route("**/api/fantrax/league*", async (route) => {
      await route.fulfill({ json: league })
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    const share = page.getByRole("button", { name: "Share matchup" })
    await expect(share).toBeVisible()
    const box = await share.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    const width = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }))
    expect(width.scroll).toBe(width.inner)
  })

  test("a bad card key still unfurls a png", async ({ request }) => {
    const response = await request.get("/card/nope/og")
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"] ?? "").toContain("image/png")
    expect(response.headers()["cache-control"] ?? "").toContain("s-maxage=120")
  })

  test("a scout opportunity card shows a share control", async ({ page }) => {
    await mockScoutAPI(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/scout?teamId=fqzp0okbkaycu7v8")
    const share = page.getByRole("button", { name: "Share recommendation" }).first()
    await expect(share).toBeVisible()
    const box = await share.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  })

  test("opening a card does not change the stored squad", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("otm_fantrax_team_id", "keep-this-squad")
    })
    await page.goto("/card/nope", { waitUntil: "networkidle" })
    await expect(page.getByText("Score's not up.").first()).toBeVisible()
    const stored = await page.evaluate(() => localStorage.getItem("otm_fantrax_team_id"))
    expect(stored).toBe("keep-this-squad")
  })
})
