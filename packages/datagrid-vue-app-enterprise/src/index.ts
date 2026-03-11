import type { Component } from "vue"
import DataGridComponent from "./DataGrid"

export const DataGrid: Component = DataGridComponent
export type {
  DataGridAppColumnInput,
  DataGridDeclarativeFormulaOptions,
} from "@affino/datagrid-vue-app"
export type {
  DataGridThemePreset,
  DataGridThemeProp,
} from "@affino/datagrid-vue-app"
export type {
  DataGridAdvancedFilterOptions,
  DataGridAdvancedFilterProp,
} from "@affino/datagrid-vue-app"
export type {
  DataGridColumnLayoutOptions,
  DataGridColumnLayoutProp,
} from "@affino/datagrid-vue-app"
export type {
  DataGridAggregationsOptions,
  DataGridAggregationsProp,
} from "@affino/datagrid-vue-app"
export type {
  DataGridColumnMenuOptions,
  DataGridColumnMenuProp,
} from "@affino/datagrid-vue-app"
export type {
  DataGridGroupByProp,
  DataGridPaginationProp,
} from "@affino/datagrid-vue-app"
export type {
  DataGridVirtualizationOptions,
  DataGridVirtualizationProp,
} from "@affino/datagrid-vue-app"
export type {
  DataGridClientComputeMode,
  DataGridComputedFieldDefinition,
  DataGridFormulaFieldDefinition,
  DataGridFormulaFunctionRegistry,
} from "@affino/datagrid-vue-app"
export type {
  DataGridStyleConfig,
  DataGridThemeTokens,
} from "@affino/datagrid-vue-app"
export type {
  DataGridDiagnosticsOptions,
  DataGridDiagnosticsProp,
} from "./dataGridDiagnostics"
export type {
  AffinoDataGridEnterpriseLicenseSummary,
  AffinoDataGridEnterpriseLicenseClaims,
  AffinoDataGridEnterpriseLicenseFeature,
  ResolvedAffinoDataGridEnterpriseLicense,
} from "./dataGridEnterpriseLicense"
export type {
  DataGridPerformanceOptions,
  DataGridPerformancePresetName,
  DataGridPerformanceProp,
} from "./dataGridPerformance"
export type {
  DataGridEnterpriseFormulaPackName,
} from "@affino/datagrid-formula-engine-enterprise"
export type {
  DataGridFormulaPacksOptions,
  DataGridFormulaPacksProp,
} from "./dataGridFormulaPacks"
export type {
  DataGridFormulaRuntimeOptions,
  DataGridFormulaRuntimeProp,
} from "./dataGridFormulaRuntime"
export {
  provideAffinoDataGridEnterpriseLicense,
  resolveAffinoDataGridEnterpriseLicense,
  summarizeAffinoDataGridEnterpriseLicense,
} from "./dataGridEnterpriseLicense"

export { default } from "./DataGrid"
