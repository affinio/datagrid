import { describe, expect, it, vi } from "vitest"
import { createClientRowModel, createDataGridColumnModel, createServerBackedRowModel } from "../../models"
import { createDataGridViewportController } from "../dataGridViewportController"
import type { ServerRowModel } from "../../models/server/serverRowModel.js"
import type { VisibleRow } from "../../types"
import type { ImperativeRowUpdatePayload } from "../dataGridViewportTypes"

function buildRows(count: number): VisibleRow<{ id: number; value: string }>[] {
  return Array.from({ length: count }, (_, index) => ({
    row: { id: index, value: `row-${index}` },
    rowId: index,
    originalIndex: index,
    displayIndex: index,
  }))
}

function buildGroupedRows(groupCount: number, rowsPerGroup: number): VisibleRow<{ id: string; team: string; value: number }>[] {
  const rows: VisibleRow<{ id: string; team: string; value: number }>[] = []
  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const team = `team-${groupIndex}`
    for (let rowIndex = 0; rowIndex < rowsPerGroup; rowIndex += 1) {
      const index = rows.length
      const id = `${team}-row-${rowIndex}`
      rows.push({
        row: { id, team, value: index },
        rowId: id,
        originalIndex: index,
        displayIndex: index,
      })
    }
  }
  return rows
}

function buildParentTreeRows(): VisibleRow<{ id: string; parentId: string | null; value: number }>[] {
  const source = [
    { id: "root-a", parentId: null, value: 1 },
    { id: "child-a-1", parentId: "root-a", value: 2 },
    { id: "child-a-2", parentId: "root-a", value: 3 },
    { id: "root-b", parentId: null, value: 4 },
    { id: "child-b-1", parentId: "root-b", value: 5 },
  ]
  return source.map((row, index) => ({
    row,
    rowId: row.id,
    originalIndex: index,
    displayIndex: index,
  }))
}

function mountLayoutNodes() {
  const container = document.createElement("div") as HTMLDivElement
  const header = document.createElement("div")

  Object.defineProperty(container, "clientWidth", { configurable: true, value: 640 })
  Object.defineProperty(container, "clientHeight", { configurable: true, value: 360 })
  Object.defineProperty(container, "scrollWidth", { configurable: true, value: 640 })
  Object.defineProperty(container, "scrollHeight", { configurable: true, value: 3200 })
  Object.defineProperty(header, "offsetHeight", { configurable: true, value: 40 })

  document.body.appendChild(container)
  document.body.appendChild(header)

  return {
    container,
    header,
    cleanup() {
      header.remove()
      container.remove()
    },
  }
}

function createServerModelStub(rows: VisibleRow<{ id: number; value: string }>[]) {
  const fetchBlock = vi.fn(async () => {})

  const source: ServerRowModel<{ id: number; value: string }> = {
    rows: { value: rows.map(entry => entry.row) },
    loading: { value: false },
    error: { value: null },
    blocks: { value: new Map() },
    total: { value: rows.length },
    loadedRanges: { value: [] },
    progress: { value: 1 },
    blockErrors: { value: new Map() },
    diagnostics: {
      value: {
        cacheBlocks: 0,
        cachedRows: rows.length,
        pendingBlocks: 0,
        pendingRequests: 0,
        abortedRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        effectivePreloadThreshold: 0.6,
      },
    },
    getRowAt(index) {
      return rows[index]?.row
    },
    getRowCount() {
      return rows.length
    },
    refreshBlock: vi.fn(async () => {}),
    fetchBlock,
    reset: vi.fn(),
    abortAll: vi.fn(),
    dispose: vi.fn(),
  }

  return { source, fetchBlock }
}

function latestRowsPayload(onRows: ReturnType<typeof vi.fn>): ImperativeRowUpdatePayload {
  const latestCall = onRows.mock.calls[onRows.mock.calls.length - 1]
  expect(latestCall).toBeDefined()
  return latestCall?.[0] as ImperativeRowUpdatePayload
}

