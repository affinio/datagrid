import { computed, type ComputedRef, type Ref } from "vue"
import type { DataGridOverlayRange } from "@affino/datagrid-vue"
import type {
  DataGridTableStageBodyColumn,
  DataGridTableStageOverlayLane,
  DataGridTableStageOverlaySegment,
} from "./dataGridTableStageBody.types"
import type { DataGridTableStageCustomOverlay } from "./dataGridTableStage.types"
import {
  recordDataGridPerfSample,
  resolveDataGridPerfNow,
} from "../perf/dataGridPerfTrace"
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
  bodyViewportScrollTop: Ref<number>
  bodyOverlayRowOrigin?: Ref<number>
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
  perfTraceEnabled?: boolean
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

function normalizeBodyOverlayMetricsList<TMetrics extends DataGridStageOverlayMetricsSource>(
  metricsList: readonly TMetrics[],
  origin: number,
): TMetrics[] {
  const topOrigin = Math.max(0, Number.isFinite(origin) ? origin : 0)
  if (topOrigin <= 0) {
    return [...metricsList]
  }
  return metricsList.map(metrics => ({
    ...metrics,
    top: metrics.top - topOrigin,
  }))
}

function normalizeBodyOverlayMetric<TMetrics extends DataGridStageOverlayMetricsSource>(
  metrics: TMetrics | null,
  origin: number,
): TMetrics | null {
  if (!metrics) {
    return null
  }
  return normalizeBodyOverlayMetricsList([metrics], origin)[0] ?? null
}

function normalizeBodyPinnedPaneSeamMetricsList<TMetrics extends DataGridStageOverlayMetricsSource>(
  metricsList: readonly TMetrics[],
  scrollTop: number,
): TMetrics[] {
  const topOffset = Math.max(0, Number.isFinite(scrollTop) ? scrollTop : 0)
  if (topOffset <= 0) {
    return [...metricsList]
  }
  return metricsList.map(metrics => ({
    ...metrics,
    top: metrics.top - topOffset,
  }))
}

function normalizeBodyPinnedPaneSeamMetric<TMetrics extends DataGridStageOverlayMetricsSource>(
  metrics: TMetrics | null,
  scrollTop: number,
): TMetrics | null {
  if (!metrics) {
    return null
  }
  return normalizeBodyPinnedPaneSeamMetricsList([metrics], scrollTop)[0] ?? null
}

function recordOverlayComputeSample(
  options: UseDataGridStageOverlaysOptions,
  startedAt: number,
  overlayKind: string,
  surface: string,
  pane: string,
  segmentCount: number,
  laneCount = 0,
): void {
  if (!options.perfTraceEnabled) {
    return
  }
  const finishedAt = resolveDataGridPerfNow()
  recordDataGridPerfSample({
    scope: "overlayCompute",
    ts: finishedAt,
    totalMs: finishedAt - startedAt,
    overlayKind,
    surface,
    pane,
    segmentCount,
    laneCount,
    visibleRowCount: options.displayRows.value.length,
    visibleColumnCount: options.visibleColumns.value.length,
    selectionRangeCount: options.selectionRanges.value.length,
    customOverlayCount: options.customOverlays.value.length,
  })
}

function computedOverlaySegments(
  options: UseDataGridStageOverlaysOptions,
  overlayKind: string,
  surface: string,
  pane: string,
  buildSegments: () => readonly DataGridTableStageOverlaySegment[],
): ComputedRef<readonly DataGridTableStageOverlaySegment[]> {
  return computed(() => {
    const startedAt = options.perfTraceEnabled ? resolveDataGridPerfNow() : 0
    const segments = buildSegments()
    recordOverlayComputeSample(options, startedAt, overlayKind, surface, pane, segments.length)
    return segments
  })
}

