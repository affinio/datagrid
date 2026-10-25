import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const output = process.env.BROWSER_AUDIT_OUTPUT ?? '/tmp/affino-browser-integration'
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.25 })
const results = { browser: browser.version(), observations: [], errors: [] }
page.on('pageerror', e => results.errors.push(e.message))
const settle = () => page.evaluate(async () => { for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame) })
async function capture(label, operationResult) {
  await settle()
  results.observations.push({ label, operationResult, ...await page.evaluate(() => {
    const stage = document.querySelector('.grid-stage'), anchor = stage.querySelector('.grid-cell--selection-anchor')
    const b = anchor?.getBoundingClientRect()
    const actual = b ? document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest('[data-row-id][data-column-key]') : null
    const expected = anchor ? { rowId: anchor.dataset.rowId, columnKey: anchor.dataset.columnKey, rowIndex: anchor.dataset.rowIndex, box: b.toJSON() } : null
    const mismatches = []
    const widths = []
    for (const cell of stage.querySelectorAll('.grid-body-content .grid-cell[data-column-key]')) {
      const rect = cell.getBoundingClientRect()
      const header = [...stage.querySelectorAll('.grid-cell--header[data-column-key]')].find(e => e.dataset.columnKey === cell.dataset.columnKey)
      if (header) {
        const h = header.getBoundingClientRect()
        if (Math.abs(h.left - rect.left) > 1 || Math.abs(h.right - rect.right) > 1) mismatches.push({ key: cell.dataset.columnKey, left: h.left - rect.left, right: h.right - rect.right })
      }
      if (!widths.some(x => x.key === cell.dataset.columnKey)) widths.push({ key: cell.dataset.columnKey, width: rect.width })
    }
    return { expected, hit: actual ? { rowId: actual.dataset.rowId, columnKey: actual.dataset.columnKey } : null, widths, mismatches, overlays: [...stage.querySelectorAll('.grid-selection-overlay__segment')].map(e => e.getBoundingClientRect().toJSON()), focus: { class: document.activeElement?.className, connected: document.activeElement?.isConnected, id: document.activeElement?.id }, sticky: [...stage.querySelectorAll('.grid-row[data-datagrid-row-layer="sticky-top"]')].map(e => e.getBoundingClientRect().toJSON()), scroll: [...stage.querySelectorAll('.grid-body-shared-vertical-scroll-shell,.grid-body-center-horizontal-scrollport--scroll-owner')].map(e => ({ top: e.scrollTop, left: e.scrollLeft })) }
  }) })
}
try {
  await page.goto(process.env.BROWSER_FIXTURE_URL ?? 'http://127.0.0.1:4175')
  await page.waitForFunction(() => window.audit?.api())
  await capture('authored-fractional-columns')
  await capture('activate-before-height-change', await page.evaluate(() => window.audit.api().view.activateCell({ rowId: 'audit-50', columnKey: 'c12' }, { selection: 'replace', focus: true })))
  for (const columnKey of ['name', 'total', 'c12']) await capture('activate-original-pane-' + columnKey, await page.evaluate(columnKey => window.audit.api().view.activateCell({ rowId: 'audit-50', columnKey }, { selection: 'replace', focus: true }), columnKey))
  const header = page.locator('.grid-header-viewport .grid-cell--header[data-column-key="c12"]')
  const beforeWidth = (await header.boundingBox()).width
  const resize = await header.locator('.col-resize').boundingBox()
  await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2)
  await page.mouse.down()
  await page.mouse.move(resize.x + resize.width / 2 + 20, resize.y + resize.height / 2)
  await page.mouse.up()
  await capture('native-column-resize-while-scrolled', { beforeWidth, afterWidth: (await header.boundingBox()).width })
  const readHeaders = () => page.locator('.grid-header-viewport .grid-cell--header[data-column-key]').evaluateAll(es => es.map(e => e.dataset.columnKey))
  const beforeOrder = await readHeaders()
  await header.click({ position: { x: 15, y: 12 } })
  await page.keyboard.press('Shift+Alt+ArrowRight')
  await capture('keyboard-column-reorder-while-scrolled', { beforeOrder, afterOrder: await readHeaders() })
  await page.evaluate(() => window.audit.api().view.activateCell({ rowId: 'audit-50', columnKey: 'c12' }, { selection: 'replace', focus: true }))
  await page.evaluate(() => window.audit.api().view.setRowHeightOverrideById('audit-0', 96))
  await page.evaluate(() => window.audit.api().view.refresh())
  await capture('height-change-above-viewport')
  await page.keyboard.press('ArrowDown')
  await capture('keyboard-after-height-change')
  await page.evaluate(() => window.audit.api().rows.setSortModel([{ key: 'c0', direction: 'desc' }]))
  await capture('activate-after-sort', await page.evaluate(() => window.audit.api().view.activateCell({ rowId: 'audit-50', columnKey: 'c12' }, { selection: 'replace', focus: true })))
  await page.evaluate(() => window.audit.api().rows.setGroupBy({ fields: ['region'], expandedByDefault: true }))
  await capture('activate-grouped-leaf', await page.evaluate(() => window.audit.api().view.activateCell({ rowId: 'audit-50', columnKey: 'c12' }, { selection: 'replace', focus: true })))
  await page.evaluate(() => window.audit.api().rows.collapseAllGroups())
  await capture('collapsed-active-parent')
  await capture('activate-collapsed-no-expansion', await page.evaluate(() => window.audit.api().view.activateCell({ rowId: 'audit-50', columnKey: 'c12' }, { selection: 'replace', focus: true, expandAncestors: false })))
  await capture('activate-collapsed-with-expansion', await page.evaluate(() => window.audit.api().view.activateCell({ rowId: 'audit-50', columnKey: 'c12' }, { selection: 'replace', focus: true, expandAncestors: true })))
  for (const columnKey of ['name', 'total', 'c0']) await capture('activate-pane-' + columnKey, await page.evaluate(columnKey => window.audit.api().view.activateCell({ rowId: 'audit-50', columnKey }, { selection: 'replace', focus: true, expandAncestors: true }), columnKey))
  const wheelOwner = await page.locator('.grid-body-center-horizontal-scrollport--scroll-owner').boundingBox()
  await page.mouse.move(wheelOwner.x + wheelOwner.width / 2, wheelOwner.y + wheelOwner.height / 2)
  await page.mouse.wheel(0, 200)
  await settle()
  await capture('native-vertical-wheel')
  await page.mouse.wheel(120, 240)
  await settle()
  await capture('native-vertical-dominant-diagonal-wheel')
  await page.evaluate(() => { document.body.style.zoom = '1.25' })
  await capture('fractional-effective-widths-csszoom125')
  await page.screenshot({ path: output + '/fixture-final.png' })
} catch (error) { results.errors.push(error.stack) }
await browser.close()
await writeFile(output + '/fixture-results.json', JSON.stringify(results, null, 2))
console.log(JSON.stringify({ observations: results.observations.length, errors: results.errors }))
if (results.errors.length) process.exitCode = 1
