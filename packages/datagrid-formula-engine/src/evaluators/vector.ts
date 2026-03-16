// Vector backend: evaluates formulas over column batches directly. This path is
// most useful for branch-heavy or column-oriented workloads where row-index
// selections can be reused across a batch.
import type { DataGridFormulaColumnarBatchEvaluator } from "../runtime/types.js"
import { type DataGridFormulaAstNode } from "../syntax/ast.js"
import { normalizeFormulaFunctionName } from "../syntax/functions.js"
import {
  formulaNumberIsTruthy,
  isFormulaErrorValue,
  isFormulaValuePresent,
} from "../syntax/values.js"
import {
  createFormulaBinaryColumnKernel,
  createFormulaConstantColumnKernel,
  createFormulaIdentifierColumnKernel,
  createFormulaUnaryColumnKernel,
  createSequentialRowIndexes,
  evaluateVectorKernelForIndexes,
  type DataGridFormulaRowIndexSelection,
  type DataGridFormulaVectorColumnKernel,
  ZERO_FORMULA_NODE,
} from "./shared.js"

function createRowIndexBuffer(contextsCount: number): number[] {
  return new Array<number>(contextsCount)
}

function createRowIndexSelection(
  indexes: readonly number[],
  count: number,
): DataGridFormulaRowIndexSelection {
  return { indexes, count }
}

