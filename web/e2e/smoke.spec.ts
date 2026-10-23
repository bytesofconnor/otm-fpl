import { test, expect } from "@playwright/test"
import { mockFantraxAPIs, mockScoutAPI } from "./helpers/api-mocks.js"

const SMOKE_PATHS = ["/", "/form", "/scout"] as const

const SMOKE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const

test.describe("Smoke Tests - No Black Screen Crashes", () => {
  test.beforeEach(async ({ page }) => {
    await mockFantraxAPIs(page)
    await mockScoutAPI(page)
  })

  for (const path of SMOKE_PATHS) {
    for (const viewport of SMOKE_VIEWPORTS) {
      test(`should load ${path} at ${viewport.width}x${viewport.height} without crash or blank render`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport)
        await page.goto(path)

        await expect(page.getByText("Application error")).not.toBeVisible()
        await expect(page.getByText("client-side exception")).not.toBeVisible()

        const mainContent = page.getByRole("main")
        await expect(mainContent).toBeVisible()
        await expect(mainContent, `${path} main must not render blank`).toContainText(/\S/)
      })
    }
  }
})
