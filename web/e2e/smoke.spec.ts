import { test, expect } from "@playwright/test"
import { mockFantraxAPIs, mockScoutAPI } from "./helpers/api-mocks.js"

/**
 * Critical smoke tests to prevent black-screen crashes in production
 * 
 * These tests ensure all major routes load without showing:
 * - "Application error: a client-side exception has occurred"
 * - Black screens or missing main content
 * 
 * Tests cover both desktop and mobile viewports for critical pages.
 * Added after production crashes in Scout components (Sept 2026).
 */

test.describe("Smoke Tests - No Black Screen Crashes", () => {
  test.beforeEach(async ({ page }) => {
    // Mock all Fantrax and Scout APIs to prevent external dependencies
    await mockFantraxAPIs(page)
    await mockScoutAPI(page)
  })

  test("should load home page without Application error", async ({ page }) => {
    await page.goto("/")
    
    // Assert NO Application error text
    await expect(page.getByText("Application error")).not.toBeVisible()
    await expect(page.getByText("client-side exception")).not.toBeVisible()
    
    // Assert main content is visible
    const mainContent = page.locator("main#main-content, main")
    await expect(mainContent).toBeVisible()
  })

  test("should load form page without Application error", async ({ page }) => {
    await page.goto("/form")
    
    // Assert NO Application error text
    await expect(page.getByText("Application error")).not.toBeVisible()
    await expect(page.getByText("client-side exception")).not.toBeVisible()
    
    // Assert main content is visible
    const mainContent = page.locator("main#main-content, main")
    await expect(mainContent).toBeVisible()
  })

  test("should load form page on mobile without Application error", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/form")
    
    // Assert NO Application error text
    await expect(page.getByText("Application error")).not.toBeVisible()
    await expect(page.getByText("client-side exception")).not.toBeVisible()
    
    // Assert main content is visible
    const mainContent = page.locator("main#main-content, main")
    await expect(mainContent).toBeVisible()
  })

  test("should load scout page without Application error", async ({ page }) => {
    await page.goto("/scout")
    
    // Assert NO Application error text
    await expect(page.getByText("Application error")).not.toBeVisible()
    await expect(page.getByText("client-side exception")).not.toBeVisible()
    
    // Assert main content is visible
    const mainContent = page.locator("main#main-content, main")
    await expect(mainContent).toBeVisible()
  })

  test("should load scout page on mobile without Application error", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/scout")
    
    // Assert NO Application error text
    await expect(page.getByText("Application error")).not.toBeVisible()
    await expect(page.getByText("client-side exception")).not.toBeVisible()
    
    // Assert main content is visible
    const mainContent = page.locator("main#main-content, main")
    await expect(mainContent).toBeVisible()
  })

  test("should load scout/matchup page without Application error", async ({ page }) => {
    await page.goto("/scout/matchup")
    
    // Assert NO Application error text
    await expect(page.getByText("Application error")).not.toBeVisible()
    await expect(page.getByText("client-side exception")).not.toBeVisible()
    
    // Assert main content is visible
    const mainContent = page.locator("main#main-content, main")
    await expect(mainContent).toBeVisible()
    
    // Assert heading is present (not just loading spinner)
    await expect(page.getByRole("heading", { name: /Matchup Prep/i })).toBeVisible()
  })

  test("should load scout/waivers page without Application error", async ({ page }) => {
    await page.goto("/scout/waivers")
    
    // Assert NO Application error text
    await expect(page.getByText("Application error")).not.toBeVisible()
    await expect(page.getByText("client-side exception")).not.toBeVisible()
    
    // Assert main content is visible
    const mainContent = page.locator("main#main-content, main")
    await expect(mainContent).toBeVisible()
    
    // Assert heading is present (not just loading spinner)
    await expect(page.getByRole("heading", { name: /Scout Waivers/i, level: 1 })).toBeVisible()
  })
})
