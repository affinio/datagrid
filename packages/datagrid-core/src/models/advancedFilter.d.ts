import type { DataGridAdvancedFilter, DataGridAdvancedFilterCondition, DataGridAdvancedFilterExpression, DataGridFilterSnapshot } from "./rowModel.js";
export type DataGridAdvancedFilterResolver = (condition: DataGridAdvancedFilterCondition) => unknown;
export declare function normalizeDataGridAdvancedFilterExpression(expression: DataGridAdvancedFilterExpression | null | undefined): DataGridAdvancedFilterExpression | null;
export declare function buildDataGridAdvancedFilterExpressionFromLegacyFilters(advancedFilters: Record<string, DataGridAdvancedFilter> | null | undefined): DataGridAdvancedFilterExpression | null;
export declare function evaluateDataGridAdvancedFilterExpression(expression: DataGridAdvancedFilterExpression | null | undefined, resolve: DataGridAdvancedFilterResolver): boolean;
export declare function cloneDataGridFilterSnapshot(input: DataGridFilterSnapshot | null | undefined): DataGridFilterSnapshot | null;
//# sourceMappingURL=advancedFilter.d.ts.map