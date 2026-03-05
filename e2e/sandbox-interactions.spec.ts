import { expect, type Locator, type Page, test } from "@playwright/test"

test.describe("sandbox interaction contracts (adapted from affinio datagrid interactions)", () => {
  test("filter updates row model and recovers on clear", async ({ page }) => {
    await page.goto("/vue/base-grid")

    const before = await rowsInModel(page)
    expect(before).toBeGreaterThan(0)

    const filterInput = page.locator('.controls label:has-text("Filter name") input').first()
    await filterInput.fill("Item 999")

    await expect.poll(async () => rowsInModel(page)).toBeLessThan(before)

    await filterInput.fill("")
    await expect.poll(async () => rowsInModel(page)).toBe(before)
  })

  test("sort control changes first visible row deterministically", async ({ page }) => {
    await page.goto("/vue/base-grid")

    const firstNameBefore = await firstDataCellText(page, 1)

    const sortSelect = page.locator('.controls label:has-text("Sort") select').first()
    await sortSelect.selectOption("amount-desc")
    await nudgeViewport(page)

    await expect.poll(async () => firstDataCellText(page, 1)).not.toBe(firstNameBefore)
  })

  test("column resize handle changes header width", async ({ page }) => {
    await page.goto("/vue/base-grid")

    const firstHeader = page.locator(".grid-table thead th").first()
    const resizeHandle = firstHeader.locator(".col-resize")

    const before = await boundingBox(firstHeader)
    await dragResizeHandle(page, resizeHandle, 80)
    const after = await boundingBox(firstHeader)

    expect(after.width).toBeGreaterThan(before.width + 30)
  })

  test("tree group row click toggles expansion", async ({ page }) => {
    await page.goto("/vue/tree-grid")

    const groupRow = page.locator("tr.row--group").first()
    await expect(groupRow).toBeVisible()

    const before = await rowsInModel(page)
    await groupRow.click()

    const collapsed = await expect
      .poll(async () => rowsInModel(page))
      .toBeLessThan(before)

    await groupRow.click()
    await expect.poll(async () => rowsInModel(page)).toBe(before)
    void collapsed
  })
})

async function rowsInModel(page: Page): Promise<number> {
  const raw = (await page.locator(".meta span").filter({ hasText: "Rows in model:" }).first().textContent())?.trim() ?? ""
  const match = raw.match(/Rows in model:\s*(\d+)/)
  return match ? Number(match[1]) : 0
}

async function firstDataCellText(page: Page, columnIndex: number): Promise<string> {
  const row = page.locator(".grid-table tbody tr").filter({ has: page.locator("td:nth-child(2)") }).first()
  const cell = row.locator("td").nth(columnIndex)
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

async function nudgeViewport(page: Page): Promise<void> {
  const viewport = page.locator(".table-wrap").first()
  await viewport.evaluate(element => {
    element.scrollTop = Math.max(0, element.scrollTop + 1)
    element.dispatchEvent(new Event("scroll"))
  })
}

async function boundingBox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error("Expected element to be visible with bounding box")
  }
  return box
}
