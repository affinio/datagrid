import type { DataGridRowId } from "../models/rowModel.js"
import {
  bindCompiledFormulaArtifactToFieldDefinition,
  compileDataGridFormulaFieldArtifact,
  createFormulaErrorValue,
  isFormulaErrorValue,
  parseDataGridFormulaIdentifier,
  type DataGridCompiledFormulaArtifact,
  type DataGridCompiledFormulaField,
  type DataGridFormulaFunctionRegistry,
  type DataGridFormulaReferenceParserOptions,
  type DataGridFormulaRuntimeErrorPolicy,
} from "../models/formula/formulaEngine.js"
import type {
  DataGridComputedFieldComputeContext,
  DataGridFormulaErrorValue,
  DataGridFormulaTableSource,
  DataGridFormulaValue,
} from "../models/formula/formulaContracts.js"
import {
  analyzeDataGridSpreadsheetCellInput,
  createDataGridSpreadsheetCellFormulaModel,
  createDataGridSpreadsheetCellFormulaRuntimeModel,
  mapDataGridSpreadsheetCellFormulaRuntimeModelBindings,
  renderDataGridSpreadsheetCellFormulaRuntimeModel,
  type DataGridSpreadsheetCellAddress,
  type DataGridSpreadsheetCellFormulaModel,
  type DataGridSpreadsheetCellFormulaRuntimeModel,
  type DataGridSpreadsheetCellInputAnalysis,
  type DataGridSpreadsheetCellInputKind,
  type DataGridSpreadsheetFormulaReferenceSpan,
} from "./formulaEditorModel.js"
import { isTypedPlainSpreadsheetSheetState } from "./sheetStateGuards.js"

export type DataGridSpreadsheetStyle = Readonly<Record<string, unknown>>

export interface DataGridSpreadsheetColumnInput {
  key: string
  title?: string | null
  style?: DataGridSpreadsheetStyle | null
}

export interface DataGridSpreadsheetColumnSnapshot {
  key: string
  title: string
  style: DataGridSpreadsheetStyle | null
}

export interface DataGridSpreadsheetRowInput {
  id?: DataGridRowId
  cells?: Readonly<Record<string, unknown>> | null
  style?: DataGridSpreadsheetStyle | null
}

export interface DataGridSpreadsheetRowSnapshot {
  id: DataGridRowId
  rowIndex: number
  style: DataGridSpreadsheetStyle | null
}

export interface DataGridSpreadsheetCellInputPatch {
  cell: DataGridSpreadsheetCellAddress
  rawInput: unknown
}

export interface DataGridSpreadsheetCellStylePatch {
  cell: DataGridSpreadsheetCellAddress
  style: DataGridSpreadsheetStyle | null
}

export interface DataGridSpreadsheetFormulaTableBinding {
  name: string
  source: DataGridFormulaTableSource
}

export interface DataGridSpreadsheetFormulaTablePatch {
  set?: readonly DataGridSpreadsheetFormulaTableBinding[]
  remove?: readonly string[]
}

export interface DataGridSpreadsheetFormulaCellSnapshot {
  address: DataGridSpreadsheetCellAddress
  formula: string
  contextKeys: readonly string[]
  dependencies: readonly DataGridSpreadsheetCellAddress[]
}

export interface DataGridSpreadsheetFormulaStructuralCellSnapshot extends DataGridSpreadsheetFormulaCellSnapshot {
  formulaModel: DataGridSpreadsheetCellFormulaModel
  formulaRuntime: DataGridSpreadsheetCellFormulaRuntimeModel
}

export interface DataGridSpreadsheetSheetStateCell {
  columnKey: string
  rawInput: string
  resolvedValue?: unknown
  style: DataGridSpreadsheetStyle | null
}

export interface DataGridSpreadsheetSheetStateRow {
  id: DataGridRowId
  style: DataGridSpreadsheetStyle | null
  cells: readonly DataGridSpreadsheetSheetStateCell[]
}

export interface DataGridSpreadsheetSheetState {
  sheetId: string | null
  sheetName: string | null
  columns: readonly DataGridSpreadsheetColumnSnapshot[]
  rows: readonly DataGridSpreadsheetSheetStateRow[]
  sheetStyle: DataGridSpreadsheetStyle | null
  formulaTables: readonly DataGridSpreadsheetFormulaTableBinding[]
  functionRegistry?: DataGridFormulaFunctionRegistry
  referenceParserOptions?: DataGridFormulaReferenceParserOptions
  runtimeErrorPolicy: DataGridFormulaRuntimeErrorPolicy
  resolveContextValue?: (key: string) => unknown
}

export interface DataGridSpreadsheetCellSnapshot {
  address: DataGridSpreadsheetCellAddress
  rawInput: string
  inputKind: DataGridSpreadsheetCellInputKind
  formula: string | null
  displayValue: unknown
  errorValue: DataGridFormulaErrorValue | null
  analysis: DataGridSpreadsheetCellInputAnalysis
  dependencies: readonly DataGridSpreadsheetCellAddress[]
  ownStyle: DataGridSpreadsheetStyle | null
  style: DataGridSpreadsheetStyle | null
}

export interface DataGridSpreadsheetFormulaStructuralPatch {
  cell: DataGridSpreadsheetCellAddress
  formulaModel: DataGridSpreadsheetCellFormulaModel
  formulaRuntime: DataGridSpreadsheetCellFormulaRuntimeModel
}

export type DataGridSpreadsheetSheetRowMutationKind = "insert" | "remove"

export interface DataGridSpreadsheetSheetRowMutation {
  revision: number
  kind: DataGridSpreadsheetSheetRowMutationKind
  index: number
  count: number
}

export interface DataGridSpreadsheetSheetSnapshot {
  revision: number
  valueRevision: number
  formulaStructureRevision: number
  styleRevision: number
  rowCount: number
  columnCount: number
  formulaCellCount: number
  errorCellCount: number
  sheetId: string | null
  sheetName: string | null
  lastRowMutation: DataGridSpreadsheetSheetRowMutation | null
}

export type DataGridSpreadsheetSheetListener = (
  snapshot: DataGridSpreadsheetSheetSnapshot,
) => void

export interface CreateDataGridSpreadsheetSheetModelOptions {
  sheetId?: string | null
  sheetName?: string | null
  columns: readonly DataGridSpreadsheetColumnInput[]
  rows?: readonly DataGridSpreadsheetRowInput[]
  sheetStyle?: DataGridSpreadsheetStyle | null
  formulaTables?: readonly DataGridSpreadsheetFormulaTableBinding[]
  functionRegistry?: DataGridFormulaFunctionRegistry
  referenceParserOptions?: DataGridFormulaReferenceParserOptions
  runtimeErrorPolicy?: DataGridFormulaRuntimeErrorPolicy
  rawInputRetention?: "all" | "formula-only"
  resolveContextValue?: (key: string) => unknown
  resolveSheetReference?: (
    sheetReference: string,
    currentSheetId: string | null,
  ) => DataGridSpreadsheetSheetModel | null | undefined
}

export interface DataGridSpreadsheetSheetModel {
  getSnapshot(): DataGridSpreadsheetSheetSnapshot
  getSheetId(): string | null
  getSheetName(): string | null
  getColumns(): readonly DataGridSpreadsheetColumnSnapshot[]
  getRowCount(): number
  getRows(): readonly DataGridSpreadsheetRowSnapshot[]
  exportState(): DataGridSpreadsheetSheetState
  restoreState(state: DataGridSpreadsheetSheetState): boolean
  getCell(cell: DataGridSpreadsheetCellAddress): DataGridSpreadsheetCellSnapshot | null
  getCellById(rowId: DataGridRowId, columnKey: string): DataGridSpreadsheetCellSnapshot | null
  getCellDisplayValue(cell: DataGridSpreadsheetCellAddress): unknown
  getFormulaCells(): readonly DataGridSpreadsheetFormulaCellSnapshot[]
  getFormulaStructuralCells(): readonly DataGridSpreadsheetFormulaStructuralCellSnapshot[]
  getFormulaStructuralCellsBySheetAliases(sheetAliases: readonly string[]): readonly DataGridSpreadsheetFormulaStructuralCellSnapshot[]
  getTableSource(): DataGridFormulaTableSource
  getTableSourceRevision(): number
  recompute(): boolean
  setCellInput(cell: DataGridSpreadsheetCellAddress, rawInput: unknown): boolean
  setCellInputs(patches: readonly DataGridSpreadsheetCellInputPatch[]): boolean
  applyFormulaStructuralPatches(patches: readonly DataGridSpreadsheetFormulaStructuralPatch[]): boolean
  clearCell(cell: DataGridSpreadsheetCellAddress): boolean
  insertRowsAt(index: number, rows?: readonly DataGridSpreadsheetRowInput[]): boolean
  removeRowsAt(index: number, count?: number): boolean
  insertRowsBefore(rowId: DataGridRowId, rows?: readonly DataGridSpreadsheetRowInput[]): boolean
  insertRowsAfter(rowId: DataGridRowId, rows?: readonly DataGridSpreadsheetRowInput[]): boolean
  setSheetStyle(style: DataGridSpreadsheetStyle | null): boolean
  setColumnStyle(columnKey: string, style: DataGridSpreadsheetStyle | null): boolean
  setRowStyle(rowId: DataGridRowId, style: DataGridSpreadsheetStyle | null): boolean
  setCellStyle(cell: DataGridSpreadsheetCellAddress, style: DataGridSpreadsheetStyle | null): boolean
  setCellStyles(patches: readonly DataGridSpreadsheetCellStylePatch[]): boolean
  copyCellStyle(
    source: DataGridSpreadsheetCellAddress,
    targets: readonly DataGridSpreadsheetCellAddress[],
  ): boolean
  setFormulaTable(name: string, source: DataGridFormulaTableSource): boolean
  patchFormulaTables(patch: DataGridSpreadsheetFormulaTablePatch): boolean
  subscribe(listener: DataGridSpreadsheetSheetListener): () => void
  dispose(): void
}

interface SpreadsheetColumnState {
  key: string
  title: string
  style: DataGridSpreadsheetStyle | null
}

interface SpreadsheetRowState {
  id: DataGridRowId
  rowIndex: number
  style: DataGridSpreadsheetStyle | null
  resolvedValues: unknown[]
}

interface SpreadsheetFormulaCellState {
  key: string
  address: DataGridSpreadsheetCellAddress
  analysis: DataGridSpreadsheetCellInputAnalysis
  formulaModel: DataGridSpreadsheetCellFormulaModel
  formulaRuntime: DataGridSpreadsheetCellFormulaRuntimeModel
  compiled: DataGridCompiledFormulaField<Record<string, unknown>> | null
  dependencies: readonly DataGridSpreadsheetCellAddress[]
  dependencyKeys: readonly string[]
  contextKeys: readonly string[]
}

interface SpreadsheetFormulaStateMaps {
  analysisByCellKey: Map<string, DataGridSpreadsheetCellInputAnalysis>
  formulaCellByKey: Map<string, SpreadsheetFormulaCellState>
  dependentsByCellKey: Map<string, Set<string>>
}

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly []
const EMPTY_DEPENDENCIES = Object.freeze([]) as readonly DataGridSpreadsheetCellAddress[]
const COMPILED_FORMULA_REFERENCE_TOKEN_PREFIX = "__spreadsheet_ref_"

function normalizeSheetIdentity(value: unknown): string | null {
  const normalized = String(value ?? "").trim()
  return normalized.length === 0 ? null : normalized
}

function createCompiledFormulaReferenceToken(index: number): string {
  return `${COMPILED_FORMULA_REFERENCE_TOKEN_PREFIX}${index}`
}

function resolveCompiledFormulaReferenceTokenIndex(token: string): number | null {
  if (!token.startsWith(COMPILED_FORMULA_REFERENCE_TOKEN_PREFIX)) {
    return null
  }
  const suffix = token.slice(COMPILED_FORMULA_REFERENCE_TOKEN_PREFIX.length)
  const index = Number.parseInt(suffix, 10)
  return Number.isInteger(index) && index >= 0 ? index : null
}

function normalizeColumnKey(value: unknown): string {
  const normalized = String(value ?? "").trim()
  if (normalized.length === 0) {
    throw new Error("[DataGridSpreadsheetSheet] column key must be non-empty.")
  }
  return normalized
}

function normalizeColumnTitle(value: unknown, fallback: string): string {
  const normalized = String(value ?? "").trim()
  return normalized.length === 0 ? fallback : normalized
}

function normalizeSpreadsheetStyle(
  style: DataGridSpreadsheetStyle | null | undefined,
): DataGridSpreadsheetStyle | null {
  if (style == null) {
    return null
  }
  if (typeof style !== "object" || Array.isArray(style)) {
    throw new Error("[DataGridSpreadsheetSheet] style must be an object or null.")
  }
  const normalizedEntries = Object.entries(style)
    .filter(([key]) => String(key).length > 0)
    .map(([key, value]) => [String(key), value] as const)
  if (normalizedEntries.length === 0) {
    return null
  }
  return Object.freeze(Object.fromEntries(normalizedEntries))
}

