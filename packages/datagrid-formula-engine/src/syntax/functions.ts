// Built-in formula functions and registry normalization. Formula semantics stay
// here so compile/evaluator backends do not duplicate built-in behavior.
import type {
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
} from "./values.js"
import { throwFormulaError } from "./ast.js"
import { DATAGRID_ADVANCED_FORMULA_FUNCTIONS } from "./functionGroups/advancedFunctions.js"
import { DATAGRID_DATE_FORMULA_FUNCTIONS } from "./functionGroups/dateFunctions.js"
import { DATAGRID_LOGIC_FORMULA_FUNCTIONS } from "./functionGroups/logicFunctions.js"
import { DATAGRID_NUMERIC_FORMULA_FUNCTIONS } from "./functionGroups/numericFunctions.js"
import { DATAGRID_TEXT_FORMULA_FUNCTIONS } from "./functionGroups/textFunctions.js"

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

export const DATAGRID_DEFAULT_FORMULA_FUNCTIONS: Readonly<Record<string, DataGridFormulaFunctionDefinition>> = {
  ...DATAGRID_NUMERIC_FORMULA_FUNCTIONS,
  ...DATAGRID_LOGIC_FORMULA_FUNCTIONS,
  ...DATAGRID_TEXT_FORMULA_FUNCTIONS,
  ...DATAGRID_DATE_FORMULA_FUNCTIONS,
  ...DATAGRID_ADVANCED_FORMULA_FUNCTIONS,
}
