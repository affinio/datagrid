import type { DataGridRowId } from "../models/rowModel.js"
import {
  diagnoseDataGridFormulaExpression,
  normalizeFormulaReference,
  parseDataGridFormulaExpression,
  type DataGridFormulaDiagnostic,
  type DataGridFormulaFunctionRegistry,
  type DataGridFormulaParseResult,
  type DataGridFormulaReferenceParserOptions,
  type DataGridFormulaRowSelector,
  type DataGridFormulaSourceSpan,
} from "../models/formula/formulaEngine.js"
import type { DataGridFormulaAstNode } from "@affino/datagrid-formula-engine"

export type DataGridSpreadsheetFormulaReferenceOutputSyntax = "canonical" | "smartsheet"
export type DataGridSpreadsheetCellInputKind = "blank" | "value" | "formula"

export interface DataGridSpreadsheetCellAddress {
  sheetId?: string | null
  rowId?: DataGridRowId | null
  rowIndex: number
  columnKey: string
}

export interface DataGridSpreadsheetTextSelection {
  start: number
  end: number
}

export interface DataGridSpreadsheetFormulaReferenceInput {
  sheetReference?: string | null
  referenceName: string
  rangeReferenceName?: string | null
  rowIndex?: number | null
  rowSelector?: DataGridFormulaRowSelector | null
}

export interface DataGridSpreadsheetFormulaReferenceSpan {
  key: string
  index: number
  colorIndex: number
  text: string
  identifier: string
  sheetReference: string | null
  referenceName: string
  rangeReferenceName: string | null
  rowSelector: DataGridFormulaRowSelector
  span: DataGridFormulaSourceSpan
  targetRowIndexes: readonly number[]
}

export interface DataGridSpreadsheetCellInputAnalysis {
  rawInput: string
  kind: DataGridSpreadsheetCellInputKind
  formula: string | null
  formulaSpan: DataGridFormulaSourceSpan | null
  valueText: string | null
  diagnostics: readonly DataGridFormulaDiagnostic[]
  references: readonly DataGridSpreadsheetFormulaReferenceSpan[]
  isFormulaValid: boolean
}

export interface DataGridSpreadsheetFormulaReferenceModel {
  key: string
  index: number
  text: string
  span: DataGridFormulaSourceSpan
  sheetReference: string | null
  referenceName: string
  rangeReferenceName: string | null
  rowSelector: DataGridFormulaRowSelector
  outputSyntax: DataGridSpreadsheetFormulaReferenceOutputSyntax
  rawText?: string | null
}

export interface DataGridSpreadsheetCellFormulaModel {
  rawInput: string
  formula: string
  references: readonly DataGridSpreadsheetFormulaReferenceModel[]
  isFormulaValid: boolean
  diagnostics: readonly DataGridFormulaDiagnostic[]
}

export type DataGridSpreadsheetFormulaReferenceBinding =
  | {
    key: string
    index: number
    kind: "reference"
    sheetReference: string | null
    referenceName: string
    rangeReferenceName: string | null
    rowSelector: DataGridFormulaRowSelector
  }
  | {
    key: string
    index: number
    kind: "invalid"
  }

export interface DataGridSpreadsheetCellFormulaRuntimeModel {
  formula: string
  bindings: readonly DataGridSpreadsheetFormulaReferenceBinding[]
  isFormulaValid: boolean
  diagnostics: readonly DataGridFormulaDiagnostic[]
}

export type DataGridSpreadsheetFormulaReferenceModelReplacement =
  | (DataGridSpreadsheetFormulaReferenceInput & {
    outputSyntax?: DataGridSpreadsheetFormulaReferenceOutputSyntax
  })
  | { rawText: string }

export type DataGridSpreadsheetFormulaReferenceBindingReplacement =
  | (DataGridSpreadsheetFormulaReferenceInput & {
    kind?: "reference"
  })
  | { kind: "invalid" }

export interface DataGridSpreadsheetCellFormulaModelMutationOptions {
  currentRowIndex?: number | null
  referenceParserOptions?: DataGridFormulaReferenceParserOptions
}

export interface AnalyzeDataGridSpreadsheetCellInputOptions {
  currentRowIndex?: number | null
  rowCount?: number | null
  resolveReferenceRowCount?: (
    reference: Pick<DataGridSpreadsheetFormulaReferenceSpan, "sheetReference" | "referenceName" | "rangeReferenceName" | "rowSelector">,
  ) => number | null | undefined
  functionRegistry?: DataGridFormulaFunctionRegistry
  referenceParserOptions?: DataGridFormulaReferenceParserOptions
}

export interface DataGridSpreadsheetFormatFormulaReferenceOptions {
  currentRowIndex?: number | null
  outputSyntax?: DataGridSpreadsheetFormulaReferenceOutputSyntax
  referenceParserOptions?: DataGridFormulaReferenceParserOptions
}

export interface DataGridSpreadsheetInsertFormulaReferenceOptions
  extends DataGridSpreadsheetFormatFormulaReferenceOptions {
  selection?: DataGridSpreadsheetTextSelection | null
  ensureFormulaPrefix?: boolean
  replaceWholeInputWhenNotFormula?: boolean
}

export interface DataGridSpreadsheetInsertFormulaReferenceResult {
  input: string
  selection: DataGridSpreadsheetTextSelection
  insertedText: string
}

export interface DataGridSpreadsheetFormulaEditorSnapshot {
  revision: number
  activeCell: DataGridSpreadsheetCellAddress | null
  rawInput: string
  selection: DataGridSpreadsheetTextSelection
  displayValue: unknown
  errorValue: unknown
  analysis: DataGridSpreadsheetCellInputAnalysis
  activeReferenceKey: string | null
}

export type DataGridSpreadsheetFormulaEditorListener = (
  snapshot: DataGridSpreadsheetFormulaEditorSnapshot,
) => void

