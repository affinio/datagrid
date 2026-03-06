import type {
  DataGridComputedDependencyToken,
  DataGridComputedFieldComputeContext,
  DataGridFormulaFieldDefinition,
  DataGridFormulaRuntimeError,
  DataGridFormulaRuntimeErrorCode,
} from "./rowModel.js"

export type DataGridFormulaFunctionArity = number | {
  min: number
  max?: number
}

export interface DataGridFormulaFunctionDefinition {
  arity?: DataGridFormulaFunctionArity
  compute: (args: readonly number[]) => unknown
}

export type DataGridFormulaFunctionRegistry = Readonly<
  Record<string, DataGridFormulaFunctionDefinition | ((args: readonly number[]) => unknown)>
>

export type DataGridFormulaRuntimeErrorPolicy = "coerce-zero" | "throw"

export interface DataGridFormulaCompileOptions {
  resolveDependencyToken?: (identifier: string) => DataGridComputedDependencyToken
  functionRegistry?: DataGridFormulaFunctionRegistry
  onFunctionOverride?: (functionName: string) => void
  runtimeErrorPolicy?: DataGridFormulaRuntimeErrorPolicy
  onRuntimeError?: (error: DataGridFormulaRuntimeError) => void
}

export interface DataGridCompiledFormulaField<TRow = unknown> {
  name: string
  field: string
  formula: string
  identifiers: readonly string[]
  deps: readonly DataGridComputedDependencyToken[]
  compute: (context: DataGridComputedFieldComputeContext<TRow>) => unknown
}

type DataGridFormulaOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | ">"
  | "<"
  | ">="
  | "<="
  | "=="
  | "!="

type DataGridFormulaToken =
  | { kind: "number"; value: number; position: number }
  | { kind: "identifier"; value: string; position: number }
  | { kind: "operator"; value: DataGridFormulaOperator; position: number }
  | { kind: "comma"; position: number }
  | { kind: "paren"; value: "(" | ")"; position: number }

type DataGridFormulaAstNode =
  | { kind: "number"; value: number }
  | { kind: "identifier"; name: string }
  | { kind: "call"; name: string; args: DataGridFormulaAstNode[] }
  | { kind: "unary"; operator: "-" | "+"; value: DataGridFormulaAstNode }
  | {
    kind: "binary"
    operator: DataGridFormulaOperator
    left: DataGridFormulaAstNode
    right: DataGridFormulaAstNode
  }

interface DataGridFormulaFunctionRuntime {
  name: string
  arity?: DataGridFormulaFunctionArity
  compute: (args: readonly number[]) => unknown
}

type DataGridFormulaEvaluator = (
  resolveIdentifierValue: (identifier: string) => unknown,
) => number

class DataGridFormulaEvaluationError extends Error {
  readonly runtimeError: DataGridFormulaRuntimeError

  constructor(runtimeError: DataGridFormulaRuntimeError) {
    super(runtimeError.message)
    this.name = "DataGridFormulaEvaluationError"
    this.runtimeError = runtimeError
  }
}

const DATAGRID_DEFAULT_FORMULA_FUNCTIONS: Readonly<Record<string, DataGridFormulaFunctionDefinition>> = {
  ABS: {
    arity: 1,
    compute: args => Math.abs(args[0] ?? 0),
  },
  IF: {
    arity: 3,
    compute: args => (args[0] !== 0 ? args[1] : args[2]),
  },
  MAX: {
    compute: args => (args.length === 0 ? 0 : Math.max(...args)),
  },
  MIN: {
    compute: args => (args.length === 0 ? 0 : Math.min(...args)),
  },
  ROUND: {
    arity: { min: 1, max: 2 },
    compute: args => {
      const value = args[0] ?? 0
      const digits = Math.max(0, Math.trunc(args[1] ?? 0))
      const factor = 10 ** digits
      return Math.round(value * factor) / factor
    },
  },
  SUM: {
    compute: args => args.reduce((accumulator, value) => accumulator + value, 0),
  },
}

function throwFormulaError(message: string): never {
  throw new Error(`[DataGridFormula] ${message}`)
}

