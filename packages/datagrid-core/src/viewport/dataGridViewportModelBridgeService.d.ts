import type { DataGridColumn, VisibleRow } from "../types";
import type { DataGridColumnModel } from "../models/columnModel";
import type { DataGridRowModel, DataGridViewportRange } from "../models/rowModel";
export interface DataGridViewportModelBridgeServiceOptions<TRow = unknown> {
    initialRowModel?: DataGridRowModel<TRow> | null;
    initialColumnModel?: DataGridColumnModel | null;
    fallbackRowModel: DataGridRowModel<TRow>;
    fallbackColumnModel: DataGridColumnModel;
    onInvalidate: (invalidation: DataGridViewportModelBridgeInvalidation) => void;
    rowEntryCacheLimit?: number;
}
export type DataGridViewportModelBridgeInvalidationReason = "rows" | "columns" | "both";
export interface DataGridViewportModelBridgeInvalidation {
    reason: DataGridViewportModelBridgeInvalidationReason;
    scope: "structural" | "content";
    axes: {
        rows: boolean;
        columns: boolean;
    };
    rowRange: DataGridViewportRange | null;
}
export interface DataGridViewportModelBridgeService<TRow = unknown> {
    setRowModel(model: DataGridRowModel<TRow> | null | undefined): void;
    setColumnModel(model: DataGridColumnModel | null | undefined): void;
    getActiveRowModel(): DataGridRowModel<TRow>;
    getActiveColumnModel(): DataGridColumnModel;
    getRowCount(): number;
    getRow(index: number): VisibleRow | undefined;
    getRowsInRange(range: DataGridViewportRange): readonly VisibleRow[];
    materializeColumns(): DataGridColumn[];
    dispose(): void;
}
export declare function createDataGridViewportModelBridgeService<TRow = unknown>(options: DataGridViewportModelBridgeServiceOptions<TRow>): DataGridViewportModelBridgeService<TRow>;
//# sourceMappingURL=dataGridViewportModelBridgeService.d.ts.map