export interface CreateDataGridSpreadsheetFormulaEditorModelOptions {
  initialCell?: DataGridSpreadsheetCellAddress | null
  initialInput?: string | null
  initialSelection?: DataGridSpreadsheetTextSelection | null
  initialDisplayValue?: unknown
  initialErrorValue?: unknown
  functionRegistry?: DataGridFormulaFunctionRegistry
  referenceParserOptions?: DataGridFormulaReferenceParserOptions
  outputSyntax?: DataGridSpreadsheetFormulaReferenceOutputSyntax
  resolveRowCount?: (cell: DataGridSpreadsheetCellAddress | null) => number | null | undefined
  resolveReferenceRowCount?: (
    reference: Pick<DataGridSpreadsheetFormulaReferenceSpan, "sheetReference" | "referenceName" | "rangeReferenceName" | "rowSelector">,
    activeCell: DataGridSpreadsheetCellAddress | null,
  ) => number | null | undefined
}

export interface DataGridSpreadsheetFormulaEditorModel {
  getSnapshot(): DataGridSpreadsheetFormulaEditorSnapshot
  start(
    cell: DataGridSpreadsheetCellAddress,
    rawInput?: string | null,
    options?: {
      selection?: DataGridSpreadsheetTextSelection | null
      displayValue?: unknown
      errorValue?: unknown
    },
  ): void
  setInput(rawInput: string): void
  setSelection(selection: DataGridSpreadsheetTextSelection | null): void
  insertReference(
    reference: DataGridSpreadsheetFormulaReferenceInput,
    options?: Omit<DataGridSpreadsheetInsertFormulaReferenceOptions, "selection">,
  ): DataGridSpreadsheetInsertFormulaReferenceResult
  setDisplayValue(value: unknown): void
  setErrorValue(value: unknown): void
  clear(): void
  subscribe(listener: DataGridSpreadsheetFormulaEditorListener): () => void
  dispose(): void
}

interface PreparedFormulaInput {
  markerIndex: number
  expression: string
  expressionStart: number
  expressionEnd: number
}

function isWhitespace(character: string | undefined): boolean {
  return character === " " || character === "\t" || character === "\n" || character === "\r"
}

function normalizeCellAddress(
  cell: DataGridSpreadsheetCellAddress,
): DataGridSpreadsheetCellAddress {
  const columnKey = String(cell.columnKey ?? "").trim()
  const rowIndex = Math.trunc(cell.rowIndex)
  if (columnKey.length === 0) {
    throw new Error("[DataGridSpreadsheet] columnKey must be non-empty.")
  }
  if (!Number.isFinite(rowIndex) || rowIndex < 0) {
    throw new Error("[DataGridSpreadsheet] rowIndex must be >= 0.")
  }
  return {
    sheetId: typeof cell.sheetId === "string" && cell.sheetId.trim().length > 0 ? cell.sheetId : null,
    rowId: typeof cell.rowId === "string" || typeof cell.rowId === "number" ? cell.rowId : null,
    rowIndex,
    columnKey,
  }
}

function cloneCellAddress(
  cell: DataGridSpreadsheetCellAddress | null,
): DataGridSpreadsheetCellAddress | null {
  return cell ? { ...cell } : null
}

function normalizeTextSelection(
  selection: DataGridSpreadsheetTextSelection | null | undefined,
  textLength: number,
): DataGridSpreadsheetTextSelection {
  if (!selection) {
    return { start: textLength, end: textLength }
  }
  const normalizedStart = Math.max(0, Math.min(textLength, Math.trunc(selection.start)))
  const normalizedEnd = Math.max(0, Math.min(textLength, Math.trunc(selection.end)))
  return normalizedStart <= normalizedEnd
    ? { start: normalizedStart, end: normalizedEnd }
    : { start: normalizedEnd, end: normalizedStart }
}

function cloneTextSelection(selection: DataGridSpreadsheetTextSelection): DataGridSpreadsheetTextSelection {
  return { start: selection.start, end: selection.end }
}

function shiftFormulaSpan(
  span: DataGridFormulaSourceSpan,
  offset: number,
): DataGridFormulaSourceSpan {
  return {
    start: span.start + offset,
    end: span.end + offset,
  }
}

function cloneFormulaRowSelector(
  rowSelector: DataGridFormulaRowSelector,
): DataGridFormulaRowSelector {
  if (rowSelector.kind === "current") {
    return { kind: "current" }
  }
  if (rowSelector.kind === "absolute") {
    return { kind: "absolute", rowIndex: rowSelector.rowIndex }
  }
  if (rowSelector.kind === "absolute-window") {
    return {
      kind: "absolute-window",
      startRowIndex: rowSelector.startRowIndex,
      endRowIndex: rowSelector.endRowIndex,
    }
  }
  if (rowSelector.kind === "relative") {
    return { kind: "relative", offset: rowSelector.offset }
  }
  return {
    kind: "window",
    startOffset: rowSelector.startOffset,
    endOffset: rowSelector.endOffset,
  }
}

function cloneSpreadsheetFormulaDiagnostics(
  diagnostics: readonly DataGridFormulaDiagnostic[],
): readonly DataGridFormulaDiagnostic[] {
  return Object.freeze(diagnostics.map(diagnostic => Object.freeze({
    ...diagnostic,
    span: { ...diagnostic.span },
  })))
}

function createSpreadsheetFormulaDiagnostic(
  message: string,
  span: DataGridFormulaSourceSpan,
): DataGridFormulaDiagnostic {
  return {
    severity: "error",
    message,
    span,
  }
}

