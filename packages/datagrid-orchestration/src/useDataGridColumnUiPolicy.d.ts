import type { DataGridColumnSnapshot } from "@affino/datagrid-core";
export type DataGridColumnFilterKind = "text" | "enum" | "number";
export interface UseDataGridColumnUiPolicyOptions<TRow, TGroupBy extends string = string> {
    resolveCurrentGroupBy: () => TGroupBy | "none" | null | undefined;
    isEnumColumn: (columnKey: string) => boolean;
    resolveEnumEditorOptions: (columnKey: string) => readonly string[] | null | undefined;
    resolveRows: () => readonly TRow[];
    resolveCellValue: (row: TRow, columnKey: string) => unknown;
    numericColumnKeys: ReadonlySet<string>;
    selectColumnKey?: string;
    selectColumnMinWidth?: number;
    selectColumnDefaultWidth?: number;
    defaultColumnMinWidth?: number;
    defaultColumnWidth?: number;
}
export interface UseDataGridColumnUiPolicyResult {
    isGroupedByColumn: (columnKey: string) => boolean;
    isSortableColumn: (columnKey: string) => boolean;
    isColumnResizable: (columnKey: string) => boolean;
    resolveColumnFilterKind: (columnKey: string) => DataGridColumnFilterKind;
    resolveEnumFilterOptions: (columnKey: string) => string[];
    resolveColumnWidth: (column: DataGridColumnSnapshot) => number;
}
export declare function useDataGridColumnUiPolicy<TRow, TGroupBy extends string = string>(options: UseDataGridColumnUiPolicyOptions<TRow, TGroupBy>): UseDataGridColumnUiPolicyResult;
//# sourceMappingURL=useDataGridColumnUiPolicy.d.ts.map