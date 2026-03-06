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
  normalizePivotSpec,
  clonePivotSpec,
  isSamePivotSpec,
  serializeColumnValueToToken,
} from "@affino/datagrid-core"

export type {
  CreateDataGridCoreOptions,
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
  DataGridColumnDef,
  DataGridColumnModelSnapshot,
  DataGridColumnPin,
  DataGridColumnSnapshot,
  DataGridColumnStateSnapshot,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridClientComputeMode,
  DataGridClientComputeDiagnostics,
  DataGridClientComputeRequest,
  DataGridClientComputeTransport,
  DataGridClientComputeTransportResult,
  DataGridApi,
  DataGridClientRowReorderInput,
  DataGridCoreServiceContext,
  DataGridEventEnvelope,
  DataGridEventPhase,
  DataGridEventSource,
  DataGridEventTier,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
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
  DataGridRowId,
  DataGridRowModel,
  DataGridRowNode,
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
} from "@affino/datagrid-core"

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
  createDataGridFeatureRegistry,
  resolveDataGridFeatureDependencies,
} from "./composables/useDataGridFeatureRegistry"

export type {
  DataGridFeatureName,
  DataGridFeatureRegistry,
  CreateDataGridFeatureRegistryOptions,
  DataGridExportContext,
  DataGridExportPayload,
} from "./composables/useDataGridFeatureRegistry"

export {
  selectionFeature,
} from "./features/selectionFeature"

export {
  clipboardFeature,
} from "./features/clipboardFeature"

export {
  advancedClipboardFeature,
} from "./features/advancedClipboardFeature"

export {
  excelCompatibleClipboardFeature,
} from "./features/excelCompatibleClipboardFeature"

export {
  fillHandleFeature,
} from "./features/fillHandleFeature"

export {
  navigationFeature,
} from "./features/navigationFeature"

export {
  historyFeature,
} from "./features/historyFeature"

export {
  sortingFeature,
} from "./features/sortingFeature"

export {
  pivotFeature,
} from "./features/pivotFeature"

export {
  advancedPivotEngineFeature,
} from "./features/advancedPivotEngineFeature"

export {
  pivotPanelFeature,
} from "./features/pivotPanelFeature"

export {
  groupingFeature,
} from "./features/groupingFeature"

export {
  groupPanelFeature,
} from "./features/groupPanelFeature"

export {
  aggregationFeature,
} from "./features/aggregationFeature"

export {
  aggregationFunctionsRegistryFeature,
} from "./features/aggregationFunctionsRegistryFeature"

export {
  filterDslFeature,
} from "./features/filterDslFeature"

export {
  filterBuilderUiFeature,
} from "./features/filterBuilderUiFeature"

export {
  columnPinningFeature,
} from "./features/columnPinningFeature"

export {
  columnVisibilityFeature,
} from "./features/columnVisibilityFeature"

export {
  columnAutosizeFeature,
} from "./features/columnAutosizeFeature"

export {
  columnMenuFeature,
} from "./features/columnMenuFeature"

export {
  columnResizeFeature,
} from "./features/columnResizeFeature"

export {
  columnReorderFeature,
} from "./features/columnReorderFeature"

export {
  columnVirtualizationFeature,
} from "./features/columnVirtualizationFeature"

export {
  cellEditorsFeature,
} from "./features/cellEditorsFeature"

export {
  serverSideRowModelFeature,
} from "./features/serverSideRowModelFeature"

export {
  rowHeightFeature,
} from "./features/rowHeightFeature"

export {
  rowSelectionModesFeature,
} from "./features/rowSelectionModesFeature"

export {
  selectionOverlayFeature,
} from "./features/selectionOverlayFeature"

export {
  dataExportFeature,
} from "./features/dataExportFeature"

export {
  exportExcelFeature,
} from "./features/exportExcelFeature"

export {
  rangeMoveFeature,
} from "./features/rangeMoveFeature"

export {
  pointerPreviewFeature,
} from "./features/pointerPreviewFeature"

export {
  autoScrollFeature,
} from "./features/autoScrollFeature"

export {
  resizeFeature,
} from "./features/resizeFeature"

export {
  keyboardFeature,
} from "./features/keyboardFeature"

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
  DataGrid,
  LegacyAffinoDataGrid,
  AffinoDataGridSimple,
} from "./components"

export type {
  DataGridOverlayTransform,
  DataGridOverlayTransformInput,
  DataGridAppearanceConfig,
  DataGridStyleConfig,
} from "./types"
