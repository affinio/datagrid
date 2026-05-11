import { computed, type CSSProperties, type ComputedRef, type Ref } from "vue"
import type { ComponentPublicInstance } from "vue"
import type { DataGridTableStageBodyColumn, DataGridTableStageBodyRow } from "./dataGridTableStageBody.types"
import type { DataGridTableStageOverlayLane, DataGridTableStageOverlaySegment, DataGridTableStagePinnedPaneProps } from "./dataGridTableStageBody.types"

export interface UseDataGridStagePanesOptions {
  leftPaneWidth: Readonly<Ref<number>>
  rightPaneWidth: Readonly<Ref<number>>
  leftPaneContentRef: Ref<HTMLElement | null>
  rightPaneContentRef: Ref<HTMLElement | null>
  leftBottomPaneContentRef: Ref<HTMLElement | null>
  rightBottomPaneContentRef: Ref<HTMLElement | null>
  displayRows: Readonly<Ref<readonly DataGridTableStageBodyRow[]>>
  pinnedBottomRows: Readonly<Ref<readonly DataGridTableStageBodyRow[]>>
  showRowIndex: Readonly<Ref<boolean>>
  pinnedLeftColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>
  pinnedRightColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>
  leftSelectionOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  leftSelectionSeamOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  centerSelectionOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  rightSelectionOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  rightSelectionSeamOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  leftPinnedBottomSelectionOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  leftPinnedBottomSelectionSeamOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  centerPinnedBottomSelectionOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  rightPinnedBottomSelectionOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  rightPinnedBottomSelectionSeamOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  leftFillPreviewOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  leftFillPreviewSeamOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  centerFillPreviewOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  rightFillPreviewOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  rightFillPreviewSeamOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  leftPinnedBottomFillPreviewOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  leftPinnedBottomFillPreviewSeamOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  centerPinnedBottomFillPreviewOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  rightPinnedBottomFillPreviewOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  rightPinnedBottomFillPreviewSeamOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  leftMovePreviewOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  leftMovePreviewSeamOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  centerMovePreviewOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  rightMovePreviewOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  rightMovePreviewSeamOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  leftPinnedBottomMovePreviewOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  leftPinnedBottomMovePreviewSeamOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  centerPinnedBottomMovePreviewOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  rightPinnedBottomMovePreviewOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  rightPinnedBottomMovePreviewSeamOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>
  leftCustomOverlayLanes: Readonly<Ref<readonly DataGridTableStageOverlayLane[]>>
  centerCustomOverlayLanes: Readonly<Ref<readonly DataGridTableStageOverlayLane[]>>
  rightCustomOverlayLanes: Readonly<Ref<readonly DataGridTableStageOverlayLane[]>>
  leftCustomSeamOverlayLanes: Readonly<Ref<readonly DataGridTableStageOverlayLane[]>>
  rightCustomSeamOverlayLanes: Readonly<Ref<readonly DataGridTableStageOverlayLane[]>>
  leftPinnedBottomCustomOverlayLanes: Readonly<Ref<readonly DataGridTableStageOverlayLane[]>>
  centerPinnedBottomCustomOverlayLanes: Readonly<Ref<readonly DataGridTableStageOverlayLane[]>>
  rightPinnedBottomCustomOverlayLanes: Readonly<Ref<readonly DataGridTableStageOverlayLane[]>>
  leftPinnedBottomCustomSeamOverlayLanes: Readonly<Ref<readonly DataGridTableStageOverlayLane[]>>
  rightPinnedBottomCustomSeamOverlayLanes: Readonly<Ref<readonly DataGridTableStageOverlayLane[]>>
  bodyViewportClientWidth: Readonly<Ref<number>>
  bodyViewportClientHeight: Readonly<Ref<number>>
  pinnedBottomViewportClientHeight: Readonly<Ref<number>>
  headerShellHeight: Readonly<Ref<number>>
  headerViewportClientWidth: Readonly<Ref<number>>
}

