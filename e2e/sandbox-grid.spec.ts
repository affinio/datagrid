import { expect, type Locator, type Page, test } from "@playwright/test"

test.describe("sandbox grid baseline (adapted from affinio datagrid e2e)", () => {
  test("vue base grid updates viewport window on long vertical scroll", async ({ page }) => {
    await page.goto("/vue/base-grid")

    const viewport = page.locator(".table-wrap")
    await expect(viewport).toBeVisible()

    const before = await viewportRangeStart(page)
    await runLongVerticalSession(viewport)
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(before)

    const rendered = await renderedRows(page)
    const total = await totalRows(page)
    expect(rendered).toBeGreaterThan(0)
    expect(total).toBeGreaterThan(rendered)
  })

  test("core base grid keeps virtualization responsive while scrolling", async ({ page }) => {
    await page.goto("/core/base-grid")

    const viewport = page.locator(".table-wrap")
    await expect(viewport).toBeVisible()

    const before = await viewportRangeStart(page)
    await runLongVerticalSession(viewport)
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(before)

    await expect(page.locator(".grid-table tbody tr").nth(1)).toBeVisible()
  })
})

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