describe("table viewport row-model boundary", () => {
  it("syncs visible range into active row model", () => {
    const rows = buildRows(120)
    const clientModel = createClientRowModel({ rows })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "value", label: "Value", initialState: { width: 180 } }],
    })
    const calls: Array<{ start: number; end: number }> = []
    let rangeReads = 0
    const originalSetViewportRange = clientModel.setViewportRange
    const originalGetRowsInRange = clientModel.getRowsInRange
    clientModel.setViewportRange = range => {
      calls.push({ ...range })
      originalSetViewportRange(range)
    }
    clientModel.getRowsInRange = range => {
      rangeReads += 1
      return originalGetRowsInRange(range)
    }

    const { container, header, cleanup } = mountLayoutNodes()

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel: clientModel,
      columnModel,
    })

    controller.setViewportMetrics({ containerWidth: 640, containerHeight: 360, headerHeight: 40 })
    controller.attach(container, header)
    controller.refresh(true)

    expect(calls.length).toBeGreaterThan(0)
    const lastCall = calls[calls.length - 1]
    expect(lastCall?.start ?? -1).toBeGreaterThanOrEqual(0)
    expect(lastCall?.end ?? -1).toBeGreaterThanOrEqual(lastCall?.start ?? -1)
    expect(rangeReads).toBeGreaterThan(0)
    const activeNode = clientModel.getRow(lastCall?.start ?? 0)
    expect(activeNode?.rowKey).toBe(activeNode?.rowId)
    expect(activeNode?.sourceIndex).toBeGreaterThanOrEqual(0)
    expect(activeNode?.displayIndex).toBeGreaterThanOrEqual(activeNode?.sourceIndex ?? 0)
    expect(activeNode?.state.pinned).toBe("none")

    controller.detach()
    controller.dispose()
    columnModel.dispose()
    clientModel.dispose()
    cleanup()
  })

  it("keeps client/server-backed visible range parity", () => {
    const rows = buildRows(150)
    const clientModel = createClientRowModel({ rows })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "value", label: "Value", initialState: { width: 200 } }],
    })
    const { source, fetchBlock } = createServerModelStub(rows)
    const serverBackedModel = createServerBackedRowModel({ source })

    const { container, header, cleanup } = mountLayoutNodes()

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel: clientModel,
      columnModel,
    })

    controller.setViewportMetrics({ containerWidth: 640, containerHeight: 360, headerHeight: 40 })
    controller.attach(container, header)

    controller.refresh(true)
    const clientRange = { ...controller.derived.rows.visibleRange.value }

    controller.setRowModel(serverBackedModel)
    controller.refresh(true)
    const serverRange = { ...controller.derived.rows.visibleRange.value }

    expect(serverRange).toEqual(clientRange)

    controller.detach()
    controller.dispose()
    columnModel.dispose()
    serverBackedModel.dispose()
    clientModel.dispose()
    cleanup()
  })

  it("does not re-warm server blocks when viewport range is unchanged", () => {
    const rows = buildRows(100)
    const { source, fetchBlock } = createServerModelStub(rows)
    const serverBackedModel = createServerBackedRowModel({ source })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "value", label: "Value", initialState: { width: 180 } }],
    })
    const { container, header, cleanup } = mountLayoutNodes()

    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel: serverBackedModel,
      columnModel,
    })

    controller.setViewportMetrics({ containerWidth: 640, containerHeight: 360, headerHeight: 40 })
    controller.attach(container, header)

    controller.refresh(true)
    const firstCallCount = fetchBlock.mock.calls.length

    controller.refresh(true)
    expect(fetchBlock.mock.calls.length).toBe(firstCallCount)

    controller.detach()
    controller.dispose()
    columnModel.dispose()
    serverBackedModel.dispose()
    cleanup()
  })

  it("clamps grouped visible range when collapse removes rows around the active viewport", () => {
    const rowModel = createClientRowModel({
      rows: buildGroupedRows(2, 48),
      initialGroupBy: { fields: ["team"], expandedByDefault: true },
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "value", label: "Value", initialState: { width: 180 } }],
    })
    const onRows = vi.fn()
    const { container, header, cleanup } = mountLayoutNodes()
    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel,
      columnModel,
      imperativeCallbacks: { onRows },
    })

    controller.setViewportMetrics({ containerWidth: 640, containerHeight: 360, headerHeight: 40 })
    controller.attach(container, header)
    controller.refresh(true)
    controller.scrollToRow(rowModel.getRowCount() - 1)
    controller.refresh(true)
    expect(controller.derived.rows.visibleRange.value.start).toBeGreaterThan(0)

    rowModel.collapseAllGroups()
    controller.refresh(true)

    const payload = latestRowsPayload(onRows)
    const visibleRows = payload.visibleRows ?? []
    const visibleRowIds = visibleRows.map(row => row.rowId)
    const collapsedModelRows = rowModel.getRowsInRange({ start: 0, end: rowModel.getRowCount() })
    expect(rowModel.getSnapshot().rowCount).toBe(2)
    expect(controller.core.totalRowCount.value).toBe(2)
    expect(controller.derived.rows.visibleRange.value.start).toBe(0)
    expect(controller.derived.rows.visibleRange.value.end).toBeLessThanOrEqual(rowModel.getRowCount())
    expect(collapsedModelRows.map(row => row.kind)).toEqual(["group", "group"])
    expect(visibleRowIds).toEqual(collapsedModelRows.map(row => row.rowId))
    expect(new Set(visibleRowIds).size).toBe(visibleRowIds.length)
    expect(visibleRows.every(row => row.displayIndex >= 0 && row.displayIndex < rowModel.getRowCount())).toBe(true)

    controller.detach()
    controller.dispose()
    columnModel.dispose()
    rowModel.dispose()
    cleanup()
  })

  it("rematerializes parent tree rows after collapse and re-expand near the viewport", () => {
    const rowModel = createClientRowModel({
      rows: buildParentTreeRows(),
      initialTreeData: {
        mode: "parent",
        getParentId: row => row.parentId,
        expandedByDefault: true,
      },
    })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "value", label: "Value", initialState: { width: 180 } }],
    })
    const onRows = vi.fn()
    const { container, header, cleanup } = mountLayoutNodes()
    const controller = createDataGridViewportController({
      resolvePinMode: () => "none",
      rowModel,
      columnModel,
      imperativeCallbacks: { onRows },
    })

    controller.setViewportMetrics({ containerWidth: 640, containerHeight: 360, headerHeight: 40 })
    controller.attach(container, header)
    controller.refresh(true)

    expect(rowModel.getRowsInRange({ start: 0, end: 10 }).map(row => row.rowId)).toEqual([
      "root-a",
      "child-a-1",
      "child-a-2",
      "root-b",
      "child-b-1",
    ])

    controller.scrollToRow(4)
    controller.refresh(true)
    rowModel.collapseGroup("tree:parent:root-a")
    controller.refresh(true)

    const collapsedRows = latestRowsPayload(onRows).visibleRows ?? []
    expect(rowModel.getSnapshot().rowCount).toBe(3)
    expect(rowModel.getRowsInRange({ start: 0, end: 10 }).map(row => row.rowId)).toEqual([
      "root-a",
      "root-b",
      "child-b-1",
    ])
    expect(controller.derived.rows.visibleRange.value.end).toBeLessThanOrEqual(rowModel.getRowCount())
    expect(collapsedRows.map(row => row.rowId)).not.toContain("child-a-1")
    expect(collapsedRows.map(row => row.rowId)).not.toContain("child-a-2")

    rowModel.expandGroup("tree:parent:root-a")
    controller.refresh(true)

    const expandedRows = latestRowsPayload(onRows).visibleRows ?? []
    expect(rowModel.getSnapshot().rowCount).toBe(5)
    expect(rowModel.getRowsInRange({ start: 0, end: 10 }).map(row => row.rowId)).toEqual([
      "root-a",
      "child-a-1",
      "child-a-2",
      "root-b",
      "child-b-1",
    ])
    expect(new Set(expandedRows.map(row => row.rowId)).size).toBe(expandedRows.length)
    expect(expandedRows.every(row => row.displayIndex >= 0 && row.displayIndex < rowModel.getRowCount())).toBe(true)

    controller.detach()
    controller.dispose()
    columnModel.dispose()
    rowModel.dispose()
    cleanup()
  })
})
