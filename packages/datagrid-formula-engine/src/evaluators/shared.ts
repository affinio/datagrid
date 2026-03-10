// Shared evaluator helpers used by multiple execution backends. Only keep code
// here when it is genuinely backend-neutral.
import type {
  DataGridFormulaValue,
} from "../coreTypes.js"
import { type DataGridFormulaFunctionRuntime } from "../runtime/types.js"
import { DATAGRID_DEFAULT_FORMULA_FUNCTIONS } from "../syntax/functions.js"
import {
  DataGridFormulaEvaluationError,
  createFormulaSourceSpan,
  type DataGridFormulaAstNode,
} from "../syntax/ast.js"
import {
  areFormulaValuesEqual,
  coerceFormulaValueToBoolean,
  coerceFormulaValueToNumber,
  compareFormulaValues,
  createFormulaRuntimeError,
  findFormulaErrorValue,
  isFormulaValuePresent,
  normalizeFormulaValue,
} from "../syntax/values.js"

export const ZERO_FORMULA_NODE: DataGridFormulaAstNode = {
  kind: "number",
  value: 0,
  span: createFormulaSourceSpan(0, 0),
}

export const NON_INLINEABLE_BUILTIN_FUNCTIONS = new Set<string>([
  "ARRAY",
  "AVG",
  "CONCAT",
  "COUNT",
  "INDEX",
  "IN",
  "LEN",
  "MATCH",
  "MAX",
  "MIN",
  "RANGE",
  "SUM",
  "TABLE",
  "XLOOKUP",
])

export type DataGridFormulaFusedColumnKernel = (
  contextsCount: number,
  tokenColumns: readonly (readonly unknown[])[],
) => DataGridFormulaValue[]

export type DataGridFormulaVectorColumnKernel = (
  contextsCount: number,
  tokenColumns: readonly (readonly unknown[])[],
) => DataGridFormulaValue[]

export interface DataGridFormulaRowIndexSelection {
  indexes: readonly number[]
  count: number
}

function isFormulaRowIndexSelection(
  rowIndexes: readonly number[] | DataGridFormulaRowIndexSelection,
): rowIndexes is DataGridFormulaRowIndexSelection {
  return !Array.isArray(rowIndexes)
}

export function createFormulaArrayFilled(
  contextsCount: number,
  value: DataGridFormulaValue,
): DataGridFormulaValue[] {
  const output = new Array<DataGridFormulaValue>(contextsCount)
  for (let contextIndex = 0; contextIndex < contextsCount; contextIndex += 1) {
    output[contextIndex] = value
  }
  return output
}

export function sliceTokenColumnsByIndexes(
  tokenColumns: readonly (readonly unknown[])[],
  rowIndexes: readonly number[] | DataGridFormulaRowIndexSelection,
): unknown[][] {
  const indexes = isFormulaRowIndexSelection(rowIndexes) ? rowIndexes.indexes : rowIndexes
  const count = isFormulaRowIndexSelection(rowIndexes) ? rowIndexes.count : rowIndexes.length
  return tokenColumns.map((column) => {
    const subset = new Array<unknown>(count)
    for (let index = 0; index < count; index += 1) {
      const rowIndex = indexes[index]
      subset[index] = typeof rowIndex === "number" ? column?.[rowIndex] : undefined
    }
    return subset
  })
}

export function evaluateVectorKernelForIndexes(
  kernel: DataGridFormulaVectorColumnKernel,
  tokenColumns: readonly (readonly unknown[])[],
  rowIndexes: readonly number[] | DataGridFormulaRowIndexSelection,
): DataGridFormulaValue[] {
  const count = isFormulaRowIndexSelection(rowIndexes) ? rowIndexes.count : rowIndexes.length
  if (count === 0) {
    return []
  }
  return kernel(count, sliceTokenColumnsByIndexes(tokenColumns, rowIndexes))
}

export function createSequentialRowIndexes(contextsCount: number): number[] {
  const rowIndexes = new Array<number>(contextsCount)
  for (let index = 0; index < contextsCount; index += 1) {
    rowIndexes[index] = index
  }
  return rowIndexes
}

