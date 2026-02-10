import { computed, type ComputedRef, type Ref } from "vue"
import {
  useDataGridColumnLayoutOrchestration as buildDataGridColumnLayoutSnapshot,
  resolveDataGridColumnCellStyle,
  isDataGridStickyColumn,
  buildDataGridColumnLayers,
  resolveDataGridLayerTrackTemplate,
  type DataGridColumnLayoutColumn,
  type DataGridColumnLayoutMetric,
  type DataGridVisibleColumnsWindow,
  type DataGridVirtualWindowColumnSnapshot,
  type DataGridColumnLayer,
  type DataGridColumnLayerKey,
} from "@affino/datagrid-orchestration"

export type {
  DataGridColumnLayoutColumn,
  DataGridColumnLayoutMetric,
  DataGridVisibleColumnsWindow,
  DataGridVirtualWindowColumnSnapshot,
  DataGridColumnLayer,
  DataGridColumnLayerKey,
}

export interface UseDataGridColumnLayoutOrchestrationOptions<TColumn extends DataGridColumnLayoutColumn> {
  columns: Ref<readonly TColumn[]>
  resolveColumnWidth: (column: TColumn) => number
  virtualWindow: Ref<DataGridVirtualWindowColumnSnapshot | null | undefined>
}

export interface UseDataGridColumnLayoutOrchestrationResult<TColumn extends DataGridColumnLayoutColumn> {
  orderedColumns: ComputedRef<readonly TColumn[]>
  orderedColumnMetrics: ComputedRef<readonly DataGridColumnLayoutMetric[]>
  templateColumns: ComputedRef<string>
  columnLayers: ComputedRef<readonly DataGridColumnLayer<TColumn>[]>
  layerTrackTemplate: ComputedRef<string>
  stickyLeftOffsets: ComputedRef<Map<string, number>>
  stickyRightOffsets: ComputedRef<Map<string, number>>
  visibleColumnsWindow: ComputedRef<DataGridVisibleColumnsWindow>
  getCellStyle: (columnKey: string) => Record<string, string>
  isStickyColumn: (columnKey: string) => boolean
}

export function useDataGridColumnLayoutOrchestration<TColumn extends DataGridColumnLayoutColumn>(
  options: UseDataGridColumnLayoutOrchestrationOptions<TColumn>,
): UseDataGridColumnLayoutOrchestrationResult<TColumn> {
  const layout = computed(() => {
    const virtualWindow = options.virtualWindow.value
    return buildDataGridColumnLayoutSnapshot({
      columns: options.columns.value,
      resolveColumnWidth: options.resolveColumnWidth,
      virtualWindow: virtualWindow ?? {
        rowStart: 0,
        rowEnd: 0,
        rowTotal: 0,
        colStart: 0,
        colEnd: 0,
        colTotal: 0,
        overscan: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
      },
    })
  })

  function getCellStyle(columnKey: string): Record<string, string> {
    return resolveDataGridColumnCellStyle(layout.value, columnKey)
  }

  function isStickyColumn(columnKey: string): boolean {
    return isDataGridStickyColumn(layout.value, columnKey)
  }

  const columnLayers = computed(() => buildDataGridColumnLayers(layout.value))
  const layerTrackTemplate = computed(() =>
    resolveDataGridLayerTrackTemplate(columnLayers.value),
  )

  return {
    orderedColumns: computed(() => layout.value.orderedColumns),
    orderedColumnMetrics: computed(() => layout.value.orderedColumnMetrics),
    templateColumns: computed(() => layout.value.templateColumns),
    columnLayers,
    layerTrackTemplate,
    stickyLeftOffsets: computed(() => layout.value.stickyLeftOffsets),
    stickyRightOffsets: computed(() => layout.value.stickyRightOffsets),
    visibleColumnsWindow: computed(() => layout.value.visibleColumnsWindow),
    getCellStyle,
    isStickyColumn,
  }
}
