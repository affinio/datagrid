export type DataGridRowId = string | number;
export type DataGridRowIdResolver<T = unknown> = (row: T, index: number) => DataGridRowId;
export type DataGridSortDirection = "asc" | "desc";
export interface DataGridSortState {
    key: string;
    field?: string;
    dependencyFields?: readonly string[];
    direction: DataGridSortDirection;
}
export interface DataGridFilterClause {
    operator: string;
    value: unknown;
    value2?: unknown;
    join?: "and" | "or";
}
export interface DataGridAdvancedFilter {
    type: "text" | "number" | "date" | "set";
    clauses: DataGridFilterClause[];
}
export type DataGridAdvancedFilterConditionType = "text" | "number" | "date" | "set" | "boolean";
export interface DataGridAdvancedFilterCondition {
    kind: "condition";
    key: string;
    field?: string;
    type?: DataGridAdvancedFilterConditionType;
    operator: string;
    value?: unknown;
    value2?: unknown;
}
export interface DataGridAdvancedFilterGroup {
    kind: "group";
    operator: "and" | "or";
    children: DataGridAdvancedFilterExpression[];
}
export interface DataGridAdvancedFilterNot {
    kind: "not";
    child: DataGridAdvancedFilterExpression;
}
export type DataGridAdvancedFilterExpression = DataGridAdvancedFilterCondition | DataGridAdvancedFilterGroup | DataGridAdvancedFilterNot;
export interface DataGridFilterSnapshot {
    columnFilters: Record<string, string[]>;
    advancedFilters: Record<string, DataGridAdvancedFilter>;
    advancedExpression?: DataGridAdvancedFilterExpression | null;
}
export interface DataGridSortAndFilterModelInput {
    sortModel: readonly DataGridSortState[];
    filterModel: DataGridFilterSnapshot | null;
}
export interface DataGridGroupBySpec {
    fields: string[];
    expandedByDefault?: boolean;
}
export interface DataGridGroupExpansionSnapshot {
    expandedByDefault: boolean;
    toggledGroupKeys: readonly string[];
}
export type DataGridAggOp = "sum" | "avg" | "min" | "max" | "count" | "countNonNull" | "first" | "last" | "custom";
export interface DataGridAggregationColumnSpec<T = unknown> {
    key: string;
    field?: string;
    op: DataGridAggOp;
    createState?: () => unknown;
    add?: (state: unknown, value: unknown, row: DataGridRowNode<T>) => void;
    merge?: (state: unknown, childState: unknown) => void;
    remove?: (state: unknown, value: unknown, row: DataGridRowNode<T>) => void;
    finalize?: (state: unknown) => unknown;
    coerce?: (value: unknown) => number | string | null;
}
export interface DataGridAggregationModel<T = unknown> {
    columns: readonly DataGridAggregationColumnSpec<T>[];
    basis?: "filtered" | "source";
}
export type DataGridTreeDataMode = "path" | "parent";
export type DataGridTreeDataOrphanPolicy = "root" | "drop" | "error";
export type DataGridTreeDataCyclePolicy = "ignore-edge" | "error";
export type DataGridTreeDataFilterMode = "leaf-only" | "include-parents" | "include-descendants";
export interface DataGridTreeDataBaseSpec {
    expandedByDefault?: boolean;
    orphanPolicy?: DataGridTreeDataOrphanPolicy;
    cyclePolicy?: DataGridTreeDataCyclePolicy;
    filterMode?: DataGridTreeDataFilterMode;
    dependencyFields?: readonly string[];
}
export interface DataGridTreeDataPathSpec<T = unknown> extends DataGridTreeDataBaseSpec {
    mode: "path";
    getDataPath: (row: T, index: number) => readonly (string | number)[];
}
export interface DataGridTreeDataParentSpec<T = unknown> extends DataGridTreeDataBaseSpec {
    mode: "parent";
    getParentId: (row: T, index: number) => DataGridRowId | null | undefined;
    rootParentId?: DataGridRowId | null;
}
export type DataGridTreeDataSpec<T = unknown> = DataGridTreeDataPathSpec<T> | DataGridTreeDataParentSpec<T>;
export interface DataGridTreeDataResolvedPathSpec<T = unknown> {
    mode: "path";
    getDataPath: (row: T, index: number) => readonly (string | number)[];
    expandedByDefault: boolean;
    orphanPolicy: DataGridTreeDataOrphanPolicy;
    cyclePolicy: DataGridTreeDataCyclePolicy;
    filterMode: DataGridTreeDataFilterMode;
    dependencyFields: readonly string[];
}
export interface DataGridTreeDataResolvedParentSpec<T = unknown> {
    mode: "parent";
    getParentId: (row: T, index: number) => DataGridRowId | null | undefined;
    rootParentId: DataGridRowId | null;
    expandedByDefault: boolean;
    orphanPolicy: DataGridTreeDataOrphanPolicy;
    cyclePolicy: DataGridTreeDataCyclePolicy;
    filterMode: DataGridTreeDataFilterMode;
    dependencyFields: readonly string[];
}
export type DataGridTreeDataResolvedSpec<T = unknown> = DataGridTreeDataResolvedPathSpec<T> | DataGridTreeDataResolvedParentSpec<T>;
export type DataGridRowModelKind = "client" | "server";
export type DataGridRowModelRefreshReason = "mount" | "manual" | "reapply" | "sort-change" | "filter-change" | "viewport-change" | "reset";
export interface DataGridViewportRange {
    start: number;
    end: number;
}
export interface DataGridPaginationInput {
    pageSize: number;
    currentPage: number;
}
export interface DataGridPaginationSnapshot {
    enabled: boolean;
    pageSize: number;
    currentPage: number;
    pageCount: number;
    totalRowCount: number;
    startIndex: number;
    endIndex: number;
}
export type DataGridRowPinState = "none" | "top" | "bottom";
export interface DataGridRowNodeState {
    selected: boolean;
    group: boolean;
    pinned: DataGridRowPinState;
    expanded: boolean;
}
export type DataGridRowKind = "group" | "leaf";
export interface DataGridRowGroupMeta {
    groupKey: string;
    groupField: string;
    groupValue: string;
    level: number;
    childrenCount: number;
    aggregates?: Record<string, unknown>;
}
export interface DataGridRowRenderMeta {
    level: number;
    isGroup: boolean;
    isExpanded?: boolean;
    hasChildren?: boolean;
}
export interface DataGridRowNode<T = unknown> {
    kind: DataGridRowKind;
    data: T;
    row: T;
    rowKey: DataGridRowId;
    rowId: DataGridRowId;
    sourceIndex: number;
    originalIndex: number;
    displayIndex: number;
    state: DataGridRowNodeState;
    groupMeta?: DataGridRowGroupMeta;
}
export interface DataGridRowModelSnapshot<T = unknown> {
    revision?: number;
    kind: DataGridRowModelKind;
    rowCount: number;
    loading: boolean;
    warming?: boolean;
    error: Error | null;
    treeDataDiagnostics?: DataGridTreeDataDiagnostics | null;
    projection?: DataGridProjectionDiagnostics | null;
    viewportRange: DataGridViewportRange;
    pagination: DataGridPaginationSnapshot;
    sortModel: readonly DataGridSortState[];
    filterModel: DataGridFilterSnapshot | null;
    groupBy: DataGridGroupBySpec | null;
    groupExpansion: DataGridGroupExpansionSnapshot;
}
export type DataGridProjectionStage = "filter" | "sort" | "group" | "aggregate" | "paginate" | "visible";
export interface DataGridProjectionDiagnostics {
    version: number;
    cycleVersion?: number;
    recomputeVersion?: number;
    staleStages: readonly DataGridProjectionStage[];
}
export interface DataGridTreeDataDiagnostics {
    orphans: number;
    cycles: number;
    duplicates: number;
    lastError: string | null;
}
export type DataGridRowModelListener<T = unknown> = (snapshot: DataGridRowModelSnapshot<T>) => void;
export interface DataGridRowModel<T = unknown> {
    readonly kind: DataGridRowModelKind;
    getSnapshot(): DataGridRowModelSnapshot<T>;
    getRowCount(): number;
    getRow(index: number): DataGridRowNode<T> | undefined;
    getRowsInRange(range: DataGridViewportRange): readonly DataGridRowNode<T>[];
    setViewportRange(range: DataGridViewportRange): void;
    setPagination(pagination: DataGridPaginationInput | null): void;
    setPageSize(pageSize: number | null): void;
    setCurrentPage(page: number): void;
    setSortModel(sortModel: readonly DataGridSortState[]): void;
    setFilterModel(filterModel: DataGridFilterSnapshot | null): void;
    setSortAndFilterModel?(input: DataGridSortAndFilterModelInput): void;
    setGroupBy(groupBy: DataGridGroupBySpec | null): void;
    setAggregationModel(aggregationModel: DataGridAggregationModel<T> | null): void;
    getAggregationModel(): DataGridAggregationModel<T> | null;
    setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null): void;
    toggleGroup(groupKey: string): void;
    expandGroup(groupKey: string): void;
    collapseGroup(groupKey: string): void;
    expandAllGroups(): void;
    collapseAllGroups(): void;
    refresh(reason?: DataGridRowModelRefreshReason): Promise<void> | void;
    subscribe(listener: DataGridRowModelListener<T>): () => void;
    dispose(): void;
}
export declare function normalizeTreeDataSpec<T>(treeData: DataGridTreeDataSpec<T> | null | undefined): DataGridTreeDataResolvedSpec<T> | null;
export declare function cloneTreeDataSpec<T>(treeData: DataGridTreeDataSpec<T> | DataGridTreeDataResolvedSpec<T> | null | undefined): DataGridTreeDataResolvedSpec<T> | null;
export declare function isSameTreeDataSpec<T>(left: DataGridTreeDataSpec<T> | DataGridTreeDataResolvedSpec<T> | null | undefined, right: DataGridTreeDataSpec<T> | DataGridTreeDataResolvedSpec<T> | null | undefined): boolean;
export declare function normalizeGroupBySpec(groupBy: DataGridGroupBySpec | null | undefined): DataGridGroupBySpec | null;
export declare function cloneGroupBySpec(groupBy: DataGridGroupBySpec | null | undefined): DataGridGroupBySpec | null;
export declare function buildGroupExpansionSnapshot(groupBy: DataGridGroupBySpec | null | undefined, toggledGroupKeys: ReadonlySet<string> | readonly string[]): DataGridGroupExpansionSnapshot;
export declare function isSameGroupExpansionSnapshot(left: DataGridGroupExpansionSnapshot | null | undefined, right: DataGridGroupExpansionSnapshot | null | undefined): boolean;
export declare function isGroupExpanded(expansion: DataGridGroupExpansionSnapshot | null | undefined, groupKey: string, precomputedToggledGroupKeys?: ReadonlySet<string>): boolean;
export declare function toggleGroupExpansionKey(toggledGroupKeys: Set<string>, groupKey: string): boolean;
export declare function setGroupExpansionKey(toggledGroupKeys: Set<string>, groupKey: string, expandedByDefault: boolean, expanded: boolean): boolean;
export declare function isSameGroupBySpec(left: DataGridGroupBySpec | null | undefined, right: DataGridGroupBySpec | null | undefined): boolean;
export declare function normalizeViewportRange(range: DataGridViewportRange, rowCount: number): DataGridViewportRange;
export declare function normalizePaginationInput(input: DataGridPaginationInput | null | undefined): DataGridPaginationInput;
export declare function buildPaginationSnapshot(totalRowCount: number, input: DataGridPaginationInput | null | undefined): DataGridPaginationSnapshot;
export interface DataGridLegacyVisibleRow<T = unknown> {
    row: T;
    rowId: DataGridRowId;
    originalIndex: number;
    displayIndex?: number;
    kind?: DataGridRowKind;
    groupMeta?: Partial<DataGridRowGroupMeta>;
    state?: Partial<DataGridRowNodeState>;
}
export type DataGridRowNodeInput<T = unknown> = DataGridRowNode<T> | DataGridLegacyVisibleRow<T> | T;
export declare function withResolvedRowIdentity<T>(node: DataGridRowNodeInput<T>, index: number, resolveRowId?: DataGridRowIdResolver<T>): DataGridRowNodeInput<T>;
export declare function normalizeRowNode<T>(node: DataGridRowNodeInput<T>, fallbackIndex: number): DataGridRowNode<T>;
export declare function isDataGridGroupRowNode<T>(node: DataGridRowNode<T>): node is DataGridRowNode<T> & {
    kind: "group";
    groupMeta: DataGridRowGroupMeta;
};
export declare function isDataGridLeafRowNode<T>(node: DataGridRowNode<T>): node is DataGridRowNode<T> & {
    kind: "leaf";
};
export declare function getDataGridRowRenderMeta<T>(node: DataGridRowNode<T>): DataGridRowRenderMeta;
//# sourceMappingURL=rowModel.d.ts.map