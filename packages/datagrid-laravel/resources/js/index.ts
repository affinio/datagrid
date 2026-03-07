/**
 * Stable public facade for Affino DataGrid in Laravel/Livewire integrations.
 * Consumers should prefer this package instead of importing datagrid-core and
 * datagrid-orchestration directly.
 */

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
  evaluateDataGridAdvancedFilterExpression,
  normalizeDataGridAdvancedFilterExpression,
} from "@affino/datagrid-core"

export {
  normalizePivotSpec,
  clonePivotSpec,
  isSamePivotSpec,
} from "@affino/datagrid-pivot"

export type {
  DataGridAggregationModel,
  DataGridAdvancedFilterExpression,
  DataGridAdvancedFilterCondition,
  DataGridColumnDef,
  DataGridColumnModelSnapshot,
  DataGridColumnPin,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridClientRowReorderInput,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridDataSource,
  DataGridDataSourcePullRequest,
  DataGridDataSourcePullResult,
  DataGridDataSourcePushEvent,
  DataGridDataSourcePushListener,
  DataGridDataSourcePivotPullContext,
  DataGridDataSourceRowEntry,
  DataGridServerPivotRowIdInput,
  DataGridServerPivotRowRole,
  ServerRowModel,
  ServerRowModelOptions,
  ServerRowModelFetchResult,
  DataGridPaginationSnapshot,
  DataGridProjectionDiagnostics,
  DataGridRowNode,
  DataGridSortState,
  DataGridViewportRange,
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

export {
  createDataGridRuntime,
  buildDataGridColumnLayers,
  resolveDataGridLayerTrackTemplate,
  useDataGridColumnLayoutOrchestration,
  useDataGridManagedWheelScroll,
  resolveDataGridHeaderLayerViewportGeometry,
  resolveDataGridHeaderScrollSyncLeft,
} from "@affino/datagrid-orchestration"

export type {
  DataGridColumnLayoutColumn,
  DataGridColumnLayoutMetric,
  DataGridColumnLayer,
  DataGridColumnLayerKey,
  DataGridVisibleColumnsWindow,
  DataGridManagedWheelBodyViewport,
  DataGridManagedWheelMainViewport,
  UseDataGridManagedWheelScrollOptions,
  UseDataGridManagedWheelScrollResult,
} from "@affino/datagrid-orchestration"
