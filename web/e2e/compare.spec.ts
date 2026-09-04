import { test, expect } from "@playwright/test"
import { assertNoA11yViolations } from "./helpers/accessibility.js"
import { mockFantraxAPIs } from "./helpers/api-mocks.js"

test.describe("Compare Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockFantraxAPIs(page)
  })

  test("should render on desktop", async ({ page }) => {
    await page.goto("/compare")
    
    await expect(page.locator("main")).toBeVisible()
    await expect(page.locator("h1, h2, [role='heading']").first()).toBeVisible()
  })

  test("should render on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/compare")
    
    await expect(page.locator("main")).toBeVisible()
    
    // Check no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
  })

  test("should have no critical accessibility violations on desktop", async ({ page }) => {
    await page.goto("/compare")
    await page.waitForLoadState("networkidle")
    
    // Wait for actual content to render (not just loading state)
    await expect(page.locator("section[aria-label='Player comparison']")).toBeVisible()
    
    await assertNoA11yViolations(page, "Compare page (desktop)")
  })

  test("should have no critical accessibility violations on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/compare")
    await page.waitForLoadState("networkidle")
    
    // Wait for actual content to render (not just loading state)
    await expect(page.locator("section[aria-label='Player comparison']")).toBeVisible()
    
    await assertNoA11yViolations(page, "Compare page (mobile)")
  })
})
