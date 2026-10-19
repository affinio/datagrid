import { expect, type Locator, type Page, test } from "@playwright/test"

test.describe("sandbox interaction contracts (adapted from affinio datagrid interactions)", () => {
  test("highlights focused row and column axes and copies a clicked column header", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/theme-canvas-grid")
    const stage = page.locator('[data-testid="theme-grid-first"] .grid-stage:visible').first()
    const firstCell = stage.locator('.datagrid-stage__cell[data-row-index="0"][data-column-key="name"]').first()
    const nameHeader = stage.locator('.grid-cell--header[data-column-key="name"]').first()
    const rowIndex = stage.locator('.grid-cell--index-number[data-row-index="0"]').first()

    await firstCell.click()
    await expect(nameHeader).toHaveClass(/grid-cell--focus-axis/)
    await expect(rowIndex).toHaveClass(/grid-cell--focus-axis/)

    const lightColor = await nameHeader.evaluate(element => getComputedStyle(element).backgroundColor)
    await page.evaluate(() => { document.documentElement.dataset.theme = "dark" })
    await expect.poll(() => nameHeader.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(lightColor)
    await page.evaluate(() => { document.documentElement.dataset.theme = "light" })

    await nameHeader.click({ position: { x: 12, y: 12 } })
    await expect(nameHeader).toHaveClass(/grid-cell--header-selected/)
    await expect(nameHeader).not.toHaveClass(/grid-cell--focus-axis/)
    const clickedHeaderStyle = await nameHeader.evaluate(element => ({
      background: getComputedStyle(element).backgroundColor,
      marker: getComputedStyle(element).boxShadow,
    }))
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("ArrowUp")
    await expect(nameHeader).toBeFocused()
    expect(await nameHeader.evaluate(element => ({
      background: getComputedStyle(element).backgroundColor,
      marker: getComputedStyle(element).boxShadow,
    }))).toEqual(clickedHeaderStyle)
    await page.keyboard.press("Control+C")
    await expect(firstCell).toHaveClass(/grid-cell--clipboard-pending/)

    const cornerHeader = stage.locator('[data-datagrid-row-index-header="true"]')
    await cornerHeader.click()
    await expect(cornerHeader).toHaveClass(/grid-cell--header-selected/)
    await expect(cornerHeader).toHaveAttribute("aria-selected", "true")
  })

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

  test("returns keyboard focus to a selected body cell after applying a filter", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    await page.getByLabel("Value filter").selectOption("0")
    const stage = page.locator(".grid-stage:visible").first()
    const cell = stage.locator('.datagrid-stage__cell[data-row-index="0"][data-column-key]').first()
    const filterInput = stage.locator('.col-filter-input[aria-label="Filter Task column"]').first()
    await expect(cell).toBeVisible({ timeout: 20_000 })
    await expect(filterInput).toBeVisible({ timeout: 20_000 })
    await cell.click()
    const beforeFilterRows = await rowsInModel(page)
    await filterInput.fill("Task 99")
    await expect.poll(async () => rowsInModel(page)).toBeLessThan(beforeFilterRows)
    await filterInput.press("Enter")

    const focusedCell = stage.locator(".grid-body-shell .datagrid-stage__cell:focus")
    await expect(focusedCell).toHaveCount(1)
    const focusedSignature = await cellSignature(focusedCell)
    await page.keyboard.press("ArrowDown")
    await expect.poll(async () => selectionAnchorSignature(page)).not.toBe(focusedSignature)
    await expect(stage.locator(".grid-body-shell .datagrid-stage__cell:focus")).toHaveCount(1)
  })

  test("restores body-cell focus after a column menu closes with Escape or Cancel", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const cell = stage.locator('.datagrid-stage__cell[data-row-index="0"][data-column-key]').first()
    const menuButton = stage.locator('[data-datagrid-column-menu-button="true"][aria-label="Open column menu for Task"]').first()
    const focusedCell = stage.locator(".grid-body-shell .datagrid-stage__cell:focus")

    await expect(cell).toBeVisible({ timeout: 20_000 })
    await cell.click()
    await menuButton.click()
    await expect(page.locator(".datagrid-column-menu__panel")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(focusedCell).toHaveCount(1)
    const escapeFocus = await cellSignature(focusedCell)
    await page.keyboard.press("ArrowDown")
    await expect.poll(async () => selectionAnchorSignature(page)).not.toBe(escapeFocus)

    await cell.click()
    await menuButton.click()
    await expect(page.locator('[data-datagrid-column-menu-action="cancel-filter"]')).toBeVisible()
    await page.locator('[data-datagrid-column-menu-action="cancel-filter"]').click()
    await expect(focusedCell).toHaveCount(1)
    const cancelFocus = await cellSignature(focusedCell)
    await page.keyboard.press("ArrowDown")
    await expect.poll(async () => selectionAnchorSignature(page)).not.toBe(cancelFocus)
  })

  test("filters by condition in the column-menu submenu", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/shell/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const menuButton = stage.getByRole("columnheader", { name: /Task/ }).locator('[data-datagrid-column-menu-button="true"]')
    await expect(menuButton).toBeVisible({ timeout: 20_000 })
    await menuButton.click()
    const conditionAction = page.locator('[data-datagrid-column-menu-action="filter-by-condition"]')
    await expect(conditionAction).toBeVisible()
    await conditionAction.click()

    const conditionSelect = page.locator('[aria-label="Filter condition"]')
    const formula = page.locator('[aria-label="Filter formula"]')
    await expect(conditionSelect).toBeVisible()
    await conditionSelect.selectOption("contains")
    await expect(formula).toBeVisible()
    await expect(page.locator(".datagrid-column-menu__condition-panel")).toContainText("Formula")
    await expect(page.locator(".datagrid-advanced-filter")).toHaveCount(0)
    await formula.fill("Task")
    await page.locator('[data-datagrid-column-menu-action="apply-filter"]').click()
    await expect(page.locator('[data-datagrid-column-menu-panel="true"]')).toHaveCount(0)
    await expect(menuButton.locator('path[d="M2.5 3.5h11L9.25 8.5v3.25l-2.5 1.25V8.5z"]')).toBeVisible()
  })

  test("reorders the focused header with Shift+Option arrow keys", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/shell/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const headers = stage.locator(".grid-header-viewport .grid-cell--header[data-column-key]")
    await expect(headers.nth(1)).toBeVisible({ timeout: 20_000 })
    const before = await headers.evaluateAll(elements => elements.map(element => element.getAttribute("data-column-key")))
    await headers.first().focus()
    await page.keyboard.press("Shift+Alt+ArrowRight")

    await expect.poll(() => headers.evaluateAll(elements => elements.map(element => element.getAttribute("data-column-key"))))
      .toEqual([before[1], before[0], ...before.slice(2)])
    await expect(stage.locator(".grid-header-viewport .grid-cell--header:focus")).toHaveAttribute("data-column-key", before[0]!)
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

  test("@a11y tree group row exposes expansion state while click toggles expansion", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/tree-grid")

    const groupRow = page.locator(".grid-row.row--group").first()
    await expect(groupRow).toBeVisible({ timeout: 20_000 })
    await expect(groupRow).toHaveAttribute("role", "row")
    await expect(groupRow).toHaveAttribute("aria-expanded", /^(true|false)$/)
    await expect(groupRow).toHaveAttribute("aria-label", /row/)

    const before = await rowsInModel(page)
    const expandedBefore = await groupRow.getAttribute("aria-expanded")
    await groupRow.click()

    await expect
      .poll(async () => rowsInModel(page))
      .not.toBe(before)
    await expect(groupRow).not.toHaveAttribute("aria-expanded", expandedBefore ?? "")

    await groupRow.click()
    await expect.poll(async () => rowsInModel(page)).toBe(before)
  })

  test("@a11y inline editor exposes context and Tab keeps focus inside grid", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/shell/base-grid")

    const editableCell = page.locator('.grid-row:not(.row--group) .grid-cell[data-column-key="amount"]').first()
    await expect(editableCell).toBeVisible({ timeout: 20_000 })

    const sourceRowIndex = await editableCell.getAttribute("data-row-index")
    expect(sourceRowIndex).not.toBeNull()

    await editableCell.dblclick()

    const editor = editableCell.locator("input.cell-editor-input").first()
    await expect(editor).toBeVisible({ timeout: 20_000 })
    await expect(editor).toHaveAttribute("aria-label", /Edit Amount, row \d+/)
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
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
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
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
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

    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
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
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
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
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
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

    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
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

  test("horizontal virtualization keeps arrow navigation and reveals adjacent cells", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/shell/grouped-grid")
    await page.locator("select").nth(1).selectOption("128")

    const stage = page.locator(".grid-stage:visible").first()
    const horizontalOwner = stage.locator(".grid-body-center-horizontal-scrollport--scroll-owner")
    const verticalOwner = stage.locator(".grid-body-shared-vertical-scroll-shell")
    const sourceCell = stage.locator('.datagrid-stage__cell[data-row-index="0"][data-column-key="start"]').first()
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await sourceCell.click()
    const sourceSignature = await cellSignature(sourceCell)

    await horizontalOwner.evaluate(element => { element.scrollLeft = 4000 })
    await expect(sourceCell).toHaveCount(0)
    await expect(verticalOwner).toBeFocused()

    await page.keyboard.press("ArrowLeft")
    const leftCell = stage.locator('.datagrid-stage__cell[data-row-index="0"][data-column-key="amount"]').first()
    await expect(leftCell).toBeFocused()
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(await cellSignature(leftCell))
    await expect.poll(() => horizontalOwner.evaluate(element => element.scrollLeft)).toBeLessThan(1000)

    await horizontalOwner.evaluate(element => { element.scrollLeft = 4000 })
    await expect(leftCell).toHaveCount(0)
    await expect(verticalOwner).toBeFocused()

    await page.keyboard.press("ArrowRight")
    const rightCell = stage.locator('.datagrid-stage__cell[data-row-index="0"][data-column-key="start"]').first()
    await expect(rightCell).toBeFocused()
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(sourceSignature)
    await expect.poll(() => horizontalOwner.evaluate(element => element.scrollLeft)).toBeLessThan(1000)
  })

  test("keyboard navigation enters, traverses, and leaves leaf column headers", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const bodyCell = stage.locator('.grid-body-viewport .grid-cell[data-row-index="0"][data-column-key="name"]').first()
    const amountCell = stage.locator('.grid-body-viewport .grid-cell[data-row-index="0"][data-column-key="amount"]').first()
    const nameHeader = stage.locator('.grid-header-shell .grid-cell--header[data-column-key="name"]')
    const amountHeader = stage.locator('.grid-header-shell .grid-cell--header[data-column-key="amount"]')
    const nameMenuButton = nameHeader.locator(".col-menu-trigger")
    await expect(bodyCell).toBeVisible({ timeout: 20_000 })
    await expect(nameMenuButton).toBeVisible()
    expect(await nameMenuButton.evaluate(button => {
      const cell = button.closest<HTMLElement>(".grid-cell--header")
      return cell ? cell.getBoundingClientRect().right - button.getBoundingClientRect().right : Number.POSITIVE_INFINITY
    })).toBeLessThan(16)

    await bodyCell.click()
    await page.keyboard.press("ArrowUp")
    await expect(nameHeader).toBeFocused()
    await expect(nameHeader).toHaveCSS("outline-style", "none")
    await expect(nameHeader).toHaveCSS("box-shadow", /0px 3px 0px 0px inset/)

    await page.keyboard.press("ArrowRight")
    await expect(amountHeader).toBeFocused()
    const amountSignature = await cellSignature(amountCell)
    await expect.poll(async () => selectionAnchorSignature(page)).toBe(amountSignature)

    await page.keyboard.press("ArrowDown")
    await expect(amountCell).toBeFocused()
    expect(await selectionAnchorSignature(page)).toBe(amountSignature)
    await expect.poll(async () => stage.locator('.grid-body-viewport .grid-cell[aria-selected="true"]').count()).toBe(1)

    await page.keyboard.press("ArrowUp")
    await expect(amountHeader).toBeFocused()
    await page.keyboard.press("Shift+ArrowDown")
    await expect.poll(async () => stage.locator('.grid-body-viewport .grid-cell[aria-selected="true"]').count()).toBe(2)
    await page.keyboard.press("ArrowUp")
    await page.keyboard.press("ArrowUp")
    await expect(amountHeader).toBeFocused()
    await page.keyboard.press("Shift+ArrowLeft")
    await expect(nameHeader).toBeFocused()
    await expect(nameHeader).toHaveClass(/grid-cell--header-selected/)
    await expect(amountHeader).toHaveClass(/grid-cell--header-selected/)
    await expect(nameHeader).toHaveClass(/grid-cell--header-selection-range-start/)
    await expect(amountHeader).toHaveClass(/grid-cell--header-selection-range-end/)
  })

  test("keyboard navigation across virtualized headers scrolls without focus retry churn", async ({ page }) => {
    test.setTimeout(45_000)
    await gotoSandboxRoute(page, "/vue/base-grid")
    const stage = page.locator(".grid-stage:visible").first()
    const firstHeader = stage.locator('.grid-header-shell .grid-cell--header[data-column-key]').first()
    await expect(firstHeader).toBeVisible({ timeout: 20_000 })
    await firstHeader.focus()

    for (let index = 0; index < 24; index += 1) {
      await page.keyboard.press("ArrowRight")
    }

    await expect(stage.locator(".grid-header-shell .grid-cell--header[data-column-key]:focus")).toHaveCount(1)
    const horizontalOffsets = async () => stage.evaluate(element => ({
      body: element.querySelector<HTMLElement>(".grid-body-center-horizontal-scrollport--scroll-owner")?.scrollLeft ?? 0,
      header: element.querySelector<HTMLElement>(".grid-header-viewport")?.scrollLeft ?? 0,
    }))
    await expect.poll(async () => (await horizontalOffsets()).body).toBeGreaterThan(0)
    await expect.poll(async () => {
      const { body, header } = await horizontalOffsets()
      return Math.abs(body - header)
    }).toBeLessThan(2)
    await expect.poll(async () => stage.evaluate(element => {
      const header = element.querySelector<HTMLElement>(".grid-header-viewport")
      const focused = element.querySelector<HTMLElement>(".grid-header-viewport .grid-cell--header:focus")
      if (!header || !focused) return false
      const viewportBounds = header.getBoundingClientRect()
      const focusBounds = focused.getBoundingClientRect()
      return focusBounds.left >= viewportBounds.left - 1 && focusBounds.right <= viewportBounds.right + 1
    })).toBe(true)
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("ArrowRight")
    await expect(stage.locator(".grid-header-shell .grid-cell--header[data-column-key]:focus")).toHaveCount(1)
    await expect.poll(async () => {
      const { body, header } = await horizontalOffsets()
      return Math.abs(body - header)
    }).toBeLessThan(2)

    for (let index = 0; index < 26; index += 1) {
      await page.keyboard.press("ArrowLeft")
    }
    await expect.poll(async () => (await horizontalOffsets()).body).toBe(0)
    await expect.poll(async () => {
      const { body, header } = await horizontalOffsets()
      return Math.abs(body - header)
    }).toBeLessThan(2)
  })

  test("keyboard navigation moves from the system row index into a data column and its header", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const rowIndexCell = stage.locator('.grid-body-pane--left .grid-cell--index-number[data-row-index="0"]')
    await expect(rowIndexCell).toBeVisible({ timeout: 20_000 })
    await rowIndexCell.click()
    await page.keyboard.press("ArrowRight")

    const focusedBodyCell = stage.locator(".grid-body-pane--left .datagrid-stage__cell:focus, .grid-body-viewport .datagrid-stage__cell:focus")
    await expect.poll(async () => focusedBodyCell.count()).toBe(1)
    const selectionBodyCell = stage.locator('.grid-cell--row-selection[data-row-index="0"]')
    const startsOnSelectionColumn = (await focusedBodyCell.getAttribute("class"))?.includes("grid-cell--row-selection") === true
    if (startsOnSelectionColumn) {
      await expect(focusedBodyCell).toBeFocused()
      await page.keyboard.press("ArrowRight")
      await expect.poll(async () => (await focusedBodyCell.getAttribute("class"))?.includes("grid-cell--row-selection") === false).toBe(true)
    }
    const focusedColumnKey = await focusedBodyCell.getAttribute("data-column-key")
    expect(focusedColumnKey).toBeTruthy()
    expect(await focusedBodyCell.getAttribute("class")).not.toContain("grid-cell--row-selection")

    const focusedHeader = stage.locator(`.grid-header-shell .grid-cell--header[data-column-key="${focusedColumnKey}"]`)
    await page.keyboard.press("ArrowLeft")
    if (startsOnSelectionColumn) {
      await expect(selectionBodyCell).toBeFocused()
      await page.keyboard.press("ArrowLeft")
    }
    await expect(rowIndexCell).toBeFocused()
    await page.keyboard.press("ArrowRight")
    if (startsOnSelectionColumn) await page.keyboard.press("ArrowRight")
    await expect.poll(async () => focusedHeader.count()).toBeGreaterThan(0)
    await page.keyboard.press("ArrowUp")
    await expect(focusedHeader).toBeFocused()
  })

  test("keeps pinned checkbox selection and its overlay aligned during keyboard navigation", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/shell/base-grid")
    const stage = page.locator(".grid-stage:visible").first()
    const rowIndexCell = stage.locator('.grid-body-pane--left .grid-cell--index-number[data-row-index="0"]')
    const selectionCell = stage.locator('.grid-body-pane--left .grid-cell--row-selection[data-row-index="0"]')
    const firstPinnedDataCell = stage.locator('.grid-body-pane--left .datagrid-stage__cell[data-row-index="0"][data-column-key="id"]')
    const selectionOverlay = stage.locator('.grid-body-pane--left .grid-pane-content .grid-selection-overlay__segment').first()
    const expectOverlayOn = async (cell: typeof selectionCell) => {
      await expect(cell).toHaveAttribute("aria-selected", "true")
      await expect(selectionOverlay).toBeVisible()
      const cellBounds = await cell.boundingBox()
      const overlayBounds = await selectionOverlay.boundingBox()
      expect(cellBounds).not.toBeNull()
      expect(overlayBounds).not.toBeNull()
      expect(Math.abs(overlayBounds!.x - cellBounds!.x)).toBeLessThan(3)
      expect(Math.abs(overlayBounds!.width - cellBounds!.width)).toBeLessThan(4)
    }

    await rowIndexCell.click()
    const clickedIndexStyle = await rowIndexCell.evaluate(element => ({
      background: getComputedStyle(element).backgroundColor,
      marker: getComputedStyle(element, "::before").backgroundImage,
    }))
    await page.keyboard.press("ArrowRight")
    await expect(selectionCell).toBeFocused()
    await expectOverlayOn(selectionCell)
    await page.keyboard.press("ArrowRight")
    await expect(firstPinnedDataCell).toBeFocused()
    await expectOverlayOn(firstPinnedDataCell)
    await page.keyboard.press("ArrowLeft")
    await expect(selectionCell).toBeFocused()
    await expectOverlayOn(selectionCell)
    await page.keyboard.press("ArrowLeft")
    await expect(rowIndexCell).toBeFocused()
    await expect(rowIndexCell).toHaveClass(/grid-cell--index-selected/)
    await expect(firstPinnedDataCell).toHaveAttribute("aria-selected", "true")
    await expect(rowIndexCell).toHaveCSS("outline-style", "none")
    expect(await rowIndexCell.evaluate(element => getComputedStyle(element, "::before").backgroundImage)).toContain("linear-gradient")
    expect(await rowIndexCell.evaluate(element => ({
      background: getComputedStyle(element).backgroundColor,
      marker: getComputedStyle(element, "::before").backgroundImage,
    }))).toEqual(clickedIndexStyle)
  })

  test("navigates the index column and extends whole-row selection with Shift", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/shell/base-grid")
    const stage = page.locator(".grid-stage:visible").first()
    const indexCell = (rowIndex: number) => stage.locator(`.grid-body-pane--left .grid-cell--index-number[data-row-index="${rowIndex}"]`)
    const dataCell = (rowIndex: number) => stage.locator(`.grid-body-pane--left .datagrid-stage__cell[data-row-index="${rowIndex}"][data-column-key="id"]`)
    const indexHeader = stage.locator("#datagrid-stage-header-row-index")

    await indexCell(0).click()
    await page.keyboard.press("ArrowDown")
    await expect(indexCell(1)).toBeFocused()
    await expect(dataCell(1)).toHaveAttribute("aria-selected", "true")
    await expect(dataCell(0)).toHaveAttribute("aria-selected", "false")
    await page.keyboard.press("Shift+ArrowDown")
    await expect(indexCell(2)).toBeFocused()
    await expect(dataCell(1)).toHaveAttribute("aria-selected", "true")
    await expect(dataCell(2)).toHaveAttribute("aria-selected", "true")
    await page.keyboard.press("Shift+ArrowUp")
    await expect(indexCell(1)).toBeFocused()
    await expect(dataCell(2)).toHaveAttribute("aria-selected", "false")
    await page.keyboard.press("ArrowUp")
    await page.keyboard.press("ArrowUp")
    await expect(indexHeader).toBeFocused()
    await expect(indexHeader).toHaveAttribute("aria-selected", "true")
    await expect(dataCell(2)).toHaveAttribute("aria-selected", "true")
    await page.keyboard.press("ArrowDown")
    await expect(indexCell(0)).toBeFocused()
    await expect(dataCell(2)).toHaveAttribute("aria-selected", "false")

    for (let rowIndex = 1; rowIndex <= 35; rowIndex += 1) {
      await page.keyboard.press("ArrowDown")
      await expect.poll(async () => stage.evaluate(() => document.activeElement?.getAttribute("data-row-index"))).toBe(String(rowIndex))
    }
    await expect(indexCell(35)).toBeFocused()
    await expect(dataCell(35)).toHaveAttribute("aria-selected", "true")
    await expect.poll(async () => stage.locator(".grid-body-shared-vertical-scroll-shell").evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  })

  test("keeps every column header selected while Shift extends the range", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/height-sizing-grid")
    const stage = page.locator(".grid-stage:visible").first()
    const bodyCell = stage.locator('.grid-body-viewport .grid-cell[data-row-index="0"][data-column-key="name"]').first()
    const nameHeader = stage.locator('.grid-header-shell .grid-cell--header[data-column-key="name"]')
    const valueHeader = stage.locator('.grid-header-shell .grid-cell--header[data-column-key="value"]')
    const statusHeader = stage.locator('.grid-header-shell .grid-cell--header[data-column-key="status"]')
    await expect(bodyCell).toBeVisible({ timeout: 20_000 })
    await bodyCell.click()
    await page.keyboard.press("ArrowUp")
    await expect(nameHeader).toBeFocused()
    await page.keyboard.press("Shift+ArrowRight")
    await page.keyboard.press("Shift+ArrowRight")
    await expect(statusHeader).toBeFocused()
    await expect(nameHeader).toHaveClass(/grid-cell--header-selected/)
    await expect(valueHeader).toHaveClass(/grid-cell--header-selected/)
    await expect(statusHeader).toHaveClass(/grid-cell--header-selected/)
    await expect(nameHeader).toHaveClass(/grid-cell--header-selection-range-start/)
    await expect(statusHeader).toHaveClass(/grid-cell--header-selection-range-end/)
  })

  test("moves from the system select-all header into the first row checkbox", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/row-selection-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const selectAllHeader = stage.locator(".grid-cell--row-selection .grid-checkbox-trigger").first()
    const firstRowCheckbox = stage.locator('.grid-body-pane--left .grid-cell--row-selection[data-row-index="0"]').first()
    await expect(selectAllHeader).toBeVisible({ timeout: 20_000 })
    await expect(firstRowCheckbox).toBeVisible({ timeout: 20_000 })
    await selectAllHeader.focus()
    await page.keyboard.press("ArrowDown")
    await expect(firstRowCheckbox).toBeFocused()
    await expect(firstRowCheckbox).toHaveAttribute("aria-selected", "true")
  })

  test("selection anchor remounts with overlay fill handle after horizontal virtualization", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
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

  test("copied clipboard outline remounts after vertical and horizontal virtualization", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]').first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })

    await copyCellAndExpectPending(page, sourceCell)

    await setViewportScroll(viewport, { top: 1_400, left: 0 })
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(2)
    await expect(page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]')).toHaveCount(0)

    await setViewportScroll(viewport, { top: 0, left: 0 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-top/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-bottom/)

    await setViewportScroll(viewport, { top: 0, left: 2_400 })
    await expect.poll(async () => viewportScrollLeft(viewport)).toBeGreaterThan(0)
    await expect(page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]')).toHaveCount(0)

    await setViewportScroll(viewport, { top: 0, left: 0 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-left/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-right/)
    await expect(stage).not.toHaveClass(/grid-stage--scrolling/)
  })

  test("right-pinned copied clipboard outline remounts after vertical virtualization", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")
    await pinColumnRight(page, "amount")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = page.locator('.grid-stage:visible .grid-body-pane--right .grid-cell[data-row-index="2"][data-column-key="amount"]').first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })

    await copyCellAndExpectPending(page, sourceCell)

    await setViewportScroll(viewport, { top: 1_400, left: 0 })
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(2)
    await expect(page.locator('.grid-stage:visible .grid-body-pane--right .grid-cell[data-row-index="2"][data-column-key="amount"]')).toHaveCount(0)

    await setViewportScroll(viewport, { top: 0, left: 0 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-top/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-bottom/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-left/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-right/)
    await expect(stage).not.toHaveClass(/grid-stage--scrolling/)
  })

  test("cut clipboard outline remounts after vertical and horizontal virtualization", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]').first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })

    await stageCellClipboardOperationAndExpectPending(page, sourceCell, "cut")

    await setViewportScroll(viewport, { top: 1_400, left: 0 })
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(2)
    await expect(page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]')).toHaveCount(0)

    await setViewportScroll(viewport, { top: 0, left: 0 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-top/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-bottom/)

    await setViewportScroll(viewport, { top: 0, left: 2_400 })
    await expect.poll(async () => viewportScrollLeft(viewport)).toBeGreaterThan(0)
    await expect(page.locator('.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="2"][data-column-key="amount"]')).toHaveCount(0)

    await setViewportScroll(viewport, { top: 0, left: 0 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-left/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-right/)
    await expect(stage).not.toHaveClass(/grid-stage--scrolling/)
  })

  test("right-pinned cut clipboard outline remounts after vertical virtualization", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")
    await pinColumnRight(page, "amount")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
    const sourceCell = page.locator('.grid-stage:visible .grid-body-pane--right .grid-cell[data-row-index="2"][data-column-key="amount"]').first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })

    await stageCellClipboardOperationAndExpectPending(page, sourceCell, "cut")

    await setViewportScroll(viewport, { top: 1_400, left: 0 })
    await expect.poll(async () => viewportRangeStart(page)).toBeGreaterThan(2)
    await expect(page.locator('.grid-stage:visible .grid-body-pane--right .grid-cell[data-row-index="2"][data-column-key="amount"]')).toHaveCount(0)

    await setViewportScroll(viewport, { top: 0, left: 0 })
    await expect(sourceCell).toBeVisible({ timeout: 20_000 })
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-top/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-bottom/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-left/)
    await expect(sourceCell).toHaveClass(/grid-cell--clipboard-pending-right/)
    await expect(stage).not.toHaveClass(/grid-stage--scrolling/)
  })

  test("inline editor draft commits when its row leaves the virtual window", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/base-grid")

    const stage = page.locator(".grid-stage:visible").first()
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
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
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
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
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })
    await setViewportScroll(viewport, { top: 100_000, left: 0 })

    const placeholderAmountCell = page.locator(
      '.grid-stage:visible .grid-body-viewport .grid-cell[data-row-index="1000"][data-row-id="__datagrid_placeholder__:1000"][data-column-key="amount"]',
    ).first()
    await expect(placeholderAmountCell).toBeVisible({ timeout: 20_000 })
    await expect(stage).not.toHaveClass(/grid-stage--scrolling/)

    await dispatchElementDoubleClick(placeholderAmountCell)
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

  test("@a11y server datasource loading placeholder replacement keeps ARIA coordinates", async ({ page }) => {
    await gotoSandboxRoute(page, "/vue/server-data-source-grid?datasource=fake")

    const stage = page.locator(".sandbox-server-data-source-grid .grid-stage:visible").first()
    const viewport = page.locator(".sandbox-server-data-source-grid .grid-body-shared-vertical-scroll-shell, .sandbox-server-data-source-grid .grid-body-viewport.table-wrap").first()
    await expect(stage).toBeVisible({ timeout: 20_000 })
    await expect(viewport).toBeVisible({ timeout: 20_000 })

    await page.getByRole("button", { name: "Slow backend" }).click()
    await viewport.evaluate(element => {
      const maxTop = Math.max(0, element.scrollHeight - element.clientHeight)
      element.scrollTop = Math.round(maxTop * 0.55)
      element.dispatchEvent(new Event("scroll", { bubbles: true }))
    })

    let loadingSnapshot: ServerLoadingCellSnapshot | null = null
    await expect.poll(async () => {
      loadingSnapshot = await captureAndClickFirstServerLoadingCell(page)
      return loadingSnapshot?.rowId ?? ""
    }, { timeout: 20_000 }).toMatch(/^__affino_datagrid_data_source_loading__:\d+$/)
    expect(loadingSnapshot).not.toBeNull()

    const rowIndex = loadingSnapshot.rowIndex
    const loadingRowId = loadingSnapshot.rowId
    expect(rowIndex).toBeTruthy()
    expect(loadingSnapshot.ariaDisabled).toBe("true")
    expect(loadingSnapshot.ariaRowIndex).toBe(String(Number(rowIndex) + 1))
    expect(loadingSnapshot.ariaColIndex).toBe(String(Number(loadingSnapshot.columnIndex) + 1))
    const sourceIndex = Number(loadingRowId?.split(":").at(-1))
    expect(Number.isFinite(sourceIndex)).toBe(true)
    const realRowId = `srv-${sourceIndex.toString().padStart(6, "0")}`

    const loadingSignature = loadingSnapshot.signature
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
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
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
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
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
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
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
    const viewport = page.locator(".grid-stage:visible .grid-body-shared-vertical-scroll-shell, .grid-stage:visible .grid-body-viewport.table-wrap").first()
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
    // Some routes expose more than one body surface, with an inactive pane
    // before the visible viewport in DOM order. Wait for the active stage,
    // then let the individual contract target its own visible surface.
    await expect(page.locator(".grid-stage:visible").first()).toBeVisible({ timeout: 20_000 })
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
      focusOwnedByGrid: document.activeElement?.classList.contains("grid-body-viewport") === true
        || document.activeElement?.classList.contains("grid-body-shared-vertical-scroll-shell") === true,
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
  return await viewport.evaluate(element => {
    const verticalViewport = element.closest(".grid-stage")
      ?.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell") ?? element
    return verticalViewport.scrollTop
  })
}

async function viewportScrollLeft(viewport: Locator): Promise<number> {
  return await viewport.evaluate(element => {
    const usesSplitBodyScroll = element.classList.contains("grid-body-shared-vertical-scroll-shell")
      || element.classList.contains("grid-body-viewport")
      || element.classList.contains("table-wrap")
    const horizontalViewport = usesSplitBodyScroll
      ? element.closest(".grid-stage")?.querySelector<HTMLElement>(".grid-body-center-horizontal-scrollport--scroll-owner") ?? element
      : element
    return horizontalViewport.scrollLeft
  })
}

async function setViewportScroll(viewport: Locator, scroll: { top: number; left: number }): Promise<{ top: number; left: number }> {
  return await viewport.evaluate((element, nextScroll) => {
    const stage = element.closest(".grid-stage")
    const verticalViewport = stage?.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell") ?? element
    const horizontalViewport = stage?.querySelector<HTMLElement>(".grid-body-center-horizontal-scrollport--scroll-owner") ?? element
    verticalViewport.scrollTop = nextScroll.top
    horizontalViewport.scrollLeft = nextScroll.left
    verticalViewport.dispatchEvent(new Event("scroll", { bubbles: true }))
    if (horizontalViewport !== verticalViewport) {
      horizontalViewport.dispatchEvent(new Event("scroll", { bubbles: true }))
    }
    return {
      top: verticalViewport.scrollTop,
      left: horizontalViewport.scrollLeft,
    }
  }, scroll)
}

async function dispatchElementClick(target: Locator): Promise<void> {
  await target.evaluate(element => {
    const rect = element.getBoundingClientRect()
    element.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2),
    }))
  })
}

