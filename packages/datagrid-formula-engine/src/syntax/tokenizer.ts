import type {
  DataGridFormulaOperator,
  DataGridFormulaReferenceParserOptions,
  DataGridFormulaReferenceSegment,
  DataGridFormulaReferenceSyntax,
  DataGridFormulaRowSelector,
  DataGridFormulaToken,
} from "./types.js"
import { createFormulaSourceSpan, throwFormulaError } from "./ast.js"

export type {
  DataGridFormulaToken,
  DataGridFormulaOperator,
  DataGridFormulaReferenceSegment,
  DataGridFormulaRowSelector,
} from "./types.js"

export interface DataGridParsedFormulaIdentifier {
  name: string
  sheetReference: string | null
  referenceName: string
  rangeReferenceName: string | null
  rowSelector: DataGridFormulaRowSelector
}

interface ResolvedDataGridFormulaReferenceParserOptions {
  syntax: DataGridFormulaReferenceSyntax
  smartsheetAbsoluteRowBase: 0 | 1
  allowSheetQualifiedReferences: boolean
}

interface DataGridReadFormulaIdentifierResult {
  value: string
  sheetReference: string | null
  referenceName: string
  rangeReferenceName: string | null
  rowSelector: DataGridFormulaRowSelector
  end: number
}

function readEscapedFormulaStringValue(
  input: string,
  start: number,
  quote: "'" | '"',
): {
  value: string
  end: number
} {
  let cursor = start + 1
  let value = ""
  while (cursor < input.length) {
    const current = input[cursor]
    if (!current) {
      break
    }
    if (current === "\\") {
      const escaped = input[cursor + 1]
      if (!escaped) {
        throwFormulaError(
          `Unterminated string literal at position ${start + 1}.`,
          createFormulaSourceSpan(start, cursor + 1),
        )
      }
      if (escaped === "n") {
        value += "\n"
      } else if (escaped === "r") {
        value += "\r"
      } else if (escaped === "t") {
        value += "\t"
      } else {
        value += escaped
      }
      cursor += 2
      continue
    }
    if (current === quote) {
      return { value, end: cursor + 1 }
    }
    value += current
    cursor += 1
  }
  throwFormulaError(
    `Unterminated string literal at position ${start + 1}.`,
    createFormulaSourceSpan(start, cursor),
  )
}

function isFormulaReferenceIdentifierStart(character: string | undefined): boolean {
  return typeof character === "string"
    && (
      (character >= "a" && character <= "z")
      || (character >= "A" && character <= "Z")
      || character === "_"
      || character === "$"
    )
}

function isFormulaReferenceIdentifierPart(character: string | undefined): boolean {
  return typeof character === "string"
    && (
      (character >= "a" && character <= "z")
      || (character >= "A" && character <= "Z")
      || (character >= "0" && character <= "9")
      || character === "_"
      || character === "$"
    )
}

function formatFormulaReferenceSegment(segment: DataGridFormulaReferenceSegment): string {
  if (typeof segment === "number") {
    return String(segment)
  }
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)) {
    return segment
  }
  return `"${segment.replace(/\\/g, "\\\\").replace(/\"/g, '\\\"')}"`
}

function normalizeFormulaReferenceSegments(
  segments: readonly DataGridFormulaReferenceSegment[],
): string {
  return segments.map(formatFormulaReferenceSegment).join(".")
}

function normalizeFormulaSheetReference(reference: string): string {
  return reference.trim()
}

function resolveFormulaReferenceParserOptions(
  options: DataGridFormulaReferenceParserOptions | undefined,
): ResolvedDataGridFormulaReferenceParserOptions {
  const syntax = options?.syntax ?? "canonical"
  return {
    syntax,
    smartsheetAbsoluteRowBase: options?.smartsheetAbsoluteRowBase === 0 ? 0 : 1,
    allowSheetQualifiedReferences: options?.allowSheetQualifiedReferences === true,
  }
}

function supportsSmartsheetFormulaReferenceSyntax(
  syntax: DataGridFormulaReferenceSyntax,
): boolean {
  return syntax === "smartsheet" || syntax === "auto"
}

