import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright e2e configuration for Over the Moon FPL
 * 
 * Key features:
 * - Desktop & mobile viewport testing (iPhone 12 Pro)
 * - Accessibility testing with axe-core
 * - Automatic test server startup
 * - CI video/screenshot capture for visual evidence
 *   - Always-on video for smoke tests (critical routes)
 *   - Retain-on-failure video for all other tests
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  
  use: {
    baseURL: "http://localhost:3000",
    trace: process.env.CI ? "retain-on-failure" : "on-first-retry",
    screenshot: process.env.CI ? "only-on-failure" : "off",
    video: process.env.CI ? "retain-on-failure" : "off",
  },

  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Safari",
      use: { 
        ...devices["iPhone 12 Pro"],
        // iPhone 12 Pro viewport: 390x844
      },
    },
    // Smoke tests with always-on video for visual evidence
    {
      name: "Smoke Tests (Always Record)",
      testMatch: "**/smoke.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        video: "on",
        screenshot: "on",
      },
    },
  ],

  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
