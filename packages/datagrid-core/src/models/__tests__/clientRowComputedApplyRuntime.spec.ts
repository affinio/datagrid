import { describe, expect, it, vi } from "vitest"
import { createClientRowComputedApplyRuntime } from "../compute/clientRowComputedApplyRuntime.js"
import type {
  ApplyComputedFieldsToSourceRowsResult,
} from "../compute/clientRowComputedExecutionRuntime.js"
import type {
  DataGridRowId,
  DataGridRowNode,
} from "../rowModel.js"

interface RowData {
  value?: number
}

function createResult(
  overrides: Partial<ApplyComputedFieldsToSourceRowsResult<RowData>> = {},
): ApplyComputedFieldsToSourceRowsResult<RowData> {
  return {
    changed: false,
    changedRowIds: [],
    computedUpdatesByRowId: new Map<DataGridRowId, Partial<RowData>>(),
    previousRowsById: new Map<DataGridRowId, DataGridRowNode<RowData>>(),
    nextRowsById: new Map<DataGridRowId, DataGridRowNode<RowData>>(),
    nextSourceRows: null,
    formulaDiagnostics: {
      recomputedFields: [],
      runtimeErrorCount: 0,
      runtimeErrors: [],
    },
    computeStageDiagnostics: {
      strategy: "row",
      rowsTouched: 0,
      changedRows: 0,
      fieldsTouched: [],
      evaluations: 0,
      skippedByObjectIs: 0,
      dirtyRows: 0,
      dirtyNodes: [],
      nodes: [],
    },
    rowRecomputeDiagnostics: { rows: [] },
    ...overrides,
  }
}

describe("createClientRowComputedApplyRuntime", () => {
  it("refreshes all materialized source rows when computed fields change", () => {
    const refreshMaterializedSourceRows = vi.fn()
    const runtime = createClientRowComputedApplyRuntime<RowData>({
      executeComputedFields: () => createResult(),
      syncComputedSnapshotFields: () => true,
      applyComputedUpdates: () => false,
      refreshMaterializedSourceRows,
    })

    runtime.applyComputedFieldsToSourceRows()

    expect(refreshMaterializedSourceRows).toHaveBeenCalledWith()
  })

  it("refreshes changed rows when computed values change", () => {
    const refreshMaterializedSourceRows = vi.fn()
    const runtime = createClientRowComputedApplyRuntime<RowData>({
      executeComputedFields: () => createResult({
        changed: true,
        changedRowIds: ["r1"],
      }),
      syncComputedSnapshotFields: () => false,
      applyComputedUpdates: () => true,
      refreshMaterializedSourceRows,
    })

    runtime.applyComputedFieldsToSourceRows()

    expect(refreshMaterializedSourceRows).toHaveBeenCalledWith(["r1"])
  })

  it("falls back to update keys when execution changed without explicit row ids", () => {
    const refreshMaterializedSourceRows = vi.fn()
    const runtime = createClientRowComputedApplyRuntime<RowData>({
      executeComputedFields: () => createResult({
        changed: true,
        computedUpdatesByRowId: new Map<DataGridRowId, Partial<RowData>>([
          ["r2", { value: 2 }],
        ]),
      }),
      syncComputedSnapshotFields: () => false,
      applyComputedUpdates: () => false,
      refreshMaterializedSourceRows,
    })

    runtime.applyComputedFieldsToSourceRows()

    expect(refreshMaterializedSourceRows).toHaveBeenCalledWith(["r2"])
  })
})
