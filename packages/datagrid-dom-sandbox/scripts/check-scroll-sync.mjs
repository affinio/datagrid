import assert from "node:assert/strict"
import { chromium } from "@playwright/test"

const baseUrl = process.env.DATAGRID_DOM_SANDBOX_URL ?? "http://127.0.0.1:5175"
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.goto(new URL("/examples/column-virtualization/", baseUrl).href)
  await page.waitForSelector(".affino-grid-dom__body [role=gridcell]")
  await page.evaluate(() => {
    const body = document.querySelector(".affino-grid-dom__body")
    const header = document.querySelector(".affino-grid-dom__header-viewport")
    window.scrollProbe = { wheels: [], frames: [], running: true }
    for (const [surface, element] of [["body", body], ["header", header]]) {
      element.addEventListener("wheel", event => {
        window.scrollProbe.wheels.push({
          surface,
          handled: event.defaultPrevented,
          drift: Math.abs(body.scrollLeft - header.scrollLeft),
        })
      })
    }
    function sample() {
      if (!window.scrollProbe.running) return
      window.scrollProbe.frames.push(Math.abs(body.scrollLeft - header.scrollLeft))
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  for (const selector of [".affino-grid-dom__body", ".affino-grid-dom__header-viewport"]) {
    const box = await page.locator(selector).boundingBox()
    assert.ok(box)
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(60, box.height / 2))
    for (let index = 0; index < 12; index += 1) {
      await page.mouse.wheel(110, 0)
    }
  }
  // Include native-scroll fallback and horizontal limits after the virtual window changes.
  for (const offset of [0, 900, 1e6]) {
    await page.evaluate(offset => {
      document.querySelector(".affino-grid-dom__body").scrollLeft = offset
    }, offset)
    await page.waitForTimeout(100)
    const geometry = await page.evaluate(() => {
      const body = document.querySelector(".affino-grid-dom__body")
      const header = document.querySelector(".affino-grid-dom__header-viewport")
      const row = body.querySelector("[role=row]")
      const drifts = [...header.querySelectorAll("[role=columnheader]")].map(cell => {
        const peer = row.querySelector(`[data-column-index="${cell.dataset.columnIndex}"]`)
        return peer ? Math.abs(cell.getBoundingClientRect().left - peer.getBoundingClientRect().left) : Infinity
      })
      return { offsetDrift: Math.abs(body.scrollLeft - header.scrollLeft), cellDrift: Math.max(...drifts) }
    })
    assert.ok(geometry.offsetDrift < 1, `scroll offset drift at ${offset}: ${geometry.offsetDrift}`)
    assert.ok(geometry.cellDrift < 1, `header/body cell drift at ${offset}: ${geometry.cellDrift}`)
  }
  const result = await page.evaluate(() => {
    window.scrollProbe.running = false
    const probe = window.scrollProbe
    return {
      wheelCount: probe.wheels.length,
      handledWheels: probe.wheels.filter(wheel => wheel.handled).length,
      maxWheelDrift: Math.max(...probe.wheels.map(wheel => wheel.drift)),
      maxFrameDrift: Math.max(...probe.frames),
      surfaces: [...new Set(probe.wheels.map(wheel => wheel.surface))],
    }
  })
  assert.equal(result.wheelCount, 24)
  assert.equal(result.handledWheels, 24)
  assert.deepEqual(result.surfaces, ["body", "header"])
  assert.ok(result.maxWheelDrift < 1, `wheel-task drift: ${result.maxWheelDrift}`)
  assert.ok(result.maxFrameDrift < 1, `frame drift: ${result.maxFrameDrift}`)

  await page.goto(new URL("/examples/shell/", baseUrl).href)
  await page.waitForSelector(".affino-grid-dom__body [role=gridcell]")
  const pinnedColumnGeometry = await page.evaluate(async () => {
    const grid = document.querySelector(".affino-grid-dom")
    const body = document.querySelector(".affino-grid-dom__body")
    const pinnedHeader = document.querySelector('.affino-grid-dom__header--left [data-column-index="0"]')
    const pinnedCell = body.querySelector('[role=row] [data-column-index="0"]')
    const left = body.getBoundingClientRect().left
    const selectionHeader = document.querySelector(".affino-grid-dom__header--left .affino-grid-dom__row-selection-header")
    const expectedPinnedLeft = left + (selectionHeader?.getBoundingClientRect().width ?? 0)
    const headerRect = document.querySelector(".affino-grid-dom__header-shell").getBoundingClientRect()
    const selectAllRect = document.querySelector(".affino-grid-dom__header-overlay-layer .affino-grid-dom__row-selection-header--spanning").getBoundingClientRect()
    const rootBounds = grid.getBoundingClientRect()
    const frameStyle = getComputedStyle(grid, "::after").borderTopStyle
    const samples = []
    for (const offset of [0, 300, 700, 1e6]) {
      body.scrollLeft = offset
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      samples.push({
        bodyLeft: pinnedCell.getBoundingClientRect().left,
        headerLeft: pinnedHeader.getBoundingClientRect().left,
        scrollLeft: body.scrollLeft,
      })
    }
    const after = grid.getBoundingClientRect()
    return {
      left,
      rootRight: rootBounds.right,
      rootBottom: rootBounds.bottom,
      afterRight: after.right,
      afterBottom: after.bottom,
      expectedPinnedLeft,
      selectAllTopDrift: Math.abs(selectAllRect.top - headerRect.top),
      selectAllBottomDrift: Math.abs(selectAllRect.bottom - headerRect.bottom),
      frameStyle,
      samples,
    }
  })
  assert.equal(pinnedColumnGeometry.frameStyle, "solid", "grid frame should remain attached to the viewport")
  assert.ok(pinnedColumnGeometry.samples.every(sample => Math.abs(sample.bodyLeft - pinnedColumnGeometry.expectedPinnedLeft) < 1), "pinned body column should remain fixed while the center scrolls")
  assert.ok(pinnedColumnGeometry.samples.every(sample => Math.abs(sample.headerLeft - pinnedColumnGeometry.expectedPinnedLeft) < 1), "pinned header column should remain aligned with the body")
  assert.ok(pinnedColumnGeometry.selectAllTopDrift < 1, "select-all header cell should start at the top of the multi-row header")
  assert.ok(pinnedColumnGeometry.selectAllBottomDrift < 1, "select-all header cell should span to the bottom of the multi-row header")
  assert.ok(Math.abs(pinnedColumnGeometry.rootRight - pinnedColumnGeometry.afterRight) < 1, "right grid frame should stay fixed while scrolling")
  assert.ok(Math.abs(pinnedColumnGeometry.rootBottom - pinnedColumnGeometry.afterBottom) < 1, "bottom grid frame should stay fixed while scrolling")

  const arrColumnIndex = await page.locator('[data-column-menu-trigger="arr"]').evaluate(trigger =>
    trigger.closest("[data-column-index]")?.getAttribute("data-column-index"),
  )
  assert.ok(arrColumnIndex, "ARR header should expose its logical column index")
  await page.locator(`.affino-grid-dom__body [role="gridcell"][data-row-index="0"][data-column-index="${arrColumnIndex}"]`).click()
  const fillHandle = page.locator("[data-fill-handle]")
  await fillHandle.waitFor({ state: "visible" })
  const handleBox = await fillHandle.boundingBox()
  const pinnedCell = page.locator('.affino-grid-dom__body [role="gridcell"][data-row-index="0"][data-column-index="0"]')
  const pinnedBox = await pinnedCell.boundingBox()
  assert.ok(handleBox && pinnedBox)
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(pinnedBox.x + pinnedBox.width / 2, pinnedBox.y + pinnedBox.height / 2, { steps: 8 })
  await page.waitForTimeout(50)
  const fillOverlayLayers = await page.evaluate(() => ({
    pinnedZIndex: getComputedStyle(document.querySelector('.affino-grid-dom__body .affino-grid-dom__cell--pinned-left[data-column-index="0"]')).zIndex,
    centerOverlayZIndex: getComputedStyle(document.querySelector('.affino-grid-dom__fill-preview-overlay[data-fill-preview-overlay="none"]')).zIndex,
    pinnedOverlayZIndex: getComputedStyle(document.querySelector('.affino-grid-dom__fill-preview-overlay[data-fill-preview-overlay="left"]')).zIndex,
    pinnedPreview: Boolean(document.querySelector('.affino-grid-dom__fill-preview-overlay[data-fill-preview-overlay="left"]')),
  }))
  await page.mouse.up()
  assert.ok(fillOverlayLayers.pinnedPreview, "fill preview should include the pinned pane when dragged across it")
  assert.ok(Number(fillOverlayLayers.pinnedZIndex) > Number(fillOverlayLayers.centerOverlayZIndex), "pinned cells should cover center fill preview bleed")
  assert.ok(Number(fillOverlayLayers.pinnedOverlayZIndex) > Number(fillOverlayLayers.pinnedZIndex), "pinned fill preview should render above its own pane")

  await page.locator(".affino-grid-dom__body").evaluate(body => {
    body.scrollLeft = 640
    body.dispatchEvent(new Event("scroll", { bubbles: true }))
  })
  await page.locator('[data-toolbar-action="group-region"]').click()
  await page.waitForFunction(() => document.querySelector(".affino-grid-dom__body")?.scrollLeft === 0)
  assert.ok(await page.locator(".affino-grid-dom__row--group").count() > 0)
  await page.evaluate(() => {
    const body = document.querySelector(".affino-grid-dom__body")
    const header = document.querySelector(".affino-grid-dom__header-viewport")
    window.groupedScrollProbe = { running: true, frames: [] }
    const sample = () => {
      if (!window.groupedScrollProbe.running) return
      const headerCell = document.querySelector('.affino-grid-dom__header-center .affino-grid-dom__column-header:not(.affino-grid-dom__column-group-header)[data-column-index="3"]')
      const bodyCell = document.querySelector('.affino-grid-dom__body [role="gridcell"][data-column-index="3"]')
      window.groupedScrollProbe.frames.push({
        offsetDrift: Math.abs(body.scrollLeft - header.scrollLeft),
        cellDrift: headerCell && bodyCell
          ? Math.abs(headerCell.getBoundingClientRect().left - bodyCell.getBoundingClientRect().left)
          : Infinity,
        widthDrift: headerCell && bodyCell
          ? Math.abs(headerCell.getBoundingClientRect().width - bodyCell.getBoundingClientRect().width)
          : Infinity,
      })
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  for (const selector of [".affino-grid-dom__body", ".affino-grid-dom__header-viewport"]) {
    const box = await page.locator(selector).boundingBox()
    assert.ok(box)
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(60, box.height / 2))
    for (let index = 0; index < 8; index += 1) await page.mouse.wheel(100, 0)
  }
  await page.waitForTimeout(80)
  const groupedFrameDrifts = await page.evaluate(() => {
    window.groupedScrollProbe.running = false
    return window.groupedScrollProbe.frames
  })
  assert.ok(groupedFrameDrifts.length > 0, "grouped scroll should produce frame samples")
  assert.ok(Math.max(...groupedFrameDrifts.map(frame => frame.offsetDrift)) < 1, "grouped header/body offsets should stay aligned every frame")
  assert.ok(Math.max(...groupedFrameDrifts.map(frame => frame.cellDrift)) < 1, "grouped header/body cells should stay aligned every frame")
  assert.ok(Math.max(...groupedFrameDrifts.map(frame => frame.widthDrift)) < 1, "grouped header/body cells should keep equal widths every frame")

  let groupedMaxCellDrift = 0
  for (const offset of [140, 460, 780, 1e6, 620]) {
    await page.locator(".affino-grid-dom__body").evaluate((body, value) => {
      body.scrollLeft = value
      body.dispatchEvent(new Event("scroll", { bubbles: true }))
    }, offset)
    await page.waitForTimeout(40)
    const geometry = await page.evaluate(() => {
      const body = document.querySelector(".affino-grid-dom__body")
      const header = document.querySelector(".affino-grid-dom__header-viewport")
      const drifts = [...header.querySelectorAll('.affino-grid-dom__column-header:not(.affino-grid-dom__column-group-header)[role="columnheader"][data-column-index]')].map(cell => {
        const peer = body.querySelector(`[role="gridcell"][data-column-index="${cell.dataset.columnIndex}"]`)
        if (!peer) return { position: Infinity, width: Infinity }
        return {
          position: Math.abs(cell.getBoundingClientRect().left - peer.getBoundingClientRect().left),
          width: Math.abs(cell.getBoundingClientRect().width - peer.getBoundingClientRect().width),
        }
      })
      return {
        offsetDrift: Math.abs(body.scrollLeft - header.scrollLeft),
        cellDrift: Math.max(...drifts.map(drift => drift.position)),
        widthDrift: Math.max(...drifts.map(drift => drift.width)),
      }
    })
    assert.ok(geometry.offsetDrift < 1, `grouped scroll offset drift at ${offset}: ${geometry.offsetDrift}`)
    assert.ok(geometry.cellDrift < 1, `grouped header/body cell drift at ${offset}: ${geometry.cellDrift}`)
    assert.ok(geometry.widthDrift < 1, `grouped header/body cell width drift at ${offset}: ${geometry.widthDrift}`)
    groupedMaxCellDrift = Math.max(groupedMaxCellDrift, geometry.cellDrift)
  }
  const groupedRows = await page.locator(".affino-grid-dom__row--group").count()

  await page.locator('[data-toolbar-action="pivot-arr"]').click()
  await page.waitForSelector('.affino-grid-dom__header [data-column-index="5"]')
  await page.waitForTimeout(50)
  const pivotGeometry = await page.evaluate(() => {
    const body = document.querySelector(".affino-grid-dom__body")
    const header = document.querySelector(".affino-grid-dom__header-center")
    const pairs = [...header.querySelectorAll('.affino-grid-dom__column-header:not(.affino-grid-dom__column-group-header)[role="columnheader"][data-column-index]')].map(cell => {
      const peer = body.querySelector(`[role="gridcell"][data-column-index="${cell.dataset.columnIndex}"]`)
      if (!peer) return { position: Infinity, width: Infinity }
      const headerRect = cell.getBoundingClientRect()
      const bodyRect = peer.getBoundingClientRect()
      return {
        position: Math.abs(headerRect.left - bodyRect.left),
        width: Math.abs(headerRect.width - bodyRect.width),
      }
    })
    return {
      cells: pairs.length,
      maxPositionDrift: Math.max(...pairs.map(pair => pair.position)),
      maxWidthDrift: Math.max(...pairs.map(pair => pair.width)),
    }
  })
  assert.ok(pivotGeometry.cells > 1, "pivot view should include generated value columns")
  assert.ok(pivotGeometry.maxPositionDrift < 1, `pivot header/body position drift: ${pivotGeometry.maxPositionDrift}`)
  assert.ok(pivotGeometry.maxWidthDrift < 1, `pivot header/body width drift: ${pivotGeometry.maxWidthDrift}`)
  console.log(JSON.stringify({ ...result, groupedRows, groupedMaxCellDrift, pivotGeometry }))
} finally {
  await browser.close()
}
