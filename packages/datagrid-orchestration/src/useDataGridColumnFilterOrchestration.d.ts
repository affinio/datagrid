import type { DataGridFilterSnapshot } from "@affino/datagrid-core";
export type DataGridColumnFilterKind = "text" | "enum" | "number";
export interface DataGridAppliedColumnFilter {
    kind: DataGridColumnFilterKind;
    operator: string;
    value: string;
    value2?: string;
}
export interface DataGridColumnFilterDraft {
    columnKey: string;
    kind: DataGridColumnFilterKind;
    operator: string;
    value: string;
    value2: string;
}
export interface DataGridFilterOperatorOption {
    value: string;
    label: string;
}
export interface DataGridColumnFilterSnapshot {
    activeFilterColumnKey: string | null;
    columnFilterDraft: DataGridColumnFilterDraft | null;
    appliedColumnFilters: Record<string, DataGridAppliedColumnFilter>;
    activeColumnFilterCount: number;
    hasColumnFilters: boolean;
    activeFilterColumnLabel: string;
    columnFilterOperatorOptions: readonly DataGridFilterOperatorOption[];
    activeColumnFilterEnumOptions: string[];
    canApplyActiveColumnFilter: boolean;
}
export interface UseDataGridColumnFilterOrchestrationOptions<TRow> {
    resolveColumnFilterKind: (columnKey: string) => DataGridColumnFilterKind;
    resolveEnumFilterOptions: (columnKey: string) => string[];
    resolveColumnLabel: (columnKey: string) => string | null | undefined;
    resolveCellValue: (row: TRow, columnKey: string) => unknown;
    isFilterableColumn?: (columnKey: string) => boolean;
    setLastAction?: (message: string) => void;
    initialAppliedFilters?: Record<string, DataGridAppliedColumnFilter>;
    resolveInputValue?: (value: unknown) => string;
}
export interface UseDataGridColumnFilterOrchestrationResult<TRow> {
    getSnapshot: () => DataGridColumnFilterSnapshot;
    subscribe: (listener: (snapshot: DataGridColumnFilterSnapshot) => void) => () => void;
    isColumnFilterActive: (columnKey: string) => boolean;
    openColumnFilter: (columnKey: string) => void;
    onHeaderFilterTriggerClick: (columnKey: string) => void;
    closeColumnFilterPanel: () => void;
    onFilterOperatorChange: (value: string | number) => void;
    onFilterEnumValueChange: (value: string | number) => void;
    onFilterValueInput: (value: unknown) => void;
    onFilterSecondValueInput: (value: unknown) => void;
    doesOperatorNeedSecondValue: (kind: DataGridColumnFilterKind, operator: string) => boolean;
    doesFilterDraftHaveRequiredValues: (draft: DataGridColumnFilterDraft) => boolean;
    applyActiveColumnFilter: () => void;
    resetActiveColumnFilter: () => void;
    clearAllColumnFilters: () => void;
    buildFilterSnapshot: (filters: Record<string, DataGridAppliedColumnFilter>) => DataGridFilterSnapshot | null;
    rowMatchesColumnFilters: (row: TRow, filters: Record<string, DataGridAppliedColumnFilter>) => boolean;
}
export declare const DATA_GRID_TEXT_FILTER_OPERATOR_OPTIONS: readonly DataGridFilterOperatorOption[];
export declare const DATA_GRID_ENUM_FILTER_OPERATOR_OPTIONS: readonly DataGridFilterOperatorOption[];
export declare const DATA_GRID_NUMBER_FILTER_OPERATOR_OPTIONS: readonly DataGridFilterOperatorOption[];
export declare function useDataGridColumnFilterOrchestration<TRow>(options: UseDataGridColumnFilterOrchestrationOptions<TRow>): UseDataGridColumnFilterOrchestrationResult<TRow>;
//# sourceMappingURL=useDataGridColumnFilterOrchestration.d.ts.map