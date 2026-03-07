import type {
  DataGridFormulaExecutionPlanSnapshot,
  DataGridFormulaGraphSnapshot,
} from "./formulaExecutionPlan.js"

export type DataGridRowId = string | number

export type DataGridComputedDependencyToken =
  | `field:${string}`
  | `computed:${string}`
  | `meta:${string}`
  | (string & {})

export type DataGridFormulaMetaField =
  | "rowId"
  | "rowKey"
  | "sourceIndex"
  | "originalIndex"
  | "kind"
  | "isGroup"

export const DATAGRID_FORMULA_META_FIELDS = Object.freeze([
  "rowId",
  "rowKey",
  "sourceIndex",
  "originalIndex",
  "kind",
  "isGroup",
] as const) satisfies readonly DataGridFormulaMetaField[]

export function isDataGridFormulaMetaField(value: unknown): value is DataGridFormulaMetaField {
  return typeof value === "string"
    && (DATAGRID_FORMULA_META_FIELDS as readonly string[]).includes(value)
}

export interface DataGridComputedFieldComputeContext<T = unknown> {
  row: T
  rowId: DataGridRowId
  sourceIndex: number
  get: (token: DataGridComputedDependencyToken) => unknown
}

export interface DataGridComputedFieldDefinition<T = unknown> {
  name: string
  field?: string
  deps: readonly DataGridComputedDependencyToken[]
  compute: (context: DataGridComputedFieldComputeContext<T>) => unknown
}

export interface DataGridComputedFieldSnapshot {
  name: string
  field: string
  deps: readonly DataGridComputedDependencyToken[]
}

export interface DataGridFormulaFieldDefinition {
  name: string
  field?: string
  formula: string
}

export interface DataGridFormulaFieldSnapshot {
  name: string
  field: string
  formula: string
  deps: readonly DataGridComputedDependencyToken[]
  contextKeys: readonly string[]
}

export interface DataGridFormulaContextRecomputeRequest {
  contextKeys: readonly string[]
  rowIds?: readonly DataGridRowId[]
}

export type DataGridFormulaCyclePolicy = "error" | "iterative"

export interface DataGridFormulaIterativeCalculationOptions {
  maxIterations?: number
  epsilon?: number
}

export type DataGridFormulaRuntimeErrorCode =
  | "DIV_ZERO"
  | "FUNCTION_UNKNOWN"
  | "FUNCTION_ARITY"
  | "EVAL_ERROR"

export interface DataGridFormulaErrorValue {
  kind: "error"
  code: DataGridFormulaRuntimeErrorCode
  message: string
}

export type DataGridFormulaScalarValue =
  | number
  | string
  | boolean
  | Date
  | DataGridFormulaErrorValue
  | null

export type DataGridFormulaArrayValue = readonly DataGridFormulaScalarValue[]

export type DataGridFormulaValue =
  | DataGridFormulaScalarValue
  | DataGridFormulaArrayValue

export interface DataGridFormulaRuntimeError {
  code: DataGridFormulaRuntimeErrorCode
  message: string
  formulaName?: string
  field?: string
  formula?: string
  functionName?: string
  operator?: string
  rowId?: DataGridRowId
  sourceIndex?: number
}

export interface DataGridProjectionFormulaDiagnostics {
  recomputedFields: readonly string[]
  runtimeErrorCount: number
  runtimeErrors: readonly DataGridFormulaRuntimeError[]
  compileCache?: {
    hits: number
    misses: number
    size: number
  }
}

export interface DataGridFormulaDirtyCause {
  kind: "all" | "field" | "computed" | "context"
  value?: string
  rows: number
}

export interface DataGridFormulaDirtyRowCause {
  kind: "all" | "field" | "computed" | "context"
  value?: string
}

export interface DataGridFormulaRowNodeRecomputeDiagnostics {
  name: string
  field: string
  causes: readonly DataGridFormulaDirtyRowCause[]
}

export interface DataGridFormulaRowRecomputeDiagnosticsEntry {
  rowId: DataGridRowId
  sourceIndex: number
  nodes: readonly DataGridFormulaRowNodeRecomputeDiagnostics[]
}

export interface DataGridFormulaRowRecomputeDiagnostics {
  rows: readonly DataGridFormulaRowRecomputeDiagnosticsEntry[]
}

export interface DataGridFormulaNodeComputeDiagnostics {
  name: string
  field: string
  dirty: boolean
  touched: boolean
  runtimeMode?: "row" | "batch" | "columnar-ast" | "columnar-jit" | "columnar-fused" | "columnar-vector"
  evaluations: number
  dirtyRows: number
  dirtyCauses: readonly DataGridFormulaDirtyCause[]
  iterative?: boolean
  converged?: boolean
  iterationCount?: number
  cycleGroup?: readonly string[]
}

export interface DataGridFormulaComputeStageDiagnostics {
  strategy?: "row" | "column-cache"
  rowsTouched: number
  changedRows: number
  fieldsTouched: readonly string[]
  evaluations: number
  skippedByObjectIs: number
  dirtyRows: number
  dirtyNodes: readonly string[]
  nodes?: readonly DataGridFormulaNodeComputeDiagnostics[]
}

export interface DataGridFormulaRuntimeIntegration<T = unknown> {
  registerComputedField?(definition: DataGridComputedFieldDefinition<T>): void
  getComputedFields?(): readonly DataGridComputedFieldSnapshot[]
  recomputeComputedFields?(rowIds?: readonly DataGridRowId[]): number
  registerFormulaField?(definition: DataGridFormulaFieldDefinition): void
  getFormulaFields?(): readonly DataGridFormulaFieldSnapshot[]
  recomputeFormulaContext?(request: DataGridFormulaContextRecomputeRequest): number
  registerFormulaFunction?(
    name: string,
    definition:
      | {
        arity?: number | { min: number; max?: number }
        compute: (args: readonly DataGridFormulaValue[]) => unknown
      }
      | ((args: readonly DataGridFormulaValue[]) => unknown),
  ): void
  unregisterFormulaFunction?(name: string): boolean
  getFormulaFunctionNames?(): readonly string[]
  getFormulaExecutionPlan?(): DataGridFormulaExecutionPlanSnapshot | null
  getFormulaGraph?(): DataGridFormulaGraphSnapshot | null
  getFormulaComputeStageDiagnostics?(): DataGridFormulaComputeStageDiagnostics | null
  getFormulaRowRecomputeDiagnostics?(): DataGridFormulaRowRecomputeDiagnostics | null
}
