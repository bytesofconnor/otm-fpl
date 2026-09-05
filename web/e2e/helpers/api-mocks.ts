import { Page } from "@playwright/test"
import fantraxLeagueFixture from "../fixtures/fantrax-league.json"
import fantraxFormFixture from "../fixtures/fantrax-form.json"
import appBundleFixture from "../fixtures/app-bundle.json"
import scoutOpportunitiesFixture from "../fixtures/scout-opportunities.json"

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

  // Mock app-bundle endpoint (critical for Compare page)
  await page.route("**/api/app-bundle*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(appBundleFixture),
    })
  })
}

/**
 * Mock scout API with valid opportunities data
 */
export async function mockScoutAPI(page: Page) {
  await page.route("**/api/scout/opportunities*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(scoutOpportunitiesFixture),
    })
  })
}
