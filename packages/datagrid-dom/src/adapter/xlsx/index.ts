import type { DataGridApi, DataGridColumnSnapshot, DataGridRowNode } from "@affino/datagrid-core"
import { columnToExcel, type WorksheetCell, type WorksheetRow, type XlsxWorkbookInput } from "@affino/export-xlsx"
import type { DataGridFormulaAstNode } from "@affino/datagrid-formula-engine"
import type { DataGridDomColumnExportOptions } from "../contracts.js"

export type DataGridDomXlsxColumnOptions = DataGridDomColumnExportOptions

export interface ExportDataGridDomXlsxOptions {
  fileName?: string
  sheetName?: string
  columns?: "visible" | "all"
  includeHeaders?: boolean
  headerFillColor?: string
  headerFontColor?: string
  /** "values" is the default; "excel" translates same-row Affino formulas to Excel formulas. */
  formulas?: "values" | "excel"
  signal?: AbortSignal
}

export type ExportDataGridDomXlsxResult =
  | { status: "success"; fileName: string; bytes: Uint8Array; rowCount: number; columnCount: number; warnings: readonly string[] }
  | { status: "cancelled" }
  | { status: "unsupported"; code: "pivot-view" | "incomplete-data" | "worker-unavailable" | "formula-translation"; message: string }
  | { status: "error"; code: "worker-error" | "snapshot-changed"; message: string }

type ExportableColumn<TRow> = DataGridColumnSnapshot & {
  column: {
    label?: string
    field?: string
    dataType?: DataGridDomXlsxColumnOptions["dataType"]
    export?: DataGridDomXlsxColumnOptions
    valueGetter?: (row: TRow) => unknown
    accessor?: (row: TRow) => unknown
  }
}

function columnValue<TRow>(api: DataGridApi<TRow>, row: DataGridRowNode<TRow>, column: DataGridColumnSnapshot): unknown {
  const resolved = api.cells.resolveValue({
    rowId: row.rowId,
    columnKey: column.key,
    purpose: "computed",
    snapshot: { row, column },
  })
  if (resolved.status === "available") return resolved.computedValue
  const definition = column.column as ExportableColumn<TRow>["column"]
  if (definition.valueGetter) return definition.valueGetter(row.data)
  if (definition.accessor) return definition.accessor(row.data)
  const field = definition.field ?? column.key
  let value: unknown = row.data
  for (const segment of field.split(".")) {
    if (value == null || typeof value !== "object") return undefined
    value = (value as Record<string, unknown>)[segment]
  }
  return value
}

function numberFormat<TRow>(column: ExportableColumn<TRow>): string | undefined {
  if (column.column.export?.numberFormat) return column.column.export.numberFormat
  switch (column.column.export?.dataType ?? column.column.dataType) {
    case "date": return "yyyy-mm-dd"
    case "datetime": return "yyyy-mm-dd hh:mm:ss"
    case "percent": return "0.00%"
    case "currency": return '"$"#,##0.00'
    case "number": return "#,##0.##"
    default: return undefined
  }
}

function toCell<TRow>(value: unknown, column: ExportableColumn<TRow>): WorksheetCell | null {
  if (value == null || value === "") return null
  const declaredType = column.column.export?.dataType ?? column.column.dataType
  const format = numberFormat(column)
  const customStyle = column.column.export?.style
  const style = format || customStyle ? { ...(format ? { numberFormat: format } : {}), ...customStyle } : undefined
  if (declaredType === "text") return { type: "string", value: String(value), style }
  if (declaredType === "date" || declaredType === "datetime") {
    const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null
    return date && Number.isFinite(date.getTime()) ? { type: "date", value: new Date(date.getTime()), style } : { type: "string", value: String(value) }
  }
  if (typeof value === "number" && Number.isFinite(value)) return { type: "number", value, style }
  if (typeof value === "boolean") return { type: "boolean", value }
  if (value instanceof Date && Number.isFinite(value.getTime())) return { type: "date", value: new Date(value.getTime()), style }
  if (typeof value === "bigint") return { type: "string", value: value.toString() }
  if (typeof value === "string") return { type: "string", value }
  try { return { type: "string", value: JSON.stringify(value) ?? String(value) } }
  catch { return { type: "string", value: String(value) } }
}

function columnWidth<TRow>(column: ExportableColumn<TRow>): number | undefined {
  const width = column.column.export?.width ?? column.width
  if (typeof width !== "number" || !Number.isFinite(width)) return undefined
  return column.column.export?.width !== undefined
    ? Math.max(1, Math.min(255, width))
    : Math.max(8, Math.min(60, (width - 5) / 7))
}

