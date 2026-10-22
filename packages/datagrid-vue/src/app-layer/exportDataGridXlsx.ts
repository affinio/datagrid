import type { DataGridApi, DataGridColumnDef, DataGridColumnSnapshot } from "@affino/datagrid-vue/headless"
import { parseDataGridFormulaExpression, type DataGridFormulaAstNode } from "@affino/datagrid-formula-engine"
import { columnToExcel } from "@affino/export-xlsx"
import type { WorksheetCell, WorksheetCellStyle, WorksheetRow, XlsxWorkbookInput } from "@affino/export-xlsx"

export interface DataGridColumnExportOptions<TRow = unknown> {
  /** Override the worksheet header. Defaults to the column label, then key. */
  header?: string
  /** Resolve a value that differs from the grid's data accessor. */
  value?: (context: { row: TRow; column: DataGridColumnSnapshot }) => unknown
  /** Override the grid column's data type for workbook serialization. */
  dataType?: "text" | "number" | "boolean" | "date" | "datetime" | "currency" | "percent"
  /** Explicit Excel number format code. */
  numberFormat?: string
  /** Excel column width in characters. */
  width?: number
  /** Excel cell fill and text style, independent of the Vue renderer. */
  style?: Pick<WorksheetCellStyle, "fillColor" | "fontColor" | "bold">
}

export interface DataGridXlsxExportProgress {
  phase: "preparing" | "writing"
  completedRows: number
  totalRows: number
}

export interface ExportDataGridXlsxOptions {
  fileName?: string
  sheetName?: string
  rows?: "current-view"
  columns?: "visible" | "all"
  includeHeaders?: boolean
  formulas?: "values" | "excel"
  headerFillColor?: string
  headerFontColor?: string
  signal?: AbortSignal
  onProgress?: (progress: DataGridXlsxExportProgress) => void
}

export interface DataGridXlsxExportConfig extends Omit<ExportDataGridXlsxOptions, "signal" | "onProgress"> {
  buttonLabel?: string
  headerFillColor?: string
  headerFontColor?: string
}

export type DataGridXlsxExportProp = boolean | DataGridXlsxExportConfig | null | undefined

export type DataGridXlsxExportResult =
  | { status: "success"; fileName: string; bytes: Uint8Array; rowCount: number; columnCount: number; warnings: readonly string[] }
  | { status: "cancelled" }
  | { status: "unsupported"; code: "pivot-view" | "incomplete-data" | "worker-unavailable" | "formula-translation"; message: string }
  | { status: "error"; code: "snapshot-changed" | "worker-error"; message: string }

interface AppColumnExportMetadata<TRow> {
  export?: DataGridColumnExportOptions<TRow>
  valueGetter?: (row: TRow) => unknown
  accessor?: (row: TRow) => unknown
  field?: string
  dataType?: DataGridColumnExportOptions["dataType"]
  meta?: Record<string, unknown>
  presentation?: { format?: { number?: { style?: string; currency?: string; locale?: string; minimumFractionDigits?: number; maximumFractionDigits?: number }; dateTime?: Record<string, unknown> } }
}

class FormulaTranslationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FormulaTranslationError"
  }
}