function createFormulaRuntimeError(
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

function normalizeFormulaRuntimeError(
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

function normalizeFormulaText(value: unknown): string {
  if (typeof value !== "string") {
    throwFormulaError("Formula must be a string.")
  }
  const normalized = value.trim()
  if (normalized.length === 0) {
    throwFormulaError("Formula must be non-empty.")
  }
  return normalized.startsWith("=") ? normalized.slice(1).trim() : normalized
}

function normalizeFormulaFieldName(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throwFormulaError(`${label} must be a string.`)
  }
  const normalized = value.trim()
  if (normalized.length === 0) {
    throwFormulaError(`${label} must be non-empty.`)
  }
  return normalized
}

function normalizeFormulaFunctionName(value: string): string {
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

function normalizeFormulaFunctionRegistry(
  input: DataGridFormulaFunctionRegistry | undefined,
  options: Pick<DataGridFormulaCompileOptions, "onFunctionOverride"> = {},
): ReadonlyMap<string, DataGridFormulaFunctionRuntime> {
  const normalized = new Map<string, DataGridFormulaFunctionRuntime>()

  const registerEntry = (
    key: string,
    definition: DataGridFormulaFunctionDefinition | ((args: readonly number[]) => unknown),
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

function validateFormulaFunctionArityRuntime(
  functionDefinition: DataGridFormulaFunctionRuntime,
  argsCount: number,
): void {
  const { arity } = functionDefinition
  if (typeof arity === "undefined") {
    return
  }
  if (typeof arity === "number") {
    if (argsCount !== arity) {
      throw new DataGridFormulaEvaluationError(
        createFormulaRuntimeError(
          "FUNCTION_ARITY",
          `Function '${functionDefinition.name}' expects ${arity} argument(s), got ${argsCount}.`,
          { functionName: functionDefinition.name },
        ),
      )
    }
    return
  }
  if (argsCount < arity.min) {
    throw new DataGridFormulaEvaluationError(
      createFormulaRuntimeError(
        "FUNCTION_ARITY",
        `Function '${functionDefinition.name}' expects at least ${arity.min} argument(s), got ${argsCount}.`,
        { functionName: functionDefinition.name },
      ),
    )
  }
  if (typeof arity.max === "number" && argsCount > arity.max) {
    throw new DataGridFormulaEvaluationError(
      createFormulaRuntimeError(
        "FUNCTION_ARITY",
        `Function '${functionDefinition.name}' expects at most ${arity.max} argument(s), got ${argsCount}.`,
        { functionName: functionDefinition.name },
      ),
    )
  }
}

function tokenizeFormula(formula: string): readonly DataGridFormulaToken[] {
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

function parseFormula(tokens: readonly DataGridFormulaToken[]): DataGridFormulaAstNode {
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

  const parseExpression = (): DataGridFormulaAstNode => parseComparison()

  const parsePrimary = (): DataGridFormulaAstNode => {
    const token = consume()
    if (!token) {
      throwFormulaError("Unexpected end of formula.")
    }
    if (token.kind === "number") {
      return { kind: "number", value: token.value }
    }
    if (token.kind === "identifier") {
      const next = peek()
      if (!next || next.kind !== "paren" || next.value !== "(") {
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
    if (token && token.kind === "operator" && (token.value === "-" || token.value === "+")) {
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

function collectFormulaIdentifiers(
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

function validateFormulaFunctions(
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

function normalizeFormulaNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === "bigint") {
    return Number(value)
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0
  }
  if (value == null || value === "") {
    return 0
  }
  const next = Number(value)
  return Number.isFinite(next) ? next : 0
}

function compileFormulaAstEvaluator(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
): DataGridFormulaEvaluator {
  if (root.kind === "number") {
    return () => root.value
  }
  if (root.kind === "identifier") {
    return resolveIdentifierValue => normalizeFormulaNumber(resolveIdentifierValue(root.name))
  }
  if (root.kind === "call") {
    const functionDefinition = functionRegistry.get(normalizeFormulaFunctionName(root.name))
    if (!functionDefinition) {
      throw new DataGridFormulaEvaluationError(
        createFormulaRuntimeError(
          "FUNCTION_UNKNOWN",
          `Unknown function '${root.name}'.`,
          { functionName: normalizeFormulaFunctionName(root.name) },
        ),
      )
    }
    const argEvaluators = root.args.map(arg => compileFormulaAstEvaluator(arg, functionRegistry))
    return (resolveIdentifierValue) => {
      const args = argEvaluators.map(evaluator => evaluator(resolveIdentifierValue))
      validateFormulaFunctionArityRuntime(functionDefinition, args.length)
      try {
        return normalizeFormulaNumber(functionDefinition.compute(args))
      } catch (error) {
        throw new DataGridFormulaEvaluationError(
          createFormulaRuntimeError(
            "EVAL_ERROR",
            error instanceof Error ? error.message : String(error ?? "Function evaluation failed."),
            { functionName: functionDefinition.name },
          ),
        )
      }
    }
  }
  if (root.kind === "unary") {
    const valueEvaluator = compileFormulaAstEvaluator(root.value, functionRegistry)
    return resolveIdentifierValue => {
      const value = valueEvaluator(resolveIdentifierValue)
      return root.operator === "-" ? -value : value
    }
  }

  const leftEvaluator = compileFormulaAstEvaluator(root.left, functionRegistry)
  const rightEvaluator = compileFormulaAstEvaluator(root.right, functionRegistry)
  if (root.operator === "+") {
    return resolveIdentifierValue => leftEvaluator(resolveIdentifierValue) + rightEvaluator(resolveIdentifierValue)
  }
  if (root.operator === "-") {
    return resolveIdentifierValue => leftEvaluator(resolveIdentifierValue) - rightEvaluator(resolveIdentifierValue)
  }
  if (root.operator === "*") {
    return resolveIdentifierValue => leftEvaluator(resolveIdentifierValue) * rightEvaluator(resolveIdentifierValue)
  }
  if (root.operator === "/") {
    return (resolveIdentifierValue) => {
      const right = rightEvaluator(resolveIdentifierValue)
      if (right === 0) {
        // Grid runtime policy: division by zero is coerced to 0 (unless throw policy is enabled).
        throw new DataGridFormulaEvaluationError(
          createFormulaRuntimeError(
            "DIV_ZERO",
            "Division by zero.",
            { operator: "/" },
          ),
        )
      }
      const left = leftEvaluator(resolveIdentifierValue)
      return left / right
    }
  }
  if (root.operator === ">") {
    return resolveIdentifierValue => (
      leftEvaluator(resolveIdentifierValue) > rightEvaluator(resolveIdentifierValue) ? 1 : 0
    )
  }
  if (root.operator === "<") {
    return resolveIdentifierValue => (
      leftEvaluator(resolveIdentifierValue) < rightEvaluator(resolveIdentifierValue) ? 1 : 0
    )
  }
  if (root.operator === ">=") {
    return resolveIdentifierValue => (
      leftEvaluator(resolveIdentifierValue) >= rightEvaluator(resolveIdentifierValue) ? 1 : 0
    )
  }
  if (root.operator === "<=") {
    return resolveIdentifierValue => (
      leftEvaluator(resolveIdentifierValue) <= rightEvaluator(resolveIdentifierValue) ? 1 : 0
    )
  }
  if (root.operator === "==") {
    return resolveIdentifierValue => (
      leftEvaluator(resolveIdentifierValue) === rightEvaluator(resolveIdentifierValue) ? 1 : 0
    )
  }
  return resolveIdentifierValue => (
    leftEvaluator(resolveIdentifierValue) !== rightEvaluator(resolveIdentifierValue) ? 1 : 0
  )
}

export function compileDataGridFormulaFieldDefinition<TRow = unknown>(
  definition: DataGridFormulaFieldDefinition,
  options: DataGridFormulaCompileOptions = {},
): DataGridCompiledFormulaField<TRow> {
  const name = normalizeFormulaFieldName(definition.name, "Formula name")
  const field = normalizeFormulaFieldName(definition.field ?? name, "Formula target field")
  const formula = normalizeFormulaText(definition.formula)
  const tokens = tokenizeFormula(formula)
  const ast = parseFormula(tokens)
  const functionRegistry = normalizeFormulaFunctionRegistry(options.functionRegistry, {
    onFunctionOverride: options.onFunctionOverride,
  })
  validateFormulaFunctions(ast, functionRegistry)
  const evaluator = compileFormulaAstEvaluator(ast, functionRegistry)
  const runtimeErrorPolicy: DataGridFormulaRuntimeErrorPolicy = options.runtimeErrorPolicy ?? "coerce-zero"

  const references: string[] = []
  collectFormulaIdentifiers(ast, references)

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

  const resolveDependencyToken = options.resolveDependencyToken
    ?? ((identifier: string): DataGridComputedDependencyToken => `field:${identifier}`)
  const deps: DataGridComputedDependencyToken[] = []
  const dependencyTokenByIdentifier = new Map<string, DataGridComputedDependencyToken>()
  const seenDependencyTokens = new Set<string>()

  for (const identifier of identifiers) {
    const token = resolveDependencyToken(identifier)
    dependencyTokenByIdentifier.set(identifier, token)
    if (seenDependencyTokens.has(token)) {
      continue
    }
    seenDependencyTokens.add(token)
    deps.push(token)
  }

  return {
    name,
    field,
    formula,
    identifiers,
    deps,
    compute: (context) => {
      try {
        return evaluator((identifier) => {
          const token = dependencyTokenByIdentifier.get(identifier)
          if (!token) {
            return 0
          }
          return context.get(token)
        })
      } catch (error) {
        const runtimeError = normalizeFormulaRuntimeError(error, {
          formulaName: name,
          field,
          formula,
          rowId: context.rowId,
          sourceIndex: context.sourceIndex,
        })
        options.onRuntimeError?.(runtimeError)
        if (runtimeErrorPolicy === "throw") {
          throw new Error(`[DataGridFormula] ${runtimeError.message}`)
        }
        return 0
      }
    },
  }
}
