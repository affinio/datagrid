import type {
  DataGridPivotColumn,
  DataGridPivotSpec,
} from "./contracts.js"
import type {
  DataGridAggregationFieldReader,
  DataGridGroupExpansionSnapshot,
  DataGridRowNode,
} from "./coreTypes.js"

export interface DataGridPivotRuntimeOptions<T> {
  readRowField?: DataGridAggregationFieldReader<T>
}

export interface DataGridPivotProjectionResult<T> {
  rows: DataGridRowNode<T>[]
  columns: DataGridPivotColumn[]
}

export interface DataGridPivotProjectRowsInput<T> {
  inputRows: readonly DataGridRowNode<T>[]
  pivotModel: DataGridPivotSpec
  normalizeFieldValue: (value: unknown) => string
  expansionSnapshot?: DataGridGroupExpansionSnapshot | null
}

export interface DataGridPivotIncrementalPatchRow<T> {
  previousRow: DataGridRowNode<T>
  nextRow: DataGridRowNode<T>
}

export interface DataGridPivotApplyValuePatchInput<T> {
  projectedRows: readonly DataGridRowNode<T>[]
  pivotModel: DataGridPivotSpec
  changedRows: readonly DataGridPivotIncrementalPatchRow<T>[]
}

export interface DataGridPivotRuntime<T> {
  projectRows: (input: DataGridPivotProjectRowsInput<T>) => DataGridPivotProjectionResult<T>
  applyValueOnlyPatch: (input: DataGridPivotApplyValuePatchInput<T>) => DataGridPivotProjectionResult<T> | null
  normalizeColumns: (columns: readonly DataGridPivotColumn[]) => DataGridPivotColumn[]
}
