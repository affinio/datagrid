import type { DataGridColumn, DataGridColumnGroupDef } from "./column"
import type { DataGridPluginDefinition } from "@affino/datagrid-plugins"
import type { DataGridSettingsAdapter } from "../dataGridSettingsAdapter"

export type {
  DataGridColumn,
  DataGridColumnAlignment,
  DataGridColumnEditor,
  DataGridColumnPin,
  DataGridColumnGroupDef,
} from "./column"
export type { DataGridSettingsAdapter } from "../dataGridSettingsAdapter"

export type DataGridRowId = string | number

export type DataGridLazyLoadReason =
  | "mount"
  | "scroll"
  | "manual"
  | "filter-change"
  | "sort-change"
  | "refresh"

export interface DataGridLazyLoadContext {
  page: number
  pageSize: number
  offset: number
  totalLoaded: number
  reason: DataGridLazyLoadReason
  sorts?: DataGridSortState[]
  filters?: DataGridFilterSnapshot | null
  mode?: "page" | "block"
  signal?: AbortSignal
  background?: boolean
  blockSize?: number
}

export interface DataGridServerLoadResult<T = any> {
  rows: T[]
  total?: number
}

export type DataGridLazyLoader = (
  context: DataGridLazyLoadContext
) =>
  | Promise<void | DataGridServerLoadResult | any[]>
  | void
  | DataGridServerLoadResult
  | any[]

export type DataGridSortDirection = "asc" | "desc"

export interface DataGridSortState {
  key: string
  field?: string
  direction: DataGridSortDirection
}

export interface DataGridFilterClause {
  operator: string
  value: any
  value2?: any
  join?: "and" | "or"
}

export interface DataGridAdvancedFilter {
  type: "text" | "number" | "date" | "set"
  clauses: DataGridFilterClause[]
}

export type DataGridAdvancedFilterConditionType =
  | "text"
  | "number"
  | "date"
  | "set"
  | "boolean"

export interface DataGridAdvancedFilterCondition {
  kind: "condition"
  key: string
  field?: string
  type?: DataGridAdvancedFilterConditionType
  operator: string
  value?: unknown
  value2?: unknown
}

export interface DataGridAdvancedFilterGroup {
  kind: "group"
  operator: "and" | "or"
  children: DataGridAdvancedFilterExpression[]
}

export interface DataGridAdvancedFilterNot {
  kind: "not"
  child: DataGridAdvancedFilterExpression
}

export type DataGridAdvancedFilterExpression =
  | DataGridAdvancedFilterCondition
  | DataGridAdvancedFilterGroup
  | DataGridAdvancedFilterNot

export interface DataGridColumnValueSetFilter {
  kind: "valueSet"
  tokens: string[]
}

export type DataGridColumnPredicateOperator =
  | "contains"
  | "startsWith"
  | "endsWith"
  | "equals"
  | "notEquals"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "isEmpty"
  | "notEmpty"
  | "isNull"
  | "notNull"

export interface DataGridColumnPredicateFilter {
  kind: "predicate"
  operator: DataGridColumnPredicateOperator
  value?: unknown
  value2?: unknown
  caseSensitive?: boolean
}

export type DataGridColumnFilter =
  | DataGridColumnValueSetFilter
  | DataGridColumnPredicateFilter

export type DataGridColumnFilterSnapshotEntry = DataGridColumnFilter

export interface DataGridFilterSnapshot {
  columnFilters: Record<string, DataGridColumnFilterSnapshotEntry>
  advancedFilters: Record<string, DataGridAdvancedFilter>
  advancedExpression?: DataGridAdvancedFilterExpression | null
}

export interface DataGridServerFilterOptionRequest {
  columnKey: string
  search: string
  filters: DataGridFilterSnapshot | null
  limit?: number
}

export interface DataGridServerFilterOption {
  value: unknown
  label?: string
  count?: number
}

export type DataGridFilterOptionLoader = (
  context: DataGridServerFilterOptionRequest
) => Promise<DataGridServerFilterOption[]> | DataGridServerFilterOption[]


export interface CellEditEvent<T = any> {
  rowId: DataGridRowId
  rowIndex: number
  key: keyof T | string
  value: unknown
  originalRowIndex?: number
  displayRowIndex?: number
  row?: T
}

export interface DataGridSelectionPoint {
  rowId: DataGridRowId | null
  rowIndex: number
  colIndex: number
}

export interface DataGridSelectionRangeInput {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
  anchor?: DataGridSelectionPoint
  focus?: DataGridSelectionPoint
}

export interface DataGridSelectionSnapshotRange extends DataGridSelectionRangeInput {
  anchor: DataGridSelectionPoint
  focus: DataGridSelectionPoint
  startRowId?: DataGridRowId | null
  endRowId?: DataGridRowId | null
}

export interface DataGridSelectionSnapshot {
  ranges: DataGridSelectionSnapshotRange[]
  activeRangeIndex: number
  activeCell: DataGridSelectionPoint | null
  clone(): DataGridSelectionSnapshot
}

export interface DataGridSelectedCell<T = any> {
  rowId: DataGridRowId
  rowIndex: number
  colIndex: number
  columnKey: string
  value: unknown
  row?: T
}

export interface DataGridSelectionMetricContext<T = any> {
  cells: DataGridSelectedCell<T>[]
  cellCount: number
  numericValues: number[]
  numericCount: number
  sum: number | null
  min: number | null
  max: number | null
  average: number | null
}

