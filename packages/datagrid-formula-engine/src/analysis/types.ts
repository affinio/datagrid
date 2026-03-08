import type { DataGridComputedDependencyToken, DataGridFormulaValue } from "../coreTypes.js"
import type {
  DataGridFormulaAstNode,
  DataGridFormulaDiagnostic,
  DataGridFormulaOperator,
  DataGridFormulaSourceSpan,
  DataGridFormulaToken,
} from "../syntax/types.js"

export interface DataGridFormulaDiagnosticsResult {
  ok: boolean
  formula: string
  diagnostics: readonly DataGridFormulaDiagnostic[]
  tokens?: readonly DataGridFormulaToken[]
  ast?: DataGridFormulaAstNode
}

export type DataGridFormulaExplainDependencyDomain = "field" | "computed" | "meta" | "unknown"

export interface DataGridFormulaExplainDependency {
  identifier: string
  token: DataGridComputedDependencyToken
  domain: DataGridFormulaExplainDependencyDomain
  value: string
}

export interface DataGridFormulaExplainNode {
  kind: DataGridFormulaAstNode["kind"]
  label: string
  span: DataGridFormulaSourceSpan
  children: readonly DataGridFormulaExplainNode[]
  name?: string
  operator?: DataGridFormulaOperator | "CALL"
  value?: DataGridFormulaValue
}

export interface DataGridFormulaExplainResult {
  formula: string
  tokens: readonly DataGridFormulaToken[]
  ast: DataGridFormulaAstNode
  identifiers: readonly string[]
  dependencies: readonly DataGridFormulaExplainDependency[]
  contextKeys: readonly string[]
  tree: DataGridFormulaExplainNode
}

export interface DataGridFormulaFieldExplainResult extends DataGridFormulaExplainResult {
  name: string
  field: string
}
