export type DataGridChromeRowMetric = {
  top: number
  height: number
}

export type DataGridChromeLine = {
  position: number
}

export type DataGridChromeVisibleRange = {
  start: number
  end: number
}

export type DataGridChromeRowBand = {
  rowIndex?: number
  top: number
  height: number
  kind: string
}

export type DataGridChromeBand = {
  top: number
  height: number
  kind: string
}

export type DataGridChromePaneModel = {
  width: number
  height: number
  bands: readonly DataGridChromeBand[]
  horizontalLines: readonly DataGridChromeLine[]
  verticalLines: readonly DataGridChromeLine[]
}

export type DataGridChromeRenderModel = {
  left: DataGridChromePaneModel
  center: DataGridChromePaneModel
  right: DataGridChromePaneModel
}

export type BuildDataGridChromePaneModelInput = {
  width: number
  height: number
  rowMetrics: readonly DataGridChromeRowMetric[]
  rowBands?: readonly DataGridChromeRowBand[]
  visibleRowRange?: DataGridChromeVisibleRange | null
  scrollTop?: number
  columnWidths: readonly number[]
  visibleColumnRange?: DataGridChromeVisibleRange | null
  scrollLeft?: number
}

export type BuildDataGridChromeRenderModelInput = {
  rowMetrics: readonly DataGridChromeRowMetric[]
  rowBands?: readonly DataGridChromeRowBand[]
  visibleRowRange?: DataGridChromeVisibleRange | null
  scrollTop?: number
  leftPaneWidth: number
  centerPaneWidth: number
  rightPaneWidth: number
  viewportHeight: number
  leftColumnWidths: readonly number[]
  leftVisibleColumnRange?: DataGridChromeVisibleRange | null
  centerColumnWidths: readonly number[]
  centerVisibleColumnRange?: DataGridChromeVisibleRange | null
  rightColumnWidths: readonly number[]
  rightVisibleColumnRange?: DataGridChromeVisibleRange | null
  centerScrollLeft?: number
}
