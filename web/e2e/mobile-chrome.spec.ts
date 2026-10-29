import sharp from "sharp"
import { expect, test, type Page } from "@playwright/test"
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

  test("install banner sits in flow, stays painted, and safe-area classes stay on the chrome", async ({ page }) => {
    for (const path of ["/", "/form", "/scout"]) {
      await page.goto(path)
      if (path === "/form") {
        await expect(page.getByRole("tablist", { name: "Form views" })).toBeVisible()
      }
      await expectBannerInFlow(page)
    }

    const banner = page.getByRole("region", { name: "Install Over the Moon" })
    await banner.getByRole("button", { name: "Dismiss install prompt" }).click()
    await expect(banner).toBeHidden()
    await page.reload()
    await expect(banner).toHaveCount(0)
  })
})

async function expectBannerInFlow(page: Page) {
  const banner = page.getByRole("region", { name: "Install Over the Moon" })
  await expect(banner).toBeVisible()
  const title = banner.locator("p").filter({ hasText: "Install Over the Moon" })

  const layout = await page.evaluate(() => {
    const bannerEl = document.querySelector("[aria-label='Install Over the Moon']")
    const header = document.querySelector("header")
    const footer = document.querySelector("footer")
    const main = document.querySelector("#main-content")
    const titleEl = [...(bannerEl?.querySelectorAll("p") ?? [])].find((el) =>
      el.textContent?.includes("Install Over the Moon"),
    )
    const bannerBox = bannerEl?.getBoundingClientRect()
    const headerBox = header?.getBoundingClientRect()
    const mainBox = main?.getBoundingClientRect()
    const titleBox = titleEl?.getBoundingClientRect()
    const cx = titleBox ? titleBox.left + titleBox.width / 2 : 0
    const cy = titleBox ? titleBox.top + titleBox.height / 2 : 0
    const hit = document.elementFromPoint(cx, cy)
    return {
      bannerPosition: bannerEl ? getComputedStyle(bannerEl).position : null,
      headerClass: header?.className ?? "",
      footerClass: footer?.className ?? "",
      bannerBottom: bannerBox?.bottom ?? 0,
      headerBottom: headerBox?.bottom ?? 0,
      mainTop: mainBox?.top ?? 0,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      titleHitInside: !!(hit && bannerEl?.contains(hit)),
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
  expect(layout.titleHitInside).toBe(true)

  const png = await title.screenshot()
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let light = 0
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 180 && data[i + 1] > 180 && data[i + 2] > 180) light += 1
  }
  expect(light).toBeGreaterThan(20)
}