async function dispatchElementDoubleClick(target: Locator): Promise<void> {
  await target.evaluate(element => {
    const rect = element.getBoundingClientRect()
    element.dispatchEvent(new MouseEvent("dblclick", {
      bubbles: true,
      cancelable: true,
      clientX: Math.round(rect.left + rect.width / 2),
      clientY: Math.round(rect.top + rect.height / 2),
    }))
  })
}

async function pinColumnRight(page: Page, columnKey: string): Promise<void> {
  const menuButton = page.locator(`[data-datagrid-column-menu-button="true"][data-column-key="${columnKey}"]:visible`).first()
  await expect(menuButton).toBeVisible({ timeout: 20_000 })
  await dispatchElementClick(menuButton)
  const pinSubmenu = page.locator('[data-datagrid-column-menu-action="pin-submenu"]').first()
  await expect(pinSubmenu).toBeVisible({ timeout: 20_000 })
  await pinSubmenu.click({ force: true })
  const pinRight = page.locator('[data-datagrid-column-menu-action="pin-right"]').first()
  await expect(pinRight).toBeVisible({ timeout: 20_000 })
  await pinRight.click({ force: true })
  await expect.poll(async () => page.locator(`.grid-body-pane--right .grid-cell[data-column-key="${columnKey}"]`).count(), {
    timeout: 20_000,
  }).toBeGreaterThan(0)
}

