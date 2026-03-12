import type { DataGridRowId } from "../models/rowModel.js"
import type { DataGridFormulaTableSource } from "../models/formula/formulaContracts.js"
import { analyzeDataGridSpreadsheetCellInput, type DataGridSpreadsheetCellAddress } from "./formulaEditorModel.js"
import {
  createDataGridSpreadsheetDerivedSheetRuntime,
  type DataGridSpreadsheetDerivedSheetRuntime,
} from "./derivedSheetRuntime.js"
import type {
  DataGridSpreadsheetCellInputPatch,
  DataGridSpreadsheetCellSnapshot,
  DataGridSpreadsheetCellStylePatch,
  DataGridSpreadsheetFormulaCellSnapshot,
  DataGridSpreadsheetFormulaStructuralPatch,
  DataGridSpreadsheetFormulaTablePatch,
  DataGridSpreadsheetRowInput,
  DataGridSpreadsheetSheetListener,
  DataGridSpreadsheetSheetModel,
  DataGridSpreadsheetSheetState,
  DataGridSpreadsheetStyle,
} from "./sheetModel.js"

const EMPTY_FORMULA_CELLS = Object.freeze([]) as readonly DataGridSpreadsheetFormulaCellSnapshot[]

export interface CreateDataGridSpreadsheetDerivedSheetModelOptions {
  sheetId: string | null
  sheetName: string | null
  sheetStyle: DataGridSpreadsheetStyle | null
  referenceParserOptions?: DataGridSpreadsheetSheetState["referenceParserOptions"]
  runtimeErrorPolicy: DataGridSpreadsheetSheetState["runtimeErrorPolicy"]
  functionRegistry?: DataGridSpreadsheetSheetState["functionRegistry"]
  resolveContextValue?: DataGridSpreadsheetSheetState["resolveContextValue"]
}

export interface DataGridSpreadsheetDerivedSheetModel extends DataGridSpreadsheetSheetModel {
  replaceRuntime(
    runtime: DataGridSpreadsheetDerivedSheetRuntime,
    options?: Partial<CreateDataGridSpreadsheetDerivedSheetModelOptions>,
  ): boolean
  getDerivedRuntime(): DataGridSpreadsheetDerivedSheetRuntime
}

function normalizeOutputValue(value: unknown): string {
  if (value == null) {
    return ""
  }
  if (typeof value === "string") {
    return value.startsWith("=") ? `=${JSON.stringify(value)}` : value
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value)
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString()
  }
  return String(value)
}

function createMaterializedCellRawInput(value: unknown): string {
  if (typeof value !== "string") {
    return ""
  }
  return value.trimStart().startsWith("=") ? normalizeOutputValue(value) : ""
}

function mergeStyles(
  sheetStyle: DataGridSpreadsheetStyle | null,
  columnStyle: DataGridSpreadsheetStyle | null,
): DataGridSpreadsheetStyle | null {
  const merged = {
    ...(sheetStyle ?? {}),
    ...(columnStyle ?? {}),
  }
  return Object.keys(merged).length === 0 ? null : Object.freeze(merged)
}

function areStylesEqual(
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
    if (!Object.prototype.hasOwnProperty.call(right, key) || !Object.is(left[key], right[key])) {
      return false
    }
  }
  return true
}

function createDerivedRuntimeFromSheetState(
  state: DataGridSpreadsheetSheetState,
): DataGridSpreadsheetDerivedSheetRuntime {
  const columnIndexByKey = new Map<string, number>()
  const columns = state.columns.map((column, columnIndex) => {
    columnIndexByKey.set(column.key, columnIndex)
    return {
      key: column.key,
      title: column.title,
      style: column.style ?? null,
    }
  })
  const rows = state.rows.map(row => {
    const values = new Array<unknown>(columns.length).fill(undefined)
    for (const cell of row.cells) {
      const columnIndex = columnIndexByKey.get(cell.columnKey)
      if (typeof columnIndex !== "number") {
        continue
      }
      values[columnIndex] = typeof cell.resolvedValue !== "undefined" ? cell.resolvedValue : cell.rawInput
    }
    return {
      id: row.id,
      values,
    }
  })
  return createDataGridSpreadsheetDerivedSheetRuntime({
    columns,
    rows,
  })
}

function createDerivedRuntimeTableSource(
  runtime: DataGridSpreadsheetDerivedSheetRuntime,
): DataGridFormulaTableSource {
  return {
    rows: runtime.rows,
    resolveRow: (row: unknown) => {
      const runtimeRow = row as (typeof runtime.rows)[number]
      const values: Record<string, unknown> = {}
      for (let columnIndex = 0; columnIndex < runtime.columns.length; columnIndex += 1) {
        const column = runtime.columns[columnIndex]
        if (!column) {
          continue
        }
        values[column.key] = runtimeRow.values[columnIndex]
      }
      return values
    },
  }
}

