import type { DataGridComputedDependencyToken } from "../coreTypes.js"
import type {
  DataGridFormulaEvaluator,
  DataGridFormulaEvaluatorForToken,
  DataGridFormulaFunctionRuntime,
  DataGridFormulaTokenIndexEvaluator,
} from "../runtime/types.js"
import { type DataGridFormulaAstNode, DataGridFormulaEvaluationError } from "../syntax/ast.js"
import { normalizeFormulaFunctionName } from "../syntax/functions.js"
import {
  areFormulaValuesEqual,
  coerceFormulaValueToNumber,
  compareFormulaValues,
  createFormulaRuntimeError,
  findFormulaErrorValue,
  formulaNumberIsTruthy,
  isFormulaErrorValue,
  isFormulaValuePresent,
  normalizeFormulaValue,
} from "../syntax/values.js"
import { ZERO_FORMULA_NODE } from "./shared.js"

function compileFormulaAstEvaluatorForToken<TKey>(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
  resolveIdentifierToken: (identifier: string) => TKey | undefined,
  getFunctionContext?: () => import("../coreTypes.js").DataGridComputedFieldComputeContext<unknown> | undefined,
): DataGridFormulaEvaluatorForToken<TKey> {
  const compileChild = (node: DataGridFormulaAstNode): DataGridFormulaEvaluatorForToken<TKey> => {
    return compileFormulaAstEvaluatorForToken(node, functionRegistry, resolveIdentifierToken, getFunctionContext)
  }

  if (root.kind === "number") return () => root.value
  if (root.kind === "literal") return () => root.value
  if (root.kind === "identifier") {
    const token = resolveIdentifierToken(root.name)
    if (typeof token === "undefined") return () => 0
    return readTokenValue => normalizeFormulaValue(readTokenValue(token))
  }
  if (root.kind === "call") {
    const normalizedFunctionName = normalizeFormulaFunctionName(root.name)
    const functionDefinition = functionRegistry.get(normalizedFunctionName)
    if (!functionDefinition) {
      throw new DataGridFormulaEvaluationError(
        createFormulaRuntimeError("FUNCTION_UNKNOWN", `Unknown function '${root.name}'.`, { functionName: normalizedFunctionName }),
      )
    }
    if (normalizedFunctionName === "IF") {
      const conditionEvaluator = compileChild(root.args[0] ?? ZERO_FORMULA_NODE)
      const trueEvaluator = compileChild(root.args[1] ?? ZERO_FORMULA_NODE)
      const falseEvaluator = compileChild(root.args[2] ?? ZERO_FORMULA_NODE)
      return (readTokenValue) => {
        const conditionValue = conditionEvaluator(readTokenValue)
        if (isFormulaErrorValue(conditionValue)) return conditionValue
        return formulaNumberIsTruthy(conditionValue) ? trueEvaluator(readTokenValue) : falseEvaluator(readTokenValue)
      }
    }
    if (normalizedFunctionName === "IFS") {
      const pairEvaluators = root.args.map(arg => compileChild(arg))
      return (readTokenValue) => {
        for (let index = 0; index < pairEvaluators.length; index += 2) {
          const conditionEvaluator = pairEvaluators[index]
          const valueEvaluator = pairEvaluators[index + 1]
          const conditionValue = conditionEvaluator ? conditionEvaluator(readTokenValue) : 0
          if (isFormulaErrorValue(conditionValue)) return conditionValue
          if (!formulaNumberIsTruthy(conditionValue)) continue
          return valueEvaluator ? valueEvaluator(readTokenValue) : 0
        }
        return 0
      }
    }
    if (normalizedFunctionName === "COALESCE") {
      const argEvaluators = root.args.map(arg => compileChild(arg))
      return (readTokenValue) => {
        for (const evaluator of argEvaluators) {
          const value = evaluator(readTokenValue)
          if (isFormulaValuePresent(value)) return value
        }
        return 0
      }
    }
    const argEvaluators = root.args.map(arg => compileChild(arg))
    return (readTokenValue) => {
      const args = new Array(argEvaluators.length)
      for (let index = 0; index < argEvaluators.length; index += 1) {
        const evaluator = argEvaluators[index]
        args[index] = evaluator ? evaluator(readTokenValue) : null
      }
      const formulaError = findFormulaErrorValue(args)
      if (formulaError) return formulaError
      try {
        return normalizeFormulaValue(functionDefinition.compute(args, getFunctionContext?.()))
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
    const valueEvaluator = compileChild(root.value)
    return readTokenValue => {
      const value = valueEvaluator(readTokenValue)
      if (isFormulaErrorValue(value)) return value
      if (root.operator === "-") return -coerceFormulaValueToNumber(value)
      if (root.operator === "+") return coerceFormulaValueToNumber(value)
      return formulaNumberIsTruthy(value) ? 0 : 1
    }
  }
  const leftEvaluator = compileChild(root.left)
  const rightEvaluator = compileChild(root.right)
  if (root.operator === "AND") {
    return (readTokenValue) => {
      const left = leftEvaluator(readTokenValue)
      if (isFormulaErrorValue(left)) return left
      if (!formulaNumberIsTruthy(left)) return 0
      const right = rightEvaluator(readTokenValue)
      if (isFormulaErrorValue(right)) return right
      return formulaNumberIsTruthy(right) ? 1 : 0
    }
  }
  if (root.operator === "OR") {
    return (readTokenValue) => {
      const left = leftEvaluator(readTokenValue)
      if (isFormulaErrorValue(left)) return left
      if (formulaNumberIsTruthy(left)) return 1
      const right = rightEvaluator(readTokenValue)
      if (isFormulaErrorValue(right)) return right
      return formulaNumberIsTruthy(right) ? 1 : 0
    }
  }
  if (root.operator === "+") return readTokenValue => coerceFormulaValueToNumber(leftEvaluator(readTokenValue)) + coerceFormulaValueToNumber(rightEvaluator(readTokenValue))
  if (root.operator === "-") return readTokenValue => coerceFormulaValueToNumber(leftEvaluator(readTokenValue)) - coerceFormulaValueToNumber(rightEvaluator(readTokenValue))
  if (root.operator === "*") return readTokenValue => coerceFormulaValueToNumber(leftEvaluator(readTokenValue)) * coerceFormulaValueToNumber(rightEvaluator(readTokenValue))
  if (root.operator === "/") {
    return (readTokenValue) => {
      const right = coerceFormulaValueToNumber(rightEvaluator(readTokenValue))
      if (right === 0) {
        throw new DataGridFormulaEvaluationError(createFormulaRuntimeError("DIV_ZERO", "Division by zero.", { operator: "/" }))
      }
      const left = coerceFormulaValueToNumber(leftEvaluator(readTokenValue))
      return left / right
    }
  }
  if (root.operator === ">") return readTokenValue => (compareFormulaValues(leftEvaluator(readTokenValue), rightEvaluator(readTokenValue)) > 0 ? 1 : 0)
  if (root.operator === "<") return readTokenValue => (compareFormulaValues(leftEvaluator(readTokenValue), rightEvaluator(readTokenValue)) < 0 ? 1 : 0)
  if (root.operator === ">=") return readTokenValue => (compareFormulaValues(leftEvaluator(readTokenValue), rightEvaluator(readTokenValue)) >= 0 ? 1 : 0)
  if (root.operator === "<=") return readTokenValue => (compareFormulaValues(leftEvaluator(readTokenValue), rightEvaluator(readTokenValue)) <= 0 ? 1 : 0)
  if (root.operator === "==") return readTokenValue => (areFormulaValuesEqual(leftEvaluator(readTokenValue), rightEvaluator(readTokenValue)) ? 1 : 0)
  return readTokenValue => (areFormulaValuesEqual(leftEvaluator(readTokenValue), rightEvaluator(readTokenValue)) ? 0 : 1)
}

export function compileFormulaAstEvaluator(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
  resolveIdentifierToken: (identifier: string) => DataGridComputedDependencyToken | undefined,
  getFunctionContext?: () => import("../coreTypes.js").DataGridComputedFieldComputeContext<unknown> | undefined,
): DataGridFormulaEvaluator {
  return compileFormulaAstEvaluatorForToken(root, functionRegistry, resolveIdentifierToken, getFunctionContext)
}

export function compileFormulaAstTokenIndexEvaluator(
  root: DataGridFormulaAstNode,
  functionRegistry: ReadonlyMap<string, DataGridFormulaFunctionRuntime>,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
): DataGridFormulaTokenIndexEvaluator {
  return compileFormulaAstEvaluatorForToken(root, functionRegistry, resolveIdentifierTokenIndex)
}
