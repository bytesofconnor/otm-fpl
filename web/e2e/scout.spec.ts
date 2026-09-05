import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { mockScoutAPI } from "./helpers/api-mocks.js"

test.describe("Scout Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockScoutAPI(page)
  })

  test("should load without client-side crash (smoke test)", async ({ page }) => {
    await page.goto("/scout")
    
    // Critical: Must not show "Application error: a client-side exception has occurred"
    await expect(page.getByText(/application error.*client-side exception/i)).not.toBeVisible()
    
    // Must show Scout heading
    await expect(page.getByRole("heading", { name: "Scout" })).toBeVisible()
  })

  test("should render opportunity board with valid data", async ({ page }) => {
    await page.goto("/scout")
    
    // Wait for opportunities to load
    await page.waitForSelector('article[aria-label*="Opportunity"]', { timeout: 10000 })
    
    // Should NOT show "No opportunities found" when mock has data
    await expect(page.getByText("No opportunities found")).not.toBeVisible()
    
    // Should show opportunities count
    await expect(page.getByText(/\d+ opportunities ranked by form/)).toBeVisible()
    
    // Verify first opportunity card renders with expected player
    const firstCard = page.locator('article[aria-label*="Opportunity 1"]')
    await expect(firstCard).toBeVisible()
    await expect(firstCard.getByText("João Pedro")).toBeVisible()
    await expect(firstCard.getByText("Brighton")).toBeVisible()
    
    // Check position badge (be specific - it's in the player header)
    await expect(firstCard.locator('span.font-semibold').filter({ hasText: 'FWD' }).first()).toBeVisible()
    
    // Verify form chip section exists (chip styling is visible)
    await expect(firstCard.getByText("Hot", { exact: true })).toBeVisible()
    
    // Verify "Why Now" section
    await expect(firstCard.getByText(/Hot form/)).toBeVisible()
    
    // Verify "Beats Who" section
    await expect(firstCard.getByText("Replaces")).toBeVisible()
    await expect(firstCard.getByText("Matheus Cunha")).toBeVisible()
  })

  test("should render multiple opportunity cards", async ({ page }) => {
    await page.goto("/scout")
    
    // Wait for opportunities to load
    await page.waitForSelector('article[aria-label*="Opportunity"]', { timeout: 10000 })
    
    // Verify all three fixture players appear
    await expect(page.getByText("João Pedro")).toBeVisible()
    await expect(page.getByText("Ollie Watkins")).toBeVisible()
    await expect(page.getByText("Pedro Porro")).toBeVisible()
    
    // Count opportunity cards
    const cards = page.locator('article[aria-label*="Opportunity"]')
    await expect(cards).toHaveCount(3)
  })

  test("should display confidence levels correctly", async ({ page }) => {
    await page.goto("/scout")
    await page.waitForSelector('article[aria-label*="Opportunity"]', { timeout: 10000 })
    
    // Check confidence badges exist
    await expect(page.getByText("HIGH", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("MEDIUM", { exact: true })).toBeVisible()
  })

  test("should show kill conditions when expanded", async ({ page }) => {
    await page.goto("/scout")
    await page.waitForSelector('article[aria-label*="Opportunity"]', { timeout: 10000 })
    
    // Find and click kill conditions summary
    const firstCard = page.locator('article[aria-label*="Opportunity 1"]')
    const killSummary = firstCard.locator('summary:has-text("Kill Conditions")')
    await killSummary.click()
    
    // Verify kill conditions appear
    await expect(firstCard.getByText("Loses starting spot")).toBeVisible()
  })

  test("should have no critical accessibility violations", async ({ page }) => {
    await page.goto("/scout")
    await page.waitForSelector('article[aria-label*="Opportunity"]', { timeout: 10000 })
    
    await page.waitForLoadState("networkidle")
    
    // Run a11y checks, excluding color-contrast (pre-existing site-wide issue)
    const axeResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"]) // TODO: Fix site-wide contrast issues
      .analyze()
    
    const criticalViolations = axeResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    )
    
    expect(criticalViolations).toHaveLength(0)
  })

  test("should handle mobile viewport without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/scout")
    
    await page.waitForSelector('article[aria-label*="Opportunity"]', { timeout: 10000 })
    
    // Verify cards are visible
    await expect(page.getByText("João Pedro")).toBeVisible()
    
    // Check no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
  })

  test("should display availability badges (FA/WW)", async ({ page }) => {
    await page.goto("/scout")
    await page.waitForSelector('article[aria-label*="Opportunity"]', { timeout: 10000 })
    
    // Check for FA and WW badges
    await expect(page.getByText("FA").first()).toBeVisible()
    await expect(page.getByText("WW")).toBeVisible()
  })
})

test.describe("Scout Matchup Page", () => {
  test("should load without client-side crash (smoke test)", async ({ page }) => {
    await page.route("**/api/fantrax/form*", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          leagueId: "test-league",
          teamId: "test-team",
          teamName: "Test Team",
          currentPeriod: 27,
          players: [],
        }),
      })
    })

    await page.goto("/scout/matchup")
    
    // Critical: Must not show "Application error: a client-side exception has occurred"
    await expect(page.getByText(/application error.*client-side exception/i)).not.toBeVisible()
    
    // Must show Matchup Prep heading
    await expect(page.getByRole("heading", { name: "Matchup Prep" })).toBeVisible()
  })
})

test.describe("Scout Waivers Page", () => {
  test("should load without client-side crash (smoke test)", async ({ page }) => {
    await page.route("**/api/scout/waivers*", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          leagueId: "test-league",
          teamId: "test-team",
          teamName: "Test Team",
          timestamp: new Date().toISOString(),
          currentPeriod: 27,
          waivers: [],
        }),
      })
    })

    await page.goto("/scout/waivers")
    
    // Critical: Must not show "Application error: a client-side exception has occurred"
    await expect(page.getByText(/application error.*client-side exception/i)).not.toBeVisible()
    
    // Must show Scout Waivers heading
    await expect(page.getByRole("heading", { name: "Scout Waivers" })).toBeVisible()
  })
})

test.describe("Scout Page - Empty State Contract", () => {
  test("should fail if API returns empty when fixture expects data", async ({ page }) => {
    // This test ensures we catch if the Scout API starts returning empty results
    // when our mock has valid opportunities
    
    let apiResponseHadData = false
    
    page.on("response", async (response) => {
      if (response.url().includes("/api/scout/opportunities")) {
        const json = await response.json()
        if (json.opportunities && json.opportunities.length > 0) {
          apiResponseHadData = true
        }
      }
    })
    
    await mockScoutAPI(page)
    await page.goto("/scout")
    await page.waitForLoadState("networkidle")
    
    // Ensure our mock returned data
    expect(apiResponseHadData).toBe(true)
    
    // And that data rendered (not empty state)
    await expect(page.getByText("No opportunities found")).not.toBeVisible()
  })
})
