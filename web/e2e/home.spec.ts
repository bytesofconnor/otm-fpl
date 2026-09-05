import { test, expect } from "@playwright/test"
import { assertNoA11yViolations } from "./helpers/accessibility.js"
import { mockFantraxAPIs } from "./helpers/api-mocks.js"

test.describe("Home (League) Page", () => {
  test.beforeEach(async ({ page }) => {
    await mockFantraxAPIs(page)
  })

  test("should render on desktop", async ({ page }) => {
    await page.goto("/")
    
    // Wait for main content to load
    await expect(page.locator("main")).toBeVisible()
    
    // Check for navigation (structure updated in PR #24)
    await expect(page.locator("nav")).toBeVisible({ timeout: 10000 })
  })

  test("should render on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    
    // Wait for content
    await expect(page.locator("main")).toBeVisible()
    
    // Check for mobile navigation
    const nav = page.locator("nav")
    await expect(nav).toBeVisible()
    
    // Check no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1) // +1 for rounding
  })

  test("should have no critical accessibility violations on desktop", async ({ page }) => {
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    
    await assertNoA11yViolations(page, "Home page (desktop)")
  })

  test("should have no critical accessibility violations on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    
    await assertNoA11yViolations(page, "Home page (mobile)")
  })

  test("should have accessible navigation", async ({ page }) => {
    await page.goto("/")
    
    // Check for navigation landmarks
    const nav = page.locator("nav")
    await expect(nav).toBeVisible()
    
    // Navigation links should be accessible
    const navLinks = nav.locator("a")
    const count = await navLinks.count()
    expect(count).toBeGreaterThan(0)
    
    // All links should have accessible text
    for (let i = 0; i < count; i++) {
      const link = navLinks.nth(i)
      const text = await link.textContent()
      const ariaLabel = await link.getAttribute("aria-label")
      expect(text || ariaLabel).toBeTruthy()
    }
  })
})