function columnsStillMatch(
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
  })
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
    if (typeof node.value === "string") return `"${node.value.replace(/"/g, "\"\"")}"`
    if (typeof node.value === "boolean") return node.value ? "TRUE" : "FALSE"
    if (node.value == null) return '""'
    throw new FormulaTranslationError("Array and object literals are not supported in Excel formulas.")
  }
  if (node.kind === "identifier") {
    if (node.sheetReference || node.rowSelector.kind !== "current") {
      throw new FormulaTranslationError(`Reference '${node.referenceName}' is not a same-row column reference.`)
    }
    const index = columnIndexes.get(node.referenceName.toLocaleLowerCase("en-US"))
    if (index === undefined) throw new FormulaTranslationError(`Referenced column '${node.referenceName}' is not included in this export.`)
    return `${columnToExcel(index)}${rowNumber}`
  }
  if (node.kind === "unary") {
    const value = excelFormulaNode(node.value, rowNumber, columnIndexes)
    return node.operator === "NOT" ? `NOT(${value})` : `${node.operator}(${value})`
  }
  if (node.kind === "binary") {
    const left = excelFormulaNode(node.left, rowNumber, columnIndexes)
    const right = excelFormulaNode(node.right, rowNumber, columnIndexes)
    if (node.operator === "AND" || node.operator === "OR") return `${node.operator}(${left},${right})`
    const operator = node.operator === "==" ? "=" : node.operator === "!=" ? "<>" : node.operator
    return `(${left}${operator}${right})`
  }
  const args = node.args.map(argument => excelFormulaNode(argument, rowNumber, columnIndexes))
  if (node.name.toLocaleUpperCase("en-US") === "SAFE_DIVIDE") {
    if (args.length < 2 || args.length > 3) throw new FormulaTranslationError("SAFE_DIVIDE requires two or three arguments for Excel export.")
    return `IF(${args[1]}=0,${args[2] ?? "0"},${args[0]}/${args[1]})`
  }
  const name = node.name.toLocaleUpperCase("en-US")
  const supported = new Set(["IF", "SUM", "AVERAGE", "MIN", "MAX", "ROUND", "ABS", "AND", "OR", "NOT", "COUNT", "COUNTA"])
  if (!supported.has(name)) throw new FormulaTranslationError(`Function '${node.name}' has no Excel export mapping.`)
  return `${name}(${args.join(",")})`
}

type FormulaParser = (formula: string) => { ast: DataGridFormulaAstNode }

function compileExcelFormula(
  formula: string,
  rowNumber: number,
  columnIndexes: ReadonlyMap<string, number>,
  parseFormula: FormulaParser,
): string {
  return `=${excelFormulaNode(parseFormula(formula).ast, rowNumber, columnIndexes)}`
}

function excelCachedValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (value == null) return undefined
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString()
  return String(value)
}

function subtotalFunction(op: string): number | null {
  switch (op) {
    case "avg": return 1
    case "countNonNull": return 3
    case "max": return 4
    case "min": return 5
    case "sum": return 9
    default: return null
  }
}