function areSpreadsheetStylesEqual(
  left: DataGridSpreadsheetStyle | null,
  right: DataGridSpreadsheetStyle | null,
): boolean {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) {
      return false
    }
    if (!Object.is(left[key], right[key])) {
      return false
    }
  }
  return true
}

function areSpreadsheetColumnSnapshotsEqual(
  left: readonly DataGridSpreadsheetColumnSnapshot[],
  right: readonly DataGridSpreadsheetColumnSnapshot[],
): boolean {
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    const leftColumn = left[index]
    const rightColumn = right[index]
    if (
      !leftColumn
      || !rightColumn
      || leftColumn.key !== rightColumn.key
      || leftColumn.title !== rightColumn.title
      || !areSpreadsheetStylesEqual(leftColumn.style, rightColumn.style)
    ) {
      return false
    }
  }
  return true
}

function areSpreadsheetFormulaTableBindingsEqual(
  left: readonly DataGridSpreadsheetFormulaTableBinding[],
  right: readonly DataGridSpreadsheetFormulaTableBinding[],
): boolean {
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    const leftBinding = left[index]
    const rightBinding = right[index]
    if (
      !leftBinding
      || !rightBinding
      || leftBinding.name !== rightBinding.name
      || leftBinding.source !== rightBinding.source
    ) {
      return false
    }
  }
  return true
}

function areSpreadsheetSheetStateRowsEqual(
  left: readonly DataGridSpreadsheetSheetStateRow[],
  right: readonly DataGridSpreadsheetSheetStateRow[],
): boolean {
  if (left.length !== right.length) {
    return false
  }
  for (let rowIndex = 0; rowIndex < left.length; rowIndex += 1) {
    const leftRow = left[rowIndex]
    const rightRow = right[rowIndex]
    if (
      !leftRow
      || !rightRow
      || leftRow.id !== rightRow.id
      || !areSpreadsheetStylesEqual(leftRow.style, rightRow.style)
      || leftRow.cells.length !== rightRow.cells.length
    ) {
      return false
    }
    for (let cellIndex = 0; cellIndex < leftRow.cells.length; cellIndex += 1) {
      const leftCell = leftRow.cells[cellIndex]
      const rightCell = rightRow.cells[cellIndex]
      if (
        !leftCell
        || !rightCell
        || leftCell.columnKey !== rightCell.columnKey
        || leftCell.rawInput !== rightCell.rawInput
        || !areSpreadsheetStylesEqual(leftCell.style, rightCell.style)
      ) {
        return false
      }
    }
  }
  return true
}

function areSpreadsheetSheetStatesEquivalent(
  left: DataGridSpreadsheetSheetState,
  right: DataGridSpreadsheetSheetState,
): boolean {
  return areSpreadsheetColumnSnapshotsEqual(left.columns, right.columns)
    && areSpreadsheetSheetStateRowsEqual(left.rows, right.rows)
    && areSpreadsheetStylesEqual(left.sheetStyle, right.sheetStyle)
    && areSpreadsheetFormulaTableBindingsEqual(left.formulaTables, right.formulaTables)
}

function mergeSpreadsheetStyles(
  sheetStyle: DataGridSpreadsheetStyle | null,
  columnStyle: DataGridSpreadsheetStyle | null,
  rowStyle: DataGridSpreadsheetStyle | null,
  cellStyle: DataGridSpreadsheetStyle | null,
): DataGridSpreadsheetStyle | null {
  const merged = {
    ...(sheetStyle ?? {}),
    ...(columnStyle ?? {}),
    ...(rowStyle ?? {}),
    ...(cellStyle ?? {}),
  }
  return normalizeSpreadsheetStyle(merged)
}

function normalizeCellRawInput(value: unknown): string {
  if (value == null) {
    return ""
  }
  if (typeof value === "string") {
    return value
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value)
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString()
  }
  return String(value)
}

function parsePlainCellDisplayValue(rawInput: string): unknown {
  const trimmed = rawInput.trim()
  if (trimmed.length === 0) {
    return null
  }
  if (/^(true|false)$/i.test(trimmed)) {
    return trimmed.toLowerCase() === "true"
  }
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return rawInput
}

function normalizeRowId(value: unknown, fallbackRowIndex: number): DataGridRowId {
  if (typeof value === "string" || typeof value === "number") {
    return value
  }
  return fallbackRowIndex + 1
}

function makeCellKey(rowIndex: number, columnKey: string): string {
  return `${rowIndex}\u001f${columnKey}`
}

function cloneCellAddress(address: DataGridSpreadsheetCellAddress): DataGridSpreadsheetCellAddress {
  return {
    sheetId: address.sheetId ?? null,
    rowId: address.rowId ?? null,
    rowIndex: address.rowIndex,
    columnKey: address.columnKey,
  }
}

function cloneSpreadsheetSheetRowMutation(
  mutation: DataGridSpreadsheetSheetRowMutation | null,
): DataGridSpreadsheetSheetRowMutation | null {
  return mutation
    ? {
      revision: mutation.revision,
      kind: mutation.kind,
      index: mutation.index,
      count: mutation.count,
    }
    : null
}

function resolveFormulaTableContextKey(name: string): string {
  const normalized = name.trim().toLowerCase()
  return normalized.length === 0 ? "tables" : `table:${normalized}`
}

function resolveFormulaTableBindingName(contextKey: string): string {
  if (contextKey === "tables") {
    return ""
  }
  return contextKey.startsWith("table:") ? contextKey.slice("table:".length) : contextKey
}

function normalizeSpreadsheetSheetReferenceAlias(value: unknown): string {
  return String(value ?? "").trim().toLowerCase()
}

function resolveFormulaTargetRowIndexes(
  rowSelector: ReturnType<typeof parseDataGridFormulaIdentifier>["rowSelector"],
  currentRowIndex: number,
  rowCount: number,
): readonly number[] {
  const targetIndexes: number[] = []
  const pushRowIndex = (rowIndex: number): void => {
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= rowCount) {
      return
    }
    targetIndexes.push(rowIndex)
  }

  if (rowSelector.kind === "current") {
    pushRowIndex(currentRowIndex)
    return Object.freeze(targetIndexes)
  }
  if (rowSelector.kind === "absolute") {
    pushRowIndex(rowSelector.rowIndex)
    return Object.freeze(targetIndexes)
  }
  if (rowSelector.kind === "absolute-window") {
    for (let rowIndex = rowSelector.startRowIndex; rowIndex <= rowSelector.endRowIndex; rowIndex += 1) {
      pushRowIndex(rowIndex)
    }
    return Object.freeze(targetIndexes)
  }
  if (rowSelector.kind === "relative") {
    pushRowIndex(currentRowIndex + rowSelector.offset)
    return Object.freeze(targetIndexes)
  }
  const step = rowSelector.startOffset <= rowSelector.endOffset ? 1 : -1
  for (
    let offset = rowSelector.startOffset;
    step > 0 ? offset <= rowSelector.endOffset : offset >= rowSelector.endOffset;
    offset += step
  ) {
    pushRowIndex(currentRowIndex + offset)
  }
  return Object.freeze(targetIndexes)
}

function createCellAddress(
  sheetId: string | null,
  row: SpreadsheetRowState,
  columnKey: string,
): DataGridSpreadsheetCellAddress {
  return {
    sheetId,
    rowId: row.id,
    rowIndex: row.rowIndex,
    columnKey,
  }
}

function compareCellAddresses(
  left: DataGridSpreadsheetCellAddress,
  right: DataGridSpreadsheetCellAddress,
): number {
  if (left.rowIndex !== right.rowIndex) {
    return left.rowIndex - right.rowIndex
  }
  return left.columnKey.localeCompare(right.columnKey)
}

