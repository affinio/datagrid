import type {
  DataGridComputedDependencyToken,
  DataGridComputedFieldComputeContext,
  DataGridFormulaFieldDefinition,
  DataGridFormulaRuntimeError,
  DataGridFormulaValue,
} from "../coreTypes.js"
import type {
  DataGridFormulaAstNode,
  DataGridFormulaFunctionArity,
  DataGridFormulaFunctionRegistry,
  DataGridFormulaReferenceParserOptions,
  DataGridFormulaToken,
} from "../syntax/types.js"

export interface DataGridFormulaFunctionRuntime {
  name: string
  arity?: DataGridFormulaFunctionArity
  contextKeys: readonly string[]
  resolveContextKeys?: (args: readonly DataGridFormulaAstNode[]) => readonly string[]
  requiresRuntimeContext: boolean
  compute: (args: readonly DataGridFormulaValue[], context?: DataGridComputedFieldComputeContext<unknown>) => unknown
}

export type DataGridFormulaRuntimeErrorPolicy = "coerce-zero" | "throw" | "error-value"
export type DataGridFormulaCompileStrategy = "auto" | "ast" | "jit"

export interface DataGridFormulaCompileOptions {
  resolveDependencyToken?: (identifier: string) => DataGridComputedDependencyToken
  functionRegistry?: DataGridFormulaFunctionRegistry
  referenceParserOptions?: DataGridFormulaReferenceParserOptions
  onFunctionOverride?: (functionName: string) => void
  runtimeErrorPolicy?: DataGridFormulaRuntimeErrorPolicy
  onRuntimeError?: (error: DataGridFormulaRuntimeError) => void
  compileStrategy?: DataGridFormulaCompileStrategy
  allowDynamicCodegen?: boolean
}

export interface DataGridCompiledFormulaField<TRow = unknown> {
  name: string
  field: string
  formula: string
  expressionHash: string
  identifiers: readonly string[]
  deps: readonly DataGridComputedDependencyToken[]
  contextKeys: readonly string[]
  batchExecutionMode?: DataGridCompiledFormulaBatchExecutionMode
  compute: (context: DataGridComputedFieldComputeContext<TRow>) => DataGridFormulaValue
  computeBatch?: (
    contexts: readonly DataGridCompiledFormulaBatchContext<TRow>[],
    readTokenByIndex: (contextIndex: number, tokenIndex: number) => unknown,
  ) => readonly DataGridFormulaValue[]
  computeBatchColumnar?: (
    contexts: readonly DataGridCompiledFormulaBatchContext<TRow>[],
    tokenColumns: readonly (readonly unknown[])[],
  ) => readonly DataGridFormulaValue[]
}

export interface DataGridFormulaExpressionAnalysis {
  formula: string
  expressionHash: string
  identifiers: readonly string[]
  deps: readonly DataGridComputedDependencyToken[]
  contextKeys: readonly string[]
}

export interface DataGridCompiledFormulaArtifact<TRow = unknown> extends DataGridFormulaExpressionAnalysis {
  bind: (
    definition: DataGridFormulaFieldDefinition,
    options?: Pick<DataGridFormulaCompileOptions, "runtimeErrorPolicy" | "onRuntimeError">,
  ) => DataGridCompiledFormulaField<TRow>
}

export interface DataGridCompiledFormulaBatchContext<TRow = unknown> {
  row: TRow
  rowId: string | number
  sourceIndex: number
}

export type DataGridCompiledFormulaBatchExecutionMode =
  | "row"
  | "batch"
  | "columnar-ast"
  | "columnar-jit"
  | "columnar-fused"
  | "columnar-vector"

export type DataGridFormulaTokenValueReader<TKey> = (token: TKey) => unknown
export type DataGridFormulaEvaluatorForToken<TKey> = (
  readTokenValue: DataGridFormulaTokenValueReader<TKey>,
) => DataGridFormulaValue
export type DataGridFormulaEvaluator = DataGridFormulaEvaluatorForToken<DataGridComputedDependencyToken>
export type DataGridFormulaTokenIndexEvaluator = DataGridFormulaEvaluatorForToken<number>
export type DataGridFormulaBatchEvaluator = (
  contextsCount: number,
  readTokenByIndex: (contextIndex: number, tokenIndex: number) => unknown,
) => readonly DataGridFormulaValue[]
export type DataGridFormulaColumnarBatchEvaluator = (
  contextsCount: number,
  tokenColumns: readonly (readonly unknown[])[],
) => readonly DataGridFormulaValue[]

export interface DataGridFormulaParseResult {
  formula: string
  tokens: readonly DataGridFormulaToken[]
  ast: DataGridFormulaAstNode
}
