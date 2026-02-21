import type { DataGridColumnDef, DataGridColumnModel, DataGridColumnModelSnapshot, DataGridColumnPin, DataGridColumnSnapshot, DataGridClientRowPatch, DataGridClientRowPatchOptions, DataGridFilterSnapshot, DataGridSortAndFilterModelInput, DataGridGroupBySpec, DataGridGroupExpansionSnapshot, DataGridAggregationModel, DataGridPaginationInput, DataGridPaginationSnapshot, DataGridRowId, DataGridRowModel, DataGridRowModelSnapshot, DataGridRowNode, DataGridSortState, DataGridViewportRange } from "../models";
import type { DataGridSelectionSnapshot } from "../selection/snapshot";
import { type DataGridSelectionAggregationKind, type DataGridSelectionSummaryColumnConfig, type DataGridSelectionSummaryScope, type DataGridSelectionSummarySnapshot } from "../selection/selectionSummary";
import type { DataGridTransactionInput, DataGridTransactionSnapshot } from "./transactionService";
import type { DataGridCore, DataGridCoreSelectionService, DataGridCoreTransactionService, DataGridCoreViewportService } from "./gridCore";
export interface CreateDataGridApiFromCoreOptions {
    core: DataGridCore;
}
export interface CreateDataGridApiFromDepsOptions<TRow = unknown> {
    lifecycle: DataGridCore["lifecycle"];
    init(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    dispose(): Promise<void>;
    rowModel: DataGridRowModel<TRow>;
    columnModel: DataGridColumnModel;
    viewportService?: DataGridCoreViewportService | null;
    transactionService?: DataGridCoreTransactionService | null;
    selectionService?: DataGridCoreSelectionService | null;
}
/** @deprecated Use CreateDataGridApiFromDepsOptions instead. */
export type CreateDataGridApiDependencies<TRow = unknown> = CreateDataGridApiFromDepsOptions<TRow>;
export type CreateDataGridApiOptions<TRow = unknown> = CreateDataGridApiFromCoreOptions | CreateDataGridApiFromDepsOptions<TRow>;
export interface DataGridRefreshOptions {
    reset?: boolean;
}
export interface DataGridCellRefreshOptions {
    immediate?: boolean;
    reason?: string;
}
export interface DataGridApplyEditsOptions {
    emit?: boolean;
    reapply?: boolean;
}
export interface DataGridCellRefreshRange {
    rowKey: DataGridRowId;
    columnKeys: readonly string[];
}
export interface DataGridCellRefreshEntry {
    rowKey: DataGridRowId;
    rowIndex: number;
    columnKey: string;
    columnIndex: number;
    pin: DataGridColumnPin;
}
export interface DataGridCellsRefreshBatch {
    timestamp: number;
    reason?: string;
    cells: readonly DataGridCellRefreshEntry[];
}
export type DataGridCellsRefreshListener = (batch: DataGridCellsRefreshBatch) => void;
export interface DataGridApi<TRow = unknown> {
    readonly lifecycle: DataGridCore["lifecycle"];
    init(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    dispose(): Promise<void>;
    getRowModelSnapshot(): DataGridRowModelSnapshot<TRow>;
    getRowCount(): number;
    getRow(index: number): DataGridRowNode<TRow> | undefined;
    getRowsInRange(range: DataGridViewportRange): readonly DataGridRowNode<TRow>[];
    setViewportRange(range: DataGridViewportRange): void;
    getPaginationSnapshot(): DataGridPaginationSnapshot;
    setPagination(pagination: DataGridPaginationInput | null): void;
    setPageSize(pageSize: number | null): void;
    setCurrentPage(page: number): void;
    setSortModel(sortModel: readonly DataGridSortState[]): void;
    setFilterModel(filterModel: DataGridFilterSnapshot | null): void;
    setSortAndFilterModel(input: DataGridSortAndFilterModelInput): void;
    setGroupBy(groupBy: DataGridGroupBySpec | null): void;
    setAggregationModel(aggregationModel: DataGridAggregationModel<TRow> | null): void;
    getAggregationModel(): DataGridAggregationModel<TRow> | null;
    setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null): void;
    toggleGroup(groupKey: string): void;
    expandGroup(groupKey: string): void;
    collapseGroup(groupKey: string): void;
    expandAllGroups(): void;
    collapseAllGroups(): void;
    refresh(options?: DataGridRefreshOptions): Promise<void> | void;
    reapplyView(): Promise<void> | void;
    hasPatchSupport(): boolean;
    patchRows(updates: readonly DataGridClientRowPatch<TRow>[], options?: DataGridClientRowPatchOptions): void;
    applyEdits(updates: readonly DataGridClientRowPatch<TRow>[], options?: DataGridApplyEditsOptions): void;
    setAutoReapply(value: boolean): void;
    getAutoReapply(): boolean;
    refreshCellsByRowKeys(rowKeys: readonly DataGridRowId[], columnKeys: readonly string[], options?: DataGridCellRefreshOptions): void;
    refreshCellsByRanges(ranges: readonly DataGridCellRefreshRange[], options?: DataGridCellRefreshOptions): void;
    onCellsRefresh(listener: DataGridCellsRefreshListener): () => void;
    getColumnModelSnapshot(): DataGridColumnModelSnapshot;
    getColumn(key: string): DataGridColumnSnapshot | undefined;
    setColumns(columns: DataGridColumnDef[]): void;
    setColumnOrder(keys: readonly string[]): void;
    setColumnVisibility(key: string, visible: boolean): void;
    setColumnWidth(key: string, width: number | null): void;
    setColumnPin(key: string, pin: DataGridColumnPin): void;
    hasTransactionSupport(): boolean;
    getTransactionSnapshot(): DataGridTransactionSnapshot | null;
    beginTransactionBatch(label?: string): string;
    commitTransactionBatch(batchId?: string): Promise<readonly string[]>;
    rollbackTransactionBatch(batchId?: string): readonly string[];
    applyTransaction(transaction: DataGridTransactionInput): Promise<string>;
    canUndoTransaction(): boolean;
    canRedoTransaction(): boolean;
    undoTransaction(): Promise<string | null>;
    redoTransaction(): Promise<string | null>;
    hasSelectionSupport(): boolean;
    getSelectionSnapshot(): DataGridSelectionSnapshot | null;
    setSelectionSnapshot(snapshot: DataGridSelectionSnapshot): void;
    clearSelection(): void;
    summarizeSelection(options?: DataGridSelectionSummaryApiOptions<TRow>): DataGridSelectionSummarySnapshot | null;
}
export interface DataGridSelectionSummaryApiOptions<TRow = unknown> {
    /**
     * "selected-loaded" summarizes all selected cells that are currently materialized by the row model.
     * "selected-visible" limits summary to selected cells that intersect current viewportRange.
     */
    scope?: DataGridSelectionSummaryScope;
    columns?: readonly DataGridSelectionSummaryColumnConfig<TRow>[];
    defaultAggregations?: readonly DataGridSelectionAggregationKind[];
    getColumnKeyByIndex?: (columnIndex: number) => string | null | undefined;
}
export declare function createDataGridApi<TRow = unknown>(options: CreateDataGridApiOptions<TRow>): DataGridApi<TRow>;
//# sourceMappingURL=gridApi.d.ts.map