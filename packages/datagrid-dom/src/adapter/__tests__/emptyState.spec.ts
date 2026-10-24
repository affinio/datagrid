import { afterEach, describe, expect, it, vi } from "vitest"
import { mountDataGrid, type DataGridDomHandle } from "../../index.js"

describe("DOM empty state", () => {
  let handle: DataGridDomHandle<{ id: string; name: string }> | undefined
  let root: HTMLDivElement

  afterEach(async () => {
    await handle?.destroy()
    handle = undefined
    root?.remove()
  })

  it("shows the default no-rows message while preserving the header", async () => {
    root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [],
      columns: [{ key: "name", field: "name", label: "Name" }],
    })
    await handle.ready

    expect(root.querySelector('[role="columnheader"]')?.textContent).toBe("Name")
    expect(root.querySelector(".affino-grid-dom__empty-state")).toMatchObject({
      textContent: "No rows to display.",
    })
    expect(root.querySelector('[role="status"]')?.getAttribute("aria-live")).toBe("polite")
  })

  it("passes filtered-empty state to a custom renderer and removes it when rows appear", async () => {
    root = document.createElement("div")
    document.body.append(root)
    const renderer = vi.fn(state => {
      const content = document.createElement("strong")
      content.textContent = state.reason
      return content
    })
    handle = mountDataGrid(root, {
      rows: [],
      columns: [{ key: "name", field: "name", label: "Name" }],
      emptyState: renderer,
      emptyStateAlignment: "viewport",
    })
    await handle.ready
    handle.api.rows.setFilterModel({ columnFilters: {}, quickFilter: { query: "missing" } })

    expect(renderer).toHaveBeenCalledWith({ reason: "filtered", hasActiveFilters: true, rowCount: 0 })
    expect(root.querySelector(".affino-grid-dom__empty-state--viewport strong")?.textContent).toBe("filtered")

    handle.api.rows.setFilterModel(null)
    handle.api.rows.appendData([{ id: "r1", name: "Ada" }])

    expect(root.querySelector(".affino-grid-dom__empty-state")).toBeNull()
    expect(root.querySelector('[role="gridcell"]')?.textContent).toBe("Ada")
  })
})
