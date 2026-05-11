import { computed, type CSSProperties, type ComputedRef, type Ref } from "vue"
import type { ComponentPublicInstance } from "vue"
import type { DataGridTableStageBodyColumn, DataGridTableStageBodyRow } from "./dataGridTableStageBody.types"
import type { DataGridTableStageOverlayLane, DataGridTableStageOverlaySegment, DataGridTableStagePinnedPaneProps } from "./dataGridTableStageBody.types"

type LayoutRuntime = Readonly<Ref<{
  leftPaneWidth: number
  rightPaneWidth: number
  bodyViewportClientWidth: number
  bodyViewportClientHeight: number
  pinnedBottomViewportClientHeight: number
  headerShellHeight: number
  headerViewportClientWidth: number
}>>

type PaneRuntime = Readonly<Ref<{
  leftPaneContentRef: Ref<HTMLElement | null>
  rightPaneContentRef: Ref<HTMLElement | null>
  leftBottomPaneContentRef: Ref<HTMLElement | null>
  rightBottomPaneContentRef: Ref<HTMLElement | null>
  displayRows: Readonly<Ref<readonly DataGridTableStageBodyRow[]>>
  pinnedBottomRows: Readonly<Ref<readonly DataGridTableStageBodyRow[]>>
  showRowIndex: Readonly<Ref<boolean>>
  pinnedLeftColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>
  pinnedRightColumns: Readonly<Ref<readonly DataGridTableStageBodyColumn[]>>
}>>

type OverlayRuntime = Readonly<Ref<{
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
}>>

export interface UseDataGridStagePanesOptions {
  layoutRuntime: LayoutRuntime
  paneRuntime: PaneRuntime
  overlayRuntime: OverlayRuntime
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
  const leftPaneWidth = computed(() => options.layoutRuntime.value.leftPaneWidth)
  const rightPaneWidth = computed(() => options.layoutRuntime.value.rightPaneWidth)

  const paneLayoutStyle = computed<CSSProperties>(() => ({
    gridTemplateColumns: `${leftPaneWidth.value}px minmax(0, 1fr) ${rightPaneWidth.value}px`,
  }))

  const leftPaneStyle = createFixedWidthStyle(leftPaneWidth)
  const rightPaneStyle = createFixedWidthStyle(rightPaneWidth)
  const leftTrackStyle = createFixedWidthStyle(leftPaneWidth)
  const rightTrackStyle = createFixedWidthStyle(rightPaneWidth)

  const centerHeaderChromeCanvasStyle = computed<CSSProperties>(() => ({
    left: `${leftPaneWidth.value}px`,
    width: `${Math.max(0, options.layoutRuntime.value.headerViewportClientWidth)}px`,
    height: `${Math.max(0, options.layoutRuntime.value.headerShellHeight)}px`,
  }))

  const centerChromeCanvasStyle = computed<CSSProperties>(() => ({
    left: `${leftPaneWidth.value}px`,
    width: `${Math.max(0, options.layoutRuntime.value.bodyViewportClientWidth)}px`,
    height: `${Math.max(0, options.layoutRuntime.value.bodyViewportClientHeight)}px`,
  }))

  const centerBottomChromeCanvasStyle = computed<CSSProperties>(() => ({
    left: `${leftPaneWidth.value}px`,
    width: `${Math.max(0, options.layoutRuntime.value.bodyViewportClientWidth)}px`,
    height: `${Math.max(0, options.layoutRuntime.value.pinnedBottomViewportClientHeight)}px`,
  }))

  const leftPinnedPane = createPaneProps(
    "left",
    leftPaneWidth,
    leftPaneStyle,
    options.paneRuntime.value.leftPaneContentRef,
    options.paneRuntime.value.pinnedLeftColumns,
    options.paneRuntime.value.showRowIndex,
    options.paneRuntime.value.displayRows,
    options.overlayRuntime.value.leftSelectionOverlaySegments,
    options.overlayRuntime.value.leftFillPreviewOverlaySegments,
    options.overlayRuntime.value.leftMovePreviewOverlaySegments,
    options.overlayRuntime.value.leftCustomOverlayLanes,
    options.overlayRuntime.value.leftSelectionSeamOverlaySegments,
    options.overlayRuntime.value.leftFillPreviewSeamOverlaySegments,
    options.overlayRuntime.value.leftMovePreviewSeamOverlaySegments,
    options.overlayRuntime.value.leftCustomSeamOverlayLanes,
  )

  const rightPinnedPane = createPaneProps(
    "right",
    rightPaneWidth,
    rightPaneStyle,
    options.paneRuntime.value.rightPaneContentRef,
    options.paneRuntime.value.pinnedRightColumns,
    computed(() => false),
    options.paneRuntime.value.displayRows,
    options.overlayRuntime.value.rightSelectionOverlaySegments,
    options.overlayRuntime.value.rightFillPreviewOverlaySegments,
    options.overlayRuntime.value.rightMovePreviewOverlaySegments,
    options.overlayRuntime.value.rightCustomOverlayLanes,
    options.overlayRuntime.value.rightSelectionSeamOverlaySegments,
    options.overlayRuntime.value.rightFillPreviewSeamOverlaySegments,
    options.overlayRuntime.value.rightMovePreviewSeamOverlaySegments,
    options.overlayRuntime.value.rightCustomSeamOverlayLanes,
  )

  const leftPinnedBottomPane = createPaneProps(
    "left",
    leftPaneWidth,
    leftPaneStyle,
    options.paneRuntime.value.leftBottomPaneContentRef,
    options.paneRuntime.value.pinnedLeftColumns,
    options.paneRuntime.value.showRowIndex,
    options.paneRuntime.value.pinnedBottomRows,
    options.overlayRuntime.value.leftPinnedBottomSelectionOverlaySegments,
    options.overlayRuntime.value.leftPinnedBottomFillPreviewOverlaySegments,
    options.overlayRuntime.value.leftPinnedBottomMovePreviewOverlaySegments,
    options.overlayRuntime.value.leftPinnedBottomCustomOverlayLanes,
    options.overlayRuntime.value.leftPinnedBottomSelectionSeamOverlaySegments,
    options.overlayRuntime.value.leftPinnedBottomFillPreviewSeamOverlaySegments,
    options.overlayRuntime.value.leftPinnedBottomMovePreviewSeamOverlaySegments,
    options.overlayRuntime.value.leftPinnedBottomCustomSeamOverlayLanes,
  )

  const rightPinnedBottomPane = createPaneProps(
    "right",
    rightPaneWidth,
    rightPaneStyle,
    options.paneRuntime.value.rightBottomPaneContentRef,
    options.paneRuntime.value.pinnedRightColumns,
    computed(() => false),
    options.paneRuntime.value.pinnedBottomRows,
    options.overlayRuntime.value.rightPinnedBottomSelectionOverlaySegments,
    options.overlayRuntime.value.rightPinnedBottomFillPreviewOverlaySegments,
    options.overlayRuntime.value.rightPinnedBottomMovePreviewOverlaySegments,
    options.overlayRuntime.value.rightPinnedBottomCustomOverlayLanes,
    options.overlayRuntime.value.rightPinnedBottomSelectionSeamOverlaySegments,
    options.overlayRuntime.value.rightPinnedBottomFillPreviewSeamOverlaySegments,
    options.overlayRuntime.value.rightPinnedBottomMovePreviewSeamOverlaySegments,
    options.overlayRuntime.value.rightPinnedBottomCustomSeamOverlayLanes,
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