export function createDataGridSpreadsheetDerivedSheetModel(
  initialRuntime: DataGridSpreadsheetDerivedSheetRuntime,
  initialOptions: CreateDataGridSpreadsheetDerivedSheetModelOptions,
): DataGridSpreadsheetDerivedSheetModel {
  let disposed = false
  let revision = 0
  let valueRevision = 0
  let styleRevision = 0
  let runtime = initialRuntime
  let sheetId = initialOptions.sheetId
  let sheetName = initialOptions.sheetName
  let sheetStyle = initialOptions.sheetStyle
  let referenceParserOptions = initialOptions.referenceParserOptions
  let runtimeErrorPolicy = initialOptions.runtimeErrorPolicy
  let functionRegistry = initialOptions.functionRegistry
  let resolveContextValue = initialOptions.resolveContextValue
  const listeners = new Set<DataGridSpreadsheetSheetListener>()

  const ensureActive = (): void => {
    if (disposed) {
      throw new Error("DataGridSpreadsheetDerivedSheetModel has been disposed")
    }
  }

  const emit = (): void => {
    const snapshot = api.getSnapshot()
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  const getRowIndexById = (rowId: DataGridRowId): number => runtime.rows.findIndex(row => row.id === rowId)
  const getColumnIndexByKey = (columnKey: string): number => runtime.columns.findIndex(column => column.key === columnKey)

  const createAddress = (
    rowIndex: number,
    columnKey: string,
  ): DataGridSpreadsheetCellAddress => ({
    sheetId,
    rowId: runtime.rows[rowIndex]?.id ?? null,
    rowIndex,
    columnKey,
  })

  const getCellAt = (
    rowIndex: number,
    columnKey: string,
  ): DataGridSpreadsheetCellSnapshot | null => {
    const columnIndex = getColumnIndexByKey(columnKey)
    const row = runtime.rows[rowIndex]
    if (columnIndex < 0 || !row) {
      return null
    }
    const value = row.values[columnIndex]
    const rawInput = createMaterializedCellRawInput(value)
    const analysis = analyzeDataGridSpreadsheetCellInput(rawInput, {
      currentRowIndex: rowIndex,
      referenceParserOptions,
    })
    const column = runtime.columns[columnIndex]
    return {
      address: createAddress(rowIndex, columnKey),
      rawInput,
      inputKind: analysis.kind,
      formula: null,
      displayValue: value,
      errorValue: null,
      analysis,
      dependencies: Object.freeze([]),
      ownStyle: null,
      style: mergeStyles(sheetStyle, column?.style ?? null),
    }
  }

  const replaceRuntime = (
    nextRuntime: DataGridSpreadsheetDerivedSheetRuntime,
    nextOptions: Partial<CreateDataGridSpreadsheetDerivedSheetModelOptions> = {},
  ): boolean => {
    ensureActive()
    const resolvedSheetId = nextOptions.sheetId ?? sheetId
    const resolvedSheetName = nextOptions.sheetName ?? sheetName
    const resolvedSheetStyle = nextOptions.sheetStyle ?? sheetStyle
    const resolvedReferenceParserOptions = nextOptions.referenceParserOptions ?? referenceParserOptions
    const resolvedRuntimeErrorPolicy = nextOptions.runtimeErrorPolicy ?? runtimeErrorPolicy
    const resolvedFunctionRegistry = nextOptions.functionRegistry ?? functionRegistry
    const resolvedResolveContextValue = nextOptions.resolveContextValue ?? resolveContextValue
    if (
      nextRuntime === runtime
      && resolvedSheetId === sheetId
      && resolvedSheetName === sheetName
      && areStylesEqual(resolvedSheetStyle, sheetStyle)
      && resolvedReferenceParserOptions === referenceParserOptions
      && resolvedRuntimeErrorPolicy === runtimeErrorPolicy
      && resolvedFunctionRegistry === functionRegistry
      && resolvedResolveContextValue === resolveContextValue
    ) {
      return false
    }
    runtime = nextRuntime
    sheetId = resolvedSheetId
    sheetName = resolvedSheetName
    sheetStyle = resolvedSheetStyle
    referenceParserOptions = resolvedReferenceParserOptions
    runtimeErrorPolicy = resolvedRuntimeErrorPolicy
    functionRegistry = resolvedFunctionRegistry
    resolveContextValue = resolvedResolveContextValue
    revision += 1
    valueRevision += 1
    styleRevision += 1
    emit()
    return true
  }

  const readonlyMutation = (): false => {
    ensureActive()
    return false
  }

  const api: DataGridSpreadsheetDerivedSheetModel = {
    replaceRuntime,
    getDerivedRuntime() {
      ensureActive()
      return runtime
    },
    getSnapshot() {
      ensureActive()
      return {
        revision,
        valueRevision,
        formulaStructureRevision: 0,
        styleRevision,
        rowCount: runtime.rows.length,
        columnCount: runtime.columns.length,
        formulaCellCount: 0,
        errorCellCount: 0,
        sheetId,
        sheetName,
        lastRowMutation: null,
      }
    },
    getSheetId() {
      ensureActive()
      return sheetId
    },
    getSheetName() {
      ensureActive()
      return sheetName
    },
    getColumns() {
      ensureActive()
      return runtime.columns
    },
    getRows() {
      ensureActive()
      return Object.freeze(runtime.rows.map((row, rowIndex) => ({
        id: row.id,
        rowIndex,
        style: null,
      })))
    },
    exportState() {
      ensureActive()
      return {
        sheetId,
        sheetName,
        columns: runtime.columns,
        rows: Object.freeze(runtime.rows.map(row => Object.freeze({
          id: row.id,
          style: null,
          cells: Object.freeze(runtime.columns.map((column, columnIndex) => Object.freeze({
            columnKey: column.key,
            rawInput: createMaterializedCellRawInput(row.values[columnIndex]),
            resolvedValue: row.values[columnIndex],
            style: null,
          }))),
        }))),
        sheetStyle,
        formulaTables: Object.freeze([]),
        functionRegistry,
        referenceParserOptions,
        runtimeErrorPolicy,
        resolveContextValue,
      }
    },
    restoreState(state) {
      ensureActive()
      return replaceRuntime(createDerivedRuntimeFromSheetState(state), {
        sheetId: state.sheetId ?? sheetId,
        sheetName: state.sheetName ?? sheetName,
        sheetStyle: state.sheetStyle ?? null,
        referenceParserOptions: state.referenceParserOptions,
        runtimeErrorPolicy: state.runtimeErrorPolicy,
        functionRegistry: state.functionRegistry,
        resolveContextValue: state.resolveContextValue,
      })
    },
    getCell(cell) {
      ensureActive()
      return getCellAt(cell.rowIndex, cell.columnKey)
    },
    getCellById(rowId, columnKey) {
      ensureActive()
      const rowIndex = getRowIndexById(rowId)
      return rowIndex >= 0 ? getCellAt(rowIndex, columnKey) : null
    },
    getCellDisplayValue(cell) {
      ensureActive()
      return getCellAt(cell.rowIndex, cell.columnKey)?.displayValue
    },
    getFormulaCells() {
      ensureActive()
      return EMPTY_FORMULA_CELLS
    },
    getTableSource() {
      ensureActive()
      return createDerivedRuntimeTableSource(runtime)
    },
    getTableSourceRevision() {
      ensureActive()
      return valueRevision
    },
    recompute: readonlyMutation,
    setCellInput: readonlyMutation,
    setCellInputs(_patches: readonly DataGridSpreadsheetCellInputPatch[]) {
      return readonlyMutation()
    },
    applyFormulaStructuralPatches(_patches: readonly DataGridSpreadsheetFormulaStructuralPatch[]) {
      return readonlyMutation()
    },
    clearCell: readonlyMutation,
    insertRowsAt(_index: number, _rows?: readonly DataGridSpreadsheetRowInput[]) {
      return readonlyMutation()
    },
    removeRowsAt(_index: number, _count?: number) {
      return readonlyMutation()
    },
    insertRowsBefore(_rowId: DataGridRowId, _rows?: readonly DataGridSpreadsheetRowInput[]) {
      return readonlyMutation()
    },
    insertRowsAfter(_rowId: DataGridRowId, _rows?: readonly DataGridSpreadsheetRowInput[]) {
      return readonlyMutation()
    },
    setSheetStyle(_style: DataGridSpreadsheetStyle | null) {
      return readonlyMutation()
    },
    setColumnStyle(_columnKey: string, _style: DataGridSpreadsheetStyle | null) {
      return readonlyMutation()
    },
    setRowStyle(_rowId: DataGridRowId, _style: DataGridSpreadsheetStyle | null) {
      return readonlyMutation()
    },
    setCellStyle(_cell: DataGridSpreadsheetCellAddress, _style: DataGridSpreadsheetStyle | null) {
      return readonlyMutation()
    },
    setCellStyles(_patches: readonly DataGridSpreadsheetCellStylePatch[]) {
      return readonlyMutation()
    },
    copyCellStyle(_source: DataGridSpreadsheetCellAddress, _targets: readonly DataGridSpreadsheetCellAddress[]) {
      return readonlyMutation()
    },
    setFormulaTable(_name: string, _source: DataGridFormulaTableSource) {
      return readonlyMutation()
    },
    patchFormulaTables(_patch: DataGridSpreadsheetFormulaTablePatch) {
      return readonlyMutation()
    },
    subscribe(listener) {
      ensureActive()
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
    },
  }

  return api
}
