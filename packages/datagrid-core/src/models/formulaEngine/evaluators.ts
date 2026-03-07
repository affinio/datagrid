import type {
  DataGridComputedDependencyToken,
  DataGridFormulaValue,
} from "../rowModel.js"
import {
  DATAGRID_DEFAULT_FORMULA_FUNCTIONS,
  DataGridFormulaEvaluationError,
  areFormulaValuesEqual,
  coerceFormulaValueToBoolean,
  coerceFormulaValueToNumber,
  compareFormulaValues,
  createFormulaSourceSpan,
  createFormulaRuntimeError,
  findFormulaErrorValue,
  formulaNumberIsTruthy,
  isFormulaErrorValue,
  isFormulaValuePresent,
  normalizeFormulaFunctionName,
  normalizeFormulaValue,
  type DataGridFormulaAstNode,
  type DataGridFormulaBatchEvaluator,
  type DataGridFormulaColumnarBatchEvaluator,
  type DataGridFormulaEvaluator,
  type DataGridFormulaEvaluatorForToken,
  type DataGridFormulaFunctionRuntime,
  type DataGridFormulaTokenIndexEvaluator,
} from "./core.js"

const ZERO_FORMULA_NODE: DataGridFormulaAstNode = {
  kind: "number",
  value: 0,
  span: createFormulaSourceSpan(0, 0),
}

const NON_INLINEABLE_BUILTIN_FUNCTIONS = new Set<string>([
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
  "XLOOKUP",
])

type DataGridFormulaFusedColumnKernel = (
  contextsCount: number,
  tokenColumns: readonly (readonly unknown[])[],
) => DataGridFormulaValue[]

