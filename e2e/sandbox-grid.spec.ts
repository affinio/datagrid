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
    await forceCoarsePointer(page)
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

  test("body cell touch drag does not start selection fill range move or resize", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage").first()
    const viewport = page.locator(".grid-body-viewport.table-wrap, .table-wrap").first()
    const cell = firstEditableAmountCell(page)
    await expect(stage).toHaveClass(/grid-stage--interaction-touch/)
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(cell).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const beforeSelection = await selectionAnchorSignature(page)
    const dragResult = await dispatchTouchDragStartAndMove(cell, amountCellByViewportRow(page, 3))

    expect(dragResult.startPrevented).toBe(false)
    expect(dragResult.movePrevented).toBe(false)
    expect(await selectionAnchorSignature(page)).toBe(beforeSelection)
    await expect(stage).not.toHaveClass(/grid-stage--fill-dragging/)
    await expect(stage).not.toHaveClass(/grid-stage--range-moving/)
    await expect(page.locator(".grid-selection-overlay__segment--fill-preview")).toHaveCount(0)
    await expect(page.locator(".grid-selection-overlay__segment--move-preview")).toHaveCount(0)

    await viewport.evaluate(element => {
      element.scrollTop += 160
    })
    await expect.poll(async () => viewportScrollTop(viewport)).toBeGreaterThan(beforeTop)
  })

  test("body scroll keeps header and pinned panes synchronized", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const viewport = page.locator(".grid-body-viewport.table-wrap, .table-wrap").first()
    const headerViewport = page.locator(".grid-header-viewport").first()
    const leftPaneContent = page.locator(".grid-body-pane--left .grid-pane-content").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(headerViewport).toBeVisible({ timeout: 20_000 })
    await expect(leftPaneContent).toBeVisible({ timeout: 20_000 })

    const scrollState = await setViewportScroll(viewport, { top: 180, left: 260 })

    await expect.poll(async () => viewportScrollLeft(headerViewport)).toBe(scrollState.left)
    await expect.poll(async () => inlineTransformY(leftPaneContent)).toBe(-scrollState.top)
  })

  test("touch pan on pinned pane routes into the body viewport", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const viewport = page.locator(".grid-body-viewport.table-wrap, .table-wrap").first()
    const pinnedPane = page.locator(".grid-body-pane--left").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(pinnedPane).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const beforeSelection = await selectionAnchorSignature(page)
    const pan = await dispatchRoutedTouchPan(pinnedPane, { deltaY: 180 })

    expect(pan.startPrevented).toBe(false)
    expect(pan.movePrevented).toBe(true)
    expect(await selectionAnchorSignature(page)).toBe(beforeSelection)
    await expect.poll(async () => viewportScrollTop(viewport)).toBeGreaterThan(beforeTop)
  })

  test("touch scroll records stage scroll telemetry", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid?dgPerfTrace=1")

    const viewport = page.locator(".grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    const scrollState = await setViewportScroll(viewport, { top: 220, left: 180 })

    await expect.poll(async () => latestPerfSample(page, "stageScrollFrame")).toMatchObject({
      scope: "stageScrollFrame",
      scrollTop: scrollState.top,
      scrollLeft: scrollState.left,
      hasScrollState: 1,
    })
    const frameSample = await latestPerfSample(page, "stageScrollFrame")
    expect(readNumericPerfField(frameSample, "totalMs")).toBeGreaterThanOrEqual(0)
    expect(readNumericPerfField(frameSample, "totalMs")).toBeLessThanOrEqual(50)

    await expect.poll(async () => latestPerfSample(page, "stageScrollPerf")).toMatchObject({
      scope: "stageScrollPerf",
      frameCount: expect.any(Number),
      droppedFrames: expect.any(Number),
      longTaskFrames: expect.any(Number),
      fps: expect.any(Number),
      quality: expect.any(String),
    })
    const perfSample = await latestPerfSample(page, "stageScrollPerf")
    const frameCount = readNumericPerfField(perfSample, "frameCount")
    expect(frameCount).toBeGreaterThanOrEqual(0)
    expect(readNumericPerfField(perfSample, "droppedFrames")).toBeLessThanOrEqual(frameCount)
    expect(readNumericPerfField(perfSample, "longTaskFrames")).toBeLessThanOrEqual(frameCount)
    expect(readNumericPerfField(perfSample, "fps")).toBeGreaterThanOrEqual(0)
    expect(["unknown", "good", "degraded"]).toContain(perfSample?.quality)
  })

  test("stationary long press selects a body cell without opening the context menu", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    await expect(page.locator(".grid-stage").first()).toHaveClass(/grid-stage--interaction-touch/)
    const cell = page
      .locator(".grid-body-viewport .grid-cell[data-row-id][data-row-index][data-column-index]:not(.grid-cell--row-selection)")
      .first()
    await expect(cell).toBeVisible({ timeout: 20_000 })

    const expectedSignature = await cellSignature(cell)
    await dispatchLongPress(page, cell, 650)

    await expect.poll(async () => selectionAnchorSignature(page)).toBe(expectedSignature)
    expect(await dispatchContextMenuAndReadPrevented(cell)).toBe(true)
  })

  test("touch double tap opens editing only when the viewport is idle", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage").first()
    const viewport = page.locator(".grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(stage).toHaveClass(/grid-stage--interaction-touch/)
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    await dispatchTouchGeneratedDoubleClick(firstEditableAmountCell(page))
    await expect(firstEditableAmountCell(page).locator("input.cell-editor-input")).toBeVisible({ timeout: 20_000 })
    await page.keyboard.press("Escape")
    await expect(page.locator(".grid-body-viewport input.cell-editor-input")).toHaveCount(0)

    await markViewportScrolling(viewport)
    await expect(stage).toHaveClass(/grid-stage--scrolling/)

    await dispatchTouchGeneratedDoubleClick(firstEditableAmountCell(page))
    await expect(page.locator(".grid-body-viewport input.cell-editor-input")).toHaveCount(0)

    await expect(stage).not.toHaveClass(/grid-stage--scrolling/)
    await dispatchTouchGeneratedDoubleClick(firstEditableAmountCell(page))
    await expect(firstEditableAmountCell(page).locator("input.cell-editor-input")).toBeVisible({ timeout: 20_000 })
  })

  test("touch fill drag starts only from the explicit fill handle", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage").first()
    const viewport = page.locator(".grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(stage).toHaveClass(/grid-stage--interaction-touch/)
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    const anchorCell = firstEditableAmountCell(page)
    const targetCell = amountCellByViewportRow(page, 1)
    await dispatchLongPress(page, anchorCell, 650)
    await expect(anchorCell.locator(".cell-fill-handle")).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const fillHandle = anchorCell.locator(".cell-fill-handle")
    const touchDrag = await dispatchTouchDragStartAndMove(fillHandle, targetCell)

    expect(touchDrag.startPrevented).toBe(true)
    expect(touchDrag.movePrevented).toBe(true)
    await expect(stage).toHaveClass(/grid-stage--fill-dragging/)
    await expect(page.locator(".grid-selection-overlay__segment--fill-preview").first()).toBeVisible()

    await dispatchMouseUpAt(targetCell)
    await expect(stage).not.toHaveClass(/grid-stage--fill-dragging/)
    expect(await viewportScrollTop(viewport)).toBe(beforeTop)
  })

  test("touch range move drag starts only from the explicit range move handle", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage").first()
    const viewport = page.locator(".grid-body-viewport.table-wrap, .table-wrap").first()
    await expect(stage).toHaveClass(/grid-stage--interaction-touch/)
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    const anchorCell = firstEditableAmountCell(page)
    const targetCell = amountCellByViewportRow(page, 1)
    await dispatchLongPress(page, anchorCell, 650)

    const rangeMoveHandle = anchorCell.locator(".grid-touch-range-move-handle")
    await expect(rangeMoveHandle).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const touchDrag = await dispatchTouchDragStartAndMove(rangeMoveHandle, targetCell)

    expect(touchDrag.startPrevented).toBe(true)
    expect(touchDrag.movePrevented).toBe(true)
    await expect(stage).toHaveClass(/grid-stage--range-moving/)
    await expect(page.locator(".grid-selection-overlay__segment--move-preview").first()).toBeVisible()

    await dispatchMouseUpAt(targetCell)
    await expect(stage).not.toHaveClass(/grid-stage--range-moving/)
    expect(await viewportScrollTop(viewport)).toBe(beforeTop)
  })

  test("touch column resize drag starts from the explicit resize handle", async ({ page }) => {
    await forceCoarsePointer(page)
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage").first()
    const viewport = page.locator(".grid-body-viewport.table-wrap, .table-wrap").first()
    const header = page.locator('.grid-cell--header[data-column-key="name"]').first()
    const resizeHandle = header.locator(".col-resize")
    await expect(stage).toHaveClass(/grid-stage--interaction-touch/)
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(resizeHandle).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const before = await boundingBox(header)
    const touchDrag = await dispatchTouchDragStartAndMove(resizeHandle, {
      x: Math.round(before.x + before.width + 80),
      y: Math.round(before.y + before.height / 2),
    })
    await dispatchMouseUpAtPoint(page, {
      x: Math.round(before.x + before.width + 80),
      y: Math.round(before.y + before.height / 2),
    })

    const after = await boundingBox(header)
    expect(touchDrag.startPrevented).toBe(true)
    expect(touchDrag.movePrevented).toBe(true)
    expect(after.width).toBeGreaterThan(before.width + 30)
    expect(await viewportScrollTop(viewport)).toBe(beforeTop)
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

async function forceCoarsePointer(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalMatchMedia = window.matchMedia.bind(window)
    window.matchMedia = (query: string): MediaQueryList => {
      if (query !== "(hover: none) and (pointer: coarse)") {
        return originalMatchMedia(query)
      }
      return {
        matches: true,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => true,
      } as MediaQueryList
    }
  })
}

