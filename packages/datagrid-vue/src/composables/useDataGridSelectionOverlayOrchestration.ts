import { computed, type ComputedRef, type Ref } from "vue"
import {
  useDataGridSelectionOverlayOrchestration as buildDataGridSelectionOverlaySnapshot,
  type DataGridOverlayRange,
  type DataGridOverlayColumnLike,
  type DataGridOverlayColumnMetricLike,
  type DataGridSelectionOverlayVirtualWindow,
  type DataGridSelectionOverlaySegment,
} from "@affino/datagrid-orchestration"

export type {
  DataGridOverlayRange,
  DataGridOverlayColumnLike,
  DataGridOverlayColumnMetricLike,
  DataGridSelectionOverlayVirtualWindow,
  DataGridSelectionOverlaySegment,
}

export interface UseDataGridSelectionOverlayOrchestrationOptions {
  headerHeight: Ref<number>
  rowHeight: number
  resolveRowHeight?: (rowIndex: number) => number
  resolveRowOffset?: (rowIndex: number) => number
  orderedColumns: Ref<readonly DataGridOverlayColumnLike[]>
  orderedColumnMetrics: Ref<readonly DataGridOverlayColumnMetricLike[]>
  cellSelectionRange: Ref<DataGridOverlayRange | null>
  fillPreviewRange: Ref<DataGridOverlayRange | null>
  fillBaseRange: Ref<DataGridOverlayRange | null>
  rangeMovePreviewRange: Ref<DataGridOverlayRange | null>
  rangeMoveBaseRange: Ref<DataGridOverlayRange | null>
  isRangeMoving: Ref<boolean>
  virtualWindow: Ref<DataGridSelectionOverlayVirtualWindow>
  resolveDevicePixelRatio?: () => number
}

export interface UseDataGridSelectionOverlayOrchestrationResult {
  cellSelectionOverlaySegments: ComputedRef<readonly DataGridSelectionOverlaySegment[]>
  fillPreviewOverlaySegments: ComputedRef<readonly DataGridSelectionOverlaySegment[]>
  rangeMoveOverlaySegments: ComputedRef<readonly DataGridSelectionOverlaySegment[]>
}

export function useDataGridSelectionOverlayOrchestration(
  options: UseDataGridSelectionOverlayOrchestrationOptions,
): UseDataGridSelectionOverlayOrchestrationResult {
  const overlay = computed(() => buildDataGridSelectionOverlaySnapshot({
    headerHeight: options.headerHeight.value,
    rowHeight: options.rowHeight,
    resolveRowHeight: options.resolveRowHeight,
    resolveRowOffset: options.resolveRowOffset,
    orderedColumns: options.orderedColumns.value,
    orderedColumnMetrics: options.orderedColumnMetrics.value,
    cellSelectionRange: options.cellSelectionRange.value,
    fillPreviewRange: options.fillPreviewRange.value,
    fillBaseRange: options.fillBaseRange.value,
    rangeMovePreviewRange: options.rangeMovePreviewRange.value,
    rangeMoveBaseRange: options.rangeMoveBaseRange.value,
    isRangeMoving: options.isRangeMoving.value,
    virtualWindow: options.virtualWindow.value,
    resolveDevicePixelRatio: options.resolveDevicePixelRatio,
  }))

  return {
    cellSelectionOverlaySegments: computed(() => overlay.value.cellSelectionOverlaySegments),
    fillPreviewOverlaySegments: computed(() => overlay.value.fillPreviewOverlaySegments),
    rangeMoveOverlaySegments: computed(() => overlay.value.rangeMoveOverlaySegments),
  }
}
