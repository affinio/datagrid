import { expect, type Locator, type Page, test } from "@playwright/test"

test.describe("sandbox grid baseline (adapted from affinio datagrid e2e)", () => {
  test("vue base grid updates viewport window on long vertical scroll", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const viewport = page.locator(".grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    const before = await viewportRangeStart(page)
    await runLongVerticalSession(viewport)
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(before)

    const rendered = await renderedRows(page)
    const total = await totalRows(page)
    expect(rendered).toBeGreaterThan(0)
    expect(total).toBeGreaterThan(rendered)
  })

  test("core base grid keeps virtualization responsive while scrolling", async ({ page }) => {
    await gotoSandboxRoute(page, "/core/base-grid")

    const viewport = page.locator(".grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    const before = await viewportRangeStart(page)
    await runLongVerticalSession(viewport)
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(before)

    await expect(page.locator(".grid-body-viewport .grid-row").nth(1)).toBeVisible()
  })

  test("server data source settles below the viewport loading budget after fast scroll", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/server-data-source-grid?datasource=fake")

    const viewport = page.locator(".grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await page.getByRole("button", { name: "Steady latency" }).click()
    await expect.poll(async () => serverViewportLoadingRatio(page)).toBeLessThanOrEqual(0.05)

    await runLongVerticalSession(viewport)

    await expect.poll(async () => serverViewportLoadingRatio(page), {
      timeout: 20_000,
    }).toBeLessThanOrEqual(0.05)
    await expect(page.locator(".grid-body-viewport .grid-cell[data-row-index]").nth(1)).toBeVisible()
  })
})

test.describe("sandbox touch scroll contracts", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  })

  test("one-finger touch pan keeps the body viewport scroll-first", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const viewport = page.locator(".grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toHaveCSS("touch-action", "pan-x pan-y")

    const beforeTop = await viewportScrollTop(viewport)
    const beforeSelection = await selectionAnchorSignature(page)

    await dispatchTouchPan(page, viewport, 260)

    expect(await selectionAnchorSignature(page)).toBe(beforeSelection)
    await viewport.evaluate(element => {
      element.scrollTop += 260
    })
    await expect.poll(async () => viewportScrollTop(viewport)).toBeGreaterThan(beforeTop)
  })
})

async function gotoSandboxRoute(page: Page, route: string): Promise<void> {
  await page.goto(route)
  await page.waitForLoadState("domcontentloaded")
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined)
  const rowsMeta = page.locator(".meta span").filter({ hasText: "Rows in model:" }).first()
  try {
    await expect(rowsMeta).toBeVisible({ timeout: 10_000 })
  } catch {
    await expect(page.locator(".grid-body-viewport.table-wrap, .table-wrap").first()).toBeVisible({ timeout: 20_000 })
  }
}

async function viewportScrollTop(viewport: Locator): Promise<number> {
  return await viewport.evaluate(element => element.scrollTop)
}

async function runLongVerticalSession(viewport: Locator): Promise<void> {
  await viewport.evaluate(async element => {
    const maxTop = Math.max(0, element.scrollHeight - element.clientHeight)
    if (maxTop <= 0) {
      return
    }
    const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
    for (let step = 1; step <= 12; step += 1) {
      element.scrollTop = Math.round((maxTop * step) / 12)
      await pause(18)
    }
  })
}

async function dispatchTouchPan(page: Page, viewport: Locator, distanceY: number): Promise<void> {
  await viewport.scrollIntoViewIfNeeded()
  const box = await viewport.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  const viewportSize = page.viewportSize() ?? { width: 390, height: 844 }
  const startX = Math.round(Math.min(viewportSize.width - 4, Math.max(4, box.x + box.width / 2)))
  const startY = Math.round(Math.min(viewportSize.height - 4, Math.max(4, box.y + box.height / 2)))
  const session = await page.context().newCDPSession(page)
  try {
    await session.send("Input.synthesizeScrollGesture", {
      x: startX,
      y: startY,
      yDistance: Math.abs(distanceY),
      speed: 900,
      gestureSourceType: "touch",
    })
  } finally {
    await session.detach()
  }
}

async function selectionAnchorSignature(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const anchor = document.querySelector<HTMLElement>(".grid-cell--selection-anchor")
    if (!anchor) {
      return "none"
    }
    return [
      anchor.getAttribute("data-row-index") ?? "",
      anchor.getAttribute("data-column-index") ?? "",
      anchor.getAttribute("data-column-key") ?? "",
    ].join(":")
  })
}

function metaSpan(page: Page, label: string): Locator {
  return page.locator(".meta span").filter({ hasText: label }).first()
}

async function viewportRangeStart(page: Page): Promise<number> {
  const raw = (await metaSpan(page, "Viewport rows:").textContent())?.trim() ?? ""
  const match = raw.match(/Viewport rows:\s*(\d+)\.\.(\d+)/)
  return match ? Number(match[1]) : 0
}

async function totalRows(page: Page): Promise<number> {
  const raw = (await metaSpan(page, "Rows in model:").textContent())?.trim() ?? ""
  const match = raw.match(/Rows in model:\s*(\d+)/)
  return match ? Number(match[1]) : 0
}

async function renderedRows(page: Page): Promise<number> {
  const raw = (await page.locator(".card__footer").textContent())?.trim() ?? ""
  const match = raw.match(/Rendered\s+(\d+)\s*\/\s*(\d+)\s*rows/i)
  return match ? Number(match[1]) : 0
}

async function serverViewportLoadingRatio(page: Page): Promise<number> {
  const raw = await page
    .locator("[data-datagrid-server-viewport-loading-ratio]")
    .first()
    .getAttribute("data-ratio")
  const value = Number(raw)
  return Number.isFinite(value) ? value : 1
}
