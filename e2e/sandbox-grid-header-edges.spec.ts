import { expect, test } from "@playwright/test"

test("canvas chrome keeps merged pinned header dividers aligned across header rows", async ({ page }) => {
  await page.goto("/vue/shell/pivot-grid")

  const stage = page.locator(".grid-stage:visible").first()
  const header = stage.locator(".grid-header-shell")
  const leftPane = header.locator(".grid-header-pane--left")
  await expect(header).toBeVisible()
  await expect(stage).toHaveClass(/grid-stage--canvas-chrome/)

  const edges = await leftPane.evaluate(pane => {
    const normalizeColor = (color: string): string => {
      const srgb = color.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/)
      if (!srgb) return color
      const [red, green, blue] = srgb.slice(1, 4).map(value => Math.round(Number(value) * 255))
      return `rgb(${red}, ${green}, ${blue})`
    }
    const rows = [...pane.querySelectorAll<HTMLElement>(".grid-header-row")]
      .map(row => [...row.querySelectorAll<HTMLElement>(":scope > .grid-cell")])
      .filter(cells => cells.length > 1 && cells[0]?.classList.contains("grid-cell--index-header"))
      .map(cells => {
        const indexCell = cells[0]!
        const nextCell = cells[1]!
        const row = indexCell.parentElement!
        const indexRect = indexCell.getBoundingClientRect()
        const nextRect = nextCell.getBoundingClientRect()
        const stage = pane.closest<HTMLElement>(".grid-stage")!
        const leftGroupRows = [...pane.querySelectorAll<HTMLElement>(".grid-header-row--pivot-groups")]
        const groupRowIndex = leftGroupRows.indexOf(row)
        const centerGroupRow = groupRowIndex >= 0
          ? stage.querySelectorAll<HTMLElement>(".grid-header-viewport .grid-header-row--pivot-groups")[groupRowIndex]
          : null
        const centerGroupCell = centerGroupRow?.querySelector<HTMLElement>(".grid-cell--header-group")
        return {
          rowKind: cells.some(cell => cell.classList.contains("grid-cell--header-group")) ? "group" : "leaf",
          height: indexRect.height,
          bottom: indexRect.bottom,
          indexRight: indexRect.right,
          nextLeft: nextRect.left,
          indexBorderRight: getComputedStyle(indexCell).borderRightWidth,
          indexBorderLeft: getComputedStyle(indexCell).borderLeftWidth,
          nextBorderLeft: getComputedStyle(nextCell).borderLeftWidth,
          nextBorderRight: getComputedStyle(nextCell).borderRightWidth,
          indexSurface: indexCell.classList.contains("grid-cell--header-merged-untitled")
            ? normalizeColor(getComputedStyle(indexCell, "::before").backgroundColor)
            : normalizeColor(getComputedStyle(indexCell).backgroundColor),
          nextSurface: nextCell.classList.contains("grid-cell--header-merged-untitled")
            ? normalizeColor(getComputedStyle(nextCell, "::before").backgroundColor)
            : normalizeColor(getComputedStyle(nextCell).backgroundColor),
          centerGroupBackground: centerGroupCell ? normalizeColor(getComputedStyle(centerGroupCell).backgroundColor) : null,
        }
      })

    const bodyIndex = pane.closest(".grid-stage")?.querySelector<HTMLElement>(
      ".grid-body-pane--left .grid-cell--index[data-row-index='0'], .grid-body-pane--left .grid-cell--index-number[data-row-index='0']",
    )
    const bodyIndexRight = bodyIndex?.getBoundingClientRect().right ?? null
    const stage = pane.closest<HTMLElement>(".grid-stage")!
    return {
      rows,
      bodyIndexRight,
      stageLeft: stage.getBoundingClientRect().left,
      stageBorderLeft: getComputedStyle(stage).borderLeftWidth,
      paneLeft: pane.getBoundingClientRect().left,
    }
  })

  expect(edges.rows.map(row => row.rowKind)).toContain("group")
  expect(edges.rows.map(row => row.rowKind)).toContain("leaf")
  expect(edges.bodyIndexRight).not.toBeNull()

  const alignedRowHeights = await header.evaluate(element => {
    const measure = (row: HTMLElement) => ({
      kind: row.classList.contains("grid-header-row--pivot-groups") ? "group" : "leaf",
      height: row.getBoundingClientRect().height,
    })
    return {
      left: [...element.querySelectorAll<HTMLElement>(".grid-header-pane--left .grid-header-row:not(.grid-header-filter-row)")].map(measure),
      center: [...element.querySelectorAll<HTMLElement>(".grid-header-viewport .grid-header-row:not(.grid-header-filter-row)")].map(measure),
      leftPane: element.querySelector<HTMLElement>(".grid-header-pane--left")?.getBoundingClientRect(),
      leftBorderBottom: Number.parseFloat(getComputedStyle(element.querySelector<HTMLElement>(".grid-header-pane--left")!).borderBottomWidth),
      seamZIndex: getComputedStyle(element.querySelector<HTMLElement>(".grid-header-pane--left")!, "::after").zIndex,
      centerSeamBorderLeft: getComputedStyle(element.querySelector<HTMLElement>(
        ".grid-header-viewport .grid-header-row:not(.grid-header-filter-row) > .grid-cell",
      )!).borderLeftWidth,
    }
  })
  expect(alignedRowHeights.left).toEqual(alignedRowHeights.center)
  expect(alignedRowHeights.left.at(-1)?.height).toBe(36)
  expect(Math.abs(
    (alignedRowHeights.leftPane?.bottom ?? 0)
    - (edges.rows.at(-1)?.bottom ?? 0)
    - alignedRowHeights.leftBorderBottom,
  )).toBeLessThan(0.1)
  expect(alignedRowHeights.seamZIndex).toBe("8")
  expect(alignedRowHeights.centerSeamBorderLeft).toBe("0px")

  const referenceBoundary = edges.rows[0]!.indexRight
  for (const row of edges.rows) {
    expect(Math.abs(row.indexRight - row.nextLeft)).toBeLessThan(0.1)
    expect(Math.abs(row.indexRight - referenceBoundary)).toBeLessThan(0.1)
    expect(row.indexBorderRight).toBe("0px")
    expect(Number.parseFloat(row.nextBorderLeft)).toBeGreaterThan(0)
    expect(row.nextBorderRight).toBe("0px")
    expect(row.indexBorderLeft).toBe("0px")
    if (row.rowKind === "leaf") {
      expect(row.indexSurface).toBe(row.nextSurface)
    } else {
      expect(row.nextSurface).toBe(row.centerGroupBackground)
    }
  }
  expect(Math.abs(edges.bodyIndexRight! - referenceBoundary)).toBeLessThan(0.1)
  expect(edges.stageBorderLeft).toBe("1px")
  expect(Math.abs(edges.paneLeft - edges.stageLeft - Number.parseFloat(edges.stageBorderLeft))).toBeLessThan(0.1)
})
