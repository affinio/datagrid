// Syntax-level normalization and static validation before runtime compilation.
// This file owns identifier collection, function validation and constant folding.
import type {
  DataGridFormulaAstNode,
  DataGridFormulaSourceSpan,
} from "./ast.js"
import type {
  DataGridFormulaFunctionRuntime,
} from "./functions.js"
import type { DataGridFormulaValue } from "../coreTypes.js"
import {
  createFormulaSourceSpan,
  throwFormulaError,
} from "./ast.js"
import {
  normalizeFormulaFunctionName,
} from "./functions.js"
import {
  areFormulaValuesEqual,
  coerceFormulaValueToBoolean,
  coerceFormulaValueToNumber,
  compareFormulaValues,
  isFormulaErrorValue,
  isFormulaValuePresent,
  normalizeFormulaValue,
} from "./values.js"

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
      throwFormulaError(
        "Function 'IFS' expects an even number of arguments (condition/value pairs).",
        root.span,
      )
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

function createFormulaLiteralNode(
  value: DataGridFormulaValue,
  span?: DataGridFormulaSourceSpan,
): DataGridFormulaAstNode {
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
  return node.kind === "number" ? node.value : node.value
}

function coerceFormulaValueToDate(value: DataGridFormulaValue): Date | null {
  const scalarValue = Array.isArray(value) ? (value[0] ?? null) : value
  if (scalarValue === null) {
    return null
  }
  if (isFormulaErrorValue(scalarValue)) {
    throwFormulaError(scalarValue.message)
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
      return { kind: "call", name: root.name, args, span: root.span }
    }

    if (normalizedFunctionName === "IFS") {
      for (let index = 0; index < args.length; index += 2) {
        const condition = args[index]
        if (!condition || !isFormulaLiteralNode(condition)) {
          return { kind: "call", name: root.name, args, span: root.span }
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
          return { kind: "call", name: root.name, args, span: root.span }
        }
        if (isFormulaValuePresent(getFormulaLiteralNodeValue(value))) {
          return value
        }
      }
      return createFormulaNumberNode(0)
    }

    if (!args.every(isFormulaLiteralNode)) {
      return { kind: "call", name: root.name, args, span: root.span }
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
        literalArgs.reduce<number>((sum, value) => sum + coerceFormulaValueToNumber(value), 0) / literalArgs.length,
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
              return Number.isNaN(value.getTime()) ? "" : value.toISOString()
            }
            return String(value)
          })
          .join(""),
        root.span,
      )
    }
    if (normalizedFunctionName === "COUNT") {
      return createFormulaLiteralNode(
        literalArgs.reduce<number>((count, value) => (isFormulaValuePresent(value) ? count + 1 : count), 0),
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
      return createFormulaLiteralNode(Math.floor(coerceFormulaValueToNumber(literalArgs[0] ?? null)), root.span)
    }
    if (normalizedFunctionName === "LEN") {
      const value = literalArgs[0] ?? null
      return createFormulaLiteralNode(
        value === null ? 0 : value instanceof Date ? (Number.isNaN(value.getTime()) ? 0 : value.toISOString().length) : String(value).length,
        root.span,
      )
    }
    if (normalizedFunctionName === "LEFT") {
      const value = literalArgs[0] ?? null
      const text = value === null ? "" : String(value)
      const count = Math.max(0, Math.trunc(coerceFormulaValueToNumber(literalArgs[1] ?? text.length)))
      return createFormulaLiteralNode(text.slice(0, count), root.span)
    }
    if (normalizedFunctionName === "LOWER") {
      const value = literalArgs[0] ?? null
      return createFormulaLiteralNode(value === null ? "" : String(value).toLowerCase(), root.span)
    }
    if (normalizedFunctionName === "MID") {
      const value = literalArgs[0] ?? null
      const text = value === null ? "" : String(value)
      const start = Math.max(1, Math.trunc(coerceFormulaValueToNumber(literalArgs[1] ?? 1)))
      const count = Math.max(0, Math.trunc(coerceFormulaValueToNumber(literalArgs[2] ?? 0)))
      return createFormulaLiteralNode(text.slice(start - 1, start - 1 + count), root.span)
    }
    if (normalizedFunctionName === "MOD") {
      const left = coerceFormulaValueToNumber(literalArgs[0] ?? null)
      const right = coerceFormulaValueToNumber(literalArgs[1] ?? null)
      return createFormulaLiteralNode(right === 0 ? 0 : left % right, root.span)
    }
    if (normalizedFunctionName === "MONTH") {
      const date = coerceFormulaValueToDate(literalArgs[0] ?? null)
      return createFormulaLiteralNode(date ? date.getUTCMonth() + 1 : 0, root.span)
    }
    if (normalizedFunctionName === "POW") {
      return createFormulaLiteralNode(
        Math.pow(
          coerceFormulaValueToNumber(literalArgs[0] ?? null),
          coerceFormulaValueToNumber(literalArgs[1] ?? null),
        ),
        root.span,
      )
    }
    if (normalizedFunctionName === "ROUND") {
      const sourceValue = coerceFormulaValueToNumber(literalArgs[0] ?? null)
      const digits = Math.max(0, Math.trunc(coerceFormulaValueToNumber(literalArgs[1] ?? null)))
      const factor = 10 ** digits
      return createFormulaLiteralNode(Math.round(sourceValue * factor) / factor, root.span)
    }
    if (normalizedFunctionName === "MIN") {
      return createFormulaLiteralNode(
        literalArgs.length === 0 ? 0 : Math.min(...literalArgs.map(value => coerceFormulaValueToNumber(value))),
        root.span,
      )
    }
    if (normalizedFunctionName === "MAX") {
      return createFormulaLiteralNode(
        literalArgs.length === 0 ? 0 : Math.max(...literalArgs.map(value => coerceFormulaValueToNumber(value))),
        root.span,
      )
    }
    if (normalizedFunctionName === "SUM") {
      return createFormulaLiteralNode(
        literalArgs.reduce<number>((sum, value) => sum + coerceFormulaValueToNumber(value), 0),
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

    return { kind: "call", name: root.name, args, span: root.span }
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
    return { kind: "binary", operator: "AND", left, right, span: root.span }
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
    return { kind: "binary", operator: "OR", left, right, span: root.span }
  }

  if (!isFormulaLiteralNode(left) || !isFormulaLiteralNode(right)) {
    return { kind: "binary", operator: root.operator, left, right, span: root.span }
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
      return { kind: "binary", operator: "/", left, right, span: root.span }
    }
    return createFormulaLiteralNode(coerceFormulaValueToNumber(leftValue) / coerceFormulaValueToNumber(rightValue), root.span)
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
  return { kind: "binary", operator: root.operator, left, right, span: root.span }
}
