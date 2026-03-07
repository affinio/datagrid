import type {
  DataGridComputedDependencyToken,
  DataGridFormulaArrayValue,
  DataGridComputedFieldComputeContext,
  DataGridFormulaErrorValue,
  DataGridFormulaFieldDefinition,
  DataGridFormulaScalarValue,
  DataGridFormulaValue,
  DataGridRowId,
  DataGridFormulaRuntimeError,
  DataGridFormulaRuntimeErrorCode,
} from "../rowModel.js"

export type DataGridFormulaFunctionArity = number | {
  min: number
  max?: number
}

export interface DataGridFormulaFunctionDefinition {
  arity?: DataGridFormulaFunctionArity
  contextKeys?: readonly string[]
  compute: (args: readonly DataGridFormulaValue[]) => unknown
}

export type DataGridFormulaFunctionRegistry = Readonly<
  Record<string, DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[]) => unknown)>
>

export type DataGridFormulaRuntimeErrorPolicy = "coerce-zero" | "throw" | "error-value"
export type DataGridFormulaCompileStrategy = "auto" | "ast" | "jit"

export interface DataGridFormulaCompileOptions {
  resolveDependencyToken?: (identifier: string) => DataGridComputedDependencyToken
  functionRegistry?: DataGridFormulaFunctionRegistry
  onFunctionOverride?: (functionName: string) => void
  runtimeErrorPolicy?: DataGridFormulaRuntimeErrorPolicy
  onRuntimeError?: (error: DataGridFormulaRuntimeError) => void
  compileStrategy?: DataGridFormulaCompileStrategy
  allowDynamicCodegen?: boolean
}

export interface DataGridFormulaParseResult {
  formula: string
  tokens: readonly DataGridFormulaToken[]
  ast: DataGridFormulaAstNode
}

export interface DataGridFormulaDiagnosticsResult {
  ok: boolean
  formula: string
  diagnostics: readonly DataGridFormulaDiagnostic[]
  tokens?: readonly DataGridFormulaToken[]
  ast?: DataGridFormulaAstNode
}

export type DataGridFormulaExplainDependencyDomain = "field" | "computed" | "meta" | "unknown"

export interface DataGridFormulaExplainDependency {
  identifier: string
  token: DataGridComputedDependencyToken
  domain: DataGridFormulaExplainDependencyDomain
  value: string
}

export interface DataGridFormulaExplainNode {
  kind: DataGridFormulaAstNode["kind"]
  label: string
  span: DataGridFormulaSourceSpan
  children: readonly DataGridFormulaExplainNode[]
  name?: string
  operator?: DataGridFormulaOperator | "CALL"
  value?: DataGridFormulaValue
}

export interface DataGridFormulaExplainResult {
  formula: string
  tokens: readonly DataGridFormulaToken[]
  ast: DataGridFormulaAstNode
  identifiers: readonly string[]
  dependencies: readonly DataGridFormulaExplainDependency[]
  contextKeys: readonly string[]
  tree: DataGridFormulaExplainNode
}

export interface DataGridFormulaFieldExplainResult extends DataGridFormulaExplainResult {
  name: string
  field: string
}

export interface DataGridCompiledFormulaField<TRow = unknown> {
  name: string
  field: string
  formula: string
  expressionHash: string
  identifiers: readonly string[]
  deps: readonly DataGridComputedDependencyToken[]
  contextKeys: readonly string[]
  batchExecutionMode?: DataGridCompiledFormulaBatchExecutionMode
  compute: (context: DataGridComputedFieldComputeContext<TRow>) => DataGridFormulaValue
  computeBatch?: (
    contexts: readonly DataGridCompiledFormulaBatchContext<TRow>[],
    readTokenByIndex: (contextIndex: number, tokenIndex: number) => unknown,
  ) => readonly DataGridFormulaValue[]
  computeBatchColumnar?: (
    contexts: readonly DataGridCompiledFormulaBatchContext<TRow>[],
    tokenColumns: readonly (readonly unknown[])[],
  ) => readonly DataGridFormulaValue[]
}

export interface DataGridFormulaExpressionAnalysis {
  formula: string
  expressionHash: string
  identifiers: readonly string[]
  deps: readonly DataGridComputedDependencyToken[]
  contextKeys: readonly string[]
}

export interface DataGridCompiledFormulaArtifact<TRow = unknown> extends DataGridFormulaExpressionAnalysis {
  bind: (
    definition: DataGridFormulaFieldDefinition,
    options?: Pick<DataGridFormulaCompileOptions, "runtimeErrorPolicy" | "onRuntimeError">,
  ) => DataGridCompiledFormulaField<TRow>
}

export interface DataGridCompiledFormulaBatchContext<TRow = unknown> {
  row: TRow
  rowId: DataGridRowId
  sourceIndex: number
}

export type DataGridCompiledFormulaBatchExecutionMode =
  | "row"
  | "batch"
  | "columnar-ast"
  | "columnar-jit"
  | "columnar-fused"
  | "columnar-vector"

export interface DataGridFormulaSourceSpan {
  start: number
  end: number
}

export interface DataGridFormulaDiagnostic {
  severity: "error"
  message: string
  span: DataGridFormulaSourceSpan
}

export type DataGridFormulaOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "AND"
  | "OR"
  | "NOT"
  | ">"
  | "<"
  | ">="
  | "<="
  | "=="
  | "!="

export type DataGridFormulaToken =
  | { kind: "number"; value: number; position: number; end: number }
  | { kind: "string"; value: string; position: number; end: number }
  | { kind: "identifier"; value: string; position: number; end: number }
  | { kind: "operator"; value: DataGridFormulaOperator; position: number; end: number }
  | { kind: "comma"; position: number; end: number }
  | { kind: "paren"; value: "(" | ")"; position: number; end: number }

export type DataGridFormulaAstNode =
  | { kind: "number"; value: number; span: DataGridFormulaSourceSpan }
  | { kind: "literal"; value: DataGridFormulaValue; span: DataGridFormulaSourceSpan }
  | { kind: "identifier"; name: string; span: DataGridFormulaSourceSpan }
  | { kind: "call"; name: string; args: DataGridFormulaAstNode[]; span: DataGridFormulaSourceSpan }
  | { kind: "unary"; operator: "-" | "+" | "NOT"; value: DataGridFormulaAstNode; span: DataGridFormulaSourceSpan }
  | {
    kind: "binary"
    operator: DataGridFormulaOperator
    left: DataGridFormulaAstNode
    right: DataGridFormulaAstNode
    span: DataGridFormulaSourceSpan
  }

export interface DataGridFormulaFunctionRuntime {
  name: string
  arity?: DataGridFormulaFunctionArity
  contextKeys: readonly string[]
  compute: (args: readonly DataGridFormulaValue[]) => unknown
}

export type DataGridFormulaTokenValueReader<TKey> = (
  token: TKey,
) => unknown

export type DataGridFormulaEvaluatorForToken<TKey> = (
  readTokenValue: DataGridFormulaTokenValueReader<TKey>,
) => DataGridFormulaValue

export type DataGridFormulaEvaluator = DataGridFormulaEvaluatorForToken<DataGridComputedDependencyToken>

export type DataGridFormulaTokenIndexEvaluator = DataGridFormulaEvaluatorForToken<number>

export type DataGridFormulaBatchEvaluator = (
  contextsCount: number,
  readTokenByIndex: (contextIndex: number, tokenIndex: number) => unknown,
) => readonly DataGridFormulaValue[]

export type DataGridFormulaColumnarBatchEvaluator = (
  contextsCount: number,
  tokenColumns: readonly (readonly unknown[])[],
) => readonly DataGridFormulaValue[]

export class DataGridFormulaEvaluationError extends Error {
  readonly runtimeError: DataGridFormulaRuntimeError

