import { expect, test } from "@playwright/test"
import { mockFantraxAPIs } from "./helpers/api-mocks.js"

const iphone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"

test.describe("mobile chrome", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent: iphone,
  })

  test.beforeEach(async ({ page }) => {
    await mockFantraxAPIs(page)
  })

  test("install banner sits in flow and safe-area classes stay on the chrome", async ({ page }) => {
    await page.goto("/")
    const banner = page.getByRole("region", { name: "Install Over the Moon" })
    await expect(banner).toBeVisible()

    const layout = await page.evaluate(() => {
      const bannerEl = document.querySelector("[aria-label='Install Over the Moon']")
      const header = document.querySelector("header")
      const footer = document.querySelector("footer")
      const main = document.querySelector("#main-content")
      const bannerBox = bannerEl?.getBoundingClientRect()
      const headerBox = header?.getBoundingClientRect()
      const mainBox = main?.getBoundingClientRect()
      return {
        bannerPosition: bannerEl ? getComputedStyle(bannerEl).position : null,
        headerClass: header?.className ?? "",
        footerClass: footer?.className ?? "",
        bannerBottom: bannerBox?.bottom ?? 0,
        headerBottom: headerBox?.bottom ?? 0,
        mainTop: mainBox?.top ?? 0,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }
    })

    expect(layout.bannerPosition).not.toBe("fixed")
    expect(layout.bannerPosition).not.toBe("absolute")
    expect(layout.headerClass).toContain("safe-area-inset-top")
    expect(layout.footerClass).toContain("safe-area-inset-bottom")
    expect(layout.bannerBottom).toBeLessThanOrEqual(layout.mainTop + 1)
    expect(layout.headerBottom).toBeLessThanOrEqual(layout.bannerBottom)
    expect(layout.scrollWidth).toBe(layout.innerWidth)
    expect(layout.innerWidth).toBe(390)

    await banner.getByRole("button", { name: "Dismiss install prompt" }).click()
    await expect(banner).toBeHidden()
    await page.reload()
    await expect(banner).toHaveCount(0)
  })
})