function compileFormulaAstFusedColumnKernel(
  root: DataGridFormulaAstNode,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
): DataGridFormulaFusedColumnKernel | null {
  if (root.kind === "number") {
    return (contextsCount) => {
      const output = new Array<DataGridFormulaValue>(contextsCount)
      for (let contextIndex = 0; contextIndex < contextsCount; contextIndex += 1) {
        output[contextIndex] = root.value
      }
      return output
    }
  }
  if (root.kind === "literal") {
    return (contextsCount) => {
      const output = new Array<DataGridFormulaValue>(contextsCount)
      for (let contextIndex = 0; contextIndex < contextsCount; contextIndex += 1) {
        output[contextIndex] = root.value
      }
      return output
    }
  }
  if (root.kind === "identifier") {
    const tokenIndex = resolveIdentifierTokenIndex(root.name)
    if (typeof tokenIndex !== "number") {
      return (contextsCount) => {
        const output = new Array<DataGridFormulaValue>(contextsCount)
        for (let contextIndex = 0; contextIndex < contextsCount; contextIndex += 1) {
          output[contextIndex] = null
        }
        return output
      }
    }
    return (contextsCount, tokenColumns) => {
      const output = new Array<DataGridFormulaValue>(contextsCount)
      const column = tokenColumns[tokenIndex]
      for (let contextIndex = 0; contextIndex < contextsCount; contextIndex += 1) {
        output[contextIndex] = normalizeFormulaValue(column ? column[contextIndex] : undefined)
      }
      return output
    }
  }
  if (root.kind === "call") {
    return null
  }
  if (root.kind === "unary") {
    const valueKernel = compileFormulaAstFusedColumnKernel(root.value, resolveIdentifierTokenIndex)
    if (!valueKernel) {
      return null
    }
    return (contextsCount, tokenColumns) => {
      const values = valueKernel(contextsCount, tokenColumns)
      const output = new Array<DataGridFormulaValue>(contextsCount)
      for (let contextIndex = 0; contextIndex < contextsCount; contextIndex += 1) {
        const value = values[contextIndex] ?? null
        if (isFormulaErrorValue(value)) {
          output[contextIndex] = value
          continue
        }
        if (root.operator === "-") {
          output[contextIndex] = -coerceFormulaValueToNumber(value)
          continue
        }
        if (root.operator === "+") {
          output[contextIndex] = coerceFormulaValueToNumber(value)
          continue
        }
        output[contextIndex] = formulaNumberIsTruthy(value) ? 0 : 1
      }
      return output
    }
  }

  if (root.operator === "AND" || root.operator === "OR") {
    return null
  }

  const leftKernel = compileFormulaAstFusedColumnKernel(root.left, resolveIdentifierTokenIndex)
  const rightKernel = compileFormulaAstFusedColumnKernel(root.right, resolveIdentifierTokenIndex)
  if (!leftKernel || !rightKernel) {
    return null
  }

  return (contextsCount, tokenColumns) => {
    const leftValues = leftKernel(contextsCount, tokenColumns)
    const rightValues = rightKernel(contextsCount, tokenColumns)
    const output = new Array<DataGridFormulaValue>(contextsCount)
    for (let contextIndex = 0; contextIndex < contextsCount; contextIndex += 1) {
      const left = leftValues[contextIndex] ?? null
      const right = rightValues[contextIndex] ?? null
      const formulaError = findFormulaErrorValue([left, right])
      if (formulaError) {
        output[contextIndex] = formulaError
        continue
      }
      if (root.operator === "+") {
        output[contextIndex] = coerceFormulaValueToNumber(left) + coerceFormulaValueToNumber(right)
        continue
      }
      if (root.operator === "-") {
        output[contextIndex] = coerceFormulaValueToNumber(left) - coerceFormulaValueToNumber(right)
        continue
      }
      if (root.operator === "*") {
        output[contextIndex] = coerceFormulaValueToNumber(left) * coerceFormulaValueToNumber(right)
        continue
      }
      if (root.operator === "/") {
        const divisor = coerceFormulaValueToNumber(right)
        if (divisor === 0) {
          throw new DataGridFormulaEvaluationError(
            createFormulaRuntimeError(
              "DIV_ZERO",
              "Division by zero.",
              { operator: "/" },
            ),
          )
        }
        output[contextIndex] = coerceFormulaValueToNumber(left) / divisor
        continue
      }
      if (root.operator === ">") {
        output[contextIndex] = compareFormulaValues(left, right) > 0 ? 1 : 0
        continue
      }
      if (root.operator === "<") {
        output[contextIndex] = compareFormulaValues(left, right) < 0 ? 1 : 0
        continue
      }
      if (root.operator === ">=") {
        output[contextIndex] = compareFormulaValues(left, right) >= 0 ? 1 : 0
        continue
      }
      if (root.operator === "<=") {
        output[contextIndex] = compareFormulaValues(left, right) <= 0 ? 1 : 0
        continue
      }
      if (root.operator === "==") {
        output[contextIndex] = areFormulaValuesEqual(left, right) ? 1 : 0
        continue
      }
      output[contextIndex] = areFormulaValuesEqual(left, right) ? 0 : 1
    }
    return output
  }
}

export function compileFormulaAstColumnarBatchEvaluatorFused(
  root: DataGridFormulaAstNode,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
): DataGridFormulaColumnarBatchEvaluator | null {
  const fusedKernel = compileFormulaAstFusedColumnKernel(root, resolveIdentifierTokenIndex)
  if (!fusedKernel) {
    return null
  }
  return (contextsCount, tokenColumns) => fusedKernel(contextsCount, tokenColumns)
}

