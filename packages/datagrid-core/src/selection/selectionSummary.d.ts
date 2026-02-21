import type { DataGridRowNode } from "../models/rowModel.js";
import type { DataGridSelectionSnapshot } from "./snapshot.js";
export type DataGridSelectionAggregationKind = "count" | "countDistinct" | "sum" | "avg" | "min" | "max";
export interface DataGridSelectionSummaryColumnConfig<TRow = unknown> {
    key: string;
    aggregations?: readonly DataGridSelectionAggregationKind[];
    valueGetter?: (rowNode: DataGridRowNode<TRow>) => unknown;
}
export interface DataGridSelectionSummaryColumnSnapshot {
    key: string;
    selectedCellCount: number;
    metrics: Record<DataGridSelectionAggregationKind, number | null>;
}
export type DataGridSelectionSummaryScope = "selected-loaded" | "selected-visible";
export interface DataGridSelectionSummarySnapshot {
    scope: DataGridSelectionSummaryScope;
    isPartial: boolean;
    missingRowCount: number;
    selectedCells: number;
    selectedRows: number;
    columns: Record<string, DataGridSelectionSummaryColumnSnapshot>;
}
export interface CreateDataGridSelectionSummaryOptions<TRow = unknown> {
    selection: DataGridSelectionSnapshot | null;
    rowCount: number;
    getRow: (rowIndex: number) => DataGridRowNode<TRow> | undefined;
    getColumnKeyByIndex: (columnIndex: number) => string | null | undefined;
    columns?: readonly DataGridSelectionSummaryColumnConfig<TRow>[];
    defaultAggregations?: readonly DataGridSelectionAggregationKind[];
    scope?: DataGridSelectionSummaryScope;
    includeRowIndex?: (rowIndex: number) => boolean;
}
export declare function createDataGridSelectionSummary<TRow = unknown>(options: CreateDataGridSelectionSummaryOptions<TRow>): DataGridSelectionSummarySnapshot;
//# sourceMappingURL=selectionSummary.d.ts.map