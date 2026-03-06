import type { Component } from "vue"
import { DataGrid } from "./DataGrid"
import AffinoDataGridSimpleComponent from "./AffinoDataGridSimple"

export { DataGrid }
export const AffinoDataGridSimple: Component = AffinoDataGridSimpleComponent
export const LegacyAffinoDataGrid: Component = AffinoDataGridSimpleComponent

export { default as GridHeader } from "./GridHeader.vue"
export { default as GridBody } from "./GridBody.vue"
export { default as GridRow } from "./GridRow.vue"
export { default as GridCell } from "./GridCell.vue"
export { default as GridFeaturePanels } from "./GridFeaturePanels.vue"
export { default as GridColumnMenu } from "./GridColumnMenu.vue"