  constructor(runtimeError: DataGridFormulaRuntimeError) {
    super(runtimeError.message)
    this.name = "DataGridFormulaEvaluationError"
    this.runtimeError = runtimeError
  }
}

export class DataGridFormulaSyntaxError extends Error {
  readonly span: DataGridFormulaSourceSpan

  constructor(message: string, span: DataGridFormulaSourceSpan) {
    super(message)
    this.name = "DataGridFormulaSyntaxError"
    this.span = span
  }
}

export function createFormulaSourceSpan(start: number, end: number): DataGridFormulaSourceSpan {
  const normalizedStart = Math.max(0, Math.trunc(start))
  const normalizedEnd = Math.max(normalizedStart, Math.trunc(end))
  return { start: normalizedStart, end: normalizedEnd }
}

export function getFormulaNodeSpan(node: DataGridFormulaAstNode): DataGridFormulaSourceSpan {
  return node.span
}

export type DataGridFormulaReferenceSegment = string | number

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
      return {
        value,
        end: cursor + 1,
      }
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
  return `"${segment
    .replace(/\\/g, "\\\\")
    .replace(/\"/g, '\\\"')}"`
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

export function isFormulaErrorValue(value: unknown): value is DataGridFormulaErrorValue {
  return typeof value === "object"
    && value !== null
    && (value as { kind?: unknown }).kind === "error"
    && typeof (value as { code?: unknown }).code === "string"
    && typeof (value as { message?: unknown }).message === "string"
}

export function isFormulaArrayValue(value: unknown): value is DataGridFormulaArrayValue {
  return Array.isArray(value)
}

export function createFormulaErrorValue(
  input: Pick<DataGridFormulaRuntimeError, "code" | "message">,
): DataGridFormulaErrorValue {
  return {
    kind: "error",
    code: input.code,
    message: input.message,
  }
}

function throwForFormulaErrorValue(value: DataGridFormulaErrorValue): never {
  throw new DataGridFormulaEvaluationError({
    code: value.code,
    message: value.message,
  })
}

export function findFormulaErrorValue(
  values: readonly DataGridFormulaValue[],
): DataGridFormulaErrorValue | null {
  for (const value of values) {
    if (isFormulaErrorValue(value)) {
      return value
    }
  }
  return null
}

function normalizeFormulaScalarValue(value: unknown): DataGridFormulaScalarValue {
  if (value === null || typeof value === "undefined") {
    return null
  }
  if (isFormulaErrorValue(value)) {
    return value
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : 0
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return value
  }
  if (typeof value === "bigint") {
    return Number(value)
  }
  return null
}

function normalizeFormulaArrayValue(value: readonly unknown[]): DataGridFormulaArrayValue {
  const normalized: DataGridFormulaScalarValue[] = []
  for (const entry of value) {
    if (Array.isArray(entry)) {
      normalized.push(...normalizeFormulaArrayValue(entry))
      continue
    }
    normalized.push(normalizeFormulaScalarValue(entry))
  }
  return Object.freeze(normalized)
}

function expandFormulaValue(value: DataGridFormulaValue): readonly DataGridFormulaScalarValue[] {
  if (Array.isArray(value)) {
    return value
  }
  return [value as DataGridFormulaScalarValue]
}

function expandFormulaArgs(args: readonly DataGridFormulaValue[]): readonly DataGridFormulaScalarValue[] {
  const expanded: DataGridFormulaScalarValue[] = []
  for (const value of args) {
    expanded.push(...expandFormulaValue(value))
  }
  return expanded
}

function coerceFormulaValueToScalar(value: DataGridFormulaValue): DataGridFormulaScalarValue {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value as DataGridFormulaScalarValue
}

export function normalizeFormulaValue(value: unknown): DataGridFormulaValue {
  if (Array.isArray(value)) {
    return normalizeFormulaArrayValue(value)
  }
  return normalizeFormulaScalarValue(value)
}

export function isFormulaValueBlank(value: DataGridFormulaValue): boolean {
  if (Array.isArray(value)) {
    return value.length === 0 || value.every(item => item === null)
  }
  return value === null
}

export function isFormulaValueEmptyText(value: DataGridFormulaValue): boolean {
  return typeof value === "string" && value.length === 0
}

export function coerceFormulaValueToNumber(value: DataGridFormulaValue): number {
  const scalarValue = coerceFormulaValueToScalar(value)
  if (isFormulaErrorValue(scalarValue)) {
    throwForFormulaErrorValue(scalarValue)
  }
  if (typeof scalarValue === "number") {
    return Number.isFinite(scalarValue)
      ? scalarValue
      : 0
  }
  if (scalarValue instanceof Date) {
    return Number.isNaN(scalarValue.getTime())
      ? 0
      : scalarValue.getTime()
  }
  if (typeof scalarValue === "boolean") {
    return scalarValue
      ? 1
      : 0
  }
  if (typeof scalarValue === "string") {
    const next = Number(scalarValue)
    return Number.isFinite(next)
      ? next
      : 0
  }
  return 0
}

export function coerceFormulaValueToBoolean(value: DataGridFormulaValue): boolean {
  const scalarValue = coerceFormulaValueToScalar(value)
  if (isFormulaErrorValue(scalarValue)) {
    throwForFormulaErrorValue(scalarValue)
  }
  if (typeof scalarValue === "boolean") {
    return scalarValue
  }
  if (typeof scalarValue === "string") {
    if (scalarValue.trim().length === 0) {
      return false
    }
    const parsed = Number(scalarValue)
    if (Number.isFinite(parsed)) {
      return parsed !== 0
    }
    return true
  }
  if (scalarValue instanceof Date) {
    return !Number.isNaN(scalarValue.getTime())
  }
  return coerceFormulaValueToNumber(scalarValue) !== 0
}

export function isFormulaValuePresent(value: DataGridFormulaValue): boolean {
  return !isFormulaValueBlank(value)
}

function coerceFormulaValueToStrictNumber(
  value: DataGridFormulaValue,
): number | null {
  const scalarValue = coerceFormulaValueToScalar(value)
  if (scalarValue === null) {
    return null
  }
  if (isFormulaErrorValue(scalarValue)) {
    throwForFormulaErrorValue(scalarValue)
  }
  if (typeof scalarValue === "number") {
    return Number.isFinite(scalarValue) ? scalarValue : 0
  }
  if (typeof scalarValue === "boolean") {
    return scalarValue ? 1 : 0
  }
  if (scalarValue instanceof Date) {
    return Number.isNaN(scalarValue.getTime()) ? null : scalarValue.getTime()
  }
  const text = scalarValue.trim()
  if (text.length === 0) {
    return null
  }
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function coerceFormulaValueToDate(
  value: DataGridFormulaValue,
): Date | null {
  const scalarValue = coerceFormulaValueToScalar(value)
  if (scalarValue === null) {
    return null
  }
  if (isFormulaErrorValue(scalarValue)) {
    throwForFormulaErrorValue(scalarValue)
  }
  if (scalarValue instanceof Date) {
    return Number.isNaN(scalarValue.getTime()) ? null : scalarValue
  }
  if (typeof scalarValue === "number") {
    if (!Number.isFinite(scalarValue)) {
      return null
    }
    const date = new Date(scalarValue)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof scalarValue === "string") {
    const text = scalarValue.trim()
    if (text.length === 0) {
      return null
    }
    const timestamp = Date.parse(text)
    if (!Number.isFinite(timestamp)) {
      return null
    }
    const date = new Date(timestamp)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

export function areFormulaValuesEqual(
  left: DataGridFormulaValue,
  right: DataGridFormulaValue,
): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!areFormulaValuesEqual(left[index] ?? null, right[index] ?? null)) {
        return false
      }
    }
    return true
  }
  if (isFormulaErrorValue(left)) {
    throwForFormulaErrorValue(left)
  }
  if (isFormulaErrorValue(right)) {
    throwForFormulaErrorValue(right)
  }
  if (left === null || right === null) {
    return left === right
  }
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime()
  }
  if (typeof left === "string" && typeof right === "string") {
    return left === right
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return left === right
  }
  const leftNumeric = coerceFormulaValueToStrictNumber(left)
  const rightNumeric = coerceFormulaValueToStrictNumber(right)
  if (leftNumeric !== null && rightNumeric !== null) {
    return leftNumeric === rightNumeric
  }
  return false
}

