/**
 * Stable public API for @affino/datagrid-vue.
 * Component-level API will be exposed after contract hardening.
 */
export {
  createPiniaTableSettingsAdapter,
} from "./piniaTableSettingsAdapter"
export {
  useTableSettingsStore,
  type TableSettingsStore,
} from "./tableSettingsStore"
export {
  buildSelectionOverlayTransform,
  buildSelectionOverlayTransformFromSnapshot,
  type SelectionOverlayViewportState,
} from "./composables/selectionOverlayTransform"
export {
  mapDataGridA11yGridAttributes,
  mapDataGridA11yCellAttributes,
  type DataGridDomAttributes,
  type DataGridDomAttributeValue,
} from "./adapters/a11yAttributesAdapter"
export type {
  UiTableOverlayTransformInput as DataGridOverlayTransformInput,
} from "./types/overlay"
