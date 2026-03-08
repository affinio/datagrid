import type {
  DataGridFormulaOperator,
  DataGridFormulaReferenceSegment,
  DataGridFormulaToken,
} from "./analysis.js"
import { createFormulaSourceSpan, throwFormulaError } from "./ast.js"

export type {
  DataGridFormulaToken,
  DataGridFormulaOperator,
  DataGridFormulaReferenceSegment,
} from "./analysis.js"

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

export function parseFormulaReferenceSegments(
  reference: string,
): readonly DataGridFormulaReferenceSegment[] {
  const normalized = reference.trim()
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

export function tokenizeFormula(formula: string): readonly DataGridFormulaToken[] {
  const tokens: DataGridFormulaToken[] = []
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
    const parsed = readFormulaReferenceAt(formula, cursor)
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
    tokens.push({ kind: "identifier", value, position: start, end: cursor })
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
