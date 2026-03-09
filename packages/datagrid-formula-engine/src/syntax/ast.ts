// AST and syntax primitive ownership lives here: nodes, source spans and
// syntax/evaluation error wrappers shared by parser, optimizer and runtime.
import type { DataGridFormulaRuntimeError } from "../coreTypes.js"
import type {
  DataGridFormulaAstNode,
  DataGridFormulaDiagnostic,
  DataGridFormulaSourceSpan,
} from "./types.js"
export type {
  DataGridFormulaSourceSpan,
  DataGridFormulaOperator,
  DataGridFormulaToken,
  DataGridFormulaAstNode,
  DataGridFormulaDiagnostic,
} from "./types.js"
export type { DataGridFormulaExplainNode } from "../analysis/types.js"

export class DataGridFormulaEvaluationError extends Error {
  readonly runtimeError: DataGridFormulaRuntimeError

  constructor(runtimeError: DataGridFormulaRuntimeError) {
    super(runtimeError.message)
    this.name = "DataGridFormulaEvaluationError"
    this.runtimeError = runtimeError
  }
}

export class DataGridFormulaSyntaxError extends Error {
  readonly span: DataGridFormulaSourceSpan

  constructor(message: string, span: DataGridFormulaSourceSpan) {
    super(message)
    this.name = "DataGridFormulaSyntaxError"
    this.span = span
  }
}

export function createFormulaSourceSpan(start: number, end: number): DataGridFormulaSourceSpan {
  const normalizedStart = Math.max(0, Math.trunc(start))
  const normalizedEnd = Math.max(normalizedStart, Math.trunc(end))
  return { start: normalizedStart, end: normalizedEnd }
}

export function getFormulaNodeSpan(node: DataGridFormulaAstNode): DataGridFormulaSourceSpan {
  return node.span
}

export function throwFormulaError(
  message: string,
  span: DataGridFormulaSourceSpan = createFormulaSourceSpan(0, 0),
): never {
  throw new DataGridFormulaSyntaxError(`[DataGridFormula] ${message}`, span)
}

export function createFormulaDiagnostic(
  message: string,
  span: DataGridFormulaSourceSpan,
): DataGridFormulaDiagnostic {
  return {
    severity: "error",
    message,
    span,
  }
}

export function normalizeFormulaDiagnostic(error: unknown): DataGridFormulaDiagnostic {
  if (error instanceof DataGridFormulaSyntaxError) {
    return createFormulaDiagnostic(error.message, error.span)
  }
  if (error instanceof DataGridFormulaEvaluationError) {
    return createFormulaDiagnostic(error.runtimeError.message, createFormulaSourceSpan(0, 0))
  }
  const message = error instanceof Error ? error.message : String(error ?? "Formula diagnostics failed.")
  return createFormulaDiagnostic(message, createFormulaSourceSpan(0, 0))
}
