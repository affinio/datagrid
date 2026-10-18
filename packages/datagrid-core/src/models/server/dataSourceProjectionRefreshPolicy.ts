import type {
  DataGridAggregationModel,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridSortState,
} from "../rowModel.js"
import type { DataGridPivotSpec } from "@affino/datagrid-pivot"
import {
  collectAggregationModelFields,
  collectChangedFieldsFromPatches,
  collectFilterModelFields,
  collectGroupByFields,
  collectPivotModelFields,
  collectSortModelFields,
  doFieldPathsIntersect,
} from "../mutation/rowPatchAnalyzer.js"
import type { DataSourceOptimisticEditTransaction } from "./dataSourceOptimisticMutationEngine.js"

export interface DataSourceProjectionRefreshPolicyInput<T> {
  sortModel: readonly DataGridSortState[]
  filterModel: DataGridFilterSnapshot | null
  groupBy: DataGridGroupBySpec | null
  pivotModel: DataGridPivotSpec | null
  aggregationModel: DataGridAggregationModel<T> | null
}

export function shouldRefreshAfterOptimisticCommit<T>(
  transaction: DataSourceOptimisticEditTransaction<T>,
  models: DataSourceProjectionRefreshPolicyInput<T>,
): boolean {
  const changedFields = collectChangedFieldsFromPatches(transaction.updatesByRowId)
  if (changedFields.size === 0) return false
  if (models.sortModel.length > 0 && doFieldPathsIntersect(changedFields, collectSortModelFields(models.sortModel))) return true
  const filterFields = collectFilterModelFields(models.filterModel)
  if (filterFields.size > 0 && doFieldPathsIntersect(changedFields, filterFields)) return true
  const groupFields = collectGroupByFields(models.groupBy)
  if (groupFields.size > 0 && doFieldPathsIntersect(changedFields, groupFields)) return true
  const pivotFields = collectPivotModelFields(models.pivotModel)
  if (pivotFields.size > 0 && doFieldPathsIntersect(changedFields, pivotFields)) return true
  const aggregationFields = collectAggregationModelFields(models.aggregationModel)
  return aggregationFields.size > 0 && doFieldPathsIntersect(changedFields, aggregationFields)
}

export function shouldRefreshAfterExternalUpdate<T>(
  changedFields: ReadonlySet<string>,
  recompute: boolean | {
    sort?: boolean
    filter?: boolean
    group?: boolean
    pivot?: boolean
    aggregation?: boolean
  } | undefined,
  models: DataSourceProjectionRefreshPolicyInput<T>,
): boolean {
  if (!recompute || changedFields.size === 0) return false
  if (recompute === true) return true
  if (recompute.sort && models.sortModel.length > 0 && doFieldPathsIntersect(changedFields, collectSortModelFields(models.sortModel))) return true
  if (recompute.filter) {
    const fields = collectFilterModelFields(models.filterModel)
    if (fields.size > 0 && doFieldPathsIntersect(changedFields, fields)) return true
  }
  if (recompute.group && models.groupBy && doFieldPathsIntersect(changedFields, collectGroupByFields(models.groupBy))) return true
  if (recompute.pivot && models.pivotModel && doFieldPathsIntersect(changedFields, collectPivotModelFields(models.pivotModel))) return true
  return Boolean(
    recompute.aggregation &&
    models.aggregationModel &&
    doFieldPathsIntersect(changedFields, collectAggregationModelFields(models.aggregationModel)),
  )
}
