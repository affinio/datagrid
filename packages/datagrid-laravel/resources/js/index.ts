/**
 * Stable public facade for Affino DataGrid in Laravel/Livewire integrations.
 * Consumers should prefer this package instead of importing datagrid-core and
 * datagrid-orchestration directly.
 */

export {
  createClientRowModel,
  createDataGridColumnModel,
  createDataGridSelectionSummary,
  createInMemoryDataGridSettingsAdapter,
  buildDataGridAdvancedFilterExpressionFromLegacyFilters,
  cloneDataGridFilterSnapshot,
  evaluateDataGridAdvancedFilterExpression,
  normalizeDataGridAdvancedFilterExpression,
} from "@affino/datagrid-core"

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
  DataGridPaginationSnapshot,
  DataGridProjectionDiagnostics,
  DataGridRowNode,
  DataGridSortState,
  DataGridViewportRange,
} from "@affino/datagrid-core"

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