function prepareFormulaInput(rawInput: string): PreparedFormulaInput | null {
  let trimmedStart = 0
  while (trimmedStart < rawInput.length && isWhitespace(rawInput[trimmedStart])) {
    trimmedStart += 1
  }
  if (trimmedStart >= rawInput.length || rawInput[trimmedStart] !== "=") {
    return null
  }

  let expressionStart = trimmedStart + 1
  while (expressionStart < rawInput.length && isWhitespace(rawInput[expressionStart])) {
    expressionStart += 1
  }

  let expressionEnd = rawInput.length
  while (expressionEnd > expressionStart && isWhitespace(rawInput[expressionEnd - 1])) {
    expressionEnd -= 1
  }

  return {
    markerIndex: trimmedStart,
    expression: rawInput.slice(expressionStart, expressionEnd),
    expressionStart,
    expressionEnd,
  }
}

function resolveTargetRowIndexes(
  rowSelector: DataGridFormulaRowSelector,
  currentRowIndex: number | null | undefined,
  rowCount: number | null | undefined,
): readonly number[] {
  const normalizedCurrentRowIndex = typeof currentRowIndex === "number" && currentRowIndex >= 0
    ? Math.trunc(currentRowIndex)
    : null
  const normalizedRowCount = typeof rowCount === "number" && Number.isFinite(rowCount)
    ? Math.max(0, Math.trunc(rowCount))
    : null

  const clampRowIndex = (rowIndex: number): number | null => {
    if (!Number.isFinite(rowIndex) || rowIndex < 0) {
      return null
    }
    const normalizedRowIndex = Math.trunc(rowIndex)
    if (normalizedRowCount !== null && normalizedRowIndex >= normalizedRowCount) {
      return null
    }
    return normalizedRowIndex
  }

  if (rowSelector.kind === "current") {
    const target = normalizedCurrentRowIndex === null ? null : clampRowIndex(normalizedCurrentRowIndex)
    return Object.freeze(target === null ? [] : [target])
  }
  if (rowSelector.kind === "absolute") {
    const target = clampRowIndex(rowSelector.rowIndex)
    return Object.freeze(target === null ? [] : [target])
  }
  if (rowSelector.kind === "absolute-window") {
    const targetRowIndexes: number[] = []
    for (let rowIndex = rowSelector.startRowIndex; rowIndex <= rowSelector.endRowIndex; rowIndex += 1) {
      const target = clampRowIndex(rowIndex)
      if (target === null) {
        continue
      }
      targetRowIndexes.push(target)
    }
    return Object.freeze(targetRowIndexes)
  }
  if (normalizedCurrentRowIndex === null) {
    return Object.freeze([])
  }
  if (rowSelector.kind === "relative") {
    const target = clampRowIndex(normalizedCurrentRowIndex + rowSelector.offset)
    return Object.freeze(target === null ? [] : [target])
  }
  const targetRowIndexes: number[] = []
  const step = rowSelector.startOffset <= rowSelector.endOffset ? 1 : -1
  for (
    let offset = rowSelector.startOffset;
    step > 0 ? offset <= rowSelector.endOffset : offset >= rowSelector.endOffset;
    offset += step
  ) {
    const target = clampRowIndex(normalizedCurrentRowIndex + offset)
    if (target === null) {
      continue
    }
    targetRowIndexes.push(target)
  }
  return Object.freeze(targetRowIndexes)
}

function visitFormulaIdentifierNodes(
  root: DataGridFormulaParseResult["ast"],
  visit: (node: Extract<DataGridFormulaParseResult["ast"], { kind: "identifier" }>) => void,
): void {
  if (root.kind === "identifier") {
    visit(root)
    return
  }
  if (root.kind === "call") {
    for (const arg of root.args) {
      visitFormulaIdentifierNodes(arg, visit)
    }
    return
  }
  if (root.kind === "unary") {
    visitFormulaIdentifierNodes(root.value, visit)
    return
  }
  if (root.kind === "binary") {
    visitFormulaIdentifierNodes(root.left, visit)
    visitFormulaIdentifierNodes(root.right, visit)
  }
}

function formatCanonicalReferenceName(referenceName: string): string {
  const normalized = referenceName.trim()
  if (normalized.length === 0) {
    throw new Error("[DataGridSpreadsheet] referenceName must be non-empty.")
  }
  const normalizedReference = normalizeFormulaReference(normalized)
  if (
    /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(normalizedReference)
    || normalizedReference.includes(".")
    || normalizedReference.includes("[")
    || normalizedReference.includes('"')
  ) {
    return normalizedReference
  }
  return `"${normalized.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

function formatFormulaSheetReference(sheetReference: string): string {
  const normalized = String(sheetReference ?? "").trim()
  if (normalized.length === 0) {
    throw new Error("[DataGridSpreadsheet] sheetReference must be non-empty when provided.")
  }
  if (/^[A-Za-z_$][A-Za-z0-9_$.-]*$/.test(normalized)) {
    return normalized
  }
  return `'${normalized.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
}

function formatCanonicalRowSelector(
  rowSelector: DataGridFormulaRowSelector,
): string {
  if (rowSelector.kind === "current") {
    return ""
  }
  if (rowSelector.kind === "absolute") {
    return `[${rowSelector.rowIndex}]`
  }
  if (rowSelector.kind === "absolute-window") {
    return `[${rowSelector.startRowIndex}..${rowSelector.endRowIndex}]`
  }
  if (rowSelector.kind === "relative") {
    return `[${rowSelector.offset >= 0 ? `+${rowSelector.offset}` : rowSelector.offset}]`
  }
  const startOffset = rowSelector.startOffset >= 0 ? `+${rowSelector.startOffset}` : String(rowSelector.startOffset)
  const endOffset = rowSelector.endOffset >= 0 ? `+${rowSelector.endOffset}` : String(rowSelector.endOffset)
  return `[${startOffset}:${endOffset}]`
}

