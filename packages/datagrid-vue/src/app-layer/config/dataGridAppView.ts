/**
 * View configuration shared by the base DataGrid entrypoint.
 *
 * This module must remain independent from the optional Gantt package. The
 * Gantt adapter has its external type bridge under `src/gantt`.
 */
export type DataGridAppViewMode = "table" | "gantt"

export type DataGridGanttZoomLevel = "day" | "week" | "month"

export interface DataGridWorkingCalendar {
  workingWeekdays?: readonly number[] | null
  holidays?: readonly (Date | string | number)[] | null
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
