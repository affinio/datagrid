import type { DataGridRowId } from "../models/rowModel.js"
import {
  compileDataGridFormulaFieldDefinition,
  createFormulaErrorValue,
  isFormulaErrorValue,
  parseDataGridFormulaIdentifier,
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
  type DataGridSpreadsheetCellAddress,
  type DataGridSpreadsheetCellInputAnalysis,
  type DataGridSpreadsheetCellInputKind,
} from "./formulaEditorModel.js"

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
  resolveContextValue?: (key: string) => unknown
}

export interface DataGridSpreadsheetSheetModel {
  getSnapshot(): DataGridSpreadsheetSheetSnapshot
  getSheetId(): string | null
  getSheetName(): string | null
  getColumns(): readonly DataGridSpreadsheetColumnSnapshot[]
  getRows(): readonly DataGridSpreadsheetRowSnapshot[]
  getCell(cell: DataGridSpreadsheetCellAddress): DataGridSpreadsheetCellSnapshot | null
  getCellById(rowId: DataGridRowId, columnKey: string): DataGridSpreadsheetCellSnapshot | null
  getCellDisplayValue(cell: DataGridSpreadsheetCellAddress): unknown
  getFormulaCells(): readonly DataGridSpreadsheetFormulaCellSnapshot[]
  getTableSource(): DataGridFormulaTableSource
  getTableSourceRevision(): number
  setCellInput(cell: DataGridSpreadsheetCellAddress, rawInput: unknown): boolean
  setCellInputs(patches: readonly DataGridSpreadsheetCellInputPatch[]): boolean
  clearCell(cell: DataGridSpreadsheetCellAddress): boolean
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
  resolvedData: Record<string, unknown>
}

interface SpreadsheetFormulaCellState {
  key: string
  address: DataGridSpreadsheetCellAddress
  analysis: DataGridSpreadsheetCellInputAnalysis
  compiled: DataGridCompiledFormulaField<Record<string, unknown>> | null
  dependencies: readonly DataGridSpreadsheetCellAddress[]
  dependencyKeys: readonly string[]
  contextKeys: readonly string[]
}

const EMPTY_DIAGNOSTICS = Object.freeze([]) as readonly []
const EMPTY_DEPENDENCIES = Object.freeze([]) as readonly DataGridSpreadsheetCellAddress[]

