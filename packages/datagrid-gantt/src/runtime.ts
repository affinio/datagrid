import type {
  BuildDataGridGanttDependencyPathsInput,
  BuildDataGridGanttVisibleBarsInput,
  DataGridGanttBarFrame,
  DataGridGanttBarLayout,
  DataGridGanttDependencyPath,
  DataGridGanttDependencyValue,
  DataGridGanttDragRange,
  DataGridGanttHitMode,
  DataGridGanttHitTarget,
  DataGridGanttProp,
  DataGridGanttRowEditPatch,
  DataGridGanttRowReader,
  DataGridGanttTimelineState,
  DataGridGanttZoomLevel,
  DataGridResolvedGanttOptions,
} from "./contracts.js"

export const DAY_MS = 24 * 60 * 60 * 1000

const DEFAULT_GANTT_OPTIONS: DataGridResolvedGanttOptions = {
  startKey: "start",
  endKey: "end",
  progressKey: "progress",
  dependencyKey: "dependencies",
  labelKey: "task",
  idKey: "id",
  criticalKey: null,
  paneWidth: 520,
  pixelsPerDay: 24,
  zoomLevel: "day",
  timelineStart: null,
  timelineEnd: null,
  rowBarHeight: 18,
  minBarWidth: 6,
  resizeHandleWidth: 8,
}

const PIXELS_PER_DAY_BY_ZOOM: Readonly<Record<DataGridGanttZoomLevel, number>> = {
  day: 24,
  week: 8,
  month: 3,
}

function floorDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS
}

function ceilDay(ms: number): number {
  return Math.ceil(ms / DAY_MS) * DAY_MS
}

function normalizeNumericOption(value: unknown, fallback: number, min: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.max(min, Number(value))
}

function readRowCell<TRow>(
  row: DataGridGanttBarLayout<TRow>["row"] | ReturnType<DataGridGanttRowReader<TRow>["get"]>,
  key: string | null,
): unknown {
  if (!row || !key) {
    return undefined
  }
  const record = row.row as Record<string, unknown>
  return record[key]
}

function resolveTaskId<TRow>(
  row: DataGridGanttBarLayout<TRow>["row"] | NonNullable<ReturnType<DataGridGanttRowReader<TRow>["get"]>>,
  options: DataGridResolvedGanttOptions,
): string {
  const explicit = readRowCell(row, options.idKey)
  if (explicit != null && String(explicit).trim().length > 0) {
    return String(explicit).trim()
  }
  if (row.rowId != null) {
    return String(row.rowId)
  }
  return ""
}

function resolveLabel<TRow>(
  row: DataGridGanttBarLayout<TRow>["row"] | NonNullable<ReturnType<DataGridGanttRowReader<TRow>["get"]>>,
  options: DataGridResolvedGanttOptions,
): string {
  const explicit = readRowCell(row, options.labelKey)
  if (explicit != null && String(explicit).trim().length > 0) {
    return String(explicit)
  }
  return resolveTaskId(row, options)
}

export function resolveDataGridGanttDateMs(value: unknown): number | null {
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms : null
  }
  return null
}

export function resolveDataGridGanttProgress(value: unknown): number {
  const numeric = typeof value === "number"
    ? value
    : (typeof value === "string" && value.trim().length > 0 ? Number(value) : NaN)
  if (!Number.isFinite(numeric)) {
    return 0
  }
  const normalized = numeric > 1 ? numeric / 100 : numeric
  return Math.min(1, Math.max(0, normalized))
}

export function resolveDataGridGanttDependencies(
  value: DataGridGanttDependencyValue,
): readonly string[] {
  if (Array.isArray(value)) {
    return value
      .map(entry => String(entry ?? "").trim())
      .filter(entry => entry.length > 0)
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map(entry => entry.trim())
      .filter(entry => entry.length > 0)
  }
  return []
}

