import { describe, expect, it } from "vitest"
import { createClientRowColumnHistogramRuntime } from "../projection/clientRowColumnHistogramRuntime.js"
import type { DataGridRowNode } from "../rowModel.js"

interface HistogramRow {
  id: number
  owner: string
  team: string
}

function createRow(row: HistogramRow, index: number): DataGridRowNode<HistogramRow> {
  return {
    kind: "leaf",
    data: row,
    row,
    rowKey: `r${row.id}`,
    rowId: `r${row.id}`,
    originalIndex: index,
    sourceIndex: index,
    displayIndex: index,
    state: { selected: false, group: false, pinned: "none", expanded: false },
  }
}

describe("createClientRowColumnHistogramRuntime", () => {
  it("preserves source, filtered, and ignore-self histogram scopes", () => {
    const sourceRows = [
      createRow({ id: 1, owner: "Alice", team: "A" }, 0),
      createRow({ id: 2, owner: "Bob", team: "A" }, 1),
      createRow({ id: 3, owner: "Alice", team: "B" }, 2),
    ]
    const runtime = createClientRowColumnHistogramRuntime<HistogramRow>({
      ensureActive: () => {},
      getBaseSourceRows: () => sourceRows,
      getFilteredRowsProjection: () => [sourceRows[0]],
      readProjectionRowField: (row, key) => row.data[key as keyof HistogramRow],
      resolveFilterPredicate: options => {
        if (options?.ignoreColumnFilterKey === "owner") {
          return row => row.data.team === "A"
        }
        if (options?.ignoreColumnFilterKey === "team") {
          return row => row.data.owner === "Alice"
        }
        return () => true
      },
    })

    expect(runtime.getColumnHistogram("owner")).toEqual([
      { token: "string:Alice", value: "Alice", count: 1, text: "Alice" },
    ])
    expect(runtime.getColumnHistogram("owner", { ignoreSelfFilter: true })).toEqual([
      { token: "string:Alice", value: "Alice", count: 1, text: "Alice" },
      { token: "string:Bob", value: "Bob", count: 1, text: "Bob" },
    ])
    expect(runtime.getColumnHistogram("team", { ignoreSelfFilter: true })).toEqual([
      { token: "string:A", value: "A", count: 1, text: "A" },
      { token: "string:B", value: "B", count: 1, text: "B" },
    ])
    expect(runtime.getColumnHistogram("owner", { scope: "sourceAll" })).toEqual([
      { token: "string:Alice", value: "Alice", count: 2, text: "Alice" },
      { token: "string:Bob", value: "Bob", count: 1, text: "Bob" },
    ])
    expect(runtime.getColumnHistogram("  ")).toEqual([])
  })
})
