import { describe, expect, it, vi } from "vitest"
import { createClientRowModel, createDataGridColumnModel } from "../../models"
import type { DataGridColumnDef } from "../../models"
import type { VisibleRow } from "../../types"
import { createDataGridViewportModelBridgeService } from "../dataGridViewportModelBridgeService"

function buildRows(count: number): VisibleRow<{ id: number; value: string }>[] {
  return Array.from({ length: count }, (_, index) => ({
    row: { id: index, value: `row-${index}` },
    rowId: index,
    originalIndex: index,
    displayIndex: index,
  }))
}

describe("table viewport model bridge service", () => {
  it("keeps deterministic caches and invalidates only on model updates", () => {
    const rowModel = createClientRowModel({ rows: buildRows(8) })
    const rowCalls: number[] = []
    const originalGetRow = rowModel.getRow
    rowModel.getRow = index => {
      rowCalls.push(index)
      return originalGetRow(index)
    }
    const columnModel = createDataGridColumnModel({
      columns: [
        { key: "id", label: "ID", width: 120, pin: "left" },
        { key: "value", label: "Value", width: 200, visible: true },
        { key: "hidden", label: "Hidden", visible: false, width: 80 },
      ],
    })
    const onInvalidate = vi.fn()
    const fallbackRowModel = createClientRowModel()
    const fallbackColumnModel = createDataGridColumnModel()
    const bridge = createDataGridViewportModelBridgeService({
      initialRowModel: rowModel,
      initialColumnModel: columnModel,
      fallbackRowModel,
      fallbackColumnModel,
      onInvalidate,
    })

    const firstCount = bridge.getRowCount()
    const secondCount = bridge.getRowCount()
    const firstRow = bridge.getRow(0)
    const secondRow = bridge.getRow(0)
    const firstRange = bridge.getRowsInRange({ start: 0, end: 2 })
    const firstColumns = bridge.materializeColumns()
    const secondColumns = bridge.materializeColumns()

    expect(firstCount).toBe(8)
    expect(secondCount).toBe(8)
    expect(firstRow).toBe(secondRow)
    expect(firstRange).toHaveLength(3)
    expect(firstRange[2]?.rowId).toBe(2)
    expect(bridge.getRow(1000)).toBeUndefined()
    expect(rowCalls).toEqual([0])
    expect(firstColumns).toBe(secondColumns)
    expect(firstColumns.map(column => column.key)).toEqual(["id", "value"])
    expect(firstColumns[0]?.pin).toBe("left")
    expect(onInvalidate).toHaveBeenCalled()

    rowModel.setRows(buildRows(4))
    expect(bridge.getRowCount()).toBe(4)
    bridge.getRow(0)
    expect(rowCalls).toEqual([0, 0])

    rowModel.setGroupBy({ fields: ["value"], expandedByDefault: true })
    bridge.getRow(0)
    expect(rowCalls).toEqual([0, 0, 0])

    bridge.dispose()
    rowModel.dispose()
    columnModel.dispose()
    fallbackRowModel.dispose()
    fallbackColumnModel.dispose()
  })

  it("serves row access by index without full materialization", () => {
    const rows = buildRows(100_000)
    const columns = Array.from({ length: 520 }, (_, index) => ({
      key: `col_${index}`,
      label: `Column ${index}`,
      width: 90 + (index % 5) * 10,
      pin: index < 2 ? "left" : index > 516 ? "right" : "none",
      visible: true,
    }))
    const rowModel = createClientRowModel({ rows })
    const rowCalls: number[] = []
    const originalGetRow = rowModel.getRow
    rowModel.getRow = index => {
      rowCalls.push(index)
      return originalGetRow(index)
    }
    const columnModel = createDataGridColumnModel({ columns })
    const fallbackRowModel = createClientRowModel()
    const fallbackColumnModel = createDataGridColumnModel()
    const bridge = createDataGridViewportModelBridgeService({
      initialRowModel: rowModel,
      initialColumnModel: columnModel,
      fallbackRowModel,
      fallbackColumnModel,
      onInvalidate: () => {},
    })

    const baselineCount = bridge.getRowCount()
    const baselineColumns = bridge.materializeColumns()
    const sampleIndexes = [0, 51, 4_000, 99_999]

    for (let index = 0; index < 20; index += 1) {
      for (const sampleIndex of sampleIndexes) {
        bridge.getRow(sampleIndex)
      }
      const nextColumns = bridge.materializeColumns()
      expect(nextColumns).toBe(baselineColumns)
    }

    expect(baselineCount).toBe(100_000)
    expect(baselineColumns.length).toBe(520)
    expect(new Set(rowCalls)).toEqual(new Set(sampleIndexes))

    bridge.dispose()
    rowModel.dispose()
    columnModel.dispose()
    fallbackRowModel.dispose()
    fallbackColumnModel.dispose()
  })

  it("keeps row entry cache bounded with lru eviction on long scroll access", () => {
    const rows = buildRows(2_000)
    const rowModel = createClientRowModel({ rows })
    const rowCalls: number[] = []
    const originalGetRow = rowModel.getRow
    rowModel.getRow = index => {
      rowCalls.push(index)
      return originalGetRow(index)
    }

    const columnModel = createDataGridColumnModel()
    const fallbackRowModel = createClientRowModel()
    const fallbackColumnModel = createDataGridColumnModel()
    const bridge = createDataGridViewportModelBridgeService({
      initialRowModel: rowModel,
      initialColumnModel: columnModel,
      fallbackRowModel,
      fallbackColumnModel,
      onInvalidate: () => {},
      rowEntryCacheLimit: 4,
    })

    bridge.getRow(0)
    bridge.getRow(1)
    bridge.getRow(2)
    bridge.getRow(3)
    bridge.getRow(0) // keep row 0 hot
    bridge.getRow(4) // evicts row 1
    bridge.getRow(5) // evicts row 2
    bridge.getRow(6) // evicts row 3
    bridge.getRow(7) // evicts row 0
    bridge.getRow(0) // miss: must be fetched again after long scroll

    expect(rowCalls).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0])

    bridge.dispose()
    rowModel.dispose()
    columnModel.dispose()
    fallbackRowModel.dispose()
    fallbackColumnModel.dispose()
  })

  it("maps canonical row nodes to viewport visible-row shape at the boundary", () => {
    const rowModel = createClientRowModel({
      rows: [
        {
          kind: "leaf",
          data: { id: 1, value: "alpha" },
          row: { id: 1, value: "alpha" },
          rowKey: "alpha",
          rowId: "alpha",
          sourceIndex: 0,
          originalIndex: 0,
          displayIndex: 3,
          state: { selected: false, group: false, pinned: "top", expanded: false },
        },
        {
          kind: "leaf",
          data: { id: 2, value: "bravo" },
          row: { id: 2, value: "bravo" },
          rowKey: "bravo",
          rowId: "bravo",
          sourceIndex: 1,
          originalIndex: 1,
          displayIndex: 4,
          state: { selected: false, group: false, pinned: "bottom", expanded: false },
        },
      ],
    })
    const fallbackRowModel = createClientRowModel()
    const columnModel = createDataGridColumnModel()
    const fallbackColumnModel = createDataGridColumnModel()
    const bridge = createDataGridViewportModelBridgeService({
      initialRowModel: rowModel,
      initialColumnModel: columnModel,
      fallbackRowModel,
      fallbackColumnModel,
      onInvalidate: () => {},
    })

    const row = bridge.getRow(0)
    expect(row?.rowId).toBe("alpha")
    expect(row?.displayIndex).toBe(0)
    expect(row?.stickyTop).toBe(true)
    expect(row?.stickyBottom).toBeUndefined()
    expect((row?.row as { value: string }).value).toBe("alpha")
    const secondRow = bridge.getRow(1)
    expect(secondRow?.rowId).toBe("bravo")
    expect(secondRow?.stickyTop).toBeUndefined()
    expect(secondRow?.stickyBottom).toBe(true)

    bridge.dispose()
    rowModel.dispose()
    fallbackRowModel.dispose()
    columnModel.dispose()
    fallbackColumnModel.dispose()
  })

  it("ignores non-canonical sticky fields and maps only pinned state", () => {
    const rowNode = {
      kind: "leaf",
      data: { id: 1, value: "alpha" },
      row: { id: 1, value: "alpha" },
      rowKey: "alpha",
      rowId: "alpha",
      sourceIndex: 0,
      originalIndex: 0,
      displayIndex: 0,
      stickyTop: true,
      stickyBottom: true,
      state: { selected: false, group: false, pinned: "none", expanded: false },
    } as const
    const rowModel = {
      kind: "client" as const,
      getSnapshot: () => ({
        kind: "client" as const,
        rowCount: 1,
        loading: false,
        error: null,
        viewportRange: { start: 0, end: 0 },
        sortModel: [],
        filterModel: null,
        groupBy: null,
        groupExpansion: {
          expandedByDefault: false,
          toggledGroupKeys: [],
        },
      }),
      getRowCount: () => 1,
      getRow: () => rowNode,
      getRowsInRange: () => [rowNode],
      setViewportRange: () => {},
      setSortModel: () => {},
      setFilterModel: () => {},
      setGroupBy: () => {},
      toggleGroup: () => {},
      refresh: () => {},
      subscribe: () => () => {},
      dispose: () => {},
    }
    const columnModel = createDataGridColumnModel()
    const fallbackRowModel = createClientRowModel()
    const fallbackColumnModel = createDataGridColumnModel()
    const bridge = createDataGridViewportModelBridgeService({
      initialRowModel: rowModel,
      initialColumnModel: columnModel,
      fallbackRowModel,
      fallbackColumnModel,
      onInvalidate: () => {},
    })

    const row = bridge.getRow(0)
    expect(row?.stickyTop).toBeUndefined()
    expect(row?.stickyBottom).toBeUndefined()
    const rangeRow = bridge.getRowsInRange({ start: 0, end: 0 })[0]
    expect(rangeRow?.stickyTop).toBeUndefined()
    expect(rangeRow?.stickyBottom).toBeUndefined()

    bridge.dispose()
    columnModel.dispose()
    fallbackRowModel.dispose()
    fallbackColumnModel.dispose()
  })

  it("maps headless column defs to datagrid columns at viewport boundary", () => {
    const rowModel = createClientRowModel()
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "id", width: 96, pin: "left", meta: { isSystem: true, stickyLeft: true } }],
    })
    const fallbackRowModel = createClientRowModel()
    const fallbackColumnModel = createDataGridColumnModel()
    const bridge = createDataGridViewportModelBridgeService({
      initialRowModel: rowModel,
      initialColumnModel: columnModel,
      fallbackRowModel,
      fallbackColumnModel,
      onInvalidate: () => {},
    })

    const columns = bridge.materializeColumns()
    expect(columns).toHaveLength(1)
    expect(columns[0]?.key).toBe("id")
    expect(columns[0]?.label).toBe("id")
    expect(columns[0]?.pin).toBe("left")
    expect(columns[0]?.width).toBe(96)
    expect((columns[0] as unknown as { isSystem?: boolean }).isSystem).toBe(true)
    expect((columns[0] as unknown as { stickyLeft?: boolean }).stickyLeft).toBe(true)

    bridge.dispose()
    rowModel.dispose()
    fallbackRowModel.dispose()
    columnModel.dispose()
    fallbackColumnModel.dispose()
  })

  it("keeps backward-compatible passthrough for legacy column extras", () => {
    const rowModel = createClientRowModel()
    const legacyColumn = {
      key: "legacy",
      width: 100,
      pin: "left",
      isSystem: true,
      stickyLeft: true,
    } as unknown as DataGridColumnDef
    const columnModel = createDataGridColumnModel({
      columns: [legacyColumn],
    })
    const fallbackRowModel = createClientRowModel()
    const fallbackColumnModel = createDataGridColumnModel()
    const bridge = createDataGridViewportModelBridgeService({
      initialRowModel: rowModel,
      initialColumnModel: columnModel,
      fallbackRowModel,
      fallbackColumnModel,
      onInvalidate: () => {},
    })

    const columns = bridge.materializeColumns()
    expect((columns[0] as unknown as { isSystem?: boolean }).isSystem).toBe(true)
    expect((columns[0] as unknown as { stickyLeft?: boolean }).stickyLeft).toBe(true)

    bridge.dispose()
    rowModel.dispose()
    fallbackRowModel.dispose()
    columnModel.dispose()
    fallbackColumnModel.dispose()
  })
})