function formatSmartsheetReference(
  sheetReference: string | null | undefined,
  referenceName: string,
  rangeReferenceName: string | null | undefined,
  rowSelector: DataGridFormulaRowSelector,
  options: Pick<DataGridSpreadsheetFormatFormulaReferenceOptions, "referenceParserOptions">,
): string {
  const normalized = referenceName.trim()
  if (normalized.length === 0) {
    throw new Error("[DataGridSpreadsheet] referenceName must be non-empty.")
  }
  if (normalized.includes("]")) {
    throw new Error("[DataGridSpreadsheet] Smartsheet reference names cannot contain ']'.")
  }
  if (
    rowSelector.kind !== "current"
    && rowSelector.kind !== "absolute"
    && rowSelector.kind !== "absolute-window"
  ) {
    throw new Error("[DataGridSpreadsheet] Smartsheet output syntax currently supports only current-row, absolute-row, and same-column range references.")
  }
  const base = options.referenceParserOptions?.smartsheetAbsoluteRowBase === 0 ? 0 : 1
  const normalizedRangeReference = typeof rangeReferenceName === "string" && rangeReferenceName.trim().length > 0
    ? rangeReferenceName.trim()
    : normalized
  const referenceText = rowSelector.kind === "current"
    ? `[${normalized}]@row`
    : rowSelector.kind === "absolute"
      ? `[${normalized}]${rowSelector.rowIndex + base}`
      : `[${normalized}]${rowSelector.startRowIndex + base}:[${normalizedRangeReference}]${rowSelector.endRowIndex + base}`
  const prefix = typeof sheetReference === "string" && sheetReference.trim().length > 0
    ? `${formatFormulaSheetReference(sheetReference)}!`
    : ""
  return `${prefix}${referenceText}`
}

function resolveFormulaReferenceOutputSyntax(
  options: DataGridSpreadsheetFormatFormulaReferenceOptions,
): DataGridSpreadsheetFormulaReferenceOutputSyntax {
  if (options.outputSyntax === "smartsheet") {
    return "smartsheet"
  }
  if (options.outputSyntax === "canonical") {
    return "canonical"
  }
  return options.referenceParserOptions?.syntax === "smartsheet" ? "smartsheet" : "canonical"
}

function resolveFormulaReferenceRowSelector(
  reference: DataGridSpreadsheetFormulaReferenceInput,
  currentRowIndex: number | null | undefined,
): DataGridFormulaRowSelector {
  if (reference.rowSelector) {
    return cloneFormulaRowSelector(reference.rowSelector)
  }
  if (typeof reference.rowIndex === "number" && Number.isFinite(reference.rowIndex)) {
    const normalizedRowIndex = Math.trunc(reference.rowIndex)
    if (normalizedRowIndex < 0) {
      throw new Error("[DataGridSpreadsheet] Absolute row references must be >= 0.")
    }
    if (typeof currentRowIndex === "number" && currentRowIndex >= 0 && normalizedRowIndex === Math.trunc(currentRowIndex)) {
      return { kind: "current" }
    }
    return {
      kind: "absolute",
      rowIndex: normalizedRowIndex,
    }
  }
  return { kind: "current" }
}

export function analyzeDataGridSpreadsheetCellInput(
  rawInput: string,
  options: AnalyzeDataGridSpreadsheetCellInputOptions = {},
): DataGridSpreadsheetCellInputAnalysis {
  const normalizedRawInput = String(rawInput ?? "")
  const trimmed = normalizedRawInput.trim()
  if (trimmed.length === 0) {
    return {
      rawInput: normalizedRawInput,
      kind: "blank",
      formula: null,
      formulaSpan: null,
      valueText: null,
      diagnostics: Object.freeze([]),
      references: Object.freeze([]),
      isFormulaValid: false,
    }
  }

  const preparedFormula = prepareFormulaInput(normalizedRawInput)
  if (!preparedFormula) {
    return {
      rawInput: normalizedRawInput,
      kind: "value",
      formula: null,
      formulaSpan: null,
      valueText: normalizedRawInput,
      diagnostics: Object.freeze([]),
      references: Object.freeze([]),
      isFormulaValid: false,
    }
  }

  const formulaSpan = {
    start: preparedFormula.expressionStart,
    end: preparedFormula.expressionEnd,
  }

  if (preparedFormula.expression.length === 0) {
    const diagnosticSpan = {
      start: preparedFormula.markerIndex,
      end: Math.min(normalizedRawInput.length, preparedFormula.markerIndex + 1),
    }
    return {
      rawInput: normalizedRawInput,
      kind: "formula",
      formula: "",
      formulaSpan,
      valueText: null,
      diagnostics: Object.freeze([
        createSpreadsheetFormulaDiagnostic(
          "Formula must be non-empty.",
          diagnosticSpan,
        ),
      ]),
      references: Object.freeze([]),
      isFormulaValid: false,
    }
  }

  const diagnostics = diagnoseDataGridFormulaExpression(preparedFormula.expression, {
    functionRegistry: options.functionRegistry,
    referenceParserOptions: options.referenceParserOptions,
  })

  let parsedAst = diagnostics.ok ? diagnostics.ast ?? null : null
  if (!parsedAst) {
    try {
      parsedAst = parseDataGridFormulaExpression(preparedFormula.expression, {
        referenceParserOptions: options.referenceParserOptions,
      }).ast
    } catch {
      parsedAst = null
    }
  }

  if (!diagnostics.ok && !parsedAst) {
    return {
      rawInput: normalizedRawInput,
      kind: "formula",
      formula: preparedFormula.expression,
      formulaSpan,
      valueText: null,
      diagnostics: Object.freeze(
        diagnostics.diagnostics.map(diagnostic => ({
          ...diagnostic,
          span: shiftFormulaSpan(diagnostic.span, preparedFormula.expressionStart),
        })),
      ),
      references: Object.freeze([]),
      isFormulaValid: false,
    }
  }

  const references: DataGridSpreadsheetFormulaReferenceSpan[] = []
  if (parsedAst) {
    visitFormulaIdentifierNodes(parsedAst, (node) => {
      const span = shiftFormulaSpan(node.span, preparedFormula.expressionStart)
      const rowSelector = cloneFormulaRowSelector(node.rowSelector)
      const sheetReference = node.sheetReference ?? null
      references.push({
        key: `${references.length}:${node.name}:${span.start}:${span.end}`,
        index: references.length,
        colorIndex: references.length,
        text: normalizedRawInput.slice(span.start, span.end),
        identifier: node.name,
        sheetReference,
        referenceName: node.referenceName,
        rangeReferenceName: node.rangeReferenceName ?? null,
        rowSelector,
        span,
        targetRowIndexes: resolveTargetRowIndexes(
          rowSelector,
          options.currentRowIndex,
          options.resolveReferenceRowCount?.({
            sheetReference,
            referenceName: node.referenceName,
            rangeReferenceName: node.rangeReferenceName ?? null,
            rowSelector,
          }) ?? options.rowCount,
        ),
      })
    })
  }

  if (!diagnostics.ok) {
    return {
      rawInput: normalizedRawInput,
      kind: "formula",
      formula: preparedFormula.expression,
      formulaSpan,
      valueText: null,
      diagnostics: Object.freeze(
        diagnostics.diagnostics.map(diagnostic => ({
          ...diagnostic,
          span: shiftFormulaSpan(diagnostic.span, preparedFormula.expressionStart),
        })),
      ),
      references: Object.freeze(references),
      isFormulaValid: false,
    }
  }

  return {
    rawInput: normalizedRawInput,
    kind: "formula",
    formula: preparedFormula.expression,
    formulaSpan,
    valueText: null,
    diagnostics: Object.freeze([]),
    references: Object.freeze(references),
    isFormulaValid: true,
  }
}

