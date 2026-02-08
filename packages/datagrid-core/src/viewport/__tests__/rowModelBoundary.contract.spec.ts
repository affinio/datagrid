import { describe, expect, it, vi } from "vitest"
import { createClientRowModel, createDataGridColumnModel, createServerBackedRowModel } from "../../models"
import { createDataGridViewportController } from "../dataGridViewportController"
import type { ServerRowModel } from "../../serverRowModel/serverRowModel"
import type { VisibleRow } from "../../types"

function buildRows(count: number): VisibleRow<{ id: number; value: string }>[] {
  return Array.from({ length: count }, (_, index) => ({
    row: { id: index, value: `row-${index}` },
    rowId: index,
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

describe("table viewport row-model boundary", () => {
  it("syncs visible range into active row model", () => {
    const rows = buildRows(120)
    const clientModel = createClientRowModel({ rows })
    const columnModel = createDataGridColumnModel({
      columns: [{ key: "value", label: "Value", width: 180 }],
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
      columns: [{ key: "value", label: "Value", width: 200 }],
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
    expect(fetchBlock).toHaveBeenCalled()

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
      columns: [{ key: "value", label: "Value", width: 180 }],
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
})
