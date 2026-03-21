/**
 * Stable public API for @affino/datagrid-vue.
 */

// Curated core facade exports so Vue consumers can stay on @affino/datagrid-vue
// for common configuration/state/filter/sort/row-model typing and helper functions.
export {
  buildDataGridCellRenderModel,
  createClientRowModel,
  createDataSourceBackedRowModel,
  createServerBackedRowModel,
  createServerRowModel,
  createDataGridServerPivotRowId,
  createDataGridCellTypeRegistry,
  createDataGridColumnModel,
  formatDataGridCellValue,
  invokeDataGridCellInteraction,
  parseDataGridCellDraftValue,
  createDataGridSelectionSummary,
  createInMemoryDataGridSettingsAdapter,
  buildDataGridAdvancedFilterExpressionFromLegacyFilters,
  cloneDataGridFilterSnapshot,
  evaluateColumnPredicateFilter,
  evaluateDataGridAdvancedFilterExpression,
  normalizeDataGridAdvancedFilterExpression,
  resolveDataGridCellInteraction,
  resolveDataGridCellClickAction,
  resolveDataGridCellKeyboardAction,
  resolveDataGridCellType,
  serializeColumnValueToToken,
  toggleDataGridCellValue,
} from "@affino/datagrid-core"

export {
  normalizePivotSpec,
  clonePivotSpec,
  isSamePivotSpec,
} from "@affino/datagrid-pivot"

