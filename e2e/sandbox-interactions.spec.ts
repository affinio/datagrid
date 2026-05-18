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

  test("desktop drag selection remains stable across virtualized rows and a pinned column", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")
    await pinColumnRight(page, "amount")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="0"][data-column-key="name"]').first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const sourceBox = await boundingBox(sourceCell)
    const viewportBox = await boundingBox(viewport)
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(viewportBox.x + viewportBox.width - 12, viewportBox.y + viewportBox.height - 10, { steps: 8 })

    await expect.poll(async () => viewportScrollTop(viewport), { timeout: 10_000 }).toBeGreaterThan(beforeTop)
    await page.mouse.up()

    await expect(stage).not.toHaveClass(/grid-stage--range-moving/)
    await expect(page.locator(".grid-selection-overlay__segment--move-preview")).toHaveCount(0)
    await expect(page.locator(".grid-cell--selected").first()).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.grid-stage:visible .grid-body-pane--right .grid-cell[data-column-key="amount"]').first()).toBeVisible()
  })

  test("selection anchor remounts with overlay fill handle and keyboard focus after vertical virtualization", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]').first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })

    await sourceCell.click()
    const sourceSignature = await cellSignature(sourceCell)
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(sourceSignature)
    await expect(sourceCell).toHaveClass(/grid-cell--selection-anchor/)
    await expect(sourceCell.locator(".cell-fill-handle")).toBeVisible({ timeout: 20_000 })
    await expect(page.locator(".grid-stage:visible .grid-selection-overlay__segment").first()).toBeVisible({ timeout: 20_000 })

    await setViewportScroll(viewport, { top: 1_400, left: 0 })
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(2)
    await expect(page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]')).toHaveCount(0)

    await setViewportScroll(viewport, { top: 0, left: 0 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(sourceSignature)
    await expect(sourceCell).toHaveClass(/grid-cell--selection-anchor/)
    await expect(sourceCell.locator(".cell-fill-handle")).toBeVisible({ timeout: 20_000 })
    await expect(page.locator(".grid-stage:visible .grid-selection-overlay__segment").first()).toBeVisible({ timeout: 20_000 })
    await expect(stage).not.toHaveClass(/grid-stage--scrolling/)

    await page.keyboard.press("ArrowDown")
    const nextCell = page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="3"][data-column-key="amount"]').first()
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(await cellSignature(nextCell))
  })

  test("virtualized cells keep aria indexes after scroll and keyboard navigation", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const viewport = page.locator(".grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]').first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toHaveAttribute("role", "grid")
    await expect(viewport).toHaveAttribute("aria-rowcount", "10000")
    await expect(viewport).toHaveAttribute("aria-colcount", "17")
    await expect(sourceCell).toHaveAttribute("role", "gridcell")
    await expect(sourceCell).toHaveAttribute("aria-rowindex", "3")
    await expect(sourceCell).toHaveAttribute("aria-colindex", String(Number(await sourceCell.getAttribute("data-column-index")) + 1))

    await sourceCell.click()
    await page.keyboard.press("ArrowDown")
    const nextCell = page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="3"][data-column-key="amount"]').first()
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(await cellSignature(nextCell))
    await expect(nextCell).toHaveAttribute("aria-selected", "true")
    await expect(nextCell).toHaveAttribute("aria-rowindex", "4")

    await setViewportScroll(viewport, { top: 1_400, left: 0 })
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(2)
    const remountedCell = page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-column-key="amount"]').first()
    await expect(remountedCell).toBeVisible({ timeout: 20_000 })
    const rowIndex = Number(await remountedCell.getAttribute("data-row-index"))
    expect(rowIndex).toBeGreaterThan(2)
    await expect(remountedCell).toHaveAttribute("aria-rowindex", String(rowIndex + 1))
    await expect(remountedCell).toHaveAttribute("aria-colindex", String(Number(await remountedCell.getAttribute("data-column-index")) + 1))
  })

  test("right-pinned selection anchor remounts with overlay fill handle after vertical virtualization", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")
    await pinColumnRight(page, "amount")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = page.locator('.grid-stage:visible .grid-body-pane--right .grid-cell[data-row-index="2"][data-column-key="amount"]').first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })

    await sourceCell.click()
    const sourceSignature = await cellSignature(sourceCell)
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(sourceSignature)
    await expect(sourceCell).toHaveClass(/grid-cell--selection-anchor/)
    await expect(sourceCell.locator(".cell-fill-handle")).toBeVisible({ timeout: 20_000 })
    await expect(page.locator(".grid-stage:visible .grid-body-pane--right .grid-selection-overlay__segment").first()).toBeVisible({ timeout: 20_000 })

    await setViewportScroll(viewport, { top: 1_400, left: 0 })
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(2)
    await expect(page.locator('.grid-stage:visible .grid-body-pane--right .grid-cell[data-row-index="2"][data-column-key="amount"]')).toHaveCount(0)

    await setViewportScroll(viewport, { top: 0, left: 0 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(sourceSignature)
    await expect(sourceCell).toHaveClass(/grid-cell--selection-anchor/)
    await expect(sourceCell.locator(".cell-fill-handle")).toBeVisible({ timeout: 20_000 })
    await expect(page.locator(".grid-stage:visible .grid-body-pane--right .grid-selection-overlay__segment").first()).toBeVisible({ timeout: 20_000 })
    await expect(stage).not.toHaveClass(/grid-stage--scrolling/)
  })

  test("active cell focus returns to the remounted anchor after vertical virtualization", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]').first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })

    await sourceCell.click()
    const sourceSignature = await cellSignature(sourceCell)
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(sourceSignature)
    await expect.poll(async () => activeElementSignature(page)).toBe(sourceSignature)

    await setViewportScroll(viewport, { top: 1_400, left: 0 })
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(2)
    await expect(page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]')).toHaveCount(0)

    await setViewportScroll(viewport, { top: 0, left: 0 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(sourceSignature)
    await expect.poll(async () => activeElementSignature(page)).toBe(sourceSignature)
  })

  test("keyboard navigation past the rendered range keeps the active cell focused", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const viewport = page.locator(".grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]').first()
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })

    await sourceCell.click()
    for (let index = 0; index < 36; index += 1) {
      await page.keyboard.press("ArrowDown")
    }

    const targetCell = page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="38"][data-column-key="amount"]').first()
    await expect(targetCell).toBeVisible({ timeout: 20_000 })
    const targetSignature = await cellSignature(targetCell)
    await expect.poll(async () => viewportRangeStart(page), { timeout: 10_000 }).toBeGreaterThan(2)
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(targetSignature)
    await expect.poll(async () => activeElementSignature(page)).toBe(targetSignature)
  })

  test("selection anchor remounts with overlay fill handle after horizontal virtualization", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]').first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })

    await sourceCell.click()
    const sourceSignature = await cellSignature(sourceCell)
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(sourceSignature)
    await expect(sourceCell).toHaveClass(/grid-cell--selection-anchor/)
    await expect(sourceCell.locator(".cell-fill-handle")).toBeVisible({ timeout: 20_000 })

    await setViewportScroll(viewport, { top: 0, left: 2_400 })
    await expect.poll(async () => viewportScrollLeft(viewport)).toBeGreaterThan(0)
    await expect(page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]')).toHaveCount(0)

    await setViewportScroll(viewport, { top: 0, left: 0 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(sourceSignature)
    await expect(sourceCell).toHaveClass(/grid-cell--selection-anchor/)
    await expect(sourceCell.locator(".cell-fill-handle")).toBeVisible({ timeout: 20_000 })
    await expect(page.locator(".grid-stage:visible .grid-selection-overlay__segment").first()).toBeVisible({ timeout: 20_000 })
    await expect(stage).not.toHaveClass(/grid-stage--scrolling/)
  })

  test("inline editor draft commits when its row leaves the virtual window", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]').first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })

    await sourceCell.dblclick()
    const sourceSignature = await cellSignature(sourceCell)
    const editor = sourceCell.locator("input.cell-editor-input").first()
    await expect(editor).toBeVisible({ timeout: 20_000 })
    await editor.fill("98765")

    await setViewportScroll(viewport, { top: 1_400, left: 0 })
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(2)
    await expect(sourceCell).toHaveCount(0)
    await expect(page.locator("input.cell-editor-input")).toHaveCount(0)

    await setViewportScroll(viewport, { top: 0, left: 0 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(sourceSignature)
    await expect(sourceCell).toHaveClass(/grid-cell--selection-anchor/)
    await expect(sourceCell).toContainText("£98,765.00")
    await expect(stage).not.toHaveClass(/grid-stage--scrolling/)
  })

  test("additive selection ranges remount after horizontal virtualization", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-viewport.table-wrap").first()
    const previousCell = page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="name"]').first()
    const activeCell = page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]').first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(previousCell).toBeVisible({ timeout: 20_000 })
    await expect(activeCell).toBeVisible({ timeout: 20_000 })

    await previousCell.click()
    await activeCell.click({ modifiers: ["Control"] })

    const previousSignature = await cellSignature(previousCell)
    const activeSignature = await cellSignature(activeCell)
    await expect(stage).toHaveClass(/grid-stage--additive-selection/)
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(activeSignature)
    await expect(previousCell).toHaveClass(/grid-cell--selected/)
    await expect(activeCell).toHaveClass(/grid-cell--selection-anchor/)
    await expect.poll(async () => selectedCellSignatures(page)).toEqual(expect.arrayContaining([previousSignature, activeSignature]))

    await setViewportScroll(viewport, { top: 0, left: 2_400 })
    await expect.poll(async () => viewportScrollLeft(viewport)).toBeGreaterThan(0)
    await expect(page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]')).toHaveCount(0)

    await setViewportScroll(viewport, { top: 0, left: 0 })
    await expect(previousCell).toBeVisible({ timeout: 20_000 })
    await expect(activeCell).toBeVisible({ timeout: 20_000 })
    await expect(stage).toHaveClass(/grid-stage--additive-selection/)
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(activeSignature)
    await expect(previousCell).toHaveClass(/grid-cell--selected/)
    await expect(activeCell).toHaveClass(/grid-cell--selection-anchor/)
    await expect(activeCell.locator(".cell-fill-handle")).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => selectedCellSignatures(page)).toEqual(expect.arrayContaining([previousSignature, activeSignature]))
    await expect(stage).not.toHaveClass(/grid-stage--scrolling/)
  })

  test("placeholder tail materialization keeps selection anchor and fill handle", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/shell/base-grid")

    await page.locator('.controls label:has-text("Rows") select').selectOption("1000")
    await page.locator('.controls label:has-text("Placeholder tail") input[type="checkbox"]').check()

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-viewport.table-wrap").first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await setViewportScroll(viewport, { top: 100_000, left: 0 })

    const placeholderAmountCell = page.locator(
      '.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="1000"][data-row-id="__datagrid_placeholder__:1000"][data-column-key="amount"]',
    ).first()
    await expect(placeholderAmountCell).toBeVisible({ timeout: 20_000 })
    await expect(stage).not.toHaveClass(/grid-stage--scrolling/)

    await placeholderAmountCell.dblclick()
    const editor = placeholderAmountCell.locator("input.cell-editor-input").first()
    await expect(editor).toBeVisible({ timeout: 20_000 })
    await editor.fill("4321")
    await editor.blur()

    const materializedAmountCell = page.locator(
      '.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="1000"][data-row-id="sandbox-placeholder-1001"][data-column-key="amount"]',
    ).first()
    await expect(materializedAmountCell).toBeVisible({ timeout: 20_000 })
    await expect(materializedAmountCell).toHaveClass(/grid-cell--selection-anchor/)
    await expect(materializedAmountCell.locator(".cell-fill-handle")).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(await cellSignature(materializedAmountCell))
  })

  test("server datasource loading placeholder replacement keeps selection anchor", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/server-data-source-grid?datasource=fake")

    const stage = page.locator(".sandbox-server-data-source-grid .grid-stage:visible").first()
    const viewport = page.locator(".sandbox-server-data-source-grid .grid-body-viewport.table-wrap").first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    await page.getByRole("button", { name: "Slow backend" }).click()
    await viewport.evaluate(element => {
      const maxTop = Math.max(0, element.scrollHeight - element.clientHeight)
      element.scrollTop = Math.round(maxTop * 0.55)
      element.dispatchEvent(new Event("scroll", { bubbles: true }))
    })

    const loadingCell = page.locator(
      '.sandbox-server-data-source-grid .grid-body-viewport .grid-cell[data-row-id^="__affino_datagrid_data_source_loading__:"][data-column-key="name"]',
    ).first()
    await expect(loadingCell).toBeVisible({ timeout: 20_000 })
    const rowIndex = await loadingCell.getAttribute("data-row-index")
    const loadingRowId = await loadingCell.getAttribute("data-row-id")
    expect(rowIndex).toBeTruthy()
    expect(loadingRowId).toMatch(/^__affino_datagrid_data_source_loading__:\d+$/)
    await expect(loadingCell).toHaveAttribute("aria-disabled", "true")
    await expect(loadingCell).toHaveAttribute("aria-rowindex", String(Number(rowIndex) + 1))
    await expect(loadingCell).toHaveAttribute("aria-colindex", String(Number(await loadingCell.getAttribute("data-column-index")) + 1))
    const sourceIndex = Number(loadingRowId?.split(":").at(-1))
    expect(Number.isFinite(sourceIndex)).toBe(true)
    const realRowId = `srv-${sourceIndex.toString().padStart(6, "0")}`
    const stableLoadingCell = page.locator(
      `.sandbox-server-data-source-grid .grid-body-viewport .grid-cell[data-row-index="${rowIndex}"][data-row-id="${loadingRowId}"][data-column-key="name"]`,
    ).first()

    const loadingSignature = await cellSignature(stableLoadingCell)
    await stableLoadingCell.click({ force: true })
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(loadingSignature)

    const materializedCell = page.locator(
      `.sandbox-server-data-source-grid .grid-body-viewport .grid-cell[data-row-index="${rowIndex}"][data-row-id="${realRowId}"][data-column-key="name"]`,
    ).first()
    await expect(materializedCell).toBeVisible({ timeout: 20_000 })
    await expect(materializedCell).toHaveClass(/grid-cell--selection-anchor/)
    await expect(materializedCell.locator(".cell-fill-handle")).toBeVisible({ timeout: 20_000 })
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(await cellSignature(materializedCell))
    await expect(materializedCell).toContainText(`Account ${sourceIndex.toString().padStart(5, "0")}`)
  })

  test("fill drag with auto-scroll cleans up on mouseup outside the viewport", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = firstEditableAmountCell(page)
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })

    await sourceCell.click()
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(await cellSignature(sourceCell))

    const fillHandle = sourceCell.locator(".cell-fill-handle")
    await expect(fillHandle).toBeVisible({ timeout: 20_000 })

    const beforeTop = await viewportScrollTop(viewport)
    const handleBox = await boundingBox(fillHandle)
    const viewportBox = await boundingBox(viewport)
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height - 6, { steps: 8 })

    await expect(stage).toHaveClass(/grid-stage--fill-dragging/)
    await expect(page.locator(".grid-selection-overlay__segment--fill-preview").first()).toBeVisible()
    await expect.poll(async () => viewportScrollTop(viewport), { timeout: 10_000 }).toBeGreaterThan(beforeTop)

    await dispatchMouseUpAtPoint(page, { x: 8, y: 8 })
    await expect(stage).not.toHaveClass(/grid-stage--fill-dragging/)
    await expect(page.locator(".grid-selection-overlay__segment--fill-preview")).toHaveCount(0)
  })

  test("range move with auto-scroll is cancelled by Escape without a stuck preview", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = firstEditableAmountCell(page)
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })

    await sourceCell.click()
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(await cellSignature(sourceCell))

    const beforeTop = await viewportScrollTop(viewport)
    const sourceBox = await boundingBox(sourceCell)
    const viewportBox = await boundingBox(viewport)
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height - 6, { steps: 8 })

    await expect(stage).toHaveClass(/grid-stage--range-moving/)
    await expect(page.locator(".grid-selection-overlay__segment--move-preview").first()).toBeVisible()
    await expect.poll(async () => viewportScrollTop(viewport), { timeout: 10_000 }).toBeGreaterThan(beforeTop)

    await page.keyboard.press("Escape")
    await page.mouse.up()
    await expect(stage).not.toHaveClass(/grid-stage--range-moving/)
    await expect(page.locator(".grid-selection-overlay__segment--move-preview")).toHaveCount(0)
  })

  test("context menu cancels an active range move and opens after cleanup", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = firstEditableAmountCell(page)
    const targetCell = amountCellByViewportRow(page, 1)
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect(targetCell).toBeVisible({ timeout: 20_000 })

    await sourceCell.click()
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(await cellSignature(sourceCell))
    await dragCellBodyStartAndMove(page, sourceCell, targetCell)
    await expect(stage).toHaveClass(/grid-stage--range-moving/)

    expect(await dispatchWindowContextMenuAt(page, targetCell)).toBe(true)
    await page.mouse.up()
    await expect(stage).not.toHaveClass(/grid-stage--range-moving/)
    await expect(page.locator(".grid-selection-overlay__segment--move-preview")).toHaveCount(0)

    const amountHeader = page.locator('.grid-cell--header[data-column-key="amount"]').first()
    await expect(amountHeader).toBeVisible({ timeout: 20_000 })
    await openContextMenu(amountHeader)
    await expect(page.locator("[data-datagrid-column-menu-action]").first()).toBeVisible({ timeout: 20_000 })
  })

  test("interaction diagnostics emit only when perf tracing is enabled", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid?dgPerfTrace=1")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = firstEditableAmountCell(page)
    const targetCell = amountCellByViewportRow(page, 1)
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect(targetCell).toBeVisible({ timeout: 20_000 })

    await sourceCell.click()
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(await cellSignature(sourceCell))
    await dragCellBodyStartAndMove(page, sourceCell, targetCell)
    const viewportBox = await boundingBox(viewport)
    await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height - 6)

    await expect.poll(async () => latestPerfSample(page, "interactionOwner")).toMatchObject({
      scope: "interactionOwner",
      owner: "range-move",
      activeOwners: "range-move",
    })
    await expect.poll(async () => latestPerfSample(page, "interactionPreview")).toMatchObject({
      scope: "interactionPreview",
      owner: "range-move",
    })
    await expect.poll(async () => latestPerfSample(page, "interactionAutoScroll")).toMatchObject({
      scope: "interactionAutoScroll",
      owner: "range-move",
    })
    expect(readNumericPerfField(await latestPerfSample(page, "interactionPreview"), "totalMs")).toBeLessThanOrEqual(50)
    expect(readNumericPerfField(await latestPerfSample(page, "interactionAutoScroll"), "totalMs")).toBeLessThanOrEqual(50)

    await page.keyboard.press("Escape")
    await page.mouse.up()
    await expect.poll(async () => latestPerfSample(page, "interactionCancel")).toMatchObject({
      scope: "interactionCancel",
      reason: "escape",
      owner: "range-move",
    })
  })

  test("column and row resize near adjacent controls finish without selection drift", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const sourceCell = firstEditableAmountCell(page)
    const header = page.locator('.grid-cell--header[data-column-key="name"]').first()
    const row = page.locator('.grid-body-pane--left .grid-row[data-row-index="0"]').first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect(header).toBeVisible({ timeout: 20_000 })
    await expect(row).toBeVisible({ timeout: 20_000 })

    await sourceCell.click()
    const anchorBefore = await selectionAnchorSignature(page)

    const headerBefore = await boundingBox(header)
    await dragResizeHandle(page, header.locator(".col-resize"), 72)
    const headerAfter = await boundingBox(header)
    expect(headerAfter.width).toBeGreaterThan(headerBefore.width + 24)

    const rowBefore = await boundingBox(row)
    await dragResizeHandleVertically(page, row.locator(".row-resize-handle"), 34)
    const rowAfter = await boundingBox(row)
    expect(rowAfter.height).toBeGreaterThan(rowBefore.height + 14)

    expect(await selectionAnchorSignature(page)).toBe(anchorBefore)
    await expect(stage).not.toHaveClass(/grid-stage--fill-dragging/)
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

async function viewportRangeStart(page: Page): Promise<number> {
  const raw = (await page.locator(".meta span").filter({ hasText: "Viewport rows:" }).first().textContent())?.trim() ?? ""
  const match = raw.match(/Viewport rows:\s*(\d+)\.\.(\d+)/)
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

async function viewportScrollTop(viewport: Locator): Promise<number> {
  return await viewport.evaluate(element => element.scrollTop)
}

async function viewportScrollLeft(viewport: Locator): Promise<number> {
  return await viewport.evaluate(element => element.scrollLeft)
}

async function setViewportScroll(viewport: Locator, scroll: { top: number; left: number }): Promise<{ top: number; left: number }> {
  return await viewport.evaluate((element, nextScroll) => {
    element.scrollTop = nextScroll.top
    element.scrollLeft = nextScroll.left
    element.dispatchEvent(new Event("scroll", { bubbles: true }))
    return {
      top: element.scrollTop,
      left: element.scrollLeft,
    }
  }, scroll)
}

async function pinColumnRight(page: Page, columnKey: string): Promise<void> {
  const menuButton = page.locator(`[data-datagrid-column-menu-button="true"][data-column-key="${columnKey}"]:visible`).first()
  await expect(menuButton).toBeVisible({ timeout: 20_000 })
  await menuButton.click()
  await page.locator('[data-datagrid-column-menu-action="pin-submenu"]').click()
  await page.locator('[data-datagrid-column-menu-action="pin-right"]').click()
  await expect(page.locator(`.grid-stage:visible .grid-body-pane--right .grid-cell[data-column-key="${columnKey}"]`).first()).toBeVisible({ timeout: 20_000 })
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

async function activeElementSignature(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const activeElement = document.activeElement
    if (!(activeElement instanceof HTMLElement) || !activeElement.classList.contains("grid-cell")) {
      return "none"
    }
    return [
      activeElement.getAttribute("data-row-index") ?? "",
      activeElement.getAttribute("data-column-index") ?? "",
      activeElement.getAttribute("data-column-key") ?? "",
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

async function selectedCellSignatures(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll<HTMLElement>(".grid-cell--selected, .grid-cell--selection-anchor"))
      .map(element => [
        element.getAttribute("data-row-index") ?? "",
        element.getAttribute("data-column-index") ?? "",
        element.getAttribute("data-column-key") ?? "",
      ].join(":"))
  })
}

async function latestPerfSample(page: Page, scope: string): Promise<Record<string, unknown> | null> {
  return await page.evaluate(sampleScope => {
    const store = (window as typeof window & {
      __AFFINO_DATAGRID_PERF__?: { samples?: Array<Record<string, unknown>> }
    }).__AFFINO_DATAGRID_PERF__
    const samples = store?.samples ?? []
    for (let index = samples.length - 1; index >= 0; index -= 1) {
      const sample = samples[index]
      if (sample?.scope === sampleScope) {
        return sample
      }
    }
    return null
  }, scope)
}

function readNumericPerfField(sample: Record<string, unknown> | null, field: string): number {
  const value = sample?.[field]
  expect(typeof value).toBe("number")
  expect(Number.isFinite(value)).toBe(true)
  return value as number
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

async function dragResizeHandleVertically(page: Page, handle: Locator, deltaY: number): Promise<void> {
  const box = await boundingBox(handle)
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, startY + deltaY)
  await page.mouse.up()
}

async function dispatchMouseUpAtPoint(page: Page, point: { x: number; y: number }): Promise<void> {
  await page.evaluate(nextPoint => {
    window.dispatchEvent(new MouseEvent("mouseup", {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: nextPoint.x,
      clientY: nextPoint.y,
    }))
  }, point)
}

async function dispatchWindowContextMenuAt(page: Page, target: Locator): Promise<boolean> {
  const point = await elementCenter(target)
  return await page.evaluate(nextPoint => {
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: nextPoint.x,
      clientY: nextPoint.y,
    })
    return !window.dispatchEvent(event) || event.defaultPrevented
  }, point)
}

async function openContextMenu(target: Locator): Promise<void> {
  const point = await elementCenter(target)
  await target.page().mouse.click(point.x, point.y, { button: "right" })
}

async function boundingBox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error("Expected element to be visible with bounding box")
  }
  return box
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
