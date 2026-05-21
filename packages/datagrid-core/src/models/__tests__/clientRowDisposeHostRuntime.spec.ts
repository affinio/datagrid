import { describe, expect, it, vi } from "vitest"
import {
  clearClientRowProjectionArrays,
  createClientRowDisposeHostRuntime,
} from "../host/clientRowDisposeHostRuntime.js"
import type {
  DataGridFormulaComputeStageDiagnostics,
  DataGridRowNode,
} from "../rowModel.js"

interface RowData {
  id: string
}

function createRow(id: string): DataGridRowNode<RowData> {
  return {
    kind: "leaf",
    data: { id },
    row: { id },
    rowKey: id,
    rowId: id,
    originalIndex: 0,
    sourceIndex: 0,
    displayIndex: 0,
    state: { selected: false, group: false, pinned: "none", expanded: false },
  }
}

function createEmptyComputeDiagnostics(): DataGridFormulaComputeStageDiagnostics {
  return {
    strategy: "row",
    rowsTouched: 0,
    changedRows: 0,
    fieldsTouched: [],
    evaluations: 0,
    skippedByObjectIs: 0,
    dirtyRows: 0,
    dirtyNodes: [],
    nodes: [],
  }
}

function createRuntimeState(row = createRow("r1")) {
  return {
    rows: [row],
    filteredRowsProjection: [row],
    sortedRowsProjection: [row],
    groupedRowsProjection: [row],
    pivotedRowsProjection: [row],
    aggregatedRowsProjection: [row],
    paginatedRowsProjection: [row],
  }
}

function createDisposeOptions(disposeLifecycle: () => boolean) {
  const computedRegistryRef: { current: unknown } = { current: {} }
  return {
    lifecycle: { dispose: disposeLifecycle },
    formulaHostRuntime: { dispose: vi.fn() },
    computeHostRuntime: { dispose: vi.fn() },
    clearSourceRowsState: vi.fn(),
    clearSourceColumnValuesCache: vi.fn(),
    runtimeState: createRuntimeState() as never,
    materializationRuntime: { clearMaterializedSourceRowsCache: vi.fn() },
    resetPivotColumns: vi.fn(),
    rowVersionRuntime: { clear: vi.fn() },
    projectionIntegrationHostRuntime: {
      resetGroupByIncrementalAggregationState: vi.fn(),
      invalidateTreeProjectionCaches: vi.fn(),
    },
    projectionTransientStateRuntime: {
      resetGroupedProjectionGroupIndexByRowId: vi.fn(),
    },
    treePivotIntegrationRuntime: { resetPivotExpansionState: vi.fn() },
    expansionHostRuntime: { resetExpansionState: vi.fn() },
    derivedCacheRuntime: {
      clearSortValueCache: vi.fn(),
      clearGroupValueCache: vi.fn(),
      clearFilterPredicateCache: vi.fn(),
    },
    computedRegistry: { clear: vi.fn() },
    computedRegistryRef,
    formulaDiagnosticsRuntime: {
      createEmptyFormulaComputeStageDiagnostics: createEmptyComputeDiagnostics,
      commitFormulaComputeStageDiagnostics: vi.fn(),
      commitFormulaRowRecomputeDiagnostics: vi.fn(),
    },
    runtimeStateStore: { setProjectionFormulaDiagnostics: vi.fn() },
  }
}

describe("createClientRowDisposeHostRuntime", () => {
  it("skips cleanup when lifecycle is already disposed", () => {
    const options = createDisposeOptions(() => false)
    const runtime = createClientRowDisposeHostRuntime<RowData>(options)

    runtime.dispose()

    expect(options.formulaHostRuntime.dispose).not.toHaveBeenCalled()
  })

  it("runs cleanup callbacks after lifecycle dispose succeeds", () => {
    const options = createDisposeOptions(() => true)
    const runtime = createClientRowDisposeHostRuntime<RowData>(options)

    runtime.dispose()

    expect(options.computedRegistryRef.current).toBeNull()
    expect(options.formulaDiagnosticsRuntime.commitFormulaRowRecomputeDiagnostics)
      .toHaveBeenCalledWith({ rows: [] })
  })

  it("clears all row projection arrays", () => {
    const row = createRow("r1")
    const runtimeState = {
      rows: [row],
      filteredRowsProjection: [row],
      sortedRowsProjection: [row],
      groupedRowsProjection: [row],
      pivotedRowsProjection: [row],
      aggregatedRowsProjection: [row],
      paginatedRowsProjection: [row],
    }

    clearClientRowProjectionArrays(runtimeState)

    expect(runtimeState.rows).toEqual([])
    expect(runtimeState.filteredRowsProjection).toEqual([])
    expect(runtimeState.sortedRowsProjection).toEqual([])
    expect(runtimeState.groupedRowsProjection).toEqual([])
    expect(runtimeState.pivotedRowsProjection).toEqual([])
    expect(runtimeState.aggregatedRowsProjection).toEqual([])
    expect(runtimeState.paginatedRowsProjection).toEqual([])
  })
})
