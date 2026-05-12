import { computed, type ComputedRef, type Ref } from "vue"
import type { DataGridOverlayRange } from "@affino/datagrid-vue"
import type {
  DataGridTableStageBodyColumn,
  DataGridTableStageOverlayLane,
  DataGridTableStageOverlaySegment,
} from "./dataGridTableStageBody.types"
import type { DataGridTableStageCustomOverlay } from "./dataGridTableStage.types"
import {
  buildCustomOverlayLane,
  buildCustomSeamOverlayLane,
  buildPaneOverlaySegments,
  buildPaneOverlaySegmentsForMetricsList,
  buildPinnedPaneSeamOverlaySegments,
  buildPinnedPaneSeamOverlaySegmentsForMetricsList,
  mergeOverlayBounds,
  resolveOverlayMetrics,
  resolveOverlayMetricsList,
  type DataGridStageOverlayBounds,
  type DataGridStageOverlayGeometryContext,
  type DataGridStageOverlayMetricsSource,
} from "./dataGridStageOverlayGeometry"

export interface UseDataGridStageOverlaysOptions {
  overlayGeometryContext: ComputedRef<DataGridStageOverlayGeometryContext>
  bodyViewportClientHeight: Ref<number>
  bottomViewportClientHeight: Ref<number>
  visibleColumns: ComputedRef<readonly DataGridTableStageBodyColumn[]>
  displayRows: ComputedRef<readonly unknown[]>
  selectionRanges: ComputedRef<readonly DataGridOverlayRange[]>
  selectionRange: ComputedRef<DataGridOverlayRange | null>
  fillPreviewRange: ComputedRef<DataGridOverlayRange | null>
  rangeMovePreviewRange: ComputedRef<DataGridOverlayRange | null>
  rowMetrics: ComputedRef<readonly DataGridStageOverlayMetricsSource[]>
  pinnedBottomRowMetrics: ComputedRef<readonly DataGridStageOverlayMetricsSource[]>
  isCellSelectedSafe: (rowOffset: number, columnIndex: number) => boolean
  isCellInFillPreviewSafe: (rowOffset: number, columnIndex: number) => boolean
  isAdditiveSelection: ComputedRef<boolean>
  isFillDragging: ComputedRef<boolean>
  isRangeMoving: ComputedRef<boolean>
  resolveVisibleRangeBounds: (range: DataGridOverlayRange | null) => DataGridStageOverlayBounds | null
  resolvePinnedBottomVisibleRangeBounds: (range: DataGridOverlayRange | null) => DataGridStageOverlayBounds | null
  customOverlays: ComputedRef<readonly DataGridTableStageCustomOverlay[]>
}

export interface UseDataGridStageOverlaysResult {
  leftSelectionOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  leftSelectionSeamOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  centerSelectionOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  rightSelectionOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  rightSelectionSeamOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  leftPinnedBottomSelectionOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  leftPinnedBottomSelectionSeamOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  centerPinnedBottomSelectionOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  rightPinnedBottomSelectionOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  rightPinnedBottomSelectionSeamOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  leftFillPreviewOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  leftFillPreviewSeamOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  centerFillPreviewOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  rightFillPreviewOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  rightFillPreviewSeamOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  leftPinnedBottomFillPreviewOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  leftPinnedBottomFillPreviewSeamOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  centerPinnedBottomFillPreviewOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  rightPinnedBottomFillPreviewOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  rightPinnedBottomFillPreviewSeamOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  leftMovePreviewOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  leftMovePreviewSeamOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  centerMovePreviewOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  rightMovePreviewOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  rightMovePreviewSeamOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  leftPinnedBottomMovePreviewOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  leftPinnedBottomMovePreviewSeamOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  centerPinnedBottomMovePreviewOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  rightPinnedBottomMovePreviewOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  rightPinnedBottomMovePreviewSeamOverlaySegments: ComputedRef<readonly DataGridTableStageOverlaySegment[]>
  leftCustomOverlayLanes: ComputedRef<readonly DataGridTableStageOverlayLane[]>
  centerCustomOverlayLanes: ComputedRef<readonly DataGridTableStageOverlayLane[]>
  rightCustomOverlayLanes: ComputedRef<readonly DataGridTableStageOverlayLane[]>
  leftCustomSeamOverlayLanes: ComputedRef<readonly DataGridTableStageOverlayLane[]>
  rightCustomSeamOverlayLanes: ComputedRef<readonly DataGridTableStageOverlayLane[]>
  leftPinnedBottomCustomOverlayLanes: ComputedRef<readonly DataGridTableStageOverlayLane[]>
  centerPinnedBottomCustomOverlayLanes: ComputedRef<readonly DataGridTableStageOverlayLane[]>
  rightPinnedBottomCustomOverlayLanes: ComputedRef<readonly DataGridTableStageOverlayLane[]>
  leftPinnedBottomCustomSeamOverlayLanes: ComputedRef<readonly DataGridTableStageOverlayLane[]>
  rightPinnedBottomCustomSeamOverlayLanes: ComputedRef<readonly DataGridTableStageOverlayLane[]>
}