/** Captures the complete Core projection and serializes it away from the UI thread. */
export async function exportDataGridDomXlsx<TRow>(
  api: DataGridApi<TRow>,
  options: ExportDataGridDomXlsxOptions = {},
): Promise<ExportDataGridDomXlsxResult> {
  if (options.signal?.aborted) return { status: "cancelled" }
  if (typeof Worker === "undefined") {
    return { status: "unsupported", code: "worker-unavailable", message: "XLSX generation requires Web Worker support." }
  }
  const view = api.read.captureView({ include: options.formulas === "excel" ? ["rows", "columns", "computed"] : ["rows", "columns"] })
  const rowsView = view.rows?.status === "available" ? view.rows.value : null
  const columnsView = view.columns?.status === "available" ? view.columns.value : null
  if (!rowsView || !columnsView) {
    return { status: "unsupported", code: "incomplete-data", message: "Core could not provide a complete export snapshot." }
  }
  if (rowsView.snapshot.loading || rowsView.snapshot.initialLoading || rowsView.coverage.completeness !== "complete"
    || rowsView.projection.some(row => (row as DataGridRowNode<TRow> & { __placeholder?: boolean }).__placeholder)) {
    return { status: "unsupported", code: "incomplete-data", message: "Partial and placeholder projections are refused to prevent incomplete exports." }
  }
  const isPivotProjection = rowsView.snapshot.pivotModel != null
  const columns = (isPivotProjection || options.columns !== "all"
    ? columnsView.visibleColumns
    : columnsView.columns) as readonly ExportableColumn<TRow>[]
  const computedView = view.computed?.status === "available" ? view.computed.value : null
  const formulaFields = options.formulas === "excel" ? computedView?.formulas ?? api.rows.getFormulaFields() : []
  let parseFormula: FormulaParser | null = null
  if (options.formulas === "excel" && formulaFields.length > 0) {
    try {
      parseFormula = (await import("@affino/datagrid-formula-engine")).parseDataGridFormulaExpression
    } catch {
      return {
        status: "unsupported",
        code: "formula-translation",
        message: "Excel formula export requires the optional @affino/datagrid-formula-engine package.",
      }
    }
  }
  const formulasByField = new Map(formulaFields.map(field => [field.field.toLocaleLowerCase("en-US"), field.formula]))
  const columnIndexes = new Map(columns.map((column, index) => [column.key.toLocaleLowerCase("en-US"), index]))
  const rows: WorksheetRow[] = []
  const rowOutlineLevels: number[] = []
  if (options.includeHeaders !== false) {
    rows.push(columns.map(column => ({
      type: "string" as const,
      value: column.column.export?.header ?? column.column.label ?? column.key,
      style: { bold: true, fillColor: options.headerFillColor ?? "FFF1F3F5", fontColor: options.headerFontColor },
    })))
    rowOutlineLevels.push(0)
  }
  const warnings = new Set<string>()
  const projectedGroups: Array<{ outputIndex: number; level: number; aggregates: Record<string, unknown> }> = []
  let activeGroupDepth = 0
  for (const node of rowsView.projection) {
    if (options.signal?.aborted) return { status: "cancelled" }
    if (node.kind === "group") {
      const meta = node.groupMeta
      const labelIndex = Math.max(0, columns.findIndex(column => column.key === meta?.groupField))
      activeGroupDepth = Math.max(0, Math.min(7, Math.trunc(meta?.level ?? 0) + 1))
      const label = meta ? `${meta.groupValue}${meta.childrenCount > 0 ? ` (${meta.childrenCount})` : ""}` : String(node.rowId)
      projectedGroups.push({ outputIndex: rows.length, level: meta?.level ?? 0, aggregates: meta?.aggregates ?? {} })
      rows.push(columns.map((column, index) => {
        if (meta?.aggregates && Object.prototype.hasOwnProperty.call(meta.aggregates, column.key)) {
          return toCell(meta.aggregates[column.key], column)
        }
        return index === labelIndex
          ? { type: "string" as const, value: label, style: { bold: true, indent: Math.min(15, meta?.level ?? 0) } }
          : null
      }))
      // Summary rows sit above their details. In OOXML the detail rows receive
      // the deeper outline level; the group summary itself keeps its parent level.
      rowOutlineLevels.push(Math.max(0, Math.min(7, Math.trunc(meta?.level ?? 0))))
      continue
    }
    const worksheetRowNumber = rows.length + 1
    let formulaFailure: string | null = null
    rows.push(columns.map(column => {
      const formula = formulasByField.get(column.key.toLocaleLowerCase("en-US"))
      if (!formula || options.formulas !== "excel") return toCell(columnValue(api, node, column), column)
      try {
        const value = columnValue(api, node, column)
        const cache = excelCachedValue(value)
        const numberFormatValue = numberFormat(column)
        const style = numberFormatValue || column.column.export?.style
          ? { ...(numberFormatValue ? { numberFormat: numberFormatValue } : {}), ...column.column.export?.style }
          : undefined
        return {
          type: "formula" as const,
          value: compileExcelFormula(formula, worksheetRowNumber, columnIndexes, parseFormula!),
          ...(cache !== undefined ? { cachedValue: cache } : {}),
          style,
        }
      } catch (error) {
        formulaFailure = `Formula '${column.key}' cannot be exported: ${error instanceof Error ? error.message : String(error)}`
        return null
      }
    }))
    if (formulaFailure) return { status: "unsupported", code: "formula-translation", message: formulaFailure }
    rowOutlineLevels.push(activeGroupDepth)
  }
  if (!isPivotProjection && options.formulas === "excel" && projectedGroups.length > 0) {
    const aggregation = api.rows.getAggregationModel()
    if (aggregation) {
      const nextGroupBoundary = new Map<number, number>()
      const closestGroupByLevel = new Map<number, number>()
      for (let groupIndex = projectedGroups.length - 1; groupIndex >= 0; groupIndex -= 1) {
        const group = projectedGroups[groupIndex]
        if (!group) continue
        let boundary: number | undefined
        for (const [level, outputIndex] of closestGroupByLevel) {
          if (level <= group.level && (boundary === undefined || outputIndex < boundary)) boundary = outputIndex
        }
        if (boundary !== undefined) nextGroupBoundary.set(group.outputIndex, boundary)
        closestGroupByLevel.set(group.level, group.outputIndex)
      }
      for (const group of projectedGroups) {
        const rangeStart = group.outputIndex + 2
        const rangeEnd = nextGroupBoundary.get(group.outputIndex) ?? rows.length
        if (rangeStart > rangeEnd) continue
        const groupRow = rows[group.outputIndex]
        if (!groupRow) continue
        const nextRow = [...groupRow]
        for (const spec of aggregation.columns) {
          if (!Object.prototype.hasOwnProperty.call(group.aggregates, spec.key)) continue
          const operation = subtotalFunction(spec.op)
          const targetIndex = columns.findIndex(column => column.key === spec.key)
          const sourceIndex = columns.findIndex(column => column.key === (spec.field ?? spec.key)
            || (column.column as { field?: string }).field === (spec.field ?? spec.key))
          if (aggregation.basis === "source" || operation === null || targetIndex < 0 || sourceIndex < 0) {
            warnings.add("Some group aggregates remain cached values because their basis, operation, or source column cannot be represented by the exported rows.")
            continue
          }
          const target = columns[targetIndex]
          if (!target) continue
          const cachedValue = excelCachedValue(group.aggregates[spec.key])
          const format = numberFormat(target)
          const style = format || target.column.export?.style
            ? { ...(format ? { numberFormat: format } : {}), ...target.column.export?.style }
            : undefined
          nextRow[targetIndex] = {
            type: "formula",
            value: `=SUBTOTAL(${operation},${columnToExcel(sourceIndex)}${rangeStart}:${columnToExcel(sourceIndex)}${rangeEnd})`,
            ...(cachedValue !== undefined ? { cachedValue } : {}),
            style,
          }
        }
        rows[group.outputIndex] = nextRow
      }
    }
  }
  const workbook: XlsxWorkbookInput = {
    sheets: [{
      name: options.sheetName ?? "Data",
      rows,
      headerRows: options.includeHeaders === false ? 0 : 1,
      freezeRows: options.includeHeaders === false ? 0 : 1,
      columns: columns.map(column => ({ width: columnWidth(column) })),
      rowOutlineLevels,
    }],
  }
  const initialRevision = rowsView.snapshot.revision
  if (api.rows.getSnapshot().revision !== initialRevision
    || !columnsStillMatch(columnsView.columns, api.columns.getSnapshot().columns)) {
    return { status: "error", code: "snapshot-changed", message: "Grid rows or columns changed while the export snapshot was being prepared." }
  }
  return writeInWorker(workbook, options, rowsView.projection.length, columns.length, Array.from(warnings))
}

