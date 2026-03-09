// JIT backend: lowers formula AST into generated JavaScript for row and batch
// execution when a formula shape can be profitably compiled.
import type { DataGridComputedDependencyToken } from "../coreTypes.js"
import type {
  DataGridFormulaBatchEvaluator,
  DataGridFormulaColumnarBatchEvaluator,
  DataGridFormulaEvaluator,
  DataGridFormulaFunctionRuntime,
} from "../runtime/types.js"
import { type DataGridFormulaAstNode } from "../syntax/ast.js"
import { normalizeFormulaFunctionName } from "../syntax/functions.js"
import {
  areFormulaValuesEqual,
  compareFormulaValues,
  coerceFormulaValueToBoolean,
  coerceFormulaValueToNumber,
  formulaNumberIsTruthy,
  isFormulaValuePresent,
} from "../syntax/values.js"
import {
  buildJitReadValueBody,
  canInlineBuiltinFunction,
  createFormulaJitRuntimeHelpers,
  ZERO_FORMULA_NODE,
} from "./shared.js"

function compileFormulaAstToJitExpression(
  root: DataGridFormulaAstNode,
  options: {
    resolveIdentifierTokenIndex: (identifier: string) => number | undefined
    canInlineBuiltin: (functionName: string) => boolean
  },
): string {
  if (root.kind === "number") return Number.isFinite(root.value) ? String(root.value) : "0"
  if (root.kind === "literal") {
    if (root.value === null) return "null"
    if (root.value instanceof Date) return `new Date(${root.value.getTime()})`
    if (typeof root.value === "string") return JSON.stringify(root.value)
    if (typeof root.value === "boolean") return root.value ? "true" : "false"
    return Number.isFinite(root.value) ? String(root.value) : "0"
  }
  if (root.kind === "identifier") {
    const tokenIndex = options.resolveIdentifierTokenIndex(root.name)
    if (typeof tokenIndex !== "number") return "null"
    return `readValue(${tokenIndex})`
  }
  if (root.kind === "call") {
    const normalizedFunctionName = normalizeFormulaFunctionName(root.name)
    if (normalizedFunctionName === "IF") {
      const condition = compileFormulaAstToJitExpression(root.args[0] ?? ZERO_FORMULA_NODE, options)
      const whenTrue = compileFormulaAstToJitExpression(root.args[1] ?? ZERO_FORMULA_NODE, options)
      const whenFalse = compileFormulaAstToJitExpression(root.args[2] ?? ZERO_FORMULA_NODE, options)
      return `(toBoolean(${condition}) ? (${whenTrue}) : (${whenFalse}))`
    }
    if (normalizedFunctionName === "IFS") {
      const conditions: string[] = []
      for (let index = 0; index < root.args.length; index += 2) {
        const conditionExpression = compileFormulaAstToJitExpression(root.args[index] ?? ZERO_FORMULA_NODE, options)
        const valueExpression = compileFormulaAstToJitExpression(root.args[index + 1] ?? ZERO_FORMULA_NODE, options)
        conditions.push(`if (toBoolean(${conditionExpression})) { return (${valueExpression}) }`)
      }
      return `(() => { ${conditions.join("; ")}; return 0 })()`
    }
    if (normalizedFunctionName === "COALESCE") {
      const checks = root.args.map((arg, index) => {
        const expression = compileFormulaAstToJitExpression(arg, options)
        const variableName = `coalesceValue${index}`
        return `const ${variableName} = (${expression}); if (isPresent(${variableName})) { return ${variableName} }`
      })
      return `(() => { ${checks.join("; ")}; return 0 })()`
    }
    if (options.canInlineBuiltin(normalizedFunctionName)) {
      if (normalizedFunctionName === "ABS") {
        const valueExpression = compileFormulaAstToJitExpression(root.args[0] ?? ZERO_FORMULA_NODE, options)
        return `Math.abs(toNumber(${valueExpression}))`
      }
      if (normalizedFunctionName === "ROUND") {
        const valueExpression = compileFormulaAstToJitExpression(root.args[0] ?? ZERO_FORMULA_NODE, options)
        const digitsExpression = compileFormulaAstToJitExpression(root.args[1] ?? ZERO_FORMULA_NODE, options)
        return `round(toNumber(${valueExpression}), toNumber(${digitsExpression}))`
      }
      if (normalizedFunctionName === "MIN") {
        if (root.args.length === 0) return "0"
        const minArgs = root.args.map(arg => `toNumber(${compileFormulaAstToJitExpression(arg, options)})`).join(", ")
        return `Math.min(${minArgs})`
      }
      if (normalizedFunctionName === "MAX") {
        if (root.args.length === 0) return "0"
        const maxArgs = root.args.map(arg => `toNumber(${compileFormulaAstToJitExpression(arg, options)})`).join(", ")
        return `Math.max(${maxArgs})`
      }
      if (normalizedFunctionName === "SUM") {
        if (root.args.length === 0) return "0"
        return `(${root.args.map(arg => `toNumber(${compileFormulaAstToJitExpression(arg, options)})`).join(" + ")})`
      }
    }
    const args = root.args.map(arg => compileFormulaAstToJitExpression(arg, options)).join(", ")
    return `callFunction(${JSON.stringify(normalizedFunctionName)}, [${args}])`
  }
  if (root.kind === "unary") {
    const valueExpression = compileFormulaAstToJitExpression(root.value, options)
    if (root.operator === "-") return `(-toNumber(${valueExpression}))`
    if (root.operator === "+") return `(+toNumber(${valueExpression}))`
    return `(toBoolean(${valueExpression}) ? 0 : 1)`
  }
  const leftExpression = compileFormulaAstToJitExpression(root.left, options)
  const rightExpression = compileFormulaAstToJitExpression(root.right, options)
  if (root.operator === "AND") return `((toBoolean(${leftExpression}) && toBoolean(${rightExpression})) ? 1 : 0)`
  if (root.operator === "OR") return `((toBoolean(${leftExpression}) || toBoolean(${rightExpression})) ? 1 : 0)`
  if (root.operator === "+") return `(toNumber(${leftExpression}) + toNumber(${rightExpression}))`
  if (root.operator === "-") return `(toNumber(${leftExpression}) - toNumber(${rightExpression}))`
  if (root.operator === "*") return `(toNumber(${leftExpression}) * toNumber(${rightExpression}))`
  if (root.operator === "/") return `divide(toNumber(${leftExpression}), toNumber(${rightExpression}))`
  if (root.operator === ">") return `(compare(${leftExpression}, ${rightExpression}) > 0 ? 1 : 0)`
  if (root.operator === "<") return `(compare(${leftExpression}, ${rightExpression}) < 0 ? 1 : 0)`
  if (root.operator === ">=") return `(compare(${leftExpression}, ${rightExpression}) >= 0 ? 1 : 0)`
  if (root.operator === "<=") return `(compare(${leftExpression}, ${rightExpression}) <= 0 ? 1 : 0)`
  if (root.operator === "==") return `(equals(${leftExpression}, ${rightExpression}) ? 1 : 0)`
  return `(equals(${leftExpression}, ${rightExpression}) ? 0 : 1)`
}

