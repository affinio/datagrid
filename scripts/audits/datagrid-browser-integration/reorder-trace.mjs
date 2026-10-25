import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto(process.env.BROWSER_FIXTURE_URL ?? 'http://127.0.0.1:4175')
await page.waitForFunction(() => window.audit?.api())
await page.evaluate(() => window.audit.api().view.activateCell({ rowId: 'audit-50', columnKey: 'c12' }, { selection: 'replace', focus: true }))
const header = page.locator('.grid-header-viewport .grid-cell--header[data-column-key="c12"]')
await header.click({ position: { x: 15, y: 12 } })
await page.keyboard.press('Shift+Alt+ArrowRight')
const frames = await page.evaluate(async () => {
  const samples = [], start = performance.now()
  for (let frame = 0; frame < 14; frame++) {
    await new Promise(requestAnimationFrame)
    const h = document.querySelector('.grid-header-viewport .grid-cell--header[data-column-key="c12"]')
    const viewport = document.querySelector('.grid-body-shared-vertical-scroll-shell').getBoundingClientRect()
    const c = [...document.querySelectorAll('.grid-body-content .grid-cell[data-column-key="c12"]')].find(e => {
      const b = e.getBoundingClientRect(); return b.top >= viewport.top && b.bottom <= viewport.bottom
    })
    const header = h.getBoundingClientRect(), cell = c?.getBoundingClientRect()
    const bodyHit = cell ? document.elementFromPoint(header.left + header.width / 2, cell.top + cell.height / 2)?.closest('[data-column-key]') : null
    samples.push({ frame, elapsed: performance.now() - start, header: header.toJSON(), cell: cell?.toJSON(), headerTransform: getComputedStyle(h).transform, columnBelowHeaderCenter: bodyHit?.dataset.columnKey, animations: h.getAnimations().map(a => ({ time: a.currentTime, duration: a.effect.getTiming().duration })) })
  }
  return samples
})
await browser.close()
await writeFile((process.env.BROWSER_AUDIT_OUTPUT ?? '/tmp/affino-browser-integration') + '/reorder-trace.json', JSON.stringify(frames, null, 2))
console.log(JSON.stringify({ samples: frames.length, maxDelta: Math.max(...frames.map(x => x.cell ? Math.abs(x.header.left - x.cell.left) : 0)), finalDelta: frames.at(-1).header.left - frames.at(-1).cell.left }))