export type {
  CreateDataGridCoreOptions,
  DataGridCoreServiceRegistry,
  DataGridAggOp,
  DataGridAggregationColumnSpec,
  DataGridAggregationColumnSpecAnyState,
  DataGridAggregationModel,
  DataGridAdvancedFilterExpression,
  DataGridAdvancedFilterCondition,
  DataGridApiCapabilities,
  DataGridApiMutationControlOptions,
  DataGridApiPivotNamespace,
  DataGridApiRowSelectionNamespace,
  DataGridApiSelectionNamespace,
  DataGridApiTransactionNamespace,
  DataGridApiRowsNamespace,
  DataGridApiDataNamespace,
  DataGridApiColumnsNamespace,
  DataGridApiViewNamespace,
  DataGridApiComputeNamespace,
  DataGridApiDiagnosticsNamespace,
  DataGridApiDiagnosticsSnapshot,
  DataGridApiFormulaExplainSnapshot,
  DataGridApiRowModelDiagnostics,
  DataGridApiLifecycleNamespace,
  DataGridApiMetaNamespace,
  DataGridApiSchemaSnapshot,
  DataGridApiSchemaColumn,
  DataGridApiRuntimeInfo,
  DataGridApiPolicyNamespace,
  DataGridApiProjectionMode,
  DataGridApiPluginDefinition,
  DataGridApiPluginsNamespace,
  DataGridApiStateNamespace,
  DataGridApiEventsNamespace,
  DataGridApiEventMap,
  DataGridApiEventName,
  DataGridApiEventPayload,
  DataGridApiErrorCode,
  DataGridApiErrorEvent,
  DataGridApiRowSelectionChangedEvent,
  DataGridApiSelectionChangedEvent,
  DataGridMigrateStateOptions,
  DataGridSetStateOptions,
  DataGridUnifiedRowsState,
  DataGridUnifiedColumnState,
  DataGridUnifiedState,
  DataGridColumnModel,
  DataGridColumnCapabilities,
  DataGridCellInteractionInvocationTrigger,
  DataGridCellInteractionKeyboardTrigger,
  DataGridCellInteractionRole,
  DataGridCellInteractionTriState,
  DataGridColumnCellInteraction,
  DataGridColumnCellInteractionContext,
  DataGridColumnCellInteractionInvokeContext,
  DataGridColumnConstraintValue,
  DataGridColumnConstraints,
  DataGridColumnDataType,
  DataGridColumnDateTimeFormatOptions,
  DataGridColumnDef,
  DataGridColumnInitialState,
  DataGridColumnInput,
  DataGridColumnOption,
  DataGridColumnNumberFormatOptions,
  DataGridColumnModelSnapshot,
  DataGridColumnPin,
  DataGridColumnPresentation,
  DataGridColumnSnapshot,
  DataGridColumnStateSnapshot,
  DataGridColumnState,
  DataGridColumnValueAccessors,
  BuildDataGridCellRenderModelOptions,
  CreateDataGridCellTypeRegistryOptions,
  DataGridCellClickAction,
  DataGridCellInteractionContext,
  DataGridCellEditorMode,
  DataGridCellKeyboardAction,
  DataGridCellRenderModel,
  DataGridResolvedCellInteraction,
  DataGridCellTypeDefinition,
  DataGridCellTypeId,
  DataGridCellTypeOption,
  DataGridCellTypeRegistry,
  InvokeDataGridCellInteractionOptions,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridClientComputeMode,
  DataGridClientComputeDiagnostics,
  DataGridClientComputeRequest,
  DataGridClientComputeTransport,
  DataGridClientComputeTransportResult,
  DataGridApi,
  DataGridClientRowReorderInput,
  DataGridComputedFieldDefinition,
  DataGridComputedFieldSnapshot,
  DataGridCoreServiceContext,
  DataGridEventEnvelope,
  DataGridEventPhase,
  DataGridEventSource,
  DataGridEventTier,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridDataSource,
  DataGridDataSourceBackpressureDiagnostics,
  DataGridDataSourceInvalidation,
  DataGridDataSourcePaginationPullContext,
  DataGridDataSourcePullPriority,
  DataGridDataSourcePivotPullContext,
  DataGridDataSourcePullReason,
  DataGridDataSourcePullRequest,
  DataGridDataSourcePullResult,
  DataGridDataSourceTreePullContext,
  DataGridDataSourceTreePullOperation,
  DataGridDataSourceTreePullScope,
  DataGridDataSourcePushEvent,
  DataGridDataSourcePushInvalidateEvent,
  DataGridDataSourcePushListener,
  DataGridDataSourcePushRemoveEvent,
  DataGridDataSourcePushUpsertEvent,
  DataGridDataSourceRowEntry,
  DataGridServerPivotRowIdInput,
  DataGridServerPivotRowRole,
  DataSourceBackedRowModel,
  CreateDataSourceBackedRowModelOptions,
  ServerBackedRowModel,
  CreateServerBackedRowModelOptions,
  ServerRowModel,
  ServerRowModelOptions,
  ServerRowModelFetchResult,
  DataGridPaginationInput,
  DataGridPaginationSnapshot,
  DataGridProjectionDiagnostics,
  DataGridProjectionMemoryDiagnostics,
  DataGridProjectionPerformanceDiagnostics,
  DataGridProjectionPipelineDiagnostics,
  DataGridProjectionRowCounts,
  DataGridProjectionStageTimes,
  DataGridFormulaFieldDefinition,
  DataGridFormulaFieldSnapshot,
  DataGridFormulaFunctionDefinition,
  DataGridFormulaFunctionRegistry,
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaRowRecomputeDiagnostics,
  DataGridRowId,
  DataGridRowSelectionSnapshot,
  DataGridRowModel,
  DataGridRowModelSnapshot,
  DataGridRowNode,
  DataGridRowNodeInput,
  DataGridSettingsAdapter,
  DataGridSelectionAggregationKind,
  DataGridSelectionSnapshot,
  DataGridSelectionSnapshotRange,
  DataGridSelectionSummaryColumnConfig,
  DataGridSelectionSummarySnapshot,
  GridSelectionSnapshot,
  GridSelectionSnapshotRange,
  DataGridSortDirection,
  DataGridSortState,
  DataGridViewportRange,
  ClientRowModel,
  CreateClientRowModelOptions,
  ResolveDataGridCellInteractionOptions,
} from "@affino/datagrid-core"

