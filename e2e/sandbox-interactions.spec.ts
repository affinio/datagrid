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

    const amountMenuButton = page.locator('[data-datagrid-column-menu-button="true"][data-column-key="amount"]').first()
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

  test("inline editor Tab keeps focus inside grid and advances to the next editable cell", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/shell/base-grid")

    const editableCell = page.locator('.grid-row:not(.row--group) .grid-cell[data-column-key="amount"]').first()
    await expect(editableCell).toBeVisible({ timeout: 20_000 })

    const sourceRowIndex = await editableCell.getAttribute("data-row-index")
    expect(sourceRowIndex).not.toBeNull()

    await editableCell.dblclick()

    const editor = editableCell.locator("input.cell-editor-input").first()
    await expect(editor).toBeVisible({ timeout: 20_000 })
    await editor.press("Tab")

    await expect.poll(async () => selectionAnchorMeta(page)).toMatchObject({
      rowIndex: sourceRowIndex,
      columnKey: "start",
      focusOwnedByGrid: true,
    })
  })

  test("desktop selected-cell body drag starts range move after movement threshold", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage").first()
    const sourceCell = firstEditableAmountCell(page)
    const targetCell = amountCellByViewportRow(page, 1)
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect(targetCell).toBeVisible({ timeout: 20_000 })

    await sourceCell.click()
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(await cellSignature(sourceCell))

    await dragCellBodyStartAndMove(page, sourceCell, targetCell)

    await expect(stage).toHaveClass(/grid-stage--range-moving/)
    await expect(page.locator(".grid-selection-overlay__segment--move-preview").first()).toBeVisible()

    await page.mouse.up()
    await expect(stage).not.toHaveClass(/grid-stage--range-moving/)
  })
})

async function gotoSandboxRoute(page: Page, route: string): Promise<void> {
  await page.goto(route)
  await page.waitForLoadState("domcontentloaded")
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined)
  const rowsMeta = page.locator(".meta span").filter({ hasText: "Rows in model:" }).first()
  try {
    await expect(rowsMeta).toBeVisible({ timeout: 10_000 })
  } catch {
    await expect(page.locator(".grid-body-viewport.table-wrap, .table-wrap").first()).toBeVisible({ timeout: 20_000 })
  }
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

async function selectionAnchorMeta(page: Page): Promise<{
  rowIndex: string | null
  columnIndex: string | null
  columnKey: string | null
  focusOwnedByGrid: boolean
}> {
  return await page.evaluate(() => {
    const anchorCell = document.querySelector<HTMLElement>(".grid-cell--selection-anchor")
    return {
      rowIndex: anchorCell?.getAttribute("data-row-index") ?? null,
      columnIndex: anchorCell?.getAttribute("data-column-index") ?? null,
      columnKey: anchorCell?.getAttribute("data-column-key") ?? null,
      focusOwnedByGrid: document.activeElement?.classList.contains("grid-body-viewport") === true,
    }
  })
}

function firstEditableAmountCell(page: Page): Locator {
  return page.locator('.grid-row:not(.row--group) .grid-cell[data-column-key="amount"]').first()
}

function amountCellByViewportRow(page: Page, rowIndex: number): Locator {
  return page.locator(`.grid-body-viewport .grid-cell[data-row-index="${rowIndex}"][data-column-key="amount"]`).first()
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

async function dragCellBodyStartAndMove(page: Page, source: Locator, target: Locator): Promise<void> {
  const sourceBox = await boundingBox(source)
  const targetBox = await boundingBox(target)
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2)
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
