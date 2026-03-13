export interface DataGridPointerPreviewCoord {
  rowIndex: number
  columnIndex: number
}

export interface DataGridPointerPreviewRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface DataGridPointerPreviewCoordinates {
  clientX: number
  clientY: number
}

export type DataGridPointerPreviewFillAxis = "vertical" | "horizontal"

export interface UseDataGridPointerPreviewRouterOptions<
  TCoord extends DataGridPointerPreviewCoord,
  TRange extends DataGridPointerPreviewRange,
> {
  isFillDragging: () => boolean
  resolveFillDragStartPointer?: () => DataGridPointerPreviewCoordinates | null
  resolveFillPointer: () => DataGridPointerPreviewCoordinates | null
  resolveFillBaseRange: () => TRange | null
  resolveFillPreviewRange: () => TRange | null
  setFillPreviewRange: (range: TRange) => void
  isRangeMoving: () => boolean
  resolveRangeMovePointer: () => DataGridPointerPreviewCoordinates | null
  resolveRangeMoveBaseRange: () => TRange | null
  resolveRangeMoveOrigin: () => TCoord | null
  resolveRangeMovePreviewRange: () => TRange | null
  setRangeMovePreviewRange: (range: TRange) => void
  resolveCellCoordFromPointer: (clientX: number, clientY: number) => TCoord | null
  buildExtendedRange: (baseRange: TRange, coord: TCoord, fillAxis?: DataGridPointerPreviewFillAxis) => TRange | null
  normalizeSelectionRange: (range: TRange) => TRange | null
  rangesEqual: (a: TRange | null, b: TRange | null) => boolean
}

export interface UseDataGridPointerPreviewRouterResult {
  applyFillPreviewFromPointer: () => void
  applyRangeMovePreviewFromPointer: () => void
}

export function useDataGridPointerPreviewRouter<
  TCoord extends DataGridPointerPreviewCoord,
  TRange extends DataGridPointerPreviewRange,
>(
  options: UseDataGridPointerPreviewRouterOptions<TCoord, TRange>,
): UseDataGridPointerPreviewRouterResult {
  const fillPreviewPointerThresholdPx = 4
  const fillPreviewHorizontalAxisBiasPx = 10

  function resolveFillAxis(
    dragStartPointer: DataGridPointerPreviewCoordinates | null,
    pointer: DataGridPointerPreviewCoordinates,
  ): DataGridPointerPreviewFillAxis | undefined {
    if (!dragStartPointer) {
      return undefined
    }
    const deltaX = Math.abs(pointer.clientX - dragStartPointer.clientX)
    const deltaY = Math.abs(pointer.clientY - dragStartPointer.clientY)
    return deltaX > deltaY + fillPreviewHorizontalAxisBiasPx ? "horizontal" : "vertical"
  }

  function applyFillPreviewFromPointer() {
    if (!options.isFillDragging()) {
      return
    }
    const pointer = options.resolveFillPointer()
    const baseRange = options.resolveFillBaseRange()
    if (!pointer || !baseRange) {
      return
    }
    const currentPreview = options.resolveFillPreviewRange()
    const dragStartPointer = options.resolveFillDragStartPointer?.() ?? null
    if (
      currentPreview
      && dragStartPointer
      && !options.rangesEqual(currentPreview, baseRange)
      && Math.max(
        Math.abs(pointer.clientX - dragStartPointer.clientX),
        Math.abs(pointer.clientY - dragStartPointer.clientY),
      ) < fillPreviewPointerThresholdPx
    ) {
      return
    }
    const coord = options.resolveCellCoordFromPointer(pointer.clientX, pointer.clientY)
    if (!coord) {
      return
    }
    const preview = options.buildExtendedRange(baseRange, coord, resolveFillAxis(dragStartPointer, pointer))
    if (!preview) {
      return
    }
    if (options.rangesEqual(currentPreview, preview)) {
      return
    }
    options.setFillPreviewRange(preview)
  }

  function applyRangeMovePreviewFromPointer() {
    if (!options.isRangeMoving()) {
      return
    }
    const pointer = options.resolveRangeMovePointer()
    const baseRange = options.resolveRangeMoveBaseRange()
    const origin = options.resolveRangeMoveOrigin()
    if (!pointer || !baseRange || !origin) {
      return
    }
    const coord = options.resolveCellCoordFromPointer(pointer.clientX, pointer.clientY)
    if (!coord) {
      return
    }
    const rowDelta = coord.rowIndex - origin.rowIndex
    const columnDelta = coord.columnIndex - origin.columnIndex
    const preview = options.normalizeSelectionRange({
      startRow: baseRange.startRow + rowDelta,
      endRow: baseRange.endRow + rowDelta,
      startColumn: baseRange.startColumn + columnDelta,
      endColumn: baseRange.endColumn + columnDelta,
    } as TRange)
    if (!preview || options.rangesEqual(options.resolveRangeMovePreviewRange(), preview)) {
      return
    }
    options.setRangeMovePreviewRange(preview)
  }

  return {
    applyFillPreviewFromPointer,
    applyRangeMovePreviewFromPointer,
  }
}