function compileFormulaAstEvaluatorForToken<TKey>(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
  resolveIdentifierToken: (identifier: string) => TKey | undefined,
): DataGridFormulaEvaluatorForToken<TKey> {
  if (root.kind === "number") {
    return () => root.value
  }
  if (root.kind === "literal") {
    return () => root.value
  }
  if (root.kind === "identifier") {
    const token = resolveIdentifierToken(root.name)
    if (typeof token === "undefined") {
      return () => 0
    }
    return readTokenValue => normalizeFormulaValue(readTokenValue(token))
  }
  if (root.kind === "call") {
    const normalizedFunctionName = normalizeFormulaFunctionName(root.name)
    const functionDefinition = functionRegistry.get(normalizedFunctionName)
    if (!functionDefinition) {
      throw new DataGridFormulaEvaluationError(
        createFormulaRuntimeError(
          "FUNCTION_UNKNOWN",
          `Unknown function '${root.name}'.`,
          { functionName: normalizedFunctionName },
        ),
      )
    }

    if (normalizedFunctionName === "IF") {
      const conditionEvaluator = compileFormulaAstEvaluatorForToken(
        root.args[0] ?? ZERO_FORMULA_NODE,
        functionRegistry,
        resolveIdentifierToken,
      )
      const trueEvaluator = compileFormulaAstEvaluatorForToken(
        root.args[1] ?? ZERO_FORMULA_NODE,
        functionRegistry,
        resolveIdentifierToken,
      )
      const falseEvaluator = compileFormulaAstEvaluatorForToken(
        root.args[2] ?? ZERO_FORMULA_NODE,
        functionRegistry,
        resolveIdentifierToken,
      )
      return (readTokenValue) => (
        (() => {
          const conditionValue = conditionEvaluator(readTokenValue)
          if (isFormulaErrorValue(conditionValue)) {
            return conditionValue
          }
          return formulaNumberIsTruthy(conditionValue)
            ? trueEvaluator(readTokenValue)
            : falseEvaluator(readTokenValue)
        })()
      )
    }

    if (normalizedFunctionName === "IFS") {
      const pairEvaluators = root.args.map(arg => compileFormulaAstEvaluatorForToken(
        arg,
        functionRegistry,
        resolveIdentifierToken,
      ))
      return (readTokenValue) => {
        for (let index = 0; index < pairEvaluators.length; index += 2) {
          const conditionEvaluator = pairEvaluators[index]
          const valueEvaluator = pairEvaluators[index + 1]
          const conditionValue = conditionEvaluator ? conditionEvaluator(readTokenValue) : 0
          if (isFormulaErrorValue(conditionValue)) {
            return conditionValue
          }
          if (!formulaNumberIsTruthy(conditionValue)) {
            continue
          }
          return valueEvaluator ? valueEvaluator(readTokenValue) : 0
        }
        return 0
      }
    }

    if (normalizedFunctionName === "COALESCE") {
      const argEvaluators = root.args.map(arg => compileFormulaAstEvaluatorForToken(
        arg,
        functionRegistry,
        resolveIdentifierToken,
      ))
      return (readTokenValue) => {
        for (const evaluator of argEvaluators) {
          const value = evaluator(readTokenValue)
          if (isFormulaValuePresent(value)) {
            return value
          }
        }
        return 0
      }
    }

    const argEvaluators = root.args.map(arg => compileFormulaAstEvaluatorForToken(
      arg,
      functionRegistry,
      resolveIdentifierToken,
    ))
    return (readTokenValue) => {
      const args = new Array<DataGridFormulaValue>(argEvaluators.length)
      for (let index = 0; index < argEvaluators.length; index += 1) {
        const evaluator = argEvaluators[index]
        args[index] = evaluator ? evaluator(readTokenValue) : null
      }
      const formulaError = findFormulaErrorValue(args)
      if (formulaError) {
        return formulaError
      }
      try {
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
  }
  if (root.kind === "unary") {
    const valueEvaluator = compileFormulaAstEvaluatorForToken(root.value, functionRegistry, resolveIdentifierToken)
    return readTokenValue => {
      const value = valueEvaluator(readTokenValue)
      if (isFormulaErrorValue(value)) {
        return value
      }
      if (root.operator === "-") {
        return -coerceFormulaValueToNumber(value)
      }
      if (root.operator === "+") {
        return coerceFormulaValueToNumber(value)
      }
      return formulaNumberIsTruthy(value) ? 0 : 1
    }
  }

  const leftEvaluator = compileFormulaAstEvaluatorForToken(root.left, functionRegistry, resolveIdentifierToken)
  const rightEvaluator = compileFormulaAstEvaluatorForToken(root.right, functionRegistry, resolveIdentifierToken)
  if (root.operator === "AND") {
    return (readTokenValue) => {
      const left = leftEvaluator(readTokenValue)
      if (isFormulaErrorValue(left)) {
        return left
      }
      if (!formulaNumberIsTruthy(left)) {
        return 0
      }
      const right = rightEvaluator(readTokenValue)
      if (isFormulaErrorValue(right)) {
        return right
      }
      return formulaNumberIsTruthy(right) ? 1 : 0
    }
  }
  if (root.operator === "OR") {
    return (readTokenValue) => {
      const left = leftEvaluator(readTokenValue)
      if (isFormulaErrorValue(left)) {
        return left
      }
      if (formulaNumberIsTruthy(left)) {
        return 1
      }
      const right = rightEvaluator(readTokenValue)
      if (isFormulaErrorValue(right)) {
        return right
      }
      return formulaNumberIsTruthy(right) ? 1 : 0
    }
  }
  if (root.operator === "+") {
    return readTokenValue => (
      coerceFormulaValueToNumber(leftEvaluator(readTokenValue))
      + coerceFormulaValueToNumber(rightEvaluator(readTokenValue))
    )
  }
  if (root.operator === "-") {
    return readTokenValue => (
      coerceFormulaValueToNumber(leftEvaluator(readTokenValue))
      - coerceFormulaValueToNumber(rightEvaluator(readTokenValue))
    )
  }
  if (root.operator === "*") {
    return readTokenValue => (
      coerceFormulaValueToNumber(leftEvaluator(readTokenValue))
      * coerceFormulaValueToNumber(rightEvaluator(readTokenValue))
    )
  }
  if (root.operator === "/") {
    return (readTokenValue) => {
      const right = coerceFormulaValueToNumber(rightEvaluator(readTokenValue))
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
      const left = coerceFormulaValueToNumber(leftEvaluator(readTokenValue))
      return left / right
    }
  }
  if (root.operator === ">") {
    return readTokenValue => (
      compareFormulaValues(leftEvaluator(readTokenValue), rightEvaluator(readTokenValue)) > 0 ? 1 : 0
    )
  }
  if (root.operator === "<") {
    return readTokenValue => (
      compareFormulaValues(leftEvaluator(readTokenValue), rightEvaluator(readTokenValue)) < 0 ? 1 : 0
    )
  }
  if (root.operator === ">=") {
    return readTokenValue => (
      compareFormulaValues(leftEvaluator(readTokenValue), rightEvaluator(readTokenValue)) >= 0 ? 1 : 0
    )
  }
  if (root.operator === "<=") {
    return readTokenValue => (
      compareFormulaValues(leftEvaluator(readTokenValue), rightEvaluator(readTokenValue)) <= 0 ? 1 : 0
    )
  }
  if (root.operator === "==") {
    return readTokenValue => (
      areFormulaValuesEqual(leftEvaluator(readTokenValue), rightEvaluator(readTokenValue)) ? 1 : 0
    )
  }
  return readTokenValue => (
    areFormulaValuesEqual(leftEvaluator(readTokenValue), rightEvaluator(readTokenValue)) ? 0 : 1
  )
}

export function compileFormulaAstEvaluator(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
  resolveIdentifierToken: (identifier: string) => DataGridComputedDependencyToken | undefined,
): DataGridFormulaEvaluator {
  return compileFormulaAstEvaluatorForToken(
    root,
    functionRegistry,
    resolveIdentifierToken,
  )
}

export function compileFormulaAstTokenIndexEvaluator(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
): DataGridFormulaTokenIndexEvaluator {
  return compileFormulaAstEvaluatorForToken(
    root,
    functionRegistry,
    resolveIdentifierTokenIndex,
  )
}

function compileFormulaAstToJitExpression(
  root: DataGridFormulaAstNode,
  options: {
    resolveIdentifierTokenIndex: (identifier: string) => number | undefined
    canInlineBuiltin: (functionName: string) => boolean
  },
): string {
  if (root.kind === "number") {
    return Number.isFinite(root.value) ? String(root.value) : "0"
  }
  if (root.kind === "literal") {
    if (root.value === null) {
      return "null"
    }
    if (root.value instanceof Date) {
      return `new Date(${root.value.getTime()})`
    }
    if (typeof root.value === "string") {
      return JSON.stringify(root.value)
    }
    if (typeof root.value === "boolean") {
      return root.value ? "true" : "false"
    }
    return Number.isFinite(root.value) ? String(root.value) : "0"
  }
  if (root.kind === "identifier") {
    const tokenIndex = options.resolveIdentifierTokenIndex(root.name)
    if (typeof tokenIndex !== "number") {
      return "null"
    }
    return `readValue(${tokenIndex})`
  }
  if (root.kind === "call") {
    const normalizedFunctionName = normalizeFormulaFunctionName(root.name)
    if (normalizedFunctionName === "IF") {
      const condition = compileFormulaAstToJitExpression(
        root.args[0] ?? ZERO_FORMULA_NODE,
        options,
      )
      const whenTrue = compileFormulaAstToJitExpression(
        root.args[1] ?? ZERO_FORMULA_NODE,
        options,
      )
      const whenFalse = compileFormulaAstToJitExpression(
        root.args[2] ?? ZERO_FORMULA_NODE,
        options,
      )
      return `(toBoolean(${condition}) ? (${whenTrue}) : (${whenFalse}))`
    }
    if (normalizedFunctionName === "IFS") {
      const conditions: string[] = []
      for (let index = 0; index < root.args.length; index += 2) {
        const conditionExpression = compileFormulaAstToJitExpression(
          root.args[index] ?? ZERO_FORMULA_NODE,
          options,
        )
        const valueExpression = compileFormulaAstToJitExpression(
          root.args[index + 1] ?? ZERO_FORMULA_NODE,
          options,
        )
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
        const valueExpression = compileFormulaAstToJitExpression(
          root.args[0] ?? ZERO_FORMULA_NODE,
          options,
        )
        return `Math.abs(toNumber(${valueExpression}))`
      }
      if (normalizedFunctionName === "ROUND") {
        const valueExpression = compileFormulaAstToJitExpression(
          root.args[0] ?? ZERO_FORMULA_NODE,
          options,
        )
        const digitsExpression = compileFormulaAstToJitExpression(
          root.args[1] ?? ZERO_FORMULA_NODE,
          options,
        )
        return `round(toNumber(${valueExpression}), toNumber(${digitsExpression}))`
      }
      if (normalizedFunctionName === "MIN") {
        if (root.args.length === 0) {
          return "0"
        }
        const minArgs = root.args
          .map(arg => `toNumber(${compileFormulaAstToJitExpression(arg, options)})`)
          .join(", ")
        return `Math.min(${minArgs})`
      }
      if (normalizedFunctionName === "MAX") {
        if (root.args.length === 0) {
          return "0"
        }
        const maxArgs = root.args
          .map(arg => `toNumber(${compileFormulaAstToJitExpression(arg, options)})`)
          .join(", ")
        return `Math.max(${maxArgs})`
      }
      if (normalizedFunctionName === "SUM") {
        if (root.args.length === 0) {
          return "0"
        }
        return `(${root.args
          .map(arg => `toNumber(${compileFormulaAstToJitExpression(arg, options)})`)
          .join(" + ")})`
      }
    }

    const args = root.args
      .map(arg => compileFormulaAstToJitExpression(arg, options))
      .join(", ")
    return `callFunction(${JSON.stringify(normalizedFunctionName)}, [${args}])`
  }
  if (root.kind === "unary") {
    const valueExpression = compileFormulaAstToJitExpression(root.value, options)
    if (root.operator === "-") {
      return `(-toNumber(${valueExpression}))`
    }
    if (root.operator === "+") {
      return `(+toNumber(${valueExpression}))`
    }
    return `(toBoolean(${valueExpression}) ? 0 : 1)`
  }

  const leftExpression = compileFormulaAstToJitExpression(root.left, options)
  const rightExpression = compileFormulaAstToJitExpression(root.right, options)
  if (root.operator === "AND") {
    return `((toBoolean(${leftExpression}) && toBoolean(${rightExpression})) ? 1 : 0)`
  }
  if (root.operator === "OR") {
    return `((toBoolean(${leftExpression}) || toBoolean(${rightExpression})) ? 1 : 0)`
  }
  if (root.operator === "+") {
    return `(toNumber(${leftExpression}) + toNumber(${rightExpression}))`
  }
  if (root.operator === "-") {
    return `(toNumber(${leftExpression}) - toNumber(${rightExpression}))`
  }
  if (root.operator === "*") {
    return `(toNumber(${leftExpression}) * toNumber(${rightExpression}))`
  }
  if (root.operator === "/") {
    return `divide(toNumber(${leftExpression}), toNumber(${rightExpression}))`
  }
  if (root.operator === ">") {
    return `(compare(${leftExpression}, ${rightExpression}) > 0 ? 1 : 0)`
  }
  if (root.operator === "<") {
    return `(compare(${leftExpression}, ${rightExpression}) < 0 ? 1 : 0)`
  }
  if (root.operator === ">=") {
    return `(compare(${leftExpression}, ${rightExpression}) >= 0 ? 1 : 0)`
  }
  if (root.operator === "<=") {
    return `(compare(${leftExpression}, ${rightExpression}) <= 0 ? 1 : 0)`
  }
  if (root.operator === "==") {
    return `(equals(${leftExpression}, ${rightExpression}) ? 1 : 0)`
  }
  return `(equals(${leftExpression}, ${rightExpression}) ? 0 : 1)`
}

interface DataGridFormulaJitRuntimeHelpers {
  toNumber: (value: DataGridFormulaValue) => number
  toBoolean: (value: DataGridFormulaValue) => boolean
  isPresent: (value: DataGridFormulaValue) => boolean
  compare: (left: DataGridFormulaValue, right: DataGridFormulaValue) => number
  equals: (left: DataGridFormulaValue, right: DataGridFormulaValue) => boolean
  callFunction: (functionName: string, args: readonly DataGridFormulaValue[]) => DataGridFormulaValue
  divide: (left: number, right: number) => number
  round: (value: number, digits: number) => number
}

type DataGridFormulaJitReadValueMode = "single" | "batch" | "columnar"

function buildJitReadValueBody(mode: DataGridFormulaJitReadValueMode): string {
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

function createFormulaJitRuntimeHelpers(
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
  const compare = (left: DataGridFormulaValue, right: DataGridFormulaValue): number =>
    compareFormulaValues(left, right)
  const equals = (left: DataGridFormulaValue, right: DataGridFormulaValue): boolean =>
    areFormulaValuesEqual(left, right)
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

export function compileFormulaAstEvaluatorJit(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
  dependencyTokens: readonly DataGridComputedDependencyToken[],
): DataGridFormulaEvaluator {
  const canInlineBuiltin = (functionName: string): boolean => {
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

  const expression = compileFormulaAstToJitExpression(root, {
    resolveIdentifierTokenIndex,
    canInlineBuiltin,
  })
  const {
    toNumber,
    toBoolean,
    isPresent,
    compare,
    equals,
    callFunction,
    divide,
    round,
  } = createFormulaJitRuntimeHelpers(functionRegistry)

  const createEvaluator = new Function(
    "toNumber",
    "toBoolean",
    "isPresent",
    "compare",
    "equals",
    "callFunction",
    "divide",
    "round",
    "dependencyTokens",
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

  return createEvaluator(
    toNumber,
    toBoolean,
    isPresent,
    compare,
    equals,
    callFunction,
    divide,
    round,
    dependencyTokens,
  )
}

export function compileFormulaAstBatchEvaluatorJit(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
): DataGridFormulaBatchEvaluator {
  const canInlineBuiltin = (functionName: string): boolean => {
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

  const expression = compileFormulaAstToJitExpression(root, {
    resolveIdentifierTokenIndex,
    canInlineBuiltin,
  })
  const {
    toNumber,
    toBoolean,
    isPresent,
    compare,
    equals,
    callFunction,
    divide,
    round,
  } = createFormulaJitRuntimeHelpers(functionRegistry)

  const createEvaluator = new Function(
    "toNumber",
    "toBoolean",
    "isPresent",
    "compare",
    "equals",
    "callFunction",
    "divide",
    "round",
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

  return createEvaluator(
    toNumber,
    toBoolean,
    isPresent,
    compare,
    equals,
    callFunction,
    divide,
    round,
  )
}

export function compileFormulaAstColumnarBatchEvaluatorJit(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
): DataGridFormulaColumnarBatchEvaluator {
  const canInlineBuiltin = (functionName: string): boolean => {
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

  const expression = compileFormulaAstToJitExpression(root, {
    resolveIdentifierTokenIndex,
    canInlineBuiltin,
  })
  const {
    toNumber,
    toBoolean,
    isPresent,
    compare,
    equals,
    callFunction,
    divide,
    round,
  } = createFormulaJitRuntimeHelpers(functionRegistry)

  const createEvaluator = new Function(
    "toNumber",
    "toBoolean",
    "isPresent",
    "compare",
    "equals",
    "callFunction",
    "divide",
    "round",
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

  return createEvaluator(
    toNumber,
    toBoolean,
    isPresent,
    compare,
    equals,
    callFunction,
    divide,
    round,
  )
}