export function compileFormulaAstEvaluatorJit(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
  dependencyTokens: readonly DataGridComputedDependencyToken[],
): DataGridFormulaEvaluator {
  const expression = compileFormulaAstToJitExpression(root, {
    resolveIdentifierTokenIndex,
    canInlineBuiltin: functionName => canInlineBuiltinFunction(functionName, functionRegistry),
  })
  const { toNumber, toBoolean, isPresent, compare, equals, callFunction, divide, round } = createFormulaJitRuntimeHelpers(functionRegistry)
  const createEvaluator = new Function(
    "toNumber", "toBoolean", "isPresent", "compare", "equals", "callFunction", "divide", "round", "dependencyTokens",
    `return function evaluate(readTokenValue) {
      ${buildJitReadValueBody("single")}
      return (${expression})
    }`,
  ) as (
    toNumberFn: typeof toNumber,
    toBooleanFn: typeof toBoolean,
    isPresentFn: typeof isPresent,
    compareFn: typeof compare,
    equalsFn: typeof equals,
    callFunctionFn: typeof callFunction,
    divideFn: typeof divide,
    roundFn: typeof round,
    dependencyTokensValue: readonly DataGridComputedDependencyToken[],
  ) => DataGridFormulaEvaluator
  return createEvaluator(toNumber, toBoolean, isPresent, compare, equals, callFunction, divide, round, dependencyTokens)
}

export function compileFormulaAstBatchEvaluatorJit(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
): DataGridFormulaBatchEvaluator {
  const expression = compileFormulaAstToJitExpression(root, {
    resolveIdentifierTokenIndex,
    canInlineBuiltin: functionName => canInlineBuiltinFunction(functionName, functionRegistry),
  })
  const { toNumber, toBoolean, isPresent, compare, equals, callFunction, divide, round } = createFormulaJitRuntimeHelpers(functionRegistry)
  const createEvaluator = new Function(
    "toNumber", "toBoolean", "isPresent", "compare", "equals", "callFunction", "divide", "round",
    `return function evaluateBatch(contextsCount, readTokenByIndex) {
      const output = new Array(contextsCount)
      for (let contextIndex = 0; contextIndex < contextsCount; contextIndex += 1) {
        ${buildJitReadValueBody("batch")}
        output[contextIndex] = (${expression})
      }
      return output
    }`,
  ) as (
    toNumberFn: typeof toNumber,
    toBooleanFn: typeof toBoolean,
    isPresentFn: typeof isPresent,
    compareFn: typeof compare,
    equalsFn: typeof equals,
    callFunctionFn: typeof callFunction,
    divideFn: typeof divide,
    roundFn: typeof round,
  ) => DataGridFormulaBatchEvaluator
  return createEvaluator(toNumber, toBoolean, isPresent, compare, equals, callFunction, divide, round)
}

export function compileFormulaAstColumnarBatchEvaluatorJit(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
): DataGridFormulaColumnarBatchEvaluator {
  const expression = compileFormulaAstToJitExpression(root, {
    resolveIdentifierTokenIndex,
    canInlineBuiltin: functionName => canInlineBuiltinFunction(functionName, functionRegistry),
  })
  const { toNumber, toBoolean, isPresent, compare, equals, callFunction, divide, round } = createFormulaJitRuntimeHelpers(functionRegistry)
  const createEvaluator = new Function(
    "toNumber", "toBoolean", "isPresent", "compare", "equals", "callFunction", "divide", "round",
    `return function evaluateColumnarBatch(contextsCount, tokenColumns) {
      const output = new Array(contextsCount)
      for (let contextIndex = 0; contextIndex < contextsCount; contextIndex += 1) {
        ${buildJitReadValueBody("columnar")}
        output[contextIndex] = (${expression})
      }
      return output
    }`,
  ) as (
    toNumberFn: typeof toNumber,
    toBooleanFn: typeof toBoolean,
    isPresentFn: typeof isPresent,
    compareFn: typeof compare,
    equalsFn: typeof equals,
    callFunctionFn: typeof callFunction,
    divideFn: typeof divide,
    roundFn: typeof round,
  ) => DataGridFormulaColumnarBatchEvaluator
  return createEvaluator(toNumber, toBoolean, isPresent, compare, equals, callFunction, divide, round)
}
