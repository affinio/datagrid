// Diagnostic browser audit: observations are not assertions of correct behavior.
import { chromium, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseURL = process.env.BROWSER_AUDIT_URL ?? 'http://127.0.0.1:4173'
const output = resolve(process.env.BROWSER_AUDIT_OUTPUT ?? '/tmp/affino-browser-integration')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const report = { browser: browser.version(), baseURL, viewport: { width: 1440, height: 1000 }, observations: [], errors: [] }
const frames = (page, count = 5) => page.evaluate(async count => {
  for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame)
}, count)
async function open(context, path) {
  const page = await context.newPage()
  page.on('pageerror', e => report.errors.push({ path, message: e.message }))
  await page.goto(baseURL + path)
  await page.locator('.grid-body-content .datagrid-stage__cell').first().waitFor()
  await page.locator('.grid-stage').first().scrollIntoViewIfNeeded()
  await frames(page)
  return page
}
async function measure(page, label) {
  const data = await page.evaluate(() => {
    const stage = document.querySelector('.grid-stage')
    const box = e => e?.getBoundingClientRect().toJSON() ?? null
    const cells = [...stage.querySelectorAll('.datagrid-stage__cell[data-row-id][data-column-key]')]
    const hits = [], alignments = []
    for (const cell of cells) {
      const rect = cell.getBoundingClientRect()
      const pane = cell.closest('.grid-body-pane, .grid-body-viewport')
      const clip = pane?.getBoundingClientRect().toJSON()
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2
      if (clip) for (let parent = cell.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), b = parent.getBoundingClientRect()
        if (/(hidden|auto|scroll|clip)/.test(style.overflowX)) { clip.left = Math.max(clip.left, b.left); clip.right = Math.min(clip.right, b.right) }
        if (/(hidden|auto|scroll|clip)/.test(style.overflowY)) { clip.top = Math.max(clip.top, b.top); clip.bottom = Math.min(clip.bottom, b.bottom) }
      }
      if (getComputedStyle(cell).visibility === 'hidden') continue
      if (!clip || !rect.width || x < clip.left || x > clip.right || y < clip.top || y > clip.bottom || y < 0 || y > innerHeight) continue
      const target = document.elementFromPoint(x, y)?.closest('[data-row-id][data-column-key]')
      hits.push({ expected: [cell.dataset.rowId, cell.dataset.columnKey], actual: target ? [target.dataset.rowId, target.dataset.columnKey] : null, x, y })
      const header = [...stage.querySelectorAll('.grid-cell--header[data-column-key]')].find(h => h.dataset.columnKey === cell.dataset.columnKey)
      if (header) {
        const h = header.getBoundingClientRect()
        alignments.push({ key: cell.dataset.columnKey, left: rect.left - h.left, right: rect.right - h.right })
      }
    }
    const anchor = stage.querySelector('.grid-cell--selection-anchor')
    const overlays = [...stage.querySelectorAll('.grid-selection-overlay__segment')].map(e => ({ class: e.className, box: box(e) }))
    const lines = [...stage.querySelectorAll('.grid-chrome-layer__line--vertical')].slice(0, 45).map(e => box(e))
    const canvases = [...stage.querySelectorAll('canvas')].map(canvas => {
      const ctx = canvas.getContext('2d'), y = Math.floor(canvas.height / 2)
      const pixels = ctx && canvas.width && canvas.height ? ctx.getImageData(0, y, canvas.width, 1).data : []
      const transitions = []
      for (let x = 1; x < canvas.width - 1; x++) {
        const offset = x * 4
        if (Math.abs(pixels[offset + 3] - pixels[offset - 1]) > 80) transitions.push(x)
      }
      return { class: canvas.className, box: box(canvas), backing: [canvas.width, canvas.height], alphaTransitionsAtMiddle: transitions }
    })
    const focused = document.activeElement
    const activeDescendants = [...stage.querySelectorAll('[aria-activedescendant]')].map(e => {
      const id = e.getAttribute('aria-activedescendant'), target = document.getElementById(id)
      return { id, exists: !!target, rowId: target?.dataset.rowId, key: target?.dataset.columnKey }
    })
    return { stageClass: stage.className, captures: [...stage.querySelectorAll('*')].filter(e => e.hasPointerCapture?.(1)).length, dpr: devicePixelRatio, cssZoom: getComputedStyle(document.body).zoom, hits, alignments, anchor: anchor ? { rowId: anchor.dataset.rowId, key: anchor.dataset.columnKey, box: box(anchor) } : null, overlays, lines, canvases, activeDescendants, focus: { tag: focused?.tagName, connected: focused?.isConnected, rowId: focused?.dataset?.rowId, key: focused?.dataset?.columnKey }, scroll: [...stage.querySelectorAll('.grid-body-shared-vertical-scroll-shell,.grid-body-center-horizontal-scrollport--scroll-owner')].map(e => ({ class: e.className, top: e.scrollTop, left: e.scrollLeft })), pinned: ['left','right'].map(side => ({ side, box: box(stage.querySelector(`.grid-body-pane--${side}`)) })) }
  })
  report.observations.push({ label, ...data })
  return data
}

