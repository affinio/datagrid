import type { Component } from "vue"
import DataGridComponent from "./DataGrid"

export const DataGrid: Component = DataGridComponent
export type {
  DataGridAppColumnInput,
  DataGridDeclarativeFormulaOptions,
} from "./dataGridFormulaOptions"
export type {
  DataGridThemePreset,
  DataGridThemeProp,
} from "./dataGridTheme"
export type {
  DataGridGroupByProp,
  DataGridPaginationProp,
} from "./dataGridPublicProps"
export type {
  DataGridVirtualizationOptions,
  DataGridVirtualizationProp,
} from "./dataGridVirtualization"
export type {
  DataGridClientComputeMode,
  DataGridComputedFieldDefinition,
  DataGridFormulaFieldDefinition,
  DataGridFormulaFunctionRegistry,
} from "@affino/datagrid-vue"
export type {
  DataGridStyleConfig,
  DataGridThemeTokens,
} from "@affino/datagrid-theme"

export { default } from "./DataGrid"
