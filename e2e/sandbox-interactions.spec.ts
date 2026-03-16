import { expect, type Locator, type Page, test } from "@playwright/test"

test.describe("sandbox interaction contracts (adapted from affinio datagrid interactions)", () => {
  test("filter updates row model and recovers on clear", async ({ page }) => {
    await gotoSandboxRoute(page, "/core/base-grid")

    const before = await rowsInModel(page)
    expect(before).toBeGreaterThan(0)

    const filterInput = page.locator(".col-filter-input").nth(1)
    await expect(filterInput).toBeVisible({ timeout: 20_000 })
    await filterInput.fill("CoreEvent 999")

    await expect.poll(async () => rowsInModel(page)).toBeLessThan(before)

    await filterInput.fill("")
    await expect.poll(async () => rowsInModel(page)).toBe(before)
  })

  test("sort control changes first visible row deterministically", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const firstNameBefore = await cellTextByViewportCoord(page, 0, 1)

    const amountMenuButton = page.locator('.grid-cell--header[data-column-key="amount"][data-datagrid-column-menu-trigger="true"]').first()
    await expect(amountMenuButton).toBeVisible({ timeout: 20_000 })
    await amountMenuButton.click()
    await page.locator('[data-datagrid-column-menu-action="sort-desc"]').click()

    await expect.poll(async () => cellTextByViewportCoord(page, 0, 1)).not.toBe(firstNameBefore)
  })

  test("column resize handle changes header width", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const firstHeader = page.locator('.grid-cell--header[data-column-key="name"]').first()
      .or(page.locator('.grid-cell--header').filter({ hasText: /^Task$/ }).first())
    const resizeHandle = firstHeader.locator(".col-resize")

    await expect(firstHeader).toBeVisible({ timeout: 20_000 })
    await expect(resizeHandle).toBeVisible({ timeout: 20_000 })

    const before = await boundingBox(firstHeader)
    await dragResizeHandle(page, resizeHandle, 80)
    const after = await boundingBox(firstHeader)

    expect(after.width).toBeGreaterThan(before.width + 30)
  })

  test("tree group row click toggles expansion", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/tree-grid")

    const groupRow = page.locator(".grid-row.row--group").first()
    await expect(groupRow).toBeVisible({ timeout: 20_000 })

    const before = await rowsInModel(page)
    await groupRow.click()

    await expect
      .poll(async () => rowsInModel(page))
      .not.toBe(before)

    await groupRow.click()
    await expect.poll(async () => rowsInModel(page)).toBe(before)
  })
})

async function gotoSandboxRoute(page: Page, route: string): Promise<void> {
  await page.goto(route)
  await page.waitForLoadState("domcontentloaded")
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined)
  await expect(page.locator(".meta span").filter({ hasText: "Rows in model:" }).first()).toBeVisible({ timeout: 20_000 })
}

async function rowsInModel(page: Page): Promise<number> {
  const raw = (await page.locator(".meta span").filter({ hasText: "Rows in model:" }).first().textContent())?.trim() ?? ""
  const match = raw.match(/Rows in model:\s*(\d+)/)
  return match ? Number(match[1]) : 0
}

async function cellTextByViewportCoord(page: Page, rowIndex: number, columnIndex: number): Promise<string> {
  const cell = page.locator(`.grid-cell[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`).first()
  return (await cell.textContent())?.trim() ?? ""
}

async function dragResizeHandle(page: Page, handle: Locator, deltaX: number): Promise<void> {
  const box = await boundingBox(handle)
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + deltaX, startY)
  await page.mouse.up()
}

async function boundingBox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error("Expected element to be visible with bounding box")
  }
  return box
}
