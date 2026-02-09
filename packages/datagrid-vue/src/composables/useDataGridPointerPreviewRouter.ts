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

export interface UseDataGridPointerPreviewRouterOptions<
  TCoord extends DataGridPointerPreviewCoord,
  TRange extends DataGridPointerPreviewRange,
> {
  isFillDragging: () => boolean
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
  buildExtendedRange: (baseRange: TRange, coord: TCoord) => TRange | null
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
  function applyFillPreviewFromPointer() {
    if (!options.isFillDragging()) {
      return
    }
    const pointer = options.resolveFillPointer()
    const baseRange = options.resolveFillBaseRange()
    if (!pointer || !baseRange) {
      return
    }
    const coord = options.resolveCellCoordFromPointer(pointer.clientX, pointer.clientY)
    if (!coord) {
      return
    }
    const preview = options.buildExtendedRange(baseRange, coord)
    if (!preview) {
      return
    }
    if (options.rangesEqual(options.resolveFillPreviewRange(), preview)) {
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
