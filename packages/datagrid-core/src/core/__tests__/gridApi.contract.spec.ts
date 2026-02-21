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

    api.setSortModel([{ key: "id", direction: "asc" }])
    api.setFilterModel({ columnFilters: { name: ["alpha"] }, advancedFilters: {} })
    api.setSortAndFilterModel({
      sortModel: [{ key: "id", direction: "desc" }],
      filterModel: { columnFilters: { name: ["beta"] }, advancedFilters: {} },
    })
    api.setGroupBy({ fields: ["name"], expandedByDefault: true })
    api.setAggregationModel({ columns: [{ key: "id", op: "count" }] })
    api.setGroupExpansion({ expandedByDefault: true, toggledGroupKeys: [] })
    api.collapseGroup("name=alpha")
    api.setPageSize(1)
    api.setCurrentPage(1)
    api.setViewportRange({ start: 0, end: 1 })
    api.setColumnVisibility("id", false)
    api.setColumnWidth("name", 280)
    api.setColumnPin("name", "left")
    api.setColumnOrder(["name", "id"])
    api.refresh()

    const rowSnapshot = api.getRowModelSnapshot()
    const columnSnapshot = api.getColumnModelSnapshot()

    expect(rowSnapshot.sortModel).toEqual([{ key: "id", direction: "desc" }])
    expect(rowSnapshot.filterModel).toEqual({
      columnFilters: { name: ["beta"] },
      advancedFilters: {},
    })
    expect(rowSnapshot.groupBy).toEqual({
      fields: ["name"],
      expandedByDefault: true,
    })
    expect(api.getAggregationModel()).toEqual({
      columns: [{ key: "id", op: "count" }],
    })
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
    expect(api.getRowCount()).toBe(1)
    expect(api.getPaginationSnapshot().currentPage).toBe(1)
    const maxIndex = Math.max(0, api.getRowCount() - 1)
    const candidates = api.getRowsInRange({ start: 0, end: Math.min(3, maxIndex) })
    const firstLeaf = candidates.find(row => row.kind === "leaf") as { row: { name: string } } | undefined
    expect(firstLeaf?.row.name).toBe("beta")
    expect(columnSnapshot.order).toEqual(["name", "id"])
    expect(api.getColumn("id")?.visible).toBe(false)
    expect(api.getColumn("name")?.pin).toBe("left")
    expect(api.getColumn("name")?.width).toBe(280)
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
    api.setGroupBy({ fields: ["team"], expandedByDefault: false })
    api.expandGroup(alphaGroupKey)
    api.collapseGroup(alphaGroupKey)
    api.expandAllGroups()
    api.setGroupExpansion({
      expandedByDefault: false,
      toggledGroupKeys: [betaGroupKey],
    })

    expect(api.getRowModelSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [betaGroupKey],
    })

    api.collapseAllGroups()
    expect(api.getRowModelSnapshot().groupExpansion).toEqual({
      expandedByDefault: false,
      toggledGroupKeys: [],
    })
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

    api.setSortAndFilterModel({
      filterModel: {
        columnFilters: { owner: ["noc"] },
        advancedFilters: {},
      },
      sortModel: [{ key: "score", direction: "desc" }],
    })

    expect(setFilterModelSpy).toHaveBeenCalledTimes(1)
    expect(setSortModelSpy).toHaveBeenCalledTimes(1)
  })

  it("exposes patchRows/applyEdits/reapplyView with Excel-like defaults and optional auto-reapply", () => {
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

    expect(api.hasPatchSupport()).toBe(true)
    expect(api.getAutoReapply()).toBe(false)

    api.setSortModel([{ key: "tested_at", direction: "desc" }])
    expect(api.getRowsInRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r2", "r1"])

    // applyEdits defaults to frozen view semantics (no live re-sort/filter/group)
    api.applyEdits([{ rowId: "r1", data: { tested_at: 999 } }])
    expect(api.getRowsInRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r2", "r1"])
    expect((api.getRow(2)?.row as { tested_at?: number })?.tested_at).toBe(999)

    api.setAutoReapply(true)
    expect(api.getAutoReapply()).toBe(true)
    api.applyEdits([{ rowId: "r2", data: { tested_at: 1 } }])
    expect(api.getRowsInRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r1", "r3", "r2"])

    api.patchRows([{ rowId: "r3", data: { tested_at: 2000 } }], { recomputeSort: true })
    expect(api.getRowsInRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r1", "r2"])

    api.patchRows([{ rowId: "r2", data: { tested_at: 5000 } }], { recomputeSort: false })
    expect(api.getRowsInRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r3", "r1", "r2"])

    api.reapplyView()
    expect(api.getRowsInRange({ start: 0, end: 2 }).map(row => String(row.rowId))).toEqual(["r2", "r3", "r1"])
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

    expect(api.hasPatchSupport()).toBe(false)
    expect(() => {
      api.patchRows([{ rowId: "r1", data: { tested_at: 200 } }])
    }).toThrow(/patchRows capability/i)
    expect(() => {
      api.applyEdits([{ rowId: "r1", data: { tested_at: 200 } }])
    }).toThrow(/patchRows capability/i)

    api.reapplyView()
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
    api.setViewportRange({ start: 0, end: 49 })

    const refreshSpy = vi.spyOn(rowModel, "refresh")
    const batches: Array<{ cells: number }> = []
    const unsubscribe = api.onCellsRefresh(batch => {
      batches.push({ cells: batch.cells.length })
    })

    api.refreshCellsByRowKeys(
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
    api.setViewportRange({ start: 0, end: 19 })

    let emitted = 0
    const unsubscribe = api.onCellsRefresh(() => {
      emitted += 1
    })

    api.refreshCellsByRowKeys(["r120", "r121", "r122"], ["tested_at"])
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
    api.setViewportRange({ start: 0, end: 0 })

    let latestBatch:
      | {
          cells: Array<{ columnKey: string; pin: "left" | "right" | "none" }>
        }
      | null = null
    const unsubscribe = api.onCellsRefresh(batch => {
      latestBatch = {
        cells: batch.cells.map(cell => ({ columnKey: cell.columnKey, pin: cell.pin })),
      }
    })

    api.refreshCellsByRanges([
      {
        rowKey: "r1",
        columnKeys: ["tested_at", "control"],
      },
    ])
    await waitForCellRefreshFrame()

    unsubscribe()
    expect(latestBatch?.cells).toEqual([
      { columnKey: "tested_at", pin: "left" },
      { columnKey: "control", pin: "right" },
    ])
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

    expect(api.hasSelectionSupport()).toBe(false)
    expect(api.getSelectionSnapshot()).toBeNull()
    expect(() => api.clearSelection()).toThrow(/selection/)
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

    api.setSelectionSnapshot(snapshot)
    expect(api.hasSelectionSupport()).toBe(true)
    expect(api.getSelectionSnapshot()).toBe(snapshot)

    api.clearSelection()
    expect(clearCount).toBe(1)
    expect(api.getSelectionSnapshot()).toBeNull()
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
    const summary = api.summarizeSelection({
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

    api.setSortModel([{ key: "owner", direction: "asc" }])
    api.setFilterModel({
      columnFilters: { status: ["open"] },
      advancedFilters: {},
    })
    api.setGroupBy({ fields: ["status"], expandedByDefault: true })
    api.toggleGroup(`[["status","open"]]`)
    api.setPagination({ pageSize: 2, currentPage: 0 })
    api.setViewportRange({ start: 0, end: 1 })
    api.setColumnOrder(["status", "owner", "id"])
    api.setColumnVisibility("id", false)
    api.setColumnPin("owner", "left")
    api.setColumnWidth("status", 220)
    api.setSelectionSnapshot({
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

    const expectedRow = api.getRowModelSnapshot()
    const expectedColumns = api.getColumnModelSnapshot()
    const expectedSelection = api.getSelectionSnapshot()

    api.setSortModel([{ key: "status", direction: "desc" }])
    api.setFilterModel({ columnFilters: {}, advancedFilters: {} })
    api.setGroupBy(null)
    api.setPagination({ pageSize: 1, currentPage: 1 })
    api.setViewportRange({ start: 1, end: 1 })
    api.setColumnOrder(["id", "owner", "status"])
    api.setColumnVisibility("id", true)
    api.setColumnPin("owner", "none")
    api.setColumnWidth("status", 100)
    api.clearSelection()

    api.setSortModel(expectedRow.sortModel)
    api.setFilterModel(expectedRow.filterModel)
    api.setGroupBy(expectedRow.groupBy)
    api.setGroupExpansion(expectedRow.groupExpansion)
    api.setPagination({
      pageSize: expectedRow.pagination.pageSize,
      currentPage: expectedRow.pagination.currentPage,
    })
    api.setViewportRange(expectedRow.viewportRange)
    api.setColumnOrder(expectedColumns.order)
    for (const column of expectedColumns.columns) {
      api.setColumnVisibility(column.key, column.visible)
      api.setColumnPin(column.key, column.pin)
      api.setColumnWidth(column.key, column.width)
    }
    if (expectedSelection) {
      api.setSelectionSnapshot(expectedSelection)
    }

    const rowRoundtrip = api.getRowModelSnapshot()
    const columnsRoundtrip = api.getColumnModelSnapshot()
    const selectionRoundtrip = api.getSelectionSnapshot()

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

    expect(api.hasTransactionSupport()).toBe(false)
    expect(api.getTransactionSnapshot()).toBeNull()
    expect(() => api.undoTransaction()).toThrow(/transaction/)
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
    await api.applyTransaction({
      commands: [
        {
          type: "set",
          payload: { key: "a", value: 1 },
          rollbackPayload: { key: "a", value: 0 },
        },
      ],
    })
    expect(api.hasTransactionSupport()).toBe(true)
    expect(api.canUndoTransaction()).toBe(true)
    expect(values.a).toBe(1)

    await api.undoTransaction()
    expect(values.a).toBe(0)
    expect(api.canRedoTransaction()).toBe(true)
  })
})
