import { expect, type Locator, type Page, test } from "@playwright/test"

test.describe("sandbox tree + pivot flows (adapted from affinio tree/pivot e2e)", () => {
  test("tree expand/collapse updates model deterministically", async ({ page }) => {
    await page.goto("/vue/tree-grid")

    await expect(page.locator(".grid-row.row--group").first()).toBeVisible()

    const before = await rowsInModel(page)
    await page.getByRole("button", { name: "Collapse all" }).click()
    await expect.poll(async () => rowsInModel(page)).toBeLessThan(before)

    await page.getByRole("button", { name: "Expand all" }).click()
    await expect.poll(async () => rowsInModel(page)).toBe(before)
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

async function pivotColumnsCount(page: Page): Promise<number> {
  const raw = (await page.locator(".meta span").filter({ hasText: "Pivot columns:" }).first().textContent())?.trim() ?? ""
  const match = raw.match(/Pivot columns:\s*(\d+)/)
  return match ? Number(match[1]) : 0
}

