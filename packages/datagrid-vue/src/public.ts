/**
 * Stable public API for @affino/datagrid-vue.
 */

// Curated core facade exports so Vue consumers can stay on @affino/datagrid-vue
// for common configuration/state/filter/sort/row-model typing and helper functions.
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
  CreateDataGridCoreOptions,
  DataGridAggregationModel,
  DataGridAdvancedFilterExpression,
  DataGridAdvancedFilterCondition,
  DataGridColumnModel,
  DataGridColumnDef,
  DataGridColumnModelSnapshot,
  DataGridColumnPin,
  DataGridColumnSnapshot,
  DataGridColumnStateSnapshot,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridClientRowReorderInput,
  DataGridCoreServiceContext,
  DataGridEventEnvelope,
  DataGridEventPhase,
  DataGridEventSource,
  DataGridEventTier,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridPaginationSnapshot,
  DataGridProjectionDiagnostics,
  DataGridRowId,
  DataGridRowModel,
  DataGridRowNode,
  DataGridSettingsAdapter,
  DataGridSelectionAggregationKind,
  DataGridSelectionSummaryColumnConfig,
  DataGridSelectionSummarySnapshot,
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
  AffinoDataGridSimple,
} from "./components"

export type {
  DataGridOverlayTransform,
  DataGridOverlayTransformInput,
  DataGridAppearanceConfig,
  DataGridStyleConfig,
} from "./types"
