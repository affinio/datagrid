import type {
  DataGridPivotCellDrilldown,
  DataGridPivotCellDrilldownInput,
  ResolvePivotCellDrilldownInput,
} from "@affino/datagrid-pivot"
import {
  resolvePivotCellDrilldown,
} from "@affino/datagrid-pivot"

export type ResolveClientRowPivotCellDrilldownInput<T> = ResolvePivotCellDrilldownInput<T>

export type {
  DataGridPivotCellDrilldown,
  DataGridPivotCellDrilldownInput,
} from "@affino/datagrid-pivot"

export function resolveClientRowPivotCellDrilldown<T>(
  context: ResolveClientRowPivotCellDrilldownInput<T>,
): DataGridPivotCellDrilldown<T> | null {
  return resolvePivotCellDrilldown(context)
}