try {
  for (const [dpr, zoom] of [[1, 1], [1.25, 1], [2, 1.25]]) {
    const context = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: dpr })
    const page = await open(context, '/vue/grouped-header-grid?rows=1000&cols=32')
    await page.evaluate(zoom => { document.body.style.zoom = String(zoom) }, zoom)
    await frames(page)
    const name = `geometry-dpr${dpr}-csszoom${zoom}`
    await measure(page, name + '-initial')
    const cell = page.locator('.grid-body-content .datagrid-stage__cell[data-column-key="amount"]').first()
    await cell.click()
    await frames(page)
    await measure(page, name + '-selected')
    const scroll = page.locator('.grid-body-center-horizontal-scrollport--scroll-owner').first()
    const rect = await scroll.boundingBox()
    await page.mouse.move(rect.x + rect.width / 2, Math.min(850, rect.y + rect.height / 2))
    await page.mouse.wheel(460, 260)
    await frames(page, 18)
    await measure(page, name + '-diagonal-scroll')
    await page.setViewportSize({ width: 1120, height: 850 })
    await frames(page)
    await measure(page, name + '-resize')
    await page.locator('.grid-stage').evaluate(e => { e.style.display = 'none' })
    await frames(page, 2)
    await page.locator('.grid-stage').evaluate(e => { e.style.display = '' })
    await frames(page)
    await measure(page, name + '-reshow')
    await page.screenshot({ path: resolve(output, name + '.png') })
    await context.close()
  }

  const context = await browser.newContext({ viewport: report.viewport, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await open(context, '/vue/shell/grouped-grid')
  for (const top of [0, 30, 100, 250, 500, 900]) {
    await page.locator('.grid-body-shared-vertical-scroll-shell').first().evaluate((e, top) => { e.scrollTop = top }, top)
    await frames(page)
    const sticky = await page.locator('[data-datagrid-row-layer="sticky-top"]').evaluateAll(es => es.map(e => ({ row: e.dataset.rowId, column: e.dataset.columnKey, box: e.getBoundingClientRect().toJSON(), transform: getComputedStyle(e).transform })))
    report.observations.push({ label: 'sticky-sweep', requestedTop: top, sticky })
    await measure(page, 'sticky-geometry-' + top)
  }
  const vertical = page.locator('.grid-body-shared-vertical-scroll-shell').first()
  const maximum = await vertical.evaluate(e => e.scrollHeight - e.clientHeight)
  let previousRoot = null, previousTop = 0, boundary = null
  for (let top = 1; top <= maximum; top += 500) {
    await vertical.evaluate((e, top) => { e.scrollTop = top }, top)
    await frames(page, 2)
    const root = await page.evaluate(() => document.querySelector('.grid-row[data-datagrid-row-layer="sticky-top"] .grid-cell[data-row-id]')?.getAttribute('data-row-id') ?? null)
    if (root && previousRoot && root !== previousRoot) { boundary = [previousTop, top]; break }
    if (root) { previousRoot = root; previousTop = top }
  }
  if (boundary) {
    while (boundary[1] - boundary[0] > 1) {
      const top = Math.floor((boundary[0] + boundary[1]) / 2)
      await vertical.evaluate((e, top) => { e.scrollTop = top }, top)
      await frames(page, 2)
      const root = await page.evaluate(() => document.querySelector('.grid-row[data-datagrid-row-layer="sticky-top"] .grid-cell[data-row-id]')?.getAttribute('data-row-id') ?? null)
      boundary[root === previousRoot ? 0 : 1] = top
    }
    for (const top of [boundary[1] - 30, boundary[1] - 15, boundary[1] - 1, boundary[1]]) {
      await vertical.evaluate((e, top) => { e.scrollTop = top }, top)
      await frames(page)
      await measure(page, 'sticky-push-off-' + top)
      const target = page.locator('.grid-row[data-datagrid-row-layer="sticky-top"] .grid-cell[data-column-key="__affino_hierarchy__"]').first()
      const b = await target.count() ? await target.boundingBox() : null
      report.observations.push({ label: 'sticky-push-off-box', top, box: b, transform: b ? await target.evaluate(e => getComputedStyle(e.closest('.grid-row')).transform) : null })
    }
  }
  await vertical.evaluate(e => { e.scrollTop = 900 })
  await frames(page, 8)
  const stickyCell = page.locator('.grid-row[data-datagrid-row-layer="sticky-top"] .grid-cell[data-column-key="__affino_hierarchy__"]').first()
  const stickyBox = await stickyCell.boundingBox()
  const stickyPoint = { x: stickyBox.x + stickyBox.width / 2, y: stickyBox.y + stickyBox.height / 2 }
  const stickyBefore = await vertical.evaluate(e => e.scrollTop)
  const stickyHit = await page.evaluate(({ x, y }) => {
    const e = document.elementFromPoint(x, y)?.closest('[data-row-id][data-column-key]')
    return { row: e?.dataset.rowId, key: e?.dataset.columnKey }
  }, stickyPoint)
  await page.mouse.click(stickyPoint.x, stickyPoint.y)
  await frames(page, 8)
  await writeFile(resolve(output, 'sticky-click.json'), JSON.stringify({ before: stickyBefore, after: await vertical.evaluate(e => e.scrollTop), point: stickyPoint, hit: stickyHit, selected: await page.locator('.grid-cell--selection-anchor').evaluateAll(es => es.map(e => ({ row: e.dataset.rowId, key: e.dataset.columnKey, layer: e.dataset.datagridRowLayer, box: e.getBoundingClientRect().toJSON() }))) }, null, 2))
  await page.close()

  const editorPage = await open(context, '/vue/shell/base-grid')
  const amount = editorPage.locator('.grid-row:not(.row--group) .grid-cell[data-column-key="amount"]').first()
  await amount.dblclick()
  await editorPage.locator('input.cell-editor-input').first().waitFor()
  await editorPage.evaluate(() => {
    window.auditIME = []
    for (const name of ['compositionstart', 'compositionend', 'keydown']) document.addEventListener(name, e => window.auditIME.push({ name, key: e.key, composing: e.isComposing, trusted: e.isTrusted }), true)
  })
  const cdp = await context.newCDPSession(editorPage)
  await cdp.send('Input.imeSetComposition', { text: 'に', selectionStart: 1, selectionEnd: 1 })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 })
  report.observations.push({ label: 'ime-enter-during-composition', editorCount: await editorPage.locator('input.cell-editor-input').count() })
  await editorPage.keyboard.press('Escape')
  report.observations.push({ label: 'ime-escape-during-composition', editorCount: await editorPage.locator('input.cell-editor-input').count(), events: await editorPage.evaluate(() => window.auditIME) })
  await cdp.send('Input.insertText', { text: '日本' })
  await editorPage.keyboard.press('Escape')
  report.observations.push({ label: 'ime-escape-after-composition', editorCount: await editorPage.locator('input.cell-editor-input').count() })
  await amount.dblclick()
  await editorPage.keyboard.press('Control+A')
  await editorPage.keyboard.type('123')
  await editorPage.keyboard.press('Enter')
  await measure(editorPage, 'editor-recovery-after-ime')
  const font = await readFile('/usr/share/fonts/truetype/freefont/FreeSansOblique.ttf')
  await editorPage.route('**/audit-font.ttf', route => route.fulfill({ contentType: 'font/ttf', body: font }))
  await editorPage.evaluate(async () => {
    const font = new FontFace('AuditLateFont', 'url(/audit-font.ttf)')
    document.fonts.add(font)
    document.querySelector('.grid-stage').style.fontFamily = 'AuditLateFont, sans-serif'
    await font.load()
    await document.fonts.ready
  })
  await frames(editorPage)
  await measure(editorPage, 'late-font-loaded')
  await amount.dblclick()
  const clipboardEditor = editorPage.locator('input.cell-editor-input').first()
  await clipboardEditor.fill('123')
  await editorPage.keyboard.press('Control+A')
  await editorPage.keyboard.press('Control+C')
  await clipboardEditor.fill('')
  await editorPage.keyboard.press('Control+V')
  report.observations.push({ label: 'editor-native-clipboard', value: await clipboardEditor.inputValue(), editors: await editorPage.locator('input.cell-editor-input').count() })
  await editorPage.keyboard.press('Escape')

  for (const cancel of ['Escape', 'tab-switch-attempt', 'injected-window-blur']) {
    const p = await open(context, '/vue/shell/base-grid')
    await p.locator('.grid-row:not(.row--group) .grid-cell[data-column-key="amount"]').first().click()
    await p.evaluate(() => {
      window.auditEvents = []
      for (const name of ['pointerdown', 'pointercancel', 'lostpointercapture', 'blur']) window.addEventListener(name, e => window.auditEvents.push({ name, trusted: e.isTrusted, pointerId: e.pointerId, targetWindow: e.target === window }), true)
    })
    const handle = await p.locator('.cell-fill-handle:visible').first().boundingBox()
    const viewport = await p.locator('.grid-body-shared-vertical-scroll-shell').first().boundingBox()
    await p.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await p.mouse.down()
    await p.mouse.move(viewport.x + viewport.width / 2, Math.min(970, viewport.y + viewport.height - 3), { steps: 6 })
    await frames(p, 8)
    const before = await measure(p, 'gesture-before-' + cancel)
    let other
    if (cancel === 'Escape') await p.keyboard.press('Escape')
    else if (cancel === 'injected-window-blur') await p.evaluate(() => window.dispatchEvent(new Event('blur')))
    else { other = await context.newPage(); await other.goto('about:blank'); await other.bringToFront() }
    await frames(p, 8)
    const stopped = await measure(p, 'gesture-after-' + cancel)
    await frames(p, 8)
    const drained = await measure(p, 'gesture-drain-' + cancel)
    report.observations.push({ label: 'gesture-cancel-events-' + cancel, events: await p.evaluate(() => window.auditEvents), beforeScroll: before.scroll, afterScroll: stopped.scroll, drainedScroll: drained.scroll })
    await other?.close()
    await p.bringToFront()
    await p.mouse.up()
    await expect(p.locator('.grid-stage')).not.toHaveClass(/grid-stage--scrolling/)
    const recoveryRow = await p.evaluate(() => {
      const v = document.querySelector('.grid-body-shared-vertical-scroll-shell').getBoundingClientRect()
      return [...document.querySelectorAll('.grid-body-content .grid-cell[data-column-key="amount"]')].find(e => {
        const b = e.getBoundingClientRect(); return b.top > v.top + 32 && b.bottom < Math.min(innerHeight, v.bottom)
      })?.dataset.rowId
    })
    await p.locator(`.grid-body-content .grid-cell[data-column-key="amount"][data-row-id="${recoveryRow}"]`).dblclick()
    report.observations.push({ label: 'new-editor-after-' + cancel, count: await p.locator('input.cell-editor-input').count() })
    await p.close()
  }

  const capturePage = await open(context, '/vue/base-grid?rows=1000&cols=32')
  await capturePage.evaluate(() => {
    window.auditEvents = []
    for (const name of ['pointerdown', 'gotpointercapture', 'lostpointercapture']) window.addEventListener(name, e => window.auditEvents.push({ name, trusted: e.isTrusted, pointerId: e.pointerId }), true)
  })
  const index = capturePage.locator('.datagrid-stage__row-index-cell').first()
  const indexBox = await index.boundingBox()
  await capturePage.mouse.move(indexBox.x + indexBox.width / 2, indexBox.y + indexBox.height / 2)
  await capturePage.mouse.down()
  await capturePage.mouse.move(indexBox.x + indexBox.width / 2, indexBox.y + 80)
  await index.evaluate(e => { if (e.hasPointerCapture(1)) e.releasePointerCapture(1) })
  await capturePage.mouse.move(indexBox.x + indexBox.width / 2, indexBox.y + 110)
  await frames(capturePage)
  report.observations.push({ label: 'lostpointercapture', events: await capturePage.evaluate(() => window.auditEvents), stageClass: await capturePage.locator('.grid-stage').getAttribute('class') })
  await capturePage.mouse.up()
  await frames(capturePage)
  await measure(capturePage, 'lostpointercapture-after-up')
  await capturePage.close()

  const resizePage = await open(context, '/vue/base-grid?rows=1000&cols=32')
  const resizeRow = resizePage.locator('.grid-body-pane--left .grid-row[data-row-index="0"]').first()
  const resizeHandle = resizeRow.locator('.row-resize-handle')
  const beforeSelection = await resizeHandle.boundingBox()
  await resizePage.locator('.grid-body-content .grid-cell[data-column-key="amount"][data-row-index="0"]').click()
  const afterSelection = await resizeHandle.boundingBox()
  const rowBefore = await resizeRow.boundingBox()
  await resizePage.evaluate(() => {
    window.auditEvents = []
    for (const name of ['pointerdown', 'mousedown', 'gotpointercapture', 'mouseup']) window.addEventListener(name, e => window.auditEvents.push({ name, trusted: e.isTrusted, target: e.target.className }), true)
  })
  await resizePage.mouse.move(afterSelection.x + afterSelection.width / 2, afterSelection.y + afterSelection.height / 2)
  await resizePage.mouse.down()
  await resizePage.mouse.move(afterSelection.x + afterSelection.width / 2, afterSelection.y + afterSelection.height / 2 + 34, { steps: 4 })
  await resizePage.mouse.up()
  await frames(resizePage)
  report.observations.push({ label: 'selected-row-resize-hit-area', beforeSelection, afterSelection, rowBefore, rowAfter: await resizeRow.boundingBox(), events: await resizePage.evaluate(() => window.auditEvents), style: await resizeHandle.evaluate(e => ({ position: getComputedStyle(e).position, width: getComputedStyle(e).width })) })
  await resizePage.screenshot({ path: resolve(output, 'selected-row-resize.png') })
  await resizePage.close()

  const destroyPage = await open(context, '/vue/shell/base-grid')
  await destroyPage.locator('.grid-body-content .grid-cell[data-column-key="amount"]').first().click()
  const destroyHandle = await destroyPage.locator('.cell-fill-handle:visible').first().boundingBox()
  const destroyViewport = await destroyPage.locator('.grid-body-shared-vertical-scroll-shell').boundingBox()
  await destroyPage.mouse.move(destroyHandle.x + destroyHandle.width / 2, destroyHandle.y + destroyHandle.height / 2)
  await destroyPage.mouse.down()
  await destroyPage.mouse.move(destroyViewport.x + destroyViewport.width / 2, Math.min(970, destroyViewport.y + destroyViewport.height - 3), { steps: 5 })
  await frames(destroyPage)
  await measure(destroyPage, 'before-router-unmount-during-fill')
  await destroyPage.evaluate(() => {
    window.auditOldStage = document.querySelector('.grid-stage')
    document.querySelector('a[href="/vue/state-persistence"]').click()
  })
  await destroyPage.waitForURL('**/vue/state-persistence')
  await frames(destroyPage, 12)
  report.observations.push({ label: 'router-unmount-during-fill', oldConnected: await destroyPage.evaluate(() => window.auditOldStage.isConnected), activePreviews: await destroyPage.locator('[class*="preview"]').count(), stageClass: await destroyPage.locator('.grid-stage').getAttribute('class') })
  await destroyPage.mouse.up()
  await destroyPage.close()
  await context.close()

  const touchContext = await browser.newContext({ viewport: report.viewport, hasTouch: true })
  const touchPage = await open(touchContext, '/vue/base-grid')
  await touchPage.locator('.grid-body-content .grid-cell[data-column-key="amount"]').first().click()
  await touchPage.evaluate(() => {
    window.auditEvents = []
    for (const name of ['pointerdown', 'pointercancel', 'lostpointercapture', 'touchstart', 'touchmove', 'touchcancel']) window.addEventListener(name, e => window.auditEvents.push({ name, trusted: e.isTrusted, pointerType: e.pointerType, target: e.target.className, stage: document.querySelector('.grid-stage').className }), true)
  })
  const touchHandle = await touchPage.locator('.cell-fill-handle:visible').first().boundingBox()
  report.observations.push({ label: 'coarse-fill-handle-hit-area', geometry: await touchPage.locator('.cell-fill-handle:visible').first().evaluate(e => {
    const b = e.getBoundingClientRect(), cell = e.closest('.grid-cell'), c = cell.getBoundingClientRect()
    const center = { x: b.left + b.width / 2, y: b.top + b.height / 2 }
    const at = (x, y) => { const e = document.elementFromPoint(x, y), owner = e?.closest('[data-row-id][data-column-key]'); return { class: e?.className, rowId: owner?.dataset.rowId, key: owner?.dataset.columnKey } }
    return { handle: b.toJSON(), cell: c.toJSON(), expected: { rowId: cell.dataset.rowId, key: cell.dataset.columnKey }, overflow: getComputedStyle(cell).overflow, center, centerHit: at(center.x, center.y), insideHit: at(center.x - 4, center.y - 4), sampleHits: [-10,-4,0,4,10].flatMap(dx => [-10,-4,0,4,10].map(dy => ({ dx, dy, hit: at(center.x + dx, center.y + dy) }))) }
  }) })
  await touchPage.screenshot({ path: resolve(output, 'coarse-fill-handle.png') })
  const touchCDP = await touchContext.newCDPSession(touchPage)
  const point = { x: touchHandle.x + touchHandle.width / 2, y: touchHandle.y + touchHandle.height / 2 }
  await touchCDP.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
  await frames(touchPage, 2)
  await measure(touchPage, 'touch-after-start')
  await touchCDP.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 65 }] })
  await frames(touchPage)
  await measure(touchPage, 'touch-before-pointercancel')
  await touchCDP.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await frames(touchPage)
  await measure(touchPage, 'touch-after-pointercancel')
  report.observations.push({ label: 'native-pointercancel-events', events: await touchPage.evaluate(() => window.auditEvents) })
  const inside = { x: point.x - 4, y: point.y - 4 }
  await touchCDP.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [inside] })
  await frames(touchPage, 2)
  await measure(touchPage, 'touch-inside-handle-start')
  await touchCDP.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...inside, y: inside.y + 65 }] })
  await frames(touchPage)
  await measure(touchPage, 'touch-inside-handle-move')
  await touchCDP.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  await frames(touchPage)
  await measure(touchPage, 'touch-inside-handle-cancel')
  await touchContext.close()
} catch (error) {
  report.errors.push({ harness: true, message: error.stack })
} finally {
  await browser.close()
  await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ output, browser: report.browser, observations: report.observations.length, errors: report.errors }))
  if (report.errors.length) process.exitCode = 1
}
