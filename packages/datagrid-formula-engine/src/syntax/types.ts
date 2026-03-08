import type { DataGridFormulaValue } from "../coreTypes.js"

export type DataGridFormulaFunctionArity = number | {
  min: number
  max?: number
}

export interface DataGridFormulaFunctionDefinition {
  arity?: DataGridFormulaFunctionArity
  contextKeys?: readonly string[]
  compute: (args: readonly DataGridFormulaValue[]) => unknown
}

export type DataGridFormulaFunctionRegistry = Readonly<
  Record<string, DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[]) => unknown)>
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
  | { kind: "identifier"; value: string; position: number; end: number }
  | { kind: "operator"; value: DataGridFormulaOperator; position: number; end: number }
  | { kind: "comma"; position: number; end: number }
  | { kind: "paren"; value: "(" | ")"; position: number; end: number }

export type DataGridFormulaAstNode =
  | { kind: "number"; value: number; span: DataGridFormulaSourceSpan }
  | { kind: "literal"; value: DataGridFormulaValue; span: DataGridFormulaSourceSpan }
  | { kind: "identifier"; name: string; span: DataGridFormulaSourceSpan }
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
