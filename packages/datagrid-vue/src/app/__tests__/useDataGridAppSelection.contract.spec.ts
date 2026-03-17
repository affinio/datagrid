import { ref } from "vue"
import { describe, expect, it } from "vitest"
import { useDataGridAppSelection } from "../useDataGridAppSelection"

describe("useDataGridAppSelection contract", () => {
  it("keeps selection anchor synchronized with the active snapshot range", () => {
    const runtimeSnapshot = {
      ranges: [
        {
          startRow: 0,
          endRow: 3,
          startCol: 0,
          endCol: 0,
          startRowId: "r1",
          endRowId: "r4",
          anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
          focus: { rowIndex: 3, colIndex: 0, rowId: "r4" },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 3, colIndex: 0, rowId: "r4" },
    } as never

    const selection = useDataGridAppSelection({
      mode: ref("base"),
      resolveRuntime: () => ({
        api: {
          selection: {
            hasSupport: () => true,
            getSnapshot: () => runtimeSnapshot,
          },
        },
      } as never),
    })

    selection.syncSelectionSnapshotFromRuntime()

    expect(selection.selectionSnapshot.value).toStrictEqual(runtimeSnapshot)
    expect(selection.selectionAnchor.value).toEqual({ rowIndex: 0, colIndex: 0, rowId: "r1" })

    selection.selectionService.clearSelection!()
    expect(selection.selectionSnapshot.value).toBeNull()
    expect(selection.selectionAnchor.value).toBeNull()
  })

  it("computes selected-cell aggregates through column valueGetter accessors", () => {
    const runtimeSnapshot = {
      ranges: [
        {
          startRow: 0,
          endRow: 1,
          startCol: 0,
          endCol: 0,
          startRowId: "r1",
          endRowId: "r2",
          anchor: { rowIndex: 0, colIndex: 0, rowId: "r1" },
          focus: { rowIndex: 1, colIndex: 0, rowId: "r2" },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 0, rowId: "r2" },
    } as never

    const rows = [
      { rowId: "r1", metrics: { amount: 10 } },
      { rowId: "r2", metrics: { amount: 20 } },
    ]

    const selection = useDataGridAppSelection({
      mode: ref("base"),
      visibleColumns: ref([
        {
          key: "amount",
          column: {
            key: "amount",
            label: "Amount",
            valueGetter: (row: { metrics: { amount: number } }) => row.metrics.amount,
          },
        },
      ] as never),
      totalRows: ref(rows.length),
      resolveRuntime: () => ({
        api: {
          rows: {
            get: (rowIndex: number) => ({ kind: "leaf", data: rows[rowIndex] }),
          },
          selection: {
            hasSupport: () => true,
            getSnapshot: () => runtimeSnapshot,
          },
        },
      } as never),
    })

    selection.syncSelectionSnapshotFromRuntime()

    expect(selection.selectionAggregatesLabel.value).toBe(
      "Selection: count 2 · sum 30 · min 10 · max 20 · avg 15",
    )
  })

  it("keeps selected-cell aggregates aligned when row-selection injects a leading system column", () => {
    const runtimeSnapshot = {
      ranges: [
        {
          startRow: 0,
          endRow: 1,
          startCol: 1,
          endCol: 1,
          startRowId: "r1",
          endRowId: "r2",
          anchor: { rowIndex: 0, colIndex: 1, rowId: "r1" },
          focus: { rowIndex: 1, colIndex: 1, rowId: "r2" },
        },
      ],
      activeRangeIndex: 0,
      activeCell: { rowIndex: 1, colIndex: 1, rowId: "r2" },
    } as never

    const rows = [
      { rowId: "r1", amount: 10, other: 100 },
      { rowId: "r2", amount: 20, other: 200 },
    ]

    const selection = useDataGridAppSelection({
      mode: ref("base"),
      visibleColumns: ref([
        {
          key: "amount",
          column: {
            key: "amount",
            label: "Amount",
          },
        },
        {
          key: "other",
          column: {
            key: "other",
            label: "Other",
          },
        },
      ] as never),
      totalRows: ref(rows.length),
      resolveRuntime: () => ({
        api: {
          rows: {
            get: (rowIndex: number) => ({ kind: "leaf", data: rows[rowIndex] }),
          },
          rowSelection: {
            hasSupport: () => true,
          },
          selection: {
            hasSupport: () => true,
            getSnapshot: () => runtimeSnapshot,
          },
        },
      } as never),
    })

    selection.syncSelectionSnapshotFromRuntime()

    expect(selection.selectionAggregatesLabel.value).toBe(
      "Selection: count 2 · sum 30 · min 10 · max 20 · avg 15",
    )
  })
})