function resolveVisibleBounds(
  rowCount: number,
  columnCount: number,
  predicate: (rowOffset: number, columnIndex: number) => boolean,
): DataGridStageOverlayBounds | null {
  let startRowOffset: number | null = null
  let endRowOffset: number | null = null
  let startColumnIndex: number | null = null
  let endColumnIndex: number | null = null

  for (let rowOffset = 0; rowOffset < rowCount; rowOffset += 1) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      if (!predicate(rowOffset, columnIndex)) {
        continue
      }
      startRowOffset ??= rowOffset
      endRowOffset = rowOffset
      startColumnIndex = startColumnIndex == null ? columnIndex : Math.min(startColumnIndex, columnIndex)
      endColumnIndex = endColumnIndex == null ? columnIndex : Math.max(endColumnIndex, columnIndex)
    }
  }

  if (
    startRowOffset == null
    || endRowOffset == null
    || startColumnIndex == null
    || endColumnIndex == null
  ) {
    return null
  }

  return {
    startRowOffset,
    endRowOffset,
    startColumnIndex,
    endColumnIndex,
  }
}

function rangesEqual(left: DataGridOverlayRange | null, right: DataGridOverlayRange | null): boolean {
  if (!left || !right) {
    return false
  }
  return (
    left.startRow === right.startRow
    && left.endRow === right.endRow
    && left.startColumn === right.startColumn
    && left.endColumn === right.endColumn
  )
}

function normalizeBodyPinnedPaneMetricsList<TMetrics extends DataGridStageOverlayMetricsSource>(
  metricsList: readonly TMetrics[],
  metricsSource: readonly DataGridStageOverlayMetricsSource[],
): TMetrics[] {
  const topOffset = metricsSource[0]?.top ?? 0
  if (topOffset <= 0) {
    return [...metricsList]
  }
  return metricsList.map(metrics => ({
    ...metrics,
    top: Math.max(0, metrics.top - topOffset),
  }))
}

function normalizeBodyPinnedPaneMetric<TMetrics extends DataGridStageOverlayMetricsSource>(
  metrics: TMetrics | null,
  metricsSource: readonly DataGridStageOverlayMetricsSource[],
): TMetrics | null {
  if (!metrics) {
    return null
  }
  return normalizeBodyPinnedPaneMetricsList([metrics], metricsSource)[0] ?? null
}