export function formatDataGridSpreadsheetFormulaReference(
  reference: DataGridSpreadsheetFormulaReferenceInput,
  options: DataGridSpreadsheetFormatFormulaReferenceOptions = {},
): string {
  const rowSelector = resolveFormulaReferenceRowSelector(reference, options.currentRowIndex)
  const outputSyntax = resolveFormulaReferenceOutputSyntax(options)
  if (outputSyntax === "smartsheet") {
    return formatSmartsheetReference(
      reference.sheetReference,
      reference.referenceName,
      reference.rangeReferenceName ?? null,
      rowSelector,
      options,
    )
  }
  const prefix = typeof reference.sheetReference === "string" && reference.sheetReference.trim().length > 0
    ? `${formatFormulaSheetReference(reference.sheetReference)}!`
    : ""
  const localReference = reference.rangeReferenceName
    ? `${formatCanonicalReferenceName(reference.referenceName)}:${formatCanonicalReferenceName(reference.rangeReferenceName)}`
    : formatCanonicalReferenceName(reference.referenceName)
  return `${prefix}${localReference}${formatCanonicalRowSelector(rowSelector)}`
}

export function insertDataGridSpreadsheetFormulaReference(
  input: string,
  reference: DataGridSpreadsheetFormulaReferenceInput,
  options: DataGridSpreadsheetInsertFormulaReferenceOptions = {},
): DataGridSpreadsheetInsertFormulaReferenceResult {
  let nextInput = String(input ?? "")
  let nextSelection = normalizeTextSelection(options.selection, nextInput.length)
  const ensureFormulaPrefix = options.ensureFormulaPrefix !== false
  const replaceWholeInputWhenNotFormula = options.replaceWholeInputWhenNotFormula !== false

  if (ensureFormulaPrefix && !prepareFormulaInput(nextInput)) {
    if (replaceWholeInputWhenNotFormula) {
      nextInput = "="
      nextSelection = { start: 1, end: 1 }
    } else {
      nextInput = `=${nextInput}`
      nextSelection = {
        start: nextSelection.start + 1,
        end: nextSelection.end + 1,
      }
    }
  }

  const insertedText = formatDataGridSpreadsheetFormulaReference(reference, options)
  const normalizedSelection = normalizeTextSelection(nextSelection, nextInput.length)
  const updatedInput = `${nextInput.slice(0, normalizedSelection.start)}${insertedText}${nextInput.slice(normalizedSelection.end)}`
  const caret = normalizedSelection.start + insertedText.length
  return {
    input: updatedInput,
    selection: {
      start: caret,
      end: caret,
    },
    insertedText,
  }
}

function resolveFormulaReferenceOutputSyntaxFromText(
  text: string,
  options: Pick<DataGridSpreadsheetFormatFormulaReferenceOptions, "referenceParserOptions"> = {},
): DataGridSpreadsheetFormulaReferenceOutputSyntax {
  const normalized = String(text ?? "").trim()
  const localReferenceText = normalized.includes("!")
    ? normalized.slice(normalized.lastIndexOf("!") + 1)
    : normalized
  if (localReferenceText.startsWith("[")) {
    return "smartsheet"
  }
  return resolveFormulaReferenceOutputSyntax(options)
}

export function createDataGridSpreadsheetCellFormulaModel(
  analysis: DataGridSpreadsheetCellInputAnalysis,
  options: Pick<DataGridSpreadsheetFormatFormulaReferenceOptions, "referenceParserOptions"> = {},
): DataGridSpreadsheetCellFormulaModel | null {
  if (analysis.kind !== "formula") {
    return null
  }
  return Object.freeze({
    rawInput: analysis.rawInput,
    formula: analysis.formula ?? "",
    references: Object.freeze(analysis.references.map(reference => Object.freeze({
      key: reference.key,
      index: reference.index,
      text: reference.text,
      span: { ...reference.span },
      sheetReference: reference.sheetReference,
      referenceName: reference.referenceName,
      rangeReferenceName: reference.rangeReferenceName,
      rowSelector: cloneFormulaRowSelector(reference.rowSelector),
      outputSyntax: resolveFormulaReferenceOutputSyntaxFromText(reference.text, options),
      rawText: null,
    }))),
    isFormulaValid: analysis.isFormulaValid,
    diagnostics: cloneSpreadsheetFormulaDiagnostics(analysis.diagnostics),
  })
}

