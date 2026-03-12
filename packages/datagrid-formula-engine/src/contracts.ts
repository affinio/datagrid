import type {
  DataGridFormulaExecutionPlanSnapshot,
  DataGridFormulaGraphSnapshot,
} from "./graph/index.js"

export type DataGridRowId = string | number

export type DataGridComputedDependencyToken =
  | `field:${string}`
  | `computed:${string}`
  | `meta:${string}`
  | (string & {})

export type DataGridFormulaReferenceDomain = "field" | "computed" | "meta"

export type DataGridFormulaReferenceRowDomain =
  | { kind: "current" }
  | { kind: "absolute"; rowIndex: number }
  | { kind: "absolute-window"; startRowIndex: number; endRowIndex: number }
  | { kind: "relative"; offset: number }
  | { kind: "window"; startOffset: number; endOffset: number }

export interface DataGridFormulaReferenceDescriptor {
  domain: DataGridFormulaReferenceDomain
  name: string
  rowDomain: DataGridFormulaReferenceRowDomain
}

const DATAGRID_FORMULA_ROW_TOKEN_SEPARATOR = "::row::"

function normalizeDataGridFormulaReferenceName(value: string): string {
  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new Error("[DataGridFormula] Reference name must be non-empty.")
  }
  return normalized
}

function normalizeDataGridFormulaReferenceRowDomain(
  rowDomain: DataGridFormulaReferenceRowDomain | undefined,
): DataGridFormulaReferenceRowDomain {
  if (!rowDomain || rowDomain.kind === "current") {
    return { kind: "current" }
  }
  if (rowDomain.kind === "absolute") {
    return { kind: "absolute", rowIndex: Math.trunc(rowDomain.rowIndex) }
  }
  if (rowDomain.kind === "absolute-window") {
    return {
      kind: "absolute-window",
      startRowIndex: Math.trunc(rowDomain.startRowIndex),
      endRowIndex: Math.trunc(rowDomain.endRowIndex),
    }
  }
  if (rowDomain.kind === "relative") {
    return { kind: "relative", offset: Math.trunc(rowDomain.offset) }
  }
  return {
    kind: "window",
    startOffset: Math.trunc(rowDomain.startOffset),
    endOffset: Math.trunc(rowDomain.endOffset),
  }
}

function serializeDataGridFormulaReferenceRowDomain(
  rowDomain: DataGridFormulaReferenceRowDomain,
): string | null {
  if (rowDomain.kind === "current") {
    return null
  }
  if (rowDomain.kind === "absolute") {
    return `absolute:${rowDomain.rowIndex}`
  }
  if (rowDomain.kind === "absolute-window") {
    return `absolute-window:${rowDomain.startRowIndex}:${rowDomain.endRowIndex}`
  }
  if (rowDomain.kind === "relative") {
    return `relative:${rowDomain.offset}`
  }
  return `window:${rowDomain.startOffset}:${rowDomain.endOffset}`
}

function parseDataGridFormulaReferenceRowDomain(
  value: string,
): DataGridFormulaReferenceRowDomain | null {
  const normalized = value.trim()
  if (normalized.startsWith("absolute:")) {
    const rowIndex = Number(normalized.slice("absolute:".length))
    if (Number.isInteger(rowIndex)) {
      return { kind: "absolute", rowIndex }
    }
    return null
  }
  if (normalized.startsWith("relative:")) {
    const offset = Number(normalized.slice("relative:".length))
    if (Number.isInteger(offset)) {
      return { kind: "relative", offset }
    }
    return null
  }
  if (normalized.startsWith("absolute-window:")) {
    const payload = normalized.slice("absolute-window:".length)
    const separatorIndex = payload.indexOf(":")
    if (separatorIndex <= 0) {
      return null
    }
    const startRowIndex = Number(payload.slice(0, separatorIndex))
    const endRowIndex = Number(payload.slice(separatorIndex + 1))
    if (Number.isInteger(startRowIndex) && Number.isInteger(endRowIndex)) {
      return { kind: "absolute-window", startRowIndex, endRowIndex }
    }
    return null
  }
  if (normalized.startsWith("window:")) {
    const payload = normalized.slice("window:".length)
    const separatorIndex = payload.indexOf(":")
    if (separatorIndex <= 0) {
      return null
    }
    const startOffset = Number(payload.slice(0, separatorIndex))
    const endOffset = Number(payload.slice(separatorIndex + 1))
    if (Number.isInteger(startOffset) && Number.isInteger(endOffset)) {
      return { kind: "window", startOffset, endOffset }
    }
    return null
  }
  return null
}

