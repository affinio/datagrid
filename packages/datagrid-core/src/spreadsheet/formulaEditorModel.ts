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

export interface AnalyzeDataGridSpreadsheetCellInputOptions {
  currentRowIndex?: number | null
  rowCount?: number | null
  resolveReferenceRowCount?: (
    reference: Pick<DataGridSpreadsheetFormulaReferenceSpan, "sheetReference" | "referenceName" | "rowSelector">,
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
    reference: Pick<DataGridSpreadsheetFormulaReferenceSpan, "sheetReference" | "referenceName" | "rowSelector">,
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
  if (rowSelector.kind === "relative") {
    return { kind: "relative", offset: rowSelector.offset }
  }
  return {
    kind: "window",
    startOffset: rowSelector.startOffset,
    endOffset: rowSelector.endOffset,
  }
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
  if (rowSelector.kind !== "current" && rowSelector.kind !== "absolute") {
    throw new Error("[DataGridSpreadsheet] Smartsheet output syntax currently supports only current-row and absolute-row references.")
  }
  const base = options.referenceParserOptions?.smartsheetAbsoluteRowBase === 0 ? 0 : 1
  const referenceText = rowSelector.kind === "current"
    ? `[${normalized}]@row`
    : `[${normalized}]${rowSelector.rowIndex + base}`
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
        rowSelector,
        span,
        targetRowIndexes: resolveTargetRowIndexes(
          rowSelector,
          options.currentRowIndex,
          options.resolveReferenceRowCount?.({
            sheetReference,
            referenceName: node.referenceName,
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
    return formatSmartsheetReference(reference.sheetReference, reference.referenceName, rowSelector, options)
  }
  const prefix = typeof reference.sheetReference === "string" && reference.sheetReference.trim().length > 0
    ? `${formatFormulaSheetReference(reference.sheetReference)}!`
    : ""
  return `${prefix}${formatCanonicalReferenceName(reference.referenceName)}${formatCanonicalRowSelector(rowSelector)}`
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
