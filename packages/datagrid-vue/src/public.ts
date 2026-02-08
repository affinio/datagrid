/**
 * Stable public API for @affino/datagrid-vue.
 * Component-level API will be exposed after contract hardening.
 */
export {
  createPiniaTableSettingsAdapter as createDataGridSettingsAdapter,
} from "./piniaTableSettingsAdapter"
export {
  useTableSettingsStore as useDataGridSettingsStore,
  type TableSettingsStore as DataGridSettingsStore,
} from "./tableSettingsStore"
export {
  buildSelectionOverlayTransform as buildDataGridOverlayTransform,
  buildSelectionOverlayTransformFromSnapshot as buildDataGridOverlayTransformFromSnapshot,
  type SelectionOverlayViewportState as DataGridOverlayViewportState,
} from "./composables/selectionOverlayTransform"
export {
  mapDataGridA11yGridAttributes,
  mapDataGridA11yCellAttributes,
  type DataGridDomAttributes,
  type DataGridDomAttributeValue,
} from "./adapters/a11yAttributesAdapter"
export type {
  DataGridOverlayTransformInput,
} from "./types/overlay"