export function serializeDataGridComputedDependencyToken(
  reference: DataGridFormulaReferenceDescriptor,
): DataGridComputedDependencyToken {
  const name = normalizeDataGridFormulaReferenceName(reference.name)
  const rowDomain = normalizeDataGridFormulaReferenceRowDomain(reference.rowDomain)
  const serializedRowDomain = serializeDataGridFormulaReferenceRowDomain(rowDomain)
  if (!serializedRowDomain) {
    return `${reference.domain}:${name}`
  }
  return `${reference.domain}:${name}${DATAGRID_FORMULA_ROW_TOKEN_SEPARATOR}${serializedRowDomain}`
}

export function parseDataGridComputedDependencyToken(
  token: DataGridComputedDependencyToken,
): DataGridFormulaReferenceDescriptor | null {
  if (typeof token !== "string") {
    return null
  }
  const normalized = token.trim()
  const separatorIndex = normalized.indexOf(":")
  if (separatorIndex <= 0) {
    return null
  }
  const domain = normalized.slice(0, separatorIndex).trim()
  if (domain !== "field" && domain !== "computed" && domain !== "meta") {
    return null
  }
  const payload = normalized.slice(separatorIndex + 1)
  const rowSeparatorIndex = payload.indexOf(DATAGRID_FORMULA_ROW_TOKEN_SEPARATOR)
  if (rowSeparatorIndex < 0) {
    return {
      domain,
      name: normalizeDataGridFormulaReferenceName(payload),
      rowDomain: { kind: "current" },
    }
  }
  const name = normalizeDataGridFormulaReferenceName(payload.slice(0, rowSeparatorIndex))
  const rowDomain = parseDataGridFormulaReferenceRowDomain(
    payload.slice(rowSeparatorIndex + DATAGRID_FORMULA_ROW_TOKEN_SEPARATOR.length),
  )
  if (!rowDomain) {
    return null
  }
  return { domain, name, rowDomain }
}

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
  getContextValue?: (key: string) => unknown
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

export interface DataGridFormulaTableRowsSource<Row = unknown> {
  rows: readonly Row[]
  resolveRow?: (row: Row, index: number) => unknown
}

export type DataGridFormulaTableSource =
  | readonly unknown[]
  | DataGridFormulaTableRowsSource

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
  setFormulaTable?(name: string, rows: readonly unknown[]): void
  removeFormulaTable?(name: string): boolean
  getFormulaTableNames?(): readonly string[]
  registerFormulaFunction?(
    name: string,
    definition:
      | {
        arity?: number | { min: number; max?: number }
        compute: (args: readonly DataGridFormulaValue[], context?: DataGridComputedFieldComputeContext<T>) => unknown
      }
      | ((args: readonly DataGridFormulaValue[], context?: DataGridComputedFieldComputeContext<T>) => unknown),
  ): void
  unregisterFormulaFunction?(name: string): boolean
  getFormulaFunctionNames?(): readonly string[]
  getFormulaExecutionPlan?(): DataGridFormulaExecutionPlanSnapshot | null
  getFormulaGraph?(): DataGridFormulaGraphSnapshot | null
  getFormulaComputeStageDiagnostics?(): DataGridFormulaComputeStageDiagnostics | null
  getFormulaRowRecomputeDiagnostics?(): DataGridFormulaRowRecomputeDiagnostics | null
}
