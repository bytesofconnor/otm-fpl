import { test, expect } from "@playwright/test"
import { mockFantraxAPIs, mockScoutAPI } from "./helpers/api-mocks.js"
import { assertNoA11yViolations } from "./helpers/accessibility.js"

/**
 * Scout Waivers page tests
 * Tests the /scout/waivers route for basic load and Suspense handling
 */

test.describe("Scout Waivers Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockFantraxAPIs(page)
    await mockScoutAPI(page)
  })

  test("should load waivers page without crash", async ({ page }) => {
    await page.goto("/scout/waivers")
    
    // Page should load with heading
    await expect(page.getByRole("heading", { name: /Scout Waivers/i, level: 1 })).toBeVisible()
    
    // Main content should be visible
    const mainContent = page.locator("main#main-content, main")
    await expect(mainContent).toBeVisible()
    
    // Should NOT show Application error
    await expect(page.getByText("Application error")).not.toBeVisible()
  })

  test("should render team picker or manager label", async ({ page }) => {
    await page.goto("/scout/waivers")
    
    // Wait for page to settle (Suspense to resolve)
    await page.waitForLoadState("networkidle")
    
    // Should show either team picker dropdown or manager name/label
    const teamPickerOrLabel = page.locator('text=/Manager|Saints Intelligence Agency|Team/i').first()
    await expect(teamPickerOrLabel).toBeVisible({ timeout: 10000 })
  })

  test("should show waivers content or loading state (not crash)", async ({ page }) => {
    await page.goto("/scout/waivers")
    
    // Should either show waiver board or a loading fallback
    // But NOT an error or blank screen
    await page.waitForLoadState("networkidle")
    
    // Main content area should exist
    const main = page.locator("main")
    await expect(main).toBeVisible()
    
    // Should not be completely empty (has at least header + description)
    const heading = page.getByRole("heading", { name: /Scout Waivers/i })
    await expect(heading).toBeVisible()
    
    const description = page.getByText(/Waiver wire claim priorities/i)
    await expect(description).toBeVisible()
  })

  test("should have no critical accessibility violations", async ({ page }) => {
    await page.goto("/scout/waivers")
    await page.waitForLoadState("networkidle")
    
    await assertNoA11yViolations(page, "Scout Waivers page")
  })
})
