import type {
  DataGridAggregationModel,
  DataGridColumnDef,
  DataGridColumnHistogram,
  DataGridColumnHistogramOptions,
  DataGridColumnModelSnapshot,
  DataGridColumnPin,
  DataGridColumnSnapshot,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridPaginationSnapshot,
  DataGridPivotCellDrilldown,
  DataGridPivotCellDrilldownInput,
  DataGridPivotSpec,
  DataGridRowId,
  DataGridRowModelSnapshot,
  DataGridRowNode,
  DataGridSortAndFilterModelInput,
  DataGridSortState,
  DataGridViewportRange,
} from "../models"
import type { DataGridSelectionSnapshot } from "../selection/snapshot"
import type {
  DataGridSelectionAggregationKind,
  DataGridSelectionSummaryColumnConfig,
  DataGridSelectionSummaryScope,
  DataGridSelectionSummarySnapshot,
} from "../selection/selectionSummary"
import type {
  DataGridCellRefreshOptions,
  DataGridCellRefreshRange,
  DataGridCellsRefreshListener,
} from "./gridApiCellRefresh"
import type {
  DataGridPivotLayoutImportOptions,
  DataGridPivotLayoutSnapshot,
  DataGridPivotInteropSnapshot,
} from "./gridApiPivotLayout"
import type { DataGridCore } from "./gridCore"
import type {
  DataGridTransactionInput,
  DataGridTransactionSnapshot,
} from "./transactionService"

export interface DataGridRefreshOptions {
  reset?: boolean
}

export interface DataGridApplyEditsOptions {
  emit?: boolean
  reapply?: boolean
}

export interface DataGridApiPivotNamespace<TRow = unknown> {
  setModel(pivotModel: DataGridPivotSpec | null): void
  getModel(): DataGridPivotSpec | null
  getCellDrilldown(input: DataGridPivotCellDrilldownInput): DataGridPivotCellDrilldown<TRow> | null
  exportLayout(): DataGridPivotLayoutSnapshot<TRow>
  exportInterop(): DataGridPivotInteropSnapshot<TRow> | null
  importLayout(
    layout: DataGridPivotLayoutSnapshot<TRow>,
    options?: DataGridPivotLayoutImportOptions,
  ): void
}

export interface DataGridApiSelectionNamespace<TRow = unknown> {
  hasSupport(): boolean
  getSnapshot(): DataGridSelectionSnapshot | null
  setSnapshot(snapshot: DataGridSelectionSnapshot): void
  clear(): void
  summarize(options?: DataGridSelectionSummaryApiOptions<TRow>): DataGridSelectionSummarySnapshot | null
}

export interface DataGridApiTransactionNamespace {
  hasSupport(): boolean
  getSnapshot(): DataGridTransactionSnapshot | null
  beginBatch(label?: string): string
  commitBatch(batchId?: string): Promise<readonly string[]>
  rollbackBatch(batchId?: string): readonly string[]
  apply(transaction: DataGridTransactionInput): Promise<string>
  canUndo(): boolean
  canRedo(): boolean
  undo(): Promise<string | null>
  redo(): Promise<string | null>
}

export interface DataGridApiRowsNamespace<TRow = unknown> {
  getSnapshot(): DataGridRowModelSnapshot<TRow>
  getCount(): number
  get(index: number): DataGridRowNode<TRow> | undefined
  getRange(range: DataGridViewportRange): readonly DataGridRowNode<TRow>[]
  getPagination(): DataGridPaginationSnapshot
  setPagination(pagination: DataGridPaginationInput | null): void
  setPageSize(pageSize: number | null): void
  setCurrentPage(page: number): void
  setSortModel(sortModel: readonly DataGridSortState[]): void
  setFilterModel(filterModel: DataGridFilterSnapshot | null): void
  setSortAndFilterModel(input: DataGridSortAndFilterModelInput): void
  setGroupBy(groupBy: DataGridGroupBySpec | null): void
  setAggregationModel(aggregationModel: DataGridAggregationModel<TRow> | null): void
  getAggregationModel(): DataGridAggregationModel<TRow> | null
  setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null): void
  toggleGroup(groupKey: string): void
  expandGroup(groupKey: string): void
  collapseGroup(groupKey: string): void
  expandAllGroups(): void
  collapseAllGroups(): void
  hasPatchSupport(): boolean
  patch(
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridClientRowPatchOptions,
  ): void
  applyEdits(
    updates: readonly DataGridClientRowPatch<TRow>[],
    options?: DataGridApplyEditsOptions,
  ): void
  setAutoReapply(value: boolean): void
  getAutoReapply(): boolean
}

export interface DataGridApiColumnsNamespace {
  getSnapshot(): DataGridColumnModelSnapshot
  get(key: string): DataGridColumnSnapshot | undefined
  setAll(columns: DataGridColumnDef[]): void
  setOrder(keys: readonly string[]): void
  setVisibility(key: string, visible: boolean): void
  setWidth(key: string, width: number | null): void
  setPin(key: string, pin: DataGridColumnPin): void
  getHistogram(columnId: string, options?: DataGridColumnHistogramOptions): DataGridColumnHistogram
}

export interface DataGridApiViewNamespace {
  setViewportRange(range: DataGridViewportRange): void
  refresh(options?: DataGridRefreshOptions): Promise<void> | void
  reapply(): Promise<void> | void
  expandAllGroups(): void
  collapseAllGroups(): void
  refreshCellsByRowKeys(
    rowKeys: readonly DataGridRowId[],
    columnKeys: readonly string[],
    options?: DataGridCellRefreshOptions,
  ): void
  refreshCellsByRanges(
    ranges: readonly DataGridCellRefreshRange[],
    options?: DataGridCellRefreshOptions,
  ): void
  onCellsRefresh(listener: DataGridCellsRefreshListener): () => void
}

export interface DataGridApiCapabilities {
  readonly patch: boolean
  readonly selection: boolean
  readonly transaction: boolean
  readonly histogram: boolean
  readonly sortFilterBatch: boolean
}

export interface DataGridApi<TRow = unknown> {
  readonly lifecycle: DataGridCore["lifecycle"]
  readonly capabilities: DataGridApiCapabilities
  readonly pivot: DataGridApiPivotNamespace<TRow>
  readonly selection: DataGridApiSelectionNamespace<TRow>
  readonly transaction: DataGridApiTransactionNamespace
  readonly rows: DataGridApiRowsNamespace<TRow>
  readonly columns: DataGridApiColumnsNamespace
  readonly view: DataGridApiViewNamespace
  init(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  dispose(): Promise<void>
}

export interface DataGridSelectionSummaryApiOptions<TRow = unknown> {
  /**
   * "selected-loaded" summarizes all selected cells that are currently materialized by the row model.
   * "selected-visible" limits summary to selected cells that intersect current viewportRange.
   */
  scope?: DataGridSelectionSummaryScope
  columns?: readonly DataGridSelectionSummaryColumnConfig<TRow>[]
  defaultAggregations?: readonly DataGridSelectionAggregationKind[]
  getColumnKeyByIndex?: (columnIndex: number) => string | null | undefined
}
