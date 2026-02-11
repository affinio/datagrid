/**
 * Stable public API for @affino/datagrid-vue.
 */
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
} from "./composables/useAffinoDataGrid"

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
} from "./types"
