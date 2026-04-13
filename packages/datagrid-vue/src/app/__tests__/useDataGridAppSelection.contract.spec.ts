import { ref } from "vue"
import { describe, expect, it } from "vitest"
import { useDataGridAppSelection } from "../useDataGridAppSelection"

type EffectiveSelectionRow = {
  rowId: string
  formula: string
  effectiveAmount: number
}

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

  it("does not offset selected-cell aggregates when row-selection support exists but row-selection is hidden", () => {
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
      showRowSelection: ref(false),
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

  it("recomputes selected-cell aggregates after row changes inside the active selection", () => {
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

    const rows: EffectiveSelectionRow[] = [
      { rowId: "r1", formula: "=5+5", effectiveAmount: 10 },
      { rowId: "r2", formula: "=10+10", effectiveAmount: 20 },
    ]

    let revision = 0
    const rowModelListenerRef: { current: (() => void) | null } = { current: null }

    const selection = useDataGridAppSelection<EffectiveSelectionRow>({
      mode: ref("base"),
      visibleColumns: ref([
        {
          key: "formula",
          column: {
            key: "formula",
            label: "Formula",
          },
        },
      ] as never),
      totalRows: ref(rows.length),
      readSelectionCell: row => row.data.effectiveAmount,
      resolveRuntime: () => ({
        api: {
          rows: {
            get: (rowIndex: number) => ({ kind: "leaf", rowId: rows[rowIndex]?.rowId, data: rows[rowIndex] }),
          },
          selection: {
            hasSupport: () => true,
            getSnapshot: () => runtimeSnapshot,
          },
        },
        rowModel: {
          getSnapshot: () => ({
            kind: "client",
            revision,
            rowCount: rows.length,
            loading: false,
            projection: null,
          }),
          subscribe: (listener: () => void) => {
            rowModelListenerRef.current = listener
            return () => {
              if (rowModelListenerRef.current === listener) {
                rowModelListenerRef.current = null
              }
            }
          },
        },
      } as never),
    })

    selection.syncSelectionSnapshotFromRuntime()

    expect(selection.selectionAggregatesLabel.value).toBe(
      "Selection: count 2 · sum 30 · min 10 · max 20 · avg 15",
    )

    rows[1] = { rowId: "r2", formula: "=10+10", effectiveAmount: 40 }
    revision += 1
    if (typeof rowModelListenerRef.current === "function") {
      rowModelListenerRef.current()
    }

    expect(selection.selectionAggregatesLabel.value).toBe(
      "Selection: count 2 · sum 50 · min 10 · max 40 · avg 25",
    )
  })
})