export interface DataGridFormulaJitRuntimeHelpers {
  toNumber: (value: DataGridFormulaValue) => number
  toBoolean: (value: DataGridFormulaValue) => boolean
  isPresent: (value: DataGridFormulaValue) => boolean
  compare: (left: DataGridFormulaValue, right: DataGridFormulaValue) => number
  equals: (left: DataGridFormulaValue, right: DataGridFormulaValue) => boolean
  callFunction: (functionName: string, args: readonly DataGridFormulaValue[]) => DataGridFormulaValue
  divide: (left: number, right: number) => number
  round: (value: number, digits: number) => number
}

export type DataGridFormulaJitReadValueMode = "single" | "batch" | "columnar"

export function buildJitReadValueBody(mode: DataGridFormulaJitReadValueMode): string {
  const readRawExpression = mode === "single"
    ? `const token = dependencyTokens[tokenIndex]\n          const raw = readTokenValue(token)`
    : mode === "batch"
      ? `const raw = readTokenByIndex(contextIndex, tokenIndex)`
      : `const column = tokenColumns[tokenIndex]\n          const raw = column ? column[contextIndex] : undefined`

  return `const readValue = (tokenIndex) => {
          ${readRawExpression}
          if (raw === null || typeof raw === "undefined") {
            return null
          }
          if (raw instanceof Date) {
            const rawTime = raw.getTime()
            return Number.isNaN(rawTime) ? null : raw
          }
          const rawType = typeof raw
          if (rawType === "number") {
            return Number.isFinite(raw) ? raw : 0
          }
          if (rawType === "string" || rawType === "boolean") {
            return raw
          }
          if (rawType === "object" && raw && raw.kind === "error" && typeof raw.code === "string" && typeof raw.message === "string") {
            return raw
          }
          if (rawType === "bigint") {
            return Number(raw)
          }
          return null
        }`
}

export function createFormulaJitRuntimeHelpers(
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
): DataGridFormulaJitRuntimeHelpers {
  const divide = (left: number, right: number): number => {
    if (right === 0) {
      throw new DataGridFormulaEvaluationError(
        createFormulaRuntimeError(
          "DIV_ZERO",
          "Division by zero.",
          { operator: "/" },
        ),
      )
    }
    return left / right
  }

  const callFunction = (
    functionName: string,
    args: readonly DataGridFormulaValue[],
  ): DataGridFormulaValue => {
    const functionDefinition = functionRegistry.get(functionName)
    if (!functionDefinition) {
      throw new DataGridFormulaEvaluationError(
        createFormulaRuntimeError(
          "FUNCTION_UNKNOWN",
          `Unknown function '${functionName}'.`,
          { functionName },
        ),
      )
    }
    try {
      const formulaError = findFormulaErrorValue(args)
      if (formulaError) {
        return formulaError
      }
      return normalizeFormulaValue(functionDefinition.compute(args))
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

  const toNumber = (value: DataGridFormulaValue): number => coerceFormulaValueToNumber(value)
  const toBoolean = (value: DataGridFormulaValue): boolean => coerceFormulaValueToBoolean(value)
  const isPresent = (value: DataGridFormulaValue): boolean => isFormulaValuePresent(value)
  const compare = (left: DataGridFormulaValue, right: DataGridFormulaValue): number => compareFormulaValues(left, right)
  const equals = (left: DataGridFormulaValue, right: DataGridFormulaValue): boolean => areFormulaValuesEqual(left, right)
  const round = (value: number, digits: number): number => {
    const safeDigits = Math.max(0, Math.trunc(digits))
    const factor = 10 ** safeDigits
    return Math.round(value * factor) / factor
  }

  return {
    toNumber,
    toBoolean,
    isPresent,
    compare,
    equals,
    callFunction,
    divide,
    round,
  }
}

export function canInlineBuiltinFunction(
  functionName: string,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
): boolean {
  if (NON_INLINEABLE_BUILTIN_FUNCTIONS.has(functionName)) {
    return false
  }
  const defaultDefinition = DATAGRID_DEFAULT_FORMULA_FUNCTIONS[functionName]
  const runtimeDefinition = functionRegistry.get(functionName)
  if (!defaultDefinition || !runtimeDefinition) {
    return false
  }
  return runtimeDefinition.compute === defaultDefinition.compute
}
