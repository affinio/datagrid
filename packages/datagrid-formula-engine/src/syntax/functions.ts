// Built-in formula functions and registry normalization. Formula semantics stay
// here so compile/evaluator backends do not duplicate built-in behavior.
import type {
  DataGridFormulaScalarValue,
  DataGridFormulaValue,
} from "../coreTypes.js"
import type {
  DataGridFormulaAstNode,
  DataGridFormulaCompileOptions,
  DataGridFormulaFunctionArity,
  DataGridFormulaFunctionDefinition,
  DataGridFormulaFunctionRegistry,
  DataGridFormulaFunctionRuntime as LegacyDataGridFormulaFunctionRuntime,
} from "./analysis.js"
import {
  areFormulaValuesEqual,
  coerceFormulaValueToBoolean,
  coerceFormulaValueToNumber,
  isFormulaValuePresent,
} from "./values.js"
import { throwFormulaError } from "./ast.js"

export type {
  DataGridFormulaFunctionArity,
  DataGridFormulaFunctionDefinition,
  DataGridFormulaFunctionRegistry,
  DataGridFormulaFunctionRuntime,
} from "./analysis.js"

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

export function normalizeFormulaFunctionRegistry(
  input: DataGridFormulaFunctionRegistry | undefined,
  options: Pick<DataGridFormulaCompileOptions, "onFunctionOverride"> = {},
): ReadonlyMap<string, LegacyDataGridFormulaFunctionRuntime> {
  const normalized = new Map<string, LegacyDataGridFormulaFunctionRuntime>()

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
      ? { compute: definition }
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

export function collectFormulaContextKeys(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, LegacyDataGridFormulaFunctionRuntime>,
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

function coerceFormulaValueToDate(value: DataGridFormulaValue): Date | null {
  const scalarValue = Array.isArray(value) ? (value[0] ?? null) : value
  if (scalarValue === null) {
    return null
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
          return Number.isNaN(value.getTime()) ? "" : value.toISOString()
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
        return Number.isNaN(value.getTime()) ? 0 : value.toISOString().length
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
      return value === null ? "" : String(value).toLowerCase()
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
      return value === null ? "" : String(value).trim()
    },
  },
  UPPER: {
    arity: 1,
    compute: args => {
      const value = args[0] ?? null
      return value === null ? "" : String(value).toUpperCase()
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