export function normalizeDataGridGanttOptions(
  input: DataGridGanttProp | null | undefined,
): DataGridResolvedGanttOptions | null {
  if (input == null || input === false) {
    return null
  }
  if (input === true) {
    return { ...DEFAULT_GANTT_OPTIONS }
  }

  const zoomLevel = input.zoomLevel === "week" || input.zoomLevel === "month"
    ? input.zoomLevel
    : "day"

  return {
    startKey: typeof input.startKey === "string" && input.startKey.length > 0
      ? input.startKey
      : DEFAULT_GANTT_OPTIONS.startKey,
    endKey: typeof input.endKey === "string" && input.endKey.length > 0
      ? input.endKey
      : DEFAULT_GANTT_OPTIONS.endKey,
    progressKey: typeof input.progressKey === "string" && input.progressKey.length > 0
      ? input.progressKey
      : DEFAULT_GANTT_OPTIONS.progressKey,
    dependencyKey: typeof input.dependencyKey === "string" && input.dependencyKey.length > 0
      ? input.dependencyKey
      : DEFAULT_GANTT_OPTIONS.dependencyKey,
    labelKey: typeof input.labelKey === "string" && input.labelKey.length > 0
      ? input.labelKey
      : DEFAULT_GANTT_OPTIONS.labelKey,
    idKey: typeof input.idKey === "string" && input.idKey.length > 0
      ? input.idKey
      : DEFAULT_GANTT_OPTIONS.idKey,
    criticalKey: typeof input.criticalKey === "string" && input.criticalKey.length > 0
      ? input.criticalKey
      : DEFAULT_GANTT_OPTIONS.criticalKey,
    paneWidth: normalizeNumericOption(input.paneWidth, DEFAULT_GANTT_OPTIONS.paneWidth, 280),
    pixelsPerDay: normalizeNumericOption(
      input.pixelsPerDay,
      PIXELS_PER_DAY_BY_ZOOM[zoomLevel],
      1,
    ),
    zoomLevel,
    timelineStart: input.timelineStart ?? null,
    timelineEnd: input.timelineEnd ?? null,
    rowBarHeight: normalizeNumericOption(input.rowBarHeight, DEFAULT_GANTT_OPTIONS.rowBarHeight, 6),
    minBarWidth: normalizeNumericOption(input.minBarWidth, DEFAULT_GANTT_OPTIONS.minBarWidth, 1),
    resizeHandleWidth: normalizeNumericOption(
      input.resizeHandleWidth,
      DEFAULT_GANTT_OPTIONS.resizeHandleWidth,
      2,
    ),
  }
}

export function resolveDataGridGanttTimelineState<TRow>(
  rows: DataGridGanttRowReader<TRow>,
  options: DataGridResolvedGanttOptions,
): DataGridGanttTimelineState {
  let minMs = resolveDataGridGanttDateMs(options.timelineStart)
  let maxMs = resolveDataGridGanttDateMs(options.timelineEnd)

  if (minMs == null || maxMs == null) {
    const count = rows.getCount()
    for (let index = 0; index < count; index += 1) {
      const row = rows.get(index)
      if (!row) {
        continue
      }
      const startMs = resolveDataGridGanttDateMs(readRowCell(row, options.startKey))
      const endMs = resolveDataGridGanttDateMs(readRowCell(row, options.endKey))
      if (startMs == null && endMs == null) {
        continue
      }
      const boundedStart = startMs ?? endMs
      const boundedEnd = endMs ?? startMs
      if (boundedStart == null || boundedEnd == null) {
        continue
      }
      minMs = minMs == null ? boundedStart : Math.min(minMs, boundedStart)
      maxMs = maxMs == null ? boundedEnd : Math.max(maxMs, boundedEnd)
    }
  }

  const now = floorDay(Date.now())
  const startMs = floorDay(minMs ?? now)
  const rawEnd = maxMs ?? (startMs + DAY_MS * 14)
  const endMs = Math.max(startMs + DAY_MS, ceilDay(rawEnd))
  const totalWidth = Math.max(1, ((endMs - startMs) / DAY_MS) * options.pixelsPerDay)

  return {
    startMs,
    endMs,
    pixelsPerDay: options.pixelsPerDay,
    totalWidth,
    zoomLevel: options.zoomLevel,
  }
}

export function resolveDataGridGanttRangeFrame(
  range: DataGridGanttDragRange,
  timeline: DataGridGanttTimelineState,
  minBarWidth: number,
): Pick<DataGridGanttBarFrame, "x" | "width"> {
  return {
    x: ((range.startMs - timeline.startMs) / DAY_MS) * timeline.pixelsPerDay,
    width: Math.max(
      minBarWidth,
      ((range.endMs - range.startMs) / DAY_MS) * timeline.pixelsPerDay,
    ),
  }
}

export function buildDataGridGanttVisibleBars<TRow>(
  input: BuildDataGridGanttVisibleBarsInput<TRow>,
): readonly DataGridGanttBarLayout<TRow>[] {
  const bars: DataGridGanttBarLayout<TRow>[] = []
  let currentY = input.topSpacerHeight - input.scrollTop
  const rowBarHeight = input.options.rowBarHeight

  input.rows.forEach((row, rowOffset) => {
    const rowIndex = input.viewportRowStart + rowOffset
    const rowHeight = Math.max(1, input.resolveRowHeight(rowIndex) || input.baseRowHeight)
    const startMs = resolveDataGridGanttDateMs(readRowCell(row, input.options.startKey))
    const endMs = resolveDataGridGanttDateMs(readRowCell(row, input.options.endKey))

    if (startMs != null && endMs != null && endMs > startMs) {
      const y = currentY + Math.max(0, (rowHeight - rowBarHeight) / 2)
      if (y + rowBarHeight >= 0 && y <= input.viewportHeight) {
        const frame = resolveDataGridGanttRangeFrame(
          { startMs, endMs },
          input.timeline,
          input.options.minBarWidth,
        )
        bars.push({
          row,
          rowId: row.rowId == null ? String(rowIndex) : String(row.rowId),
          rowUpdateId: row.rowId == null ? rowIndex : row.rowId,
          taskId: resolveTaskId(row, input.options) || (row.rowId == null ? String(rowIndex) : String(row.rowId)),
          rowIndex,
          label: resolveLabel(row, input.options),
          dependencies: resolveDataGridGanttDependencies(
            readRowCell(row, input.options.dependencyKey) as DataGridGanttDependencyValue,
          ),
          critical: Boolean(
            input.options.criticalKey
            && readRowCell(row, input.options.criticalKey),
          ),
          progress: resolveDataGridGanttProgress(readRowCell(row, input.options.progressKey)),
          startMs,
          endMs,
          x: frame.x,
          width: frame.width,
          y,
          height: rowBarHeight,
        })
      }
    }

    currentY += rowHeight
  })

  return bars
}

