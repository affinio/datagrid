/**
 * Stable public API for @affino/datagrid-vue.
 */

// Curated core facade exports so Vue consumers can stay on @affino/datagrid-vue
// for common configuration/state/filter/sort/row-model typing and helper functions.
export {
  createClientRowModel,
  createDataSourceBackedRowModel,
  createServerBackedRowModel,
  createServerRowModel,
  createDataGridServerPivotRowId,
  createDataGridColumnModel,
  createDataGridSelectionSummary,
  createInMemoryDataGridSettingsAdapter,
  buildDataGridAdvancedFilterExpressionFromLegacyFilters,
  cloneDataGridFilterSnapshot,
  evaluateColumnPredicateFilter,
  evaluateDataGridAdvancedFilterExpression,
  normalizeDataGridAdvancedFilterExpression,
  serializeColumnValueToToken,
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
  DataGridAggregationModel,
  DataGridAdvancedFilterExpression,
  DataGridAdvancedFilterCondition,
  DataGridApiCapabilities,
  DataGridApiMutationControlOptions,
  DataGridApiPivotNamespace,
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
  DataGridMigrateStateOptions,
  DataGridSetStateOptions,
  DataGridUnifiedRowsState,
  DataGridUnifiedColumnState,
  DataGridUnifiedState,
  DataGridColumnModel,
  DataGridColumnCapabilities,
  DataGridColumnConstraintValue,
  DataGridColumnConstraints,
  DataGridColumnDataType,
  DataGridColumnDef,
  DataGridColumnInitialState,
  DataGridColumnInput,
  DataGridColumnModelSnapshot,
  DataGridColumnPin,
  DataGridColumnPresentation,
  DataGridColumnSnapshot,
  DataGridColumnStateSnapshot,
  DataGridColumnState,
  DataGridColumnValueAccessors,
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
  DataGridFormulaFieldDefinition,
  DataGridFormulaFieldSnapshot,
  DataGridFormulaFunctionDefinition,
  DataGridFormulaFunctionRegistry,
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaRowRecomputeDiagnostics,
  DataGridRowId,
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
  useAffinoDataGrid,
  type AffinoDataGridEditMode,
  type AffinoDataGridEditSession,
  type AffinoDataGridActionId,
  type AffinoDataGridRunActionOptions,
  type AffinoDataGridActionResult,
  type AffinoDataGridActionBindingOptions,
  type AffinoDataGridSelectionFeature,
  type AffinoDataGridClipboardFeature,
  type AffinoDataGridEditingFeature,
  type AffinoDataGridFilteringFeature,
  type AffinoDataGridSummaryFeature,
  type AffinoDataGridVisibilityFeature,
  type AffinoDataGridTreeFeature,
  type AffinoDataGridFilterMergeMode,
  type AffinoDataGridSetFilterValueMode,
  type AffinoDataGridFilteringHelpers,
  type AffinoDataGridFeatures,
  type AffinoDataGridFormulaExecutionPlanSnapshot,
  type AffinoDataGridFormulaFunctionRegistration,
  type AffinoDataGridFormulaGraphSnapshot,
  type AffinoDataGridFormulaState,
  type UseAffinoDataGridOptions,
  type UseAffinoDataGridResult,
  type UseAffinoDataGridMinimalOptions,
  type UseAffinoDataGridMinimalResult,
} from "./composables/useAffinoDataGrid"

export {
  useAffinoDataGridMinimal,
} from "./composables/useAffinoDataGridMinimal"

export {
  useAffinoDataGridUi,
  type AffinoDataGridUiToolbarAction,
  type UseAffinoDataGridUiOptions,
  type UseAffinoDataGridUiResult,
} from "./composables/useAffinoDataGridUi"

export {
  createDataGridVueRuntime,
  type CreateDataGridVueRuntimeOptions,
  type DataGridVueRuntime,
} from "./runtime/createDataGridVueRuntime"

