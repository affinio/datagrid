import type {
  DataGridComputedDependencyToken,
  DataGridComputedFieldComputeContext,
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
  compute: (args: readonly DataGridFormulaValue[]) => unknown
}

export type DataGridFormulaFunctionRegistry = Readonly<
  Record<string, DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[]) => unknown)>
>

export type DataGridFormulaRuntimeErrorPolicy = "coerce-zero" | "throw"
export type DataGridFormulaCompileStrategy = "auto" | "ast" | "jit"

export interface DataGridFormulaCompileOptions {
  resolveDependencyToken?: (identifier: string) => DataGridComputedDependencyToken
  functionRegistry?: DataGridFormulaFunctionRegistry
  onFunctionOverride?: (functionName: string) => void
  runtimeErrorPolicy?: DataGridFormulaRuntimeErrorPolicy
  onRuntimeError?: (error: DataGridFormulaRuntimeError) => void
  compileStrategy?: DataGridFormulaCompileStrategy
}

export interface DataGridCompiledFormulaField<TRow = unknown> {
  name: string
  field: string
  formula: string
  identifiers: readonly string[]
  deps: readonly DataGridComputedDependencyToken[]
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

export interface DataGridCompiledFormulaBatchContext<TRow = unknown> {
  row: TRow
  rowId: DataGridRowId
  sourceIndex: number
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
  | { kind: "number"; value: number; position: number }
  | { kind: "string"; value: string; position: number }
  | { kind: "identifier"; value: string; position: number }
  | { kind: "operator"; value: DataGridFormulaOperator; position: number }
  | { kind: "comma"; position: number }
  | { kind: "paren"; value: "(" | ")"; position: number }

export type DataGridFormulaAstNode =
  | { kind: "number"; value: number }
  | { kind: "literal"; value: DataGridFormulaValue }
  | { kind: "identifier"; name: string }
  | { kind: "call"; name: string; args: DataGridFormulaAstNode[] }
  | { kind: "unary"; operator: "-" | "+" | "NOT"; value: DataGridFormulaAstNode }
  | {
    kind: "binary"
    operator: DataGridFormulaOperator
    left: DataGridFormulaAstNode
    right: DataGridFormulaAstNode
  }

export interface DataGridFormulaFunctionRuntime {
  name: string
  arity?: DataGridFormulaFunctionArity
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

export function normalizeFormulaValue(value: unknown): DataGridFormulaValue {
  if (value === null || typeof value === "undefined") {
    return null
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

export function coerceFormulaValueToNumber(value: DataGridFormulaValue): number {
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : 0
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? 0
      : value.getTime()
  }
  if (typeof value === "boolean") {
    return value
      ? 1
      : 0
  }
  if (typeof value === "string") {
    const next = Number(value)
    return Number.isFinite(next)
      ? next
      : 0
  }
  return 0
}

export function coerceFormulaValueToBoolean(value: DataGridFormulaValue): boolean {
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "string") {
    if (value.trim().length === 0) {
      return false
    }
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed !== 0
    }
    return true
  }
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime())
  }
  return coerceFormulaValueToNumber(value) !== 0
}

export function isFormulaValuePresent(value: DataGridFormulaValue): boolean {
  return value !== null
}

function coerceFormulaValueToStrictNumber(
  value: DataGridFormulaValue,
): number | null {
  if (value === null) {
    return null
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime()
  }
  const text = value.trim()
  if (text.length === 0) {
    return null
  }
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

export function areFormulaValuesEqual(
  left: DataGridFormulaValue,
  right: DataGridFormulaValue,
): boolean {
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
    compute: args => (args.length === 0 ? 0 : Math.max(...args.map(value => coerceFormulaValueToNumber(value ?? null)))),
  },
  MIN: {
    compute: args => (args.length === 0 ? 0 : Math.min(...args.map(value => coerceFormulaValueToNumber(value ?? null)))),
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
    compute: args => args.reduce<number>(
      (accumulator, value) => accumulator + coerceFormulaValueToNumber(value ?? null),
      0,
    ),
  },
}

