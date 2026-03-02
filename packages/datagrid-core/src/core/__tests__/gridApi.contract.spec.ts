import { describe, expect, it, vi } from "vitest"
import { createDataGridColumnModel, createClientRowModel } from "../../models"
import type { DataGridRowModel } from "../../models"
import type { DataGridSelectionSnapshot } from "../../selection/snapshot"
import { createDataGridTransactionService } from "../transactionService"
import { createDataGridApi as createDataGridApiFromPublic } from "../../public"
import { createDataGridApi } from "../gridApi"
import { createDataGridCore } from "../gridCore"

describe("data grid api facade contracts", () => {
  const waitForCellRefreshFrame = async (): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 30))
  }

  it("is exported through the stable public entrypoint", () => {
    expect(typeof createDataGridApiFromPublic).toBe("function")
  })

  it("fails fast when required model services are missing", () => {
    const core = createDataGridCore()
    expect(() => createDataGridApi({ core })).toThrow(/rowModel/)
  })

  it("exposes namespaced API only (no legacy unscoped methods)", () => {
    const rowModel = createClientRowModel({
      rows: [{ row: { id: 1, name: "alpha" }, rowId: 1, originalIndex: 0 }],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "name", label: "Name" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })

    const api = createDataGridApi({ core }) as Record<string, unknown>
    expect(typeof api.rows).toBe("object")
    expect(typeof api.columns).toBe("object")
    expect(typeof api.view).toBe("object")
    expect(typeof api.pivot).toBe("object")
    expect(typeof api.selection).toBe("object")
    expect(typeof api.transaction).toBe("object")
    expect("getRowCount" in api).toBe(false)
    expect("setSortModel" in api).toBe(false)
    expect("setColumnWidth" in api).toBe(false)
    expect("refreshCellsByRowKeys" in api).toBe(false)
  })

  it("routes row/column/filter/sort/refresh through core services", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, name: "alpha" }, rowId: 1, originalIndex: 0 },
        { row: { id: 2, name: "beta" }, rowId: 2, originalIndex: 1 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "id", label: "ID" },
        { key: "name", label: "Name" },
      ],
    })
    let viewportRange = { start: -1, end: -1 }

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        viewport: {
          name: "viewport",
          setViewportRange(range) {
            viewportRange = { ...range }
          },
        },
      },
    })

    const api = createDataGridApi({ core })

    api.rows.setSortModel([{ key: "id", direction: "asc" }])
    api.rows.setFilterModel({ columnFilters: { name: { kind: "valueSet", tokens: ["string:alpha"] } }, advancedFilters: {} })
    api.rows.setSortAndFilterModel({
      sortModel: [{ key: "id", direction: "desc" }],
      filterModel: { columnFilters: { name: { kind: "valueSet", tokens: ["string:beta"] } }, advancedFilters: {} },
    })
    api.rows.setGroupBy({ fields: ["name"], expandedByDefault: true })
    api.rows.setAggregationModel({ columns: [{ key: "id", op: "count" }] })
    api.rows.setGroupExpansion({ expandedByDefault: true, toggledGroupKeys: [] })
    api.rows.collapseGroup("name=alpha")
    api.rows.setPageSize(1)
    api.rows.setCurrentPage(1)
    api.view.setViewportRange({ start: 0, end: 1 })
    api.columns.setVisibility("id", false)
    api.columns.setWidth("name", 280)
    api.columns.setPin("name", "left")
    api.columns.setOrder(["name", "id"])
    api.view.refresh()

    const rowSnapshot = api.rows.getSnapshot()
    const columnSnapshot = api.columns.getSnapshot()

    expect(rowSnapshot.sortModel).toEqual([{ key: "id", direction: "desc" }])
    expect(rowSnapshot.filterModel).toEqual({
      columnFilters: { name: { kind: "valueSet", tokens: ["string:beta"] } },
      advancedFilters: {},
    })
    expect(rowSnapshot.groupBy).toEqual({
      fields: ["name"],
      expandedByDefault: true,
    })
    expect(api.rows.getAggregationModel()).toEqual({
      columns: [{ key: "id", op: "count" }],
    })
    expect(api.columns.getHistogram("name")).toEqual([
      {
        token: "string:beta",
        value: "beta",
        count: 1,
        text: "beta",
      },
    ])
    expect(rowSnapshot.groupExpansion).toEqual({
      expandedByDefault: true,
      toggledGroupKeys: ["name=alpha"],
    })
    expect(rowSnapshot.pagination.enabled).toBe(true)
    expect(rowSnapshot.pagination.pageSize).toBe(1)
    expect(rowSnapshot.pagination.currentPage).toBe(1)
    expect(rowSnapshot.pagination.totalRowCount).toBe(2)
    expect(rowSnapshot.viewportRange).toEqual({ start: 0, end: 0 })
    expect(viewportRange).toEqual({ start: 0, end: 1 })
    expect(api.rows.getCount()).toBe(1)
    expect(api.rows.getPagination().currentPage).toBe(1)
    const maxIndex = Math.max(0, api.rows.getCount() - 1)
    const candidates = api.rows.getRange({ start: 0, end: Math.min(3, maxIndex) })
    const firstLeaf = candidates.find(row => row.kind === "leaf") as { row: { name: string } } | undefined
    expect(firstLeaf?.row.name).toBe("beta")
    expect(columnSnapshot.order).toEqual(["name", "id"])
    expect(api.columns.get("id")?.visible).toBe(false)
    expect(api.columns.get("name")?.pin).toBe("left")
    expect(api.columns.get("name")?.width).toBe(280)
  })

  it("routes explicit group expansion APIs through row model service", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, team: "alpha" }, rowId: 1, originalIndex: 0 },
        { row: { id: 2, team: "beta" }, rowId: 2, originalIndex: 1 },
      ],
    })
    const columnModel = createDataGridColumnModel()
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })

    const api = createDataGridApi({ core })
    const alphaGroupKey = JSON.stringify([["team", "alpha"]])
    const betaGroupKey = JSON.stringify([["team", "beta"]])
    api.rows.setGroupBy({ fields: ["team"], expandedByDefault: false })
    api.rows.expandGroup(alphaGroupKey)
    api.rows.collapseGroup(alphaGroupKey)
    api.view.expandAllGroups()
    api.rows.setGroupExpansion({
      expandedByDefault: false,
      toggledGroupKeys: [betaGroupKey],
    })

    expect(api.rows.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [betaGroupKey],
    })

    api.view.collapseAllGroups()
    expect(api.rows.getSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [],
    })
  })

  it("routes pivot model through row model service", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, team: "alpha", status: "open" }, rowId: 1, originalIndex: 0 },
        { row: { id: 2, team: "alpha", status: "done" }, rowId: 2, originalIndex: 1 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "id", label: "ID" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    api.pivot.setModel({
      rows: ["team"],
      columns: ["status"],
      values: [{ field: "id", agg: "count" }],
    })

    expect(api.pivot.getModel()).toEqual({
      rows: ["team"],
      columns: ["status"],
      values: [{ field: "id", agg: "count" }],
    })
    expect(api.rows.getSnapshot().pivotModel).toEqual({
      rows: ["team"],
      columns: ["status"],
      values: [{ field: "id", agg: "count" }],
    })
  })

  it("exports and imports pivot layout snapshot with row/column state", () => {
    const rowModel = createClientRowModel({
      rows: [
        {
          row: { id: 1, region: "AMER", team: "core", owner: "NOC", year: "2024", revenue: 1000 },
          rowId: "r1",
          originalIndex: 0,
        },
        {
          row: { id: 2, region: "EMEA", team: "payments", owner: "SRE", year: "2025", revenue: 2000 },
          rowId: "r2",
          originalIndex: 1,
        },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "region", label: "Region" },
        { key: "team", label: "Team" },
        { key: "owner", label: "Owner" },
        { key: "year", label: "Year" },
        { key: "revenue", label: "Revenue" },
      ],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    api.rows.setSortAndFilterModel({
      sortModel: [{ key: "revenue", direction: "desc" }],
      filterModel: {
        columnFilters: { region: { kind: "valueSet", tokens: ["string:amer"] } },
        advancedFilters: {},
      },
    })
    api.rows.setGroupBy({ fields: ["region"], expandedByDefault: true })
    api.pivot.setModel({
      rows: ["region", "team"],
      columns: ["year"],
      values: [{ field: "revenue", agg: "sum" }],
    })
    api.rows.setAggregationModel({
      columns: [{ key: "revenue", field: "revenue", op: "sum" }],
    })
    api.rows.setGroupExpansion({
      expandedByDefault: false,
      toggledGroupKeys: ["pivot:group:6:region4:AMER"],
    })
    api.columns.setOrder(["team", "region", "year", "owner", "revenue"])
    api.columns.setVisibility("owner", false)
    api.columns.setWidth("revenue", 260)
    api.columns.setPin("team", "left")

    const exported = api.pivot.exportLayout()
    const interop = api.pivot.exportInterop()
    expect(interop).not.toBeNull()
    expect(interop?.version).toBe(1)
    expect(interop?.layout.pivotModel).toEqual(exported.pivotModel)
    expect(Array.isArray(interop?.rows)).toBe(true)
    expect((interop?.rows.length ?? 0) > 0).toBe(true)
    expect(Array.isArray(interop?.pivotColumns)).toBe(true)

    api.rows.setSortModel([{ key: "region", direction: "asc" }])
    api.rows.setFilterModel(null)
    api.rows.setGroupBy(null)
    api.pivot.setModel(null)
    api.rows.setAggregationModel(null)
    api.rows.setGroupExpansion({ expandedByDefault: true, toggledGroupKeys: [] })
    api.columns.setOrder(["region", "team", "owner", "year", "revenue"])
    api.columns.setVisibility("owner", true)
    api.columns.setWidth("revenue", 140)
    api.columns.setPin("team", "none")

    api.pivot.importLayout(exported)

    const rowSnapshot = api.rows.getSnapshot()
    const columnSnapshot = api.columns.getSnapshot()

    expect(rowSnapshot.sortModel).toEqual([{ key: "revenue", direction: "desc" }])
    expect(rowSnapshot.filterModel).toEqual({
      columnFilters: { region: { kind: "valueSet", tokens: ["string:amer"] } },
      advancedFilters: {},
    })
    expect(rowSnapshot.groupBy).toEqual({ fields: ["region"], expandedByDefault: true })
    expect(rowSnapshot.pivotModel).toEqual({
      rows: ["region", "team"],
      columns: ["year"],
      values: [{ field: "revenue", agg: "sum" }],
    })
    expect(api.rows.getAggregationModel()).toEqual({
      columns: [{ key: "revenue", field: "revenue", op: "sum" }],
    })
    expect(rowSnapshot.groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: ["pivot:group:6:region4:AMER"],
    })
    expect(columnSnapshot.order).toEqual(["team", "region", "year", "owner", "revenue"])
    expect(api.columns.get("owner")?.visible).toBe(false)
    expect(api.columns.get("revenue")?.width).toBe(260)
    expect(api.columns.get("team")?.pin).toBe("left")
  })

  it("falls back to sequential setFilterModel/setSortModel when row model lacks batched sort+filter capability", () => {
    const clientRowModel = createClientRowModel({
      rows: [
        { row: { id: 1, owner: "noc", score: 100 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, owner: "ops", score: 200 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
      ],
    })
    const { setSortAndFilterModel: _omitBatch, ...rowModelWithoutBatch } = clientRowModel
    const rowModel = rowModelWithoutBatch as unknown as DataGridRowModel<{ id: number; owner: string; score: number }>
    const setSortModelSpy = vi.spyOn(rowModel, "setSortModel")
    const setFilterModelSpy = vi.spyOn(rowModel, "setFilterModel")
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "owner", label: "Owner" },
        { key: "score", label: "Score" },
      ],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    api.rows.setSortAndFilterModel({
      filterModel: {
        columnFilters: { owner: { kind: "valueSet", tokens: ["string:noc"] } },
        advancedFilters: {},
      },
      sortModel: [{ key: "score", direction: "desc" }],
    })

    expect(setFilterModelSpy).toHaveBeenCalledTimes(1)
    expect(setSortModelSpy).toHaveBeenCalledTimes(1)
  })

  it("returns empty histogram map when row model does not expose histogram capability", () => {
    const clientRowModel = createClientRowModel({
      rows: [{ row: { id: 1, owner: "noc" }, rowId: "r1", originalIndex: 0, displayIndex: 0 }],
    })
    const { getColumnHistogram: _omitHistogram, ...rowModelWithoutHistogram } = clientRowModel
    const rowModel = rowModelWithoutHistogram as unknown as DataGridRowModel<{ id: number; owner: string }>
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "owner", label: "Owner" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.columns.getHistogram("owner")).toEqual([])
  })

  it("exposes rows.patch/rows.applyEdits/view.reapply with Excel-like defaults and optional auto-reapply", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, tested_at: 100 }, rowId: "r1", originalIndex: 0, displayIndex: 0 },
        { row: { id: 2, tested_at: 200 }, rowId: "r2", originalIndex: 1, displayIndex: 1 },
        { row: { id: 3, tested_at: 300 }, rowId: "r3", originalIndex: 2, displayIndex: 2 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "tested_at", label: "Tested At" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.rows.hasPatchSupport()).toBe(true)
    expect(api.rows.getAutoReapply()).toBe(false)

    api.rows.setSortModel([{ key: "tested_at", direction: "desc" }])
    expect(api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r2", "r1"])

    // applyEdits defaults to frozen view semantics (no live re-sort/filter/group)
    api.rows.applyEdits([{ rowId: "r1", data: { tested_at: 999 } }])
    expect(api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r2", "r1"])
    expect((api.rows.get(2)?.row as { tested_at?: number })?.tested_at).toBe(999)

    api.rows.setAutoReapply(true)
    expect(api.rows.getAutoReapply()).toBe(true)
    api.rows.applyEdits([{ rowId: "r2", data: { tested_at: 1 } }])
    expect(api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r1", "r3", "r2"])

    api.rows.patch([{ rowId: "r3", data: { tested_at: 2000 } }], { recomputeSort: true })
    expect(api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r1", "r2"])

    api.rows.patch([{ rowId: "r2", data: { tested_at: 5000 } }], { recomputeSort: false })
    expect(api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r1", "r2"])

    api.view.reapply()
    expect(api.rows.getRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r2", "r3", "r1"])
  })

  it("reports missing patch capability for non-client row models and fails loudly", () => {
    const clientRowModel = createClientRowModel({
      rows: [{ row: { id: 1, tested_at: 100 }, rowId: "r1", originalIndex: 0, displayIndex: 0 }],
    })
    const { patchRows: _omitPatch, ...rowModelWithoutPatch } = clientRowModel
    const rowModel = rowModelWithoutPatch as unknown as DataGridRowModel<{ id: number; tested_at: number }>
    const refreshSpy = vi.spyOn(rowModel, "refresh")
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "tested_at", label: "Tested At" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })

    expect(api.rows.hasPatchSupport()).toBe(false)
    expect(() => {
      api.rows.patch([{ rowId: "r1", data: { tested_at: 200 } }])
    }).toThrow(/patchRows capability/i)
    expect(() => {
      api.rows.applyEdits([{ rowId: "r1", data: { tested_at: 200 } }])
    }).toThrow(/patchRows capability/i)

    api.view.reapply()
    expect(refreshSpy).toHaveBeenCalledWith("reapply")
  })

  it("batches cell refresh for large row-key sets without triggering full row-model refresh", async () => {
    const rows = Array.from({ length: 1_500 }, (_unused, index) => ({
      row: {
        rowId: `r${index}`,
        tested_at: `2026-02-${String((index % 28) + 1).padStart(2, "0")}`,
      },
      rowId: `r${index}`,
      originalIndex: index,
    }))
    const rowModel = createClientRowModel({ rows })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "tested_at", label: "Tested At" },
        { key: "control", label: "Control" },
      ],
    })

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })
    api.view.setViewportRange({ start: 0, end: 49 })

    const refreshSpy = vi.spyOn(rowModel, "refresh")
    const batches: Array<{ cells: number }> = []
    const unsubscribe = api.view.onCellsRefresh(batch => {
      batches.push({ cells: batch.cells.length })
    })

    api.view.refreshCellsByRowKeys(
      Array.from({ length: 1_200 }, (_unused, index) => `r${index}`),
      ["tested_at"],
    )
    await waitForCellRefreshFrame()

    unsubscribe()
    expect(refreshSpy).not.toHaveBeenCalled()
    expect(batches).toHaveLength(1)
    expect(batches[0]?.cells).toBe(50)
  })

  it("does not emit repaint entries for rows outside current viewport", async () => {
    const rows = Array.from({ length: 300 }, (_unused, index) => ({
      row: { rowId: `r${index}`, tested_at: `T-${index}` },
      rowId: `r${index}`,
      originalIndex: index,
    }))
    const rowModel = createClientRowModel({ rows })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "tested_at", label: "Tested At" }],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })
    api.view.setViewportRange({ start: 0, end: 19 })

    let emitted = 0
    const unsubscribe = api.view.onCellsRefresh(() => {
      emitted += 1
    })

    api.view.refreshCellsByRowKeys(["r120", "r121", "r122"], ["tested_at"])
    await waitForCellRefreshFrame()

    unsubscribe()
    expect(emitted).toBe(0)
  })

  it("includes pinned left/right metadata in viewport refresh batches", async () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { rowId: "r1", tested_at: "2026-02-20", control: "alpha" }, rowId: "r1", originalIndex: 0 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "tested_at", label: "Tested At", pin: "left" },
        { key: "control", label: "Control", pin: "right" },
      ],
    })
    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
      },
    })
    const api = createDataGridApi({ core })
    api.view.setViewportRange({ start: 0, end: 0 })

    let latestBatch:
      | {
          cells: Array<{ columnKey: string; pin: "left" | "right" | "none" }>
        }
      | null = null
    const unsubscribe = api.view.onCellsRefresh(batch => {
      latestBatch = {
        cells: batch.cells.map(cell => ({ columnKey: cell.columnKey, pin: cell.pin })),
      }
    })

    api.view.refreshCellsByRanges([
      {
        rowKey: "r1",
        columnKeys: ["tested_at", "control"],
      },
    ])
    await waitForCellRefreshFrame()

    unsubscribe()
    if (!latestBatch) {
      throw new Error("Expected refresh batch to be emitted")
    }
    expect(latestBatch).toEqual({
      cells: [
        { columnKey: "tested_at", pin: "left" },
        { columnKey: "control", pin: "right" },
      ],
    })
  })

  it("exposes selection capability checks and fails loudly for missing capability methods", () => {
    const rowModel = createClientRowModel()
    const columnModel = createDataGridColumnModel()

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        selection: { name: "selection" },
      },
    })

    const api = createDataGridApi({ core })

    expect(api.selection.hasSupport()).toBe(false)
    expect(api.selection.getSnapshot()).toBeNull()
    expect(() => api.selection.clear()).toThrow(/selection/)
  })

  it("delegates selection APIs when selection capability is implemented", () => {
    const rowModel = createClientRowModel()
    const columnModel = createDataGridColumnModel()
    let selectionSnapshot: DataGridSelectionSnapshot | null = null
    let clearCount = 0

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        selection: {
          name: "selection",
          getSelectionSnapshot() {
            return selectionSnapshot
          },
          setSelectionSnapshot(snapshot) {
            selectionSnapshot = snapshot
          },
          clearSelection() {
            selectionSnapshot = null
            clearCount += 1
          },
        },
      },
    })

    const api = createDataGridApi({ core })
    const snapshot = {
      ranges: [],
      activeRangeIndex: -1,
      activeCell: null,
    } satisfies DataGridSelectionSnapshot

    api.selection.setSnapshot(snapshot)
    expect(api.selection.hasSupport()).toBe(true)
    expect(api.selection.getSnapshot()).toBe(snapshot)

    api.selection.clear()
    expect(clearCount).toBe(1)
    expect(api.selection.getSnapshot()).toBeNull()
  })

  it("computes selection summary through api facade when selection capability is present", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, owner: "noc", latencyMs: 120 }, rowId: 1, originalIndex: 0 },
        { row: { id: 2, owner: "ops", latencyMs: 80 }, rowId: 2, originalIndex: 1 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "owner", label: "Owner" },
        { key: "latencyMs", label: "Latency" },
      ],
    })
    let selectionSnapshot: DataGridSelectionSnapshot | null = {
      ranges: [
        {
          startRow: 0,
          endRow: 1,
          startCol: 0,
          endCol: 1,
          startRowId: 1,
          endRowId: 2,
          anchor: { rowIndex: 0, colIndex: 0, rowId: 1 },
          focus: { rowIndex: 1, colIndex: 1, rowId: 2 },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 1, rowId: 2 },
    }

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        selection: {
          name: "selection",
          getSelectionSnapshot() {
            return selectionSnapshot
          },
          setSelectionSnapshot(snapshot) {
            selectionSnapshot = snapshot
          },
          clearSelection() {
            selectionSnapshot = null
          },
        },
      },
    })

    const api = createDataGridApi({ core })
    const summary = api.selection.summarize({
      columns: [
        { key: "owner", aggregations: ["countDistinct"] },
        { key: "latencyMs", aggregations: ["sum", "max"] },
      ],
    })

    expect(summary?.selectedCells).toBe(4)
    expect(summary?.columns.owner.metrics.countDistinct).toBe(2)
    expect(summary?.columns.latencyMs.metrics.sum).toBe(200)
    expect(summary?.columns.latencyMs.metrics.max).toBe(120)
  })

  it("roundtrips row/column/filter/pagination/group/selection snapshots deterministically", () => {
    const rowModel = createClientRowModel({
      rows: [
        { row: { id: 1, owner: "noc", status: "open" }, rowId: 1, originalIndex: 0 },
        { row: { id: 2, owner: "ops", status: "open" }, rowId: 2, originalIndex: 1 },
        { row: { id: 3, owner: "qa", status: "closed" }, rowId: 3, originalIndex: 2 },
      ],
    })
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "id", label: "ID", width: 90 },
        { key: "owner", label: "Owner", width: 160 },
        { key: "status", label: "Status", width: 140 },
      ],
    })
    let selectionSnapshot: DataGridSelectionSnapshot | null = null

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        selection: {
          name: "selection",
          getSelectionSnapshot() {
            return selectionSnapshot
          },
          setSelectionSnapshot(snapshot) {
            selectionSnapshot = snapshot
          },
          clearSelection() {
            selectionSnapshot = null
          },
        },
      },
    })
    const api = createDataGridApi({ core })

    api.rows.setSortModel([{ key: "owner", direction: "asc" }])
    api.rows.setFilterModel({
      columnFilters: { status: { kind: "valueSet", tokens: ["string:open"] } },
      advancedFilters: {},
    })
    api.rows.setGroupBy({ fields: ["status"], expandedByDefault: true })
    api.rows.toggleGroup(`[["status","open"]]`)
    api.rows.setPagination({ pageSize: 2, currentPage: 0 })
    api.view.setViewportRange({ start: 0, end: 1 })
    api.columns.setOrder(["status", "owner", "id"])
    api.columns.setVisibility("id", false)
    api.columns.setPin("owner", "left")
    api.columns.setWidth("status", 220)
    api.selection.setSnapshot({
      ranges: [
        {
          startRow: 0,
          endRow: 0,
          startCol: 0,
          endCol: 1,
          startRowId: 1,
          endRowId: 1,
          anchor: { rowIndex: 0, colIndex: 0, rowId: 1 },
          focus: { rowIndex: 0, colIndex: 1, rowId: 1 },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 0, colIndex: 1, rowId: 1 },
    })

    const expectedRow = api.rows.getSnapshot()
    const expectedColumns = api.columns.getSnapshot()
    const expectedSelection = api.selection.getSnapshot()

    api.rows.setSortModel([{ key: "status", direction: "desc" }])
    api.rows.setFilterModel({ columnFilters: {}, advancedFilters: {} })
    api.rows.setGroupBy(null)
    api.rows.setPagination({ pageSize: 1, currentPage: 1 })
    api.view.setViewportRange({ start: 1, end: 1 })
    api.columns.setOrder(["id", "owner", "status"])
    api.columns.setVisibility("id", true)
    api.columns.setPin("owner", "none")
    api.columns.setWidth("status", 100)
    api.selection.clear()

    api.rows.setSortModel(expectedRow.sortModel)
    api.rows.setFilterModel(expectedRow.filterModel)
    api.rows.setGroupBy(expectedRow.groupBy)
    api.rows.setGroupExpansion(expectedRow.groupExpansion)
    api.rows.setPagination({
      pageSize: expectedRow.pagination.pageSize,
      currentPage: expectedRow.pagination.currentPage,
    })
    api.view.setViewportRange(expectedRow.viewportRange)
    api.columns.setOrder(expectedColumns.order)
    for (const column of expectedColumns.columns) {
      api.columns.setVisibility(column.key, column.visible)
      api.columns.setPin(column.key, column.pin)
      api.columns.setWidth(column.key, column.width)
    }
    if (expectedSelection) {
      api.selection.setSnapshot(expectedSelection)
    }

    const rowRoundtrip = api.rows.getSnapshot()
    const columnsRoundtrip = api.columns.getSnapshot()
    const selectionRoundtrip = api.selection.getSnapshot()

    expect(rowRoundtrip.sortModel).toEqual(expectedRow.sortModel)
    expect(rowRoundtrip.filterModel).toEqual(expectedRow.filterModel)
    expect(rowRoundtrip.groupBy).toEqual(expectedRow.groupBy)
    expect(rowRoundtrip.groupExpansion).toEqual(expectedRow.groupExpansion)
    expect(rowRoundtrip.pagination).toEqual(expectedRow.pagination)
    expect(rowRoundtrip.viewportRange).toEqual(expectedRow.viewportRange)

    expect(columnsRoundtrip.order).toEqual(expectedColumns.order)
    expect(
      columnsRoundtrip.columns.map(column => ({
        key: column.key,
        visible: column.visible,
        pin: column.pin,
        width: column.width,
      })),
    ).toEqual(
      expectedColumns.columns.map(column => ({
        key: column.key,
        visible: column.visible,
        pin: column.pin,
        width: column.width,
      })),
    )

    expect(selectionRoundtrip).toEqual(expectedSelection)
  })

  it("exposes transaction capability checks and fails loudly for missing methods", () => {
    const rowModel = createClientRowModel()
    const columnModel = createDataGridColumnModel()

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        transaction: { name: "transaction" },
      },
    })

    const api = createDataGridApi({ core })

    expect(api.transaction.hasSupport()).toBe(false)
    expect(api.transaction.getSnapshot()).toBeNull()
    expect(() => api.transaction.undo()).toThrow(/transaction/)
  })

  it("delegates transaction APIs when transaction capability is implemented", async () => {
    const rowModel = createClientRowModel()
    const columnModel = createDataGridColumnModel()
    const values: Record<string, number> = {}
    const transactionService = createDataGridTransactionService({
      execute(command) {
        if (command.type !== "set") {
          return
        }
        const payload = command.payload as { key: string; value: number }
        values[payload.key] = payload.value
      },
    })

    const core = createDataGridCore({
      services: {
        rowModel: { name: "rowModel", model: rowModel },
        columnModel: { name: "columnModel", model: columnModel },
        transaction: {
          name: "transaction",
          getTransactionSnapshot: transactionService.getSnapshot,
          beginTransactionBatch: transactionService.beginBatch,
          commitTransactionBatch: transactionService.commitBatch,
          rollbackTransactionBatch: transactionService.rollbackBatch,
          applyTransaction: transactionService.applyTransaction,
          canUndoTransaction: transactionService.canUndo,
          canRedoTransaction: transactionService.canRedo,
          undoTransaction: transactionService.undo,
          redoTransaction: transactionService.redo,
        },
      },
    })

    const api = createDataGridApi({ core })
    await api.transaction.apply({
      commands: [
        {
          type: "set",
          payload: { key: "a", value: 1 },
          rollbackPayload: { key: "a", value: 0 },
        },
      ],
    })
    expect(api.transaction.hasSupport()).toBe(true)
    expect(api.transaction.canUndo()).toBe(true)
    expect(values.a).toBe(1)

    await api.transaction.undo()
    expect(values.a).toBe(0)
    expect(api.transaction.canRedo()).toBe(true)
  })
})
