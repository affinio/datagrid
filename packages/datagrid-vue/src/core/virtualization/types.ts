import type { UiTableColumn } from "@affino/datagrid-core/types"
import type { ColumnPinMode } from "@affino/datagrid-core/virtualization/types"
import type {
  ColumnMetric as CoreColumnMetric,
  ColumnVirtualizationSnapshot as CoreColumnVirtualizationSnapshot,
} from "@affino/datagrid-core/virtualization/columnSnapshot"
import { createEmptyColumnSnapshot as createCoreEmptyColumnSnapshot } from "@affino/datagrid-core/virtualization/columnSnapshot"

export type { ColumnPinMode }

export type ColumnMetric = CoreColumnMetric<UiTableColumn>

export type ColumnVirtualizationSnapshot = CoreColumnVirtualizationSnapshot<UiTableColumn>

export function createEmptyColumnSnapshot(): ColumnVirtualizationSnapshot {
  return createCoreEmptyColumnSnapshot<UiTableColumn>()
}