export interface DataGridSelectionMetricFormatterPayload<T = any> {
  id: string
  label: string
  value: number | null
  context: DataGridSelectionMetricContext<T>
}

export interface DataGridSelectionMetricDefinition<T = any> {
  id: string
  label?: string
  precision?: number
  compute?: (context: DataGridSelectionMetricContext<T>) => number | null | undefined
  formatter?: (payload: DataGridSelectionMetricFormatterPayload<T>) => string
}

export interface DataGridSelectionMetricResult {
  id: string
  label: string
  value: number | null
  displayValue: string
}

export type DataGridSelectionMetricsProp<T = any> =
  | boolean
  | DataGridSelectionMetricDefinition<T>[]
  | {
      enabled?: boolean
      metrics?: DataGridSelectionMetricDefinition<T>[]
    }

export interface DataGridSelectionMetricsConfig<T = any> {
  enabled: boolean
  metrics: DataGridSelectionMetricDefinition<T>[]
}

export interface VisibleRow<T = any> {
  row: T
  rowId: DataGridRowId
  originalIndex: number
  displayIndex?: number
  stickyTop?: boolean | number
  stickyBottom?: boolean | number
}

export interface DataGridRowClickEvent<T = any> {
  row: T
  rowId: DataGridRowId
  rowIndex: number
  displayIndex?: number
  originalIndex?: number
}

export interface DataGridEventHandlers<T = any> {
  reachBottom?: () => void
  rowClick?: (payload: DataGridRowClickEvent<T>) => void
  cellEdit?: (event: CellEditEvent<T>) => void
  batchEdit?: (events: CellEditEvent<T>[]) => void
  selectionChange?: (snapshot: DataGridSelectionSnapshot) => void
  sortChange?: (state: DataGridSortState | null) => void
  filterChange?: (filters: Record<string, string[]>) => void
  filtersReset?: () => void
  groupByChange?: (
    groupBy: { fields: string[]; expandedByDefault?: boolean } | null,
    groupExpansion: { expandedByDefault: boolean; toggledGroupKeys: readonly string[] },
  ) => void
  groupExpansionChange?: (
    groupExpansion: { expandedByDefault: boolean; toggledGroupKeys: readonly string[] },
    groupBy: { fields: string[]; expandedByDefault?: boolean } | null,
  ) => void
  zoomChange?: (value: number) => void
  columnResize?: (payload: { key: string; width: number }) => void
  groupFilterToggle?: (open: boolean) => void
  rowsDelete?: (rows: unknown) => void
  lazyLoad?: (context: DataGridLazyLoadContext) => void
  lazyLoadComplete?: (context: DataGridLazyLoadContext) => void
  lazyLoadError?: (context: DataGridLazyLoadContext & { error: unknown }) => void
  autoResizeApplied?: (payload: { columns: string[]; shareWidth: number; viewportWidth: number }) => void
  selectAllRequest?: (payload: DataGridSelectAllRequestPayload) => void
}

export interface DataGridSelectAllRequestPayload {
  checked: boolean
  filters: DataGridFilterSnapshot | null
  sorts: DataGridSortState[]
  selection: {
    allSelected: boolean
    isIndeterminate: boolean
    selectedRowKeys: Array<string | number>
    visibleRowCount: number
    totalRowCount: number | null
  }
}

export interface DataGridSelectionConfig<T = any> {
  enabled?: boolean
  mode?: "cell" | "row"
  showSelectionColumn?: boolean
  selected?: (T | string | number)[]
}

export interface DataGridFeatureConfig<T = any> {
  inlineControls?: boolean
  hoverable?: boolean
  rowIndexColumn?: boolean
  zoom?: boolean
  selection?: DataGridSelectionConfig<T>
  selectionMetrics?: DataGridSelectionMetricsProp<T>
}

export interface DataGridAppearanceConfig {
  rowHeightMode?: "fixed" | "auto"
  rowHeight?: number
}

export interface DataGridLoadConfig {
  hasMore?: boolean
  pageSize?: number
  autoLoadOnScroll?: boolean
  loadOnMount?: boolean
  lazyLoader?: DataGridLazyLoader
  serverSideModel?: boolean
  filterOptionLoader?: DataGridFilterOptionLoader
}

export interface DataGridDebugConfig {
  viewport?: boolean
}

export interface DataGridDataConfig<T = any> {
  rows?: T[]
  totalRows?: number
  summaryRow?: Record<string, any> | null
}

export interface DataGridColumnConfig {
  definitions?: DataGridColumn[]
  groups?: DataGridColumnGroupDef[]
}

export interface DataGridStateConfig<T = any> {
  selected?: (T | string | number)[]
  loading?: boolean
}

export interface DataGridConfig<T = any> {
  tableId?: string
  data?: DataGridDataConfig<T>
  columns?: DataGridColumnConfig
  features?: DataGridFeatureConfig<T>
  appearance?: DataGridAppearanceConfig
  load?: DataGridLoadConfig
  debug?: DataGridDebugConfig
  state?: DataGridStateConfig<T>
  selection?: DataGridSelectionConfig<T>
  selectionMetrics?: DataGridSelectionMetricsProp<T>
  plugins?: DataGridPluginDefinition[]
  defaultSort?: DataGridSortState | null
  events?: DataGridEventHandlers<T>
  settingsAdapter?: DataGridSettingsAdapter
}
