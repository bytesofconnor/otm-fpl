import { existsSync } from "node:fs"
import { expect, test, type Page } from "@playwright/test"
import { mockFantraxAPIs } from "./helpers/api-mocks.js"

const shots = "/opt/cursor/artifacts/screenshots"

const WATCHED = ["Konstantinos", "Lewis", "Caoimhin", "Olivier", "SAINTS", "INTELLIGENCE"]

function player(id: string, name: string, position: string) {
  return {
    id,
    name,
    position,
    team: "BRE",
    points: 6.2,
    projected: 6.2,
    minutes: 90,
    status: "ACTIVE",
  }
}

function snapshot(period: number) {
  return {
    leagueId: "test-league-123",
    leagueName: "Over the Moon",
    scoringType: "H2H points",
    teamCount: 2,
    currentPeriod: 8,
    viewedPeriod: period,
    periodCount: 38,
    periodLabel: `GW${period}`,
    salaryCap: null,
    draftType: "SERPENTINE",
    draftState: "COMPLETED",
    liveStarted: true,
    teams: [
      { id: "team1", name: "SAINTS INTELLIGENCE", shortName: "SAI" },
      { id: "team2", name: "Test Team Two", shortName: "TT2" },
    ],
    standings: [
      { rank: 1, teamId: "team1", teamName: "SAINTS INTELLIGENCE", record: "4–2–1", points: "80.0", you: true },
      { rank: 2, teamId: "team2", teamName: "Test Team Two", record: "3–3–1", points: "70.0", you: false },
    ],
    matchup: {
      home: "SAINTS INTELLIGENCE",
      away: "Test Team Two",
      homeId: "team1",
      awayId: "team2",
      homeScore: "42.0",
      awayScore: "31.0",
      homeProjected: "42.0",
      awayProjected: "31.0",
      homeOptimal: "42.0",
      awayOptimal: "31.0",
      homeShort: "SAI",
      awayShort: "TT2",
      homeBench: [],
      awayBench: [],
      period,
      periodLabel: `GW${period}`,
      lines: [
        {
          position: "G",
          home: player("p1", "Konstantinos Tsimikas", "G"),
          away: player("p2", "Caoimhin Kelleher", "G"),
        },
        {
          position: "D",
          home: player("p3", "Lewis Hall", "D"),
          away: player("p4", "Olivier Giroud", "D"),
        },
      ],
    },
    roster: [],
    waivers: [player("w1", "Konstantinos Tsimikas", "D")],
    slate: [
      {
        homeId: "team1",
        awayId: "team2",
        home: "SAINTS INTELLIGENCE",
        away: "Test Team Two",
        homeScore: "42.0",
        awayScore: "31.0",
        homeProjected: "42.0",
        awayProjected: "31.0",
        yours: true,
      },
    ],
    transactions: [],
    draftPicks: [],
    scoringChips: [],
  }
}

async function brokenWords(page: Page): Promise<string[]> {
  return page.evaluate((watched) => {
    const broken: string[] = []
    const nodes = [...document.querySelectorAll("span, div, p, h2, button")]
    for (const el of nodes) {
      const text = el.textContent ?? ""
      if (![...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim())) continue
      if (!watched.some((word) => text.includes(word))) continue
      for (const node of el.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue
        const value = node.textContent ?? ""
        const words = value.split(/\s+/).filter(Boolean)
        let offset = 0
        for (const word of words) {
          const start = value.indexOf(word, offset)
          if (start < 0) continue
          offset = start + word.length
          if (!watched.includes(word)) continue
          const range = document.createRange()
          range.setStart(node, start)
          range.setEnd(node, start + word.length)
          const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)))
          if (tops.size > 1) broken.push(word)
        }
      }
    }
    return [...new Set(broken)]
  }, WATCHED)
}

async function openLeague(page: Page, shot: string) {
  await page.addInitScript(() => {
    window.localStorage.setItem("otm_fantrax_team_id", "team1")
    window.localStorage.setItem("otm_fantrax_team_name", "SAINTS INTELLIGENCE")
  })
  await mockFantraxAPIs(page)
  await page.route("**/api/fantrax/league*", async (route) => {
    const url = new URL(route.request().url())
    const period = Number(url.searchParams.get("period") || "8")
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(snapshot(period)),
    })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(page.getByText("Konstantinos Tsimikas").first()).toBeVisible()
  if (existsSync(shots)) await page.locator(".otm-pitch").screenshot({ path: `${shots}/${shot}` })
}

test("league names wrap on word boundaries at 390px", async ({ page }) => {
  await openLeague(page, "league_names_current_390x844.png")
  const current = await brokenWords(page)
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth, `scrollWidth ${scrollWidth}`).toBe(390)
  expect(current, `current GW split ${current.join(", ")}`).toEqual([])

  await page.getByRole("button", { name: "Previous gameweek" }).click()
  await expect(page.getByText("GW7").first()).toBeVisible()
  if (existsSync(shots)) {
    await page.locator(".otm-pitch").screenshot({ path: `${shots}/league_names_previous_390x844.png` })
  }
  const previous = await brokenWords(page)
  const previousWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(previousWidth, `previous scrollWidth ${previousWidth}`).toBe(390)
  expect(previous, `previous GW split ${previous.join(", ")}`).toEqual([])
})
