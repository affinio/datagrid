import { computed, type ComputedRef, type Ref } from "vue"
import {
  useDataGridGroupMetaOrchestration as buildDataGridGroupMetaSnapshot,
  isDataGridGroupStartRow,
  resolveDataGridGroupBadgeText,
  resolveDataGridGroupBySummary,
  type DataGridGroupMetaSnapshot,
} from "@affino/datagrid-orchestration"

export type { DataGridGroupMetaSnapshot }

export interface UseDataGridGroupMetaOrchestrationOptions<TRow, TGroupByKey extends string> {
  rows: Ref<readonly TRow[]>
  groupBy: Ref<TGroupByKey | "none">
  resolveRowId: (row: TRow) => string | number
  resolveGroupValue: (row: TRow, groupBy: TGroupByKey) => string | null | undefined
}

export interface UseDataGridGroupMetaOrchestrationResult {
  groupMeta: ComputedRef<DataGridGroupMetaSnapshot>
  groupCount: ComputedRef<number>
  groupBySummary: ComputedRef<string>
  isGroupStartRow: (rowId: string | number) => boolean
  resolveGroupBadgeText: (rowId: string | number) => string
}

export function useDataGridGroupMetaOrchestration<TRow, TGroupByKey extends string>(
  options: UseDataGridGroupMetaOrchestrationOptions<TRow, TGroupByKey>,
): UseDataGridGroupMetaOrchestrationResult {
  const groupMeta = computed<DataGridGroupMetaSnapshot>(() => buildDataGridGroupMetaSnapshot({
    rows: options.rows.value,
    groupBy: options.groupBy.value,
    resolveRowId: options.resolveRowId,
    resolveGroupValue: options.resolveGroupValue,
  }))

  const groupCount = computed(() => groupMeta.value.groups)
  const groupBySummary = computed(() => resolveDataGridGroupBySummary(options.groupBy.value))

  function isGroupStartRow(rowId: string | number): boolean {
    return options.groupBy.value !== "none" && isDataGridGroupStartRow(groupMeta.value, rowId)
  }

  function resolveGroupBadgeText(rowId: string | number): string {
    return resolveDataGridGroupBadgeText(groupMeta.value, rowId)
  }

  return {
    groupMeta,
    groupCount,
    groupBySummary,
    isGroupStartRow,
    resolveGroupBadgeText,
  }
}
