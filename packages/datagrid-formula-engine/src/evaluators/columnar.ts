import type { DataGridFormulaColumnarBatchEvaluator } from "../runtime/types.js"
import {
  type DataGridFormulaAstNode,
} from "../syntax/ast.js"
import {
  createFormulaBinaryColumnKernel,
  createFormulaConstantColumnKernel,
  createFormulaIdentifierColumnKernel,
  createFormulaUnaryColumnKernel,
  type DataGridFormulaFusedColumnKernel,
} from "./shared.js"

export function compileFormulaAstFusedColumnKernel(
  root: DataGridFormulaAstNode,
  resolveIdentifierTokenIndex: (identifier: string) => number | undefined,
): DataGridFormulaFusedColumnKernel | null {
  if (root.kind === "number") {
    return createFormulaConstantColumnKernel(root.value)
  }
  if (root.kind === "literal") {
    return createFormulaConstantColumnKernel(root.value)
  }
  if (root.kind === "identifier") {
    return createFormulaIdentifierColumnKernel(resolveIdentifierTokenIndex(root.name))
  }
  if (root.kind === "call") {
    return null
  }
  if (root.kind === "unary") {
    const valueKernel = compileFormulaAstFusedColumnKernel(root.value, resolveIdentifierTokenIndex)
    if (!valueKernel) {
      return null
    }
    return createFormulaUnaryColumnKernel(valueKernel, root.operator)
  }

  if (root.operator === "AND" || root.operator === "OR") {
    return null
  }

  const leftKernel = compileFormulaAstFusedColumnKernel(root.left, resolveIdentifierTokenIndex)
  const rightKernel = compileFormulaAstFusedColumnKernel(root.right, resolveIdentifierTokenIndex)
  if (!leftKernel || !rightKernel) {
    return null
  }

  return createFormulaBinaryColumnKernel(leftKernel, rightKernel, root.operator)
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
