import { computed, onBeforeUnmount, ref, type ComputedRef } from "vue"
import {
  useDataGridHeaderResizeOrchestration as useDataGridHeaderResizeOrchestrationCore,
  type DataGridHeaderResizeState,
  type UseDataGridHeaderResizeOrchestrationOptions,
} from "@affino/datagrid-orchestration"

export type {
  DataGridHeaderResizeState,
  UseDataGridHeaderResizeOrchestrationOptions,
}

export interface UseDataGridHeaderResizeOrchestrationResult {
  activeColumnResize: { value: DataGridHeaderResizeState | null }
  isColumnResizing: ComputedRef<boolean>
  setColumnWidth: (columnKey: string, width: number) => void
  estimateColumnAutoWidth: (columnKey: string) => number
  onHeaderResizeHandleMouseDown: (columnKey: string, event: MouseEvent) => void
  onHeaderResizeHandleDoubleClick: (columnKey: string, event: MouseEvent) => void
  applyColumnResizeFromPointer: (clientX: number) => void
  stopColumnResize: () => void
}

export function useDataGridHeaderResizeOrchestration<TRow>(
  options: UseDataGridHeaderResizeOrchestrationOptions<TRow>,
): UseDataGridHeaderResizeOrchestrationResult {
  const core = useDataGridHeaderResizeOrchestrationCore(options)
  const activeColumnResize = ref<DataGridHeaderResizeState | null>(core.getActiveColumnResize())
  const unsubscribe = core.subscribe(nextState => {
    activeColumnResize.value = nextState
  })

  onBeforeUnmount(() => {
    unsubscribe()
  })

  return {
    activeColumnResize,
    isColumnResizing: computed(() => core.isColumnResizing()),
    setColumnWidth: core.setColumnWidth,
    estimateColumnAutoWidth: core.estimateColumnAutoWidth,
    onHeaderResizeHandleMouseDown: core.onHeaderResizeHandleMouseDown,
    onHeaderResizeHandleDoubleClick: core.onHeaderResizeHandleDoubleClick,
    applyColumnResizeFromPointer: core.applyColumnResizeFromPointer,
    stopColumnResize: core.stopColumnResize,
  }
}