async function viewportScrollTop(viewport: Locator): Promise<number> {
  return await viewport.evaluate(element => element.scrollTop)
}

async function viewportScrollLeft(viewport: Locator): Promise<number> {
  return await viewport.evaluate(element => element.scrollLeft)
}

async function setViewportScroll(viewport: Locator, scroll: { top: number; left: number }): Promise<{ top: number; left: number }> {
  return await viewport.evaluate((element, nextScroll) => {
    element.scrollTop = nextScroll.top
    element.scrollLeft = nextScroll.left
    element.dispatchEvent(new Event("scroll", { bubbles: true }))
    return {
      top: element.scrollTop,
      left: element.scrollLeft,
    }
  }, scroll)
}

async function inlineTransformY(locator: Locator): Promise<number | null> {
  return await locator.evaluate(element => {
    const transform = (element as HTMLElement).style.transform
    const match = /translate3d\([^,]+,\s*(-?\d+(?:\.\d+)?)px,/.exec(transform)
    return match ? Number(match[1]) : null
  })
}

async function latestPerfSample(page: Page, scope: string): Promise<Record<string, unknown> | null> {
  return await page.evaluate(sampleScope => {
    const store = (window as typeof window & {
      __AFFINO_DATAGRID_PERF__?: { samples?: Array<Record<string, unknown>> }
    }).__AFFINO_DATAGRID_PERF__
    const samples = store?.samples ?? []
    for (let index = samples.length - 1; index >= 0; index -= 1) {
      const sample = samples[index]
      if (sample?.scope === sampleScope) {
        return sample
      }
    }
    return null
  }, scope)
}

function readNumericPerfField(sample: Record<string, unknown> | null, field: string): number {
  const value = sample?.[field]
  expect(typeof value).toBe("number")
  expect(Number.isFinite(value)).toBe(true)
  return value as number
}

function firstEditableAmountCell(page: Page): Locator {
  return page.locator('.grid-row:not(.row--group) .grid-cell[data-column-key="amount"]').first()
}

function amountCellByViewportRow(page: Page, rowIndex: number): Locator {
  return page.locator(`.grid-body-viewport .grid-cell[data-row-index="${rowIndex}"][data-column-key="amount"]`).first()
}

async function markViewportScrolling(viewport: Locator): Promise<void> {
  await viewport.evaluate(element => {
    element.scrollTop += 80
    element.dispatchEvent(new Event("scroll", { bubbles: true }))
  })
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

async function dispatchRoutedTouchPan(
  target: Locator,
  delta: { deltaX?: number; deltaY?: number },
): Promise<{ startPrevented: boolean; movePrevented: boolean }> {
  await target.scrollIntoViewIfNeeded()
  return await target.evaluate((element, touchDelta) => {
    const rect = element.getBoundingClientRect()
    const startX = Math.round(rect.left + rect.width / 2)
    const startY = Math.round(rect.top + Math.min(rect.height - 2, Math.max(2, rect.height / 2)))
    const touchStart = new Touch({
      identifier: 1,
      target: element,
      clientX: startX,
      clientY: startY,
      radiusX: 6,
      radiusY: 6,
      force: 0.7,
    })
    const startEvent = new TouchEvent("touchstart", {
      bubbles: true,
      cancelable: true,
      touches: [touchStart],
      targetTouches: [touchStart],
      changedTouches: [touchStart],
    })
    const startPrevented = !element.dispatchEvent(startEvent)
    const touchMove = new Touch({
      identifier: 1,
      target: element,
      clientX: startX - (touchDelta.deltaX ?? 0),
      clientY: startY - (touchDelta.deltaY ?? 0),
      radiusX: 6,
      radiusY: 6,
      force: 0.7,
    })
    const moveEvent = new TouchEvent("touchmove", {
      bubbles: true,
      cancelable: true,
      touches: [touchMove],
      targetTouches: [touchMove],
      changedTouches: [touchMove],
    })
    const movePrevented = !element.dispatchEvent(moveEvent)
    element.dispatchEvent(new TouchEvent("touchend", {
      bubbles: true,
      cancelable: true,
      touches: [],
      targetTouches: [],
      changedTouches: [touchMove],
    }))
    return { startPrevented, movePrevented }
  }, delta)
}

async function dispatchLongPress(page: Page, target: Locator, durationMs: number): Promise<void> {
  await target.scrollIntoViewIfNeeded()
  await target.evaluate(async (element, pressDurationMs) => {
    const rect = element.getBoundingClientRect()
    const touch = new Touch({
      identifier: 1,
      target: element,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2),
      radiusX: 6,
      radiusY: 6,
      force: 0.7,
    })
    element.dispatchEvent(new TouchEvent("touchstart", {
      bubbles: true,
      cancelable: true,
      touches: [touch],
      targetTouches: [touch],
      changedTouches: [touch],
    }))
    await new Promise(resolve => window.setTimeout(resolve, pressDurationMs))
    element.dispatchEvent(new TouchEvent("touchend", {
      bubbles: true,
      cancelable: true,
      touches: [],
      targetTouches: [],
      changedTouches: [touch],
    }))
  }, durationMs)
  await page.waitForTimeout(0)
}

async function dispatchTouchGeneratedDoubleClick(target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded()
  await target.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const event = new MouseEvent("dblclick", {
      bubbles: true,
      cancelable: true,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2),
    })
    Object.defineProperty(event, "sourceCapabilities", {
      configurable: true,
      value: { firesTouchEvents: true },
    })
    element.dispatchEvent(event)
  })
}