export function compileFormulaAstVectorColumnKernel(
  root: DataGridFormulaAstNode,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
): DataGridFormulaVectorColumnKernel | null {
  if (root.kind === "number") {
    return createFormulaConstantColumnKernel(root.value)
  }
  if (root.kind === "literal") {
    return createFormulaConstantColumnKernel(root.value)
  }
  if (root.kind === "identifier") {
    return createFormulaIdentifierColumnKernel(resolveIdentifierTokenIndex(root.name))
  }
  if (root.kind === "unary") {
    const valueKernel = compileFormulaAstVectorColumnKernel(root.value, resolveIdentifierTokenIndex)
    if (!valueKernel) {
      return null
    }
    return createFormulaUnaryColumnKernel(valueKernel, root.operator)
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
        const trueIndexes = createRowIndexBuffer(contextsCount)
        const falseIndexes = createRowIndexBuffer(contextsCount)
        let trueCount = 0
        let falseCount = 0
        for (let contextIndex = 0; contextIndex < contextsCount; contextIndex += 1) {
          const conditionValue = conditionValues[contextIndex] ?? 0
          if (isFormulaErrorValue(conditionValue)) {
            output[contextIndex] = conditionValue
            continue
          }
          if (formulaNumberIsTruthy(conditionValue)) {
            trueIndexes[trueCount] = contextIndex
            trueCount += 1
          } else {
            falseIndexes[falseCount] = contextIndex
            falseCount += 1
          }
        }
        const trueValues = evaluateVectorKernelForIndexes(
          trueKernel,
          tokenColumns,
          createRowIndexSelection(trueIndexes, trueCount),
        )
        for (let index = 0; index < trueCount; index += 1) {
          output[trueIndexes[index] ?? 0] = trueValues[index] ?? 0
        }
        const falseValues = evaluateVectorKernelForIndexes(
          falseKernel,
          tokenColumns,
          createRowIndexSelection(falseIndexes, falseCount),
        )
        for (let index = 0; index < falseCount; index += 1) {
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
        let unresolvedCount = unresolvedIndexes.length
        for (let index = 0; index < pairKernels.length; index += 2) {
          if (unresolvedCount === 0) break
          const conditionKernel = pairKernels[index]
          const valueKernel = pairKernels[index + 1] ?? compileFormulaAstVectorColumnKernel(ZERO_FORMULA_NODE, resolveIdentifierTokenIndex)
          if (!conditionKernel || !valueKernel) {
            return createFormulaConstantColumnKernel(0)(contextsCount, tokenColumns)
          }
          const conditionValues = evaluateVectorKernelForIndexes(
            conditionKernel,
            tokenColumns,
            createRowIndexSelection(unresolvedIndexes, unresolvedCount),
          )
          const matchedIndexes = createRowIndexBuffer(unresolvedCount)
          const nextUnresolvedIndexes = createRowIndexBuffer(unresolvedCount)
          let matchedCount = 0
          let nextUnresolvedCount = 0
          for (let conditionIndex = 0; conditionIndex < unresolvedCount; conditionIndex += 1) {
            const globalIndex = unresolvedIndexes[conditionIndex] ?? 0
            const conditionValue = conditionValues[conditionIndex] ?? 0
            if (isFormulaErrorValue(conditionValue)) {
              output[globalIndex] = conditionValue
              continue
            }
            if (formulaNumberIsTruthy(conditionValue)) {
              matchedIndexes[matchedCount] = globalIndex
              matchedCount += 1
            } else {
              nextUnresolvedIndexes[nextUnresolvedCount] = globalIndex
              nextUnresolvedCount += 1
            }
          }
          const matchedValues = evaluateVectorKernelForIndexes(
            valueKernel,
            tokenColumns,
            createRowIndexSelection(matchedIndexes, matchedCount),
          )
          for (let matchedIndex = 0; matchedIndex < matchedCount; matchedIndex += 1) {
            output[matchedIndexes[matchedIndex] ?? 0] = matchedValues[matchedIndex] ?? 0
          }
          unresolvedIndexes = nextUnresolvedIndexes
          unresolvedCount = nextUnresolvedCount
        }
        for (let unresolvedIndexIndex = 0; unresolvedIndexIndex < unresolvedCount; unresolvedIndexIndex += 1) {
          output[unresolvedIndexes[unresolvedIndexIndex] ?? 0] = 0
        }
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
        let unresolvedCount = unresolvedIndexes.length
        for (const argKernel of argKernels) {
          if (!argKernel || unresolvedCount === 0) continue
          const values = evaluateVectorKernelForIndexes(
            argKernel,
            tokenColumns,
            createRowIndexSelection(unresolvedIndexes, unresolvedCount),
          )
          const nextUnresolvedIndexes = createRowIndexBuffer(unresolvedCount)
          let nextUnresolvedCount = 0
          for (let valueIndex = 0; valueIndex < unresolvedCount; valueIndex += 1) {
            const globalIndex = unresolvedIndexes[valueIndex] ?? 0
            const value = values[valueIndex] ?? null
            if (isFormulaValuePresent(value)) output[globalIndex] = value
            else {
              nextUnresolvedIndexes[nextUnresolvedCount] = globalIndex
              nextUnresolvedCount += 1
            }
          }
          unresolvedIndexes = nextUnresolvedIndexes
          unresolvedCount = nextUnresolvedCount
        }
        for (let unresolvedIndexIndex = 0; unresolvedIndexIndex < unresolvedCount; unresolvedIndexIndex += 1) {
          output[unresolvedIndexes[unresolvedIndexIndex] ?? 0] = 0
        }
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
      const rightIndexes = createRowIndexBuffer(contextsCount)
      let rightCount = 0
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
        rightIndexes[rightCount] = contextIndex
        rightCount += 1
      }
      const rightValues = evaluateVectorKernelForIndexes(
        rightKernel,
        tokenColumns,
        createRowIndexSelection(rightIndexes, rightCount),
      )
      for (let rightIndex = 0; rightIndex < rightCount; rightIndex += 1) {
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
      const rightIndexes = createRowIndexBuffer(contextsCount)
      let rightCount = 0
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
        rightIndexes[rightCount] = contextIndex
        rightCount += 1
      }
      const rightValues = evaluateVectorKernelForIndexes(
        rightKernel,
        tokenColumns,
        createRowIndexSelection(rightIndexes, rightCount),
      )
      for (let rightIndex = 0; rightIndex < rightCount; rightIndex += 1) {
        const right = rightValues[rightIndex] ?? 0
        output[rightIndexes[rightIndex] ?? 0] = isFormulaErrorValue(right) ? right : formulaNumberIsTruthy(right) ? 1 : 0
      }
      return output
    }
  }

  return createFormulaBinaryColumnKernel(leftKernel, rightKernel, root.operator)
}

export function compileFormulaAstColumnarBatchEvaluatorVector(
  root: DataGridFormulaAstNode,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
): DataGridFormulaColumnarBatchEvaluator | null {
  const vectorKernel = compileFormulaAstVectorColumnKernel(root, resolveIdentifierTokenIndex)
  if (!vectorKernel) return null
  return (contextsCount, tokenColumns) => vectorKernel(contextsCount, tokenColumns)
}
