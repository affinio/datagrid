import { computed, type ComputedRef, type Ref } from "vue"
import type { DataGridSortState } from "@affino/datagrid-core"
import {
  withGroupingSortPriority,
  resolveDataGridSortSummary,
} from "@affino/datagrid-orchestration"

export interface UseDataGridGroupingSortOrchestrationOptions<TGroupByKey extends string> {
  sortState: Ref<readonly DataGridSortState[]>
  groupBy: Ref<TGroupByKey | "none">
}

export interface UseDataGridGroupingSortOrchestrationResult<TGroupByKey extends string> {
  withGroupingSortPriority: (
    model: readonly DataGridSortState[],
    groupByKey: TGroupByKey | "none",
  ) => readonly DataGridSortState[]
  effectiveSortModel: ComputedRef<readonly DataGridSortState[]>
  sortSummary: ComputedRef<string>
}

export function useDataGridGroupingSortOrchestration<TGroupByKey extends string>(
  options: UseDataGridGroupingSortOrchestrationOptions<TGroupByKey>,
): UseDataGridGroupingSortOrchestrationResult<TGroupByKey> {
  const effectiveSortModel = computed(() =>
    withGroupingSortPriority(options.sortState.value, options.groupBy.value),
  )

  const sortSummary = computed(() => resolveDataGridSortSummary(options.sortState.value))

  return {
    withGroupingSortPriority,
    effectiveSortModel,
    sortSummary,
  }
}