export type {
  DataGridPivotSpec,
  DataGridPivotValueSpec,
  DataGridPivotColumn,
  DataGridPivotColumnPathSegment,
  DataGridPivotCellDrilldownInput,
  DataGridPivotCellDrilldown,
  DataGridPivotLayoutColumnState,
  DataGridPivotLayoutSnapshot,
  DataGridPivotLayoutImportOptions,
  DataGridPivotInteropSnapshot,
} from "@affino/datagrid-pivot"

export type {
  DataGridTransactionSnapshot,
  GridSelectionPointLike,
} from "@affino/datagrid-core/advanced"

export type {
  DataGridRuntimeOverrides,
} from "@affino/datagrid-orchestration"

export {
  createDataGridSettingsAdapter,
} from "./dataGridSettingsAdapter"

export {
  useDataGridSettingsStore,
  type DataGridSettingsStore,
} from "./dataGridSettingsStore"

export {
  buildDataGridOverlayTransform,
  buildDataGridOverlayTransformFromSnapshot,
} from "./composables/selectionOverlayTransform"

export {
  mapDataGridA11yGridAttributes,
  mapDataGridA11yCellAttributes,
  type DataGridA11yGridAttributeMap,
  type DataGridA11yCellAttributeMap,
} from "./adapters/a11yAttributesAdapter"

export {
  useDataGridOverlayScrollState,
  type UseDataGridOverlayScrollStateOptions,
} from "./composables/useDataGridOverlayScrollState"

export {
  useDataGridSelectionOverlayOrchestration,
  type DataGridOverlayRange,
  type DataGridOverlayColumnLike,
  type DataGridOverlayColumnMetricLike,
  type DataGridSelectionOverlayVirtualWindow,
  type DataGridSelectionOverlaySegment,
  type UseDataGridSelectionOverlayOrchestrationOptions,
  type UseDataGridSelectionOverlayOrchestrationResult,
} from "./composables/useDataGridSelectionOverlayOrchestration"

export {
  useDataGridContextMenu,
  type DataGridContextMenuAction,
  type DataGridContextMenuActionId,
  type DataGridContextMenuState,
  type DataGridContextMenuZone,
  type OpenDataGridContextMenuInput,
  type UseDataGridContextMenuOptions,
  type UseDataGridContextMenuResult,
} from "./composables/useDataGridContextMenu"

export {
  useDataGridRuntime,
  type DataGridRuntimeVirtualWindowSnapshot,
  type UseDataGridRuntimeOptions,
  type UseDataGridRuntimeResult,
} from "./composables/useDataGridRuntime"

export {
  provideDataGridEngineContext,
  useDataGridEngineContext,
  useGridApi,
  type DataGridEngineContextValue,
} from "./composables/useDataGridEngineContext"

export {
  provideDataGridViewContext,
  useDataGridViewContext,
  type DataGridViewContextValue,
} from "./composables/useDataGridViewContext"

export {
  provideDataGridContext,
  useDataGridContext,
  type DataGridContextValue,
} from "./composables/useDataGridContext"

export {
  useAffinoGrid,
  type UseAffinoGridPlugins,
  type AffinoGridInstalledFeatures,
  type UseAffinoGridOptions,
  type UseAffinoGridResult,
} from "./composables/useAffinoGrid"

export {
  createGrid,
} from "./grid/createGrid"

export type {
  DataGridRuntime,
  GridContext,
  DataGridFeature,
  CreateGridOptions,
  GridInstance,
} from "./grid/types"

export {
  DATA_GRID_CLASS_NAMES,
  DATA_GRID_DATA_ATTRS,
  DATA_GRID_SELECTORS,
  dataGridCellSelector,
  dataGridHeaderCellSelector,
  dataGridResizeHandleSelector,
} from "./contracts/dataGridSelectors"

export {
  createDataGridVueRuntime,
  type CreateDataGridVueRuntimeOptions,
  type DataGridVueRuntime,
} from "./runtime/createDataGridVueRuntime"

export type {
  DataGridOverlayTransform,
  DataGridOverlayTransformInput,
  DataGridAppearanceConfig,
  DataGridStyleConfig,
} from "./types"
