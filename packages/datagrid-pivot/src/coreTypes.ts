import type { DataGridAggOp } from "./contracts.js"

export type DataGridRowId = string | number

export type DataGridSortDirection = "asc" | "desc"

export interface DataGridSortState {
  key: string
  field?: string
  dependencyFields?: readonly string[]
  direction: DataGridSortDirection
}

export interface DataGridFilterClause {
  operator: string
  value: unknown
  value2?: unknown
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

export interface DataGridSortAndFilterModelInput {
  sortModel: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
}

export interface DataGridGroupBySpec {
  fields: string[]
  expandedByDefault?: boolean
}

export interface DataGridGroupExpansionSnapshot {
  expandedByDefault: boolean
  toggledGroupKeys: readonly string[]
}

export type DataGridColumnPin = "left" | "right" | "none"

type DataGridAggregationStateHandler<TState, TArgs extends readonly unknown[] = readonly [], TResult = void> = {
  bivarianceHack(state: TState, ...args: TArgs): TResult
}["bivarianceHack"]

export interface DataGridAggregationColumnSpec<T = unknown, TState = unknown> {
  key: string
  field?: string
  op: DataGridAggOp
  createState?: () => TState
  add?: DataGridAggregationStateHandler<TState, [value: unknown, row: DataGridRowNode<T>]>
  merge?: DataGridAggregationStateHandler<TState, [childState: TState]>
  remove?: DataGridAggregationStateHandler<TState, [value: unknown, row: DataGridRowNode<T>]>
  finalize?: DataGridAggregationStateHandler<TState, [], unknown>
  coerce?: (value: unknown) => number | string | null
}

export type DataGridAggregationColumnSpecAnyState<T = unknown> = DataGridAggregationColumnSpec<T, unknown>

export interface DataGridAggregationModel<T = unknown> {
  columns: readonly DataGridAggregationColumnSpecAnyState<T>[]
  basis?: "filtered" | "source"
}

export type DataGridAggregationFieldReader<T = unknown> = (
  rowNode: DataGridRowNode<T>,
  key: string,
  field: string,
) => unknown

export type DataGridIncrementalAggregationLeafContribution = Record<string, unknown>

export type DataGridRowKind = "leaf" | "group"

export type DataGridRowPinState = "none" | "top" | "bottom"

export interface DataGridRowGroupMeta {
  groupKey: string
  groupField: string
  groupValue: string
  level: number
  childrenCount: number
  aggregates?: Record<string, unknown>
}

export interface DataGridRowNodeState {
  selected: boolean
  group: boolean
  pinned: DataGridRowPinState
  expanded: boolean
}

export interface DataGridRowNode<T = unknown> {
  kind: DataGridRowKind
  data: T
  row: T
  rowKey: DataGridRowId
  rowId: DataGridRowId
  sourceIndex: number
  originalIndex: number
  displayIndex: number
  state: DataGridRowNodeState
  groupMeta?: DataGridRowGroupMeta
}

export interface DataGridPivotLayoutColumnModelColumnSnapshot {
  key: string
  visible: boolean
  width: number | null
  pin: DataGridColumnPin
}

export interface DataGridPivotLayoutColumnModelSnapshot {
  columns: readonly DataGridPivotLayoutColumnModelColumnSnapshot[]
  order: readonly string[]
}

export interface DataGridPivotLayoutColumnModel {
  getSnapshot(): DataGridPivotLayoutColumnModelSnapshot
  batch?<TResult>(fn: () => TResult): TResult
  setColumnOrder(order: readonly string[]): void
  setColumnVisibility(key: string, visible: boolean): void
  setColumnWidth(key: string, width: number | null): void
  setColumnPin(key: string, pin: DataGridColumnPin): void
}

export interface DataGridPivotLayoutRowModelSnapshot {
  rowCount: number
  sortModel: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
  groupBy: DataGridGroupBySpec | null
  groupExpansion: DataGridGroupExpansionSnapshot | null
  pivotColumns?: readonly import("./contracts.js").DataGridPivotColumn[]
}

export interface DataGridPivotLayoutRowModel<TRow = unknown> {
  getSnapshot(): DataGridPivotLayoutRowModelSnapshot
  getPivotModel(): import("./contracts.js").DataGridPivotSpec | null
  getAggregationModel(): DataGridAggregationModel<TRow> | null
  getRowsInRange(range: { start: number; end: number }): readonly DataGridRowNode<TRow>[]
  setFilterModel(filterModel: DataGridFilterSnapshot | null): void
  setSortModel(sortModel: readonly DataGridSortState[]): void
  setGroupBy(groupBy: DataGridGroupBySpec | null): void
  setPivotModel(pivotModel: import("./contracts.js").DataGridPivotSpec | null): void
  setAggregationModel(aggregationModel: DataGridAggregationModel<TRow> | null): void
  setGroupExpansion(groupExpansion: DataGridGroupExpansionSnapshot | null): void
}
