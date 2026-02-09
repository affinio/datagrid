/**
 * Stable public API for @affino/datagrid-vue.
 */
export {
  createDataGridSettingsAdapter,
} from "./piniaTableSettingsAdapter"

export {
  useDataGridSettingsStore,
  type DataGridSettingsStore,
} from "./tableSettingsStore"

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
} from "./composables/useTableOverlayScrollState"

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
  type UseDataGridRuntimeOptions,
  type UseDataGridRuntimeResult,
} from "./composables/useDataGridRuntime"

export {
  useAffinoDataGrid,
  type AffinoDataGridEditMode,
  type AffinoDataGridEditSession,
  type AffinoDataGridSelectionFeature,
  type AffinoDataGridClipboardFeature,
  type AffinoDataGridEditingFeature,
  type AffinoDataGridFeatures,
  type UseAffinoDataGridOptions,
  type UseAffinoDataGridResult,
} from "./composables/useAffinoDataGrid"

export {
  createDataGridVueRuntime,
  type CreateDataGridVueRuntimeOptions,
  type DataGridVueRuntime,
} from "./runtime/createDataGridVueRuntime"

export type {
  DataGridOverlayTransform,
  DataGridOverlayTransformInput,
} from "./types"