async function dispatchTouchDragStartAndMove(
  target: Locator,
  moveTo: Locator | { x: number; y: number },
): Promise<{ startPrevented: boolean; movePrevented: boolean }> {
  await target.scrollIntoViewIfNeeded()
  const point = "scrollIntoViewIfNeeded" in moveTo
    ? await elementCenter(moveTo)
    : moveTo
  return await target.evaluate((element, nextPoint) => {
    const rect = element.getBoundingClientRect()
    const startTouch = new Touch({
      identifier: 1,
      target: element,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2),
      radiusX: 6,
      radiusY: 6,
      force: 0.7,
    })
    const startEvent = new TouchEvent("touchstart", {
      bubbles: true,
      cancelable: true,
      touches: [startTouch],
      targetTouches: [startTouch],
      changedTouches: [startTouch],
    })
    element.dispatchEvent(startEvent)
    const moveTouch = new Touch({
      identifier: 1,
      target: element,
      clientX: nextPoint.x,
      clientY: nextPoint.y,
      radiusX: 6,
      radiusY: 6,
      force: 0.7,
    })
    const moveEvent = new TouchEvent("touchmove", {
      bubbles: true,
      cancelable: true,
      touches: [moveTouch],
      targetTouches: [moveTouch],
      changedTouches: [moveTouch],
    })
    element.dispatchEvent(moveEvent)
    return {
      startPrevented: startEvent.defaultPrevented,
      movePrevented: moveEvent.defaultPrevented,
    }
  }, point)
}

async function dispatchMouseUpAt(endAt: Locator): Promise<void> {
  await endAt.scrollIntoViewIfNeeded()
  const point = await elementCenter(endAt)
  await dispatchMouseUpAtPoint(endAt.page(), point)
}

async function dispatchMouseUpAtPoint(page: Page, point: { x: number; y: number }): Promise<void> {
  await page.evaluate(nextPoint => {
    window.dispatchEvent(new MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: nextPoint.x,
      clientY: nextPoint.y,
    }))
  }, point)
}

async function boundingBox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error("Expected element to be visible with bounding box")
  }
  return box
}

async function elementCenter(target: Locator): Promise<{ x: number; y: number }> {
  return await target.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    }
  })
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

async function cellSignature(cell: Locator): Promise<string> {
  return await cell.evaluate(element => [
    element.getAttribute("data-row-index") ?? "",
    element.getAttribute("data-column-index") ?? "",
    element.getAttribute("data-column-key") ?? "",
  ].join(":"))
}

async function dispatchContextMenuAndReadPrevented(target: Locator): Promise<boolean> {
  return await target.evaluate(element => {
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
    return !element.dispatchEvent(event) || event.defaultPrevented
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
