import type { Component } from "vue"
import DataGridComponent from "./DataGrid"

export const DataGrid: Component = DataGridComponent
export type {
  DataGridAppColumnInput,
  DataGridDeclarativeFormulaOptions,
} from "./config/dataGridFormulaOptions"
export type {
  DataGridCellEditablePredicate,
  DataGridCellEditablePredicateContext,
} from "./dataGridEditability"
export type {
  DataGridThemePreset,
  DataGridThemeProp,
} from "./theme/dataGridTheme"
export type {
  DataGridAdvancedFilterOptions,
  DataGridAdvancedFilterProp,
} from "./config/dataGridAdvancedFilter"
export type {
  DataGridColumnLayoutOptions,
  DataGridColumnLayoutProp,
} from "./config/dataGridColumnLayout"
export type {
  DataGridAggregationsOptions,
  DataGridAggregationsProp,
} from "./config/dataGridAggregations"
export type {
  DataGridColumnMenuOptions,
  DataGridColumnMenuProp,
} from "./overlays/dataGridColumnMenu"
export type {
  DataGridGroupByProp,
  DataGridPaginationProp,
} from "./config/dataGridPublicProps"
export type {
  DataGridVirtualizationOptions,
  DataGridVirtualizationProp,
} from "./config/dataGridVirtualization"
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
} from "./gantt/dataGridGantt"

export { default } from "./DataGrid"
