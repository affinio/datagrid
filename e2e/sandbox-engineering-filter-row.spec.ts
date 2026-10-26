import { expect, test } from "@playwright/test"

test("engineering filter row centers index controls and shares header divider geometry", async ({ page }) => {
  await page.goto("/vue/shell/grouped-grid")
  await page.getByLabel("Engineering filter row").check()

  const stage = page.locator(".grid-stage:visible").first()
  const header = stage.locator(".grid-header-shell")
  await expect(header.locator(".grid-header-filter-row").first()).toBeVisible()

  const alignment = await header.evaluate(shell => {
    const panes = ["left", "center", "right"] as const
    return panes.flatMap(paneName => {
      const pane = shell.querySelector<HTMLElement>(
        paneName === "center" ? ".grid-header-viewport" : `.grid-header-pane--${paneName}`,
      )
      if (!pane) return []

      const filterRow = pane.querySelector<HTMLElement>(".grid-header-filter-row")
      const headerRow = [...pane.querySelectorAll<HTMLElement>(".grid-header-row:not(.grid-header-filter-row)")]
        .find(row => row.querySelector(".grid-cell--index-header") !== null)
      if (!filterRow || !headerRow) return []

      const cellsByIdentity = (row: HTMLElement, selector: string) => {
        return [...row.querySelectorAll<HTMLElement>(`:scope > ${selector}`)].map(cell => {
          const rect = cell.getBoundingClientRect()
          const identity = cell.dataset.columnKey ?? (cell.classList.contains("grid-cell--index-header")
            || cell.classList.contains("grid-header-filter-cell--index") ? "index" : null)
          const style = getComputedStyle(cell)
          return {
            identity,
            left: rect.left,
            right: rect.right,
            borderLeft: style.borderLeftWidth,
            borderRight: style.borderRightWidth,
          }
        }).filter(cell => cell.identity !== null)
      }

      const headers = cellsByIdentity(headerRow, ".grid-cell")
      const filters = cellsByIdentity(filterRow, ".grid-header-filter-cell")
      const combinedHeaderCenter = (headerRow.getBoundingClientRect().top + filterRow.getBoundingClientRect().bottom) / 2
      const centeredContent = [...headerRow.querySelectorAll<HTMLElement>(
        ":scope > .grid-cell--index-header > .col-head, :scope > .grid-cell--row-selection > .col-head",
      )].map(element => {
        const rect = element.getBoundingClientRect()
        const hit = document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2)
        return {
          identity: element.parentElement?.classList.contains("grid-cell--index-header") ? "index" : "checkbox",
          centerY: (rect.top + rect.bottom) / 2,
          centerHit: hit?.closest(".col-head") === element,
          lowerEdgeHit: (() => {
            const content = element.querySelector<HTMLElement>(".grid-checkbox-indicator, span")
            if (!content) return true
            const contentRect = content.getBoundingClientRect()
            const lowerHit = document.elementFromPoint(
              (contentRect.left + contentRect.right) / 2,
              contentRect.bottom - 1,
            )
            return lowerHit?.closest(".grid-checkbox-indicator, .col-head > span") === content
          })(),
        }
      })
      return [{ pane: paneName, headers, filters, combinedHeaderCenter, centeredContent }]
    })
  })

  expect(alignment.length).toBeGreaterThan(0)
  const centeredIdentities = alignment.flatMap(pane => pane.centeredContent.map(content => content.identity))
  expect(centeredIdentities).toContain("index")
  expect(centeredIdentities).toContain("checkbox")
  for (const pane of alignment) {
    expect(pane.filters.map(cell => cell.identity)).toEqual(pane.headers.map(cell => cell.identity))
    for (let index = 0; index < pane.headers.length; index += 1) {
      const headerCell = pane.headers[index]!
      const filterCell = pane.filters[index]!
      expect(Math.abs(headerCell.left - filterCell.left), `${pane.pane} ${headerCell.identity} left edge`).toBeLessThan(1)
      expect(Math.abs(headerCell.right - filterCell.right), `${pane.pane} ${headerCell.identity} right edge`).toBeLessThan(1)
      expect(filterCell.borderLeft).toBe(headerCell.borderLeft)
      expect(filterCell.borderRight).toBe(headerCell.borderRight)
    }
    for (const content of pane.centeredContent) {
      expect(Math.abs(content.centerY - pane.combinedHeaderCenter), `${pane.pane} index/checkbox center`).toBeLessThan(1)
      expect(content.centerHit, `${pane.pane} ${content.identity} content is not covered`).toBe(true)
      expect(content.lowerEdgeHit, `${pane.pane} ${content.identity} lower edge is not clipped`).toBe(true)
    }
  }
})
