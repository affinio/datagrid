import { detectFullColumnSelectionIndex, type SelectionGeometryRange } from "./selectionGeometry"

export interface HeadlessSelectionStateLike<RowKey> {
  ranges: SelectionGeometryRange<RowKey>[]
  areas: Array<{ startRow: number; endRow: number; startCol: number; endCol: number }>
  activeRangeIndex: number
  selectedPoint: { rowIndex: number; colIndex: number; rowId?: RowKey | null } | null
  anchorPoint: { rowIndex: number; colIndex: number; rowId?: RowKey | null } | null
  dragAnchorPoint: { rowIndex: number; colIndex: number; rowId?: RowKey | null } | null
}

export interface SelectionSharedStatePatchTarget<RowKey> {
  patch(input: {
    selectionRanges: HeadlessSelectionStateLike<RowKey>["ranges"]
    selectionAreas: HeadlessSelectionStateLike<RowKey>["areas"]
    activeRangeIndex: number
    selectedCell: HeadlessSelectionStateLike<RowKey>["selectedPoint"]
    anchorCell: HeadlessSelectionStateLike<RowKey>["anchorPoint"]
    dragAnchorCell: HeadlessSelectionStateLike<RowKey>["dragAnchorPoint"]
  }): void
}

export function syncSelectionFromControllerState<RowKey>(
  sharedState: SelectionSharedStatePatchTarget<RowKey>,
  state: HeadlessSelectionStateLike<RowKey>,
): void {
  sharedState.patch({
    selectionRanges: state.ranges,
    selectionAreas: state.areas,
    activeRangeIndex: state.activeRangeIndex,
    selectedCell: state.selectedPoint,
    anchorCell: state.anchorPoint,
    dragAnchorCell: state.dragAnchorPoint,
  })
}

export function reconcileSelectionState<RowKey>(input: {
  state: HeadlessSelectionStateLike<RowKey>
  grid: { rowCount: number; colCount: number }
  existingColumnSelection: { column: number; anchorRow: number | null } | null
  selectedPointRowIndex: number | null
  setColumnSelectionState: (column: number, anchorRow: number | null) => void
  clearColumnSelectionState: () => void
  setSelectionDragSession: (value: null) => void
  setFillSession: (value: null) => void
  setFillDragging: (value: boolean) => void
}): void {
  const {
    state,
    grid,
    existingColumnSelection,
    selectedPointRowIndex,
    setColumnSelectionState,
    clearColumnSelectionState,
    setSelectionDragSession,
    setFillSession,
    setFillDragging,
  } = input

  const detectedColumn = detectFullColumnSelectionIndex(state.ranges, grid)
  if (detectedColumn !== null) {
    const anchorRow = existingColumnSelection?.anchorRow ?? selectedPointRowIndex ?? null
    setColumnSelectionState(detectedColumn, anchorRow)
  } else if (!existingColumnSelection) {
    clearColumnSelectionState()
  }

  if (!state.ranges.length) {
    setSelectionDragSession(null)
    setFillSession(null)
    setFillDragging(false)
    return
  }

  setFillSession(null)
  setFillDragging(false)
}