export function buildDataGridGanttDependencyPaths<TRow>(
  input: BuildDataGridGanttDependencyPathsInput<TRow>,
): readonly DataGridGanttDependencyPath<TRow>[] {
  const barsByTaskId = new Map<string, DataGridGanttBarLayout<TRow>>()
  for (const bar of input.bars) {
    barsByTaskId.set(bar.taskId, bar)
    barsByTaskId.set(bar.rowId, bar)
  }

  const paths: DataGridGanttDependencyPath<TRow>[] = []
  const resolveFrame = input.resolveFrame ?? (bar => bar)
  const minBendPx = Math.max(0, input.minBendPx ?? 12)

  for (const targetBar of input.bars) {
    const targetFrame = resolveFrame(targetBar)
    for (const dependencyTaskId of targetBar.dependencies) {
      const sourceBar = barsByTaskId.get(dependencyTaskId)
      if (!sourceBar) {
        continue
      }
      const sourceFrame = resolveFrame(sourceBar)
      const sourceX = sourceFrame.x + sourceFrame.width
      const targetX = targetFrame.x
      const sourceY = sourceFrame.y + (sourceFrame.height / 2)
      const targetY = targetFrame.y + (targetFrame.height / 2)
      const midX = sourceX + Math.max(minBendPx, (targetX - sourceX) / 2)
      paths.push({
        dependencyTaskId,
        sourceBar,
        targetBar,
        points: [
          { x: sourceX, y: sourceY },
          { x: midX, y: sourceY },
          { x: midX, y: targetY },
          { x: targetX, y: targetY },
        ],
      })
    }
  }

  return paths
}

export function hitTestDataGridGanttBar<TRow>(
  bars: readonly DataGridGanttBarLayout<TRow>[],
  point: { x: number; y: number },
  resizeHandleWidth: number,
): DataGridGanttHitTarget<TRow> | null {
  for (let index = bars.length - 1; index >= 0; index -= 1) {
    const bar = bars[index]
    if (!bar) {
      continue
    }
    if (
      point.x < bar.x
      || point.x > bar.x + bar.width
      || point.y < bar.y
      || point.y > bar.y + bar.height
    ) {
      continue
    }
    const distanceToStart = point.x - bar.x
    const distanceToEnd = (bar.x + bar.width) - point.x
    if (distanceToStart <= resizeHandleWidth) {
      return { bar, mode: "resize-start" }
    }
    if (distanceToEnd <= resizeHandleWidth) {
      return { bar, mode: "resize-end" }
    }
    return { bar, mode: "move" }
  }
  return null
}

export function applyDataGridGanttDragDelta(
  range: DataGridGanttDragRange,
  mode: DataGridGanttHitMode,
  dayDelta: number,
): DataGridGanttDragRange {
  if (!Number.isFinite(dayDelta) || dayDelta === 0) {
    return range
  }
  const deltaMs = Math.trunc(dayDelta) * DAY_MS
  if (mode === "move") {
    return {
      startMs: range.startMs + deltaMs,
      endMs: range.endMs + deltaMs,
    }
  }
  if (mode === "resize-start") {
    return {
      startMs: Math.min(range.startMs + deltaMs, range.endMs - DAY_MS),
      endMs: range.endMs,
    }
  }
  return {
    startMs: range.startMs,
    endMs: Math.max(range.startMs + DAY_MS, range.endMs + deltaMs),
  }
}

export function buildDataGridGanttRowEditPatch(
  rowId: string | number,
  range: DataGridGanttDragRange,
  options: Pick<DataGridResolvedGanttOptions, "startKey" | "endKey">,
): DataGridGanttRowEditPatch {
  return {
    rowId,
    data: {
      [options.startKey]: new Date(range.startMs),
      [options.endKey]: new Date(range.endMs),
    },
  }
}

export function formatDataGridGanttDayLabel(
  dayMs: number,
  zoomLevel: DataGridGanttZoomLevel,
): string {
  const date = new Date(dayMs)
  if (zoomLevel === "month") {
    return date.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    })
  }
  if (zoomLevel === "week") {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
  }
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}
