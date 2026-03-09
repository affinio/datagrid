import type { Component } from "vue"
import DataGridComponent from "./DataGrid"

export const DataGrid: Component = DataGridComponent
export type {
  DataGridAppColumnDef,
  DataGridDeclarativeFormulaOptions,
} from "./dataGridFormulaOptions"
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

export { default } from "./DataGrid"