function excelFormulaNode(
  node: DataGridFormulaAstNode,
  rowNumber: number,
  columnIndexes: ReadonlyMap<string, number>,
): string {
  if (node.kind === "number") return String(node.value)
  if (node.kind === "literal") {
    if (typeof node.value === "string") return '"' + node.value.replace(/"/g, '""') + '"'
    if (typeof node.value === "boolean") return node.value ? "TRUE" : "FALSE"
    if (node.value == null) return '""'
    throw new FormulaTranslationError("Array and object literals are not supported in Excel formulas.")
  }
  if (node.kind === "identifier") {
    if (node.sheetReference || node.rowSelector.kind !== "current") {
      throw new FormulaTranslationError("Reference '" + node.referenceName + "' is not a same-row column reference.")
    }
    const index = columnIndexes.get(node.referenceName.toLocaleLowerCase("en-US"))
    if (index === undefined) {
      throw new FormulaTranslationError("Referenced column '" + node.referenceName + "' is not included in this export.")
    }
    return columnToExcel(index) + String(rowNumber)
  }
  if (node.kind === "unary") {
    const value = excelFormulaNode(node.value, rowNumber, columnIndexes)
    if (node.operator === "NOT") return "NOT(" + value + ")"
    return node.operator + "(" + value + ")"
  }
  if (node.kind === "binary") {
    const left = excelFormulaNode(node.left, rowNumber, columnIndexes)
    const right = excelFormulaNode(node.right, rowNumber, columnIndexes)
    if (node.operator === "AND" || node.operator === "OR") return node.operator + "(" + left + "," + right + ")"
    const operator = node.operator === "==" ? "=" : node.operator === "!=" ? "<>" : node.operator
    return "(" + left + operator + right + ")"
  }
  const args = node.args.map(argument => excelFormulaNode(argument, rowNumber, columnIndexes))
  if (node.name.toLocaleUpperCase("en-US") === "SAFE_DIVIDE") {
    if (args.length < 2 || args.length > 3) {
      throw new FormulaTranslationError("SAFE_DIVIDE requires two or three arguments for Excel export.")
    }
    return "IF(" + args[1] + "=0," + (args[2] ?? "0") + "," + args[0] + "/" + args[1] + ")"
  }
  const excelFunctions = new Set(["IF", "SUM", "AVERAGE", "MIN", "MAX", "ROUND", "ABS", "AND", "OR", "NOT", "COUNT", "COUNTA"])
  const name = node.name.toLocaleUpperCase("en-US")
  if (!excelFunctions.has(name)) {
    throw new FormulaTranslationError("Function '" + node.name + "' has no Excel export mapping.")
  }
  return name + "(" + args.join(",") + ")"
}

function compileExcelFormula(
  formula: string,
  rowNumber: number,
  columnIndexes: ReadonlyMap<string, number>,
): string {
  const { ast } = parseDataGridFormulaExpression(formula)
  return "=" + excelFormulaNode(ast, rowNumber, columnIndexes)
}

function excelCachedValue(value: unknown): string | number | boolean {
  if (typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  return value == null ? 0 : String(value)
}

function getColumnMetadata<TRow>(column: DataGridColumnSnapshot): AppColumnExportMetadata<TRow> {
  return column.column as DataGridColumnDef<TRow> & AppColumnExportMetadata<TRow>
}

function readFieldPath(row: unknown, field: string): unknown {
  let value = row
  for (const segment of field.split(".")) {
    if (value == null || (typeof value !== "object" && typeof value !== "function")) return undefined
    value = (value as Record<string, unknown>)[segment]
  }
  return value
}

function resolveColumnValue<TRow>(
  row: TRow,
  column: DataGridColumnSnapshot,
  api?: DataGridApi<TRow>,
  rowId?: string | number,
  rowSnapshot?: { rowId: string | number; kind: "leaf" | "group"; data: TRow },
): unknown {
  const metadata = getColumnMetadata<TRow>(column)
  const exportValue = metadata.export?.value?.({ row, column })
  if (typeof exportValue !== "undefined") return exportValue
  if (api?.cells && rowId !== undefined) {
    const resolved = api.cells.resolveValue({
      rowId,
      columnKey: column.key,
      purpose: "computed",
      ...(rowSnapshot ? { snapshot: { row: rowSnapshot, column } } : {}),
    })
    if (resolved.status === "available") return resolved.computedValue
  }
  if (metadata.valueGetter) return metadata.valueGetter(row)
  if (metadata.accessor) return metadata.accessor(row)
  // DataGrid columns commonly use `key` as their data accessor. Requiring an
  // explicit `field` here made exports of ordinary key-based columns blank.
  return readFieldPath(row, metadata.field ?? column.key)
}

function resolveExcelNumberFormat<TRow>(column: DataGridColumnSnapshot): string | undefined {
  const metadata = getColumnMetadata<TRow>(column)
  if (metadata.export?.numberFormat) return metadata.export.numberFormat
  const type = metadata.export?.dataType ?? metadata.dataType
  const number = metadata.presentation?.format?.number
  if (type === "percent" || number?.style === "percent") {
    const digits = Math.max(0, Math.min(10, number?.maximumFractionDigits ?? 2))
    return `0${digits ? `.${"0".repeat(Math.max(0, number?.minimumFractionDigits ?? 0))}${"#".repeat(Math.max(0, digits - (number?.minimumFractionDigits ?? 0)))}` : ""}%`
  }
  if (type === "currency" || number?.style === "currency") {
    const currency = number?.currency?.trim().toUpperCase()
    const digits = Math.max(0, Math.min(10, number?.maximumFractionDigits ?? 2))
    if (currency) {
      try {
        const symbol = new Intl.NumberFormat(number?.locale, { style: "currency", currency }).formatToParts(0)
          .find(part => part.type === "currency")?.value
        if (symbol) return `"${symbol.replace(/"/g, '""')}"#,##0${digits ? `.${"0".repeat(Math.max(0, number?.minimumFractionDigits ?? 0))}${"#".repeat(Math.max(0, digits - (number?.minimumFractionDigits ?? 0)))}` : ""}`
      } catch {
        return undefined
      }
    }
    return `#,##0${digits ? `.${"0".repeat(Math.max(0, number?.minimumFractionDigits ?? 0))}${"#".repeat(Math.max(0, digits - (number?.minimumFractionDigits ?? 0)))}` : ""}`
  }
  if (type === "number") {
    const digits = Math.max(0, Math.min(10, number?.maximumFractionDigits ?? 2))
    return `#,##0${digits ? `.${"0".repeat(Math.max(0, number?.minimumFractionDigits ?? 0))}${"#".repeat(Math.max(0, digits - (number?.minimumFractionDigits ?? 0)))}` : ""}`
  }
  if (type === "date") return "yyyy-mm-dd"
  if (type === "datetime") return "yyyy-mm-dd hh:mm:ss"
  return undefined
}

function toWorksheetCell<TRow>(value: unknown, column: DataGridColumnSnapshot): WorksheetCell | null {
  if (value == null || value === "") return null
  const metadata = getColumnMetadata<TRow>(column)
  const type = metadata.export?.dataType ?? metadata.dataType
  const numberFormat = resolveExcelNumberFormat<TRow>(column)
  const exportStyle = metadata.export?.style
  const style = numberFormat || exportStyle
    ? { ...(numberFormat ? { numberFormat } : {}), ...exportStyle }
    : undefined
  if (type === "text") return { type: "string", value: typeof value === "string" ? value : String(value), style }
  if (type === "date" || type === "datetime") {
    const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null
    return date && Number.isFinite(date.getTime()) ? { type: "date", value: new Date(date.getTime()), style } : { type: "string", value: String(value) }
  }
  if ((type === "number" || type === "currency" || type === "percent") && typeof value === "number" && Number.isFinite(value)) {
    return { type: "number", value, style }
  }
  if (typeof value === "boolean") return { type: "boolean", value }
  if (typeof value === "number" && Number.isFinite(value)) return { type: "number", value, style }
  if (value instanceof Date && Number.isFinite(value.getTime())) return { type: "date", value: new Date(value.getTime()) }
  if (typeof value === "bigint") return { type: "string", value: value.toString() }
  if (typeof value === "string") return { type: "string", value }
  try {
    return { type: "string", value: JSON.stringify(value) ?? String(value) }
  } catch {
    return { type: "string", value: String(value) }
  }
}

function columnWidth<TRow>(column: DataGridColumnSnapshot): number | undefined {
  const authoredWidth = getColumnMetadata<TRow>(column).export?.width
  if (typeof authoredWidth === "number" && Number.isFinite(authoredWidth)) return Math.max(1, Math.min(255, authoredWidth))
  if (typeof column.width === "number" && Number.isFinite(column.width)) return Math.max(8, Math.min(60, (column.width - 5) / 7))
  return undefined
}

function columnsMatchSnapshot(
  initial: readonly DataGridColumnSnapshot[],
  current: readonly DataGridColumnSnapshot[],
): boolean {
  return initial.length === current.length && initial.every((column, index) => {
    const next = current[index]
    return next !== undefined
      && column.key === next.key
      && column.visible === next.visible
      && column.pin === next.pin
      && column.width === next.width
      && column.column === next.column
      && column.state === next.state
  })
}

function resolveGroupLabelColumnIndex<TRow>(
  columns: readonly DataGridColumnSnapshot[],
  groupField: string,
): number {
  const fieldColumn = columns.findIndex(column => column.key === groupField)
  if (fieldColumn >= 0) return fieldColumn
  const hierarchyColumn = columns.findIndex(column => {
    const meta = getColumnMetadata<TRow>(column).meta
    return column.key === "__affino_hierarchy__" || typeof meta?.hierarchyLeafSourceColumnKey === "string"
  })
  return hierarchyColumn >= 0 ? hierarchyColumn : 0
}

function isOwnRecordValue(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function outlineLevelForRow(level: number): number {
  return Math.max(0, Math.min(7, Math.trunc(level)))
}

function excelSubtotalFunction(op: string): number | null {
  switch (op) {
    case "avg": return 1
    case "countNonNull": return 3
    case "max": return 4
    case "min": return 5
    case "sum": return 9
    default: return null
  }
}

export async function exportDataGridXlsx<TRow>(
  api: DataGridApi<TRow>,
  options: ExportDataGridXlsxOptions = {},
): Promise<DataGridXlsxExportResult> {
  const { signal } = options
  if (signal?.aborted) return { status: "cancelled" }
  if (options.rows && options.rows !== "current-view") {
    return { status: "unsupported", code: "incomplete-data", message: "Only the current projected view can be exported in this version." }
  }
  const captured = api.read?.captureView?.({ include: ["rows", "columns", "computed"] })
  const capturedRows = captured?.rows?.status === "available" ? captured.rows.value : null
  const capturedColumns = captured?.columns?.status === "available" ? captured.columns.value : null
  const initialSnapshot = capturedRows?.snapshot ?? api.rows.getSnapshot()
  if (initialSnapshot.loading || initialSnapshot.initialLoading) {
    return { status: "unsupported", code: "incomplete-data", message: "The grid is still loading; partial exports are refused." }
  }
  if (capturedRows && capturedRows.coverage.completeness !== "complete") {
    return { status: "unsupported", code: "incomplete-data", message: "The current projection is not fully loaded; partial exports are refused." }
  }
  if (initialSnapshot.pivotModel) {
    return { status: "unsupported", code: "pivot-view", message: "Pivot exports are not supported yet." }
  }
  const columnSnapshot = capturedColumns ?? api.columns.getSnapshot()
  const columns = options.columns === "all" ? columnSnapshot.columns : columnSnapshot.visibleColumns
  const columnsAtStart = columnSnapshot.columns
  const capturedComputed = captured?.computed?.status === "available" ? captured.computed.value : null
  const liveAggregationModel = api.rows.getAggregationModel?.() ?? null
  const capturedAggregation = liveAggregationModel
    ? {
        basis: liveAggregationModel.basis,
        columns: liveAggregationModel.columns.map(column => ({ key: column.key, field: column.field, op: column.op })),
      }
    : null
  const formulaFields = options.formulas === "excel"
    ? capturedComputed?.formulas ?? api.rows.getFormulaFields()
    : []
  const formulasByField = new Map(formulaFields.map(field => [field.field.toLocaleLowerCase("en-US"), field.formula]))
  const columnIndexes = new Map(columns.map((column, index) => [column.key.toLocaleLowerCase("en-US"), index]))
  const rowCount = capturedRows?.projection.length ?? api.rows.getCount()
  const outputRows: WorksheetRow[] = []
  const rowOutlineLevels: number[] = []
  const groupRows: Array<{ outputIndex: number; level: number; aggregates: Record<string, unknown> }> = []
  if (options.includeHeaders !== false) {
    outputRows.push(columns.map(column => ({
      type: "string" as const,
      value: getColumnMetadata<TRow>(column).export?.header ?? column.column.label ?? column.key,
      style: { bold: true, fillColor: options.headerFillColor ?? "FFF1F3F5", fontColor: options.headerFontColor },
    })))
    rowOutlineLevels.push(0)
  }
  const warnings = new Set<string>()
  if (initialSnapshot.groupBy) {
    warnings.add("Group rows include labels and available aggregate values; other group cells are blank.")
  }
  if (initialSnapshot.treeDataDiagnostics) {
    warnings.add("Tree outline exports include expanded projected rows; descendants hidden by collapsed nodes are omitted.")
  }
  let activeGroupDepth = 0
  for (let index = 0; index < rowCount; index += 1) {
      if (signal?.aborted) return { status: "cancelled" }
      const node = capturedRows?.projection[index] ?? api.rows.get(index)
      if (!node || (node as typeof node & { __placeholder?: boolean }).__placeholder === true) {
        return { status: "unsupported", code: "incomplete-data", message: `Row ${index} is not loaded; partial server exports are refused.` }
      }
      if (node.kind === "group") {
        const group = node.groupMeta
        const level = outlineLevelForRow(group?.level ?? 0)
        activeGroupDepth = level + 1
        const labelColumnIndex = resolveGroupLabelColumnIndex<TRow>(columns, group?.groupField ?? "group")
        const isSourceParentRow = group?.groupField === "parent"
        if (!group) warnings.add("A projected group row did not include group metadata; its row id was used as the label.")
        const aggregateValues = group?.aggregates ?? {}
        const label = group
          ? `${group.groupValue}${group.childrenCount > 0 ? ` (${group.childrenCount})` : ""}`
          : String(node.rowId)
        const groupCells = columns.map((column, columnIndex) => {
          if (isOwnRecordValue(aggregateValues, column.key)) {
            return toWorksheetCell<TRow>(aggregateValues[column.key], column)
          }
          if (isSourceParentRow) {
            const value = resolveColumnValue(node.data, column, api, node.rowId, node)
            const cell = toWorksheetCell<TRow>(value, column)
            const hierarchyIndex = resolveGroupLabelColumnIndex<TRow>(columns, "parent")
            if (columnIndex === hierarchyIndex && cell) {
              return { ...cell, style: { ...cell.style, indent: Math.min(15, level) } }
            }
            return cell
          }
          if (columnIndex === labelColumnIndex) {
            return {
              type: "string" as const,
              value: label,
              style: { bold: true, indent: Math.min(15, level) },
            }
          }
          return null
        })
        groupRows.push({ outputIndex: outputRows.length, level, aggregates: aggregateValues })
        outputRows.push(groupCells)
        rowOutlineLevels.push(level)
        continue
      }

      const hierarchyColumnIndex = resolveGroupLabelColumnIndex<TRow>(columns, "")
      const worksheetRowNumber = outputRows.length + 1
      let formulaTranslationFailure: string | null = null
      outputRows.push(columns.map((column, columnIndex) => {
        const formula = formulasByField.get(column.key.toLocaleLowerCase("en-US"))
        if (formula && options.formulas === "excel") {
          let excelFormula: string
          try {
            excelFormula = compileExcelFormula(formula, worksheetRowNumber, columnIndexes)
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            formulaTranslationFailure = "Formula '" + column.key + "' cannot be exported: " + message
            return null
          }
          const value = resolveColumnValue(node.data, column, api, node.rowId, node)
          const metadata = getColumnMetadata<TRow>(column)
          const numberFormat = resolveExcelNumberFormat<TRow>(column)
          const exportStyle = metadata.export?.style
          const style = numberFormat || exportStyle
            ? { ...(numberFormat ? { numberFormat } : {}), ...exportStyle }
            : undefined
          return { type: "formula" as const, value: excelFormula, cachedValue: excelCachedValue(value), style }
        }
        const value = resolveColumnValue(node.data, column, api, node.rowId, node)
        if ((typeof value === "object" && value !== null) && !(value instanceof Date)) warnings.add(`Column '${column.key}' contains object values; they were serialized as JSON text.`)
        const cell = toWorksheetCell<TRow>(value, column)
        if (columnIndex === hierarchyColumnIndex && cell && activeGroupDepth > 0) {
          return { ...cell, style: { ...cell.style, indent: Math.min(15, activeGroupDepth) } }
        }
        return cell
      }))
      if (formulaTranslationFailure) {
        return { status: "unsupported", code: "formula-translation", message: formulaTranslationFailure }
      }
      rowOutlineLevels.push(outlineLevelForRow(activeGroupDepth))
  }
  if (options.formulas === "excel" && groupRows.length > 0) {
    const aggregationByKey = new Map((capturedAggregation?.columns ?? []).map(column => [column.key, column]))
    const canDeriveFromCurrentRows = capturedAggregation?.basis !== "source"
    const nextGroupBoundaryByOutputIndex = new Map<number, number>()
    const closestGroupByLevel = new Map<number, number>()
    for (let groupIndex = groupRows.length - 1; groupIndex >= 0; groupIndex -= 1) {
      const group = groupRows[groupIndex]
      if (!group) continue
      let boundary: number | undefined
      for (const [level, outputIndex] of closestGroupByLevel) {
        if (level <= group.level && (boundary === undefined || outputIndex < boundary)) boundary = outputIndex
      }
      if (boundary !== undefined) nextGroupBoundaryByOutputIndex.set(group.outputIndex, boundary)
      closestGroupByLevel.set(group.level, group.outputIndex)
    }
    for (let groupIndex = 0; groupIndex < groupRows.length; groupIndex += 1) {
      const group = groupRows[groupIndex]
      if (!group) continue
      const rangeStartIndex = group.outputIndex + 1
      const rangeEndExclusive = nextGroupBoundaryByOutputIndex.get(group.outputIndex) ?? outputRows.length
      if (rangeStartIndex >= rangeEndExclusive) continue
      const row = outputRows[group.outputIndex]
      if (!row) continue
      const nextRow = [...row]
      for (const column of columns) {
        if (!isOwnRecordValue(group.aggregates, column.key)) continue
        const aggregation = aggregationByKey.get(column.key)
        const subtotalCode = aggregation ? excelSubtotalFunction(aggregation.op) : null
        const sourceColumnIndex = columnIndexes.get((aggregation?.field ?? column.key).toLocaleLowerCase("en-US"))
        if (!canDeriveFromCurrentRows || subtotalCode === null || sourceColumnIndex === undefined) {
          warnings.add("Some group aggregates remain cached values because their operation, source column, or aggregation basis cannot be represented by the visible Excel rows.")
          continue
        }
        const sourceColumnLetter = columnToExcel(sourceColumnIndex)
        const startExcelRow = rangeStartIndex + 1
        const endExcelRow = rangeEndExclusive
        const existingCell = nextRow[columns.findIndex(candidate => candidate.key === column.key)]
        const existingStyle = existingCell && "style" in existingCell ? existingCell.style : undefined
        const numberFormat = resolveExcelNumberFormat<TRow>(column)
        const exportStyle = getColumnMetadata<TRow>(column).export?.style
        const style = numberFormat || exportStyle || existingStyle
          ? { ...existingStyle, ...(numberFormat ? { numberFormat } : {}), ...exportStyle }
          : undefined
        const outputColumnIndex = columns.findIndex(candidate => candidate.key === column.key)
        nextRow[outputColumnIndex] = {
          type: "formula",
          value: "=SUBTOTAL(" + subtotalCode + "," + sourceColumnLetter + startExcelRow + ":" + sourceColumnLetter + endExcelRow + ")",
          cachedValue: excelCachedValue(group.aggregates[column.key]),
          style,
        }
      }
      outputRows[group.outputIndex] = nextRow
    }
  }
  if (signal?.aborted) return { status: "cancelled" }
  options.onProgress?.({ phase: "preparing", completedRows: rowCount, totalRows: rowCount })
  if (api.rows.getSnapshot().revision !== initialSnapshot.revision
      || !columnsMatchSnapshot(columnsAtStart, api.columns.getSnapshot().columns)) {
    return { status: "error", code: "snapshot-changed", message: "Grid data or columns changed while the export snapshot was being prepared." }
  }
  if (typeof Worker === "undefined") {
    return { status: "unsupported", code: "worker-unavailable", message: "XLSX generation requires a Web Worker in this environment." }
  }

  options.onProgress?.({ phase: "writing", completedRows: rowCount, totalRows: rowCount })
  const workbook: XlsxWorkbookInput = {
    sheets: [{
      name: options.sheetName ?? "Data",
      rows: outputRows,
      headerRows: options.includeHeaders === false ? 0 : 1,
      freezeRows: options.includeHeaders === false ? 0 : 1,
      columns: columns.map(column => ({ width: columnWidth<TRow>(column) })),
      rowOutlineLevels,
    }],
  }
  return new Promise(resolve => {
    let worker: Worker
    try {
      worker = new Worker(new URL("./xlsxExport.worker.ts", import.meta.url), { type: "module" })
    } catch (error) {
      resolve({ status: "error", code: "worker-error", message: error instanceof Error ? error.message : String(error) })
      return
    }
    const finish = (result: DataGridXlsxExportResult) => {
      signal?.removeEventListener("abort", onAbort)
      worker.terminate()
      resolve(result)
    }
    const onAbort = () => finish({ status: "cancelled" })
    signal?.addEventListener("abort", onAbort, { once: true })
    worker.onerror = event => finish({ status: "error", code: "worker-error", message: event.message || "XLSX worker failed." })
    worker.onmessage = (event: MessageEvent<{ bytes?: ArrayBuffer; error?: string }>) => {
      if (event.data.error) {
        finish({ status: "error", code: "worker-error", message: event.data.error })
      } else if (event.data.bytes) {
        finish({
          status: "success",
          fileName: options.fileName?.trim() || "export.xlsx",
          bytes: new Uint8Array(event.data.bytes),
          rowCount,
          columnCount: columns.length,
          warnings: Array.from(warnings),
        })
      } else {
        finish({ status: "error", code: "worker-error", message: "XLSX worker returned an empty result." })
      }
    }
    try {
      worker.postMessage(workbook)
    } catch (error) {
      finish({ status: "error", code: "worker-error", message: error instanceof Error ? error.message : String(error) })
    }
  })
}

export type DataGridAppColumnExportMetadata<TRow = unknown> = DataGridColumnExportOptions<TRow>
