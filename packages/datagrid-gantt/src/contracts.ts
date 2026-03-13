import type { DataGridRowNode } from "@affino/datagrid-core"

export type DataGridGanttZoomLevel = "day" | "week" | "month"
export type DataGridGanttDependencyValue = readonly string[] | string[] | string | null | undefined

export interface DataGridGanttOptions {
  startKey?: string
  endKey?: string
  progressKey?: string | null
  dependencyKey?: string | null
  labelKey?: string | null
  idKey?: string | null
  criticalKey?: string | null
  paneWidth?: number
  pixelsPerDay?: number
  zoomLevel?: DataGridGanttZoomLevel
  timelineStart?: Date | string | number | null
  timelineEnd?: Date | string | number | null
  rowBarHeight?: number
  minBarWidth?: number
  resizeHandleWidth?: number
}

export type DataGridGanttProp = boolean | DataGridGanttOptions

export interface DataGridResolvedGanttOptions {
  startKey: string
  endKey: string
  progressKey: string | null
  dependencyKey: string | null
  labelKey: string | null
  idKey: string | null
  criticalKey: string | null
  paneWidth: number
  pixelsPerDay: number
  zoomLevel: DataGridGanttZoomLevel
  timelineStart: Date | string | number | null
  timelineEnd: Date | string | number | null
  rowBarHeight: number
  minBarWidth: number
  resizeHandleWidth: number
}

export interface DataGridGanttTimelineState {
  startMs: number
  endMs: number
  pixelsPerDay: number
  totalWidth: number
  zoomLevel: DataGridGanttZoomLevel
}

export interface DataGridGanttBarFrame {
  x: number
  width: number
  y: number
  height: number
}

export interface DataGridGanttBarLayout<TRow = unknown> extends DataGridGanttBarFrame {
  row: DataGridRowNode<TRow>
  rowId: string
  rowUpdateId: string | number
  taskId: string
  rowIndex: number
  label: string
  dependencies: readonly string[]
  critical: boolean
  progress: number
  startMs: number
  endMs: number
}

export type DataGridGanttHitMode = "move" | "resize-start" | "resize-end"

export interface DataGridGanttHitTarget<TRow = unknown> {
  bar: DataGridGanttBarLayout<TRow>
  mode: DataGridGanttHitMode
}

export interface DataGridGanttRowReader<TRow = unknown> {
  getCount: () => number
  get: (index: number) => DataGridRowNode<TRow> | undefined
}

export interface BuildDataGridGanttVisibleBarsInput<TRow = unknown> {
  rows: readonly DataGridRowNode<TRow>[]
  viewportRowStart: number
  scrollTop: number
  topSpacerHeight: number
  viewportHeight: number
  baseRowHeight: number
  resolveRowHeight: (rowIndex: number) => number
  timeline: DataGridGanttTimelineState
  options: DataGridResolvedGanttOptions
}

export interface DataGridGanttDragRange {
  startMs: number
  endMs: number
}

export interface DataGridGanttDependencyPath<TRow = unknown> {
  dependencyTaskId: string
  sourceBar: DataGridGanttBarLayout<TRow>
  targetBar: DataGridGanttBarLayout<TRow>
  points: readonly { x: number; y: number }[]
}

export interface BuildDataGridGanttDependencyPathsInput<TRow = unknown> {
  bars: readonly DataGridGanttBarLayout<TRow>[]
  resolveFrame?: (bar: DataGridGanttBarLayout<TRow>) => DataGridGanttBarFrame
  minBendPx?: number
}

export interface DataGridGanttRowEditPatch {
  rowId: string | number
  data: Record<string, Date>
}