export function createDataGridSpreadsheetSheetModel(
  options: CreateDataGridSpreadsheetSheetModelOptions,
): DataGridSpreadsheetSheetModel {
  const sheetId = normalizeSheetIdentity(options.sheetId)
  const sheetName = normalizeSheetIdentity(options.sheetName)
  const functionRegistry = options.functionRegistry
  const referenceParserOptions = options.referenceParserOptions
  const runtimeErrorPolicy = options.runtimeErrorPolicy ?? "error-value"
  const rawInputRetention = options.rawInputRetention === "formula-only"
    ? "formula-only"
    : "all"

  const columns: SpreadsheetColumnState[] = []
  const columnIndexByKey = new Map<string, number>()
  for (const column of options.columns ?? []) {
    const key = normalizeColumnKey(column.key)
    if (columnIndexByKey.has(key)) {
      throw new Error(`[DataGridSpreadsheetSheet] duplicate column key '${key}'.`)
    }
    columnIndexByKey.set(key, columns.length)
    columns.push({
      key,
      title: normalizeColumnTitle(column.title, key),
      style: normalizeSpreadsheetStyle(column.style),
    })
  }
  if (columns.length === 0) {
    throw new Error("[DataGridSpreadsheetSheet] columns must be non-empty.")
  }

  const rows: SpreadsheetRowState[] = []
  const rowIndexById = new Map<DataGridRowId, number>()
  const createResolvedValues = (): unknown[] => Array.from({ length: columns.length }, () => null)
  for (let rowIndex = 0; rowIndex < (options.rows?.length ?? 0); rowIndex += 1) {
    const rowInput = options.rows?.[rowIndex] ?? {}
    const rowId = normalizeRowId(rowInput.id, rowIndex)
    if (rowIndexById.has(rowId)) {
      throw new Error(`[DataGridSpreadsheetSheet] duplicate row id '${String(rowId)}'.`)
    }
    rowIndexById.set(rowId, rowIndex)
    rows.push({
      id: rowId,
      rowIndex,
      style: normalizeSpreadsheetStyle(rowInput.style),
      resolvedValues: createResolvedValues(),
    })
  }
  let nextSyntheticRowId = rows.length + 1

  function createUniqueRowId(
    rowInput: DataGridSpreadsheetRowInput | null | undefined,
    reservedRowIds: Pick<ReadonlySet<DataGridRowId>, "has"> = rowIndexById,
  ): DataGridRowId {
    if (typeof rowInput?.id === "string" || typeof rowInput?.id === "number") {
      if (reservedRowIds.has(rowInput.id)) {
        throw new Error(`[DataGridSpreadsheetSheet] duplicate row id '${String(rowInput.id)}'.`)
      }
      return rowInput.id
    }
    while (reservedRowIds.has(`row-${nextSyntheticRowId}`) || reservedRowIds.has(nextSyntheticRowId)) {
      nextSyntheticRowId += 1
    }
    const rowId = `row-${nextSyntheticRowId}`
    nextSyntheticRowId += 1
    return rowId
  }

  function createSpreadsheetRowState(
    rowInput: DataGridSpreadsheetRowInput | null | undefined,
    rowIndex: number,
    reservedRowIds: Pick<ReadonlySet<DataGridRowId>, "has"> = rowIndexById,
  ): SpreadsheetRowState {
    const rowId = createUniqueRowId(rowInput, reservedRowIds)
    return {
      id: rowId,
      rowIndex,
      style: normalizeSpreadsheetStyle(rowInput?.style),
      resolvedValues: createResolvedValues(),
    }
  }

  function createResolvedRowData(row: SpreadsheetRowState): Record<string, unknown> {
    const resolvedData = Object.create(null) as Record<string, unknown>
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex]
      if (!column) {
        continue
      }
      resolvedData[column.key] = row.resolvedValues[columnIndex] ?? null
    }
    return resolvedData
  }

  function getResolvedCellValue(
    row: SpreadsheetRowState | null | undefined,
    columnKey: string,
  ): unknown {
    if (!row) {
      return null
    }
    const columnIndex = columnIndexByKey.get(columnKey)
    if (typeof columnIndex !== "number") {
      return null
    }
    return row.resolvedValues[columnIndex] ?? null
  }

  function setResolvedCellValueOnRow(
    row: SpreadsheetRowState | null | undefined,
    columnKey: string,
    value: unknown,
  ): boolean {
    if (!row) {
      return false
    }
    const columnIndex = columnIndexByKey.get(columnKey)
    if (typeof columnIndex !== "number") {
      return false
    }
    const previousValue = row.resolvedValues[columnIndex]
    if (Object.is(previousValue, value)) {
      return false
    }
    row.resolvedValues[columnIndex] = value
    return true
  }

  const rawInputByRowIndex: Array<Map<string, string>> = rows.map(() => new Map())
  const analysisByCellKey = new Map<string, DataGridSpreadsheetCellInputAnalysis>()
  const cellStyleByRowIndex: Array<Map<string, DataGridSpreadsheetStyle>> = rows.map(() => new Map())
  const formulaCellByKey = new Map<string, SpreadsheetFormulaCellState>()
  const dependentsByCellKey = new Map<string, Set<string>>()
  const formulaTablesByContextKey = new Map<string, DataGridFormulaTableSource>()
  const compiledFormulaArtifactByExactFormula = new Map<string, DataGridCompiledFormulaArtifact<Record<string, unknown>>>()
  let formulaStructuralReferenceIndexRevision = -1
  let formulaStructuralCellKeysBySheetAlias = new Map<string, readonly string[]>()
  const tableSource = {
    rows,
    resolveRow: (row: unknown) => createResolvedRowData(row as SpreadsheetRowState),
  } satisfies DataGridFormulaTableSource

  const initialRows = options.rows ?? []
  for (let rowIndex = 0; rowIndex < initialRows.length; rowIndex += 1) {
    const rowInput = initialRows[rowIndex]
    const row = rows[rowIndex]
    if (!row || !rowInput?.cells) {
      continue
    }
    for (const [columnKeyInput, cellValue] of Object.entries(rowInput.cells)) {
      const columnKey = normalizeColumnKey(columnKeyInput)
      if (!columnIndexByKey.has(columnKey)) {
        continue
      }
      const rawInput = normalizeCellRawInput(cellValue)
      if (rawInput.trim().length === 0) {
        continue
      }
      if (shouldRetainRawInput(rawInput)) {
        rawInputByRowIndex[rowIndex]?.set(columnKey, rawInput)
      } else {
        syncNonRetainedRawInputToResolvedValue(rowIndex, columnKey, rawInput)
      }
    }
  }

  for (const binding of options.formulaTables ?? []) {
    formulaTablesByContextKey.set(resolveFormulaTableContextKey(binding.name), binding.source)
  }

  let disposed = false
  let revision = 0
  let valueRevision = 0
  let formulaStructureRevision = 0
  let styleRevision = 0
  let rowMutationRevision = 0
  let lastRowMutation: DataGridSpreadsheetSheetRowMutation | null = null
  let sheetStyle = normalizeSpreadsheetStyle(options.sheetStyle)
  const listeners = new Set<DataGridSpreadsheetSheetListener>()

  function ensureActive(): void {
    if (disposed) {
      throw new Error("DataGridSpreadsheetSheetModel has been disposed")
    }
  }

  function getSnapshot(): DataGridSpreadsheetSheetSnapshot {
    let errorCellCount = 0
    for (const formulaCell of formulaCellByKey.values()) {
      const value = getResolvedCellValue(rows[formulaCell.address.rowIndex], formulaCell.address.columnKey)
      if (isFormulaErrorValue(value) || formulaCell.analysis.diagnostics.length > 0) {
        errorCellCount += 1
      }
    }
    return {
      revision,
      valueRevision,
      formulaStructureRevision,
      styleRevision,
      rowCount: rows.length,
      columnCount: columns.length,
      formulaCellCount: formulaCellByKey.size,
      errorCellCount,
      sheetId,
      sheetName,
      lastRowMutation: cloneSpreadsheetSheetRowMutation(lastRowMutation),
    }
  }

  function createFormulaStructuralCellSnapshot(
    formulaCell: SpreadsheetFormulaCellState,
  ): DataGridSpreadsheetFormulaStructuralCellSnapshot {
    return {
      address: cloneCellAddress(formulaCell.address),
      formula: formulaCell.formulaModel.formula ?? formulaCell.analysis.formula ?? "",
      contextKeys: formulaCell.contextKeys,
      dependencies: formulaCell.dependencies,
      formulaModel: formulaCell.formulaModel,
      formulaRuntime: formulaCell.formulaRuntime,
    }
  }

  function createCompiledFormulaTemplate(
    formulaModel: DataGridSpreadsheetCellFormulaModel,
  ): string {
    let nextFormula = formulaModel.rawInput
    const references = [...formulaModel.references].sort((left, right) => right.span.start - left.span.start)
    for (const reference of references) {
      nextFormula = `${nextFormula.slice(0, reference.span.start)}${createCompiledFormulaReferenceToken(reference.index)}${nextFormula.slice(reference.span.end)}`
    }
    return nextFormula
  }

  function resolveFormulaStructuralReferenceIndex(): ReadonlyMap<string, readonly string[]> {
    if (formulaStructuralReferenceIndexRevision === formulaStructureRevision) {
      return formulaStructuralCellKeysBySheetAlias
    }

    const nextIndex = new Map<string, Set<string>>()
    for (const formulaCell of formulaCellByKey.values()) {
      const aliases = new Set<string>()
      for (const binding of formulaCell.formulaRuntime.bindings) {
        if (binding.kind !== "reference") {
          continue
        }
        const normalizedAlias = normalizeSpreadsheetSheetReferenceAlias(binding.sheetReference)
        if (normalizedAlias.length === 0 || isCurrentSheetReference(binding.sheetReference)) {
          continue
        }
        aliases.add(normalizedAlias)
      }
      for (const alias of aliases) {
        const existing = nextIndex.get(alias)
        if (existing) {
          existing.add(formulaCell.key)
          continue
        }
        nextIndex.set(alias, new Set([formulaCell.key]))
      }
    }

    formulaStructuralCellKeysBySheetAlias = new Map(
      [...nextIndex.entries()].map(([alias, cellKeys]) => [alias, Object.freeze([...cellKeys])]),
    )
    formulaStructuralReferenceIndexRevision = formulaStructureRevision
    return formulaStructuralCellKeysBySheetAlias
  }

  function emit(): void {
    if (listeners.size === 0 || disposed) {
      return
    }
    const snapshot = getSnapshot()
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  function resolveCellKey(cell: DataGridSpreadsheetCellAddress): string {
    const rowIndex = Math.trunc(cell.rowIndex)
    const columnKey = normalizeColumnKey(cell.columnKey)
    if (!Number.isFinite(rowIndex) || rowIndex < 0 || rowIndex >= rows.length) {
      throw new Error(`[DataGridSpreadsheetSheet] rowIndex '${String(cell.rowIndex)}' is out of bounds.`)
    }
    if (!columnIndexByKey.has(columnKey)) {
      throw new Error(`[DataGridSpreadsheetSheet] unknown column '${columnKey}'.`)
    }
    return makeCellKey(rowIndex, columnKey)
  }

  function resolveAddressFromCellKey(cellKey: string): DataGridSpreadsheetCellAddress | null {
    const separatorIndex = cellKey.indexOf("\u001f")
    if (separatorIndex < 0) {
      return null
    }
    const rowIndex = Number(cellKey.slice(0, separatorIndex))
    const row = rows[rowIndex]
    if (!row) {
      return null
    }
    const columnKey = cellKey.slice(separatorIndex + 1)
    return createCellAddress(sheetId, row, columnKey)
  }

  function getStoredRawInput(
    rowIndex: number,
    columnKey: string,
  ): string | undefined {
    return rawInputByRowIndex[rowIndex]?.get(columnKey)
  }

  function hasStoredRawInput(
    rowIndex: number,
    columnKey: string,
  ): boolean {
    return rawInputByRowIndex[rowIndex]?.has(columnKey) ?? false
  }

  function setStoredRawInput(
    rowIndex: number,
    columnKey: string,
    rawInput: string,
  ): void {
    let rowInputs = rawInputByRowIndex[rowIndex]
    if (!rowInputs) {
      rowInputs = new Map()
      rawInputByRowIndex[rowIndex] = rowInputs
    }
    rowInputs.set(columnKey, rawInput)
  }

  function deleteStoredRawInput(
    rowIndex: number,
    columnKey: string,
  ): void {
    rawInputByRowIndex[rowIndex]?.delete(columnKey)
  }

  function iterateStoredRawInputs(): IterableIterator<[string, string]> {
    return (function* (): IterableIterator<[string, string]> {
      for (let rowIndex = 0; rowIndex < rawInputByRowIndex.length; rowIndex += 1) {
        const rowInputs = rawInputByRowIndex[rowIndex]
        if (!rowInputs) {
          continue
        }
        for (const [columnKey, rawInput] of rowInputs.entries()) {
          yield [makeCellKey(rowIndex, columnKey), rawInput]
        }
      }
    })()
  }

  function getStoredCellStyle(
    rowIndex: number,
    columnKey: string,
  ): DataGridSpreadsheetStyle | undefined {
    return cellStyleByRowIndex[rowIndex]?.get(columnKey)
  }

  function setStoredCellStyle(
    rowIndex: number,
    columnKey: string,
    style: DataGridSpreadsheetStyle,
  ): void {
    let rowStyles = cellStyleByRowIndex[rowIndex]
    if (!rowStyles) {
      rowStyles = new Map()
      cellStyleByRowIndex[rowIndex] = rowStyles
    }
    rowStyles.set(columnKey, style)
  }

  function deleteStoredCellStyle(
    rowIndex: number,
    columnKey: string,
  ): void {
    cellStyleByRowIndex[rowIndex]?.delete(columnKey)
  }

  function getCellOwnStyle(cellKey: string): DataGridSpreadsheetStyle | null {
    const address = resolveAddressFromCellKey(cellKey)
    if (!address) {
      return null
    }
    return getStoredCellStyle(address.rowIndex, address.columnKey) ?? null
  }

  function getResolvedCellStyle(cellKey: string): DataGridSpreadsheetStyle | null {
    const address = resolveAddressFromCellKey(cellKey)
    if (!address) {
      return null
    }
    const row = rows[address.rowIndex]
    const column = columns[columnIndexByKey.get(address.columnKey) ?? -1]
    return mergeSpreadsheetStyles(
      sheetStyle,
      column?.style ?? null,
      row?.style ?? null,
      getCellOwnStyle(cellKey),
    )
  }

  function shouldRetainRawInput(rawInput: string): boolean {
    if (rawInput.length === 0) {
      return false
    }
    if (rawInputRetention === "all") {
      return true
    }
    return rawInput.trimStart().startsWith("=")
  }

  function syncNonRetainedRawInputToResolvedValue(
    rowIndex: number,
    columnKey: string,
    rawInput: string,
  ): boolean {
    if (shouldRetainRawInput(rawInput)) {
      return false
    }
    return setResolvedCellValueOnRow(
      rows[rowIndex],
      columnKey,
      parsePlainCellDisplayValue(rawInput),
    )
  }

  function getRawInput(cellKey: string): string {
    const address = resolveAddressFromCellKey(cellKey)
    const stored = address
      ? getStoredRawInput(address.rowIndex, address.columnKey)
      : null
    if (stored != null) {
      return stored
    }
    if (rawInputRetention === "formula-only") {
      if (!address) {
        return ""
      }
      return normalizeCellRawInput(getResolvedCellValue(rows[address.rowIndex], address.columnKey) ?? "")
    }
    return ""
  }

  function getAnalysis(cellKey: string, rowIndex: number): DataGridSpreadsheetCellInputAnalysis {
    const cached = analysisByCellKey.get(cellKey)
    if (cached) {
      return cached
    }
    return analyzeCellInput(getRawInput(cellKey), rowIndex)
  }

  function isCurrentSheetReference(sheetReference: string | null | undefined): boolean {
    const normalizedReference = normalizeSpreadsheetSheetReferenceAlias(sheetReference)
    if (normalizedReference.length === 0) {
      return true
    }
    return normalizedReference === normalizeSpreadsheetSheetReferenceAlias(sheetId)
      || normalizedReference === normalizeSpreadsheetSheetReferenceAlias(sheetName)
  }

  function resolveReferencedSheetModel(
    sheetReference: string | null | undefined,
  ): DataGridSpreadsheetSheetModel | null {
    if (isCurrentSheetReference(sheetReference)) {
      return null
    }
    const normalizedReference = String(sheetReference ?? "").trim()
    if (normalizedReference.length === 0) {
      return null
    }
    return options.resolveSheetReference?.(normalizedReference, sheetId) ?? null
  }

  function createMissingSheetReferenceError(
    sheetReference: string | null | undefined,
  ): DataGridFormulaErrorValue {
    const normalizedReference = String(sheetReference ?? "").trim()
    return createFormulaErrorValue({
      code: "EVAL_ERROR",
      message: normalizedReference.length > 0
        ? `Unknown sheet reference '${normalizedReference}'.`
        : "Unknown sheet reference.",
    })
  }

  function buildRuntimeAnalysis(
    analysis: DataGridSpreadsheetCellInputAnalysis,
  ): DataGridSpreadsheetCellInputAnalysis {
    if (analysis.references.length === 0) {
      return analysis
    }
    const diagnostics = [...analysis.diagnostics]
    let changed = false
    for (const reference of analysis.references) {
      if (
        !reference.sheetReference
        || isCurrentSheetReference(reference.sheetReference)
        || resolveReferencedSheetModel(reference.sheetReference)
      ) {
        continue
      }
      diagnostics.push({
        severity: "error",
        message: `Unknown sheet reference '${reference.sheetReference}'.`,
        span: { ...reference.span },
      })
      changed = true
    }
    if (!changed) {
      return analysis
    }
    return {
      ...analysis,
      diagnostics: Object.freeze(diagnostics),
      isFormulaValid: false,
    }
  }

  function rebuildRowIndexState(): void {
    rowIndexById.clear()
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex]
      if (!row) {
        continue
      }
      row.rowIndex = rowIndex
      rowIndexById.set(row.id, rowIndex)
    }
  }

  function setResolvedCellValue(cellKey: string, value: unknown): boolean {
    const address = resolveAddressFromCellKey(cellKey)
    if (!address) {
      return false
    }
    return setResolvedCellValueOnRow(rows[address.rowIndex], address.columnKey, value)
  }

  function refreshAllBaseCellValues(): boolean {
    let changed = false
    if (rawInputRetention === "all") {
      for (const row of rows) {
        for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
          if (!Object.is(row.resolvedValues[columnIndex], null)) {
            row.resolvedValues[columnIndex] = null
            changed = true
          }
        }
      }
    }
    for (const [cellKey, rawInput] of iterateStoredRawInputs()) {
      const address = resolveAddressFromCellKey(cellKey)
      if (!address) {
        continue
      }
      const analysis = analysisByCellKey.get(cellKey) ?? getAnalysis(cellKey, address.rowIndex)
      if (analysis.kind === "formula") {
        if (setResolvedCellValueOnRow(rows[address.rowIndex], address.columnKey, null)) {
          changed = true
        }
        continue
      }
      const nextValue = parsePlainCellDisplayValue(rawInput)
      if (setResolvedCellValueOnRow(rows[address.rowIndex], address.columnKey, nextValue)) {
        changed = true
      }
    }
    return changed
  }

  function collectDependencyAddresses(
    analysis: DataGridSpreadsheetCellInputAnalysis,
  ): readonly DataGridSpreadsheetCellAddress[] {
    const dependencies: DataGridSpreadsheetCellAddress[] = []
    const seenDependencyKeys = new Set<string>()

    const resolveColumnKeysForReference = (
      startColumnKey: string,
      endColumnKey: string | null | undefined,
      availableColumns: readonly { key: string }[],
    ): readonly string[] => {
      if (!endColumnKey || endColumnKey === startColumnKey) {
        return Object.freeze([startColumnKey])
      }
      const startIndex = availableColumns.findIndex(column => column.key === startColumnKey)
      const endIndex = availableColumns.findIndex(column => column.key === endColumnKey)
      if (startIndex < 0 || endIndex < 0) {
        return Object.freeze([startColumnKey])
      }
      const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
      return Object.freeze(availableColumns.slice(from, to + 1).map(column => column.key))
    }

    for (const reference of analysis.references) {
      if (!isCurrentSheetReference(reference.sheetReference)) {
        continue
      }
      const targetColumnKeys = resolveColumnKeysForReference(
        reference.referenceName,
        reference.rangeReferenceName,
        columns,
      )
      for (const targetRowIndex of reference.targetRowIndexes) {
        const row = rows[targetRowIndex]
        if (!row) {
          continue
        }
        for (const targetColumnKey of targetColumnKeys) {
          const dependencyAddress = createCellAddress(sheetId, row, targetColumnKey)
          const dependencyKey = makeCellKey(dependencyAddress.rowIndex, dependencyAddress.columnKey)
          if (seenDependencyKeys.has(dependencyKey)) {
            continue
          }
          seenDependencyKeys.add(dependencyKey)
          dependencies.push(dependencyAddress)
        }
      }
    }
    dependencies.sort(compareCellAddresses)
    return Object.freeze(dependencies)
  }

  function setDependentLinkInMap(
    map: Map<string, Set<string>>,
    sourceCellKey: string,
    dependentCellKey: string,
  ): void {
    const dependents = map.get(sourceCellKey)
    if (dependents) {
      dependents.add(dependentCellKey)
      return
    }
    map.set(sourceCellKey, new Set([dependentCellKey]))
  }

  function deleteDependentLink(
    sourceCellKey: string,
    dependentCellKey: string,
  ): void {
    const dependents = dependentsByCellKey.get(sourceCellKey)
    if (!dependents) {
      return
    }
    dependents.delete(dependentCellKey)
    if (dependents.size === 0) {
      dependentsByCellKey.delete(sourceCellKey)
    }
  }

  function analyzeCellInput(
    rawInput: string,
    rowIndex: number,
  ): DataGridSpreadsheetCellInputAnalysis {
    return analyzeDataGridSpreadsheetCellInput(rawInput, {
      currentRowIndex: rowIndex,
      rowCount: rows.length,
      resolveReferenceRowCount: reference => resolveReferencedSheetModel(reference.sheetReference)?.getRowCount() ?? rows.length,
      functionRegistry,
      referenceParserOptions,
    })
  }

  function arraysEqual(
    left: readonly number[],
    right: readonly number[],
  ): boolean {
    if (left.length !== right.length) {
      return false
    }
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        return false
      }
    }
    return true
  }

  function retargetFormulaAnalysis(
    analysis: DataGridSpreadsheetCellInputAnalysis,
    rowIndex: number,
  ): DataGridSpreadsheetCellInputAnalysis {
    if (analysis.kind !== "formula" || analysis.references.length === 0) {
      return analysis
    }

    let changed = false
    const nextReferences = analysis.references.map((reference): DataGridSpreadsheetFormulaReferenceSpan => {
      const targetRowCount = resolveReferencedSheetModel(reference.sheetReference)?.getRowCount() ?? rows.length
      const nextTargetRowIndexes = resolveFormulaTargetRowIndexes(
        reference.rowSelector,
        rowIndex,
        targetRowCount,
      )
      if (arraysEqual(reference.targetRowIndexes, nextTargetRowIndexes)) {
        return reference
      }
      changed = true
      return Object.freeze({
        ...reference,
        targetRowIndexes: nextTargetRowIndexes,
      })
    })

    if (!changed) {
      return analysis
    }
    return {
      ...analysis,
      references: Object.freeze(nextReferences),
    }
  }

  function canPreserveMovedFormulaValueOnInsert(
    formulaCell: SpreadsheetFormulaCellState,
    insertIndex: number,
  ): boolean {
    for (const reference of formulaCell.analysis.references) {
      if (!isCurrentSheetReference(reference.sheetReference)) {
        continue
      }
      if (reference.rowSelector.kind !== "relative") {
        return false
      }
      for (const targetRowIndex of reference.targetRowIndexes) {
        if (targetRowIndex < insertIndex) {
          return false
        }
      }
    }
    return true
  }

  function createFormulaCellState(
    cellKey: string,
    address: DataGridSpreadsheetCellAddress,
    analysis: DataGridSpreadsheetCellInputAnalysis,
    formulaModel: DataGridSpreadsheetCellFormulaModel,
    formulaRuntime: DataGridSpreadsheetCellFormulaRuntimeModel,
    compiledOverride: DataGridCompiledFormulaField<Record<string, unknown>> | null = null,
  ): SpreadsheetFormulaCellState {
    const dependencies = collectDependencyAddresses(analysis)
    const dependencyKeys = Object.freeze(dependencies.map(dependency => makeCellKey(
      dependency.rowIndex,
      dependency.columnKey,
    )))
    let compiled = compiledOverride
    if (!compiled && analysis.isFormulaValid) {
      const compiledFormulaTemplate = createCompiledFormulaTemplate(formulaModel)
      const cachedArtifact = compiledFormulaArtifactByExactFormula.get(compiledFormulaTemplate)
      if (cachedArtifact) {
        compiled = bindCompiledFormulaArtifactToFieldDefinition<Record<string, unknown>>(cachedArtifact, {
          name: cellKey,
          field: address.columnKey,
          formula: compiledFormulaTemplate,
        }, {
          runtimeErrorPolicy,
        })
      } else {
        const artifact = compileDataGridFormulaFieldArtifact<Record<string, unknown>>({
          name: cellKey,
          field: address.columnKey,
          formula: compiledFormulaTemplate,
        }, {
          compileStrategy: "ast",
          functionRegistry,
          referenceParserOptions,
          runtimeErrorPolicy,
          resolveDependencyToken: identifier => identifier,
        })
        compiledFormulaArtifactByExactFormula.set(compiledFormulaTemplate, artifact)
        compiled = bindCompiledFormulaArtifactToFieldDefinition<Record<string, unknown>>(artifact, {
          name: cellKey,
          field: address.columnKey,
          formula: compiledFormulaTemplate,
        }, {
          runtimeErrorPolicy,
        })
      }
    }
    return {
      key: cellKey,
      address,
      analysis,
      formulaModel,
      formulaRuntime,
      compiled: analysis.isFormulaValid ? compiled : null,
      dependencies,
      dependencyKeys,
      contextKeys: compiled?.contextKeys ?? EMPTY_DIAGNOSTICS,
    }
  }

  function registerFormulaCellStateInMaps(
    maps: SpreadsheetFormulaStateMaps,
    formulaCellState: SpreadsheetFormulaCellState,
  ): void {
    maps.analysisByCellKey.set(formulaCellState.key, formulaCellState.analysis)
    maps.formulaCellByKey.set(formulaCellState.key, formulaCellState)
    for (const dependencyKey of formulaCellState.dependencyKeys) {
      setDependentLinkInMap(maps.dependentsByCellKey, dependencyKey, formulaCellState.key)
    }
  }

  function applyFormulaStateMaps(
    maps: SpreadsheetFormulaStateMaps,
  ): void {
    analysisByCellKey.clear()
    for (const [cellKey, analysis] of maps.analysisByCellKey) {
      analysisByCellKey.set(cellKey, analysis)
    }
    formulaCellByKey.clear()
    for (const [cellKey, formulaCellState] of maps.formulaCellByKey) {
      formulaCellByKey.set(cellKey, formulaCellState)
    }
    dependentsByCellKey.clear()
    for (const [cellKey, dependents] of maps.dependentsByCellKey) {
      dependentsByCellKey.set(cellKey, dependents)
    }
  }

  function buildFullFormulaStateMaps(): SpreadsheetFormulaStateMaps {
    const maps: SpreadsheetFormulaStateMaps = {
      analysisByCellKey: new Map(),
      formulaCellByKey: new Map(),
      dependentsByCellKey: new Map(),
    }

    for (const [cellKey, rawInput] of iterateStoredRawInputs()) {
      const address = resolveAddressFromCellKey(cellKey)
      if (!address) {
        continue
      }
      const analysis = analyzeCellInput(rawInput, address.rowIndex)
      if (analysis.kind !== "formula") {
        continue
      }
      const formulaModel = createDataGridSpreadsheetCellFormulaModel(analysis, {
        referenceParserOptions,
      })
      const formulaRuntime = createDataGridSpreadsheetCellFormulaRuntimeModel(analysis)
      if (!formulaModel || !formulaRuntime) {
        continue
      }
      registerFormulaCellStateInMaps(
        maps,
        createFormulaCellState(cellKey, address, analysis, formulaModel, formulaRuntime),
      )
    }

    return maps
  }

  function rebuildFormulaStateAfterRowMutation(
    mutation: {
      kind: DataGridSpreadsheetSheetRowMutationKind
      index: number
      count: number
      insertedRows?: readonly DataGridSpreadsheetRowInput[]
    },
    previousFormulaCells: readonly SpreadsheetFormulaCellState[],
    previousFormulaModels: ReadonlyMap<string, DataGridSpreadsheetCellFormulaModel>,
    previousFormulaRuntimeModels: ReadonlyMap<string, DataGridSpreadsheetCellFormulaRuntimeModel>,
    previousFormulaValues: ReadonlyMap<string, unknown>,
  ): {
    baseValuesChanged: boolean
    dirtyFormulaKeys: ReadonlySet<string>
  } {
    const maps: SpreadsheetFormulaStateMaps = {
      analysisByCellKey: new Map(),
      formulaCellByKey: new Map(),
      dependentsByCellKey: new Map(),
    }
    const dirtyFormulaKeys = new Set<string>()
    const preservedFormulaValues = new Map<string, unknown>()

    for (const previousFormulaCell of previousFormulaCells) {
      const previousRowIndex = previousFormulaCell.address.rowIndex
      if (
        mutation.kind === "remove"
        && previousRowIndex >= mutation.index
        && previousRowIndex < mutation.index + mutation.count
      ) {
        continue
      }

      const nextRowIndex = previousRowIndex >= mutation.index
        ? previousRowIndex + (mutation.kind === "insert" ? mutation.count : -mutation.count)
        : previousRowIndex
      const nextRow = rows[nextRowIndex]
      if (!nextRow) {
        continue
      }
      const nextCellKey = makeCellKey(nextRowIndex, previousFormulaCell.address.columnKey)
      const nextRawInput = getStoredRawInput(nextRowIndex, previousFormulaCell.address.columnKey)
      if (typeof nextRawInput !== "string") {
        continue
      }
      const rawInputChanged = nextRawInput !== previousFormulaCell.analysis.rawInput
      const analysis = rawInputChanged
        ? analyzeCellInput(nextRawInput, nextRowIndex)
        : retargetFormulaAnalysis(previousFormulaCell.analysis, nextRowIndex)
      if (analysis.kind !== "formula") {
        continue
      }
      const formulaModel = rawInputChanged
        ? createDataGridSpreadsheetCellFormulaModel(analysis, {
          referenceParserOptions,
        })
        : (previousFormulaModels.get(previousFormulaCell.key)
          ?? createDataGridSpreadsheetCellFormulaModel(analysis, {
            referenceParserOptions,
          }))
      const formulaRuntime = rawInputChanged
        ? createDataGridSpreadsheetCellFormulaRuntimeModel(analysis)
        : (previousFormulaRuntimeModels.get(previousFormulaCell.key)
          ?? createDataGridSpreadsheetCellFormulaRuntimeModel(analysis))
      if (!formulaModel || !formulaRuntime) {
        continue
      }
      registerFormulaCellStateInMaps(
        maps,
        createFormulaCellState(
          nextCellKey,
          createCellAddress(sheetId, nextRow, previousFormulaCell.address.columnKey),
          analysis,
          formulaModel,
          formulaRuntime,
          rawInputChanged ? null : previousFormulaCell.compiled,
        ),
      )
      if (rawInputChanged) {
        dirtyFormulaKeys.add(nextCellKey)
        continue
      }
      if (nextRowIndex !== previousRowIndex) {
        if (
          mutation.kind === "insert"
          && canPreserveMovedFormulaValueOnInsert(previousFormulaCell, mutation.index)
        ) {
          preservedFormulaValues.set(
            nextCellKey,
            previousFormulaValues.get(previousFormulaCell.key),
          )
          continue
        }
        dirtyFormulaKeys.add(nextCellKey)
      }
    }

    if (mutation.kind === "insert") {
      for (let offset = 0; offset < mutation.count; offset += 1) {
        const rowIndex = mutation.index + offset
        const rowInput = mutation.insertedRows?.[offset]
        if (!rowInput?.cells) {
          continue
        }
        for (const columnKeyInput of Object.keys(rowInput.cells)) {
          const columnKey = normalizeColumnKey(columnKeyInput)
          if (!columnIndexByKey.has(columnKey)) {
            continue
          }
          const cellKey = makeCellKey(rowIndex, columnKey)
          if (!hasStoredRawInput(rowIndex, columnKey) || maps.formulaCellByKey.has(cellKey)) {
            continue
          }
          const analysis = analyzeCellInput(getStoredRawInput(rowIndex, columnKey)!, rowIndex)
          if (analysis.kind !== "formula") {
            continue
          }
          const formulaModel = createDataGridSpreadsheetCellFormulaModel(analysis, {
            referenceParserOptions,
          })
          const formulaRuntime = createDataGridSpreadsheetCellFormulaRuntimeModel(analysis)
          const row = rows[rowIndex]
          if (!formulaModel || !formulaRuntime || !row) {
            continue
          }
          registerFormulaCellStateInMaps(
            maps,
            createFormulaCellState(
              cellKey,
              createCellAddress(sheetId, row, columnKey),
              analysis,
              formulaModel,
              formulaRuntime,
            ),
          )
          dirtyFormulaKeys.add(cellKey)
        }
      }
    }

    applyFormulaStateMaps(maps)
    let baseValuesChanged = refreshAllBaseCellValues()
    for (const [cellKey, preservedValue] of preservedFormulaValues) {
      if (setResolvedCellValue(cellKey, preservedValue)) {
        baseValuesChanged = true
      }
    }
    return {
      baseValuesChanged,
      dirtyFormulaKeys: dirtyFormulaKeys,
    }
  }

  function rebuildFormulaState(): boolean {
    applyFormulaStateMaps(buildFullFormulaStateMaps())
    return refreshAllBaseCellValues()
  }

  function createFormulaContext(
    formulaCell: SpreadsheetFormulaCellState,
    dirtyFormulaKeys: ReadonlySet<string> | null,
    cache: Map<string, DataGridFormulaValue>,
    visiting: Set<string>,
  ): DataGridComputedFieldComputeContext<Record<string, unknown>> {
    const row = rows[formulaCell.address.rowIndex]
    const formulaRuntimeBindingByIndex = new Map(formulaCell.formulaRuntime.bindings.map(binding => [binding.index, binding]))

    const resolveColumnKeysForRange = (
      startColumnKey: string,
      endColumnKey: string | null | undefined,
      availableColumns: readonly { key: string }[],
    ): readonly string[] => {
      if (!endColumnKey || endColumnKey === startColumnKey) {
        return Object.freeze([startColumnKey])
      }
      const startIndex = availableColumns.findIndex(column => column.key === startColumnKey)
      const endIndex = availableColumns.findIndex(column => column.key === endColumnKey)
      if (startIndex < 0 || endIndex < 0) {
        return Object.freeze([startColumnKey])
      }
      const [from, to] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
      return Object.freeze(availableColumns.slice(from, to + 1).map(column => column.key))
    }

    return {
      row: row ? createResolvedRowData(row) : {},
      rowId: row?.id ?? formulaCell.address.rowIndex,
      sourceIndex: formulaCell.address.rowIndex,
      get: (token: string) => {
        if (typeof token !== "string") {
          return null
        }
        const compiledReferenceBindingIndex = resolveCompiledFormulaReferenceTokenIndex(token)
        const compiledReferenceBinding = compiledReferenceBindingIndex == null
          ? null
          : formulaRuntimeBindingByIndex.get(compiledReferenceBindingIndex)
        if (compiledReferenceBinding) {
          if (compiledReferenceBinding.kind !== "reference") {
            return createFormulaErrorValue({
              code: "EVAL_ERROR",
              message: "Invalid spreadsheet reference.",
            })
          }
          const hasExplicitExternalSheetReference = normalizeSpreadsheetSheetReferenceAlias(compiledReferenceBinding.sheetReference).length > 0
            && !isCurrentSheetReference(compiledReferenceBinding.sheetReference)
          const referencedSheetModel = resolveReferencedSheetModel(compiledReferenceBinding.sheetReference)
          if (hasExplicitExternalSheetReference && !referencedSheetModel) {
            return createMissingSheetReferenceError(compiledReferenceBinding.sheetReference)
          }
          const targetRowCount = referencedSheetModel?.getRowCount() ?? rows.length
          const targetRowIndexes = resolveFormulaTargetRowIndexes(
            compiledReferenceBinding.rowSelector,
            formulaCell.address.rowIndex,
            targetRowCount,
          )
          const isRangeReference = compiledReferenceBinding.rowSelector.kind === "window"
            || compiledReferenceBinding.rowSelector.kind === "absolute-window"
            || (typeof compiledReferenceBinding.rangeReferenceName === "string" && compiledReferenceBinding.rangeReferenceName.trim().length > 0)
          if (targetRowIndexes.length === 0) {
            return isRangeReference
              ? Object.freeze([])
              : null
          }
          if (referencedSheetModel) {
            const targetColumnKeys = resolveColumnKeysForRange(
              compiledReferenceBinding.referenceName,
              compiledReferenceBinding.rangeReferenceName,
              referencedSheetModel.getColumns(),
            )
            const resolvedValues = targetRowIndexes.flatMap(targetRowIndex => targetColumnKeys.map(columnKey => (
              referencedSheetModel.getCellDisplayValue({
                sheetId: referencedSheetModel.getSheetId(),
                rowId: null,
                rowIndex: targetRowIndex,
                columnKey,
              })
            )))
            return isRangeReference
              ? Object.freeze(resolvedValues)
              : (resolvedValues[0] ?? null)
          }
          const targetColumnKeys = resolveColumnKeysForRange(
            compiledReferenceBinding.referenceName,
            compiledReferenceBinding.rangeReferenceName,
            columns,
          )
          const resolvedValues = targetRowIndexes.flatMap((targetRowIndex) => targetColumnKeys.map((columnKey) => {
            const targetCellKey = makeCellKey(targetRowIndex, columnKey)
            const targetFormulaCell = formulaCellByKey.get(targetCellKey)
            if (targetFormulaCell) {
              if (dirtyFormulaKeys && !dirtyFormulaKeys.has(targetCellKey) && !cache.has(targetCellKey)) {
                return getResolvedCellValue(rows[targetRowIndex], columnKey)
              }
              return evaluateFormulaCell(targetFormulaCell, dirtyFormulaKeys, cache, visiting)
            }
            return getResolvedCellValue(rows[targetRowIndex], columnKey)
          }))
          return isRangeReference
            ? Object.freeze(resolvedValues)
            : (resolvedValues[0] ?? null)
        }
        const parsed = parseDataGridFormulaIdentifier(token, referenceParserOptions)
        if (parsed.referenceName.length === 0) {
          return null
        }
        const hasExplicitExternalSheetReference = normalizeSpreadsheetSheetReferenceAlias(parsed.sheetReference).length > 0
          && !isCurrentSheetReference(parsed.sheetReference)
        const referencedSheetModel = resolveReferencedSheetModel(parsed.sheetReference)
        if (hasExplicitExternalSheetReference && !referencedSheetModel) {
          return createMissingSheetReferenceError(parsed.sheetReference)
        }
        const targetRowCount = referencedSheetModel?.getRowCount() ?? rows.length
        const targetRowIndexes = resolveFormulaTargetRowIndexes(
          parsed.rowSelector,
          formulaCell.address.rowIndex,
          targetRowCount,
        )
        const isRangeReference = parsed.rowSelector.kind === "window"
          || parsed.rowSelector.kind === "absolute-window"
          || (typeof parsed.rangeReferenceName === "string" && parsed.rangeReferenceName.trim().length > 0)
        if (targetRowIndexes.length === 0) {
          return isRangeReference
            ? Object.freeze([])
            : null
        }
        if (referencedSheetModel) {
          const targetColumnKeys = resolveColumnKeysForRange(
            parsed.referenceName,
            parsed.rangeReferenceName,
            referencedSheetModel.getColumns(),
          )
          const resolvedValues = targetRowIndexes.flatMap(targetRowIndex => targetColumnKeys.map(columnKey => (
            referencedSheetModel.getCellDisplayValue({
              sheetId: referencedSheetModel.getSheetId(),
              rowId: null,
              rowIndex: targetRowIndex,
              columnKey,
            })
          )))
          return isRangeReference
            ? Object.freeze(resolvedValues)
            : (resolvedValues[0] ?? null)
        }
        const targetColumnKeys = resolveColumnKeysForRange(
          parsed.referenceName,
          parsed.rangeReferenceName,
          columns,
        )
        const resolvedValues = targetRowIndexes.flatMap((targetRowIndex) => targetColumnKeys.map((columnKey) => {
          const targetCellKey = makeCellKey(targetRowIndex, columnKey)
          const targetFormulaCell = formulaCellByKey.get(targetCellKey)
          if (targetFormulaCell) {
            if (dirtyFormulaKeys && !dirtyFormulaKeys.has(targetCellKey) && !cache.has(targetCellKey)) {
              return getResolvedCellValue(rows[targetRowIndex], columnKey)
            }
            return evaluateFormulaCell(targetFormulaCell, dirtyFormulaKeys, cache, visiting)
          }
          return getResolvedCellValue(rows[targetRowIndex], columnKey)
        }))
        return isRangeReference
          ? Object.freeze(resolvedValues)
          : (resolvedValues[0] ?? null)
      },
      getContextValue: (key: string) => {
        const tableSource = formulaTablesByContextKey.get(key)
        if (typeof tableSource !== "undefined") {
          return tableSource
        }
        return options.resolveContextValue?.(key)
      },
    }
  }

  function createFormulaDiagnosticError(
    analysis: DataGridSpreadsheetCellInputAnalysis,
  ): DataGridFormulaErrorValue {
    const firstDiagnostic = analysis.diagnostics[0]
    return createFormulaErrorValue({
      code: "EVAL_ERROR",
      message: firstDiagnostic?.message ?? "Invalid spreadsheet formula.",
    })
  }

  function evaluateFormulaCell(
    formulaCell: SpreadsheetFormulaCellState,
    dirtyFormulaKeys: ReadonlySet<string> | null,
    cache: Map<string, DataGridFormulaValue>,
    visiting: Set<string>,
  ): DataGridFormulaValue {
    const cached = cache.get(formulaCell.key)
    if (typeof cached !== "undefined") {
      return cached
    }
    if (!formulaCell.analysis.isFormulaValid || !formulaCell.compiled) {
      const errorValue = createFormulaDiagnosticError(formulaCell.analysis)
      cache.set(formulaCell.key, errorValue)
      return errorValue
    }
    if (visiting.has(formulaCell.key)) {
      const errorValue = createFormulaErrorValue({
        code: "EVAL_ERROR",
        message: `Circular spreadsheet formula dependency at row ${formulaCell.address.rowIndex + 1}, column '${formulaCell.address.columnKey}'.`,
      })
      cache.set(formulaCell.key, errorValue)
      return errorValue
    }
    visiting.add(formulaCell.key)
    const nextValue = formulaCell.compiled.compute(
      createFormulaContext(formulaCell, dirtyFormulaKeys, cache, visiting),
    )
    visiting.delete(formulaCell.key)
    cache.set(formulaCell.key, nextValue)
    return nextValue
  }

  function applyFormulaEvaluation(
    dirtyFormulaKeys: ReadonlySet<string> | null,
  ): boolean {
    if (formulaCellByKey.size === 0) {
      return false
    }
    const cache = new Map<string, DataGridFormulaValue>()
    const visiting = new Set<string>()
    let changed = false
    for (const formulaCell of formulaCellByKey.values()) {
      if (dirtyFormulaKeys && !dirtyFormulaKeys.has(formulaCell.key)) {
        continue
      }
      const nextValue = evaluateFormulaCell(formulaCell, dirtyFormulaKeys, cache, visiting)
      if (setResolvedCellValue(formulaCell.key, nextValue)) {
        changed = true
      }
    }
    return changed
  }

  function collectDependentFormulaClosure(
    seedCellKeys: ReadonlySet<string>,
  ): ReadonlySet<string> {
    const visited = new Set<string>()
    const queue = [...seedCellKeys]
    while (queue.length > 0) {
      const current = queue.shift()
      if (!current || visited.has(current)) {
        continue
      }
      visited.add(current)
      const directDependents = dependentsByCellKey.get(current)
      if (!directDependents) {
        continue
      }
      for (const dependent of directDependents) {
        if (!visited.has(dependent)) {
          queue.push(dependent)
        }
      }
    }
    const dirtyFormulaKeys = new Set<string>()
    for (const cellKey of visited) {
      if (formulaCellByKey.has(cellKey)) {
        dirtyFormulaKeys.add(cellKey)
      }
    }
    return dirtyFormulaKeys
  }

  function recomputeAfterInputChange(
    seedCellKeys: ReadonlySet<string>,
    formulaStructureDirty: boolean,
  ): { changed: boolean; baseValuesChanged: boolean } {
    if (formulaStructureDirty) {
      const baseValuesChanged = rebuildFormulaState()
      return {
        changed: applyFormulaEvaluation(null),
        baseValuesChanged,
      }
    }
    if (seedCellKeys.size === 0) {
      return {
        changed: false,
        baseValuesChanged: false,
      }
    }
    return {
      changed: applyFormulaEvaluation(collectDependentFormulaClosure(seedCellKeys)),
      baseValuesChanged: false,
    }
  }

  function updateCellAnalysis(
    cellKey: string,
    rowIndex: number,
    rawInput: string,
  ): DataGridSpreadsheetCellInputAnalysis {
    const analysis = analyzeCellInput(rawInput, rowIndex)
    if (analysis.kind !== "formula") {
      analysisByCellKey.delete(cellKey)
    } else {
      analysisByCellKey.set(cellKey, analysis)
    }
    return analysis
  }

  function setCellInputs(
    patches: readonly DataGridSpreadsheetCellInputPatch[],
  ): boolean {
    ensureActive()
    if (!Array.isArray(patches) || patches.length === 0) {
      return false
    }

    let rawChanged = false
    let formulaStructureDirty = false
    const seedCellKeys = new Set<string>()

    for (const patch of patches) {
      const cellKey = resolveCellKey(patch.cell)
      const address = resolveAddressFromCellKey(cellKey)
      if (!address) {
        continue
      }
      const previousRawInput = getRawInput(cellKey)
      const nextRawInput = normalizeCellRawInput(patch.rawInput)
      if (previousRawInput === nextRawInput) {
        continue
      }

      rawChanged = true
      const previousAnalysis = getAnalysis(cellKey, address.rowIndex)
      const nextAnalysis = updateCellAnalysis(cellKey, address.rowIndex, nextRawInput)

      if (!shouldRetainRawInput(nextRawInput)) {
        deleteStoredRawInput(address.rowIndex, address.columnKey)
      } else {
        setStoredRawInput(address.rowIndex, address.columnKey, nextRawInput)
      }

      if (previousAnalysis.kind === "formula" || nextAnalysis.kind === "formula") {
        formulaStructureDirty = true
        if (nextAnalysis.kind !== "formula") {
          setResolvedCellValue(cellKey, parsePlainCellDisplayValue(nextRawInput))
        }
      } else {
        const previousValue = getResolvedCellValue(rows[address.rowIndex], address.columnKey)
        const nextValue = parsePlainCellDisplayValue(nextRawInput)
        if (!Object.is(previousValue, nextValue)) {
          setResolvedCellValue(cellKey, nextValue)
          seedCellKeys.add(cellKey)
        }
      }
    }

    if (!rawChanged) {
      return false
    }

    if (formulaStructureDirty) {
      formulaStructureRevision += 1
      const result = recomputeAfterInputChange(seedCellKeys, true)
      if (result.changed || result.baseValuesChanged) {
        valueRevision += 1
      }
    } else if (recomputeAfterInputChange(seedCellKeys, false).changed) {
      valueRevision += 1
    }

    revision += 1
    emit()
    return true
  }

  function applyFormulaStructuralPatches(
    patches: readonly DataGridSpreadsheetFormulaStructuralPatch[],
  ): boolean {
    ensureActive()
    if (!Array.isArray(patches) || patches.length === 0) {
      return false
    }

    let changed = false
    const seedFormulaKeys = new Set<string>()

    for (const patch of patches) {
      const cellKey = resolveCellKey(patch.cell)
      const address = resolveAddressFromCellKey(cellKey)
      if (!address) {
        continue
      }

      const nextRawInput = renderDataGridSpreadsheetCellFormulaRuntimeModel(
        patch.formulaRuntime,
        patch.formulaModel,
        {
          currentRowIndex: address.rowIndex,
          referenceParserOptions,
        },
      )
      const previousRawInput = getRawInput(cellKey)
      if (previousRawInput === nextRawInput) {
        continue
      }

      const nextAnalysis = analyzeCellInput(nextRawInput, address.rowIndex)
      if (nextAnalysis.kind !== "formula") {
        continue
      }
      const nextFormulaModel = createDataGridSpreadsheetCellFormulaModel(nextAnalysis, {
        referenceParserOptions,
      })
      const nextFormulaRuntime = createDataGridSpreadsheetCellFormulaRuntimeModel(nextAnalysis)
      if (!nextFormulaModel || !nextFormulaRuntime) {
        continue
      }

      changed = true
      if (shouldRetainRawInput(nextRawInput)) {
        setStoredRawInput(address.rowIndex, address.columnKey, nextRawInput)
      } else {
        deleteStoredRawInput(address.rowIndex, address.columnKey)
      }

      const previousFormulaCell = formulaCellByKey.get(cellKey)
      if (previousFormulaCell) {
        for (const dependencyKey of previousFormulaCell.dependencyKeys) {
          deleteDependentLink(dependencyKey, previousFormulaCell.key)
        }
      }

      analysisByCellKey.set(cellKey, nextAnalysis)

      const nextFormulaCell = createFormulaCellState(
        cellKey,
        address,
        nextAnalysis,
        nextFormulaModel,
        nextFormulaRuntime,
        null,
      )
      formulaCellByKey.set(cellKey, nextFormulaCell)
      for (const dependencyKey of nextFormulaCell.dependencyKeys) {
        setDependentLinkInMap(dependentsByCellKey, dependencyKey, nextFormulaCell.key)
      }
      seedFormulaKeys.add(cellKey)
    }

    if (!changed) {
      return false
    }

    formulaStructureRevision += 1
    const dirtyFormulaKeys = collectDependentFormulaClosure(seedFormulaKeys)
    if (applyFormulaEvaluation(dirtyFormulaKeys)) {
      valueRevision += 1
    }
    revision += 1
    emit()
    return true
  }

  function setCellStyles(
    patches: readonly DataGridSpreadsheetCellStylePatch[],
  ): boolean {
    ensureActive()
    if (!Array.isArray(patches) || patches.length === 0) {
      return false
    }
    let changed = false
    for (const patch of patches) {
      const cellKey = resolveCellKey(patch.cell)
      const address = resolveAddressFromCellKey(cellKey)
      if (!address) {
        continue
      }
      const nextStyle = normalizeSpreadsheetStyle(patch.style)
      const previousStyle = getCellOwnStyle(cellKey)
      if (areSpreadsheetStylesEqual(previousStyle, nextStyle)) {
        continue
      }
      changed = true
      if (nextStyle) {
        setStoredCellStyle(address.rowIndex, address.columnKey, nextStyle)
      } else {
        deleteStoredCellStyle(address.rowIndex, address.columnKey)
      }
    }
    if (!changed) {
      return false
    }
    styleRevision += 1
    revision += 1
    emit()
    return true
  }

  function patchFormulaTables(
    patch: DataGridSpreadsheetFormulaTablePatch,
  ): boolean {
    ensureActive()
    let changed = false
    const dirtyContextKeys = new Set<string>()

    for (const binding of patch.set ?? []) {
      const contextKey = resolveFormulaTableContextKey(binding.name)
      if (formulaTablesByContextKey.get(contextKey) === binding.source) {
        continue
      }
      formulaTablesByContextKey.set(contextKey, binding.source)
      dirtyContextKeys.add(contextKey)
      changed = true
    }

    for (const name of patch.remove ?? []) {
      const contextKey = resolveFormulaTableContextKey(name)
      if (!formulaTablesByContextKey.delete(contextKey)) {
        continue
      }
      dirtyContextKeys.add(contextKey)
      changed = true
    }

    if (!changed) {
      return false
    }

    const seedFormulaKeys = new Set<string>()
    for (const formulaCell of formulaCellByKey.values()) {
      if (formulaCell.contextKeys.includes("tables")) {
        seedFormulaKeys.add(formulaCell.key)
        continue
      }
      if (formulaCell.contextKeys.some(contextKey => dirtyContextKeys.has(contextKey))) {
        seedFormulaKeys.add(formulaCell.key)
      }
    }

    const dirtyFormulaKeys = collectDependentFormulaClosure(seedFormulaKeys)
    if (applyFormulaEvaluation(dirtyFormulaKeys)) {
      valueRevision += 1
    }
    revision += 1
    emit()
    return true
  }

  function rewriteFormulaRuntimeForInsertedRows(
    runtimeModel: DataGridSpreadsheetCellFormulaRuntimeModel,
    presentationModel: DataGridSpreadsheetCellFormulaModel,
    rowIndex: number,
    insertIndex: number,
    insertedRowCount: number,
  ): string {
    const nextRuntimeModel = mapDataGridSpreadsheetCellFormulaRuntimeModelBindings(runtimeModel, binding => {
      if (binding.kind !== "reference") {
        return null
      }
      const reference = binding
      if (!isCurrentSheetReference(reference.sheetReference)) {
        return null
      }
      if (reference.rowSelector.kind === "absolute") {
        if (reference.rowSelector.rowIndex < insertIndex) {
          return null
        }
        return {
          sheetReference: reference.sheetReference,
          referenceName: reference.referenceName,
          rangeReferenceName: reference.rangeReferenceName,
          rowSelector: {
            kind: "absolute",
            rowIndex: reference.rowSelector.rowIndex + insertedRowCount,
          },
        }
      }
      if (reference.rowSelector.kind !== "absolute-window") {
        return null
      }
      if (reference.rowSelector.endRowIndex < insertIndex) {
        return null
      }
      const shiftWholeRange = reference.rowSelector.startRowIndex >= insertIndex
      return {
        sheetReference: reference.sheetReference,
        referenceName: reference.referenceName,
        rangeReferenceName: reference.rangeReferenceName,
        rowSelector: {
          kind: "absolute-window",
          startRowIndex: shiftWholeRange
            ? reference.rowSelector.startRowIndex + insertedRowCount
            : reference.rowSelector.startRowIndex,
          endRowIndex: reference.rowSelector.endRowIndex + insertedRowCount,
        },
      }
    }, {
      currentRowIndex: rowIndex,
    })
    return renderDataGridSpreadsheetCellFormulaRuntimeModel(nextRuntimeModel, presentationModel, {
      currentRowIndex: rowIndex,
      referenceParserOptions,
    })
  }

  function rewriteFormulaRuntimeForRemovedRows(
    runtimeModel: DataGridSpreadsheetCellFormulaRuntimeModel,
    presentationModel: DataGridSpreadsheetCellFormulaModel,
    rowIndex: number,
    removeIndex: number,
    removedRowCount: number,
  ): string {
    const nextRuntimeModel = mapDataGridSpreadsheetCellFormulaRuntimeModelBindings(runtimeModel, binding => {
      if (binding.kind !== "reference") {
        return null
      }
      const reference = binding
      if (!isCurrentSheetReference(reference.sheetReference)) {
        return null
      }
      if (reference.rowSelector.kind === "absolute") {
        if (reference.rowSelector.rowIndex < removeIndex) {
          return null
        }
        if (reference.rowSelector.rowIndex >= removeIndex + removedRowCount) {
          return {
            sheetReference: reference.sheetReference,
            referenceName: reference.referenceName,
            rangeReferenceName: reference.rangeReferenceName,
            rowSelector: {
              kind: "absolute",
              rowIndex: reference.rowSelector.rowIndex - removedRowCount,
            },
          }
        }
        return {
          kind: "invalid",
        }
      }
      if (reference.rowSelector.kind !== "absolute-window") {
        return null
      }
      const survivingIndexes: number[] = []
      for (
        let targetRowIndex = reference.rowSelector.startRowIndex;
        targetRowIndex <= reference.rowSelector.endRowIndex;
        targetRowIndex += 1
      ) {
        if (targetRowIndex < removeIndex) {
          survivingIndexes.push(targetRowIndex)
          continue
        }
        if (targetRowIndex >= removeIndex + removedRowCount) {
          survivingIndexes.push(targetRowIndex - removedRowCount)
        }
      }
      if (survivingIndexes.length === 0) {
        return {
          kind: "invalid",
        }
      }
      if (survivingIndexes.length === 1) {
        return {
          sheetReference: reference.sheetReference,
          referenceName: reference.referenceName,
          rangeReferenceName: reference.rangeReferenceName,
          rowSelector: {
            kind: "absolute",
            rowIndex: survivingIndexes[0]!,
          },
        }
      }
      return {
        sheetReference: reference.sheetReference,
        referenceName: reference.referenceName,
        rangeReferenceName: reference.rangeReferenceName,
        rowSelector: {
          kind: "absolute-window",
          startRowIndex: survivingIndexes[0]!,
          endRowIndex: survivingIndexes[survivingIndexes.length - 1]!,
        },
      }
    }, {
      currentRowIndex: rowIndex,
    })
    return renderDataGridSpreadsheetCellFormulaRuntimeModel(nextRuntimeModel, presentationModel, {
      currentRowIndex: rowIndex,
      referenceParserOptions,
    })
  }

  function hasCurrentSheetAbsoluteReferencesAtOrAfter(
    runtimeModel: DataGridSpreadsheetCellFormulaRuntimeModel,
    rowIndex: number,
  ): boolean {
    return runtimeModel.bindings.some(binding => (
      binding.kind === "reference"
      && isCurrentSheetReference(binding.sheetReference)
      && (
        (binding.rowSelector.kind === "absolute" && binding.rowSelector.rowIndex >= rowIndex)
        || (binding.rowSelector.kind === "absolute-window" && binding.rowSelector.endRowIndex >= rowIndex)
      )
    ))
  }

  function insertRowsAt(
    index: number,
    nextRows: readonly DataGridSpreadsheetRowInput[] = [{}],
  ): boolean {
    ensureActive()
    const normalizedIndex = Math.max(0, Math.min(rows.length, Math.trunc(index)))
    if (!Array.isArray(nextRows) || nextRows.length === 0) {
      return false
    }

    const previousFormulaCells = [...formulaCellByKey.values()]
    const previousFormulaModels = new Map(previousFormulaCells.map(cell => [cell.key, cell.formulaModel]))
    const previousFormulaRuntimeModels = new Map(previousFormulaCells.map(cell => [cell.key, cell.formulaRuntime]))
    const previousFormulaValues = new Map(previousFormulaCells.map(cell => [
      cell.key,
      getResolvedCellValue(rows[cell.address.rowIndex], cell.address.columnKey),
    ]))
    const reservedRowIds = new Set<DataGridRowId>(rows.map(row => row.id))
    const insertedRowStates = nextRows.map((rowInput, offset) => {
      const rowState = createSpreadsheetRowState(rowInput, normalizedIndex + offset, reservedRowIds)
      reservedRowIds.add(rowState.id)
      return rowState
    })

    rows.splice(normalizedIndex, 0, ...insertedRowStates)
    rawInputByRowIndex.splice(normalizedIndex, 0, ...insertedRowStates.map(() => new Map()))
    cellStyleByRowIndex.splice(normalizedIndex, 0, ...insertedRowStates.map(() => new Map()))
    rebuildRowIndexState()

    for (const previousFormulaCell of previousFormulaCells) {
      const previousRowIndex = previousFormulaCell.address.rowIndex
      const nextRowIndex = previousRowIndex >= normalizedIndex
        ? previousRowIndex + insertedRowStates.length
        : previousRowIndex
      const formulaModel = previousFormulaModels.get(previousFormulaCell.key)
        ?? createDataGridSpreadsheetCellFormulaModel(previousFormulaCell.analysis, {
          referenceParserOptions,
        })!
      const formulaRuntime = previousFormulaRuntimeModels.get(previousFormulaCell.key)
        ?? createDataGridSpreadsheetCellFormulaRuntimeModel(previousFormulaCell.analysis)
      if (!formulaRuntime || !hasCurrentSheetAbsoluteReferencesAtOrAfter(formulaRuntime, normalizedIndex)) {
        continue
      }
      const rewrittenRawInput = rewriteFormulaRuntimeForInsertedRows(
        formulaRuntime,
        formulaModel,
        nextRowIndex,
        normalizedIndex,
        insertedRowStates.length,
      )
      if (shouldRetainRawInput(rewrittenRawInput)) {
        setStoredRawInput(nextRowIndex, previousFormulaCell.address.columnKey, rewrittenRawInput)
      } else {
        deleteStoredRawInput(nextRowIndex, previousFormulaCell.address.columnKey)
      }
    }

    for (let offset = 0; offset < insertedRowStates.length; offset += 1) {
      const rowInput = nextRows[offset]
      const row = insertedRowStates[offset]
      if (!rowInput?.cells || !row) {
        continue
      }
      for (const [columnKeyInput, cellValue] of Object.entries(rowInput.cells)) {
        const columnKey = normalizeColumnKey(columnKeyInput)
        if (!columnIndexByKey.has(columnKey)) {
          continue
        }
        const rawInput = normalizeCellRawInput(cellValue)
        if (rawInput.trim().length === 0) {
          continue
        }
        if (shouldRetainRawInput(rawInput)) {
          setStoredRawInput(row.rowIndex, columnKey, rawInput)
        } else {
          syncNonRetainedRawInputToResolvedValue(row.rowIndex, columnKey, rawInput)
        }
      }
    }

    formulaStructureRevision += 1
    rowMutationRevision += 1
    lastRowMutation = {
      revision: rowMutationRevision,
      kind: "insert",
      index: normalizedIndex,
      count: insertedRowStates.length,
    }
    revision += 1
    const rebuildResult = rebuildFormulaStateAfterRowMutation({
      kind: "insert",
      index: normalizedIndex,
      count: insertedRowStates.length,
      insertedRows: nextRows,
    }, previousFormulaCells, previousFormulaModels, previousFormulaRuntimeModels, previousFormulaValues)
    const dirtyFormulaKeys = rebuildResult.dirtyFormulaKeys.size > 0
      ? collectDependentFormulaClosure(rebuildResult.dirtyFormulaKeys)
      : null
    const formulaValuesChanged = applyFormulaEvaluation(dirtyFormulaKeys)
    if (rebuildResult.baseValuesChanged || formulaValuesChanged) {
      valueRevision += 1
    }
    emit()
    return true
  }

  function removeRowsAt(
    index: number,
    count = 1,
  ): boolean {
    ensureActive()
    const normalizedIndex = Math.max(0, Math.min(rows.length, Math.trunc(index)))
    const normalizedCount = Math.max(0, Math.trunc(count))
    if (normalizedCount === 0 || normalizedIndex >= rows.length) {
      return false
    }
    const removedRowCount = Math.min(normalizedCount, rows.length - normalizedIndex)
    if (removedRowCount === 0) {
      return false
    }

    const previousFormulaCells = [...formulaCellByKey.values()]
    const previousFormulaModels = new Map(previousFormulaCells.map(cell => [cell.key, cell.formulaModel]))
    const previousFormulaRuntimeModels = new Map(previousFormulaCells.map(cell => [cell.key, cell.formulaRuntime]))
    const previousFormulaValues = new Map(previousFormulaCells.map(cell => [
      cell.key,
      getResolvedCellValue(rows[cell.address.rowIndex], cell.address.columnKey),
    ]))

    rows.splice(normalizedIndex, removedRowCount)
    rawInputByRowIndex.splice(normalizedIndex, removedRowCount)
    cellStyleByRowIndex.splice(normalizedIndex, removedRowCount)
    rebuildRowIndexState()

    for (const previousFormulaCell of previousFormulaCells) {
      const previousRowIndex = previousFormulaCell.address.rowIndex
      if (previousRowIndex >= normalizedIndex && previousRowIndex < normalizedIndex + removedRowCount) {
        continue
      }
      const nextRowIndex = previousRowIndex >= normalizedIndex + removedRowCount
        ? previousRowIndex - removedRowCount
        : previousRowIndex
      const formulaModel = previousFormulaModels.get(previousFormulaCell.key)
        ?? createDataGridSpreadsheetCellFormulaModel(previousFormulaCell.analysis, {
          referenceParserOptions,
        })!
      const formulaRuntime = previousFormulaRuntimeModels.get(previousFormulaCell.key)
        ?? createDataGridSpreadsheetCellFormulaRuntimeModel(previousFormulaCell.analysis)
      if (!formulaRuntime || !hasCurrentSheetAbsoluteReferencesAtOrAfter(formulaRuntime, normalizedIndex)) {
        continue
      }
      const rewrittenRawInput = rewriteFormulaRuntimeForRemovedRows(
        formulaRuntime,
        formulaModel,
        nextRowIndex,
        normalizedIndex,
        removedRowCount,
      )
      if (shouldRetainRawInput(rewrittenRawInput)) {
        setStoredRawInput(nextRowIndex, previousFormulaCell.address.columnKey, rewrittenRawInput)
      } else {
        deleteStoredRawInput(nextRowIndex, previousFormulaCell.address.columnKey)
      }
    }

    formulaStructureRevision += 1
    rowMutationRevision += 1
    lastRowMutation = {
      revision: rowMutationRevision,
      kind: "remove",
      index: normalizedIndex,
      count: removedRowCount,
    }
    revision += 1
    const rebuildResult = rebuildFormulaStateAfterRowMutation({
      kind: "remove",
      index: normalizedIndex,
      count: removedRowCount,
    }, previousFormulaCells, previousFormulaModels, previousFormulaRuntimeModels, previousFormulaValues)
    const dirtyFormulaKeys = rebuildResult.dirtyFormulaKeys.size > 0
      ? collectDependentFormulaClosure(rebuildResult.dirtyFormulaKeys)
      : null
    const formulaValuesChanged = applyFormulaEvaluation(dirtyFormulaKeys)
    if (rebuildResult.baseValuesChanged || formulaValuesChanged) {
      valueRevision += 1
    }
    emit()
    return true
  }

  const initialBaseValuesChanged = rebuildFormulaState()
  const initialFormulaValuesChanged = applyFormulaEvaluation(null)
  if (initialBaseValuesChanged || initialFormulaValuesChanged) {
    valueRevision += 1
    revision += 1
  }

  function readCellSnapshot(cellKey: string): DataGridSpreadsheetCellSnapshot | null {
    const address = resolveAddressFromCellKey(cellKey)
    if (!address) {
      return null
    }
    const row = rows[address.rowIndex]
    if (!row) {
      return null
    }
    const analysis = buildRuntimeAnalysis(getAnalysis(cellKey, address.rowIndex))
    const formulaCell = formulaCellByKey.get(cellKey)
    const displayValue = getResolvedCellValue(row, address.columnKey)
    const errorValue = isFormulaErrorValue(displayValue)
      ? displayValue
      : (formulaCell && formulaCell.analysis.diagnostics.length > 0
        ? createFormulaDiagnosticError(formulaCell.analysis)
        : null)
    return {
      address,
      rawInput: getRawInput(cellKey),
      inputKind: analysis.kind,
      formula: analysis.formula,
      displayValue,
      errorValue,
      analysis,
      dependencies: formulaCell?.dependencies ?? EMPTY_DEPENDENCIES,
      ownStyle: getCellOwnStyle(cellKey),
      style: getResolvedCellStyle(cellKey),
    }
  }

  return {
    getSnapshot,
    getSheetId() {
      return sheetId
    },
    getSheetName() {
      return sheetName
    },
    getColumns() {
      return Object.freeze(columns.map(column => ({
        key: column.key,
        title: column.title,
        style: column.style,
      })))
    },
    getRowCount() {
      return rows.length
    },
    getRows() {
      return Object.freeze(rows.map(row => ({
        id: row.id,
        rowIndex: row.rowIndex,
        style: row.style,
      })))
    },
    exportState() {
      ensureActive()
      return {
        sheetId,
        sheetName,
        columns: Object.freeze(columns.map(column => ({
          key: column.key,
          title: column.title,
          style: column.style,
        }))),
        rows: Object.freeze(rows.map(row => {
          const cells: DataGridSpreadsheetSheetStateCell[] = []
          for (const column of columns) {
            const cellKey = makeCellKey(row.rowIndex, column.key)
            const rawInput = getRawInput(cellKey)
            const style = getCellOwnStyle(cellKey)
            if (rawInput.length === 0 && style == null) {
              continue
            }
            cells.push({
              columnKey: column.key,
              rawInput,
              style,
            })
          }
          return Object.freeze({
            id: row.id,
            style: row.style,
            cells: Object.freeze(cells),
          })
        })),
        sheetStyle,
        formulaTables: Object.freeze(
          [...formulaTablesByContextKey.entries()]
            .map(([contextKey, source]) => ({
              name: resolveFormulaTableBindingName(contextKey),
              source,
            }))
            .sort((left, right) => left.name.localeCompare(right.name)),
        ),
        functionRegistry,
        referenceParserOptions,
        runtimeErrorPolicy,
        resolveContextValue: options.resolveContextValue,
      }
    },
    restoreState(state) {
      ensureActive()
      if (isTypedPlainSpreadsheetSheetState(state)) {
        const nextColumns = (state.columns ?? []).map(column => ({
          key: normalizeColumnKey(column.key),
          title: normalizeColumnTitle(column.title, column.key),
          style: normalizeSpreadsheetStyle(column.style),
        }))

        if (nextColumns.length === 0) {
          throw new Error("[DataGridSpreadsheetSheet] columns must be non-empty.")
        }

        columns.length = 0
        columnIndexByKey.clear()
        for (const column of nextColumns) {
          if (columnIndexByKey.has(column.key)) {
            throw new Error(`[DataGridSpreadsheetSheet] duplicate column key '${column.key}'.`)
          }
          columnIndexByKey.set(column.key, columns.length)
          columns.push({
            key: column.key,
            title: column.title,
            style: column.style,
          })
        }

        rows.length = 0
        rowIndexById.clear()
        const reservedRowIds = new Set<DataGridRowId>()
        for (let rowIndex = 0; rowIndex < state.rows.length; rowIndex += 1) {
          const row = state.rows[rowIndex]
          if (!row) {
            continue
          }
          const rowId = normalizeRowId(row.id, rowIndex)
          if (reservedRowIds.has(rowId)) {
            throw new Error(`[DataGridSpreadsheetSheet] duplicate row id '${String(rowId)}'.`)
          }
          reservedRowIds.add(rowId)
          rows.push({
            id: rowId,
            rowIndex,
            style: normalizeSpreadsheetStyle(row.style),
            resolvedValues: createResolvedValues(),
          })
          rowIndexById.set(rowId, rowIndex)
        }
        nextSyntheticRowId = rows.length + 1

        rawInputByRowIndex.length = 0
        cellStyleByRowIndex.length = 0
        for (let rowIndex = 0; rowIndex < state.rows.length; rowIndex += 1) {
          const row = state.rows[rowIndex]
          if (!row) {
            continue
          }
          rawInputByRowIndex.push(new Map())
          cellStyleByRowIndex.push(new Map())
          for (const cell of row.cells ?? []) {
            const columnKey = normalizeColumnKey(cell.columnKey)
            if (!columnIndexByKey.has(columnKey)) {
              continue
            }
            setResolvedCellValueOnRow(rows[rowIndex], columnKey, cell.resolvedValue)
          }
        }

        formulaTablesByContextKey.clear()
        for (const binding of state.formulaTables ?? []) {
          formulaTablesByContextKey.set(resolveFormulaTableContextKey(String(binding.name ?? "")), binding.source)
        }

        sheetStyle = normalizeSpreadsheetStyle(state.sheetStyle)
        analysisByCellKey.clear()
        formulaCellByKey.clear()
        dependentsByCellKey.clear()
        lastRowMutation = null
        formulaStructureRevision += 1
        styleRevision += 1
        valueRevision += 1
        revision += 1
        emit()
        return true
      }

      const nextState: DataGridSpreadsheetSheetState = {
        sheetId,
        sheetName,
        columns: Object.freeze((state.columns ?? []).map(column => ({
          key: normalizeColumnKey(column.key),
          title: normalizeColumnTitle(column.title, column.key),
          style: normalizeSpreadsheetStyle(column.style),
        }))),
        rows: Object.freeze((state.rows ?? []).map((row, rowIndex) => Object.freeze({
          id: normalizeRowId(row.id, rowIndex),
          style: normalizeSpreadsheetStyle(row.style),
          cells: Object.freeze((row.cells ?? [])
            .map(cell => ({
              columnKey: normalizeColumnKey(cell.columnKey),
              rawInput: normalizeCellRawInput(cell.rawInput),
              resolvedValue: cell.resolvedValue,
              style: normalizeSpreadsheetStyle(cell.style),
            }))
            .filter(cell => (
              cell.rawInput.length > 0
              || typeof cell.resolvedValue !== "undefined"
              || cell.style != null
            ))),
        }))),
        sheetStyle: normalizeSpreadsheetStyle(state.sheetStyle),
        formulaTables: Object.freeze((state.formulaTables ?? []).map(binding => ({
          name: String(binding.name ?? ""),
          source: binding.source,
        }))),
        functionRegistry,
        referenceParserOptions,
        runtimeErrorPolicy,
        resolveContextValue: options.resolveContextValue,
      }

      if (nextState.columns.length === 0) {
        throw new Error("[DataGridSpreadsheetSheet] columns must be non-empty.")
      }

      if (!isTypedPlainSpreadsheetSheetState(nextState)) {
        const currentState = this.exportState()
        if (areSpreadsheetSheetStatesEquivalent(currentState, nextState)) {
          return false
        }
      }

      columns.length = 0
      columnIndexByKey.clear()
      for (const column of nextState.columns) {
        if (columnIndexByKey.has(column.key)) {
          throw new Error(`[DataGridSpreadsheetSheet] duplicate column key '${column.key}'.`)
        }
        columnIndexByKey.set(column.key, columns.length)
        columns.push({
          key: column.key,
          title: column.title,
          style: column.style,
        })
      }

      rows.length = 0
      rowIndexById.clear()
      const reservedRowIds = new Set<DataGridRowId>()
      for (let rowIndex = 0; rowIndex < nextState.rows.length; rowIndex += 1) {
        const row = nextState.rows[rowIndex]
        if (!row) {
          continue
        }
        if (reservedRowIds.has(row.id)) {
          throw new Error(`[DataGridSpreadsheetSheet] duplicate row id '${String(row.id)}'.`)
        }
        reservedRowIds.add(row.id)
        rows.push({
          id: row.id,
          rowIndex,
          style: row.style,
          resolvedValues: createResolvedValues(),
        })
        rowIndexById.set(row.id, rowIndex)
      }
      nextSyntheticRowId = rows.length + 1

      rawInputByRowIndex.length = 0
      cellStyleByRowIndex.length = 0
      for (let rowIndex = 0; rowIndex < nextState.rows.length; rowIndex += 1) {
        const row = nextState.rows[rowIndex]
        if (!row) {
          continue
        }
        rawInputByRowIndex.push(new Map())
        cellStyleByRowIndex.push(new Map())
        for (const cell of row.cells) {
          if (!columnIndexByKey.has(cell.columnKey)) {
            continue
          }
          if (shouldRetainRawInput(cell.rawInput)) {
            setStoredRawInput(rowIndex, cell.columnKey, cell.rawInput)
          } else if (typeof cell.resolvedValue !== "undefined") {
            setResolvedCellValueOnRow(rows[rowIndex], cell.columnKey, cell.resolvedValue)
          } else {
            syncNonRetainedRawInputToResolvedValue(rowIndex, cell.columnKey, cell.rawInput)
          }
          if (cell.style != null) {
            setStoredCellStyle(rowIndex, cell.columnKey, cell.style)
          }
        }
      }

      formulaTablesByContextKey.clear()
      for (const binding of nextState.formulaTables) {
        formulaTablesByContextKey.set(resolveFormulaTableContextKey(binding.name), binding.source)
      }

      sheetStyle = nextState.sheetStyle
      analysisByCellKey.clear()
      formulaCellByKey.clear()
      dependentsByCellKey.clear()
      lastRowMutation = null
      formulaStructureRevision += 1
      styleRevision += 1
      revision += 1
      const baseValuesChanged = rebuildFormulaState()
      const formulaValuesChanged = applyFormulaEvaluation(null)
      if (baseValuesChanged || formulaValuesChanged) {
        valueRevision += 1
      }
      emit()
      return true
    },
    getCell(cell) {
      return readCellSnapshot(resolveCellKey(cell))
    },
    getCellById(rowId, columnKey) {
      const rowIndex = rowIndexById.get(rowId)
      if (typeof rowIndex !== "number") {
        return null
      }
      return readCellSnapshot(resolveCellKey({
        sheetId,
        rowId,
        rowIndex,
        columnKey,
      }))
    },
    getCellDisplayValue(cell) {
      const cellKey = resolveCellKey(cell)
      const address = resolveAddressFromCellKey(cellKey)
      if (!address) {
        return null
      }
      return getResolvedCellValue(rows[address.rowIndex], address.columnKey)
    },
    getFormulaCells() {
      return Object.freeze(
        [...formulaCellByKey.values()]
          .map((formulaCell) => {
            return {
              address: cloneCellAddress(formulaCell.address),
              formula: formulaCell.formulaModel.formula ?? formulaCell.analysis.formula ?? "",
              contextKeys: formulaCell.contextKeys,
              dependencies: formulaCell.dependencies,
            }
          })
          .sort((left, right) => compareCellAddresses(left.address, right.address)),
      )
    },
    getFormulaStructuralCells() {
      return Object.freeze(
        [...formulaCellByKey.values()]
          .map(createFormulaStructuralCellSnapshot)
          .sort((left, right) => compareCellAddresses(left.address, right.address)),
      )
    },
    getFormulaStructuralCellsBySheetAliases(sheetAliases) {
      if (!Array.isArray(sheetAliases) || sheetAliases.length === 0 || formulaCellByKey.size === 0) {
        return Object.freeze([])
      }

      const structuralIndex = resolveFormulaStructuralReferenceIndex()
      const candidateCellKeys = new Set<string>()
      for (const sheetAlias of sheetAliases) {
        const normalizedAlias = normalizeSpreadsheetSheetReferenceAlias(sheetAlias)
        if (normalizedAlias.length === 0) {
          continue
        }
        for (const cellKey of structuralIndex.get(normalizedAlias) ?? []) {
          candidateCellKeys.add(cellKey)
        }
      }

      if (candidateCellKeys.size === 0) {
        return Object.freeze([])
      }

      return Object.freeze(
        [...candidateCellKeys]
          .map(cellKey => formulaCellByKey.get(cellKey))
          .filter((formulaCell): formulaCell is SpreadsheetFormulaCellState => formulaCell != null)
          .map(createFormulaStructuralCellSnapshot)
          .sort((left, right) => compareCellAddresses(left.address, right.address)),
      )
    },
    getTableSource() {
      return tableSource
    },
    getTableSourceRevision() {
      return valueRevision
    },
    recompute() {
      ensureActive()
      if (!applyFormulaEvaluation(null)) {
        return false
      }
      valueRevision += 1
      revision += 1
      emit()
      return true
    },
    setCellInput(cell, rawInput) {
      return setCellInputs([{ cell, rawInput }])
    },
    setCellInputs,
    applyFormulaStructuralPatches,
    clearCell(cell) {
      return setCellInputs([{ cell, rawInput: "" }])
    },
    insertRowsAt,
    removeRowsAt,
    insertRowsBefore(rowId, nextRows = [{}]) {
      ensureActive()
      const rowIndex = rowIndexById.get(rowId)
      if (typeof rowIndex !== "number") {
        throw new Error(`[DataGridSpreadsheetSheet] unknown row '${String(rowId)}'.`)
      }
      return insertRowsAt(rowIndex, nextRows)
    },
    insertRowsAfter(rowId, nextRows = [{}]) {
      ensureActive()
      const rowIndex = rowIndexById.get(rowId)
      if (typeof rowIndex !== "number") {
        throw new Error(`[DataGridSpreadsheetSheet] unknown row '${String(rowId)}'.`)
      }
      return insertRowsAt(rowIndex + 1, nextRows)
    },
    setSheetStyle(style) {
      ensureActive()
      const nextStyle = normalizeSpreadsheetStyle(style)
      if (areSpreadsheetStylesEqual(sheetStyle, nextStyle)) {
        return false
      }
      sheetStyle = nextStyle
      styleRevision += 1
      revision += 1
      emit()
      return true
    },
    setColumnStyle(columnKey, style) {
      ensureActive()
      const normalizedColumnKey = normalizeColumnKey(columnKey)
      const columnIndex = columnIndexByKey.get(normalizedColumnKey)
      if (typeof columnIndex !== "number") {
        throw new Error(`[DataGridSpreadsheetSheet] unknown column '${normalizedColumnKey}'.`)
      }
      const column = columns[columnIndex]
      if (!column) {
        throw new Error(`[DataGridSpreadsheetSheet] unknown column '${normalizedColumnKey}'.`)
      }
      const nextStyle = normalizeSpreadsheetStyle(style)
      if (areSpreadsheetStylesEqual(column.style, nextStyle)) {
        return false
      }
      column.style = nextStyle
      styleRevision += 1
      revision += 1
      emit()
      return true
    },
    setRowStyle(rowId, style) {
      ensureActive()
      const rowIndex = rowIndexById.get(rowId)
      if (typeof rowIndex !== "number") {
        throw new Error(`[DataGridSpreadsheetSheet] unknown row '${String(rowId)}'.`)
      }
      const row = rows[rowIndex]
      if (!row) {
        throw new Error(`[DataGridSpreadsheetSheet] unknown row '${String(rowId)}'.`)
      }
      const nextStyle = normalizeSpreadsheetStyle(style)
      if (areSpreadsheetStylesEqual(row.style, nextStyle)) {
        return false
      }
      row.style = nextStyle
      styleRevision += 1
      revision += 1
      emit()
      return true
    },
    setCellStyle(cell, style) {
      return setCellStyles([{ cell, style }])
    },
    setCellStyles,
    copyCellStyle(source, targets) {
      ensureActive()
      if (!Array.isArray(targets) || targets.length === 0) {
        return false
      }
      const sourceStyle = getResolvedCellStyle(resolveCellKey(source))
      return setCellStyles(targets.map(cell => ({
        cell,
        style: sourceStyle,
      })))
    },
    setFormulaTable(name, source) {
      return patchFormulaTables({
        set: [{ name, source }],
      })
    },
    patchFormulaTables,
    subscribe(listener) {
      if (disposed) {
        return () => {}
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      listeners.clear()
      rawInputByRowIndex.length = 0
      analysisByCellKey.clear()
      cellStyleByRowIndex.length = 0
      formulaCellByKey.clear()
      dependentsByCellKey.clear()
      formulaTablesByContextKey.clear()
      revision = 0
      valueRevision = 0
      formulaStructureRevision = 0
      styleRevision = 0
    },
  }
}
