// Public package surface for the standalone formula engine.
// Keep this file as a curated boundary rather than another implementation layer.
export type {
  DataGridComputedDependencyToken,
  DataGridFormulaReferenceDescriptor,
  DataGridFormulaReferenceDomain,
  DataGridFormulaReferenceRowDomain,
  DataGridComputedFieldComputeContext,
  DataGridComputedFieldDefinition,
  DataGridComputedFieldSnapshot,
  DataGridFormulaMetaField,
  DataGridFormulaContextRecomputeRequest,
  DataGridFormulaCyclePolicy,
  DataGridFormulaFieldDefinition,
  DataGridFormulaFieldSnapshot,
  DataGridFormulaArrayValue,
  DataGridFormulaErrorValue,
  DataGridFormulaIterativeCalculationOptions,
  DataGridFormulaScalarValue,
  DataGridFormulaValue,
  DataGridFormulaRuntimeErrorCode,
  DataGridFormulaRuntimeError,
  DataGridFormulaDirtyCause,
  DataGridFormulaDirtyRowCause,
  DataGridProjectionFormulaDiagnostics,
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaNodeComputeDiagnostics,
  DataGridFormulaRowNodeRecomputeDiagnostics,
  DataGridFormulaRowRecomputeDiagnosticsEntry,
  DataGridFormulaRowRecomputeDiagnostics,
  DataGridFormulaRuntimeIntegration,
  DataGridRowId,
} from "./coreTypes.js"

export type {
  DataGridCompiledFormulaArtifact,
  DataGridCompiledFormulaBatchContext,
  DataGridCompiledFormulaBatchExecutionMode,
  DataGridCompiledFormulaField,
  DataGridFormulaDiagnostic,
  DataGridFormulaExpressionAnalysis,
  DataGridFormulaExplainDependency,
  DataGridFormulaExplainDependencyDomain,
  DataGridFormulaExplainNode,
  DataGridFormulaExplainResult,
  DataGridFormulaFieldExplainResult,
  DataGridFormulaCompileOptions,
  DataGridFormulaCompileStrategy,
  DataGridFormulaFunctionArity,
  DataGridFormulaFunctionDefinition,
  DataGridFormulaFunctionRegistry,
  DataGridFormulaParseResult,
  DataGridFormulaRuntimeErrorPolicy,
  DataGridFormulaDiagnosticsResult,
  DataGridFormulaSourceSpan,
} from "./syntax/index.js"

export type {
  DataGridFormulaExecutionDependencyDomain,
  DataGridFormulaExecutionDependency,
  DataGridFormulaGraphEdgeSnapshot,
  DataGridFormulaGraphLevelSnapshot,
  DataGridFormulaGraphSnapshot,
  DataGridFormulaExecutionPlanNode,
  DataGridFormulaExecutionPlanNodeSnapshot,
  DataGridFormulaExecutionPlan,
  DataGridFormulaExecutionPlanSnapshot,
} from "./graph/index.js"

export {
  DATAGRID_FORMULA_META_FIELDS,
  isDataGridFormulaMetaField,
  parseDataGridComputedDependencyToken,
  serializeDataGridComputedDependencyToken,
} from "./contracts.js"

export {
  collectFormulaContextKeys,
  explainDataGridFormulaExpression,
  explainDataGridFormulaFieldDefinition,
  createFormulaErrorValue,
  createFormulaSourceSpan,
  createFormulaDiagnostic,
  diagnoseDataGridFormulaExpression,
  findFormulaErrorValue,
  getFormulaNodeSpan,
  isFormulaErrorValue,
  isFormulaValueBlank,
  isFormulaValueEmptyText,
  normalizeFormulaValue,
  normalizeFormulaDiagnostic,
  parseDataGridFormulaExpression,
  parseDataGridFormulaIdentifier,
  parseFormulaReferenceSegments,
  normalizeFormulaReference,
  coerceFormulaValueToNumber,
  coerceFormulaValueToBoolean,
  areFormulaValuesEqual,
  compareFormulaValues,
} from "./syntax/index.js"

export {
  analyzeDataGridFormulaFieldDefinition,
  bindCompiledFormulaArtifactToFieldDefinition,
  compileDataGridFormulaFieldArtifact,
  compileDataGridFormulaFieldDefinition,
} from "./runtime/index.js"

export {
  createDataGridFormulaGraph,
  createDataGridFormulaExecutionPlan,
  snapshotDataGridFormulaGraph,
  snapshotDataGridFormulaExecutionPlan,
} from "./graph/index.js"