export interface UseDataGridStagePanesResult {
  paneLayoutStyle: ComputedRef<CSSProperties>
  leftPaneStyle: ComputedRef<CSSProperties>
  rightPaneStyle: ComputedRef<CSSProperties>
  leftTrackStyle: ComputedRef<CSSProperties>
  rightTrackStyle: ComputedRef<CSSProperties>
  centerHeaderChromeCanvasStyle: ComputedRef<CSSProperties>
  centerChromeCanvasStyle: ComputedRef<CSSProperties>
  centerBottomChromeCanvasStyle: ComputedRef<CSSProperties>
  leftPinnedPane: ComputedRef<DataGridTableStagePinnedPaneProps>
  rightPinnedPane: ComputedRef<DataGridTableStagePinnedPaneProps>
  leftPinnedBottomPane: ComputedRef<DataGridTableStagePinnedPaneProps>
  rightPinnedBottomPane: ComputedRef<DataGridTableStagePinnedPaneProps>
}

function resolveElementRef(value: Element | ComponentPublicInstance | null): HTMLElement | null {
  if (value instanceof HTMLElement) {
    return value
  }
  if (value && "$el" in value) {
    const element = value.$el
    return element instanceof HTMLElement ? element : null
  }
  return null
}

function createFixedWidthStyle(width: Readonly<Ref<number>>): ComputedRef<CSSProperties> {
  return computed(() => ({
    width: `${width.value}px`,
    minWidth: `${width.value}px`,
    maxWidth: `${width.value}px`,
  }))
}

function createPaneProps(
  side: "left" | "right",
  width: Readonly<Ref<number>>,
  style: ComputedRef<CSSProperties>,
  contentRef: Ref<HTMLElement | null>,
  columns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>,
  showIndexColumn: Readonly<Ref<boolean>>,
  displayRows: Readonly<Ref<readonly DataGridTableStageBodyRow[]>>,
  selectionOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>,
  fillPreviewOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>,
  movePreviewOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>,
  overlayLanes: Readonly<Ref<readonly DataGridTableStageOverlayLane[]>>,
  selectionSeamOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>,
  fillPreviewSeamOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>,
  movePreviewSeamOverlaySegments: Readonly<Ref<readonly DataGridTableStageOverlaySegment[]>>,
  seamOverlayLanes: Readonly<Ref<readonly DataGridTableStageOverlayLane[]>>,
): ComputedRef<DataGridTableStagePinnedPaneProps> {
  return computed(() => ({
    side,
    width: width.value,
    style: style.value,
    contentStyle: {} as CSSProperties,
    contentRef: value => {
      contentRef.value = resolveElementRef(value as Element | ComponentPublicInstance | null)
    },
    columns: columns.value,
    showIndexColumn: showIndexColumn.value,
    displayRows: displayRows.value,
    selectionOverlaySegments: selectionOverlaySegments.value,
    fillPreviewOverlaySegments: fillPreviewOverlaySegments.value,
    movePreviewOverlaySegments: movePreviewOverlaySegments.value,
    overlayLanes: overlayLanes.value,
    selectionSeamOverlaySegments: selectionSeamOverlaySegments.value,
    fillPreviewSeamOverlaySegments: fillPreviewSeamOverlaySegments.value,
    movePreviewSeamOverlaySegments: movePreviewSeamOverlaySegments.value,
    seamOverlayLanes: seamOverlayLanes.value,
  }))
}