export function compareFormulaValues(
  left: DataGridFormulaValue,
  right: DataGridFormulaValue,
): number {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left)) {
      return -1
    }
    if (!Array.isArray(right)) {
      return 1
    }
    const maxLength = Math.max(left.length, right.length)
    for (let index = 0; index < maxLength; index += 1) {
      const compared = compareFormulaValues(left[index] ?? null, right[index] ?? null)
      if (compared !== 0) {
        return compared
      }
    }
    return 0
  }
  if (isFormulaErrorValue(left)) {
    throwForFormulaErrorValue(left)
  }
  if (isFormulaErrorValue(right)) {
    throwForFormulaErrorValue(right)
  }
  if (left === null && right === null) {
    return 0
  }
  if (left === null) {
    return -1
  }
  if (right === null) {
    return 1
  }
  // Keep pure string-vs-string comparison lexical for deterministic spreadsheet-like behavior.
  // Numeric coercion is applied only when both sides can be strictly parsed as numeric values.
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right)
  }
  const leftNumeric = coerceFormulaValueToStrictNumber(left)
  const rightNumeric = coerceFormulaValueToStrictNumber(right)
  if (leftNumeric !== null && rightNumeric !== null) {
    return leftNumeric - rightNumeric
  }
  return String(left).localeCompare(String(right))
}

export const DATAGRID_DEFAULT_FORMULA_FUNCTIONS: Readonly<Record<string, DataGridFormulaFunctionDefinition>> = {
  ABS: {
    arity: 1,
    compute: args => Math.abs(coerceFormulaValueToNumber(args[0] ?? null)),
  },
  ARRAY: {
    compute: args => Object.freeze([...expandFormulaArgs(args)]),
  },
  AVG: {
    compute: args => {
      const values = expandFormulaArgs(args)
      if (values.length === 0) {
        return 0
      }
      const total = values.reduce<number>(
        (accumulator, value) => accumulator + coerceFormulaValueToNumber(value ?? null),
        0,
      )
      return total / values.length
    },
  },
  CEIL: {
    arity: 1,
    compute: args => Math.ceil(coerceFormulaValueToNumber(args[0] ?? null)),
  },
  CONCAT: {
    compute: args => expandFormulaArgs(args)
      .map((value) => {
        if (value === null) {
          return ""
        }
        if (value instanceof Date) {
          return Number.isNaN(value.getTime())
            ? ""
            : value.toISOString()
        }
        return String(value)
      })
      .join(""),
  },
  COUNT: {
    compute: args => expandFormulaArgs(args).reduce<number>(
      (count, value) => (isFormulaValuePresent(value ?? null) ? count + 1 : count),
      0,
    ),
  },
  DATE: {
    arity: 3,
    compute: args => {
      const year = Math.trunc(coerceFormulaValueToNumber(args[0] ?? null))
      const month = Math.trunc(coerceFormulaValueToNumber(args[1] ?? null))
      const day = Math.trunc(coerceFormulaValueToNumber(args[2] ?? null))
      return new Date(Date.UTC(year, month - 1, day))
    },
  },
  DAY: {
    arity: 1,
    compute: args => {
      const date = coerceFormulaValueToDate(args[0] ?? null)
      return date ? date.getUTCDate() : 0
    },
  },
  FLOOR: {
    arity: 1,
    compute: args => Math.floor(coerceFormulaValueToNumber(args[0] ?? null)),
  },
  IF: {
    arity: 3,
    compute: args => (coerceFormulaValueToBoolean(args[0] ?? null) ? args[1] ?? 0 : args[2] ?? 0),
  },
  IFS: {
    arity: { min: 2 },
    compute: args => {
      for (let index = 0; index < args.length; index += 2) {
        const condition = args[index] ?? null
        const value = args[index + 1] ?? 0
        if (coerceFormulaValueToBoolean(condition)) {
          return value
        }
      }
      return 0
    },
  },
  COALESCE: {
    arity: { min: 1 },
    compute: args => {
      for (const value of args) {
        if (isFormulaValuePresent(value ?? null)) {
          return value
        }
      }
      return 0
    },
  },
  MAX: {
    compute: args => {
      const values = expandFormulaArgs(args)
      return values.length === 0 ? 0 : Math.max(...values.map(value => coerceFormulaValueToNumber(value ?? null)))
    },
  },
  CHOOSE: {
    arity: { min: 2 },
    compute: args => {
      const index = Math.trunc(coerceFormulaValueToNumber(args[0] ?? null))
      if (index < 1 || index >= args.length) {
        return 0
      }
      return args[index] ?? 0
    },
  },
  IN: {
    arity: { min: 2 },
    compute: args => {
      const candidate = args[0] ?? null
      const haystack = expandFormulaArgs(args.slice(1))
      return haystack.some(value => areFormulaValuesEqual(candidate, value)) ? 1 : 0
    },
  },
  INDEX: {
    arity: { min: 2, max: 3 },
    compute: args => {
      const source = expandFormulaValue(args[0] ?? null)
      const index = Math.trunc(coerceFormulaValueToNumber(args[1] ?? null))
      if (index < 1 || index > source.length) {
        return args[2] ?? 0
      }
      return source[index - 1] ?? (args[2] ?? 0)
    },
  },
  LEN: {
    arity: 1,
    compute: args => {
      const value = args[0] ?? null
      if (Array.isArray(value)) {
        return value.length
      }
      if (value === null) {
        return 0
      }
      if (value instanceof Date) {
        return Number.isNaN(value.getTime())
          ? 0
          : value.toISOString().length
      }
      return String(value).length
    },
  },
  LEFT: {
    arity: { min: 1, max: 2 },
    compute: args => {
      const text = args[0] === null || typeof args[0] === "undefined" ? "" : String(args[0])
      const count = Math.max(0, Math.trunc(coerceFormulaValueToNumber(args[1] ?? text.length)))
      return text.slice(0, count)
    },
  },
  LOWER: {
    arity: 1,
    compute: args => {
      const value = args[0] ?? null
      return value === null
        ? ""
        : String(value).toLowerCase()
    },
  },
  MID: {
    arity: 3,
    compute: args => {
      const text = args[0] === null || typeof args[0] === "undefined" ? "" : String(args[0])
      const start = Math.max(1, Math.trunc(coerceFormulaValueToNumber(args[1] ?? 1)))
      const count = Math.max(0, Math.trunc(coerceFormulaValueToNumber(args[2] ?? 0)))
      return text.slice(start - 1, start - 1 + count)
    },
  },
  MIN: {
    compute: args => {
      const values = expandFormulaArgs(args)
      return values.length === 0 ? 0 : Math.min(...values.map(value => coerceFormulaValueToNumber(value ?? null)))
    },
  },
  MATCH: {
    arity: { min: 2, max: 3 },
    compute: args => {
      const needle = args[0] ?? null
      const haystack = expandFormulaValue(args[1] ?? null)
      const matchMode = Math.trunc(coerceFormulaValueToNumber(args[2] ?? 0))
      if (matchMode !== 0) {
        return 0
      }
      for (let index = 0; index < haystack.length; index += 1) {
        if (areFormulaValuesEqual(needle, haystack[index] ?? null)) {
          return index + 1
        }
      }
      return 0
    },
  },
  MOD: {
    arity: 2,
    compute: args => {
      const left = coerceFormulaValueToNumber(args[0] ?? null)
      const right = coerceFormulaValueToNumber(args[1] ?? null)
      return right === 0 ? 0 : left % right
    },
  },
  MONTH: {
    arity: 1,
    compute: args => {
      const date = coerceFormulaValueToDate(args[0] ?? null)
      return date ? date.getUTCMonth() + 1 : 0
    },
  },
  POW: {
    arity: 2,
    compute: args => Math.pow(
      coerceFormulaValueToNumber(args[0] ?? null),
      coerceFormulaValueToNumber(args[1] ?? null),
    ),
  },
  RIGHT: {
    arity: { min: 1, max: 2 },
    compute: args => {
      const text = args[0] === null || typeof args[0] === "undefined" ? "" : String(args[0])
      const count = Math.max(0, Math.trunc(coerceFormulaValueToNumber(args[1] ?? text.length)))
      return count >= text.length ? text : text.slice(text.length - count)
    },
  },
  RANGE: {
    compute: args => Object.freeze([...expandFormulaArgs(args)]),
  },
  ROUND: {
    arity: { min: 1, max: 2 },
    compute: args => {
      const value = coerceFormulaValueToNumber(args[0] ?? null)
      const digits = Math.max(0, Math.trunc(coerceFormulaValueToNumber(args[1] ?? null)))
      const factor = 10 ** digits
      return Math.round(value * factor) / factor
    },
  },
  SUM: {
    compute: args => expandFormulaArgs(args).reduce<number>(
      (accumulator, value) => accumulator + coerceFormulaValueToNumber(value ?? null),
      0,
    ),
  },
  TRIM: {
    arity: 1,
    compute: args => {
      const value = args[0] ?? null
      return value === null
        ? ""
        : String(value).trim()
    },
  },
  UPPER: {
    arity: 1,
    compute: args => {
      const value = args[0] ?? null
      return value === null
        ? ""
        : String(value).toUpperCase()
    },
  },
  YEAR: {
    arity: 1,
    compute: args => {
      const date = coerceFormulaValueToDate(args[0] ?? null)
      return date ? date.getUTCFullYear() : 0
    },
  },
  XLOOKUP: {
    arity: { min: 3, max: 5 },
    compute: args => {
      const needle = args[0] ?? null
      const lookupValues = expandFormulaValue(args[1] ?? null)
      const returnValues = expandFormulaValue(args[2] ?? null)
      const notFound = args[3] ?? 0
      const matchMode = Math.trunc(coerceFormulaValueToNumber(args[4] ?? 0))
      if (matchMode !== 0) {
        return notFound
      }
      for (let index = 0; index < lookupValues.length; index += 1) {
        if (areFormulaValuesEqual(needle, lookupValues[index] ?? null)) {
          return returnValues[index] ?? notFound
        }
      }
      return notFound
    },
  },
}

