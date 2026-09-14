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
  /** Maximum dense output cells (projected rows × value columns). Infinity by default. */
  maxOutputCells?: number
  /** Omits absent aggregate fields from row payloads; dense output remains the default. */
  sparseOutput?: boolean
}

export interface DataGridPivotProjectionDiagnostics {
  kind: "output-limit-exceeded"
  estimatedCells: number
  maxOutputCells: number
}

export type DataGridPivotCellState<T> =
  | { kind: "missing" }
  | { kind: "null" }
  | { kind: "value"; value: T }

export interface DataGridPivotCellAddress {
  rowKey: string
  columnKey: string
  valueField: string
}

export interface DataGridPivotProjectionResult<T> {
  rows: DataGridRowNode<T>[]
  columns: DataGridPivotColumn[]
  diagnostics?: DataGridPivotProjectionDiagnostics
}

export interface DataGridPivotMaterializeOptions {
  mode?: "sparse" | "dense"
  maxCells?: number
}

export interface DataGridPivotMaterializeResult<T> {
  rows: DataGridRowNode<T>[]
  columns: DataGridPivotColumn[]
  diagnostics?: DataGridPivotProjectionDiagnostics
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
  readCell: (address: DataGridPivotCellAddress) => DataGridPivotCellState<unknown>
  materializeRows: (options?: DataGridPivotMaterializeOptions) => DataGridPivotMaterializeResult<T>
  normalizeColumns: (columns: readonly DataGridPivotColumn[]) => DataGridPivotColumn[]
}