function normalizeSheetIdentity(value: unknown): string | null {
  const normalized = String(value ?? "").trim()
  return normalized.length === 0 ? null : normalized
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

function resolveFormulaTableContextKey(name: string): string {
  const normalized = name.trim().toLowerCase()
  return normalized.length === 0 ? "tables" : `table:${normalized}`
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
  for (let rowIndex = 0; rowIndex < (options.rows?.length ?? 0); rowIndex += 1) {
    const rowInput = options.rows?.[rowIndex] ?? {}
    const rowId = normalizeRowId(rowInput.id, rowIndex)
    if (rowIndexById.has(rowId)) {
      throw new Error(`[DataGridSpreadsheetSheet] duplicate row id '${String(rowId)}'.`)
    }
    rowIndexById.set(rowId, rowIndex)
    const resolvedData = Object.create(null) as Record<string, unknown>
    for (const column of columns) {
      resolvedData[column.key] = null
    }
    rows.push({
      id: rowId,
      rowIndex,
      style: normalizeSpreadsheetStyle(rowInput.style),
      resolvedData,
    })
  }

  const rawInputByCellKey = new Map<string, string>()
  const analysisByCellKey = new Map<string, DataGridSpreadsheetCellInputAnalysis>()
  const cellStyleByCellKey = new Map<string, DataGridSpreadsheetStyle>()
  const formulaCellByKey = new Map<string, SpreadsheetFormulaCellState>()
  const dependentsByCellKey = new Map<string, Set<string>>()
  const formulaTablesByContextKey = new Map<string, DataGridFormulaTableSource>()
  const tableSource = {
    rows,
    resolveRow: (row: unknown) => (row as SpreadsheetRowState).resolvedData,
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
      const cellKey = makeCellKey(rowIndex, columnKey)
      rawInputByCellKey.set(cellKey, rawInput)
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
      const value = rows[formulaCell.address.rowIndex]?.resolvedData[formulaCell.address.columnKey]
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
    }
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

  function getCellOwnStyle(cellKey: string): DataGridSpreadsheetStyle | null {
    return cellStyleByCellKey.get(cellKey) ?? null
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

  function getRawInput(cellKey: string): string {
    return rawInputByCellKey.get(cellKey) ?? ""
  }

  function getAnalysis(cellKey: string, rowIndex: number): DataGridSpreadsheetCellInputAnalysis {
    const cached = analysisByCellKey.get(cellKey)
    if (cached) {
      return cached
    }
    return analyzeDataGridSpreadsheetCellInput(getRawInput(cellKey), {
      currentRowIndex: rowIndex,
      rowCount: rows.length,
      functionRegistry,
      referenceParserOptions,
    })
  }

  function setResolvedCellValue(cellKey: string, value: unknown): boolean {
    const address = resolveAddressFromCellKey(cellKey)
    if (!address) {
      return false
    }
    const row = rows[address.rowIndex]
    if (!row) {
      return false
    }
    const previousValue = row.resolvedData[address.columnKey]
    if (Object.is(previousValue, value)) {
      return false
    }
    row.resolvedData[address.columnKey] = value
    return true
  }

  function refreshAllBaseCellValues(): boolean {
    let changed = false
    for (const row of rows) {
      for (const column of columns) {
        if (!Object.is(row.resolvedData[column.key], null)) {
          row.resolvedData[column.key] = null
          changed = true
        }
      }
    }
    for (const [cellKey, rawInput] of rawInputByCellKey) {
      const address = resolveAddressFromCellKey(cellKey)
      if (!address) {
        continue
      }
      const analysis = analysisByCellKey.get(cellKey) ?? getAnalysis(cellKey, address.rowIndex)
      if (analysis.kind === "formula") {
        if (!Object.is(rows[address.rowIndex]!.resolvedData[address.columnKey], null)) {
          rows[address.rowIndex]!.resolvedData[address.columnKey] = null
          changed = true
        }
        continue
      }
      const nextValue = parsePlainCellDisplayValue(rawInput)
      if (!Object.is(rows[address.rowIndex]!.resolvedData[address.columnKey], nextValue)) {
        rows[address.rowIndex]!.resolvedData[address.columnKey] = nextValue
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
    for (const reference of analysis.references) {
      for (const targetRowIndex of reference.targetRowIndexes) {
        const row = rows[targetRowIndex]
        if (!row) {
          continue
        }
        const dependencyAddress = createCellAddress(sheetId, row, reference.referenceName)
        const dependencyKey = makeCellKey(dependencyAddress.rowIndex, dependencyAddress.columnKey)
        if (seenDependencyKeys.has(dependencyKey)) {
          continue
        }
        seenDependencyKeys.add(dependencyKey)
        dependencies.push(dependencyAddress)
      }
    }
    dependencies.sort(compareCellAddresses)
    return Object.freeze(dependencies)
  }

  function setDependentLink(sourceCellKey: string, dependentCellKey: string): void {
    const dependents = dependentsByCellKey.get(sourceCellKey)
    if (dependents) {
      dependents.add(dependentCellKey)
      return
    }
    dependentsByCellKey.set(sourceCellKey, new Set([dependentCellKey]))
  }

  function rebuildFormulaState(): boolean {
    formulaCellByKey.clear()
    dependentsByCellKey.clear()
    const baseValuesChanged = refreshAllBaseCellValues()

    for (const [cellKey, rawInput] of rawInputByCellKey) {
      const address = resolveAddressFromCellKey(cellKey)
      if (!address) {
        continue
      }
      const analysis = analyzeDataGridSpreadsheetCellInput(rawInput, {
        currentRowIndex: address.rowIndex,
        rowCount: rows.length,
        functionRegistry,
        referenceParserOptions,
      })
      analysisByCellKey.set(cellKey, analysis)
      if (analysis.kind !== "formula") {
        continue
      }

      const dependencies = collectDependencyAddresses(analysis)
      const dependencyKeys = Object.freeze(dependencies.map(dependency => makeCellKey(
        dependency.rowIndex,
        dependency.columnKey,
      )))
      let compiled: DataGridCompiledFormulaField<Record<string, unknown>> | null = null
      if (analysis.isFormulaValid) {
        compiled = compileDataGridFormulaFieldDefinition<Record<string, unknown>>({
          name: cellKey,
          field: address.columnKey,
          formula: rawInput,
        }, {
          functionRegistry,
          referenceParserOptions,
          runtimeErrorPolicy,
          resolveDependencyToken: identifier => identifier,
        })
      }

      const formulaCellState: SpreadsheetFormulaCellState = {
        key: cellKey,
        address,
        analysis,
        compiled,
        dependencies,
        dependencyKeys,
        contextKeys: compiled?.contextKeys ?? EMPTY_DIAGNOSTICS,
      }
      formulaCellByKey.set(cellKey, formulaCellState)

      for (const dependencyKey of dependencyKeys) {
        setDependentLink(dependencyKey, cellKey)
      }
    }
    return baseValuesChanged
  }

  function createFormulaContext(
    formulaCell: SpreadsheetFormulaCellState,
    dirtyFormulaKeys: ReadonlySet<string> | null,
    cache: Map<string, DataGridFormulaValue>,
    visiting: Set<string>,
  ): DataGridComputedFieldComputeContext<Record<string, unknown>> {
    const row = rows[formulaCell.address.rowIndex]
    return {
      row: row?.resolvedData ?? {},
      rowId: row?.id ?? formulaCell.address.rowIndex,
      sourceIndex: formulaCell.address.rowIndex,
      get: (token: string) => {
        if (typeof token !== "string") {
          return null
        }
        const parsed = parseDataGridFormulaIdentifier(token, referenceParserOptions)
        if (parsed.referenceName.length === 0) {
          return null
        }
        const targetRowIndexes = resolveFormulaTargetRowIndexes(
          parsed.rowSelector,
          formulaCell.address.rowIndex,
          rows.length,
        )
        if (targetRowIndexes.length === 0) {
          return parsed.rowSelector.kind === "window" ? Object.freeze([]) : null
        }
        const resolvedValues = targetRowIndexes.map((targetRowIndex) => {
          const targetCellKey = makeCellKey(targetRowIndex, parsed.referenceName)
          const targetFormulaCell = formulaCellByKey.get(targetCellKey)
          if (targetFormulaCell) {
            if (dirtyFormulaKeys && !dirtyFormulaKeys.has(targetCellKey) && !cache.has(targetCellKey)) {
              return rows[targetRowIndex]?.resolvedData[parsed.referenceName] ?? null
            }
            return evaluateFormulaCell(targetFormulaCell, dirtyFormulaKeys, cache, visiting)
          }
          return rows[targetRowIndex]?.resolvedData[parsed.referenceName] ?? null
        })
        return parsed.rowSelector.kind === "window"
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
    const analysis = analyzeDataGridSpreadsheetCellInput(rawInput, {
      currentRowIndex: rowIndex,
      rowCount: rows.length,
      functionRegistry,
      referenceParserOptions,
    })
    if (analysis.kind === "blank") {
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

      if (nextRawInput.trim().length === 0) {
        rawInputByCellKey.delete(cellKey)
      } else {
        rawInputByCellKey.set(cellKey, nextRawInput)
      }

      if (previousAnalysis.kind === "formula" || nextAnalysis.kind === "formula") {
        formulaStructureDirty = true
      } else {
        const previousValue = rows[address.rowIndex]?.resolvedData[address.columnKey] ?? null
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
      const nextStyle = normalizeSpreadsheetStyle(patch.style)
      const previousStyle = getCellOwnStyle(cellKey)
      if (areSpreadsheetStylesEqual(previousStyle, nextStyle)) {
        continue
      }
      changed = true
      if (nextStyle) {
        cellStyleByCellKey.set(cellKey, nextStyle)
      } else {
        cellStyleByCellKey.delete(cellKey)
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

  const initialBaseValuesChanged = rebuildFormulaState()
  if (initialBaseValuesChanged || applyFormulaEvaluation(null)) {
    valueRevision += 1
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
    const analysis = getAnalysis(cellKey, address.rowIndex)
    const formulaCell = formulaCellByKey.get(cellKey)
    const displayValue = row.resolvedData[address.columnKey] ?? null
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
    getRows() {
      return Object.freeze(rows.map(row => ({
        id: row.id,
        rowIndex: row.rowIndex,
        style: row.style,
      })))
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
      return rows[address.rowIndex]?.resolvedData[address.columnKey] ?? null
    },
    getFormulaCells() {
      return Object.freeze(
        [...formulaCellByKey.values()]
          .map(formulaCell => ({
            address: cloneCellAddress(formulaCell.address),
            formula: formulaCell.analysis.formula ?? "",
            contextKeys: formulaCell.contextKeys,
            dependencies: formulaCell.dependencies,
          }))
          .sort((left, right) => compareCellAddresses(left.address, right.address)),
      )
    },
    getTableSource() {
      return tableSource
    },
    getTableSourceRevision() {
      return valueRevision
    },
    setCellInput(cell, rawInput) {
      return setCellInputs([{ cell, rawInput }])
    },
    setCellInputs,
    clearCell(cell) {
      return setCellInputs([{ cell, rawInput: "" }])
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
      rawInputByCellKey.clear()
      analysisByCellKey.clear()
      cellStyleByCellKey.clear()
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