export function throwFormulaError(message: string): never {
  throw new Error(`[DataGridFormula] ${message}`)
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
      throwFormulaError(`Invalid number '${raw}' at position ${start + 1}.`)
    }
    tokens.push({ kind: "number", value: parsed, position: start })
  }

  const pushString = (quote: "'" | "\""): void => {
    const start = cursor
    cursor += 1
    let value = ""
    while (cursor < formula.length) {
      const current = formula[cursor]
      if (!current) {
        break
      }
      if (current === "\\") {
        const escaped = formula[cursor + 1]
        if (!escaped) {
          throwFormulaError(`Unterminated string literal at position ${start + 1}.`)
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
        cursor += 1
        tokens.push({ kind: "string", value, position: start })
        return
      }
      value += current
      cursor += 1
    }
    throwFormulaError(`Unterminated string literal at position ${start + 1}.`)
  }

  const pushIdentifier = (): void => {
    const start = cursor
    cursor += 1
    while (cursor < formula.length) {
      const current = formula[cursor]
      if (!current) {
        break
      }
      const isAlphaNumeric = (
        (current >= "a" && current <= "z")
        || (current >= "A" && current <= "Z")
        || (current >= "0" && current <= "9")
      )
      if (isAlphaNumeric || current === "_" || current === "." || current === "$") {
        cursor += 1
        continue
      }
      break
    }
    const value = formula.slice(start, cursor)
    const keyword = value.toUpperCase()
    if (keyword === "AND" || keyword === "OR" || keyword === "NOT") {
      tokens.push({
        kind: "operator",
        value: keyword,
        position: start,
      })
      return
    }
    tokens.push({ kind: "identifier", value, position: start })
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
      (current >= "a" && current <= "z")
      || (current >= "A" && current <= "Z")
      || current === "_"
      || current === "$"
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
      })
      cursor += 2
      continue
    }

    if (current === ">" || current === "<") {
      tokens.push({
        kind: "operator",
        value: current,
        position: cursor,
      })
      cursor += 1
      continue
    }

    if (current === "+" || current === "-" || current === "*" || current === "/") {
      tokens.push({
        kind: "operator",
        value: current,
        position: cursor,
      })
      cursor += 1
      continue
    }

    if (current === "(") {
      tokens.push({ kind: "paren", value: "(", position: cursor })
      cursor += 1
      continue
    }
    if (current === ")") {
      tokens.push({ kind: "paren", value: ")", position: cursor })
      cursor += 1
      continue
    }
    if (current === ",") {
      tokens.push({ kind: "comma", position: cursor })
      cursor += 1
      continue
    }

    if (current === "[" || current === "]") {
      throwFormulaError(
        "Bracket notation is not supported in identifiers. Use dot-separated paths (for example 'order.total').",
      )
    }

    throwFormulaError(`Unexpected token '${current}' at position ${cursor + 1}.`)
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
      throwFormulaError("Unexpected end of formula.")
    }
    if (token.kind === "number") {
      return { kind: "number", value: token.value }
    }
    if (token.kind === "string") {
      return { kind: "literal", value: token.value }
    }
    if (token.kind === "identifier") {
      const next = peek()
      if (!next || next.kind !== "paren" || next.value !== "(") {
        const keyword = token.value.toUpperCase()
        if (keyword === "TRUE") {
          return { kind: "literal", value: true }
        }
        if (keyword === "FALSE") {
          return { kind: "literal", value: false }
        }
        if (keyword === "NULL") {
          return { kind: "literal", value: null }
        }
        return { kind: "identifier", name: token.value }
      }
      consume()
      const args: DataGridFormulaAstNode[] = []
      const possibleClose = peek()
      if (possibleClose && possibleClose.kind === "paren" && possibleClose.value === ")") {
        consume()
        return { kind: "call", name: token.value, args }
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
        throwFormulaError(`Missing ')' for function call '${token.value}' at position ${token.position + 1}.`)
      }
      return { kind: "call", name: token.value, args }
    }
    if (token.kind === "paren" && token.value === "(") {
      const nested = parseExpression()
      const close = consume()
      if (!close || close.kind !== "paren" || close.value !== ")") {
        throwFormulaError(`Missing ')' for group at position ${token.position + 1}.`)
      }
      return nested
    }
    throwFormulaError(`Unexpected token at position ${token.position + 1}.`)
  }

  const parseUnary = (): DataGridFormulaAstNode => {
    const token = peek()
    if (
      token
      && token.kind === "operator"
      && (token.value === "-" || token.value === "+" || token.value === "NOT")
    ) {
      consume()
      return {
        kind: "unary",
        operator: token.value,
        value: parseUnary(),
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
      node = {
        kind: "binary",
        operator: token.value,
        left: node,
        right: parseUnary(),
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
      node = {
        kind: "binary",
        operator: token.value,
        left: node,
        right: parseMulDiv(),
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
      node = {
        kind: "binary",
        operator: token.value,
        left: node,
        right: parseAddSub(),
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
      node = {
        kind: "binary",
        operator: "AND",
        left: node,
        right: parseComparison(),
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
      node = {
        kind: "binary",
        operator: "OR",
        left: node,
        right: parseAnd(),
      }
    }
    return node
  }

  const root = parseExpression()
  if (cursor < tokens.length) {
    const token = tokens[cursor]
    if (!token) {
      throwFormulaError("Unexpected trailing expression.")
    }
    throwFormulaError(`Unexpected token at position ${token.position + 1}.`)
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
      throwFormulaError(`Unknown function '${root.name}'.`)
    }
    validateFormulaFunctionArity(functionDefinition, root.args.length)
    if (functionName === "IFS" && root.args.length % 2 !== 0) {
      throwFormulaError("Function 'IFS' expects an even number of arguments (condition/value pairs).")
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
  }
}

function createFormulaLiteralNode(value: DataGridFormulaValue): DataGridFormulaAstNode {
  const normalized = normalizeFormulaValue(value)
  if (typeof normalized === "number") {
    return createFormulaNumberNode(normalized)
  }
  return {
    kind: "literal",
    value: normalized,
  }
}

type DataGridFormulaLiteralNode =
  | { kind: "number"; value: number }
  | { kind: "literal"; value: DataGridFormulaValue }

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
      }
    }
    const valueLiteral = getFormulaLiteralNodeValue(value)
    if (root.operator === "-") {
      return createFormulaLiteralNode(-coerceFormulaValueToNumber(valueLiteral))
    }
    if (root.operator === "+") {
      return createFormulaLiteralNode(+coerceFormulaValueToNumber(valueLiteral))
    }
    return createFormulaLiteralNode(coerceFormulaValueToBoolean(valueLiteral) ? 0 : 1)
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
      }
    }

    const literalArgs = args.map(arg => getFormulaLiteralNodeValue(arg))
    if (normalizedFunctionName === "ABS") {
      return createFormulaLiteralNode(Math.abs(coerceFormulaValueToNumber(literalArgs[0] ?? null)))
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
      )
    }
    if (normalizedFunctionName === "SUM") {
      return createFormulaLiteralNode(
        literalArgs.reduce<number>(
          (sum, value) => sum + coerceFormulaValueToNumber(value),
          0,
        ),
      )
    }

    return {
      kind: "call",
      name: root.name,
      args,
    }
  }

  const left = foldFormulaConstants(root.left)
  const right = foldFormulaConstants(root.right)

  if (root.operator === "AND" && isFormulaLiteralNode(left)) {
    if (!coerceFormulaValueToBoolean(getFormulaLiteralNodeValue(left))) {
      return createFormulaNumberNode(0)
    }
    if (isFormulaLiteralNode(right)) {
      return createFormulaNumberNode(
        coerceFormulaValueToBoolean(getFormulaLiteralNodeValue(right)) ? 1 : 0,
      )
    }
    return {
      kind: "binary",
      operator: "AND",
      left,
      right,
    }
  }

  if (root.operator === "OR" && isFormulaLiteralNode(left)) {
    if (coerceFormulaValueToBoolean(getFormulaLiteralNodeValue(left))) {
      return createFormulaNumberNode(1)
    }
    if (isFormulaLiteralNode(right)) {
      return createFormulaNumberNode(
        coerceFormulaValueToBoolean(getFormulaLiteralNodeValue(right)) ? 1 : 0,
      )
    }
    return {
      kind: "binary",
      operator: "OR",
      left,
      right,
    }
  }

  if (!isFormulaLiteralNode(left) || !isFormulaLiteralNode(right)) {
    return {
      kind: "binary",
      operator: root.operator,
      left,
      right,
    }
  }

  const leftValue = getFormulaLiteralNodeValue(left)
  const rightValue = getFormulaLiteralNodeValue(right)

  if (root.operator === "+") {
    return createFormulaLiteralNode(coerceFormulaValueToNumber(leftValue) + coerceFormulaValueToNumber(rightValue))
  }
  if (root.operator === "-") {
    return createFormulaLiteralNode(coerceFormulaValueToNumber(leftValue) - coerceFormulaValueToNumber(rightValue))
  }
  if (root.operator === "*") {
    return createFormulaLiteralNode(coerceFormulaValueToNumber(leftValue) * coerceFormulaValueToNumber(rightValue))
  }
  if (root.operator === "/") {
    if (coerceFormulaValueToNumber(rightValue) === 0) {
      return {
        kind: "binary",
        operator: "/",
        left,
        right,
      }
    }
    return createFormulaLiteralNode(
      coerceFormulaValueToNumber(leftValue) / coerceFormulaValueToNumber(rightValue),
    )
  }
  if (root.operator === ">") {
    return createFormulaNumberNode(compareFormulaValues(leftValue, rightValue) > 0 ? 1 : 0)
  }
  if (root.operator === "<") {
    return createFormulaNumberNode(compareFormulaValues(leftValue, rightValue) < 0 ? 1 : 0)
  }
  if (root.operator === ">=") {
    return createFormulaNumberNode(compareFormulaValues(leftValue, rightValue) >= 0 ? 1 : 0)
  }
  if (root.operator === "<=") {
    return createFormulaNumberNode(compareFormulaValues(leftValue, rightValue) <= 0 ? 1 : 0)
  }
  if (root.operator === "==") {
    return createFormulaNumberNode(areFormulaValuesEqual(leftValue, rightValue) ? 1 : 0)
  }
  if (root.operator === "!=") {
    return createFormulaNumberNode(areFormulaValuesEqual(leftValue, rightValue) ? 0 : 1)
  }
  return {
    kind: "binary",
    operator: root.operator,
    left,
    right,
  }
}

export function formulaNumberIsTruthy(value: unknown): boolean {
  return coerceFormulaValueToBoolean(normalizeFormulaValue(value))
}
