export interface ClampDataGridGanttTablePaneWidthInput {
  requestedWidth: number
  stageWidth: number
  minTableWidth?: number
  minTimelineWidth?: number
  maxTableWidth?: number | null
}

export interface ResolveDataGridGanttTablePaneDragInput {
  originWidth: number
  deltaX: number
  stageWidth: number
  minTableWidth?: number
  minTimelineWidth?: number
  maxTableWidth?: number | null
}

export const DATAGRID_GANTT_SPLITTER_SIZE_PX = 12
export const DATAGRID_GANTT_MIN_TABLE_PANE_WIDTH_PX = 280
export const DATAGRID_GANTT_MIN_TIMELINE_PANE_WIDTH_PX = 240

function normalizePositive(value: unknown, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.max(1, Math.round(Number(value)))
}

export function clampDataGridGanttTablePaneWidth(
  input: ClampDataGridGanttTablePaneWidthInput,
): number {
  const minTableWidth = normalizePositive(
    input.minTableWidth,
    DATAGRID_GANTT_MIN_TABLE_PANE_WIDTH_PX,
  )
  const minTimelineWidth = normalizePositive(
    input.minTimelineWidth,
    DATAGRID_GANTT_MIN_TIMELINE_PANE_WIDTH_PX,
  )
  const requestedWidth = normalizePositive(input.requestedWidth, minTableWidth)
  const stageWidth = Number.isFinite(input.stageWidth) ? Math.max(0, Number(input.stageWidth)) : 0
  const maxTableWidthByConfig = Number.isFinite(input.maxTableWidth)
    ? Math.max(minTableWidth, Math.round(Number(input.maxTableWidth)))
    : Number.POSITIVE_INFINITY
  const maxTableWidthByStage = stageWidth > 0
    ? Math.max(minTableWidth, stageWidth - minTimelineWidth)
    : Number.POSITIVE_INFINITY

  return Math.min(
    Math.max(requestedWidth, minTableWidth),
    Math.min(maxTableWidthByConfig, maxTableWidthByStage),
  )
}

export function resolveDataGridGanttTablePaneDragWidth(
  input: ResolveDataGridGanttTablePaneDragInput,
): number {
  return clampDataGridGanttTablePaneWidth({
    requestedWidth: input.originWidth + input.deltaX,
    stageWidth: input.stageWidth,
    minTableWidth: input.minTableWidth,
    minTimelineWidth: input.minTimelineWidth,
    maxTableWidth: input.maxTableWidth,
  })
}