function writeInWorker(
  workbook: XlsxWorkbookInput,
  options: ExportDataGridDomXlsxOptions,
  rowCount: number,
  columnCount: number,
  warnings: readonly string[],
): Promise<ExportDataGridDomXlsxResult> {
  if (options.signal?.aborted) return Promise.resolve({ status: "cancelled" })
  return new Promise(resolve => {
    let worker: Worker
    try { worker = new Worker(new URL("./xlsx.worker.js", import.meta.url), { type: "module" }) }
    catch (error) { resolve({ status: "error", code: "worker-error", message: error instanceof Error ? error.message : String(error) }); return }
    let settled = false
    const finish = (result: ExportDataGridDomXlsxResult): void => {
      if (settled) return
      settled = true
      options.signal?.removeEventListener("abort", onAbort)
      worker.terminate()
      resolve(result)
    }
    const onAbort = (): void => finish({ status: "cancelled" })
    options.signal?.addEventListener("abort", onAbort, { once: true })
    worker.onerror = event => finish({ status: "error", code: "worker-error", message: event.message || "XLSX worker failed." })
    worker.onmessage = (event: MessageEvent<{ bytes?: ArrayBuffer; error?: string }>) => {
      if (event.data.error) finish({ status: "error", code: "worker-error", message: event.data.error })
      else if (event.data.bytes) finish({
        status: "success",
        fileName: options.fileName?.trim() || "export.xlsx",
        bytes: new Uint8Array(event.data.bytes),
        rowCount,
        columnCount,
        warnings,
      })
      else finish({ status: "error", code: "worker-error", message: "XLSX worker returned an empty result." })
    }
    try { worker.postMessage(workbook) }
    catch (error) { finish({ status: "error", code: "worker-error", message: error instanceof Error ? error.message : String(error) }) }
  })
}

export function downloadDataGridDomXlsx(result: Extract<ExportDataGridDomXlsxResult, { status: "success" }>, document: Document): void {
  const bytes = Uint8Array.from(result.bytes).buffer as ArrayBuffer
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = result.fileName
  anchor.click()
  document.defaultView?.setTimeout(() => URL.revokeObjectURL(url), 0)
}
