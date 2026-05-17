import { expect, type Locator, type Page, test } from "@playwright/test"

test.describe("sandbox tree + pivot flows (adapted from affinio tree/pivot e2e)", () => {
  test("tree expand/collapse updates model deterministically", async ({ page }) => {
    await page.goto("/vue/tree-grid")

    await expect(page.locator(".grid-row.row--group").first()).toBeVisible()

    await page.getByRole("button", { name: "Collapse all" }).click()
    const collapsed = await stableRowsInModel(page)
    expect(collapsed).toBeGreaterThan(0)

    await page.getByRole("button", { name: "Expand all" }).click()
    await expect.poll(async () => rowsInModel(page)).toBeGreaterThan(collapsed)

    await page.getByRole("button", { name: "Collapse all" }).click()
    await expect.poll(async () => rowsInModel(page)).toBe(collapsed)
  })

  test("tree group anchor survives collapse and expand roundtrip", async ({ page }) => {
    await page.goto("/vue/tree-grid")

    await page.getByRole("button", { name: "Expand all" }).click()

    const groupCell = firstTreeGroupBodyCell(page)
    await expect(groupCell).toBeVisible({ timeout: 20_000 })
    await dispatchMouseDownOnly(page, groupCell)

    const groupSignature = await cellSignature(groupCell)
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(groupSignature)

    await page.getByRole("button", { name: "Collapse all" }).click()
    const collapsed = await stableRowsInModel(page)
    expect(collapsed).toBeGreaterThan(0)
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(groupSignature)

    await page.getByRole("button", { name: "Expand all" }).click()
    await expect.poll(async () => rowsInModel(page)).toBeGreaterThan(collapsed)
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(groupSignature)
    await expect(groupCell).toHaveClass(/grid-cell--selection-anchor/)
  })

  test("pivot layout switch rewires grouped view and keeps pivot rows styled", async ({ page }) => {
    await page.goto("/vue/pivot-grid")

    const firstPivotRowCell = page.locator(".grid-row.row--pivot .grid-cell").first()
    await expect(firstPivotRowCell).toBeVisible()
    const beforePivotColumns = await pivotColumnsCount(page)

    await selectControlOption(page, "Pivot layout", "Channel × Status (Deals Σ)")

    await expect.poll(async () => pivotColumnsCount(page)).not.toBe(beforePivotColumns)
    await expect(page.locator(".grid-row.row--pivot").first()).toBeVisible()

    const pivotColumns = await pivotColumnsCount(page)
    expect(pivotColumns).toBeGreaterThan(0)
  })
})

async function selectControlOption(page: Page, label: string, option: string): Promise<void> {
  const control = page.locator(".controls label").filter({ hasText: label }).first()
  const select = control.locator("select").first()
  await expect(select).toBeVisible()
  await select.selectOption({ label: option })
}

async function rowsInModel(page: Page): Promise<number> {
  const raw = (await page.locator(".meta span").filter({ hasText: "Rows in model:" }).first().textContent())?.trim() ?? ""
  const match = raw.match(/Rows in model:\s*(\d+)/)
  return match ? Number(match[1]) : 0
}

async function stableRowsInModel(page: Page): Promise<number> {
  let previous = -1
  return expect.poll(async () => {
    const next = await rowsInModel(page)
    const stable = next === previous
    previous = next
    return stable ? next : -1
  }).not.toBe(-1).then(async () => rowsInModel(page))
}

async function pivotColumnsCount(page: Page): Promise<number> {
  const raw = (await page.locator(".meta span").filter({ hasText: "Pivot columns:" }).first().textContent())?.trim() ?? ""
  const match = raw.match(/Pivot columns:\s*(\d+)/)
  return match ? Number(match[1]) : 0
}

function firstTreeGroupBodyCell(page: Page): Locator {
  return page.locator(".grid-stage:visible .grid-row.row--group .grid-cell:not(.grid-cell--index)").first()
}

async function dispatchMouseDownOnly(page: Page, target: Locator): Promise<void> {
  const point = await elementCenter(target)
  await target.dispatchEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: 1,
    clientX: point.x,
    clientY: point.y,
  })
  await page.mouse.up()
}

async function selectionAnchorSignature(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const anchorCell = document.querySelector<HTMLElement>(".grid-cell--selection-anchor")
    if (!anchorCell) {
      return "none"
    }
    return [
      anchorCell.getAttribute("data-row-index") ?? "",
      anchorCell.getAttribute("data-column-index") ?? "",
      anchorCell.getAttribute("data-column-key") ?? "",
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

async function elementCenter(target: Locator): Promise<{ x: number; y: number }> {
  return await target.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    }
  })
}
