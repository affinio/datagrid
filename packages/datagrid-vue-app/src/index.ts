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
  DataGridAdvancedFilterOptions,
  DataGridAdvancedFilterProp,
} from "./dataGridAdvancedFilter"
export type {
  DataGridColumnLayoutOptions,
  DataGridColumnLayoutProp,
} from "./dataGridColumnLayout"
export type {
  DataGridAggregationsOptions,
  DataGridAggregationsProp,
} from "./dataGridAggregations"
export type {
  DataGridColumnMenuOptions,
  DataGridColumnMenuProp,
} from "./dataGridColumnMenu"
export type {
  DataGridGroupByProp,
  DataGridPaginationProp,
} from "./dataGridPublicProps"
export type {
  DataGridVirtualizationOptions,
  DataGridVirtualizationProp,
} from "./dataGridVirtualization"
export type {
  DataGridAppViewMode,
  DataGridGanttDependencyRef,
  DataGridGanttDependencyType,
  DataGridGanttOptions,
  DataGridGanttProp,
  DataGridGanttZoomLevel,
  DataGridResolvedWorkingCalendar,
  DataGridTimelineHorizontalAlign,
  DataGridTimelineLine,
  DataGridTimelineModel,
  DataGridTimelineRange,
  DataGridTimelineRenderModels,
  DataGridTimelineSegment,
  DataGridTimelineSpan,
  DataGridTimelineViewport,
  DataGridWorkingCalendar,
  BuildDataGridTimelineRenderModelsInput,
  ResolveDataGridTimelineRangeInput,
} from "./dataGridGantt"
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
