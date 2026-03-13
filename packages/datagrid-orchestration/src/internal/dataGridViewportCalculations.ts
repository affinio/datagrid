export interface DataGridViewportMeasuredState {
  viewportHeight: number
  viewportWidth: number
  headerHeight: number
}

export interface ComputeDataGridViewportMeasuredStateOptions {
  viewportClientHeight: number
  viewportClientWidth: number
  currentHeaderHeight: number
  measuredHeaderHeight: number | null
  rowHeight: number
  minViewportBodyHeight: number
}

export interface DataGridVisibleRowsRangeLike {
  start: number
  end: number
}

export function computeDataGridViewportMeasuredState(
  options: ComputeDataGridViewportMeasuredStateOptions,
): DataGridViewportMeasuredState {
  const resolvedRowHeight = Number.isFinite(options.rowHeight) && options.rowHeight > 0
    ? options.rowHeight
    : 1
  const headerHeight = options.measuredHeaderHeight === null
    ? options.currentHeaderHeight
    : options.measuredHeaderHeight
  const bodyHeight = Math.max(options.minViewportBodyHeight, options.viewportClientHeight - headerHeight)
  const rowCount = Math.max(1, Math.ceil(bodyHeight / resolvedRowHeight))

  return {
    viewportHeight: rowCount * resolvedRowHeight,
    viewportWidth: options.viewportClientWidth,
    headerHeight,
  }
}

export function dataGridViewportStateEqual(
  left: DataGridViewportMeasuredState,
  right: DataGridViewportMeasuredState,
): boolean {
  return (
    left.viewportHeight === right.viewportHeight &&
    left.viewportWidth === right.viewportWidth &&
    left.headerHeight === right.headerHeight
  )
}

export function shouldSyncDataGridVisibleRows<TRowSource>(
  lastRowsRef: readonly TRowSource[] | null,
  lastRange: DataGridVisibleRowsRangeLike,
  rows: readonly TRowSource[],
  nextRange: DataGridVisibleRowsRangeLike,
): boolean {
  return !(lastRowsRef === rows && lastRange.start === nextRange.start && lastRange.end === nextRange.end)
}