export {
  createDataGridAppRowHeightMetrics,
  type DataGridAppRowHeightMetrics,
  type DataGridAppRowHeightMetricsOptions,
} from "./app/dataGridRowHeightMetrics"

export {
  useDataGridAppModeMeta,
  useDataGridAppClipboard,
  useDataGridAppFill,
  useDataGridAppActiveCellViewport,
  useDataGridAppAdvancedFilterBuilder,
  useDataGridAppCellSelection,
  useDataGridAppColumnLayoutPanel,
  useDataGridAppControls,
  useDataGridAppDiagnosticsPanel,
  useDataGridAppHeaderResize,
  useDataGridAppInlineEditing,
  useDataGridAppInteractionController,
  useDataGridAppIntentHistory,
  useDataGridAppRowPresentation,
  useDataGridAppRuntime,
  useDataGridAppRuntimeSync,
  useDataGridAppSelection,
  useDataGridAppRowSizing,
  useDataGridAppViewportLifecycle,
  useDataGridAppViewport,
  type DataGridAppPendingClipboardEdge,
  type DataGridAppPendingClipboardOperation,
  type UseDataGridAppClipboardOptions,
  type UseDataGridAppClipboardResult,
  type UseDataGridAppFillOptions,
  type UseDataGridAppFillResult,
  type UseDataGridAppModeMetaOptions,
  type UseDataGridAppModeMetaResult,
  type UseDataGridAppActiveCellViewportOptions,
  type UseDataGridAppActiveCellViewportResult,
  type UseDataGridAppAdvancedFilterBuilderResult,
  type UseDataGridAppInteractionControllerOptions,
  type UseDataGridAppInteractionControllerResult,
  type UseDataGridAppViewportLifecycleOptions,
  type DataGridAppCellCoord,
  type DataGridAppSelectionAnchorLike,
  type UseDataGridAppCellSelectionOptions,
  type UseDataGridAppCellSelectionResult,
  type UseDataGridAppColumnLayoutPanelResult,
  type UseDataGridAppControlsOptions,
  type UseDataGridAppControlsResult,
  type UseDataGridAppDiagnosticsPanelResult,
  type UseDataGridAppHeaderResizeOptions,
  type UseDataGridAppHeaderResizeResult,
  type UseDataGridAppInlineEditingOptions,
  type UseDataGridAppInlineEditingResult,
  type DataGridAppRowSnapshot,
  type UseDataGridAppRowPresentationOptions,
  type UseDataGridAppRowPresentationResult,
  type UseDataGridAppIntentHistoryOptions,
  type UseDataGridAppIntentHistoryResult,
  type UseDataGridAppRuntimeOptions,
  type UseDataGridAppRuntimeResult,
  type UseDataGridAppRuntimeSyncOptions,
  type UseDataGridAppSelectionOptions,
  type UseDataGridAppSelectionResult,
  type UseDataGridAppRowSizingOptions,
  type UseDataGridAppRowSizingResult,
  type UseDataGridAppViewportOptions,
  type UseDataGridAppViewportResult,
  type DataGridAppAdvancedFilterClauseDraft,
  type DataGridAppAdvancedFilterClauseJoin,
  type DataGridAppAdvancedFilterClausePatch,
  type DataGridAppAdvancedFilterColumnOption,
  type DataGridAppApplyColumnLayoutPayload,
  type DataGridAppMode,
  type DataGridAppRuntimeMode,
  type DataGridAppColumnLayoutDraftColumn,
  type DataGridAppColumnLayoutPanelItem,
  type DataGridAppColumnLayoutVisibilityPatch,
  type DataGridAppPivotViewMode,
  type DataGridAppRowHeightMode,
  type DataGridAppRowRenderMode,
  type DataGridAppSortModel,
} from "./app"

export type {
  DataGridOverlayTransform,
  DataGridOverlayTransformInput,
  DataGridAppearanceConfig,
  DataGridStyleConfig,
} from "./types"
