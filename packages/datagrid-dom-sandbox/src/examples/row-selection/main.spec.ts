import { afterEach, describe, expect, it } from "vitest"
import { mountDataGrid } from "@affino/datagrid-dom"
import { mountRowSelectionDemo, type RowSelectionDemoHandle } from "./main"

describe("row selection sandbox example", () => {
  let demo: RowSelectionDemoHandle | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    root?.remove()
  })

  it("toggles records independently from cell selection and supports bulk API actions", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountRowSelectionDemo(root)
    await demo.grid.ready

    expect(demo.grid.api.rowSelection.hasSupport()).toBe(true)
    expect(root.querySelectorAll("[data-row-selection-toggle]")).toHaveLength(4)
    expect(root.querySelector('[role="grid"]')?.getAttribute("aria-colcount")).toBe("4")
    expect(root.querySelector(".affino-grid-dom__header-left .affino-grid-dom__row-selection-header--spanning")
      ?.classList.contains("affino-grid-dom__cell--grid-start")).toBe(true)
    expect(root.querySelector(".affino-grid-dom__header-center .affino-grid-dom__cell--grid-start")).toBeNull()

    const row = root.querySelector<HTMLElement>('.affino-grid-dom__row[data-row-id="p2"]')!
    const checkbox = row.querySelector<HTMLInputElement>("[data-row-selection-toggle]")!
    checkbox.checked = true
    checkbox.dispatchEvent(new Event("change", { bubbles: true }))

    expect(demo.grid.api.rowSelection.getSelectedRows()).toEqual(["p2"])
    expect(demo.grid.api.selection.getSnapshot()).toBeNull()
    expect(root.querySelector('.affino-grid-dom__row[data-row-id="p2"]')?.getAttribute("aria-selected")).toBe("true")
    expect(root.querySelector('.affino-grid-dom__row[data-row-id="p2"]')
      ?.classList.contains("affino-grid-dom__row--record-selected")).toBe(true)
    expect(root.querySelector<HTMLInputElement>('.affino-grid-dom__row[data-row-id="p2"] [data-row-selection-toggle]')?.checked).toBe(true)
    expect(root.querySelector<HTMLInputElement>("[data-row-selection-select-all]")?.getAttribute("aria-checked")).toBe("mixed")
    expect(root.querySelector<HTMLInputElement>("[data-row-selection-select-all]")?.indeterminate).toBe(true)
    expect(root.querySelector("output")?.textContent).toBe("1 selected · p2")

    const lastRowCheckbox = root.querySelector<HTMLInputElement>(
      '.affino-grid-dom__row[data-row-id="p4"] [data-row-selection-toggle]',
    )!
    lastRowCheckbox.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }))
    expect(demo.grid.api.rowSelection.getSelectedRows()).toEqual(["p2", "p3", "p4"])
    expect(demo.grid.api.selection.getSnapshot()).toBeNull()

    const selectAll = root.querySelector<HTMLInputElement>("[data-row-selection-select-all]")!
    selectAll.checked = true
    selectAll.dispatchEvent(new Event("change", { bubbles: true }))
    expect(["p1", "p2", "p3", "p4"].every(rowId => demo!.grid.api.rowSelection.isSelected(rowId))).toBe(true)
    expect(root.querySelector<HTMLInputElement>("[data-row-selection-select-all]")?.checked).toBe(true)
    const deselectAll = root.querySelector<HTMLInputElement>("[data-row-selection-select-all]")!
    deselectAll.checked = false
    deselectAll.dispatchEvent(new Event("change", { bubbles: true }))
    expect(demo.grid.api.rowSelection.getSelectedRows()).toEqual([])
    root.querySelector<HTMLButtonElement>('[data-action="select-visible"]')!.click()
    expect(demo.grid.api.rowSelection.getSelectedRows()).toHaveLength(4)
    root.querySelector<HTMLButtonElement>('[data-action="clear"]')!.click()
    expect(demo.grid.api.rowSelection.getSelectedRows()).toEqual([])
    expect(root.querySelector("output")?.textContent).toBe("No records selected")
  })

  it("does not enable row selection unless the mount option is enabled", async () => {
    root = document.createElement("div")
    document.body.append(root)
    const grid = mountDataGrid(root, {
      rows: [{ id: "r1", name: "Row" }],
      columns: [{ key: "name", field: "name", label: "Name" }],
    })
    await grid.ready
    expect(grid.api.rowSelection.hasSupport()).toBe(false)
    expect(root.querySelector(".affino-grid-dom__row-selection-header")).toBeNull()
    await grid.destroy()
  })
})
