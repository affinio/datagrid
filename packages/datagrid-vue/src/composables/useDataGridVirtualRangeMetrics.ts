import { computed, type ComputedRef, type Ref } from "vue"
import {
  useDataGridVirtualRangeMetrics as buildDataGridVirtualRangeMetrics,
  type DataGridVirtualRange,
  type DataGridVirtualWindowRowSnapshot,
} from "@affino/datagrid-orchestration"

export type { DataGridVirtualRange }

export interface UseDataGridVirtualRangeMetricsOptions {
  totalRows: Ref<number>
  scrollTop: Ref<number>
  viewportHeight: Ref<number>
  rowHeight: number
  overscan: number
  virtualWindow?: Ref<DataGridVirtualWindowRowSnapshot | null | undefined>
}

export interface UseDataGridVirtualRangeMetricsResult {
  virtualRange: ComputedRef<DataGridVirtualRange>
  spacerTopHeight: ComputedRef<number>
  spacerBottomHeight: ComputedRef<number>
  rangeLabel: ComputedRef<string>
}

export function useDataGridVirtualRangeMetrics(
  options: UseDataGridVirtualRangeMetricsOptions,
): UseDataGridVirtualRangeMetricsResult {
  const metrics = computed(() => buildDataGridVirtualRangeMetrics({
    ...(options.virtualWindow?.value
      ? {
          virtualWindow: options.virtualWindow.value,
          rowHeight: options.rowHeight,
        }
      : {
          totalRows: options.totalRows.value,
          scrollTop: options.scrollTop.value,
          viewportHeight: options.viewportHeight.value,
          rowHeight: options.rowHeight,
          overscan: options.overscan,
        }),
  }))

  return {
    virtualRange: computed(() => metrics.value.virtualRange),
    spacerTopHeight: computed(() => metrics.value.spacerTopHeight),
    spacerBottomHeight: computed(() => metrics.value.spacerBottomHeight),
    rangeLabel: computed(() => metrics.value.rangeLabel),
  }
}
