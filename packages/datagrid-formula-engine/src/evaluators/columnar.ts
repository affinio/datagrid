import type { DataGridFormulaColumnarBatchEvaluator } from "../runtime/types.js"
import {
  DataGridFormulaEvaluationError,
  type DataGridFormulaAstNode,
} from "../syntax/ast.js"
import {
  areFormulaValuesEqual,
  coerceFormulaValueToNumber,
  compareFormulaValues,
  createFormulaRuntimeError,
  findFormulaErrorValue,
  formulaNumberIsTruthy,
  isFormulaErrorValue,
  normalizeFormulaValue,
} from "../syntax/values.js"
import type { DataGridFormulaFusedColumnKernel } from "./shared.js"

export function compileFormulaAstFusedColumnKernel(
  root: DataGridFormulaAstNode,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
): DataGridFormulaFusedColumnKernel | null {
  if (root.kind === "number") {
    return (contextsCount) => {
      const output = new Array(contextsCount)
      for (let contextIndex = 0; contextIndex < contextsCount; contextIndex += 1) {
        output[contextIndex] = root.value
      }
      return output
    }
  }
  if (root.kind === "literal") {
    return (contextsCount) => {
      const output = new Array(contextsCount)
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
        const output = new Array(contextsCount)
        for (let contextIndex = 0; contextIndex < contextsCount; contextIndex += 1) {
          output[contextIndex] = null
        }
        return output
      }
    }
    return (contextsCount, tokenColumns) => {
      const output = new Array(contextsCount)
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
      const output = new Array(contextsCount)
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
    const output = new Array(contextsCount)
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
            createFormulaRuntimeError("DIV_ZERO", "Division by zero.", { operator: "/" }),
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
