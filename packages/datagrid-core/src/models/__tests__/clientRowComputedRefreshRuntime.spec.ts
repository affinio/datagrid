import { describe, expect, it, vi } from "vitest"
import { createClientRowComputedRefreshRuntime } from "../compute/clientRowComputedRefreshRuntime.js"
import type { ApplyComputedFieldsToSourceRowsResult } from "../compute/clientRowComputedExecutionRuntime.js"
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

describe("createClientRowComputedRefreshRuntime", () => {
  it("commits diagnostics without invalidating projection when values do not change", () => {
    const markComputedProjectionInvalidated = vi.fn()
    const emit = vi.fn()
    const runtime = createClientRowComputedRefreshRuntime<RowData>({
      applyComputedFieldsToSourceRows: () => createResult(),
      commitFormulaDiagnostics: vi.fn(),
      commitFormulaComputeStageDiagnostics: vi.fn(),
      commitFormulaRowRecomputeDiagnostics: vi.fn(),
      bumpRowVersions: vi.fn(),
      bumpRowRevision: vi.fn(),
      resetGroupByIncrementalAggregationState: vi.fn(),
      invalidateTreeProjectionCaches: vi.fn(),
      markComputedProjectionInvalidated,
      tryApplyFlatIdentityProjectionRefresh: () => true,
      recomputeFromComputeStage: vi.fn(),
      emit,
    })

    expect(runtime.recomputeComputedFieldsAndRefresh()).toBe(0)
    expect(markComputedProjectionInvalidated).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it("invalidates projection and emits when computed values change", () => {
    const recomputeFromComputeStage = vi.fn()
    const emit = vi.fn()
    const runtime = createClientRowComputedRefreshRuntime<RowData>({
      applyComputedFieldsToSourceRows: () => createResult({
        changed: true,
        changedRowIds: ["r1", "r2"],
      }),
      commitFormulaDiagnostics: vi.fn(),
      commitFormulaComputeStageDiagnostics: vi.fn(),
      commitFormulaRowRecomputeDiagnostics: vi.fn(),
      bumpRowVersions: vi.fn(),
      bumpRowRevision: vi.fn(),
      resetGroupByIncrementalAggregationState: vi.fn(),
      invalidateTreeProjectionCaches: vi.fn(),
      markComputedProjectionInvalidated: vi.fn(),
      tryApplyFlatIdentityProjectionRefresh: () => false,
      recomputeFromComputeStage,
      emit,
    })

    expect(runtime.recomputeComputedFieldsAndRefresh()).toBe(2)
    expect(recomputeFromComputeStage).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledTimes(1)
  })
})
