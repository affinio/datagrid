import type { DataGridSortState } from "@affino/datagrid-core";
import type { DataGridWritableRef } from "./dataGridWritableRef";
export interface UseDataGridHeaderSortOrchestrationOptions {
    sortState: DataGridWritableRef<readonly DataGridSortState[]>;
    isSortableColumn: (columnKey: string) => boolean;
}
export interface DataGridHeaderSortEntry {
    entry: DataGridSortState;
    index: number;
}
export interface UseDataGridHeaderSortOrchestrationResult {
    getSortEntry: (columnKey: string) => DataGridHeaderSortEntry | null;
    getHeaderSortDirection: (columnKey: string) => "asc" | "desc" | null;
    getHeaderSortPriority: (columnKey: string) => number | null;
    getHeaderAriaSort: (columnKey: string) => "none" | "ascending" | "descending";
    applySortFromHeader: (columnKey: string, keepExisting: boolean) => void;
    applyExplicitSort: (columnKey: string, direction: "asc" | "desc" | null) => void;
}
export declare function useDataGridHeaderSortOrchestration(options: UseDataGridHeaderSortOrchestrationOptions): UseDataGridHeaderSortOrchestrationResult;
//# sourceMappingURL=useDataGridHeaderSortOrchestration.d.ts.map