export function throwFormulaError(
  message: string,
  span: DataGridFormulaSourceSpan = createFormulaSourceSpan(0, 0),
): never {
  throw new DataGridFormulaSyntaxError(`[DataGridFormula] ${message}`, span)
}

export function createFormulaDiagnostic(
  message: string,
  span: DataGridFormulaSourceSpan,
): DataGridFormulaDiagnostic {
  return {
    severity: "error",
    message,
    span,
  }
}

export function normalizeFormulaDiagnostic(error: unknown): DataGridFormulaDiagnostic {
  if (error instanceof DataGridFormulaSyntaxError) {
    return createFormulaDiagnostic(error.message, error.span)
  }
  if (error instanceof DataGridFormulaEvaluationError) {
    return createFormulaDiagnostic(error.runtimeError.message, createFormulaSourceSpan(0, 0))
  }
  const message = error instanceof Error ? error.message : String(error ?? "Formula diagnostics failed.")
  return createFormulaDiagnostic(message, createFormulaSourceSpan(0, 0))
}

export function createFormulaRuntimeError(
  code: DataGridFormulaRuntimeErrorCode,
  message: string,
  input: Partial<DataGridFormulaRuntimeError> = {},
): DataGridFormulaRuntimeError {
  return {
    code,
    message,
    ...input,
  }
}

export function normalizeFormulaRuntimeError(
  error: unknown,
  input: {
    formulaName: string
    field: string
    formula: string
    rowId: string | number
    sourceIndex: number
  },
): DataGridFormulaRuntimeError {
  if (error instanceof DataGridFormulaEvaluationError) {
    return {
      ...error.runtimeError,
      formulaName: error.runtimeError.formulaName ?? input.formulaName,
      field: error.runtimeError.field ?? input.field,
      formula: error.runtimeError.formula ?? input.formula,
      rowId: error.runtimeError.rowId ?? input.rowId,
      sourceIndex: error.runtimeError.sourceIndex ?? input.sourceIndex,
    }
  }
  const message = error instanceof Error
    ? error.message
    : String(error ?? "Formula evaluation failed.")
  return createFormulaRuntimeError("EVAL_ERROR", message, {
    formulaName: input.formulaName,
    field: input.field,
    formula: input.formula,
    rowId: input.rowId,
    sourceIndex: input.sourceIndex,
  })
}

export function normalizeFormulaText(value: unknown): string {
  if (typeof value !== "string") {
    throwFormulaError("Formula must be a string.")
  }
  const normalized = value.trim()
  if (normalized.length === 0) {
    throwFormulaError("Formula must be non-empty.")
  }
  return normalized.startsWith("=") ? normalized.slice(1).trim() : normalized
}

export function normalizeFormulaFieldName(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throwFormulaError(`${label} must be a string.`)
  }
  const normalized = value.trim()
  if (normalized.length === 0) {
    throwFormulaError(`${label} must be non-empty.`)
  }
  return normalized
}

export function normalizeFormulaFunctionName(value: string): string {
  return value.trim().toUpperCase()
}

function normalizeFormulaFunctionArity(
  arity: DataGridFormulaFunctionArity | undefined,
  functionName: string,
): DataGridFormulaFunctionArity | undefined {
  if (typeof arity === "undefined") {
    return undefined
  }
  if (typeof arity === "number") {
    if (!Number.isInteger(arity) || arity < 0) {
      throwFormulaError(`Function '${functionName}' has invalid arity definition.`)
    }
    return arity
  }
  const min = Math.trunc(arity.min)
  const max = typeof arity.max === "number" ? Math.trunc(arity.max) : undefined
  if (!Number.isFinite(min) || min < 0) {
    throwFormulaError(`Function '${functionName}' has invalid minimum arity.`)
  }
  if (typeof max === "number") {
    if (!Number.isFinite(max) || max < min) {
      throwFormulaError(`Function '${functionName}' has invalid maximum arity.`)
    }
    return { min, max }
  }
  return { min }
}

export function normalizeFormulaFunctionRegistry(
  input: DataGridFormulaFunctionRegistry | undefined,
  options: Pick<DataGridFormulaCompileOptions, "onFunctionOverride"> = {},
): ReadonlyMap<string, DataGridFormulaFunctionRuntime> {
  const normalized = new Map<string, DataGridFormulaFunctionRuntime>()

  const registerEntry = (
    key: string,
    definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[]) => unknown),
    source: "default" | "user",
  ): void => {
    const normalizedName = normalizeFormulaFunctionName(key)
    if (normalizedName.length === 0) {
      throwFormulaError("Function name must be non-empty.")
    }
    const runtimeDefinition = typeof definition === "function"
      ? {
          compute: definition,
        }
      : definition

    if (typeof runtimeDefinition.compute !== "function") {
      throwFormulaError(`Function '${normalizedName}' must provide a compute implementation.`)
    }

    if (source === "user" && normalized.has(normalizedName)) {
      options.onFunctionOverride?.(normalizedName)
    }

    normalized.set(normalizedName, {
      name: normalizedName,
      arity: normalizeFormulaFunctionArity(runtimeDefinition.arity, normalizedName),
      contextKeys: normalizeFormulaContextKeys(runtimeDefinition.contextKeys),
      compute: runtimeDefinition.compute,
    })
  }

  for (const [key, definition] of Object.entries(DATAGRID_DEFAULT_FORMULA_FUNCTIONS)) {
    registerEntry(key, definition, "default")
  }

  for (const [key, definition] of Object.entries(input ?? {})) {
    registerEntry(key, definition, "user")
  }

  return normalized
}

