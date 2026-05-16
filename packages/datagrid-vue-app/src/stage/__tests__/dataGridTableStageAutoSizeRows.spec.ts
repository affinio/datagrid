import { describe, expect, it, vi } from "vitest"
import type { DataGridRowNode } from "@affino/datagrid-vue"
import { resolveDataGridTableStageAutoSizeRows } from "../dataGridTableStageAutoSizeRows"

interface Row {
  id: number
  name: string
}

function rowNode(row: Row, index: number): DataGridRowNode<Row> {
  return {
    row,
    data: row,
    rowId: row.id,
    rowKey: row.id,
    sourceIndex: index,
    originalIndex: index,
    displayIndex: index,
    kind: "leaf",
    state: { pinned: "none", selected: false, group: false, expanded: false },
  }
}

describe("resolveDataGridTableStageAutoSizeRows", () => {
  it("samples cached runtime rows before falling back to prop rows", () => {
    const fallbackRows = [{ id: 100, name: "fallback" }]
    const cachedRows = [
      rowNode({ id: 2, name: "visible long value" }, 2),
      rowNode({ id: 4, name: "prefetched longer value" }, 3),
    ]
    const getRow = vi.fn((index: number) => cachedRows.find(row => row.displayIndex === index) ?? null)
    const getRowsInRange = vi.fn(() => [cachedRows[0]!])

    const rows = resolveDataGridTableStageAutoSizeRows<Row>({
      rowModel: {
        getSnapshot: () => ({ viewportRange: { start: 2, end: 2 } }) as never,
        getRowCount: () => 10,
        getRowsInRange,
        getRow,
      },
      fallbackRows,
      sampleLimit: 4,
    })

    expect(rows).toEqual([
      { id: 2, name: "visible long value" },
      { id: 4, name: "prefetched longer value" },
    ])
    expect(getRowsInRange).toHaveBeenCalledWith({ start: 2, end: 2 })
    expect(getRow).toHaveBeenCalled()
  })

  it("does not force-load missing runtime rows", () => {
    const getRow = vi.fn(() => null)

    const rows = resolveDataGridTableStageAutoSizeRows<Row>({
      rowModel: {
        getSnapshot: () => ({ viewportRange: { start: 100, end: 120 } }) as never,
        getRowCount: () => 10_000,
        getRowsInRange: () => [],
        getRow,
      },
      fallbackRows: [{ id: 1, name: "fallback" }],
      sampleLimit: 8,
    })

    expect(rows).toEqual([{ id: 1, name: "fallback" }])
    expect(getRow).toHaveBeenCalledTimes(8)
  })
})