function formatFormulaSheetReference(reference: string): string {
  const normalized = normalizeFormulaSheetReference(reference)
  if (/^[A-Za-z_$][A-Za-z0-9_$.-]*$/.test(normalized)) {
    return normalized
  }
  return `'${normalized.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
}

function serializeParsedFormulaIdentifier(
  sheetReference: string | null,
  referenceName: string,
  rangeReferenceName: string | null,
  rowSelector: DataGridFormulaRowSelector,
): string {
  const prefix = sheetReference ? `${formatFormulaSheetReference(sheetReference)}!` : ""
  const localReference = rangeReferenceName && rangeReferenceName !== referenceName
    ? `${referenceName}:${rangeReferenceName}`
    : referenceName
  return `${prefix}${localReference}${serializeFormulaRowSelector(rowSelector)}`
}

export function normalizeFormulaReference(reference: string): string {
  const normalized = reference.trim()
  if (normalized.length === 0) {
    return ""
  }
  const parsed = readFormulaReferenceAt(normalized, 0)
  if (!parsed || parsed.end !== normalized.length) {
    return normalized
  }
  return parsed.value
}

function looksLikeFormulaRowSelectorValue(value: string): boolean {
  const normalized = value.trim()
  return /^[+-]?\d+$/.test(normalized)
    || /^\d+\s*\.\.\s*\d+$/.test(normalized)
    || /^[+-]?\d+\s*:\s*[+-]?\d+$/.test(normalized)
}

function parseFormulaRowSelectorValue(value: string): DataGridFormulaRowSelector | null {
  const normalized = value.trim()
  const absoluteWindowMatch = /^(\d+)\s*\.\.\s*(\d+)$/.exec(normalized)
  if (absoluteWindowMatch) {
    const startRowIndex = Number(absoluteWindowMatch[1])
    const endRowIndex = Number(absoluteWindowMatch[2])
    if (startRowIndex > endRowIndex) {
      return null
    }
    return {
      kind: "absolute-window",
      startRowIndex,
      endRowIndex,
    }
  }
  const windowMatch = /^([+-]?\d+)\s*:\s*([+-]?\d+)$/.exec(normalized)
  if (windowMatch) {
    const startOffset = Number(windowMatch[1])
    const endOffset = Number(windowMatch[2])
    if (startOffset > endOffset) {
      return null
    }
    return {
      kind: "window",
      startOffset,
      endOffset,
    }
  }
  if (/^[+-]\d+$/.test(normalized)) {
    return { kind: "relative", offset: Number(normalized) }
  }
  if (/^\d+$/.test(normalized)) {
    return { kind: "absolute", rowIndex: Number(normalized) }
  }
  return null
}

function serializeFormulaRowSelector(selector: DataGridFormulaRowSelector): string {
  if (selector.kind === "current") {
    return ""
  }
  if (selector.kind === "absolute") {
    return `[${selector.rowIndex}]`
  }
  if (selector.kind === "absolute-window") {
    return `[${selector.startRowIndex}..${selector.endRowIndex}]`
  }
  if (selector.kind === "relative") {
    return `[${selector.offset >= 0 ? `+${selector.offset}` : selector.offset}]`
  }
  const startOffset = selector.startOffset >= 0 ? `+${selector.startOffset}` : String(selector.startOffset)
  const endOffset = selector.endOffset >= 0 ? `+${selector.endOffset}` : String(selector.endOffset)
  return `[${startOffset}:${endOffset}]`
}

function readFormulaReferenceAt(
  input: string,
  start: number,
): {
  value: string
  end: number
} | null {
  let cursor = start
  const segments: DataGridFormulaReferenceSegment[] = []
  let expectSegment = true

  const pushSimpleSegment = (): boolean => {
    if (!isFormulaReferenceIdentifierStart(input[cursor])) {
      return false
    }
    const segmentStart = cursor
    cursor += 1
    while (cursor < input.length && isFormulaReferenceIdentifierPart(input[cursor])) {
      cursor += 1
    }
    segments.push(input.slice(segmentStart, cursor))
    expectSegment = false
    return true
  }

  const pushNumericSegment = (): boolean => {
    const current = input[cursor]
    if (!(current && current >= "0" && current <= "9")) {
      return false
    }
    const segmentStart = cursor
    cursor += 1
    while (cursor < input.length) {
      const next = input[cursor]
      if (!(next && next >= "0" && next <= "9")) {
        break
      }
      cursor += 1
    }
    const parsedIndex = Number(input.slice(segmentStart, cursor))
    segments.push(parsedIndex)
    expectSegment = false
    return true
  }

  const pushQuotedSegment = (): boolean => {
    const current = input[cursor]
    if (current !== "'" && current !== '"') {
      return false
    }
    const parsed = readEscapedFormulaStringValue(input, cursor, current)
    segments.push(parsed.value)
    cursor = parsed.end
    expectSegment = false
    return true
  }

  const pushBracketSegment = (): boolean => {
    if (input[cursor] !== "[") {
      return false
    }
    const bracketStart = cursor
    cursor += 1
    while (cursor < input.length && /\s/.test(input[cursor] ?? "")) {
      cursor += 1
    }
    if (cursor >= input.length) {
      throwFormulaError(
        `Missing ']' for reference starting at position ${bracketStart + 1}.`,
        createFormulaSourceSpan(bracketStart, cursor),
      )
    }

    let segmentValue: string
    const current = input[cursor]
    if (current === "'" || current === '"') {
      const parsed = readEscapedFormulaStringValue(input, cursor, current)
      segmentValue = parsed.value
      cursor = parsed.end
      while (cursor < input.length && /\s/.test(input[cursor] ?? "")) {
        cursor += 1
      }
      if (input[cursor] !== "]") {
        throwFormulaError(
          `Missing ']' for reference starting at position ${bracketStart + 1}.`,
          createFormulaSourceSpan(bracketStart, cursor),
        )
      }
    } else {
      const valueStart = cursor
      while (cursor < input.length && input[cursor] !== "]") {
        cursor += 1
      }
      if (input[cursor] !== "]") {
        throwFormulaError(
          `Missing ']' for reference starting at position ${bracketStart + 1}.`,
          createFormulaSourceSpan(bracketStart, cursor),
        )
      }
      segmentValue = input.slice(valueStart, cursor).trim()
      if (segmentValue.length === 0) {
        throwFormulaError(
          `Empty bracket reference at position ${bracketStart + 1}.`,
          createFormulaSourceSpan(bracketStart, cursor + 1),
        )
      }
    }

    const parsedIndex = Number(segmentValue)
    if (String(parsedIndex) === segmentValue && Number.isInteger(parsedIndex) && parsedIndex >= 0) {
      segments.push(parsedIndex)
    } else {
      segments.push(segmentValue)
    }
    cursor += 1
    expectSegment = false
    return true
  }

  while (cursor < input.length) {
    if (expectSegment) {
      if (pushSimpleSegment() || pushNumericSegment() || pushQuotedSegment() || pushBracketSegment()) {
        continue
      }
      break
    }
    const current = input[cursor]
    if (current === ".") {
      cursor += 1
      expectSegment = true
      continue
    }
    if (current === "[") {
      expectSegment = true
      continue
    }
    break
  }

  if (segments.length === 0) {
    return null
  }
  if (expectSegment) {
    throwFormulaError(
      `Incomplete reference at position ${cursor + 1}.`,
      createFormulaSourceSpan(start, Math.max(start + 1, cursor)),
    )
  }
  return {
    value: normalizeFormulaReferenceSegments(segments),
    end: cursor,
  }
}

function readFormulaReferenceNameAt(
  input: string,
  start: number,
): {
  referenceName: string
  end: number
} | null {
  const parsed = readFormulaReferenceAt(input, start)
  if (!parsed) {
    return null
  }
  return {
    referenceName: parsed.value,
    end: parsed.end,
  }
}

function isFormulaReferenceBoundary(character: string | undefined): boolean {
  return typeof character !== "string"
    || character === " "
    || character === "\t"
    || character === "\n"
    || character === "\r"
    || character === "+"
    || character === "-"
    || character === "*"
    || character === "/"
    || character === ","
    || character === "("
    || character === ")"
    || character === ">"
    || character === "<"
    || character === "="
    || character === "!"
}

function readCanonicalTrailingFormulaRowSelectorAt(
  input: string,
  start: number,
): {
  rowSelector: DataGridFormulaRowSelector
  end: number
} | null {
  if (input[start] !== "[") {
    return null
  }
  const bracketStart = start
  let cursor = start + 1
  while (cursor < input.length && input[cursor] !== "]") {
    cursor += 1
  }
  if (input[cursor] !== "]") {
    throwFormulaError(
      `Missing ']' for reference starting at position ${bracketStart + 1}.`,
      createFormulaSourceSpan(bracketStart, cursor),
    )
  }
  const selectorValue = input.slice(start + 1, cursor).trim()
  const rowSelector = parseFormulaRowSelectorValue(selectorValue)
  if (rowSelector) {
    const end = cursor + 1
    if (!isFormulaReferenceBoundary(input[end])) {
      return null
    }
    return {
      rowSelector,
      end,
    }
  }
  if (looksLikeFormulaRowSelectorValue(selectorValue) && isFormulaReferenceBoundary(input[cursor + 1])) {
    throwFormulaError(
      `Invalid row selector '${selectorValue}' in reference '${input.slice(0, cursor + 1).trim()}'.`,
      createFormulaSourceSpan(bracketStart, cursor + 1),
    )
  }
  return null
}

function readSmartsheetTrailingFormulaRowSelectorAt(
  input: string,
  start: number,
  referenceName: string,
  options: ResolvedDataGridFormulaReferenceParserOptions,
): {
  rangeReferenceName: string | null
  rowSelector: DataGridFormulaRowSelector
  end: number
} | null {
  const current = input[start]
  if (current === "@") {
    const keyword = input.slice(start, start + 4).toLowerCase()
    if (keyword !== "@row") {
      return null
    }
    return {
      rangeReferenceName: null,
      rowSelector: { kind: "current" },
      end: start + 4,
    }
  }
  const readAbsoluteRowSelector = (selectorStart: number): { rowIndex: number; end: number } | null => {
    const selectorCurrent = input[selectorStart]
    if (!(selectorCurrent && selectorCurrent >= "0" && selectorCurrent <= "9")) {
      return null
    }
    let selectorCursor = selectorStart + 1
    while (selectorCursor < input.length) {
      const next = input[selectorCursor]
      if (!(next && next >= "0" && next <= "9")) {
        break
      }
      selectorCursor += 1
    }
    const rowNumber = Number(input.slice(selectorStart, selectorCursor))
    if (!Number.isInteger(rowNumber)) {
      return null
    }
    if (options.smartsheetAbsoluteRowBase === 1 && rowNumber <= 0) {
      throwFormulaError(
        `Smartsheet row selector '${input.slice(selectorStart, selectorCursor)}' must be >= 1.`,
        createFormulaSourceSpan(selectorStart, selectorCursor),
      )
    }
    return {
      rowIndex: rowNumber - options.smartsheetAbsoluteRowBase,
      end: selectorCursor,
    }
  }

  const absoluteSelector = readAbsoluteRowSelector(start)
  if (!absoluteSelector) {
    return null
  }

  let cursor = absoluteSelector.end
  if (input[cursor] !== ":") {
    return {
      rangeReferenceName: null,
      rowSelector: {
        kind: "absolute",
        rowIndex: absoluteSelector.rowIndex,
      },
      end: absoluteSelector.end,
    }
  }

  cursor += 1
  while (cursor < input.length && /\s/.test(input[cursor] ?? "")) {
    cursor += 1
  }

  let rangeReferenceName: string | null = null
  if (input[cursor] === "[") {
    const rangeReference = readFormulaReferenceNameAt(input, cursor)
    if (!rangeReference) {
      throwFormulaError(
        `Invalid Smartsheet range reference '${input.slice(start, cursor + 1)}'.`,
        createFormulaSourceSpan(start, cursor + 1),
      )
    }
    rangeReferenceName = rangeReference.referenceName === referenceName ? null : rangeReference.referenceName
    cursor = rangeReference.end
  }

  const rangeEndSelector = readAbsoluteRowSelector(cursor)
  if (!rangeEndSelector) {
    throwFormulaError(
      `Invalid Smartsheet range reference '${input.slice(start, Math.max(start + 1, cursor + 1))}'.`,
      createFormulaSourceSpan(start, Math.max(start + 1, cursor + 1)),
    )
  }
  if (rangeEndSelector.rowIndex < absoluteSelector.rowIndex) {
    throwFormulaError(
      `Smartsheet range start must be <= range end.`,
      createFormulaSourceSpan(start, rangeEndSelector.end),
    )
  }
  return {
    rangeReferenceName,
    rowSelector: {
      kind: "absolute-window",
      startRowIndex: absoluteSelector.rowIndex,
      endRowIndex: rangeEndSelector.rowIndex,
    },
    end: rangeEndSelector.end,
  }
}

function readLocalFormulaIdentifierAt(
  input: string,
  start: number,
  options: DataGridFormulaReferenceParserOptions | undefined,
): DataGridReadFormulaIdentifierResult | null {
  const parserOptions = resolveFormulaReferenceParserOptions(options)
  let cursor = start
  const segments: DataGridFormulaReferenceSegment[] = []
  let expectSegment = true

  const pushSimpleSegment = (): boolean => {
    if (!isFormulaReferenceIdentifierStart(input[cursor])) {
      return false
    }
    const segmentStart = cursor
    cursor += 1
    while (cursor < input.length && isFormulaReferenceIdentifierPart(input[cursor])) {
      cursor += 1
    }
    segments.push(input.slice(segmentStart, cursor))
    expectSegment = false
    return true
  }

  const pushNumericSegment = (): boolean => {
    const current = input[cursor]
    if (!(current && current >= "0" && current <= "9")) {
      return false
    }
    const segmentStart = cursor
    cursor += 1
    while (cursor < input.length) {
      const next = input[cursor]
      if (!(next && next >= "0" && next <= "9")) {
        break
      }
      cursor += 1
    }
    const parsedIndex = Number(input.slice(segmentStart, cursor))
    segments.push(parsedIndex)
    expectSegment = false
    return true
  }

  const pushQuotedSegment = (): boolean => {
    const current = input[cursor]
    if (current !== "'" && current !== '"') {
      return false
    }
    const parsed = readEscapedFormulaStringValue(input, cursor, current)
    segments.push(parsed.value)
    cursor = parsed.end
    expectSegment = false
    return true
  }

  const pushBracketSegment = (): boolean => {
    if (input[cursor] !== "[") {
      return false
    }
    const bracketStart = cursor
    cursor += 1
    while (cursor < input.length && /\s/.test(input[cursor] ?? "")) {
      cursor += 1
    }
    if (cursor >= input.length) {
      throwFormulaError(
        `Missing ']' for reference starting at position ${bracketStart + 1}.`,
        createFormulaSourceSpan(bracketStart, cursor),
      )
    }

    let segmentValue: string
    const current = input[cursor]
    if (current === "'" || current === '"') {
      const parsed = readEscapedFormulaStringValue(input, cursor, current)
      segmentValue = parsed.value
      cursor = parsed.end
      while (cursor < input.length && /\s/.test(input[cursor] ?? "")) {
        cursor += 1
      }
      if (input[cursor] !== "]") {
        throwFormulaError(
          `Missing ']' for reference starting at position ${bracketStart + 1}.`,
          createFormulaSourceSpan(bracketStart, cursor),
        )
      }
    } else {
      const valueStart = cursor
      while (cursor < input.length && input[cursor] !== "]") {
        cursor += 1
      }
      if (input[cursor] !== "]") {
        throwFormulaError(
          `Missing ']' for reference starting at position ${bracketStart + 1}.`,
          createFormulaSourceSpan(bracketStart, cursor),
        )
      }
      segmentValue = input.slice(valueStart, cursor).trim()
      if (segmentValue.length === 0) {
        throwFormulaError(
          `Empty bracket reference at position ${bracketStart + 1}.`,
          createFormulaSourceSpan(bracketStart, cursor + 1),
        )
      }
    }

    const parsedIndex = Number(segmentValue)
    if (String(parsedIndex) === segmentValue && Number.isInteger(parsedIndex) && parsedIndex >= 0) {
      segments.push(parsedIndex)
    } else {
      segments.push(segmentValue)
    }
    cursor += 1
    expectSegment = false
    return true
  }

  while (cursor < input.length) {
    if (expectSegment) {
      if (pushSimpleSegment() || pushNumericSegment() || pushQuotedSegment() || pushBracketSegment()) {
        continue
      }
      break
    }
    const current = input[cursor]
    if (current === ".") {
      cursor += 1
      expectSegment = true
      continue
    }
    if (current === "[") {
      if (segments.length > 0) {
        const rowSelector = readCanonicalTrailingFormulaRowSelectorAt(input, cursor)
        if (rowSelector) {
          const referenceName = normalizeFormulaReferenceSegments(segments)
          return {
            value: serializeParsedFormulaIdentifier(null, referenceName, null, rowSelector.rowSelector),
            sheetReference: null,
            referenceName,
            rangeReferenceName: null,
            rowSelector: rowSelector.rowSelector,
            end: rowSelector.end,
          }
        }
      }
      expectSegment = true
      continue
    }
    break
  }

  if (segments.length === 0) {
    return null
  }
  if (expectSegment) {
    throwFormulaError(
      `Incomplete reference at position ${cursor + 1}.`,
      createFormulaSourceSpan(start, Math.max(start + 1, cursor)),
    )
  }

  const referenceName = normalizeFormulaReferenceSegments(segments)
  if (input[cursor] === ":") {
    const rangeReference = readLocalFormulaIdentifierAt(input, cursor + 1, parserOptions)
    if (!rangeReference) {
      throwFormulaError(
        `Incomplete range reference at position ${cursor + 1}.`,
        createFormulaSourceSpan(start, Math.max(start + 1, cursor + 1)),
      )
    }
    if (rangeReference.rangeReferenceName) {
      throwFormulaError(
        `Nested range references are not supported.`,
        createFormulaSourceSpan(start, rangeReference.end),
      )
    }
    return {
      value: serializeParsedFormulaIdentifier(null, referenceName, rangeReference.referenceName, rangeReference.rowSelector),
      sheetReference: null,
      referenceName,
      rangeReferenceName: rangeReference.referenceName,
      rowSelector: rangeReference.rowSelector,
      end: rangeReference.end,
    }
  }

  if (input[cursor] === "[") {
    const rowSelector = readCanonicalTrailingFormulaRowSelectorAt(input, cursor)
    if (rowSelector) {
      return {
        value: serializeParsedFormulaIdentifier(null, referenceName, null, rowSelector.rowSelector),
        sheetReference: null,
        referenceName,
        rangeReferenceName: null,
        rowSelector: rowSelector.rowSelector,
        end: rowSelector.end,
      }
    }
  }

  if (supportsSmartsheetFormulaReferenceSyntax(parserOptions.syntax)) {
    const smartsheetSelector = readSmartsheetTrailingFormulaRowSelectorAt(input, cursor, referenceName, parserOptions)
    if (smartsheetSelector && isFormulaReferenceBoundary(input[smartsheetSelector.end])) {
      return {
        value: serializeParsedFormulaIdentifier(null, referenceName, smartsheetSelector.rangeReferenceName, smartsheetSelector.rowSelector),
        sheetReference: null,
        referenceName,
        rangeReferenceName: smartsheetSelector.rangeReferenceName,
        rowSelector: smartsheetSelector.rowSelector,
        end: smartsheetSelector.end,
      }
    }
  }

  return {
    value: referenceName,
    sheetReference: null,
    referenceName,
    rangeReferenceName: null,
    rowSelector: { kind: "current" },
    end: cursor,
  }
}

function readFormulaSheetReferenceAt(
  input: string,
  start: number,
): {
  sheetReference: string
  end: number
} | null {
  const current = input[start]
  if (!current) {
    return null
  }
  if (current === "'" || current === '"') {
    const parsed = readEscapedFormulaStringValue(input, start, current)
    const sheetReference = normalizeFormulaSheetReference(parsed.value)
    return sheetReference.length === 0
      ? null
      : {
          sheetReference,
          end: parsed.end,
        }
  }
  if (!isFormulaReferenceIdentifierStart(current)) {
    return null
  }
  let cursor = start + 1
  while (cursor < input.length) {
    const next = input[cursor]
    if (
      !next
      || !(
        isFormulaReferenceIdentifierPart(next)
        || next === "-"
        || next === "."
      )
    ) {
      break
    }
    cursor += 1
  }
  const sheetReference = normalizeFormulaSheetReference(input.slice(start, cursor))
  return sheetReference.length === 0
    ? null
    : {
        sheetReference,
        end: cursor,
      }
}

function readFormulaIdentifierAt(
  input: string,
  start: number,
  options: DataGridFormulaReferenceParserOptions | undefined,
): DataGridReadFormulaIdentifierResult | null {
  const parserOptions = resolveFormulaReferenceParserOptions(options)
  if (parserOptions.allowSheetQualifiedReferences) {
    const sheetReference = readFormulaSheetReferenceAt(input, start)
    if (sheetReference && input[sheetReference.end] === "!") {
      const nested = readLocalFormulaIdentifierAt(input, sheetReference.end + 1, parserOptions)
      if (nested) {
        return {
          value: serializeParsedFormulaIdentifier(
            sheetReference.sheetReference,
            nested.referenceName,
            nested.rangeReferenceName,
            nested.rowSelector,
          ),
          sheetReference: sheetReference.sheetReference,
          referenceName: nested.referenceName,
          rangeReferenceName: nested.rangeReferenceName,
          rowSelector: nested.rowSelector,
          end: nested.end,
        }
      }
    }
  }
  return readLocalFormulaIdentifierAt(input, start, parserOptions)
}

export function parseDataGridFormulaIdentifier(
  reference: string,
  options: DataGridFormulaReferenceParserOptions = {},
): DataGridParsedFormulaIdentifier {
  const normalizedReference = reference.trim()
  if (normalizedReference.length === 0) {
    return {
      name: "",
      sheetReference: null,
      referenceName: "",
      rangeReferenceName: null,
      rowSelector: { kind: "current" },
    }
  }
  const parsed = readFormulaIdentifierAt(normalizedReference, 0, options)
  if (parsed && parsed.end === normalizedReference.length) {
    return {
      name: parsed.value,
      sheetReference: parsed.sheetReference,
      referenceName: parsed.referenceName,
      rangeReferenceName: parsed.rangeReferenceName,
      rowSelector: parsed.rowSelector,
    }
  }
  const referenceName = normalizeFormulaReference(normalizedReference)
  return {
    name: referenceName,
    sheetReference: null,
    referenceName,
    rangeReferenceName: null,
    rowSelector: { kind: "current" },
  }
}

export function parseFormulaReferenceSegments(
  reference: string,
): readonly DataGridFormulaReferenceSegment[] {
  const normalized = normalizeFormulaReference(reference)
  if (normalized.length === 0) {
    return []
  }
  const parsed = readFormulaReferenceAt(normalized, 0)
  if (!parsed || parsed.end !== normalized.length) {
    return [normalized]
  }
  return Object.freeze(
    parsed.value
      .split(/\.(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)
      .filter(segment => segment.length > 0)
      .map((segment) => {
        const trimmed = segment.trim()
        if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
          return readEscapedFormulaStringValue(trimmed, 0, '"').value
        }
        const parsedIndex = Number(trimmed)
        return String(parsedIndex) === trimmed && Number.isInteger(parsedIndex) && parsedIndex >= 0
          ? parsedIndex
          : trimmed
      }),
  )
}

export function tokenizeFormula(
  formula: string,
  options: DataGridFormulaReferenceParserOptions = {},
): readonly DataGridFormulaToken[] {
  const tokens: DataGridFormulaToken[] = []
  const parserOptions = resolveFormulaReferenceParserOptions(options)
  let cursor = 0

  const isDigitAt = (index: number): boolean => {
    const character = formula[index]
    return typeof character === "string" && character >= "0" && character <= "9"
  }

  const pushNumber = (): void => {
    const start = cursor
    let hasDigits = false
    while (cursor < formula.length && isDigitAt(cursor)) {
      cursor += 1
      hasDigits = true
    }
    if (formula[cursor] === ".") {
      cursor += 1
      while (cursor < formula.length && isDigitAt(cursor)) {
        cursor += 1
        hasDigits = true
      }
    }
    if (!hasDigits) {
      throwFormulaError(`Invalid number at position ${start + 1}.`)
    }
    const raw = formula.slice(start, cursor)
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      throwFormulaError(`Invalid number '${raw}' at position ${start + 1}.`, createFormulaSourceSpan(start, cursor))
    }
    tokens.push({ kind: "number", value: parsed, position: start, end: cursor })
  }

  const pushString = (quote: "'" | '"'): void => {
    const start = cursor
    const parsed = readEscapedFormulaStringValue(formula, start, quote)
    cursor = parsed.end
    tokens.push({ kind: "string", value: parsed.value, position: start, end: cursor })
  }

  const pushIdentifier = (): void => {
    const start = cursor
    const parsed = readFormulaIdentifierAt(formula, cursor, parserOptions)
    if (!parsed) {
      throwFormulaError(`Unexpected token '${formula[cursor]}' at position ${cursor + 1}.`, createFormulaSourceSpan(cursor, cursor + 1))
    }
    cursor = parsed.end
    const value = parsed.value
    const keyword = value.toUpperCase()
    if (keyword === "AND" || keyword === "OR" || keyword === "NOT") {
      tokens.push({ kind: "operator", value: keyword, position: start, end: cursor })
      return
    }
    tokens.push({ kind: "identifier", value, raw: formula.slice(start, cursor), position: start, end: cursor })
  }

  while (cursor < formula.length) {
    const current = formula[cursor]
    if (!current) {
      break
    }
    if (current === " " || current === "\t" || current === "\n" || current === "\r") {
      cursor += 1
      continue
    }
    if (
      (current === "'" || current === '"')
      && parserOptions.allowSheetQualifiedReferences
    ) {
      const sheetReference = readFormulaSheetReferenceAt(formula, cursor)
      if (sheetReference && formula[sheetReference.end] === "!" && readLocalFormulaIdentifierAt(formula, sheetReference.end + 1, parserOptions)) {
        pushIdentifier()
        continue
      }
    }
    if (current === "'" || current === '"') {
      pushString(current)
      continue
    }
    if ((current >= "0" && current <= "9") || current === ".") {
      pushNumber()
      continue
    }

    const isIdentifierStart = isFormulaReferenceIdentifierStart(current) || current === "["
    if (isIdentifierStart) {
      pushIdentifier()
      continue
    }

    const next = formula[cursor + 1]
    if ((current === ">" || current === "<" || current === "=" || current === "!") && next === "=") {
      tokens.push({ kind: "operator", value: `${current}${next}` as DataGridFormulaOperator, position: cursor, end: cursor + 2 })
      cursor += 2
      continue
    }

    if (current === ">" || current === "<") {
      tokens.push({ kind: "operator", value: current, position: cursor, end: cursor + 1 })
      cursor += 1
      continue
    }

    if (current === "+" || current === "-" || current === "*" || current === "/") {
      tokens.push({ kind: "operator", value: current, position: cursor, end: cursor + 1 })
      cursor += 1
      continue
    }

    if (current === "(") {
      tokens.push({ kind: "paren", value: "(", position: cursor, end: cursor + 1 })
      cursor += 1
      continue
    }
    if (current === ")") {
      tokens.push({ kind: "paren", value: ")", position: cursor, end: cursor + 1 })
      cursor += 1
      continue
    }
    if (current === ",") {
      tokens.push({ kind: "comma", position: cursor, end: cursor + 1 })
      cursor += 1
      continue
    }
    throwFormulaError(`Unexpected token '${current}' at position ${cursor + 1}.`, createFormulaSourceSpan(cursor, cursor + 1))
  }

  if (tokens.length === 0) {
    throwFormulaError("Formula has no expression.")
  }
  return tokens
}
