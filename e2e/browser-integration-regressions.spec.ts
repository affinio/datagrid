import { expect, test } from "@playwright/test"

test("selected row keeps a hittable row-resize handle", async ({ page }) => {
  await page.goto("/vue/base-grid")

  const stage = page.locator(".grid-stage:visible").first()
  const cell = stage.locator('.grid-body-content .grid-cell[data-row-index="0"][data-column-key="amount"]').first()
  const row = stage.locator('.grid-body-pane--left .grid-row[data-row-index="0"]').first()
  const handle = row.locator(".row-resize-handle")
  await expect(cell).toBeVisible()
  await expect(row).toBeVisible()
  await cell.click()
  const anchor = stage.locator(".grid-cell--selection-anchor").first()
  const anchorRowId = await anchor.getAttribute("data-row-id")
  const anchorColumnKey = await anchor.getAttribute("data-column-key")
  const before = (await row.boundingBox())!
  const bounds = (await handle.boundingBox())!
  expect(bounds.width).toBeGreaterThan(0)
  expect(await handle.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === element
  })).toBe(true)

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + 34)
  await expect.poll(async () => (await row.boundingBox())!.height).toBeGreaterThan(before.height + 14)
  await page.mouse.up()
  await expect(stage.locator(`.grid-cell--selection-anchor[data-row-id="${anchorRowId}"][data-column-key="${anchorColumnKey}"]`)).toHaveCount(1)
})

test("keyboard column reorder keeps header and body geometry in sync", async ({ page }) => {
  await page.goto("/vue/shell/base-grid")
  const stage = page.locator(".grid-stage:visible").first()
  const firstHeader = stage.locator(".grid-header-viewport .grid-cell--header[data-column-key]").first()
  await expect(firstHeader).toBeVisible()
  const key = await firstHeader.getAttribute("data-column-key")
  const stableHeader = stage.locator(`.grid-header-viewport .grid-cell--header[data-column-key="${key}"]`).first()
  const bodyCell = stage.locator(`.grid-body-center-horizontal-scrollport--scroll-owner .grid-cell[data-row-index="0"][data-column-key="${key}"]`).first()
  await expect(bodyCell).toBeVisible()

  await firstHeader.focus()
  await page.keyboard.press("Shift+Alt+ArrowRight")

  await expect.poll(async () => {
    const header = await stableHeader.boundingBox()
    const body = await bodyCell.boundingBox()
    return header && body ? Math.max(Math.abs(header.x - body.x), Math.abs(header.width - body.width)) : Number.POSITIVE_INFINITY
  }).toBeLessThanOrEqual(1)
})

test.describe("coarse pointer browser regressions", () => {
  test.use({ hasTouch: true, isMobile: true })

  test("touch fill target stays inside its owning cell and starts a fill gesture", async ({ page, context }) => {
    await page.goto("/vue/base-grid")
    const stage = page.locator(".grid-stage:visible").first()
    const cell = stage.locator('.grid-body-content .grid-cell[data-row-index="0"][data-column-key="amount"]').first()
    await expect(cell).toBeVisible()
    await cell.click()
    const handle = stage.locator(".cell-fill-handle:visible").first()
    await expect(handle).toBeVisible()
    const bounds = (await handle.boundingBox())!
    const cellBounds = (await cell.boundingBox())!
    const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
    expect(await handle.evaluate(element => getComputedStyle(element, "::after").right)).toBe("9px")
    expect(await handle.evaluate(element => getComputedStyle(element, "::after").bottom)).toBe("9px")
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(cellBounds.x + cellBounds.width + 1)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(cellBounds.y + cellBounds.height + 1)
    expect(await handle.evaluate((element, p) => {
      const hit = document.elementFromPoint(p.x, p.y)
      return hit === element || element.contains(hit)
    }, point)).toBe(true)

    const cdp = await context.newCDPSession(page)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] })
    await expect(stage).toHaveClass(/grid-stage--fill-dragging/)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] })
    await expect(stage).not.toHaveClass(/grid-stage--fill-dragging/)
    await expect(stage.locator(".grid-selection-overlay__segment--fill-preview")).toHaveCount(0)
  })
})

test("diagonal wheel scroll moves both axes together", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 })
  await page.goto("/vue/grouped-header-grid?rows=1000&cols=32")
  const stage = page.locator(".grid-stage:visible").first()
  const horizontal = stage.locator(".grid-body-center-horizontal-scrollport--scroll-owner")
  const vertical = stage.locator(".grid-body-shared-vertical-scroll-shell")
  await expect(horizontal).toBeVisible()
  await expect(vertical).toBeVisible()
  await vertical.evaluate(element => { element.scrollTop = 300 })
  await horizontal.evaluate(element => { element.scrollLeft = 0 })
  const before = await Promise.all([
    horizontal.evaluate(element => element.scrollLeft),
    vertical.evaluate(element => element.scrollTop),
  ])
  const bounds = (await horizontal.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.wheel(120, 240)

  await expect.poll(async () => vertical.evaluate(element => element.scrollTop)).toBeGreaterThan(before[1] + 100)
  await expect.poll(async () => horizontal.evaluate(element => element.scrollLeft)).toBeGreaterThan(before[0] + 100)

  const afterFirstDiagonal = await Promise.all([
    horizontal.evaluate(element => element.scrollLeft),
    vertical.evaluate(element => element.scrollTop),
  ])
  await page.mouse.wheel(240, 120)
  await expect.poll(async () => horizontal.evaluate(element => element.scrollLeft)).toBeGreaterThan(afterFirstDiagonal[0] + 100)
  await expect.poll(async () => vertical.evaluate(element => element.scrollTop)).toBeGreaterThan(afterFirstDiagonal[1] + 50)
})
