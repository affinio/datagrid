export declare function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean;
export declare function toggleDataGridRowSelection(selection: ReadonlySet<string>, rowId: string, selected?: boolean): Set<string>;
export declare function toggleAllVisibleDataGridRows<TRow>(selection: ReadonlySet<string>, visibleRows: readonly TRow[], resolveRowId: (row: TRow) => string, selected: boolean): Set<string>;
export declare function areAllVisibleDataGridRowsSelected<TRow>(selection: ReadonlySet<string>, visibleRows: readonly TRow[], resolveRowId: (row: TRow) => string): boolean;
export declare function areSomeVisibleDataGridRowsSelected<TRow>(selection: ReadonlySet<string>, visibleRows: readonly TRow[], resolveRowId: (row: TRow) => string): boolean;
export declare function reconcileDataGridRowSelection<TRow>(selection: ReadonlySet<string>, allRows: readonly TRow[], resolveRowId: (row: TRow) => string): Set<string>;
//# sourceMappingURL=useDataGridRowSelectionOrchestration.d.ts.map