function computedOverlayLanes(
  options: UseDataGridStageOverlaysOptions,
  overlayKind: string,
  surface: string,
  pane: string,
  buildLanes: () => readonly DataGridTableStageOverlayLane[],
): ComputedRef<readonly DataGridTableStageOverlayLane[]> {
  return computed(() => {
    const startedAt = options.perfTraceEnabled ? resolveDataGridPerfNow() : 0
    const lanes = buildLanes()
    const segmentCount = lanes.reduce((count, lane) => count + lane.segments.length, 0)
    recordOverlayComputeSample(options, startedAt, overlayKind, surface, pane, segmentCount, lanes.length)
    return lanes
  })
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

  const visibleFillPreviewOverlayMetrics = computed(() => resolveOverlayMetrics(
    visibleCombinedFillPreviewBounds.value,
    options.rowMetrics.value,
  ))
  const visibleMovePreviewOverlayMetrics = computed(() => (
    resolveOverlayMetrics(options.resolveVisibleRangeBounds(normalizedMovePreviewRange.value), options.rowMetrics.value)
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
  const bodyOverlayRowOrigin = computed(() => Math.max(0, options.bodyOverlayRowOrigin?.value ?? 0))
  const bodySelectionOverlayMetricsList = computed(() => (
    normalizeBodyOverlayMetricsList(visibleSelectionOverlayMetricsList.value, bodyOverlayRowOrigin.value)
  ))
  const bodyFillPreviewOverlayMetrics = computed(() => (
    normalizeBodyOverlayMetric(visibleFillPreviewOverlayMetrics.value, bodyOverlayRowOrigin.value)
  ))
  const bodyMovePreviewOverlayMetrics = computed(() => (
    normalizeBodyOverlayMetric(visibleMovePreviewOverlayMetrics.value, bodyOverlayRowOrigin.value)
  ))
  const bodyPinnedPaneSeamSelectionOverlayMetricsList = computed(() => (
    normalizeBodyPinnedPaneSeamMetricsList(visibleSelectionOverlayMetricsList.value, options.bodyViewportScrollTop.value)
  ))
  const bodyPinnedPaneSeamFillPreviewOverlayMetrics = computed(() => (
    normalizeBodyPinnedPaneSeamMetric(visibleFillPreviewOverlayMetrics.value, options.bodyViewportScrollTop.value)
  ))
  const bodyPinnedPaneSeamMovePreviewOverlayMetrics = computed(() => (
    normalizeBodyPinnedPaneSeamMetric(visibleMovePreviewOverlayMetrics.value, options.bodyViewportScrollTop.value)
  ))

  const leftSelectionOverlaySegments = computedOverlaySegments(options, "selection", "body", "left", () => buildPaneOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    bodySelectionOverlayMetricsList.value,
    "left",
    "selection",
    selectionOverlayOptions,
  ))

  const leftSelectionSeamOverlaySegments = computedOverlaySegments(options, "selection", "body-seam", "left", () => buildPinnedPaneSeamOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    bodyPinnedPaneSeamSelectionOverlayMetricsList.value,
    "left",
    "selection",
    selectionOverlayOptions,
  ))

  const centerSelectionOverlaySegments = computedOverlaySegments(options, "selection", "body", "center", () => buildPaneOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    bodySelectionOverlayMetricsList.value,
    "center",
    "selection",
    selectionOverlayOptions,
  ))

  const rightSelectionOverlaySegments = computedOverlaySegments(options, "selection", "body", "right", () => buildPaneOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    bodySelectionOverlayMetricsList.value,
    "right",
    "selection",
    selectionOverlayOptions,
  ))

  const rightSelectionSeamOverlaySegments = computedOverlaySegments(options, "selection", "body-seam", "right", () => buildPinnedPaneSeamOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    bodyPinnedPaneSeamSelectionOverlayMetricsList.value,
    "right",
    "selection",
    selectionOverlayOptions,
  ))

  const leftPinnedBottomSelectionOverlaySegments = computedOverlaySegments(options, "selection", "pinned-bottom", "left", () => buildPaneOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    visiblePinnedBottomSelectionOverlayMetricsList.value,
    "left",
    "selection",
    selectionOverlayOptions,
    bottomViewportHeight.value,
  ))

  const leftPinnedBottomSelectionSeamOverlaySegments = computedOverlaySegments(options, "selection", "pinned-bottom-seam", "left", () => buildPinnedPaneSeamOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    visiblePinnedBottomSelectionOverlayMetricsList.value,
    "left",
    "selection",
    selectionOverlayOptions,
    bottomViewportHeight.value,
  ))

  const centerPinnedBottomSelectionOverlaySegments = computedOverlaySegments(options, "selection", "pinned-bottom", "center", () => buildPaneOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    visiblePinnedBottomSelectionOverlayMetricsList.value,
    "center",
    "selection",
    selectionOverlayOptions,
    bottomViewportHeight.value,
  ))

  const rightPinnedBottomSelectionOverlaySegments = computedOverlaySegments(options, "selection", "pinned-bottom", "right", () => buildPaneOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    visiblePinnedBottomSelectionOverlayMetricsList.value,
    "right",
    "selection",
    selectionOverlayOptions,
    bottomViewportHeight.value,
  ))

  const rightPinnedBottomSelectionSeamOverlaySegments = computedOverlaySegments(options, "selection", "pinned-bottom-seam", "right", () => buildPinnedPaneSeamOverlaySegmentsForMetricsList(
    options.overlayGeometryContext.value,
    visiblePinnedBottomSelectionOverlayMetricsList.value,
    "right",
    "selection",
    selectionOverlayOptions,
    bottomViewportHeight.value,
  ))

  const leftFillPreviewOverlaySegments = computedOverlaySegments(options, "fill-preview", "body", "left", () => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    bodyFillPreviewOverlayMetrics.value,
    "left",
    "fill-preview",
    fillPreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const leftFillPreviewSeamOverlaySegments = computedOverlaySegments(options, "fill-preview", "body-seam", "left", () => buildPinnedPaneSeamOverlaySegments(
    options.overlayGeometryContext.value,
    bodyPinnedPaneSeamFillPreviewOverlayMetrics.value,
    "left",
    "fill-preview",
    fillPreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const centerFillPreviewOverlaySegments = computedOverlaySegments(options, "fill-preview", "body", "center", () => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    bodyFillPreviewOverlayMetrics.value,
    "center",
    "fill-preview",
    fillPreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const rightFillPreviewOverlaySegments = computedOverlaySegments(options, "fill-preview", "body", "right", () => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    bodyFillPreviewOverlayMetrics.value,
    "right",
    "fill-preview",
    fillPreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const rightFillPreviewSeamOverlaySegments = computedOverlaySegments(options, "fill-preview", "body-seam", "right", () => buildPinnedPaneSeamOverlaySegments(
    options.overlayGeometryContext.value,
    bodyPinnedPaneSeamFillPreviewOverlayMetrics.value,
    "right",
    "fill-preview",
    fillPreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const leftPinnedBottomFillPreviewOverlaySegments = computedOverlaySegments(options, "fill-preview", "pinned-bottom", "left", () => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomFillPreviewOverlayMetrics.value,
    "left",
    "fill-preview",
    fillPreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const leftPinnedBottomFillPreviewSeamOverlaySegments = computedOverlaySegments(options, "fill-preview", "pinned-bottom-seam", "left", () => buildPinnedPaneSeamOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomFillPreviewOverlayMetrics.value,
    "left",
    "fill-preview",
    fillPreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const centerPinnedBottomFillPreviewOverlaySegments = computedOverlaySegments(options, "fill-preview", "pinned-bottom", "center", () => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomFillPreviewOverlayMetrics.value,
    "center",
    "fill-preview",
    fillPreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const rightPinnedBottomFillPreviewOverlaySegments = computedOverlaySegments(options, "fill-preview", "pinned-bottom", "right", () => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomFillPreviewOverlayMetrics.value,
    "right",
    "fill-preview",
    fillPreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const rightPinnedBottomFillPreviewSeamOverlaySegments = computedOverlaySegments(options, "fill-preview", "pinned-bottom-seam", "right", () => buildPinnedPaneSeamOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomFillPreviewOverlayMetrics.value,
    "right",
    "fill-preview",
    fillPreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const leftMovePreviewOverlaySegments = computedOverlaySegments(options, "move-preview", "body", "left", () => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    bodyMovePreviewOverlayMetrics.value,
    "left",
    "move-preview",
    movePreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const leftMovePreviewSeamOverlaySegments = computedOverlaySegments(options, "move-preview", "body-seam", "left", () => buildPinnedPaneSeamOverlaySegments(
    options.overlayGeometryContext.value,
    bodyPinnedPaneSeamMovePreviewOverlayMetrics.value,
    "left",
    "move-preview",
    movePreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const centerMovePreviewOverlaySegments = computedOverlaySegments(options, "move-preview", "body", "center", () => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    bodyMovePreviewOverlayMetrics.value,
    "center",
    "move-preview",
    movePreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const rightMovePreviewOverlaySegments = computedOverlaySegments(options, "move-preview", "body", "right", () => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    bodyMovePreviewOverlayMetrics.value,
    "right",
    "move-preview",
    movePreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const rightMovePreviewSeamOverlaySegments = computedOverlaySegments(options, "move-preview", "body-seam", "right", () => buildPinnedPaneSeamOverlaySegments(
    options.overlayGeometryContext.value,
    bodyPinnedPaneSeamMovePreviewOverlayMetrics.value,
    "right",
    "move-preview",
    movePreviewOverlayOptions,
    bodyViewportHeight.value,
  ))

  const leftPinnedBottomMovePreviewOverlaySegments = computedOverlaySegments(options, "move-preview", "pinned-bottom", "left", () => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomMovePreviewOverlayMetrics.value,
    "left",
    "move-preview",
    movePreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const leftPinnedBottomMovePreviewSeamOverlaySegments = computedOverlaySegments(options, "move-preview", "pinned-bottom-seam", "left", () => buildPinnedPaneSeamOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomMovePreviewOverlayMetrics.value,
    "left",
    "move-preview",
    movePreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const centerPinnedBottomMovePreviewOverlaySegments = computedOverlaySegments(options, "move-preview", "pinned-bottom", "center", () => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomMovePreviewOverlayMetrics.value,
    "center",
    "move-preview",
    movePreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const rightPinnedBottomMovePreviewOverlaySegments = computedOverlaySegments(options, "move-preview", "pinned-bottom", "right", () => buildPaneOverlaySegments(
    options.overlayGeometryContext.value,
    visiblePinnedBottomMovePreviewOverlayMetrics.value,
    "right",
    "move-preview",
    movePreviewOverlayOptions,
    bottomViewportHeight.value,
  ))

  const rightPinnedBottomMovePreviewSeamOverlaySegments = computedOverlaySegments(options, "move-preview", "pinned-bottom-seam", "right", () => buildPinnedPaneSeamOverlaySegments(
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
      body: normalizeBodyOverlayMetricsList(body, bodyOverlayRowOrigin.value),
      bodyPinnedPaneSeam: normalizeBodyPinnedPaneSeamMetricsList(body, options.bodyViewportScrollTop.value),
      pinnedBottom: resolveOverlayMetricsList(
        overlay.ranges,
        options.resolvePinnedBottomVisibleRangeBounds,
        options.pinnedBottomRowMetrics.value,
      ),
    }
  }))

  const leftCustomOverlayLanes = computedOverlayLanes(options, "custom", "body", "left", () => customOverlayMetrics.value
    .map(({ overlay, body }) => buildCustomOverlayLane(options.overlayGeometryContext.value, overlay, "left", body))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const centerCustomOverlayLanes = computedOverlayLanes(options, "custom", "body", "center", () => customOverlayMetrics.value
    .map(({ overlay, body }) => buildCustomOverlayLane(options.overlayGeometryContext.value, overlay, "center", body))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const rightCustomOverlayLanes = computedOverlayLanes(options, "custom", "body", "right", () => customOverlayMetrics.value
    .map(({ overlay, body }) => buildCustomOverlayLane(options.overlayGeometryContext.value, overlay, "right", body))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const leftCustomSeamOverlayLanes = computedOverlayLanes(options, "custom", "body-seam", "left", () => customOverlayMetrics.value
    .map(({ overlay, bodyPinnedPaneSeam }) => buildCustomSeamOverlayLane(options.overlayGeometryContext.value, overlay, "left", bodyPinnedPaneSeam))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const rightCustomSeamOverlayLanes = computedOverlayLanes(options, "custom", "body-seam", "right", () => customOverlayMetrics.value
    .map(({ overlay, bodyPinnedPaneSeam }) => buildCustomSeamOverlayLane(options.overlayGeometryContext.value, overlay, "right", bodyPinnedPaneSeam))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const leftPinnedBottomCustomOverlayLanes = computedOverlayLanes(options, "custom", "pinned-bottom", "left", () => customOverlayMetrics.value
    .map(({ overlay, pinnedBottom }) => buildCustomOverlayLane(options.overlayGeometryContext.value, overlay, "left", pinnedBottom, bottomViewportHeight.value))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const centerPinnedBottomCustomOverlayLanes = computedOverlayLanes(options, "custom", "pinned-bottom", "center", () => customOverlayMetrics.value
    .map(({ overlay, pinnedBottom }) => buildCustomOverlayLane(options.overlayGeometryContext.value, overlay, "center", pinnedBottom, bottomViewportHeight.value))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const rightPinnedBottomCustomOverlayLanes = computedOverlayLanes(options, "custom", "pinned-bottom", "right", () => customOverlayMetrics.value
    .map(({ overlay, pinnedBottom }) => buildCustomOverlayLane(options.overlayGeometryContext.value, overlay, "right", pinnedBottom, bottomViewportHeight.value))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const leftPinnedBottomCustomSeamOverlayLanes = computedOverlayLanes(options, "custom", "pinned-bottom-seam", "left", () => customOverlayMetrics.value
    .map(({ overlay, pinnedBottom }) => buildCustomSeamOverlayLane(options.overlayGeometryContext.value, overlay, "left", pinnedBottom, bottomViewportHeight.value))
    .filter((lane): lane is DataGridTableStageOverlayLane => lane != null))

  const rightPinnedBottomCustomSeamOverlayLanes = computedOverlayLanes(options, "custom", "pinned-bottom-seam", "right", () => customOverlayMetrics.value
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
