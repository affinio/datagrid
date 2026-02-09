import { computed, type ComputedRef, type Ref } from "vue"
import {
  useDataGridColumnLayoutOrchestration as buildDataGridColumnLayoutSnapshot,
  resolveDataGridColumnCellStyle,
  isDataGridStickyColumn,
  type DataGridColumnLayoutColumn,
  type DataGridColumnLayoutMetric,
  type DataGridVisibleColumnsWindow,
} from "@affino/datagrid-orchestration"

export type {
  DataGridColumnLayoutColumn,
  DataGridColumnLayoutMetric,
  DataGridVisibleColumnsWindow,
}

export interface UseDataGridColumnLayoutOrchestrationOptions<TColumn extends DataGridColumnLayoutColumn> {
  columns: Ref<readonly TColumn[]>
  resolveColumnWidth: (column: TColumn) => number
  viewportWidth: Ref<number>
  scrollLeft: Ref<number>
}

export interface UseDataGridColumnLayoutOrchestrationResult<TColumn extends DataGridColumnLayoutColumn> {
  orderedColumns: ComputedRef<readonly TColumn[]>
  orderedColumnMetrics: ComputedRef<readonly DataGridColumnLayoutMetric[]>
  templateColumns: ComputedRef<string>
  stickyLeftOffsets: ComputedRef<Map<string, number>>
  stickyRightOffsets: ComputedRef<Map<string, number>>
  visibleColumnsWindow: ComputedRef<DataGridVisibleColumnsWindow>
  getCellStyle: (columnKey: string) => Record<string, string>
  isStickyColumn: (columnKey: string) => boolean
}

export function useDataGridColumnLayoutOrchestration<TColumn extends DataGridColumnLayoutColumn>(
  options: UseDataGridColumnLayoutOrchestrationOptions<TColumn>,
): UseDataGridColumnLayoutOrchestrationResult<TColumn> {
  const layout = computed(() => buildDataGridColumnLayoutSnapshot({
    columns: options.columns.value,
    resolveColumnWidth: options.resolveColumnWidth,
    viewportWidth: options.viewportWidth.value,
    scrollLeft: options.scrollLeft.value,
  }))

  function getCellStyle(columnKey: string): Record<string, string> {
    return resolveDataGridColumnCellStyle(layout.value, columnKey)
  }

  function isStickyColumn(columnKey: string): boolean {
    return isDataGridStickyColumn(layout.value, columnKey)
  }

  return {
    orderedColumns: computed(() => layout.value.orderedColumns),
    orderedColumnMetrics: computed(() => layout.value.orderedColumnMetrics),
    templateColumns: computed(() => layout.value.templateColumns),
    stickyLeftOffsets: computed(() => layout.value.stickyLeftOffsets),
    stickyRightOffsets: computed(() => layout.value.stickyRightOffsets),
    visibleColumnsWindow: computed(() => layout.value.visibleColumnsWindow),
    getCellStyle,
    isStickyColumn,
  }
}
