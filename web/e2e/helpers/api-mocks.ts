import { Page } from "@playwright/test"
import fantraxLeagueFixture from "../fixtures/fantrax-league.json"
import fantraxFormFixture from "../fixtures/fantrax-form.json"

/**
 * Mock Fantrax API routes to avoid needing live secrets in CI
 * Pages should still render chrome/structure even if APIs fail
 */
export async function mockFantraxAPIs(page: Page) {
  // Mock league endpoint
  await page.route("**/api/fantrax/league*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fantraxLeagueFixture),
    })
  })

  // Mock form endpoint
  await page.route("**/api/fantrax/form*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fantraxFormFixture),
    })
  })

  // Mock capture endpoint (used for league setup)
  await page.route("**/api/fantrax/capture*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    })
  })

  // Mock highlights endpoint
  await page.route("**/api/highlights*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    })
  })

  // Mock headlines endpoint
  await page.route("**/api/headlines*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    })
  })

  // Mock app-bundle endpoint
  await page.route("**/api/app-bundle*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        league: fantraxLeagueFixture,
        form: fantraxFormFixture,
        highlights: [],
        headlines: [],
      }),
    })
  })
}

/**
 * Mock scout API if it exists (return 404 if not implemented yet)
 */
export async function mockScoutAPI(page: Page) {
  await page.route("**/api/scout*", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not_implemented" }),
    })
  })
}
