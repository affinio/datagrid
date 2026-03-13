import type { DataGridRowNode } from "@affino/datagrid-core"

export type DataGridGanttZoomLevel = "day" | "week" | "month"
export type DataGridGanttDependencyValue = readonly string[] | string[] | string | null | undefined
export type DataGridGanttDependencyType = "FS" | "SS" | "FF" | "SF"

export interface DataGridGanttDependencyRef {
  taskId: string
  type: DataGridGanttDependencyType
  raw: string
}

export interface DataGridWorkingCalendar {
  workingWeekdays?: readonly number[] | null
  holidays?: readonly (Date | string | number)[] | null
}

export interface DataGridResolvedWorkingCalendar {
  workingWeekdays: readonly number[]
  holidayDayStarts: readonly number[]
  workingWeekdaySet: ReadonlySet<number>
  holidayDayStartSet: ReadonlySet<number>
}

export interface DataGridGanttOptions {
  startKey?: string
  endKey?: string
  baselineStartKey?: string | null
  baselineEndKey?: string | null
  progressKey?: string | null
  dependencyKey?: string | null
  labelKey?: string | null
  idKey?: string | null
  criticalKey?: string | null
  computedCriticalPath?: boolean
  paneWidth?: number
  pixelsPerDay?: number
  zoomLevel?: DataGridGanttZoomLevel
  timelineStart?: Date | string | number | null
  timelineEnd?: Date | string | number | null
  rangePaddingDays?: number
  workingCalendar?: DataGridWorkingCalendar | null
  rowBarHeight?: number
  minBarWidth?: number
  resizeHandleWidth?: number
}

export type DataGridGanttProp = boolean | DataGridGanttOptions

export interface DataGridResolvedGanttOptions {
  startKey: string
  endKey: string
  baselineStartKey: string | null
  baselineEndKey: string | null
  progressKey: string | null
  dependencyKey: string | null
  labelKey: string | null
  idKey: string | null
  criticalKey: string | null
  computedCriticalPath: boolean
  paneWidth: number
  pixelsPerDay: number
  zoomLevel: DataGridGanttZoomLevel
  timelineStart: Date | string | number | null
  timelineEnd: Date | string | number | null
  rangePaddingDays: number
  workingCalendar: DataGridResolvedWorkingCalendar
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

export type DataGridTimelineHorizontalAlign = "start" | "center" | "end"
export type DataGridGanttHorizontalAlign = DataGridTimelineHorizontalAlign

export interface DataGridTimelineViewport {
  scrollLeft: number
  viewportWidth: number
  startX: number
  endX: number
  startMs: number
  endMs: number
}

export interface DataGridTimelineSegment {
  key: string
  startMs: number
  endMs: number
  x: number
  width: number
  label: string
}

export interface DataGridTimelineLine {
  key: string
  dateMs: number
  x: number
}

export interface DataGridTimelineSpan {
  key: string
  startMs: number
  endMs: number
  x: number
  width: number
}

export interface DataGridTimelineModel {
  viewport: DataGridTimelineViewport
  primarySegments: readonly DataGridTimelineSegment[]
  secondarySegments: readonly DataGridTimelineSegment[]
  primaryLines: readonly DataGridTimelineLine[]
  secondaryLines: readonly DataGridTimelineLine[]
  nonWorkingSpans: readonly DataGridTimelineSpan[]
}

export interface DataGridTimelineRenderModels {
  header: DataGridTimelineModel
  body: DataGridTimelineModel
}

export interface DataGridTimelineRange {
  startMs: number
  endMs: number
  totalWidth: number
}

export interface ResolveDataGridTimelineRangeInput {
  minTaskDateMs?: number | null
  maxTaskDateMs?: number | null
  pixelsPerDay: number
  fallbackDateMs?: number | null
  fallbackDurationDays?: number
  rangePaddingDays?: number
}

export interface BuildDataGridTimelineModelInput {
  timeline: DataGridGanttTimelineState
  scrollLeft: number
  viewportWidth: number
  workingCalendar?: DataGridResolvedWorkingCalendar | null
  bufferPx?: number
}

export interface BuildDataGridTimelineRenderModelsInput {
  timeline: DataGridGanttTimelineState
  scrollLeft: number
  viewportWidth: number
  workingCalendar?: DataGridResolvedWorkingCalendar | null
  headerBufferPx?: number
  bodyBufferPx?: number
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
  dependencyRefs: readonly DataGridGanttDependencyRef[]
  critical: boolean
  criticalSource: "manual" | "computed" | null
  milestone: boolean
  summary: boolean
  progress: number
  startMs: number
  endMs: number
  baselineStartMs: number | null
  baselineEndMs: number | null
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
  rowMetrics?: readonly { top: number; height: number }[]
  viewportRowStart: number
  scrollTop: number
  topSpacerHeight: number
  viewportHeight: number
  baseRowHeight: number
  resolveRowHeight: (rowIndex: number) => number
  timeline: DataGridGanttTimelineState
  options: DataGridResolvedGanttOptions
  criticalTaskIds?: ReadonlySet<string> | null
}

export interface DataGridGanttDragRange {
  startMs: number
  endMs: number
}

export interface DataGridGanttDependencyPath<TRow = unknown> {
  dependencyTaskId: string
  dependencyType: DataGridGanttDependencyType
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

export interface DataGridGanttCriticalTaskNode {
  taskId: string
  rowId: string
  startMs: number
  endMs: number
  dependencyRefs: readonly DataGridGanttDependencyRef[]
}
