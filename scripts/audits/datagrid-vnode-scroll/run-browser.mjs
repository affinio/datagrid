import { chromium } from "@playwright/test"

const base = process.env.VNODE_SCROLL_BASE_URL ?? "http://127.0.0.1:4194"
const cases = [
  ["baseline", ""],
  ["virtual-fill", "virtual=1"],
  ["total-zero", "total=0&virtual=1"],
  ["total-loaded-empty", "total=1&virtual=1"],
  ["fourteen-renderers", "columns=1&renderer=1"],
  ["advanced-filter", "filter=1"],
  ["persistence", "persistence=1"],
  ["all-simple", "virtual=1&total=1&columns=1&renderer=1&filter=1&persistence=1"],
  ["all-affino", "affino=1&virtual=1&total=1&columns=1&renderer=1&filter=1&persistence=1"],
]

const browser = await chromium.launch({ headless: true })
const results = []
for (const [name, query] of cases) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  page.on("pageerror", error => results.push({ name, pageerror: error.message }))
  await page.goto(`${base}${query ? `?${query}` : ""}`)
  await page.waitForTimeout(500)
  if (!await page.evaluate(() => Boolean(window.scenario))) {
    results.push({ name, initializationFailed: true })
    await page.close()
    continue
  }
  await page.waitForTimeout(100)
  const before = await page.evaluate(total => window.scenario.respond(total ? 300 : 0, 0), query.includes("total=1"))
  const empty = await page.evaluate(total => window.scenario.empty(total ? 300 : 0), query.includes("total=1"))
  const scroll = await page.evaluate(() => window.scenario.enableScroll())
  const viewport = page.locator(".grid-body-viewport").first()
  const box = await viewport.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, 180)
    await page.waitForTimeout(40)
  }
  const whileScrolling = await page.evaluate(() => window.scenario.scroll())
  const during = await page.evaluate(() => window.scenario.respond(300, 60))
  const after = await page.evaluate(() => window.scenario.errors())
  results.push({ name, before, empty, scroll, whileScrolling, during, after })
  await page.evaluate(() => window.scenario.dispose())
  await page.close()
}
await browser.close()
console.log(JSON.stringify(results, null, 2))
