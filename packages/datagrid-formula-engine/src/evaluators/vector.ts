import type { DataGridFormulaColumnarBatchEvaluator } from "../runtime/types.js"
import { type DataGridFormulaAstNode } from "../syntax/ast.js"
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
import {
  createFormulaArrayFilled,
  createSequentialRowIndexes,
  evaluateVectorKernelForIndexes,
  type DataGridFormulaVectorColumnKernel,
  ZERO_FORMULA_NODE,
} from "./shared.js"
import { DataGridFormulaEvaluationError } from "../syntax/ast.js"

export function compileFormulaAstVectorColumnKernel(
  root: DataGridFormulaAstNode,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
): DataGridFormulaVectorColumnKernel | null {
  if (root.kind === "number") {
    return (contextsCount) => createFormulaArrayFilled(contextsCount, root.value)
  }
  if (root.kind === "literal") {
    return (contextsCount) => createFormulaArrayFilled(contextsCount, root.value)
  }
  if (root.kind === "identifier") {
    const tokenIndex = resolveIdentifierTokenIndex(root.name)
    if (typeof tokenIndex !== "number") {
      return (contextsCount) => createFormulaArrayFilled(contextsCount, null)
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
  if (root.kind === "unary") {
    const valueKernel = compileFormulaAstVectorColumnKernel(root.value, resolveIdentifierTokenIndex)
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
  if (root.kind === "call") {
    const normalizedFunctionName = normalizeFormulaFunctionName(root.name)
    if (normalizedFunctionName === "IF") {
      const conditionKernel = compileFormulaAstVectorColumnKernel(root.args[0] ?? ZERO_FORMULA_NODE, resolveIdentifierTokenIndex)
      const trueKernel = compileFormulaAstVectorColumnKernel(root.args[1] ?? ZERO_FORMULA_NODE, resolveIdentifierTokenIndex)
      const falseKernel = compileFormulaAstVectorColumnKernel(root.args[2] ?? ZERO_FORMULA_NODE, resolveIdentifierTokenIndex)
      if (!conditionKernel || !trueKernel || !falseKernel) {
        return null
      }
      return (contextsCount, tokenColumns) => {
        const output = new Array(contextsCount)
        const conditionValues = conditionKernel(contextsCount, tokenColumns)
        const trueIndexes: number[] = []
        const falseIndexes: number[] = []
        for (let contextIndex = 0; contextIndex < contextsCount; contextIndex += 1) {
          const conditionValue = conditionValues[contextIndex] ?? 0
          if (isFormulaErrorValue(conditionValue)) {
            output[contextIndex] = conditionValue
            continue
          }
          if (formulaNumberIsTruthy(conditionValue)) {
            trueIndexes.push(contextIndex)
          } else {
            falseIndexes.push(contextIndex)
          }
        }
        const trueValues = evaluateVectorKernelForIndexes(trueKernel, tokenColumns, trueIndexes)
        for (let index = 0; index < trueIndexes.length; index += 1) {
          output[trueIndexes[index] ?? 0] = trueValues[index] ?? 0
        }
        const falseValues = evaluateVectorKernelForIndexes(falseKernel, tokenColumns, falseIndexes)
        for (let index = 0; index < falseIndexes.length; index += 1) {
          output[falseIndexes[index] ?? 0] = falseValues[index] ?? 0
        }
        return output
      }
    }
    if (normalizedFunctionName === "IFS") {
      const pairKernels = root.args.map(arg => compileFormulaAstVectorColumnKernel(arg, resolveIdentifierTokenIndex))
      if (pairKernels.some(kernel => !kernel)) {
        return null
      }
      return (contextsCount, tokenColumns) => {
        const output = new Array(contextsCount)
        let unresolvedIndexes = createSequentialRowIndexes(contextsCount)
        for (let index = 0; index < pairKernels.length; index += 2) {
          if (unresolvedIndexes.length === 0) break
          const conditionKernel = pairKernels[index]
          const valueKernel = pairKernels[index + 1] ?? compileFormulaAstVectorColumnKernel(ZERO_FORMULA_NODE, resolveIdentifierTokenIndex)
          if (!conditionKernel || !valueKernel) {
            return createFormulaArrayFilled(contextsCount, 0)
          }
          const conditionValues = evaluateVectorKernelForIndexes(conditionKernel, tokenColumns, unresolvedIndexes)
          const matchedIndexes: number[] = []
          const nextUnresolvedIndexes: number[] = []
          for (let conditionIndex = 0; conditionIndex < unresolvedIndexes.length; conditionIndex += 1) {
            const globalIndex = unresolvedIndexes[conditionIndex] ?? 0
            const conditionValue = conditionValues[conditionIndex] ?? 0
            if (isFormulaErrorValue(conditionValue)) {
              output[globalIndex] = conditionValue
              continue
            }
            if (formulaNumberIsTruthy(conditionValue)) matchedIndexes.push(globalIndex)
            else nextUnresolvedIndexes.push(globalIndex)
          }
          const matchedValues = evaluateVectorKernelForIndexes(valueKernel, tokenColumns, matchedIndexes)
          for (let matchedIndex = 0; matchedIndex < matchedIndexes.length; matchedIndex += 1) {
            output[matchedIndexes[matchedIndex] ?? 0] = matchedValues[matchedIndex] ?? 0
          }
          unresolvedIndexes = nextUnresolvedIndexes
        }
        for (const unresolvedIndex of unresolvedIndexes) output[unresolvedIndex] = 0
        return output
      }
    }
    if (normalizedFunctionName === "COALESCE") {
      const argKernels = root.args.map(arg => compileFormulaAstVectorColumnKernel(arg, resolveIdentifierTokenIndex))
      if (argKernels.some(kernel => !kernel)) {
        return null
      }
      return (contextsCount, tokenColumns) => {
        const output = new Array(contextsCount)
        let unresolvedIndexes = createSequentialRowIndexes(contextsCount)
        for (const argKernel of argKernels) {
          if (!argKernel || unresolvedIndexes.length === 0) continue
          const values = evaluateVectorKernelForIndexes(argKernel, tokenColumns, unresolvedIndexes)
          const nextUnresolvedIndexes: number[] = []
          for (let valueIndex = 0; valueIndex < unresolvedIndexes.length; valueIndex += 1) {
            const globalIndex = unresolvedIndexes[valueIndex] ?? 0
            const value = values[valueIndex] ?? null
            if (isFormulaValuePresent(value)) output[globalIndex] = value
            else nextUnresolvedIndexes.push(globalIndex)
          }
          unresolvedIndexes = nextUnresolvedIndexes
        }
        for (const unresolvedIndex of unresolvedIndexes) output[unresolvedIndex] = 0
        return output
      }
    }
    return null
  }

  const leftKernel = compileFormulaAstVectorColumnKernel(root.left, resolveIdentifierTokenIndex)
  const rightKernel = compileFormulaAstVectorColumnKernel(root.right, resolveIdentifierTokenIndex)
  if (!leftKernel || !rightKernel) return null

  if (root.operator === "AND") {
    return (contextsCount, tokenColumns) => {
      const output = new Array(contextsCount)
      const leftValues = leftKernel(contextsCount, tokenColumns)
      const rightIndexes: number[] = []
      for (let contextIndex = 0; contextIndex < contextsCount; contextIndex += 1) {
        const left = leftValues[contextIndex] ?? 0
        if (isFormulaErrorValue(left)) {
          output[contextIndex] = left
          continue
        }
        if (!formulaNumberIsTruthy(left)) {
          output[contextIndex] = 0
          continue
        }
        rightIndexes.push(contextIndex)
      }
      const rightValues = evaluateVectorKernelForIndexes(rightKernel, tokenColumns, rightIndexes)
      for (let rightIndex = 0; rightIndex < rightIndexes.length; rightIndex += 1) {
        const right = rightValues[rightIndex] ?? 0
        output[rightIndexes[rightIndex] ?? 0] = isFormulaErrorValue(right) ? right : formulaNumberIsTruthy(right) ? 1 : 0
      }
      return output
    }
  }
  if (root.operator === "OR") {
    return (contextsCount, tokenColumns) => {
      const output = new Array(contextsCount)
      const leftValues = leftKernel(contextsCount, tokenColumns)
      const rightIndexes: number[] = []
      for (let contextIndex = 0; contextIndex < contextsCount; contextIndex += 1) {
        const left = leftValues[contextIndex] ?? 0
        if (isFormulaErrorValue(left)) {
          output[contextIndex] = left
          continue
        }
        if (formulaNumberIsTruthy(left)) {
          output[contextIndex] = 1
          continue
        }
        rightIndexes.push(contextIndex)
      }
      const rightValues = evaluateVectorKernelForIndexes(rightKernel, tokenColumns, rightIndexes)
      for (let rightIndex = 0; rightIndex < rightIndexes.length; rightIndex += 1) {
        const right = rightValues[rightIndex] ?? 0
        output[rightIndexes[rightIndex] ?? 0] = isFormulaErrorValue(right) ? right : formulaNumberIsTruthy(right) ? 1 : 0
      }
      return output
    }
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
      if (root.operator === "+") { output[contextIndex] = coerceFormulaValueToNumber(left) + coerceFormulaValueToNumber(right); continue }
      if (root.operator === "-") { output[contextIndex] = coerceFormulaValueToNumber(left) - coerceFormulaValueToNumber(right); continue }
      if (root.operator === "*") { output[contextIndex] = coerceFormulaValueToNumber(left) * coerceFormulaValueToNumber(right); continue }
      if (root.operator === "/") {
        const divisor = coerceFormulaValueToNumber(right)
        if (divisor === 0) {
          throw new DataGridFormulaEvaluationError(createFormulaRuntimeError("DIV_ZERO", "Division by zero.", { operator: "/" }))
        }
        output[contextIndex] = coerceFormulaValueToNumber(left) / divisor
        continue
      }
      if (root.operator === ">") { output[contextIndex] = compareFormulaValues(left, right) > 0 ? 1 : 0; continue }
      if (root.operator === "<") { output[contextIndex] = compareFormulaValues(left, right) < 0 ? 1 : 0; continue }
      if (root.operator === ">=") { output[contextIndex] = compareFormulaValues(left, right) >= 0 ? 1 : 0; continue }
      if (root.operator === "<=") { output[contextIndex] = compareFormulaValues(left, right) <= 0 ? 1 : 0; continue }
      if (root.operator === "==") { output[contextIndex] = areFormulaValuesEqual(left, right) ? 1 : 0; continue }
      output[contextIndex] = areFormulaValuesEqual(left, right) ? 0 : 1
    }
    return output
  }
}

export function compileFormulaAstColumnarBatchEvaluatorVector(
  root: DataGridFormulaAstNode,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
): DataGridFormulaColumnarBatchEvaluator | null {
  const vectorKernel = compileFormulaAstVectorColumnKernel(root, resolveIdentifierTokenIndex)
  if (!vectorKernel) return null
  return (contextsCount, tokenColumns) => vectorKernel(contextsCount, tokenColumns)
}
