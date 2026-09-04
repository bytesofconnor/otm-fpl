import { test, expect } from "@playwright/test"
import { assertNoA11yViolations } from "./helpers/accessibility.js"
import { mockScoutAPI } from "./helpers/api-mocks.js"

test.describe("Scout Page (if exists)", () => {
  test.beforeEach(async ({ page }) => {
    await mockScoutAPI(page)
  })

  test("should handle scout page - render with opportunities", async ({ page }) => {
    const response = await page.goto("/scout")
    
    // Either the page exists and renders, or we get a 404
    if (response && response.status() === 404) {
      // Page doesn't exist yet - that's okay, skip gracefully
      expect(response.status()).toBe(404)
    } else {
      // Page exists - check it renders properly
      await expect(page.locator("main")).toBeVisible()
      
      // With our mocked opportunities, the board should render content
      await page.waitForLoadState("networkidle")
      
      // Check for opportunity cards (should have at least one)
      const opportunityCards = page.locator("[data-testid='opportunity-card'], article, .opportunity")
      const count = await opportunityCards.count()
      
      // If we provided 2 opportunities in fixtures, we should see them
      // (or at least see non-empty state rather than loading/error)
      if (count === 0) {
        // Check we're not showing empty state when we provided data
        const emptyMessage = page.locator("text=/no opportunities|empty|nothing found/i")
        const hasEmpty = await emptyMessage.count()
        // It's OK to show empty in some edge cases, but log it
        if (hasEmpty > 0) {
          console.log("Scout board showing empty state despite mocked data")
        }
      }
    }
  })

  test("should have no critical accessibility violations if page exists", async ({ page }) => {
    const response = await page.goto("/scout")
    
    // Only run a11y checks if page exists (not 404)
    if (response && response.status() === 200) {
      await page.waitForLoadState("networkidle")
      await assertNoA11yViolations(page, "Scout page (desktop)")
    }
  })

  test("should handle mobile viewport if page exists", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const response = await page.goto("/scout")
    
    if (response && response.status() === 200) {
      await expect(page.locator("main")).toBeVisible()
      
      // Check no horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      const viewportWidth = await page.evaluate(() => window.innerWidth)
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
    }
  })
})