export function createDataGridSpreadsheetCellFormulaRuntimeModel(
  analysis: DataGridSpreadsheetCellInputAnalysis,
): DataGridSpreadsheetCellFormulaRuntimeModel | null {
  if (analysis.kind !== "formula") {
    return null
  }
  return Object.freeze({
    formula: analysis.formula ?? "",
    bindings: Object.freeze(analysis.references.map(reference => Object.freeze({
      key: reference.key,
      index: reference.index,
      kind: "reference" as const,
      sheetReference: reference.sheetReference,
      referenceName: reference.referenceName,
      rangeReferenceName: reference.rangeReferenceName,
      rowSelector: cloneFormulaRowSelector(reference.rowSelector),
    }))),
    isFormulaValid: analysis.isFormulaValid,
    diagnostics: cloneSpreadsheetFormulaDiagnostics(analysis.diagnostics),
  })
}

export function renderDataGridSpreadsheetCellFormulaModel(
  model: DataGridSpreadsheetCellFormulaModel,
  options: DataGridSpreadsheetCellFormulaModelMutationOptions = {},
): string {
  let nextInput = model.rawInput
  const references = [...model.references].sort((left, right) => right.span.start - left.span.start)
  for (const reference of references) {
    const replacement = reference.rawText != null
      ? String(reference.rawText)
      : formatDataGridSpreadsheetFormulaReference({
        sheetReference: reference.sheetReference,
        referenceName: reference.referenceName,
        rangeReferenceName: reference.rangeReferenceName,
        rowSelector: reference.rowSelector,
      }, {
        currentRowIndex: options.currentRowIndex,
        outputSyntax: reference.outputSyntax,
        referenceParserOptions: options.referenceParserOptions,
      })
    nextInput = `${nextInput.slice(0, reference.span.start)}${replacement}${nextInput.slice(reference.span.end)}`
  }
  return nextInput
}

export function mapDataGridSpreadsheetCellFormulaRuntimeModelBindings(
  model: DataGridSpreadsheetCellFormulaRuntimeModel,
  mutate: (
    binding: DataGridSpreadsheetFormulaReferenceBinding,
  ) => DataGridSpreadsheetFormulaReferenceBindingReplacement | null,
  options: DataGridSpreadsheetCellFormulaModelMutationOptions = {},
): DataGridSpreadsheetCellFormulaRuntimeModel {
  let changed = false
  const nextBindings = model.bindings.map((binding) => {
    const replacement = mutate(binding)
    if (!replacement) {
      return binding
    }
    changed = true
    if (replacement.kind === "invalid") {
      return Object.freeze({
        key: binding.key,
        index: binding.index,
        kind: "invalid" as const,
      })
    }
    return Object.freeze({
      key: binding.key,
      index: binding.index,
      kind: "reference" as const,
      sheetReference: replacement.sheetReference ?? null,
      referenceName: replacement.referenceName,
      rangeReferenceName: replacement.rangeReferenceName ?? null,
      rowSelector: cloneFormulaRowSelector(
        resolveFormulaReferenceRowSelector(replacement, options.currentRowIndex),
      ),
    })
  })
  if (!changed) {
    return model
  }
  return Object.freeze({
    ...model,
    bindings: Object.freeze(nextBindings),
  })
}

export function renderDataGridSpreadsheetCellFormulaRuntimeModel(
  runtimeModel: DataGridSpreadsheetCellFormulaRuntimeModel,
  presentationModel: DataGridSpreadsheetCellFormulaModel,
  options: DataGridSpreadsheetCellFormulaModelMutationOptions = {},
): string {
  const bindingsByIndex = new Map(runtimeModel.bindings.map(binding => [binding.index, binding]))
  const nextReferences = presentationModel.references.map((reference) => {
    const binding = bindingsByIndex.get(reference.index)
    if (!binding || binding.key !== reference.key) {
      return reference
    }
    if (binding.kind === "invalid") {
      return Object.freeze({
        ...reference,
        rawText: "#REF!",
      })
    }
    return Object.freeze({
      ...reference,
      sheetReference: binding.sheetReference,
      referenceName: binding.referenceName,
      rangeReferenceName: binding.rangeReferenceName,
      rowSelector: cloneFormulaRowSelector(binding.rowSelector),
      rawText: null,
    })
  })
  return renderDataGridSpreadsheetCellFormulaModel({
    ...presentationModel,
    references: Object.freeze(nextReferences),
  }, options)
}

export function mapDataGridSpreadsheetCellFormulaModelReferences(
  model: DataGridSpreadsheetCellFormulaModel,
  mutate: (
    reference: DataGridSpreadsheetFormulaReferenceModel,
  ) => DataGridSpreadsheetFormulaReferenceModelReplacement | null,
  options: DataGridSpreadsheetCellFormulaModelMutationOptions = {},
): DataGridSpreadsheetCellFormulaModel {
  let changed = false
  const nextReferences = model.references.map((reference) => {
    const replacement = mutate(reference)
    if (!replacement) {
      return reference
    }
    changed = true
    if ("rawText" in replacement) {
      return Object.freeze({
        ...reference,
        rawText: String(replacement.rawText ?? ""),
      })
    }
    return Object.freeze({
      ...reference,
      sheetReference: replacement.sheetReference ?? null,
      referenceName: replacement.referenceName,
      rangeReferenceName: replacement.rangeReferenceName ?? null,
      rowSelector: cloneFormulaRowSelector(
        resolveFormulaReferenceRowSelector(replacement, options.currentRowIndex),
      ),
      outputSyntax: replacement.outputSyntax ?? reference.outputSyntax,
      rawText: null,
    })
  })
  if (!changed) {
    return model
  }
  const nextRawInput = renderDataGridSpreadsheetCellFormulaModel(
    {
      ...model,
      references: Object.freeze(nextReferences),
    },
    options,
  )
  const nextAnalysis = analyzeDataGridSpreadsheetCellInput(nextRawInput, {
    currentRowIndex: options.currentRowIndex,
    referenceParserOptions: options.referenceParserOptions,
  })
  return createDataGridSpreadsheetCellFormulaModel(nextAnalysis, {
    referenceParserOptions: options.referenceParserOptions,
  }) ?? model
}