function normalizeFormulaContextKeys(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const normalized: string[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue
    }
    const nextValue = entry.trim()
    if (nextValue.length === 0 || seen.has(nextValue)) {
      continue
    }
    seen.add(nextValue)
    normalized.push(nextValue)
  }
  return normalized
}

export function collectFormulaContextKeys(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
  output: string[],
): void {
  if (root.kind === "call") {
    const functionName = normalizeFormulaFunctionName(root.name)
    const functionDefinition = functionRegistry.get(functionName)
    if (functionDefinition) {
      output.push(...functionDefinition.contextKeys)
    }
    for (const arg of root.args) {
      collectFormulaContextKeys(arg, functionRegistry, output)
    }
    return
  }
  if (root.kind === "unary") {
    collectFormulaContextKeys(root.value, functionRegistry, output)
    return
  }
  if (root.kind === "binary") {
    collectFormulaContextKeys(root.left, functionRegistry, output)
    collectFormulaContextKeys(root.right, functionRegistry, output)
  }
}

function dedupeFormulaContextKeys(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
): readonly string[] {
  const contextKeys: string[] = []
  collectFormulaContextKeys(root, functionRegistry, contextKeys)
  return normalizeFormulaContextKeys(contextKeys)
}

function validateFormulaFunctionArity(
  functionDefinition: DataGridFormulaFunctionRuntime,
  argsCount: number,
): void {
  const { arity } = functionDefinition
  if (typeof arity === "undefined") {
    return
  }
  if (typeof arity === "number") {
    if (argsCount !== arity) {
      throwFormulaError(
        `Function '${functionDefinition.name}' expects ${arity} argument(s), got ${argsCount}.`,
      )
    }
    return
  }
  if (argsCount < arity.min) {
    throwFormulaError(
      `Function '${functionDefinition.name}' expects at least ${arity.min} argument(s), got ${argsCount}.`,
    )
  }
  if (typeof arity.max === "number" && argsCount > arity.max) {
    throwFormulaError(
      `Function '${functionDefinition.name}' expects at most ${arity.max} argument(s), got ${argsCount}.`,
    )
  }
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

  const pushString = (quote: "'" | "\""): void => {
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
      tokens.push({
        kind: "operator",
        value: keyword,
        position: start,
        end: cursor,
      })
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
    if (current === "'" || current === "\"") {
      pushString(current)
      continue
    }
    if ((current >= "0" && current <= "9") || current === ".") {
      pushNumber()
      continue
    }

    const isIdentifierStart = (
      isFormulaReferenceIdentifierStart(current)
      || current === "["
    )
    if (isIdentifierStart) {
      pushIdentifier()
      continue
    }

    const next = formula[cursor + 1]
    if ((current === ">" || current === "<" || current === "=" || current === "!") && next === "=") {
      tokens.push({
        kind: "operator",
        value: `${current}${next}` as DataGridFormulaOperator,
        position: cursor,
        end: cursor + 2,
      })
      cursor += 2
      continue
    }

    if (current === ">" || current === "<") {
      tokens.push({
        kind: "operator",
        value: current,
        position: cursor,
        end: cursor + 1,
      })
      cursor += 1
      continue
    }

    if (current === "+" || current === "-" || current === "*" || current === "/") {
      tokens.push({
        kind: "operator",
        value: current,
        position: cursor,
        end: cursor + 1,
      })
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

export function parseFormula(tokens: readonly DataGridFormulaToken[]): DataGridFormulaAstNode {
  let cursor = 0

  const peek = (): DataGridFormulaToken | undefined => tokens[cursor]
  const consume = (): DataGridFormulaToken | undefined => {
    const next = tokens[cursor]
    if (!next) {
      return undefined
    }
    cursor += 1
    return next
  }

  const parseExpression = (): DataGridFormulaAstNode => parseOr()

  const parsePrimary = (): DataGridFormulaAstNode => {
    const token = consume()
    if (!token) {
      throwFormulaError("Unexpected end of formula.", createFormulaSourceSpan(0, 0))
    }
    if (token.kind === "number") {
      return { kind: "number", value: token.value, span: createFormulaSourceSpan(token.position, token.end) }
    }
    if (token.kind === "string") {
      return { kind: "literal", value: token.value, span: createFormulaSourceSpan(token.position, token.end) }
    }
    if (token.kind === "identifier") {
      const next = peek()
      if (!next || next.kind !== "paren" || next.value !== "(") {
        const keyword = token.value.toUpperCase()
        if (keyword === "TRUE") {
          return { kind: "literal", value: true, span: createFormulaSourceSpan(token.position, token.end) }
        }
        if (keyword === "FALSE") {
          return { kind: "literal", value: false, span: createFormulaSourceSpan(token.position, token.end) }
        }
        if (keyword === "NULL") {
          return { kind: "literal", value: null, span: createFormulaSourceSpan(token.position, token.end) }
        }
        return { kind: "identifier", name: token.value, span: createFormulaSourceSpan(token.position, token.end) }
      }
      consume()
      const args: DataGridFormulaAstNode[] = []
      const possibleClose = peek()
      if (possibleClose && possibleClose.kind === "paren" && possibleClose.value === ")") {
        consume()
        return {
          kind: "call",
          name: token.value,
          args,
          span: createFormulaSourceSpan(token.position, possibleClose.end),
        }
      }
      while (true) {
        args.push(parseExpression())
        const delimiter = peek()
        if (!delimiter || delimiter.kind !== "comma") {
          break
        }
        consume()
      }
      const close = consume()
      if (!close || close.kind !== "paren" || close.value !== ")") {
        throwFormulaError(
          `Missing ')' for function call '${token.value}' at position ${token.position + 1}.`,
          createFormulaSourceSpan(token.position, token.end),
        )
      }
      return {
        kind: "call",
        name: token.value,
        args,
        span: createFormulaSourceSpan(token.position, close.end),
      }
    }
    if (token.kind === "paren" && token.value === "(") {
      const nested = parseExpression()
      const close = consume()
      if (!close || close.kind !== "paren" || close.value !== ")") {
        throwFormulaError(`Missing ')' for group at position ${token.position + 1}.`, createFormulaSourceSpan(token.position, token.end))
      }
      return nested
    }
    throwFormulaError(`Unexpected token at position ${token.position + 1}.`, createFormulaSourceSpan(token.position, token.end))
  }

  const parseUnary = (): DataGridFormulaAstNode => {
    const token = peek()
    if (
      token
      && token.kind === "operator"
      && (token.value === "-" || token.value === "+" || token.value === "NOT")
    ) {
      consume()
      const value = parseUnary()
      return {
        kind: "unary",
        operator: token.value,
        value,
        span: createFormulaSourceSpan(token.position, value.span.end),
      }
    }
    return parsePrimary()
  }

  const parseMulDiv = (): DataGridFormulaAstNode => {
    let node = parseUnary()
    while (true) {
      const token = peek()
      if (!token || token.kind !== "operator" || (token.value !== "*" && token.value !== "/")) {
        break
      }
      consume()
      const right = parseUnary()
      node = {
        kind: "binary",
        operator: token.value,
        left: node,
        right,
        span: createFormulaSourceSpan(node.span.start, right.span.end),
      }
    }
    return node
  }

  const parseAddSub = (): DataGridFormulaAstNode => {
    let node = parseMulDiv()
    while (true) {
      const token = peek()
      if (!token || token.kind !== "operator" || (token.value !== "+" && token.value !== "-")) {
        break
      }
      consume()
      const right = parseMulDiv()
      node = {
        kind: "binary",
        operator: token.value,
        left: node,
        right,
        span: createFormulaSourceSpan(node.span.start, right.span.end),
      }
    }
    return node
  }

  const parseComparison = (): DataGridFormulaAstNode => {
    let node = parseAddSub()
    while (true) {
      const token = peek()
      if (
        !token
        || token.kind !== "operator"
        || (
          token.value !== ">"
          && token.value !== "<"
          && token.value !== ">="
          && token.value !== "<="
          && token.value !== "=="
          && token.value !== "!="
        )
      ) {
        break
      }
      consume()
      const right = parseAddSub()
      node = {
        kind: "binary",
        operator: token.value,
        left: node,
        right,
        span: createFormulaSourceSpan(node.span.start, right.span.end),
      }
    }
    return node
  }

  const parseAnd = (): DataGridFormulaAstNode => {
    let node = parseComparison()
    while (true) {
      const token = peek()
      if (!token || token.kind !== "operator" || token.value !== "AND") {
        break
      }
      consume()
      const right = parseComparison()
      node = {
        kind: "binary",
        operator: "AND",
        left: node,
        right,
        span: createFormulaSourceSpan(node.span.start, right.span.end),
      }
    }
    return node
  }

  const parseOr = (): DataGridFormulaAstNode => {
    let node = parseAnd()
    while (true) {
      const token = peek()
      if (!token || token.kind !== "operator" || token.value !== "OR") {
        break
      }
      consume()
      const right = parseAnd()
      node = {
        kind: "binary",
        operator: "OR",
        left: node,
        right,
        span: createFormulaSourceSpan(node.span.start, right.span.end),
      }
    }
    return node
  }

  const root = parseExpression()
  if (cursor < tokens.length) {
    const token = tokens[cursor]
    if (!token) {
      throwFormulaError("Unexpected trailing expression.", createFormulaSourceSpan(0, 0))
    }
    throwFormulaError(`Unexpected token at position ${token.position + 1}.`, createFormulaSourceSpan(token.position, token.end))
  }
  return root
}

export function collectFormulaIdentifiers(
  root: DataGridFormulaAstNode,
  output: string[],
): void {
  if (root.kind === "identifier") {
    output.push(root.name)
    return
  }
  if (root.kind === "call") {
    for (const arg of root.args) {
      collectFormulaIdentifiers(arg, output)
    }
    return
  }
  if (root.kind === "unary") {
    collectFormulaIdentifiers(root.value, output)
    return
  }
  if (root.kind === "binary") {
    collectFormulaIdentifiers(root.left, output)
    collectFormulaIdentifiers(root.right, output)
  }
}

export function validateFormulaFunctions(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
): void {
  if (root.kind === "call") {
    const functionName = normalizeFormulaFunctionName(root.name)
    const functionDefinition = functionRegistry.get(functionName)
    if (!functionDefinition) {
      throwFormulaError(`Unknown function '${root.name}'.`, root.span)
    }
    validateFormulaFunctionArity(functionDefinition, root.args.length)
    if (functionName === "IFS" && root.args.length % 2 !== 0) {
      throwFormulaError("Function 'IFS' expects an even number of arguments (condition/value pairs).", root.span)
    }
    for (const arg of root.args) {
      validateFormulaFunctions(arg, functionRegistry)
    }
    return
  }
  if (root.kind === "unary") {
    validateFormulaFunctions(root.value, functionRegistry)
    return
  }
  if (root.kind === "binary") {
    validateFormulaFunctions(root.left, functionRegistry)
    validateFormulaFunctions(root.right, functionRegistry)
  }
}

function createFormulaNumberNode(value: number): DataGridFormulaAstNode {
  return {
    kind: "number",
    value: Number.isFinite(value) ? value : 0,
    span: createFormulaSourceSpan(0, 0),
  }
}

function createFormulaLiteralNode(value: DataGridFormulaValue, span?: DataGridFormulaSourceSpan): DataGridFormulaAstNode {
  const normalized = normalizeFormulaValue(value)
  if (typeof normalized === "number") {
    return {
      kind: "number",
      value: normalized,
      span: span ?? createFormulaSourceSpan(0, 0),
    }
  }
  return {
    kind: "literal",
    value: normalized,
    span: span ?? createFormulaSourceSpan(0, 0),
  }
}

type DataGridFormulaLiteralNode =
  | { kind: "number"; value: number; span: DataGridFormulaSourceSpan }
  | { kind: "literal"; value: DataGridFormulaValue; span: DataGridFormulaSourceSpan }

function isFormulaLiteralNode(node: DataGridFormulaAstNode): node is DataGridFormulaLiteralNode {
  return node.kind === "number" || node.kind === "literal"
}

function getFormulaLiteralNodeValue(node: DataGridFormulaLiteralNode): DataGridFormulaValue {
  return node.kind === "number"
    ? node.value
    : node.value
}

export function foldFormulaConstants(root: DataGridFormulaAstNode): DataGridFormulaAstNode {
  if (root.kind === "number" || root.kind === "literal" || root.kind === "identifier") {
    return root
  }

  if (root.kind === "unary") {
    const value = foldFormulaConstants(root.value)
    if (!isFormulaLiteralNode(value)) {
      return {
        kind: "unary",
        operator: root.operator,
        value,
        span: root.span,
      }
    }
    const valueLiteral = getFormulaLiteralNodeValue(value)
    if (root.operator === "-") {
      return createFormulaLiteralNode(-coerceFormulaValueToNumber(valueLiteral), root.span)
    }
    if (root.operator === "+") {
      return createFormulaLiteralNode(+coerceFormulaValueToNumber(valueLiteral), root.span)
    }
    return createFormulaLiteralNode(coerceFormulaValueToBoolean(valueLiteral) ? 0 : 1, root.span)
  }

  if (root.kind === "call") {
    const args = root.args.map(arg => foldFormulaConstants(arg))
    const normalizedFunctionName = normalizeFormulaFunctionName(root.name)

    if (normalizedFunctionName === "IF") {
      const condition = args[0] ?? createFormulaNumberNode(0)
      const whenTrue = args[1] ?? createFormulaNumberNode(0)
      const whenFalse = args[2] ?? createFormulaNumberNode(0)
      if (isFormulaLiteralNode(condition)) {
        return coerceFormulaValueToBoolean(getFormulaLiteralNodeValue(condition))
          ? whenTrue
          : whenFalse
      }
      return {
        kind: "call",
        name: root.name,
        args,
        span: root.span,
      }
    }

    if (normalizedFunctionName === "IFS") {
      for (let index = 0; index < args.length; index += 2) {
        const condition = args[index]
        if (!condition || !isFormulaLiteralNode(condition)) {
          return {
            kind: "call",
            name: root.name,
            args,
            span: root.span,
          }
        }
        const value = args[index + 1] ?? createFormulaNumberNode(0)
        if (coerceFormulaValueToBoolean(getFormulaLiteralNodeValue(condition))) {
          return value
        }
      }
      return createFormulaNumberNode(0)
    }

    if (normalizedFunctionName === "COALESCE") {
      for (const value of args) {
        if (!isFormulaLiteralNode(value)) {
          return {
            kind: "call",
            name: root.name,
            args,
            span: root.span,
          }
        }
        if (isFormulaValuePresent(getFormulaLiteralNodeValue(value))) {
          return value
        }
      }
      return createFormulaNumberNode(0)
    }

    if (!args.every(isFormulaLiteralNode)) {
      return {
        kind: "call",
        name: root.name,
        args,
        span: root.span,
      }
    }

    const literalArgs = args.map(arg => getFormulaLiteralNodeValue(arg))
    if (normalizedFunctionName === "ABS") {
      return createFormulaLiteralNode(Math.abs(coerceFormulaValueToNumber(literalArgs[0] ?? null)), root.span)
    }
    if (normalizedFunctionName === "AVG") {
      if (literalArgs.length === 0) {
        return createFormulaLiteralNode(0, root.span)
      }
      return createFormulaLiteralNode(
        literalArgs.reduce<number>(
          (sum, value) => sum + coerceFormulaValueToNumber(value),
          0,
        ) / literalArgs.length,
        root.span,
      )
    }
    if (normalizedFunctionName === "CEIL") {
      return createFormulaLiteralNode(Math.ceil(coerceFormulaValueToNumber(literalArgs[0] ?? null)), root.span)
    }
    if (normalizedFunctionName === "CONCAT") {
      return createFormulaLiteralNode(
        literalArgs
          .map((value) => {
            if (value === null) {
              return ""
            }
            if (value instanceof Date) {
              return Number.isNaN(value.getTime())
                ? ""
                : value.toISOString()
            }
            return String(value)
          })
          .join(""),
        root.span,
      )
    }
    if (normalizedFunctionName === "COUNT") {
      return createFormulaLiteralNode(
        literalArgs.reduce<number>(
          (count, value) => (isFormulaValuePresent(value) ? count + 1 : count),
          0,
        ),
        root.span,
      )
    }
    if (normalizedFunctionName === "DATE") {
      const year = Math.trunc(coerceFormulaValueToNumber(literalArgs[0] ?? null))
      const month = Math.trunc(coerceFormulaValueToNumber(literalArgs[1] ?? null))
      const day = Math.trunc(coerceFormulaValueToNumber(literalArgs[2] ?? null))
      return createFormulaLiteralNode(new Date(Date.UTC(year, month - 1, day)), root.span)
    }
    if (normalizedFunctionName === "DAY") {
      const date = coerceFormulaValueToDate(literalArgs[0] ?? null)
      return createFormulaLiteralNode(date ? date.getUTCDate() : 0, root.span)
    }
    if (normalizedFunctionName === "FLOOR") {
      return createFormulaLiteralNode(Math.floor(coerceFormulaValueToNumber(literalArgs[0] ?? null)))
    }
    if (normalizedFunctionName === "LEN") {
      const value = literalArgs[0] ?? null
      return createFormulaLiteralNode(
        value === null
          ? 0
          : value instanceof Date
            ? (Number.isNaN(value.getTime()) ? 0 : value.toISOString().length)
            : String(value).length,
      )
    }
    if (normalizedFunctionName === "LEFT") {
      const value = literalArgs[0] ?? null
      const text = value === null ? "" : String(value)
      const count = Math.max(0, Math.trunc(coerceFormulaValueToNumber(literalArgs[1] ?? text.length)))
      return createFormulaLiteralNode(text.slice(0, count))
    }
    if (normalizedFunctionName === "LOWER") {
      const value = literalArgs[0] ?? null
      return createFormulaLiteralNode(value === null ? "" : String(value).toLowerCase())
    }
    if (normalizedFunctionName === "MID") {
      const value = literalArgs[0] ?? null
      const text = value === null ? "" : String(value)
      const start = Math.max(1, Math.trunc(coerceFormulaValueToNumber(literalArgs[1] ?? 1)))
      const count = Math.max(0, Math.trunc(coerceFormulaValueToNumber(literalArgs[2] ?? 0)))
      return createFormulaLiteralNode(text.slice(start - 1, start - 1 + count))
    }
    if (normalizedFunctionName === "MOD") {
      const left = coerceFormulaValueToNumber(literalArgs[0] ?? null)
      const right = coerceFormulaValueToNumber(literalArgs[1] ?? null)
      return createFormulaLiteralNode(right === 0 ? 0 : left % right)
    }
    if (normalizedFunctionName === "MONTH") {
      const date = coerceFormulaValueToDate(literalArgs[0] ?? null)
      return createFormulaLiteralNode(date ? date.getUTCMonth() + 1 : 0)
    }
    if (normalizedFunctionName === "POW") {
      return createFormulaLiteralNode(Math.pow(
        coerceFormulaValueToNumber(literalArgs[0] ?? null),
        coerceFormulaValueToNumber(literalArgs[1] ?? null),
      ))
    }
    if (normalizedFunctionName === "ROUND") {
      const sourceValue = coerceFormulaValueToNumber(literalArgs[0] ?? null)
      const digits = Math.max(0, Math.trunc(coerceFormulaValueToNumber(literalArgs[1] ?? null)))
      const factor = 10 ** digits
      return createFormulaLiteralNode(Math.round(sourceValue * factor) / factor)
    }
    if (normalizedFunctionName === "MIN") {
      return createFormulaLiteralNode(
        literalArgs.length === 0
          ? 0
          : Math.min(...literalArgs.map(value => coerceFormulaValueToNumber(value))),
      )
    }
    if (normalizedFunctionName === "MAX") {
      return createFormulaLiteralNode(
        literalArgs.length === 0
          ? 0
          : Math.max(...literalArgs.map(value => coerceFormulaValueToNumber(value))),
          root.span,
      )
    }
    if (normalizedFunctionName === "SUM") {
      return createFormulaLiteralNode(
        literalArgs.reduce<number>(
          (sum, value) => sum + coerceFormulaValueToNumber(value),
          0,
        ),
          root.span,
      )
    }
    if (normalizedFunctionName === "RIGHT") {
      const value = literalArgs[0] ?? null
      const text = value === null ? "" : String(value)
      const count = Math.max(0, Math.trunc(coerceFormulaValueToNumber(literalArgs[1] ?? text.length)))
      return createFormulaLiteralNode(count >= text.length ? text : text.slice(text.length - count), root.span)
    }
    if (normalizedFunctionName === "TRIM") {
      const value = literalArgs[0] ?? null
      return createFormulaLiteralNode(value === null ? "" : String(value).trim(), root.span)
    }
    if (normalizedFunctionName === "UPPER") {
      const value = literalArgs[0] ?? null
      return createFormulaLiteralNode(value === null ? "" : String(value).toUpperCase(), root.span)
    }
    if (normalizedFunctionName === "YEAR") {
      const date = coerceFormulaValueToDate(literalArgs[0] ?? null)
      return createFormulaLiteralNode(date ? date.getUTCFullYear() : 0, root.span)
    }

    return {
      kind: "call",
      name: root.name,
      args,
      span: root.span,
    }
  }

  const left = foldFormulaConstants(root.left)
  const right = foldFormulaConstants(root.right)

  if (root.operator === "AND" && isFormulaLiteralNode(left)) {
    if (!coerceFormulaValueToBoolean(getFormulaLiteralNodeValue(left))) {
      return createFormulaLiteralNode(0, root.span)
    }
    if (isFormulaLiteralNode(right)) {
      return createFormulaLiteralNode(
        coerceFormulaValueToBoolean(getFormulaLiteralNodeValue(right)) ? 1 : 0,
        root.span,
      )
    }
    return {
      kind: "binary",
      operator: "AND",
      left,
      right,
      span: root.span,
    }
  }

  if (root.operator === "OR" && isFormulaLiteralNode(left)) {
    if (coerceFormulaValueToBoolean(getFormulaLiteralNodeValue(left))) {
      return createFormulaLiteralNode(1, root.span)
    }
    if (isFormulaLiteralNode(right)) {
      return createFormulaLiteralNode(
        coerceFormulaValueToBoolean(getFormulaLiteralNodeValue(right)) ? 1 : 0,
        root.span,
      )
    }
    return {
      kind: "binary",
      operator: "OR",
      left,
      right,
      span: root.span,
    }
  }

  if (!isFormulaLiteralNode(left) || !isFormulaLiteralNode(right)) {
    return {
      kind: "binary",
      operator: root.operator,
      left,
      right,
      span: root.span,
    }
  }

  const leftValue = getFormulaLiteralNodeValue(left)
  const rightValue = getFormulaLiteralNodeValue(right)

  if (root.operator === "+") {
    return createFormulaLiteralNode(coerceFormulaValueToNumber(leftValue) + coerceFormulaValueToNumber(rightValue), root.span)
  }
  if (root.operator === "-") {
    return createFormulaLiteralNode(coerceFormulaValueToNumber(leftValue) - coerceFormulaValueToNumber(rightValue), root.span)
  }
  if (root.operator === "*") {
    return createFormulaLiteralNode(coerceFormulaValueToNumber(leftValue) * coerceFormulaValueToNumber(rightValue), root.span)
  }
  if (root.operator === "/") {
    if (coerceFormulaValueToNumber(rightValue) === 0) {
      return {
        kind: "binary",
        operator: "/",
        left,
        right,
        span: root.span,
      }
    }
    return createFormulaLiteralNode(
      coerceFormulaValueToNumber(leftValue) / coerceFormulaValueToNumber(rightValue),
      root.span,
    )
  }
  if (root.operator === ">") {
    return createFormulaLiteralNode(compareFormulaValues(leftValue, rightValue) > 0 ? 1 : 0, root.span)
  }
  if (root.operator === "<") {
    return createFormulaLiteralNode(compareFormulaValues(leftValue, rightValue) < 0 ? 1 : 0, root.span)
  }
  if (root.operator === ">=") {
    return createFormulaLiteralNode(compareFormulaValues(leftValue, rightValue) >= 0 ? 1 : 0, root.span)
  }
  if (root.operator === "<=") {
    return createFormulaLiteralNode(compareFormulaValues(leftValue, rightValue) <= 0 ? 1 : 0, root.span)
  }
  if (root.operator === "==") {
    return createFormulaLiteralNode(areFormulaValuesEqual(leftValue, rightValue) ? 1 : 0, root.span)
  }
  if (root.operator === "!=") {
    return createFormulaLiteralNode(areFormulaValuesEqual(leftValue, rightValue) ? 0 : 1, root.span)
  }
  return {
    kind: "binary",
    operator: root.operator,
    left,
    right,
    span: root.span,
  }
}

export function parseDataGridFormulaExpression(formula: string): DataGridFormulaParseResult {
  const normalizedFormula = normalizeFormulaText(formula)
  const tokens = tokenizeFormula(normalizedFormula)
  const ast = parseFormula(tokens)
  return {
    formula: normalizedFormula,
    tokens,
    ast,
  }
}

export function diagnoseDataGridFormulaExpression(
  formula: string,
  options: Pick<DataGridFormulaCompileOptions, "functionRegistry" | "onFunctionOverride"> = {},
): DataGridFormulaDiagnosticsResult {
  const normalizedFormula = normalizeFormulaText(formula)
  try {
    const tokens = tokenizeFormula(normalizedFormula)
    const ast = parseFormula(tokens)
    const functionRegistry = normalizeFormulaFunctionRegistry(options.functionRegistry, {
      onFunctionOverride: options.onFunctionOverride,
    })
    validateFormulaFunctions(ast, functionRegistry)
    return {
      ok: true,
      formula: normalizedFormula,
      diagnostics: [],
      tokens,
      ast,
    }
  } catch (error) {
    return {
      ok: false,
      formula: normalizedFormula,
      diagnostics: [normalizeFormulaDiagnostic(error)],
    }
  }
}

function dedupeFormulaIdentifiers(root: DataGridFormulaAstNode): readonly string[] {
  const references: string[] = []
  collectFormulaIdentifiers(root, references)
  const identifiers: string[] = []
  const seenIdentifiers = new Set<string>()
  for (const reference of references) {
    const normalized = reference.trim()
    if (normalized.length === 0 || seenIdentifiers.has(normalized)) {
      continue
    }
    seenIdentifiers.add(normalized)
    identifiers.push(normalized)
  }
  return Object.freeze(identifiers)
}

function normalizeFormulaExplainDependency(
  identifier: string,
  token: DataGridComputedDependencyToken,
): DataGridFormulaExplainDependency {
  const normalizedToken = typeof token === "string" ? token.trim() : ""
  if (normalizedToken.startsWith("field:")) {
    return {
      identifier,
      token,
      domain: "field",
      value: normalizedToken.slice("field:".length),
    }
  }
  if (normalizedToken.startsWith("computed:")) {
    return {
      identifier,
      token,
      domain: "computed",
      value: normalizedToken.slice("computed:".length),
    }
  }
  if (normalizedToken.startsWith("meta:")) {
    return {
      identifier,
      token,
      domain: "meta",
      value: normalizedToken.slice("meta:".length),
    }
  }
  return {
    identifier,
    token,
    domain: "unknown",
    value: normalizedToken.length > 0 ? normalizedToken : String(token),
  }
}

function createFormulaExplainNode(root: DataGridFormulaAstNode): DataGridFormulaExplainNode {
  if (root.kind === "number") {
    return {
      kind: root.kind,
      label: String(root.value),
      span: root.span,
      children: [],
      value: root.value,
    }
  }
  if (root.kind === "literal") {
    return {
      kind: root.kind,
      label: "literal",
      span: root.span,
      children: [],
      value: root.value,
    }
  }
  if (root.kind === "identifier") {
    return {
      kind: root.kind,
      label: root.name,
      span: root.span,
      children: [],
      name: root.name,
    }
  }
  if (root.kind === "call") {
    return {
      kind: root.kind,
      label: `${root.name}()`,
      span: root.span,
      children: root.args.map(createFormulaExplainNode),
      name: root.name,
      operator: "CALL",
    }
  }
  if (root.kind === "unary") {
    return {
      kind: root.kind,
      label: root.operator,
      span: root.span,
      children: [createFormulaExplainNode(root.value)],
      operator: root.operator,
    }
  }
  return {
    kind: root.kind,
    label: root.operator,
    span: root.span,
    children: [createFormulaExplainNode(root.left), createFormulaExplainNode(root.right)],
    operator: root.operator,
  }
}

export function explainDataGridFormulaExpression(
  formula: string,
  options: Pick<DataGridFormulaCompileOptions, "resolveDependencyToken" | "functionRegistry" | "onFunctionOverride"> = {},
): DataGridFormulaExplainResult {
  const normalizedFormula = normalizeFormulaText(formula)
  const tokens = tokenizeFormula(normalizedFormula)
  const ast = parseFormula(tokens)
  const identifiers = dedupeFormulaIdentifiers(ast)
  const functionRegistry = normalizeFormulaFunctionRegistry(options.functionRegistry, {
    onFunctionOverride: options.onFunctionOverride,
  })
  const resolveDependencyToken = options.resolveDependencyToken
    ?? ((identifier: string): DataGridComputedDependencyToken => `field:${identifier}`)
  const dependencies = identifiers.map(identifier => normalizeFormulaExplainDependency(
    identifier,
    resolveDependencyToken(identifier),
  ))
  return {
    formula: normalizedFormula,
    tokens,
    ast,
    identifiers,
    dependencies,
    contextKeys: dedupeFormulaContextKeys(ast, functionRegistry),
    tree: createFormulaExplainNode(ast),
  }
}

export function explainDataGridFormulaFieldDefinition(
  definition: {
    name: string
    field?: string
    formula: string
  },
  options: Pick<DataGridFormulaCompileOptions, "resolveDependencyToken" | "functionRegistry" | "onFunctionOverride"> = {},
): DataGridFormulaFieldExplainResult {
  const name = normalizeFormulaFieldName(definition.name, "Formula name")
  const field = normalizeFormulaFieldName(definition.field ?? name, "Formula target field")
  const explained = explainDataGridFormulaExpression(definition.formula, options)
  return {
    name,
    field,
    formula: explained.formula,
    tokens: explained.tokens,
    ast: explained.ast,
    identifiers: explained.identifiers,
    dependencies: explained.dependencies,
    contextKeys: explained.contextKeys,
    tree: explained.tree,
  }
}

export function formulaNumberIsTruthy(value: unknown): boolean {
  return coerceFormulaValueToBoolean(normalizeFormulaValue(value))
}