export function useDataGridStagePanes(options: UseDataGridStagePanesOptions): UseDataGridStagePanesResult {
  const leftPaneWidth = options.leftPaneWidth
  const rightPaneWidth = options.rightPaneWidth

  const paneLayoutStyle = computed<CSSProperties>(() => ({
    gridTemplateColumns: `${leftPaneWidth.value}px minmax(0, 1fr) ${rightPaneWidth.value}px`,
  }))

  const leftPaneStyle = createFixedWidthStyle(leftPaneWidth)
  const rightPaneStyle = createFixedWidthStyle(rightPaneWidth)
  const leftTrackStyle = createFixedWidthStyle(leftPaneWidth)
  const rightTrackStyle = createFixedWidthStyle(rightPaneWidth)

  const centerHeaderChromeCanvasStyle = computed<CSSProperties>(() => ({
    left: `${leftPaneWidth.value}px`,
    width: `${Math.max(0, options.headerViewportClientWidth.value)}px`,
    height: `${Math.max(0, options.headerShellHeight.value)}px`,
  }))

  const centerChromeCanvasStyle = computed<CSSProperties>(() => ({
    left: `${leftPaneWidth.value}px`,
    width: `${Math.max(0, options.bodyViewportClientWidth.value)}px`,
    height: `${Math.max(0, options.bodyViewportClientHeight.value)}px`,
  }))

  const centerBottomChromeCanvasStyle = computed<CSSProperties>(() => ({
    left: `${leftPaneWidth.value}px`,
    width: `${Math.max(0, options.bodyViewportClientWidth.value)}px`,
    height: `${Math.max(0, options.pinnedBottomViewportClientHeight.value)}px`,
  }))

  const leftPinnedPane = createPaneProps(
    "left",
    leftPaneWidth,
    leftPaneStyle,
    options.leftPaneContentRef,
    options.pinnedLeftColumns,
    options.showRowIndex,
    options.displayRows,
    options.leftSelectionOverlaySegments,
    options.leftFillPreviewOverlaySegments,
    options.leftMovePreviewOverlaySegments,
    options.leftCustomOverlayLanes,
    options.leftSelectionSeamOverlaySegments,
    options.leftFillPreviewSeamOverlaySegments,
    options.leftMovePreviewSeamOverlaySegments,
    options.leftCustomSeamOverlayLanes,
  )

  const rightPinnedPane = createPaneProps(
    "right",
    rightPaneWidth,
    rightPaneStyle,
    options.rightPaneContentRef,
    options.pinnedRightColumns,
    computed(() => false),
    options.displayRows,
    options.rightSelectionOverlaySegments,
    options.rightFillPreviewOverlaySegments,
    options.rightMovePreviewOverlaySegments,
    options.rightCustomOverlayLanes,
    options.rightSelectionSeamOverlaySegments,
    options.rightFillPreviewSeamOverlaySegments,
    options.rightMovePreviewSeamOverlaySegments,
    options.rightCustomSeamOverlayLanes,
  )

  const leftPinnedBottomPane = createPaneProps(
    "left",
    leftPaneWidth,
    leftPaneStyle,
    options.leftBottomPaneContentRef,
    options.pinnedLeftColumns,
    options.showRowIndex,
    options.pinnedBottomRows,
    options.leftPinnedBottomSelectionOverlaySegments,
    options.leftPinnedBottomFillPreviewOverlaySegments,
    options.leftPinnedBottomMovePreviewOverlaySegments,
    options.leftPinnedBottomCustomOverlayLanes,
    options.leftPinnedBottomSelectionSeamOverlaySegments,
    options.leftPinnedBottomFillPreviewSeamOverlaySegments,
    options.leftPinnedBottomMovePreviewSeamOverlaySegments,
    options.leftPinnedBottomCustomSeamOverlayLanes,
  )

  const rightPinnedBottomPane = createPaneProps(
    "right",
    rightPaneWidth,
    rightPaneStyle,
    options.rightBottomPaneContentRef,
    options.pinnedRightColumns,
    computed(() => false),
    options.pinnedBottomRows,
    options.rightPinnedBottomSelectionOverlaySegments,
    options.rightPinnedBottomFillPreviewOverlaySegments,
    options.rightPinnedBottomMovePreviewOverlaySegments,
    options.rightPinnedBottomCustomOverlayLanes,
    options.rightPinnedBottomSelectionSeamOverlaySegments,
    options.rightPinnedBottomFillPreviewSeamOverlaySegments,
    options.rightPinnedBottomMovePreviewSeamOverlaySegments,
    options.rightPinnedBottomCustomSeamOverlayLanes,
  )

  return {
    paneLayoutStyle,
    leftPaneStyle,
    rightPaneStyle,
    leftTrackStyle,
    rightTrackStyle,
    centerHeaderChromeCanvasStyle,
    centerChromeCanvasStyle,
    centerBottomChromeCanvasStyle,
    leftPinnedPane,
    rightPinnedPane,
    leftPinnedBottomPane,
    rightPinnedBottomPane,
  }
}