export function rewriteDataGridSpreadsheetCellFormulaModelReferences(
  model: DataGridSpreadsheetCellFormulaModel,
  mutate: (
    reference: DataGridSpreadsheetFormulaReferenceModel,
  ) => DataGridSpreadsheetFormulaReferenceModelReplacement | null,
  options: DataGridSpreadsheetCellFormulaModelMutationOptions = {},
): string {
  let changed = false
  const nextReferences = model.references.map((reference) => {
    const replacement = mutate(reference)
    if (!replacement) {
      return reference
    }
    changed = true
    if ("rawText" in replacement) {
      return Object.freeze({
        ...reference,
        rawText: String(replacement.rawText ?? ""),
      })
    }
    return Object.freeze({
      ...reference,
      sheetReference: replacement.sheetReference ?? null,
      referenceName: replacement.referenceName,
      rangeReferenceName: replacement.rangeReferenceName ?? null,
      rowSelector: cloneFormulaRowSelector(
        resolveFormulaReferenceRowSelector(replacement, options.currentRowIndex),
      ),
      outputSyntax: replacement.outputSyntax ?? reference.outputSyntax,
      rawText: null,
    })
  })
  if (!changed) {
    return model.rawInput
  }
  return renderDataGridSpreadsheetCellFormulaModel(
    {
      ...model,
      references: Object.freeze(nextReferences),
    },
    options,
  )
}

export function rewriteDataGridSpreadsheetFormulaReferences(
  rawInput: string,
  rewrite: (
    reference: DataGridSpreadsheetFormulaReferenceSpan,
  ) => DataGridSpreadsheetFormulaReferenceInput | { rawText: string } | null,
  options: AnalyzeDataGridSpreadsheetCellInputOptions = {},
): string {
  const normalizedRawInput = String(rawInput ?? "")
  const analysis = analyzeDataGridSpreadsheetCellInput(normalizedRawInput, options)
  if (analysis.kind !== "formula" || analysis.references.length === 0) {
    return normalizedRawInput
  }

  let nextInput = normalizedRawInput
  let changed = false
  const references = [...analysis.references].sort((left, right) => right.span.start - left.span.start)
  for (const reference of references) {
    const replacementReference = rewrite(reference)
    if (!replacementReference) {
      continue
    }
    const replacement = "rawText" in replacementReference
      ? String(replacementReference.rawText ?? "")
      : formatDataGridSpreadsheetFormulaReference(replacementReference, {
        currentRowIndex: options.currentRowIndex,
        outputSyntax: resolveFormulaReferenceOutputSyntaxFromText(reference.text, options),
        referenceParserOptions: options.referenceParserOptions,
      })
    if (replacement === reference.text) {
      continue
    }
    nextInput = `${nextInput.slice(0, reference.span.start)}${replacement}${nextInput.slice(reference.span.end)}`
    changed = true
  }
  return changed ? nextInput : normalizedRawInput
}

function formatDataGridSpreadsheetStringLiteralReplacement(
  rawLiteralText: string,
  nextLiteralValue: string,
): string {
  const quote = rawLiteralText.startsWith("\"") ? "\"" : "'"
  const escapedValue = String(nextLiteralValue ?? "")
    .split("\\").join("\\\\")
    .split(quote).join(`\\${quote}`)
  return `${quote}${escapedValue}${quote}`
}

export function rewriteDataGridSpreadsheetFormulaStringLiterals(
  rawInput: string,
  rewrite: (
    literalText: string,
    context: {
      callName: string | null
      argumentIndex: number | null
      callArgs: readonly DataGridFormulaAstNode[] | null
    },
  ) => string | null,
  options: AnalyzeDataGridSpreadsheetCellInputOptions = {},
): string {
  const normalizedRawInput = String(rawInput ?? "")
  const analysis = analyzeDataGridSpreadsheetCellInput(normalizedRawInput, options)
  if (analysis.kind !== "formula" || !analysis.formulaSpan || !analysis.formula) {
    return normalizedRawInput
  }

  let ast: DataGridFormulaAstNode | null = null
  try {
    ast = parseDataGridFormulaExpression(analysis.formula, {
      referenceParserOptions: options.referenceParserOptions,
    }).ast
  } catch {
    ast = null
  }

  if (!ast) {
    return normalizedRawInput
  }

  const replacements: Array<{ start: number; end: number; nextText: string }> = []

  const visit = (
    node: DataGridFormulaAstNode,
    parentCallName: string | null,
    parentArgumentIndex: number | null,
    parentCallArgs: readonly DataGridFormulaAstNode[] | null,
  ): void => {
    if (node.kind === "literal" && typeof node.value === "string") {
      const nextLiteralValue = rewrite(node.value, {
        callName: parentCallName,
        argumentIndex: parentArgumentIndex,
        callArgs: parentCallArgs,
      })
      if (typeof nextLiteralValue === "string" && nextLiteralValue !== node.value) {
        const start = analysis.formulaSpan!.start + node.span.start
        const end = analysis.formulaSpan!.start + node.span.end
        replacements.push({
          start,
          end,
          nextText: formatDataGridSpreadsheetStringLiteralReplacement(
            normalizedRawInput.slice(start, end),
            nextLiteralValue,
          ),
        })
      }
      return
    }

    if (node.kind === "call") {
      for (let index = 0; index < node.args.length; index += 1) {
        const argument = node.args[index]
        if (!argument) {
          continue
        }
        visit(argument, node.name, index, node.args)
      }
      return
    }

    if (node.kind === "unary") {
      visit(node.value, parentCallName, parentArgumentIndex, parentCallArgs)
      return
    }

    if (node.kind === "binary") {
      visit(node.left, parentCallName, parentArgumentIndex, parentCallArgs)
      visit(node.right, parentCallName, parentArgumentIndex, parentCallArgs)
    }
  }

  visit(ast, null, null, null)
  if (replacements.length === 0) {
    return normalizedRawInput
  }

  let nextInput = normalizedRawInput
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    nextInput = `${nextInput.slice(0, replacement.start)}${replacement.nextText}${nextInput.slice(replacement.end)}`
  }
  return nextInput
}