async function copyCellAndExpectPending(page: Page, cell: Locator): Promise<void> {
  await stageCellClipboardOperationAndExpectPending(page, cell, "copy")
}

async function stageCellClipboardOperationAndExpectPending(
  page: Page,
  cell: Locator,
  operation: "copy" | "cut",
): Promise<void> {
  await cell.click()
  await expect.poll(async () => selectionAnchorSignature(page)).toBe(await cellSignature(cell))
  await page.keyboard.press(operation === "copy" ? "Control+C" : "Control+X")
  await expect(cell).toHaveClass(/grid-cell--clipboard-pending/)
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

interface ServerLoadingCellSnapshot {
  rowIndex: string
  rowId: string
  columnIndex: string
  ariaDisabled: string | null
  ariaRowIndex: string | null
  ariaColIndex: string | null
  signature: string
}

async function captureAndClickFirstServerLoadingCell(page: Page): Promise<ServerLoadingCellSnapshot | null> {
  return await page.evaluate(() => {
    const cell = document.querySelector<HTMLElement>(
      '.sandbox-server-data-source-grid .grid-body-viewport .grid-cell[data-row-id^="__affino_datagrid_data_source_loading__:"][data-column-key="name"]',
    )
    if (!cell) {
      return null
    }
    const rowIndex = cell.getAttribute("data-row-index") ?? ""
    const rowId = cell.getAttribute("data-row-id") ?? ""
    const columnIndex = cell.getAttribute("data-column-index") ?? ""
    const rect = cell.getBoundingClientRect()
    const eventInit: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + Math.min(8, Math.max(1, rect.width / 2)),
      clientY: rect.top + Math.min(8, Math.max(1, rect.height / 2)),
      view: window,
    }
    cell.dispatchEvent(new MouseEvent("mousedown", eventInit))
    cell.dispatchEvent(new MouseEvent("mouseup", eventInit))
    cell.dispatchEvent(new MouseEvent("click", eventInit))
    return {
      rowIndex,
      rowId,
      columnIndex,
      ariaDisabled: cell.getAttribute("aria-disabled"),
      ariaRowIndex: cell.getAttribute("aria-rowindex"),
      ariaColIndex: cell.getAttribute("aria-colindex"),
      signature: [rowIndex, columnIndex, cell.getAttribute("data-column-key") ?? ""].join(":"),
    }
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
