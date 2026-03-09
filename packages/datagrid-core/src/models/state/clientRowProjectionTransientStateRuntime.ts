import { createEmptyTreeDataDiagnostics } from "../clientRowModelHelpers.js"
import {
  createGroupByIncrementalAggregationState,
  resetGroupByIncrementalAggregationState as resetGroupByIncrementalAggregationStateRuntime,
  type GroupByIncrementalAggregationState,
} from "../aggregation/incrementalAggregationRuntime.js"
import type { DataGridRowId, DataGridTreeDataDiagnostics } from "../rowModel.js"

export interface CreateClientRowProjectionTransientStateRuntimeOptions {
  treeDataEnabled: boolean
}

export interface ClientRowProjectionTransientStateRuntime {
  getGroupByIncrementalAggregationState(): GroupByIncrementalAggregationState
  resetGroupByIncrementalAggregationState(): void
  getGroupedProjectionGroupIndexByRowId(): ReadonlyMap<DataGridRowId, number>
  setGroupedProjectionGroupIndexByRowId(index: ReadonlyMap<DataGridRowId, number>): void
  resetGroupedProjectionGroupIndexByRowId(): void
  getTreeDataDiagnostics(): DataGridTreeDataDiagnostics | null
  setTreeDataDiagnostics(diagnostics: DataGridTreeDataDiagnostics | null): void
  resetTreeDataDiagnostics(): void
  updateTreeDataDuplicateDiagnostics(duplicates: number, message: string): void
  cloneTreeDataDiagnostics(input: DataGridTreeDataDiagnostics | null): DataGridTreeDataDiagnostics | null
}

export function createClientRowProjectionTransientStateRuntime(
  options: CreateClientRowProjectionTransientStateRuntimeOptions,
): ClientRowProjectionTransientStateRuntime {
  const groupByIncrementalAggregationState = createGroupByIncrementalAggregationState()
  let groupedProjectionGroupIndexByRowId: ReadonlyMap<DataGridRowId, number> = new Map<DataGridRowId, number>()
  let treeDataDiagnostics: DataGridTreeDataDiagnostics | null = options.treeDataEnabled
    ? createEmptyTreeDataDiagnostics()
    : null

  const resetTreeDataDiagnostics = (): void => {
    treeDataDiagnostics = options.treeDataEnabled ? createEmptyTreeDataDiagnostics() : null
  }

  return {
    getGroupByIncrementalAggregationState() {
      return groupByIncrementalAggregationState
    },
    resetGroupByIncrementalAggregationState() {
      resetGroupByIncrementalAggregationStateRuntime(groupByIncrementalAggregationState)
    },
    getGroupedProjectionGroupIndexByRowId() {
      return groupedProjectionGroupIndexByRowId
    },
    setGroupedProjectionGroupIndexByRowId(index) {
      groupedProjectionGroupIndexByRowId = index
    },
    resetGroupedProjectionGroupIndexByRowId() {
      groupedProjectionGroupIndexByRowId = new Map<DataGridRowId, number>()
    },
    getTreeDataDiagnostics() {
      return treeDataDiagnostics
    },
    setTreeDataDiagnostics(diagnostics) {
      treeDataDiagnostics = diagnostics
    },
    resetTreeDataDiagnostics,
    updateTreeDataDuplicateDiagnostics(duplicates, message) {
      treeDataDiagnostics = createEmptyTreeDataDiagnostics({
        duplicates,
        lastError: message,
        orphans: treeDataDiagnostics?.orphans ?? 0,
        cycles: treeDataDiagnostics?.cycles ?? 0,
      })
    },
    cloneTreeDataDiagnostics(input) {
      return input ? createEmptyTreeDataDiagnostics(input) : null
    },
  }
}