export function resolveDataGridSpreadsheetActiveFormulaReference(
  references: readonly DataGridSpreadsheetFormulaReferenceSpan[],
  selection: DataGridSpreadsheetTextSelection,
): DataGridSpreadsheetFormulaReferenceSpan | null {
  const normalizedSelection = normalizeTextSelection(selection, Number.MAX_SAFE_INTEGER)
  if (references.length === 0) {
    return null
  }
  if (normalizedSelection.start === normalizedSelection.end) {
    const cursor = normalizedSelection.start
    for (const reference of references) {
      if (cursor >= reference.span.start && cursor < reference.span.end) {
        return reference
      }
    }
    return null
  }
  for (const reference of references) {
    if (normalizedSelection.start < reference.span.end && normalizedSelection.end > reference.span.start) {
      return reference
    }
  }
  return null
}

export function createDataGridSpreadsheetFormulaEditorModel(
  options: CreateDataGridSpreadsheetFormulaEditorModelOptions = {},
): DataGridSpreadsheetFormulaEditorModel {
  let disposed = false
  let revision = 0
  const listeners = new Set<DataGridSpreadsheetFormulaEditorListener>()
  let activeCell = options.initialCell ? normalizeCellAddress(options.initialCell) : null
  let rawInput = String(options.initialInput ?? "")
  let selection = normalizeTextSelection(options.initialSelection, rawInput.length)
  let displayValue = options.initialDisplayValue
  let errorValue = options.initialErrorValue

  const computeAnalysis = (): DataGridSpreadsheetCellInputAnalysis => analyzeDataGridSpreadsheetCellInput(rawInput, {
    currentRowIndex: activeCell?.rowIndex ?? null,
    rowCount: options.resolveRowCount?.(activeCell) ?? null,
    resolveReferenceRowCount: reference => options.resolveReferenceRowCount?.(reference, activeCell) ?? null,
    functionRegistry: options.functionRegistry,
    referenceParserOptions: options.referenceParserOptions,
  })

  let analysis = computeAnalysis()

  const ensureActive = (): void => {
    if (disposed) {
      throw new Error("DataGridSpreadsheetFormulaEditorModel has been disposed")
    }
  }

  const getSnapshot = (): DataGridSpreadsheetFormulaEditorSnapshot => {
    ensureActive()
    const activeReference = resolveDataGridSpreadsheetActiveFormulaReference(analysis.references, selection)
    return {
      revision,
      activeCell: cloneCellAddress(activeCell),
      rawInput,
      selection: cloneTextSelection(selection),
      displayValue,
      errorValue,
      analysis,
      activeReferenceKey: activeReference?.key ?? null,
    }
  }

  const emit = (): void => {
    if (disposed || listeners.size === 0) {
      return
    }
    const snapshot = getSnapshot()
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  const commit = (): void => {
    revision += 1
    analysis = computeAnalysis()
    emit()
  }

  return {
    getSnapshot,
    start(cell, nextRawInput = "", startOptions = {}) {
      ensureActive()
      activeCell = normalizeCellAddress(cell)
      rawInput = String(nextRawInput ?? "")
      selection = normalizeTextSelection(startOptions.selection, rawInput.length)
      displayValue = startOptions.displayValue
      errorValue = startOptions.errorValue
      commit()
    },
    setInput(nextRawInput: string) {
      ensureActive()
      const normalized = String(nextRawInput ?? "")
      if (normalized === rawInput) {
        return
      }
      rawInput = normalized
      selection = normalizeTextSelection(selection, rawInput.length)
      commit()
    },
    setSelection(nextSelection: DataGridSpreadsheetTextSelection | null) {
      ensureActive()
      const normalized = normalizeTextSelection(nextSelection, rawInput.length)
      if (normalized.start === selection.start && normalized.end === selection.end) {
        return
      }
      selection = normalized
      commit()
    },
    insertReference(reference, insertOptions = {}) {
      ensureActive()
      const result = insertDataGridSpreadsheetFormulaReference(rawInput, reference, {
        ...insertOptions,
        selection,
        currentRowIndex: activeCell?.rowIndex ?? null,
        outputSyntax: insertOptions.outputSyntax ?? options.outputSyntax,
        referenceParserOptions: insertOptions.referenceParserOptions ?? options.referenceParserOptions,
      })
      rawInput = result.input
      selection = result.selection
      commit()
      return result
    },
    setDisplayValue(value: unknown) {
      ensureActive()
      if (Object.is(value, displayValue)) {
        return
      }
      displayValue = value
      commit()
    },
    setErrorValue(value: unknown) {
      ensureActive()
      if (Object.is(value, errorValue)) {
        return
      }
      errorValue = value
      commit()
    },
    clear() {
      ensureActive()
      activeCell = null
      rawInput = ""
      selection = { start: 0, end: 0 }
      displayValue = undefined
      errorValue = undefined
      commit()
    },
    subscribe(listener: DataGridSpreadsheetFormulaEditorListener) {
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
      activeCell = null
      rawInput = ""
      selection = { start: 0, end: 0 }
      displayValue = undefined
      errorValue = undefined
      analysis = analyzeDataGridSpreadsheetCellInput("")
      revision = 0
    },
  }
}
