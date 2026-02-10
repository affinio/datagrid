import { computed, type ComputedRef, type Ref } from "vue"
import {
  useDataGridVirtualRangeMetrics as buildDataGridVirtualRangeMetrics,
  type DataGridVirtualRange,
  type DataGridVirtualWindowRowSnapshot,
} from "@affino/datagrid-orchestration"

export type { DataGridVirtualRange }

export interface UseDataGridVirtualRangeMetricsOptions {
  virtualWindow: Ref<DataGridVirtualWindowRowSnapshot | null | undefined>
  rowHeight: number
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
  const metrics = computed(() => {
    const virtualWindow = options.virtualWindow.value
    return buildDataGridVirtualRangeMetrics({
      virtualWindow: virtualWindow ?? { rowStart: 0, rowEnd: 0, rowTotal: 0 },
      rowHeight: options.rowHeight,
    })
  })

  return {
    virtualRange: computed(() => metrics.value.virtualRange),
    spacerTopHeight: computed(() => metrics.value.spacerTopHeight),
    spacerBottomHeight: computed(() => metrics.value.spacerBottomHeight),
    rangeLabel: computed(() => metrics.value.rangeLabel),
  }
}
