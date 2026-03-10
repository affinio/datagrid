import type {
  DataGridComputedFieldComputeContext,
  DataGridFormulaValue,
} from "../coreTypes.js"

export type DataGridFormulaFunctionArity = number | {
  min: number
  max?: number
}

export interface DataGridFormulaFunctionDefinition {
  arity?: DataGridFormulaFunctionArity
  contextKeys?: readonly string[]
  resolveContextKeys?: (args: readonly DataGridFormulaAstNode[]) => readonly string[]
  requiresRuntimeContext?: boolean
  compute: (args: readonly DataGridFormulaValue[], context?: DataGridComputedFieldComputeContext<unknown>) => unknown
}

export type DataGridFormulaFunctionRegistry = Readonly<
  Record<string, DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[], context?: DataGridComputedFieldComputeContext<unknown>) => unknown)>
>

export interface DataGridFormulaSourceSpan {
  start: number
  end: number
}

export interface DataGridFormulaDiagnostic {
  severity: "error"
  message: string
  span: DataGridFormulaSourceSpan
}

export type DataGridFormulaRowSelector =
  | { kind: "current" }
  | { kind: "absolute"; rowIndex: number }
  | { kind: "relative"; offset: number }
  | { kind: "window"; startOffset: number; endOffset: number }

export type DataGridFormulaOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "AND"
  | "OR"
  | "NOT"
  | ">"
  | "<"
  | ">="
  | "<="
  | "=="
  | "!="

export type DataGridFormulaToken =
  | { kind: "number"; value: number; position: number; end: number }
  | { kind: "string"; value: string; position: number; end: number }
  | { kind: "identifier"; value: string; raw?: string; position: number; end: number }
  | { kind: "operator"; value: DataGridFormulaOperator; position: number; end: number }
  | { kind: "comma"; position: number; end: number }
  | { kind: "paren"; value: "(" | ")"; position: number; end: number }

export type DataGridFormulaAstNode =
  | { kind: "number"; value: number; span: DataGridFormulaSourceSpan }
  | { kind: "literal"; value: DataGridFormulaValue; span: DataGridFormulaSourceSpan }
  | {
    kind: "identifier"
    name: string
    referenceName: string
    rowSelector: DataGridFormulaRowSelector
    span: DataGridFormulaSourceSpan
  }
  | { kind: "call"; name: string; args: DataGridFormulaAstNode[]; span: DataGridFormulaSourceSpan }
  | { kind: "unary"; operator: "-" | "+" | "NOT"; value: DataGridFormulaAstNode; span: DataGridFormulaSourceSpan }
  | {
    kind: "binary"
    operator: DataGridFormulaOperator
    left: DataGridFormulaAstNode
    right: DataGridFormulaAstNode
    span: DataGridFormulaSourceSpan
  }

export type DataGridFormulaReferenceSegment = string | number