export function useDataGridStageOverlays(
  options: UseDataGridStageOverlaysOptions,
): UseDataGridStageOverlaysResult {
  const normalizedMovePreviewRange = computed<DataGridOverlayRange | null>(() => {
    if (!options.isRangeMoving.value || !options.rangeMovePreviewRange.value) {
      return null
    }
    return rangesEqual(options.rangeMovePreviewRange.value, options.selectionRange.value)
      ? null
      : options.rangeMovePreviewRange.value
  })

  const visibleSelectionBounds = computed(() => resolveVisibleBounds(
    options.displayRows.value.length,
    options.visibleColumns.value.length,
    options.isCellSelectedSafe,
  ))

  const visibleFillPreviewBounds = computed(() => resolveVisibleBounds(
    options.displayRows.value.length,
    options.visibleColumns.value.length,
    options.isCellInFillPreviewSafe,
  ))

  const visibleCombinedFillPreviewBounds = computed(() => {
    if (!visibleFillPreviewBounds.value) {
      return null
    }
    return mergeOverlayBounds(visibleSelectionBounds.value, visibleFillPreviewBounds.value)
  })

  const visibleSelectionOverlayRanges = computed<readonly DataGridOverlayRange[]>(() => {
    if (!options.isAdditiveSelection.value) {
      return options.selectionRanges.value
    }
    return options.selectionRange.value ? [options.selectionRange.value] : []
  })

  const visibleSelectionOverlayMetricsList = computed(() => {
    if (visibleFillPreviewBounds.value) {
      return []
    }
    return resolveOverlayMetricsList(
      visibleSelectionOverlayRanges.value,
      options.resolveVisibleRangeBounds,
      options.rowMetrics.value,
    )
  })
  const bodyPinnedPaneSelectionOverlayMetricsList = computed(() => (
    normalizeBodyPinnedPaneMetricsList(visibleSelectionOverlayMetricsList.value, options.rowMetrics.value)
  ))

  const visibleFillPreviewOverlayMetrics = computed(() => resolveOverlayMetrics(
    visibleCombinedFillPreviewBounds.value,
    options.rowMetrics.value,
  ))
  const bodyPinnedPaneFillPreviewOverlayMetrics = computed(() => (
    normalizeBodyPinnedPaneMetric(visibleFillPreviewOverlayMetrics.value, options.rowMetrics.value)
  ))
  const visibleMovePreviewOverlayMetrics = computed(() => (
    resolveOverlayMetrics(options.resolveVisibleRangeBounds(normalizedMovePreviewRange.value), options.rowMetrics.value)
  ))
  const bodyPinnedPaneMovePreviewOverlayMetrics = computed(() => (
    normalizeBodyPinnedPaneMetric(visibleMovePreviewOverlayMetrics.value, options.rowMetrics.value)
  ))

  const visiblePinnedBottomSelectionOverlayMetricsList = computed(() => {
    if (visibleFillPreviewBounds.value) {
      return []
    }
    return resolveOverlayMetricsList(
      visibleSelectionOverlayRanges.value,
      options.resolvePinnedBottomVisibleRangeBounds,
      options.pinnedBottomRowMetrics.value,
    )
  })

  const visiblePinnedBottomFillPreviewOverlayMetrics = computed(() => resolveOverlayMetrics(
    mergeOverlayBounds(
      options.resolvePinnedBottomVisibleRangeBounds(options.selectionRange.value),
      options.resolvePinnedBottomVisibleRangeBounds(options.fillPreviewRange.value),
    ),
    options.pinnedBottomRowMetrics.value,
  ))

  const visiblePinnedBottomMovePreviewOverlayMetrics = computed(() => resolveOverlayMetrics(
    options.resolvePinnedBottomVisibleRangeBounds(normalizedMovePreviewRange.value),
    options.pinnedBottomRowMetrics.value,
  ))

  const selectionOverlayOptions = {
    borderColor: "var(--datagrid-selection-overlay-border)",
  }
  const fillPreviewOverlayOptions = {
    borderColor: "var(--datagrid-selection-overlay-fill-border)",
    backgroundColor: "var(--datagrid-selection-overlay-fill-bg)",
  }
  const movePreviewOverlayOptions = {
    borderColor: "var(--datagrid-selection-overlay-move-border)",
    backgroundColor: "var(--datagrid-selection-overlay-move-bg)",
    borderStyle: "dashed" as const,
  }

  const bodyViewportHeight = computed(() => Math.max(0, options.bodyViewportClientHeight.value))
  const bottomViewportHeight = computed(() => Math.max(0, options.bottomViewportClientHeight.value))

  const leftSelectionOverlaySegments = computed(() => buildPaneOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    bodyPinnedPaneSelectionOverlayMetricsList.value,
    "left",
    "selection",
    selectionOverlayOptions,
  ))

  const leftSelectionSeamOverlaySegments = computed(() => buildPinnedPaneSeamOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    bodyPinnedPaneSelectionOverlayMetricsList.value,
    "left",
    "selection",
    selectionOverlayOptions,
  ))

  const centerSelectionOverlaySegments = computed(() => buildPaneOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    visibleSelectionOverlayMetricsList.value,
    "center",
    "selection",
    selectionOverlayOptions,
  ))

  const rightSelectionOverlaySegments = computed(() => buildPaneOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    bodyPinnedPaneSelectionOverlayMetricsList.value,
    "right",
    "selection",
    selectionOverlayOptions,
  ))

  const rightSelectionSeamOverlaySegments = computed(() => buildPinnedPaneSeamOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    bodyPinnedPaneSelectionOverlayMetricsList.value,
    "right",
    "selection",
    selectionOverlayOptions,
  ))

  const leftPinnedBottomSelectionOverlaySegments = computed(() => buildPaneOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    visiblePinnedBottomSelectionOverlayMetricsList.value,
    "left",
    "selection",
    selectionOverlayOptions,
    bottomViewportHeight.value,
  ))

  const leftPinnedBottomSelectionSeamOverlaySegments = computed(() => buildPinnedPaneSeamOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    visiblePinnedBottomSelectionOverlayMetricsList.value,
    "left",
    "selection",
    selectionOverlayOptions,
    bottomViewportHeight.value,
  ))

  const centerPinnedBottomSelectionOverlaySegments = computed(() => buildPaneOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    visiblePinnedBottomSelectionOverlayMetricsList.value,
    "center",
    "selection",
    selectionOverlayOptions,
    bottomViewportHeight.value,
  ))

  const rightPinnedBottomSelectionOverlaySegments = computed(() => buildPaneOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    visiblePinnedBottomSelectionOverlayMetricsList.value,
    "right",
    "selection",
    selectionOverlayOptions,
    bottomViewportHeight.value,
  ))

  const rightPinnedBottomSelectionSeamOverlaySegments = computed(() => buildPinnedPaneSeamOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    visiblePinnedBottomSelectionOverlayMetricsList.value,
    "right",
    "selection",
    selectionOverlayOptions,
    bottomViewportHeight.value,
  ))

  const leftFillPreviewOverlaySegments = computed(() => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    bodyPinnedPaneFillPreviewOverlayMetrics.value,
    "left",
    "fill-preview",
    fillPreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const leftFillPreviewSeamOverlaySegments = computed(() => buildPinnedPaneSeamOverlaySegments(
    options.overlayGeometryContext.value,
    bodyPinnedPaneFillPreviewOverlayMetrics.value,
    "left",
    "fill-preview",
    fillPreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const centerFillPreviewOverlaySegments = computed(() => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    visibleFillPreviewOverlayMetrics.value,
    "center",
    "fill-preview",
    fillPreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const rightFillPreviewOverlaySegments = computed(() => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    bodyPinnedPaneFillPreviewOverlayMetrics.value,
    "right",
    "fill-preview",
    fillPreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const rightFillPreviewSeamOverlaySegments = computed(() => buildPinnedPaneSeamOverlaySegments(
    options.overlayGeometryContext.value,
    bodyPinnedPaneFillPreviewOverlayMetrics.value,
    "right",
    "fill-preview",
    fillPreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const leftPinnedBottomFillPreviewOverlaySegments = computed(() => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomFillPreviewOverlayMetrics.value,
    "left",
    "fill-preview",
    fillPreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const leftPinnedBottomFillPreviewSeamOverlaySegments = computed(() => buildPinnedPaneSeamOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomFillPreviewOverlayMetrics.value,
    "left",
    "fill-preview",
    fillPreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const centerPinnedBottomFillPreviewOverlaySegments = computed(() => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomFillPreviewOverlayMetrics.value,
    "center",
    "fill-preview",
    fillPreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const rightPinnedBottomFillPreviewOverlaySegments = computed(() => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomFillPreviewOverlayMetrics.value,
    "right",
    "fill-preview",
    fillPreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const rightPinnedBottomFillPreviewSeamOverlaySegments = computed(() => buildPinnedPaneSeamOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomFillPreviewOverlayMetrics.value,
    "right",
    "fill-preview",
    fillPreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const leftMovePreviewOverlaySegments = computed(() => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    bodyPinnedPaneMovePreviewOverlayMetrics.value,
    "left",
    "move-preview",
    movePreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const leftMovePreviewSeamOverlaySegments = computed(() => buildPinnedPaneSeamOverlaySegments(
    options.overlayGeometryContext.value,
    bodyPinnedPaneMovePreviewOverlayMetrics.value,
    "left",
    "move-preview",
    movePreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const centerMovePreviewOverlaySegments = computed(() => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    visibleMovePreviewOverlayMetrics.value,
    "center",
    "move-preview",
    movePreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const rightMovePreviewOverlaySegments = computed(() => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    bodyPinnedPaneMovePreviewOverlayMetrics.value,
    "right",
    "move-preview",
    movePreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const rightMovePreviewSeamOverlaySegments = computed(() => buildPinnedPaneSeamOverlaySegments(
    options.overlayGeometryContext.value,
    bodyPinnedPaneMovePreviewOverlayMetrics.value,
    "right",
    "move-preview",
    movePreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const leftPinnedBottomMovePreviewOverlaySegments = computed(() => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomMovePreviewOverlayMetrics.value,
    "left",
    "move-preview",
    movePreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const leftPinnedBottomMovePreviewSeamOverlaySegments = computed(() => buildPinnedPaneSeamOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomMovePreviewOverlayMetrics.value,
    "left",
    "move-preview",
    movePreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const centerPinnedBottomMovePreviewOverlaySegments = computed(() => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomMovePreviewOverlayMetrics.value,
    "center",
    "move-preview",
    movePreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const rightPinnedBottomMovePreviewOverlaySegments = computed(() => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomMovePreviewOverlayMetrics.value,
    "right",
    "move-preview",
    movePreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const rightPinnedBottomMovePreviewSeamOverlaySegments = computed(() => buildPinnedPaneSeamOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomMovePreviewOverlayMetrics.value,
    "right",
    "move-preview",
    movePreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const customOverlayMetrics = computed(() => options.customOverlays.value.map(overlay => {
    const body = resolveOverlayMetricsList(overlay.ranges, options.resolveVisibleRangeBounds, options.rowMetrics.value)
    return {
      overlay,
      body,
      bodyPinnedPane: normalizeBodyPinnedPaneMetricsList(body, options.rowMetrics.value),
      pinnedBottom: resolveOverlayMetricsList(
        overlay.ranges,
        options.resolvePinnedBottomVisibleRangeBounds,
        options.pinnedBottomRowMetrics.value,
      ),
    }
  }))

  const leftCustomOverlayLanes = computed<readonly DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
    .map(({ overlay, bodyPinnedPane }) => buildCustomOverlayLane(options.overlayGeometryContext.value, overlay, "left", bodyPinnedPane))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const centerCustomOverlayLanes = computed<readonly DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
    .map(({ overlay, body }) => buildCustomOverlayLane(options.overlayGeometryContext.value, overlay, "center", body))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const rightCustomOverlayLanes = computed<readonly DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
    .map(({ overlay, bodyPinnedPane }) => buildCustomOverlayLane(options.overlayGeometryContext.value, overlay, "right", bodyPinnedPane))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const leftCustomSeamOverlayLanes = computed<readonly DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
    .map(({ overlay, bodyPinnedPane }) => buildCustomSeamOverlayLane(options.overlayGeometryContext.value, overlay, "left", bodyPinnedPane))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const rightCustomSeamOverlayLanes = computed<readonly DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
    .map(({ overlay, bodyPinnedPane }) => buildCustomSeamOverlayLane(options.overlayGeometryContext.value, overlay, "right", bodyPinnedPane))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const leftPinnedBottomCustomOverlayLanes = computed<readonly DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
    .map(({ overlay, pinnedBottom }) => buildCustomOverlayLane(options.overlayGeometryContext.value, overlay, "left", pinnedBottom, bottomViewportHeight.value))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const centerPinnedBottomCustomOverlayLanes = computed<readonly DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
    .map(({ overlay, pinnedBottom }) => buildCustomOverlayLane(options.overlayGeometryContext.value, overlay, "center", pinnedBottom, bottomViewportHeight.value))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const rightPinnedBottomCustomOverlayLanes = computed<readonly DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
    .map(({ overlay, pinnedBottom }) => buildCustomOverlayLane(options.overlayGeometryContext.value, overlay, "right", pinnedBottom, bottomViewportHeight.value))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const leftPinnedBottomCustomSeamOverlayLanes = computed<readonly DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
    .map(({ overlay, pinnedBottom }) => buildCustomSeamOverlayLane(options.overlayGeometryContext.value, overlay, "left", pinnedBottom, bottomViewportHeight.value))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const rightPinnedBottomCustomSeamOverlayLanes = computed<readonly DataGridTableStageOverlayLane[]>(() => customOverlayMetrics.value
    .map(({ overlay, pinnedBottom }) => buildCustomSeamOverlayLane(options.overlayGeometryContext.value, overlay, "right", pinnedBottom, bottomViewportHeight.value))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  return {
    leftSelectionOverlaySegments,
    leftSelectionSeamOverlaySegments,
    centerSelectionOverlaySegments,
    rightSelectionOverlaySegments,
    rightSelectionSeamOverlaySegments,
    leftPinnedBottomSelectionOverlaySegments,
    leftPinnedBottomSelectionSeamOverlaySegments,
    centerPinnedBottomSelectionOverlaySegments,
    rightPinnedBottomSelectionOverlaySegments,
    rightPinnedBottomSelectionSeamOverlaySegments,
    leftFillPreviewOverlaySegments,
    leftFillPreviewSeamOverlaySegments,
    centerFillPreviewOverlaySegments,
    rightFillPreviewOverlaySegments,
    rightFillPreviewSeamOverlaySegments,
    leftPinnedBottomFillPreviewOverlaySegments,
    leftPinnedBottomFillPreviewSeamOverlaySegments,
    centerPinnedBottomFillPreviewOverlaySegments,
    rightPinnedBottomFillPreviewOverlaySegments,
    rightPinnedBottomFillPreviewSeamOverlaySegments,
    leftMovePreviewOverlaySegments,
    leftMovePreviewSeamOverlaySegments,
    centerMovePreviewOverlaySegments,
    rightMovePreviewOverlaySegments,
    rightMovePreviewSeamOverlaySegments,
    leftPinnedBottomMovePreviewOverlaySegments,
    leftPinnedBottomMovePreviewSeamOverlaySegments,
    centerPinnedBottomMovePreviewOverlaySegments,
    rightPinnedBottomMovePreviewOverlaySegments,
    rightPinnedBottomMovePreviewSeamOverlaySegments,
    leftCustomOverlayLanes,
    centerCustomOverlayLanes,
    rightCustomOverlayLanes,
    leftCustomSeamOverlayLanes,
    rightCustomSeamOverlayLanes,
    leftPinnedBottomCustomOverlayLanes,
    centerPinnedBottomCustomOverlayLanes,
    rightPinnedBottomCustomOverlayLanes,
    leftPinnedBottomCustomSeamOverlayLanes,
    rightPinnedBottomCustomSeamOverlayLanes,
  }
}
