import { afterEach, describe, expect, it, vi } from "vitest"
import { createDataSourceBackedRowModel } from "@affino/datagrid-core"
import { mountDataGrid } from "../mountDataGrid.js"
import type { DataGridDomCellRendererContext, DataGridDomHandle } from "../contracts.js"

describe("mountDataGrid", () => {
  let handle: DataGridDomHandle<{ id: string; name: string }> | undefined

  afterEach(async () => {
    await handle?.destroy()
    handle = undefined
    document.body.replaceChildren()
  })

  it("requires both virtualization axes for Canvas grid chrome", () => {
    const root = document.createElement("div")
    expect(() => mountDataGrid(root, {
      rows: [],
      columns: [],
      gridChrome: "canvas",
    } as never)).toThrow("gridChrome: 'canvas' requires fixed rowVirtualization and columnVirtualization.")
  })

  it("restores host content and tears down when the initial cell render throws", async () => {
    const root = document.createElement("div")
    const hostContent = document.createElement("p")
    root.append(hostContent)
    document.body.append(root)

    expect(() => mountDataGrid(root, {
      rows: [{ id: "r1", name: "Row 1" }],
      columns: [{
        key: "name",
        field: "name",
        cellRenderer() { throw new Error("renderer failed") },
      }],
    })).toThrow("renderer failed")

    expect([...root.childNodes]).toEqual([hostContent])
    await Promise.resolve()
    await Promise.resolve()
    expect(root.querySelector("[role=grid]")).toBeNull()
  })

  it("renders projected display values and exposes the core API", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      label: "People",
      rows: [{ id: "p1", name: "Ada" }, { id: "p2", name: "Grace" }],
      columns: [{ key: "name", field: "name", label: "Name" }],
    })

    await handle.ready

    expect(root.querySelector('[role="grid"]')?.getAttribute("aria-label")).toBe("People")
    expect([...root.querySelectorAll('[role="gridcell"]')].map(cell => cell.textContent)).toEqual(["Ada", "Grace"])
    expect(handle.api.rows.getCount()).toBe(2)

    expect(handle.api.rows.removeData(["p1"])).toBe(true)
    expect([...root.querySelectorAll('[role="gridcell"]')].map(cell => cell.textContent)).toEqual(["Grace"])
  })

  it("applies Shift checkbox state to the whole anchored range and preserves selection outside it", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: Array.from({ length: 5 }, (_, index) => ({ id: `r${index + 1}`, name: `Row ${index + 1}` })),
      columns: [{ key: "name", field: "name" }],
      rowSelection: true,
    })
    await handle.ready

    const changeCheckbox = (rowId: string, checked: boolean, shiftKey = false): void => {
      const checkbox = root.querySelector<HTMLInputElement>(`[data-row-id="${rowId}"] [data-row-selection-toggle]`)
      if (!checkbox) throw new Error(`Missing row selection checkbox for ${rowId}`)
      checkbox.checked = !checked
      checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey }))
    }
    const selectedIds = (): string[] => [...(handle!.api.rowSelection.getSnapshot()?.selectedRows ?? [])]
      .map(String)
      .sort()

    changeCheckbox("r1", true)
    changeCheckbox("r5", true)
    changeCheckbox("r3", true, true)
    expect(selectedIds()).toEqual(["r1", "r3", "r4", "r5"])

    changeCheckbox("r4", false, true)
    expect(selectedIds()).toEqual(["r1", "r3"])
  })

  it("uses Core scope-aware row selection for the header checkbox", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "r1", name: "Row 1" }, { id: "r2", name: "Row 2" }],
      columns: [{ key: "name", field: "name" }],
      rowSelection: true,
    })
    await handle.ready

    handle.api.rowSelection.setSnapshot({
      focusedRow: null,
      selectedRows: [],
      excludedRows: [],
      mode: "all",
    })
    expect(handle.api.rowSelection.getScopeStatus()).toBe("current")
    expect(root.querySelector<HTMLInputElement>("[data-row-selection-select-all]")?.getAttribute("aria-checked"))
      .toBe("true")

    handle.api.rows.setSortModel([{ key: "name", direction: "desc" }])
    expect(handle.api.rowSelection.getScopeStatus()).toBe("stale")
    expect(handle.api.rowSelection.getSnapshot()).toBeNull()
    expect(root.querySelector<HTMLInputElement>("[data-row-selection-select-all]")?.getAttribute("aria-checked"))
      .toBe("false")
  })

  it("selects a large projection in all mode without checking every row one by one", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: Array.from({ length: 5_000 }, (_, index) => ({ id: `bulk-${index}`, name: `Row ${index}` })),
      columns: [{ key: "name", field: "name" }],
      rowSelection: true,
      rowVirtualization: { rowHeight: 32, overscan: 4 },
    })
    await handle.ready

    const isSelected = vi.spyOn(handle.api.rowSelection, "isSelected")
    const selectAll = root.querySelector<HTMLInputElement>("[data-row-selection-select-all]")!
    selectAll.checked = true
    selectAll.dispatchEvent(new Event("change", { bubbles: true }))

    expect(handle.api.rowSelection.getSnapshot()).toMatchObject({ mode: "all", selectedRows: [], excludedRows: [] })
    expect(selectAll.getAttribute("aria-checked")).toBe("true")
    expect(isSelected.mock.calls.length).toBeLessThan(100)

    selectAll.checked = false
    selectAll.dispatchEvent(new Event("change", { bubbles: true }))
    expect(handle.api.rowSelection.getSnapshot()).toMatchObject({ selectedRows: [] })
    expect(handle.api.rowSelection.getSnapshot()?.mode).toBeUndefined()
  })

  it("keeps row-selection anchors across non-projection patches and rebuilds only once for a new projection", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    const renderer = vi.fn(() => document.createElement("span"))
    handle = mountDataGrid(root, {
      rows: Array.from({ length: 4 }, (_, index) => ({ id: `r${index + 1}`, name: `Row ${index + 1}`, note: "" })),
      columns: [{ key: "name", field: "name", cellRenderer: renderer }],
      rowSelection: true,
    })
    await handle.ready

    const changeCheckbox = (rowId: string, checked: boolean, shiftKey = false): void => {
      const checkbox = root.querySelector<HTMLInputElement>(`[data-row-id="${rowId}"] [data-row-selection-toggle]`)
      if (!checkbox) throw new Error(`Missing row selection checkbox for ${rowId}`)
      checkbox.checked = !checked
      checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey }))
    }
    changeCheckbox("r2", true)
    const projectionRevision = handle.api.rows.getSnapshot().projection?.recomputeVersion
    handle.api.rows.patch([{ rowId: "r1", data: { note: "unrelated" } }])
    expect(handle.api.rows.getSnapshot().projection?.recomputeVersion).toBe(projectionRevision)
    changeCheckbox("r4", true, true)
    expect([...(handle.api.rowSelection.getSnapshot()?.selectedRows ?? [])].map(String).sort())
      .toEqual(["r2", "r3", "r4"])

    renderer.mockClear()
    handle.api.rows.setSortModel([{ key: "name", direction: "desc" }])
    expect(renderer).toHaveBeenCalledTimes(4)
  })

  it("mounts a caller-owned row model without disposing it with the grid", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    const rowModel = createDataSourceBackedRowModel({
      dataSource: {
        async pull(request) {
          return {
            rows: Array.from({ length: request.range.end - request.range.start + 1 }, (_, offset) => {
              const index = request.range.start + offset
              return { index, row: { id: `external-${index}`, name: `External ${index}` }, rowId: `external-${index}` }
            }),
            total: 3,
          }
        },
      },
      initialTotal: 3,
      prefetch: { enabled: false },
    })
    rowModel.setViewportRange({ start: 0, end: 2 })
    await rowModel.refresh("manual")
    expect(rowModel.getRow(0)?.data).toEqual({ id: "external-0", name: "External 0" })
    const dispose = vi.spyOn(rowModel, "dispose")
    handle = mountDataGrid(root, {
      rowModel,
      columns: [{ key: "name", field: "name", label: "Name" }],
    })
    await handle.ready

    expect(handle.api.rows.getCount()).toBe(3)
    expect(handle.api.rows.get(0)?.kind).toBe("leaf")
    expect(handle.api.rows.get(0)?.data).toEqual({ id: "external-0", name: "External 0" })
    expect([...root.querySelectorAll('[role="gridcell"]')].map(cell => cell.textContent))
      .toEqual(["External 0", "External 1", "External 2"])

    await handle.destroy()
    handle = undefined
    expect(dispose).not.toHaveBeenCalled()
    rowModel.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it("renders sparse loading rows as inert, full-width placeholders", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    const renderer = vi.fn(() => document.createElement("strong"))
    const rowModel = createDataSourceBackedRowModel<{ id: string; name: string }>({
      dataSource: { async pull() { return { rows: [], total: 2 } } },
      initialTotal: 2,
      prefetch: { enabled: false },
    })
    handle = mountDataGrid(root, {
      rowModel,
      columns: [{ key: "name", field: "name", label: "Name", cellRenderer: renderer }],
      rowSelection: true,
    })
    await handle.ready

    expect(root.querySelectorAll(".affino-grid-dom__row--data-loading")).toHaveLength(2)
    expect(root.querySelectorAll(".affino-grid-dom__cell--data-loading")).toHaveLength(4)
    expect(root.querySelectorAll("[data-row-selection-toggle]")).toHaveLength(0)
    expect(renderer).not.toHaveBeenCalled()
    expect(root.querySelector<HTMLElement>(".affino-grid-dom__row--data-loading")?.getAttribute("aria-busy"))
      .toBe("true")
    root.querySelector<HTMLElement>(".affino-grid-dom__cell--data-loading")!.click()
    expect(handle.api.selection.getSnapshot()).toBeNull()
    await handle.destroy()
    handle = undefined
    rowModel.dispose()
  })

  it("renders custom DOM cell content with the Core row and resolved value context", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    const renderer = vi.fn(({
      document: ownerDocument,
      row,
      rowNode,
      column,
      rowIndex,
      columnIndex,
      value,
      displayValue,
    }: DataGridDomCellRendererContext<{ id: string; status: string }>) => {
      const badge = ownerDocument.createElement("span")
      badge.className = "test-cell-renderer"
      badge.textContent = `${row.id}:${rowNode.rowId}:${column.key}:${rowIndex}:${columnIndex}:${String(value)}:${displayValue}`
      return badge
    })
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", status: "ready" }],
      columns: [{ key: "status", field: "status", label: "Status", cellRenderer: renderer }],
    })
    await handle.ready

    expect(root.querySelector(".test-cell-renderer")?.textContent)
      .toBe("p1:p1:status:0:0:ready:ready")
    expect(renderer).toHaveBeenCalled()
    root.querySelector<HTMLElement>("[role=gridcell]")!.click()
    expect(root.querySelector<HTMLElement>("[role=gridcell]")?.classList)
      .toContain("affino-grid-dom__cell--active")
    expect(root.querySelector(".test-cell-renderer")?.textContent)
      .toBe("p1:p1:status:0:0:ready:ready")

    renderer.mockClear()
    handle.api.rows.setData([{ id: "p1", status: "blocked" }])
    expect(root.querySelector(".test-cell-renderer")?.textContent)
      .toBe("p1:p1:status:0:0:blocked:blocked")
    expect(renderer).toHaveBeenCalled()
  })

  it("applies and clears cell class and style resolvers on rendered cells", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", status: "blocked" }],
      columns: [{ key: "status", field: "status", label: "Status" }],
      cellClass: (row, rowIndex, column, columnIndex) => row.kind === "leaf"
        && row.rowId === "p1" && row.data.status === "blocked"
        && rowIndex === 0 && column.key === "status" && columnIndex === 0
        ? { "test-cell-blocked": true }
        : null,
      cellStyle: row => row.kind === "leaf" && row.data.status === "blocked"
        ? { backgroundColor: "rgb(255, 227, 224)", "--test-cell-accent": "#a33026" }
        : null,
    })
    await handle.ready

    const cell = root.querySelector<HTMLElement>("[role=gridcell]")!
    expect(cell.classList).toContain("test-cell-blocked")
    expect(cell.style.backgroundColor).toBe("rgb(255, 227, 224)")
    expect(cell.style.getPropertyValue("--test-cell-accent")).toBe("#a33026")

    handle.api.rows.setData([{ id: "p1", status: "ready" }])
    expect(cell.classList).not.toContain("test-cell-blocked")
    expect(cell.style.backgroundColor).toBe("")
    expect(cell.style.getPropertyValue("--test-cell-accent")).toBe("")
  })

  it("keeps custom renderer strings as text rather than interpreting HTML", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", value: "raw" }],
      columns: [{ key: "value", field: "value", cellRenderer: () => "<strong>safe</strong>" }],
    })
    await handle.ready

    const cell = root.querySelector<HTMLElement>("[role=gridcell]")!
    expect(cell.textContent).toBe("<strong>safe</strong>")
    expect(cell.querySelector("strong")).toBeNull()
  })

  it("routes cell-level renderer interactions through Core and selects their cell", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    const onInvoke = vi.fn()
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", status: "Ready" }],
      columns: [{
        key: "status",
        field: "status",
        cellInteraction: {
          click: true,
          keyboard: ["enter", "space"],
          role: "button",
          label: "Open status details",
          pressed: true,
          onInvoke,
        },
        cellRenderer: ({ document: ownerDocument }) => {
          const affordance = ownerDocument.createElement("span")
          affordance.textContent = "Open"
          return affordance
        },
      }],
    })
    await handle.ready

    const cell = root.querySelector<HTMLElement>("[role=button]")!
    const affordance = cell.querySelector<HTMLElement>("span")!
    expect(cell.getAttribute("aria-label")).toBe("Open status details")
    expect(cell.getAttribute("aria-pressed")).toBe("true")
    affordance.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }))
    expect(handle.api.selection.getSnapshot()?.activeCell).toMatchObject({ rowIndex: 0, colIndex: 0, rowId: "p1" })
    affordance.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0 }))
    affordance.click()
    expect(onInvoke).toHaveBeenLastCalledWith(expect.objectContaining({ trigger: "click" }))
    expect(handle.api.selection.getSnapshot()?.activeCell).toMatchObject({
      rowIndex: 0,
      colIndex: 0,
      rowId: "p1",
    })

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    const gridSpace = new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true })
    grid.dispatchEvent(gridSpace)
    expect(gridSpace.defaultPrevented).toBe(true)
    expect(onInvoke).toHaveBeenLastCalledWith(expect.objectContaining({ trigger: "keyboard-space" }))

    affordance.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
    expect(onInvoke).toHaveBeenLastCalledWith(expect.objectContaining({ trigger: "keyboard-enter" }))
    affordance.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true }))
    expect(onInvoke).toHaveBeenLastCalledWith(expect.objectContaining({ trigger: "keyboard-space" }))
    expect(handle.api.selection.getSnapshot()?.activeCell).toMatchObject({ rowIndex: 0, colIndex: 0, rowId: "p1" })
  })

  it("keeps header column reordering opt-in", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", name: "Ada" }],
      columns: [{ key: "name", field: "name", label: "Name" }],
    })
    await handle.ready

    const header = root.querySelector<HTMLElement>(".affino-grid-dom__column-header")!
    expect(header.draggable).toBe(false)
    expect(header.dataset.columnKey).toBeUndefined()
  })

  it("sorts from pinned and center headers and exposes the active sort state", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [
        { id: "p1", name: "Grace", team: "Platform" },
        { id: "p2", name: "Ada", team: "Engine" },
        { id: "p3", name: "Alan", team: "Engine" },
      ],
      columns: [
        { key: "name", field: "name", label: "Name", initialState: { width: 180, pin: "left" } },
        { key: "team", field: "team", label: "Team", initialState: { width: 160, pin: "right" } },
        { key: "id", field: "id", label: "ID", initialState: { width: 100 }, capabilities: { sortable: false } },
      ],
    })
    await handle.ready

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    const nameHeader = (): HTMLElement => grid.querySelector<HTMLElement>(".affino-grid-dom__header-left [data-column-index=\"0\"]")!
    const teamHeader = (): HTMLElement => grid.querySelector<HTMLElement>(".affino-grid-dom__header-right [data-column-index=\"2\"]")!
    const names = (): string[] => Array.from(grid.querySelectorAll<HTMLElement>(".affino-grid-dom__body [role=row]"))
      .map(row => row.querySelector<HTMLElement>("[data-column-index=\"0\"]")?.textContent ?? "")

    nameHeader().click()
    expect(handle.api.rows.getSnapshot().sortModel).toEqual([{ key: "name", direction: "asc" }])
    expect(names()).toEqual(["Ada", "Alan", "Grace"])
    expect(nameHeader().getAttribute("aria-sort")).toBe("ascending")

    const shiftClick = new MouseEvent("click", { bubbles: true, shiftKey: true })
    teamHeader().dispatchEvent(shiftClick)
    expect(handle.api.rows.getSnapshot().sortModel).toEqual([
      { key: "name", direction: "asc" },
      { key: "team", direction: "asc" },
    ])
    expect(teamHeader().getAttribute("aria-sort")).toBe("ascending")

    grid.querySelector<HTMLElement>(".affino-grid-dom__header-center [data-column-index=\"1\"]")!.click()
    expect(handle.api.rows.getSnapshot().sortModel).toEqual([
      { key: "name", direction: "asc" },
      { key: "team", direction: "asc" },
    ])

    nameHeader().click()
    expect(handle.api.rows.getSnapshot().sortModel).toEqual([{ key: "name", direction: "desc" }])
    expect(nameHeader().getAttribute("aria-sort")).toBe("descending")
    nameHeader().click()
    expect(handle.api.rows.getSnapshot().sortModel).toEqual([])
    expect(nameHeader().hasAttribute("aria-sort")).toBe(false)
  })

  it("keeps the header outside the scrolling body and mirrors horizontal scrolling", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", name: "Ada" }],
      columns: [{ key: "name", field: "name", label: "Name", initialState: { width: 240 } }],
      rowVirtualization: { rowHeight: 32 },
    })
    await handle.ready

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    const headerViewport = grid.querySelector<HTMLElement>(".affino-grid-dom__header-viewport")!
    const body = grid.querySelector<HTMLElement>(".affino-grid-dom__body")!
    const headerShell = grid.querySelector<HTMLElement>(".affino-grid-dom__header-shell")!
    expect(headerViewport.parentElement).toBe(headerShell)
    expect(headerShell.parentElement).toBe(grid)
    expect(body.parentElement).toBe(grid)
    expect(headerShell.nextElementSibling).toBe(body)

    body.scrollLeft = 60
    body.dispatchEvent(new Event("scroll"))
    expect(headerViewport.scrollLeft).toBe(60)
  })

  it("mirrors the header horizontal offset when virtualization is disabled", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", name: "Ada" }],
      columns: [{ key: "name", field: "name", label: "Name", initialState: { width: 240 } }],
    })
    await handle.ready

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    const headerViewport = grid.querySelector<HTMLElement>(".affino-grid-dom__header-viewport")!
    const body = grid.querySelector<HTMLElement>(".affino-grid-dom__body")!
    body.scrollLeft = 40
    body.dispatchEvent(new Event("scroll"))

    expect(headerViewport.scrollLeft).toBe(40)
  })

  it("does not let stale header scroll events overwrite the body position", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", name: "Ada" }],
      columns: [{ key: "name", field: "name", initialState: { width: 240 } }],
    })
    await handle.ready

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    const headerViewport = grid.querySelector<HTMLElement>(".affino-grid-dom__header-viewport")!
    const body = grid.querySelector<HTMLElement>(".affino-grid-dom__body")!
    body.scrollLeft = 80
    body.dispatchEvent(new Event("scroll"))
    headerViewport.scrollLeft = 40
    headerViewport.dispatchEvent(new Event("scroll"))

    expect(body.scrollLeft).toBe(80)
  })

  it("does not measure viewport width after rendering changed rows or selection", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", name: "Ada" }],
      columns: [{ key: "name", field: "name" }],
    })
    await handle.ready
    let widthReads = 0
    const body = root.querySelector<HTMLElement>(".affino-grid-dom__body")!
    Object.defineProperty(body, "clientWidth", {
      configurable: true,
      get: () => { widthReads += 1; return 320 },
    })
    await handle.api.rows.appendData([{ id: "p2", name: "Grace" }])
    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!.click()

    expect(widthReads).toBe(0)
  })

  it("routes horizontal wheel gestures over the header to the body", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", name: "Ada" }],
      columns: [{ key: "name", field: "name", initialState: { width: 240 } }],
    })
    await handle.ready

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    const headerViewport = grid.querySelector<HTMLElement>(".affino-grid-dom__header-viewport")!
    const body = grid.querySelector<HTMLElement>(".affino-grid-dom__body")!
    Object.defineProperties(body, {
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { configurable: true, value: 500 },
    })
    const wheel = new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaX: 36 })
    headerViewport.dispatchEvent(wheel)

    expect(body.scrollLeft).toBe(36)
    expect(wheel.defaultPrevented).toBe(true)
  })

  it("honors pinned columns and cumulative offsets without column virtualization", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", first: "A", middle: "B", last: "C" }],
      columns: [
        { key: "first", field: "first", initialState: { width: 100, pin: "left" } },
        { key: "middle", field: "middle", initialState: { width: 160 } },
        { key: "last", field: "last", initialState: { width: 120, pin: "right" } },
      ],
    })
    await handle.ready

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    const firstHeader = grid.querySelector<HTMLElement>('.affino-grid-dom__header-left [data-column-index="0"]')!
    const lastHeader = grid.querySelector<HTMLElement>('.affino-grid-dom__header-right [data-column-index="2"]')!
    const firstCell = grid.querySelector<HTMLElement>('.affino-grid-dom__body [data-column-index="0"]')!
    const lastCell = grid.querySelector<HTMLElement>('.affino-grid-dom__body [data-column-index="2"]')!
    expect(firstHeader.classList.contains("affino-grid-dom__cell--pinned-left")).toBe(true)
    expect(firstCell.style.left).toBe("0px")
    expect(lastHeader.style.right).toBe("")
    expect(firstHeader.style.left).toBe("")
    expect(lastCell.style.right).toBe("0px")
  })

  it("keeps header and body grid tracks aligned when a middle column is pinned", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", first: "A", middle: "B", last: "C" }],
      columns: [
        { key: "first", field: "first", initialState: { width: 100 } },
        { key: "middle", field: "middle", initialState: { width: 160 } },
        { key: "last", field: "last", initialState: { width: 120 } },
      ],
    })
    await handle.ready
    const body = root.querySelector<HTMLElement>(".affino-grid-dom__body")!
    Object.defineProperty(body, "clientWidth", { configurable: true, value: 500 })
    handle.api.columns.setPin("first", "left")
    handle.api.columns.setPin("last", "left")

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    expect(grid.style.getPropertyValue("--affino-grid-dom-columns")).toBe("100px 120px minmax(160px, 1fr)")
    expect(grid.style.getPropertyValue("--affino-grid-dom-viewport-width")).toBe("280px")

    const headerCells = [...grid.querySelectorAll<HTMLElement>(".affino-grid-dom__header .affino-grid-dom__column-header")]
    const bodyCells = [...grid.querySelectorAll<HTMLElement>(".affino-grid-dom__body [role=gridcell]")]
    expect(headerCells.map(cell => cell.dataset.columnIndex)).toEqual(["0", "1", "2"])
    expect(bodyCells.map(cell => cell.dataset.columnIndex)).toEqual(["0", "1", "2"])
    expect(headerCells.map(cell => cell.style.left)).toEqual(["", "", ""])
    expect(bodyCells.map(cell => cell.style.left)).toEqual(["0px", "100px", ""])
    expect(grid.querySelectorAll(".affino-grid-dom__header-left .affino-grid-dom__column-header")).toHaveLength(2)
    expect(grid.querySelectorAll(".affino-grid-dom__header-center .affino-grid-dom__column-header")).toHaveLength(1)
  })

  it("lets the last center track fill the gap before a pinned-right column", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", initiative: "Platform", owner: "Ada", status: "Ready", region: "North", value: "$184k" }],
      columns: [
        { key: "initiative", field: "initiative", initialState: { width: 240, pin: "left" } },
        { key: "owner", field: "owner", initialState: { width: 140 } },
        { key: "status", field: "status", initialState: { width: 125 } },
        { key: "region", field: "region", initialState: { width: 155 } },
        { key: "value", field: "value", initialState: { width: 150, pin: "right" } },
      ],
    })
    await handle.ready

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    expect(grid.style.getPropertyValue("--affino-grid-dom-columns"))
      .toBe("240px 140px 125px minmax(155px, 1fr) 150px")
    expect(grid.style.getPropertyValue("--affino-grid-dom-center-columns"))
      .toBe("140px 125px minmax(155px, 1fr)")
  })

  it("reveals keyboard targets past pinned panes without virtualization", async () => {
    const previousGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.classList.contains("affino-grid-dom__body")) return rect(0, 0, 500, 240)
      if (this.classList.contains("affino-grid-dom__row") && this.dataset.rowIndex != null) return rect(0, 0, 700, 32)
      if (this.classList.contains("affino-grid-dom__cell")) {
        const index = Number(this.dataset.columnIndex)
        const body = this.closest<HTMLElement>(".affino-grid-dom__body")!
        if (index === 0) return rect(0, 0, 100, 32)
        if (index === 3) return rect(400, 0, 100, 32)
        const start = index === 1 ? 100 : 350
        return rect(start - body.scrollLeft, 0, 250, 32)
      }
      return previousGetBoundingClientRect.call(this)
    }

    try {
      const root = document.createElement("div")
      document.body.append(root)
      handle = mountDataGrid(root, {
        rows: [{ id: "p1", left: "L", first: "A", second: "B", right: "R" }],
        columns: [
          { key: "left", field: "left", initialState: { width: 100, pin: "left" } },
          { key: "first", field: "first", initialState: { width: 250 } },
          { key: "second", field: "second", initialState: { width: 250 } },
          { key: "right", field: "right", initialState: { width: 100, pin: "right" } },
        ],
      })
      await handle.ready

      const grid = root.querySelector<HTMLElement>("[role=grid]")!
      const body = grid.querySelector<HTMLElement>(".affino-grid-dom__body")!
      Object.defineProperties(body, {
        clientWidth: { configurable: true, value: 500 },
        scrollWidth: { configurable: true, value: 700 },
        scrollLeft: { configurable: true, writable: true, value: 200 },
      })

      grid.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="2"]')!.click()
      grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }))

      expect(handle.api.selection.getSnapshot()?.activeCell).toMatchObject({ rowIndex: 0, colIndex: 1 })
      expect(body.scrollLeft).toBe(0)
    } finally {
      HTMLElement.prototype.getBoundingClientRect = previousGetBoundingClientRect
    }
  })

  it("makes destroy idempotent and removes only the adapter-owned grid element", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", name: "Ada" }],
      columns: [{ key: "name", field: "name" }],
    })
    await handle.ready

    const mounted = handle
    const grid = root.querySelector("[role=grid]")
    const laterHostContent = document.createElement("aside")
    root.append(laterHostContent)
    const dispose = vi.spyOn(mounted.api, "dispose")
    const firstDestroy = mounted.destroy()
    const secondDestroy = mounted.destroy()
    expect(secondDestroy).toBe(firstDestroy)
    await Promise.all([firstDestroy, secondDestroy])
    handle = undefined
    expect(grid?.isConnected).toBe(false)
    expect(laterHostContent.parentElement).toBe(root)
    expect(dispose).toHaveBeenCalledOnce()
    expect(mounted.api.lifecycle.state).toBe("disposed")
  })

  it("stores clicked cell selection through the Core API and renders it", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", name: "Ada" }, { id: "p2", name: "Grace" }],
      columns: [{ key: "name", field: "name" }],
    })
    await handle.ready

    const clickedCell = root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="0"]')
    expect(handle.api.selection.hasSupport()).toBe(true)
    clickedCell?.click()

    expect(handle.api.selection.getSnapshot()).toMatchObject({
      activeCell: { rowIndex: 1, colIndex: 0, rowId: "p2" },
      ranges: [{ startRow: 1, endRow: 1, startCol: 0, endCol: 0 }],
    })
    const renderedCell = root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="0"]')
    expect(renderedCell?.getAttribute("aria-selected")).toBe("true")
    expect(renderedCell?.classList.contains("affino-grid-dom__cell--active")).toBe(true)
  })

  it("adds a separate cell range on Ctrl/Cmd-click and preserves the earlier range", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", name: "Ada", team: "Engine" }, { id: "p2", name: "Grace", team: "Platform" }],
      columns: [
        { key: "name", field: "name" },
        { key: "team", field: "team" },
      ],
    })
    await handle.ready

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!.click()
    root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="1"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }))

    expect(handle.api.selection.getSnapshot()).toMatchObject({
      activeRangeIndex: 1,
      ranges: [
        { startRow: 0, endRow: 0, startCol: 0, endCol: 0 },
        { startRow: 1, endRow: 1, startCol: 1, endCol: 1 },
      ],
      activeCell: { rowIndex: 1, colIndex: 1, rowId: "p2" },
    })
    expect(root.querySelectorAll(".affino-grid-dom__cell--selected")).toHaveLength(2)
  })

  it("extends a dragged cell range and supports adding a dragged group", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", a: "A", b: "B", c: "C" }, { id: "p2", a: "D", b: "E", c: "F" }],
      columns: [
        { key: "a", field: "a", initialState: { width: 120, pin: "left" as const } },
        { key: "b", field: "b" },
        { key: "c", field: "c" },
      ],
    })
    await handle.ready

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    const cell = (row: number, column: number): HTMLElement => grid.querySelector<HTMLElement>(
      `[data-row-index="${row}"][data-column-index="${column}"]`,
    )!
    cell(0, 0).dispatchEvent(new MouseEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: 5,
      clientY: 5,
    }))
    cell(1, 1).dispatchEvent(new MouseEvent("pointermove", {
      bubbles: true,
      buttons: 1,
      clientX: 20,
      clientY: 20,
    }))
    window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0 }))

    expect(handle.api.selection.getSnapshot()).toMatchObject({
      ranges: [{ startRow: 0, endRow: 1, startCol: 0, endCol: 1 }],
    })

    cell(0, 2).dispatchEvent(new MouseEvent("pointerdown", {
      bubbles: true,
      button: 0,
      ctrlKey: true,
      clientX: 30,
      clientY: 5,
    }))
    cell(1, 2).dispatchEvent(new MouseEvent("pointermove", {
      bubbles: true,
      buttons: 1,
      clientX: 30,
      clientY: 20,
    }))
    window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0 }))

    expect(handle.api.selection.getSnapshot()).toMatchObject({
      activeRangeIndex: 1,
      ranges: [
        { startRow: 0, endRow: 1, startCol: 0, endCol: 1 },
        { startRow: 0, endRow: 1, startCol: 2, endCol: 2 },
      ],
    })
    expect(grid.querySelectorAll(".affino-grid-dom__cell--selected").length).toBeGreaterThan(4)
  })

  it("draws one continuous range frame across left-pinned, center, and right-pinned cells", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", left: "L", center: "C", right: "R" }],
      columns: [
        { key: "left", field: "left", initialState: { width: 120, pin: "left" as const } },
        { key: "center", field: "center", initialState: { width: 120 } },
        { key: "right", field: "right", initialState: { width: 120, pin: "right" as const } },
      ],
    })
    await handle.ready

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    const cell = (column: number): HTMLElement => grid.querySelector<HTMLElement>(
      `[data-row-index="0"][data-column-index="${column}"]`,
    )!
    cell(0).dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 5, clientY: 5 }))
    cell(2).dispatchEvent(new MouseEvent("pointermove", { bubbles: true, buttons: 1, clientX: 250, clientY: 5 }))
    window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0 }))

    expect(handle.api.selection.getSnapshot()).toMatchObject({
      ranges: [{ startRow: 0, endRow: 0, startCol: 0, endCol: 2 }],
    })
    expect([cell(0), cell(1), cell(2)].every(item => item.getAttribute("aria-selected") === "true")).toBe(true)
    expect(cell(0).classList.contains("affino-grid-dom__cell--range-left")).toBe(true)
    expect(cell(0).classList.contains("affino-grid-dom__cell--range-right")).toBe(false)
    expect(cell(1).classList.contains("affino-grid-dom__cell--range-left")).toBe(false)
    expect(cell(1).classList.contains("affino-grid-dom__cell--range-right")).toBe(false)
    expect(cell(2).classList.contains("affino-grid-dom__cell--range-right")).toBe(true)
  })

  it("keeps vertical keyboard navigation within the viewport until the next row crosses its edge", async () => {
    const previousClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight")
    const previousScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight")
    Object.defineProperties(HTMLElement.prototype, {
      clientHeight: {
        configurable: true,
        get(this: HTMLElement) {
          if (this.classList.contains("affino-grid-dom__body")) return 96
          return previousClientHeight?.get?.call(this) ?? 0
        },
      },
      scrollHeight: {
        configurable: true,
        get(this: HTMLElement) {
          if (this.classList.contains("affino-grid-dom__body")) return 640
          return previousScrollHeight?.get?.call(this) ?? 0
        },
      },
    })

    try {
      const root = document.createElement("div")
      document.body.append(root)
      handle = mountDataGrid(root, {
        rows: Array.from({ length: 20 }, (_, index) => ({ id: `p${index}`, name: `Person ${index}` })),
        columns: [{ key: "name", field: "name", initialState: { width: 180 } }],
        rowVirtualization: { rowHeight: 32, overscan: 1 },
      })
      await handle.ready
      await new Promise(resolve => setTimeout(resolve, 0))

      const grid = root.querySelector<HTMLElement>("[role=grid]")!
      const body = grid.querySelector<HTMLElement>(".affino-grid-dom__body")!
      grid.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!.click()
      const moveDown = (): void => grid.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      }))

      moveDown()
      expect(body.scrollTop).toBe(0)
      moveDown()
      expect(body.scrollTop).toBe(0)
      moveDown()
      expect(body.scrollTop).toBe(32)
      expect(handle.api.selection.getSnapshot()?.activeCell).toMatchObject({ rowIndex: 3, colIndex: 0 })
    } finally {
      if (previousClientHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", previousClientHeight)
      else Reflect.deleteProperty(HTMLElement.prototype, "clientHeight")
      if (previousScrollHeight) Object.defineProperty(HTMLElement.prototype, "scrollHeight", previousScrollHeight)
      else Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight")
    }
  })

  it("edits editable source cells through Core and cancels drafts with Escape", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", name: "Ada" }],
      columns: [{ key: "name", field: "name", label: "Name", capabilities: { editable: true } }],
    })
    await handle.ready

    root.querySelector<HTMLElement>("[role=gridcell]")?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    let editor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")
    expect(editor?.value).toBe("Ada")
    expect(editor?.selectionStart).toBe(3)
    expect(editor?.selectionEnd).toBe(3)
    editor!.value = "Draft"
    editor!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))
    expect(handle.api.rows.getById("p1")?.data.name).toBe("Ada")

    root.querySelector<HTMLElement>("[role=gridcell]")?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    editor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")
    expect(editor).not.toBeNull()
    expect(editor?.selectionStart).toBe(editor?.value.length)
    expect(editor?.selectionEnd).toBe(editor?.value.length)
    editor!.value = "Augusta Ada King"
    editor!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(handle.api.rows.getById("p1")?.data.name).toBe("Augusta Ada King")
    expect(root.querySelector("[role=gridcell]")?.textContent).toBe("Augusta Ada King")
    expect(root.querySelector(".affino-grid-dom__editor")).toBeNull()
  })

  it("filters and commits typed combobox option values through the Core row patch path", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", status: "open" }],
      columns: [{
        key: "status",
        field: "status",
        label: "Status",
        capabilities: { editable: true },
        presentation: { options: [
          { label: "Open", value: "open" },
          { label: "Done", value: "done" },
        ] },
      }],
    })
    await handle.ready

    root.querySelector<HTMLElement>("[role=gridcell]")?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    const editor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")!
    expect(editor.getAttribute("role")).toBe("combobox")
    expect(document.body.querySelectorAll('[role="option"]')).toHaveLength(2)
    editor.value = "do"
    editor.dispatchEvent(new Event("input", { bubbles: true }))
    expect(document.body.querySelectorAll('[role="option"]')).toHaveLength(1)
    document.body.querySelector<HTMLButtonElement>('[role="option"]')!.click()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(handle.api.rows.getById("p1")?.data.status).toBe("done")
    expect(root.querySelector(".affino-grid-dom__editor")).toBeNull()
    expect(document.body.querySelector(".affino-grid-dom__combobox-panel")).toBeNull()
  })

  it("opens a combobox from the trailing cell affordance", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", status: "open" }],
      columns: [{
        key: "status",
        field: "status",
        label: "Status",
        capabilities: { editable: true },
        presentation: { options: ["open", "done"] },
      }],
    })
    await handle.ready

    const cell = root.querySelector<HTMLElement>("[role=gridcell]")!
    cell.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, right: 120, top: 0, bottom: 32, width: 120, height: 32,
      toJSON: () => ({}),
    })
    cell.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 116 }))

    const editor = root.querySelector<HTMLInputElement>('[role="combobox"]')!
    expect(editor).not.toBeNull()
    expect(document.body.querySelector('[role="listbox"]')).not.toBeNull()
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }))
    expect(handle.api.selection.getSnapshot()?.activeCell?.rowIndex).toBe(0)
  })

  it("opens native date and datetime pickers on double-click", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", due: "2026-10-24", startsAt: "2026-10-24T09:30:00.000Z" }],
      columns: [
        { key: "due", field: "due", cellType: "date", capabilities: { editable: true } },
        { key: "startsAt", field: "startsAt", cellType: "datetime", capabilities: { editable: true } },
      ],
    })
    await handle.ready

    const originalInputShowPicker = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "showPicker")
    const showPicker = vi.fn()
    Object.defineProperty(HTMLInputElement.prototype, "showPicker", { configurable: true, value: showPicker })
    try {
      root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!
        .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
      expect(root.querySelector<HTMLInputElement>('.affino-grid-dom__editor[type="date"]')?.classList.contains("affino-grid-dom__editor--date")).toBe(true)
      expect(showPicker).toHaveBeenCalledOnce()
      root.querySelector<HTMLInputElement>('.affino-grid-dom__editor[type="date"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))

      root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="1"]')!
        .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
      expect(root.querySelector<HTMLInputElement>('.affino-grid-dom__editor[type="datetime-local"]')?.classList.contains("affino-grid-dom__editor--date")).toBe(true)
      expect(showPicker).toHaveBeenCalledTimes(2)
    } finally {
      if (originalInputShowPicker) Object.defineProperty(HTMLInputElement.prototype, "showPicker", originalInputShowPicker)
      else Reflect.deleteProperty(HTMLInputElement.prototype, "showPicker")
    }
  })

  it("keeps invalid typed drafts open and exposes accessible invalid state", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", amount: 12 }],
      columns: [{ key: "amount", field: "amount", cellType: "number", capabilities: { editable: true } }],
    })
    await handle.ready

    root.querySelector<HTMLElement>("[role=gridcell]")!
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    const editor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")!
    editor.value = "not a number"
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))

    expect(handle.api.rows.getById("p1")?.data.amount).toBe(12)
    expect(root.querySelector(".affino-grid-dom__editor")).toBe(editor)
    expect(editor.getAttribute("aria-invalid")).toBe("true")
    expect(editor.closest(".affino-grid-dom__cell")?.classList.contains("affino-grid-dom__cell--invalid")).toBe(true)

    editor.value = "15"
    editor.dispatchEvent(new Event("input", { bubbles: true }))
    expect(editor.hasAttribute("aria-invalid")).toBe(false)
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))
    expect(handle.api.rows.getById("p1")?.data.amount).toBe(15)
    expect(root.querySelector(".affino-grid-dom__editor")).toBeNull()
  })

  it("toggles editable checkbox cells through click and Space", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", active: false }],
      columns: [{
        key: "active",
        field: "active",
        label: "Active",
        dataType: "boolean",
        capabilities: { editable: true },
      }],
    })
    await handle.ready

    const checkbox = root.querySelector<HTMLInputElement>(".affino-grid-dom__cell-checkbox")!
    expect(checkbox.checked).toBe(false)
    checkbox.click()
    expect(handle.api.rows.getById("p1")?.data.active).toBe(true)
    expect(root.querySelector<HTMLInputElement>(".affino-grid-dom__cell-checkbox")?.checked).toBe(true)

    root.querySelector<HTMLElement>("[role=grid]")!.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }),
    )
    expect(handle.api.rows.getById("p1")?.data.active).toBe(false)
    expect(root.querySelector<HTMLInputElement>(".affino-grid-dom__cell-checkbox")?.checked).toBe(false)
  })

  it("commits the previous editor on blur before opening the double-clicked cell", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", name: "Ada" }],
      columns: [
        { key: "name", field: "name", capabilities: { editable: true } },
        { key: "team", field: "team", capabilities: { editable: true } },
      ],
    })
    await handle.ready

    const nameCell = root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!
    nameCell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    const nameEditor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")!
    nameEditor.value = "Augusta"

    const teamCell = root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="1"]')!
    teamCell.click()
    teamCell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))

    expect(handle.api.rows.getById("p1")?.data.name).toBe("Augusta")
    const teamEditor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")
    expect(teamEditor).not.toBeNull()
    expect(teamEditor?.getAttribute("aria-label")).toBe("Edit team")
  })

  it("starts editing from typed input and commits with vertical Enter navigation", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "p1", name: "Ada" }, { id: "p2", name: "Grace" }],
      columns: [{ key: "name", field: "name", capabilities: { editable: true } }],
    })
    await handle.ready

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!.click()
    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "X", bubbles: true, cancelable: true }))
    let editor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")!
    expect(editor.value).toBe("X")
    expect(editor.selectionStart).toBe(1)
    expect(editor.selectionEnd).toBe(1)
    editor.value = "Augusta"
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))

    expect(handle.api.rows.getById("p1")?.data.name).toBe("Augusta")
    expect(handle.api.selection.getSnapshot()?.activeCell).toMatchObject({ rowIndex: 1, colIndex: 0, rowId: "p2" })

    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "G", bubbles: true, cancelable: true }))
    editor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")!
    expect(editor.value).toBe("G")
    editor.value = "Rear Admiral"
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true }))

    expect(handle.api.rows.getById("p2")?.data.name).toBe("Rear Admiral")
    expect(handle.api.selection.getSnapshot()?.activeCell).toMatchObject({ rowIndex: 0, colIndex: 0, rowId: "p1" })

    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "Z", bubbles: true, cancelable: true }))
    editor = root.querySelector<HTMLInputElement>(".affino-grid-dom__editor")!
    editor.value = "Canceled"
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))
    expect(handle.api.rows.getById("p1")?.data.name).toBe("Augusta")
  })

  it("copies a selected TSV range and pastes values through Core row patches", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [
        { id: "p1", name: "Ada", team: "Engine" },
        { id: "p2", name: "Grace", team: "Platform" },
      ],
      columns: [
        { key: "name", field: "name", capabilities: { editable: true } },
        { key: "team", field: "team", capabilities: { editable: true } },
      ],
    })
    await handle.ready

    const first = root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!
    first.click()
    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="1"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }))
    expect(handle.api.selection.getSnapshot()).toMatchObject({ ranges: [{ startRow: 0, endRow: 0, startCol: 0, endCol: 1 }] })

    let clipboardPayload = ""
    const clipboardData = {
      setData: (_type: string, value: string) => { clipboardPayload = value },
      getData: (_type: string) => clipboardPayload,
    }
    const copyEvent = new Event("copy", { bubbles: true, cancelable: true })
    Object.defineProperty(copyEvent, "clipboardData", { value: clipboardData })
    root.querySelector<HTMLElement>("[role=grid]")!.dispatchEvent(copyEvent)

    expect(copyEvent.defaultPrevented).toBe(true)
    expect(clipboardPayload).toBe("Ada\tEngine")
    expect(root.querySelectorAll(".affino-grid-dom__cell--clipboard-copied-top")).toHaveLength(2)

    const target = root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="0"]')!
    target.click()
    const gridElement = root.querySelector<HTMLElement>("[role=grid]")!
    const renderedHeader = gridElement.querySelector(".affino-grid-dom__header")
    const renderedRow = gridElement.querySelector('[role="row"][data-row-index="1"]')
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true })
    Object.defineProperty(pasteEvent, "clipboardData", { value: clipboardData })
    gridElement.dispatchEvent(pasteEvent)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(pasteEvent.defaultPrevented).toBe(true)
    expect(handle.api.rows.getById("p2")?.data).toMatchObject({ name: "Ada", team: "Engine" })
    expect(gridElement.querySelector(".affino-grid-dom__header")).toBe(renderedHeader)
    expect(gridElement.querySelector('[role="row"][data-row-index="1"]')).toBe(renderedRow)
    expect(renderedRow?.textContent).toBe("AdaEngine")
    expect(handle.api.selection.getSnapshot()).toMatchObject({
      ranges: [{ startRow: 1, endRow: 1, startCol: 0, endCol: 1 }],
    })
  })

  it("renders independent row updates while a paste write is still pending", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "r1", name: "First" }, { id: "r2", name: "Second" }],
      columns: [{ key: "name", field: "name", capabilities: { editable: true } }],
    })
    await handle.ready

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!.click()
    let releaseWrite!: () => void
    const pendingWrite = new Promise<void>(resolve => { releaseWrite = resolve })
    const originalApplyEdits = handle.api.rows.applyEdits.bind(handle.api.rows)
    const applyEdits = vi.spyOn(handle.api.rows, "applyEdits").mockImplementation(async patches => {
      await pendingWrite
      return originalApplyEdits(patches, { source: "grid" })
    })

    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true })
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: { getData: () => "Updated first" },
    })
    root.querySelector<HTMLElement>("[role=grid]")!.dispatchEvent(pasteEvent)
    await new Promise(resolve => setTimeout(resolve, 0))

    handle.api.rows.patch([{ rowId: "r2", data: { name: "Updated independently" } }])
    expect(root.querySelector('[data-row-id="r2"] [role=gridcell]')?.textContent)
      .toBe("Updated independently")

    releaseWrite()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(handle.api.rows.getById("r1")?.data.name).toBe("Updated first")
    applyEdits.mockRestore()
  })

  it("keeps ARIA grid coordinates and active descendant aligned with logical cells", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "r1", name: "First" }, { id: "r2", name: "Second" }],
      columns: [
        { key: "name", field: "name" },
        { key: "id", field: "id", pin: "right" },
      ],
      rowSelection: true,
    })
    await handle.ready

    const grid = root.querySelector<HTMLElement>("[role=grid]")!
    expect(grid.getAttribute("aria-rowcount")).toBe("3")
    expect(grid.getAttribute("aria-colcount")).toBe("3")
    expect(grid.querySelector('[role=row][data-row-index="0"]')?.getAttribute("aria-rowindex")).toBe("2")
    expect(grid.querySelector('[role=columnheader][data-column-index="1"]')?.getAttribute("aria-colindex")).toBe("3")

    const firstCell = grid.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!
    firstCell.click()
    const activeId = grid.getAttribute("aria-activedescendant")
    expect(activeId).toBe(firstCell.id)
    expect(grid.ownerDocument.getElementById(activeId!)).toBe(firstCell)

    grid.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }))
    const nextActiveId = grid.getAttribute("aria-activedescendant")
    expect(nextActiveId).toBe(grid.querySelector('[data-row-index="1"][data-column-index="0"]')?.id)
  })

  it("clears copied-cell markers when the row projection changes", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [{ id: "r1", name: "A" }, { id: "r2", name: "B" }],
      columns: [{ key: "name", field: "name" }],
    })
    await handle.ready

    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!.click()
    const copyEvent = new Event("copy", { bubbles: true, cancelable: true })
    Object.defineProperty(copyEvent, "clipboardData", {
      value: { setData: () => undefined, getData: () => "" },
    })
    root.querySelector<HTMLElement>("[role=grid]")!.dispatchEvent(copyEvent)
    expect(root.querySelectorAll(".affino-grid-dom__cell--clipboard-copied-top")).toHaveLength(1)

    handle.api.rows.setSortModel([{ key: "name", direction: "desc" }])
    expect(root.querySelectorAll(".affino-grid-dom__cell--clipboard-copied-top")).toHaveLength(0)
  })

  it("keeps fill handle opt-in and fills a numeric series through an undoable Core edit", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [
        { id: "r1", value: 10 },
        { id: "r2", value: 20 },
        { id: "r3", value: 0 },
        { id: "r4", value: 0 },
      ],
      columns: [{ key: "value", field: "value", capabilities: { editable: true } }],
    })
    await handle.ready
    expect(root.querySelector("[data-fill-handle]")).toBeNull()
    await handle.destroy()

    handle = mountDataGrid(root, {
      fillHandle: true,
      rows: [
        { id: "r1", value: 10 },
        { id: "r2", value: 20 },
        { id: "r3", value: 0 },
        { id: "r4", value: 0 },
      ],
      columns: [{ key: "value", field: "value", capabilities: { editable: true } }],
    })
    await handle.ready
    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!.click()
    root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="0"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }))
    const fillHandle = root.querySelector<HTMLButtonElement>("[data-fill-handle]")!
    const target = root.querySelector<HTMLElement>('[data-row-index="3"][data-column-index="0"]')!

    fillHandle.dispatchEvent(createPointerEvent("pointerdown", 7))
    target.dispatchEvent(createPointerEvent("pointermove", 7))
    expect(root.querySelectorAll("[data-fill-preview-overlay]")).toHaveLength(1)
    expect(target.classList).not.toContain("affino-grid-dom__cell--fill-preview")
    target.dispatchEvent(createPointerEvent("pointerup", 7))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(handle.api.rows.getById("r3")?.data.value).toBe(30)
    expect(handle.api.rows.getById("r4")?.data.value).toBe(40)
    root.querySelector<HTMLButtonElement>("[data-fill-action]")!.click()
    const copyOption = root.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="false"]')!
    expect(copyOption.textContent).toBe("Copy")
    copyOption.click()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(handle.api.rows.getById("r3")?.data.value).toBe(10)
    expect(handle.api.rows.getById("r4")?.data.value).toBe(20)
    await handle.api.transaction.undo()
    expect(handle.api.rows.getById("r3")?.data.value).toBe(0)
    expect(handle.api.rows.getById("r4")?.data.value).toBe(0)
  })

  it("locks diagonal fill drags to one axis and previews the expanded range with one overlay", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      fillHandle: true,
      rows: [
        { id: "r1", first: "A", second: "1", third: "" },
        { id: "r2", first: "B", second: "2", third: "" },
        { id: "r3", first: "", second: "", third: "" },
        { id: "r4", first: "", second: "", third: "" },
      ],
      columns: ["first", "second", "third"].map(field => ({
        key: field,
        field,
        capabilities: { editable: true },
      })),
    })
    await handle.ready
    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!.click()
    root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="1"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }))
    const fillHandle = root.querySelector<HTMLButtonElement>("[data-fill-handle]")!
    const target = root.querySelector<HTMLElement>('[data-row-index="3"][data-column-index="2"]')!

    const previousElementFromPoint = document.elementFromPoint
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => target,
    })
    fillHandle.dispatchEvent(createPointerEvent("pointerdown", 8))
    // Simulate pointer capture: move/up events still target the handle, while
    // hit testing identifies a cell diagonally across both grid axes.
    fillHandle.dispatchEvent(createPointerEvent("pointermove", 8))
    expect(root.querySelectorAll("[data-fill-preview-overlay]")).toHaveLength(1)
    fillHandle.dispatchEvent(createPointerEvent("pointerup", 8))
    if (previousElementFromPoint) {
      Object.defineProperty(document, "elementFromPoint", { configurable: true, value: previousElementFromPoint })
    } else {
      Reflect.deleteProperty(document, "elementFromPoint")
    }
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(handle.api.rows.getById("r3")?.data).toMatchObject({ first: "A", second: "1", third: "" })
    expect(handle.api.rows.getById("r4")?.data).toMatchObject({ first: "B", second: "2", third: "" })
    await handle.api.transaction.undo()
    expect(handle.api.rows.getById("r4")?.data).toMatchObject({ first: "", second: "", third: "" })
  })

  it("extends a fill horizontally without adding rows", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      fillHandle: true,
      rows: [
        { id: "r1", first: "A", second: "1", third: "" },
        { id: "r2", first: "B", second: "2", third: "" },
        { id: "r3", first: "", second: "", third: "" },
      ],
      columns: ["first", "second", "third"].map(field => ({
        key: field,
        field,
        capabilities: { editable: true },
      })),
    })
    await handle.ready
    root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!.click()
    root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="1"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }))
    const fillHandle = root.querySelector<HTMLButtonElement>("[data-fill-handle]")!
    const target = root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="2"]')!
    const previousElementFromPoint = document.elementFromPoint
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => target })

    fillHandle.dispatchEvent(createPointerEvent("pointerdown", 9))
    fillHandle.dispatchEvent(createPointerEvent("pointermove", 9))
    fillHandle.dispatchEvent(createPointerEvent("pointerup", 9))
    if (previousElementFromPoint) {
      Object.defineProperty(document, "elementFromPoint", { configurable: true, value: previousElementFromPoint })
    } else {
      Reflect.deleteProperty(document, "elementFromPoint")
    }
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(handle.api.rows.getById("r1")?.data.third).toBe("A")
    expect(handle.api.rows.getById("r2")?.data.third).toBe("B")
    expect(handle.api.rows.getById("r3")?.data.third).toBe("")
  })

  it("moves a selected cell range with a translated overlay and one undoable edit", async () => {
    const root = document.createElement("div")
    document.body.append(root)
    handle = mountDataGrid(root, {
      rows: [
        { id: "r1", first: "A", second: "1", third: "x" },
        { id: "r2", first: "B", second: "2", third: "y" },
        { id: "r3", first: "", second: "", third: "" },
        { id: "r4", first: "", second: "", third: "" },
      ],
      columns: ["first", "second", "third"].map(field => ({
        key: field,
        field,
        capabilities: { editable: true },
      })),
    })
    await handle.ready
    const source = root.querySelector<HTMLElement>('[data-row-index="0"][data-column-index="0"]')!
    const target = root.querySelector<HTMLElement>('[data-row-index="2"][data-column-index="1"]')!
    source.getBoundingClientRect = () => rect(0, 0, 100, 32)
    source.click()
    root.querySelector<HTMLElement>('[data-row-index="1"][data-column-index="1"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }))
    source.dispatchEvent(createPointerEvent("pointermove", 10, 4, 16, 0))
    expect(source.classList).toContain("affino-grid-dom__cell--range-move-edge")
    source.dispatchEvent(createPointerEvent("pointermove", 10, 50, 16, 0))
    expect(source.classList).not.toContain("affino-grid-dom__cell--range-move-edge")
    const previousElementFromPoint = document.elementFromPoint
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => target })

    source.dispatchEvent(createPointerEvent("pointerdown", 10, 4, 16, 1))
    window.dispatchEvent(createPointerEvent("pointermove", 10, 80, 80, 1))
    expect(root.querySelectorAll("[data-range-move-preview-overlay]")).toHaveLength(1)
    window.dispatchEvent(createPointerEvent("pointerup", 10, 80, 80, 0))
    if (previousElementFromPoint) {
      Object.defineProperty(document, "elementFromPoint", { configurable: true, value: previousElementFromPoint })
    } else {
      Reflect.deleteProperty(document, "elementFromPoint")
    }
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(handle.api.rows.getById("r1")?.data).toMatchObject({ first: "", second: "", third: "x" })
    expect(handle.api.rows.getById("r2")?.data).toMatchObject({ first: "", second: "", third: "y" })
    expect(handle.api.rows.getById("r3")?.data).toMatchObject({ first: "", second: "A", third: "1" })
    expect(handle.api.rows.getById("r4")?.data).toMatchObject({ first: "", second: "B", third: "2" })
    await handle.api.transaction.undo()
    expect(handle.api.rows.getById("r1")?.data).toMatchObject({ first: "A", second: "1", third: "x" })
    expect(handle.api.rows.getById("r3")?.data).toMatchObject({ first: "", second: "", third: "" })
  })
})

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect
}

function createPointerEvent(type: string, pointerId: number, clientX = 20, clientY = 20, buttons = 0): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    isPrimary: { value: true },
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
    buttons: { value: buttons },
  })
  return event
}
