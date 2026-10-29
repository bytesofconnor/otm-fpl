import { expect, test } from "@playwright/test"

const longName = "Saints Intelligence Agency International"

const player = (id: string, name: string) => ({
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
  periodLabel: "GW8 · 23 Oct–30 Oct",
  salaryCap: null,
  draftType: "SERPENTINE",
  draftState: "COMPLETED",
  liveStarted: true,
  teams: [
    { id: "team1", name: longName, shortName: "SIA", owner: "Connor" },
    { id: "team2", name: "Last Family Academy", shortName: "NSSA", owner: "Alex" },
  ],
  standings: [
    { rank: 1, teamId: "team1", teamName: longName, record: "4–2–1", points: "722.2", you: true },
    { rank: 2, teamId: "team2", teamName: "Last Family Academy", record: "3–3–1", points: "680.0", you: false },
  ],
  matchup: {
    home: longName,
    away: "Last Family Academy",
    homeId: "team1",
    awayId: "team2",
    homeScore: "62.8",
    awayScore: "56.3",
    homeProjected: "70.0",
    awayProjected: "64.0",
    homeOptimal: "84.0",
    awayOptimal: "72.0",
    homeShort: "SIA",
    awayShort: "NSSA",
    period: 8,
    periodLabel: "GW8 · 23 Oct–30 Oct",
    homeBench: [],
    awayBench: [],
    lines: [
      { position: "G", home: player("h0", "Caoimhin Kelleher-Montgomery"), away: player("a0", "Alisson Becker") },
    ],
  },
  roster: [],
  waivers: [],
  slate: [],
  transactions: [],
  draftPicks: [],
  scoringChips: [],
}

const form = {
  leagueId: "test-league-123",
  leagueName: "Test Fantasy League",
  teamId: "team1",
  teamName: longName,
  currentPeriod: 8,
  windowStart: 1,
  windowEnd: 8,
  managers: [
    {
      teamId: "team1",
      name: longName,
      shortName: "SIA",
      owner: "Connor",
      you: true,
      points: [{ period: 8, value: 62.8, projected: false, live: 62.8, forecast: 70 }],
      cumulative: [{ period: 8, value: 722.2, projected: false, live: 722.2, forecast: 722.2 }],
    },
    {
      teamId: "team2",
      name: "Palmer's Posh Trim And Very Long Club Name",
      shortName: "PPT",
      owner: "Cole",
      you: false,
      points: [{ period: 8, value: 40, projected: false, live: 40, forecast: 40 }],
      cumulative: [{ period: 8, value: 500, projected: false, live: 500, forecast: 500 }],
    },
  ],
  players: [],
  leagueOwned: [],
  unowned: [],
  news: [],
}

const teams = {
  leagueId: "test-league-123",
  leagueName: "Test Fantasy League",
  teams: league.teams,
}

async function noHorizontalScroll(page: import("@playwright/test").Page) {
  const box = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }))
  expect(box.inner).toBe(390)
  expect(box.scroll).toBe(390)
}

test.describe("phone pickers and form titles", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("otm_fantrax_team_id", "team1")
      localStorage.setItem("otm_fantrax_team_name", "Saints Intelligence Agency International")
      localStorage.setItem("otm_fantrax_team_short", "SIA")
    })
    await page.route("**/api/**", async (route) => {
      const url = route.request().url()
      if (url.includes("/api/fantrax/league")) return route.fulfill({ json: league })
      if (url.includes("/api/fantrax/form")) return route.fulfill({ json: form })
      if (url.includes("/api/scout/teams")) return route.fulfill({ json: teams })
      return route.fulfill({ json: {} })
    })
  })

  test("form titles wrap, search focuses, and the team picker is a bottom sheet", async ({ page }) => {
    await page.goto("/form")
    await expect(page.getByRole("button", { name: "Change team" })).toBeVisible()
    const title = page.getByRole("button", { name: "Change team" })
    await expect(title).toContainText(longName)
    const clamp = await title.evaluate((el) => {
      const span = el.querySelector("span")
      const cs = span ? getComputedStyle(span) : getComputedStyle(el)
      return cs.getPropertyValue("-webkit-line-clamp")
    })
    expect(clamp === "none" || clamp === "").toBe(true)
    await noHorizontalScroll(page)

    await title.click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("button", { name: /Palmer's Posh Trim/ })).toBeVisible()
    const sheet = await dialog.boundingBox()
    expect(sheet).not.toBeNull()
    expect(sheet!.y + sheet!.height).toBeGreaterThan(700)
    expect(sheet!.y).toBeGreaterThan(200)
    await dialog.getByRole("button", { name: "Close" }).click()
    await expect(dialog).toBeHidden()

    await page.getByRole("tab", { name: /Players/ }).click()
    await page.getByRole("button", { name: "Open search" }).click()
    await expect(page.locator("#form-search")).toBeFocused()
    await noHorizontalScroll(page)
  })

  test("gameweek and squad pickers open as bottom sheets", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText("62.8")).toBeVisible()
    await page.getByRole("button", { name: "Choose gameweek" }).click()
    const gw = page.getByRole("dialog")
    await expect(gw.getByRole("button", { name: "GW38" })).toBeVisible()
    const gwBox = await gw.boundingBox()
    expect(gwBox).not.toBeNull()
    expect(gwBox!.y + gwBox!.height).toBeGreaterThan(700)
    await gw.getByRole("button", { name: "Close" }).click()

    await page.getByRole("button", { name: "Switch squad" }).click()
    const squad = page.getByRole("dialog")
    await expect(squad.getByRole("button", { name: new RegExp(longName) })).toBeVisible()
    await expect(page.getByText("62.8")).toBeVisible()
    const squadBox = await squad.boundingBox()
    expect(squadBox).not.toBeNull()
    expect(squadBox!.y).toBeGreaterThan(200)
    await noHorizontalScroll(page)
  })
})
