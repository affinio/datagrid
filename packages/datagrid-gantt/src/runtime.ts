import type {
  BuildDataGridGanttDependencyPathsInput,
  BuildDataGridGanttVisibleBarsInput,
  DataGridGanttCriticalTaskNode,
  DataGridGanttBarFrame,
  DataGridGanttBarLayout,
  DataGridGanttDependencyPath,
  DataGridGanttDependencyRef,
  DataGridGanttDependencyType,
  DataGridGanttHorizontalAlign,
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
import {
  addDataGridWorkingDays,
  resolveDataGridWorkingCalendar,
  snapDataGridDateToWorkingDay,
  startOfUtcDay,
  startOfUtcWeek,
} from "./calendar.js"
import {
  DAY_MS,
  clampDataGridTimelineScrollLeft,
  resolveDataGridTimelineDateToPixel,
  resolveDataGridTimelineRange,
  resolveDataGridTimelineScrollLeftForDate,
} from "./timeline.js"

const DEFAULT_GANTT_OPTIONS: DataGridResolvedGanttOptions = {
  startKey: "start",
  endKey: "end",
  baselineStartKey: null,
  baselineEndKey: null,
  progressKey: "progress",
  dependencyKey: "dependencies",
  labelKey: "task",
  idKey: "id",
  criticalKey: null,
  computedCriticalPath: false,
  paneWidth: 520,
  pixelsPerDay: 24,
  zoomLevel: "day",
  timelineStart: null,
  timelineEnd: null,
  rangePaddingDays: 0,
  workingCalendar: resolveDataGridWorkingCalendar(null),
  rowBarHeight: 18,
  minBarWidth: 6,
  resizeHandleWidth: 8,
}

const PIXELS_PER_DAY_BY_ZOOM: Readonly<Record<DataGridGanttZoomLevel, number>> = {
  day: 24,
  week: 8,
  month: 3,
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
  if (row.kind === "group") {
    const groupValue = row.groupMeta?.groupValue
    if (groupValue != null && String(groupValue).trim().length > 0) {
      return String(groupValue)
    }
  }
  return resolveTaskId(row, options)
}

interface DataGridResolvedGanttRowSnapshot {
  startMs: number | null
  endMs: number | null
  baselineStartMs: number | null
  baselineEndMs: number | null
  progress: number
  dependencies: readonly string[]
  dependencyRefs: readonly DataGridGanttDependencyRef[]
  critical: boolean
  taskId: string
  label: string
}

function createResolvedGanttRowSnapshotReader<TRow>(
  options: DataGridResolvedGanttOptions,
): (
  row: DataGridGanttBarLayout<TRow>["row"] | NonNullable<ReturnType<DataGridGanttRowReader<TRow>["get"]>>,
) => DataGridResolvedGanttRowSnapshot {
  const cache = new WeakMap<object, DataGridResolvedGanttRowSnapshot>()

  return row => {
    const cached = cache.get(row)
    if (cached) {
      return cached
    }

    const snapshot: DataGridResolvedGanttRowSnapshot = {
      startMs: resolveDataGridGanttDateMs(readRowCell(row, options.startKey)),
      endMs: resolveDataGridGanttDateMs(readRowCell(row, options.endKey)),
      baselineStartMs: resolveDataGridGanttDateMs(readRowCell(row, options.baselineStartKey)),
      baselineEndMs: resolveDataGridGanttDateMs(readRowCell(row, options.baselineEndKey)),
      progress: resolveDataGridGanttProgress(readRowCell(row, options.progressKey)),
      dependencies: resolveDataGridGanttDependencies(
        readRowCell(row, options.dependencyKey) as DataGridGanttDependencyValue,
      ),
      dependencyRefs: resolveDataGridGanttDependencyRefs(
        readRowCell(row, options.dependencyKey) as DataGridGanttDependencyValue,
      ),
      critical: Boolean(
        options.criticalKey
        && readRowCell(row, options.criticalKey),
      ),
      taskId: resolveTaskId(row, options),
      label: resolveLabel(row, options),
    }

    cache.set(row, snapshot)
    return snapshot
  }
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

export function resolveDataGridGanttSnapDays(
  zoomLevel: DataGridGanttZoomLevel,
): number {
  return zoomLevel === "week" || zoomLevel === "month" ? 7 : 1
}

export function snapDataGridGanttDateMs(
  dateMs: number,
  zoomLevel: DataGridGanttZoomLevel,
  workingCalendar?: DataGridResolvedGanttOptions["workingCalendar"],
): number {
  if (!Number.isFinite(dateMs)) {
    return dateMs
  }
  if (resolveDataGridGanttSnapDays(zoomLevel) === 7) {
    return startOfUtcWeek(dateMs)
  }
  return workingCalendar
    ? snapDataGridDateToWorkingDay(dateMs, workingCalendar)
    : startOfUtcDay(dateMs)
}

export function snapDataGridGanttDayDelta(
  dayDelta: number,
  zoomLevel: DataGridGanttZoomLevel,
): number {
  if (!Number.isFinite(dayDelta) || dayDelta === 0) {
    return 0
  }
  const snapDays = resolveDataGridGanttSnapDays(zoomLevel)
  if (snapDays === 1) {
    return Math.round(dayDelta)
  }
  return Math.round(dayDelta / snapDays) * snapDays
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

function resolveDataGridGanttDependencyType(value: string): DataGridGanttDependencyType | null {
  const normalized = value.trim().toUpperCase()
  return normalized === "FS" || normalized === "SS" || normalized === "FF" || normalized === "SF"
    ? normalized
    : null
}

function parseDataGridGanttDependencyRef(token: string): DataGridGanttDependencyRef | null {
  const trimmed = token.trim()
  if (trimmed.length === 0) {
    return null
  }

  const delimitedMatch = trimmed.match(/^(.+?)(?::|->|\s+)(FS|SS|FF|SF)$/i)
  if (delimitedMatch) {
    const taskId = delimitedMatch[1]?.trim() ?? ""
    const type = resolveDataGridGanttDependencyType(delimitedMatch[2] ?? "")
    if (taskId.length > 0 && type) {
      return {
        taskId,
        type,
        raw: trimmed,
      }
    }
  }

  const compactNumericMatch = trimmed.match(/^(\d+)(FS|SS|FF|SF)$/i)
  if (compactNumericMatch) {
    const taskId = compactNumericMatch[1]?.trim() ?? ""
    const type = resolveDataGridGanttDependencyType(compactNumericMatch[2] ?? "")
    if (taskId.length > 0 && type) {
      return {
        taskId,
        type,
        raw: trimmed,
      }
    }
  }

  return {
    taskId: trimmed,
    type: "FS",
    raw: trimmed,
  }
}

export function resolveDataGridGanttDependencyRefs(
  value: DataGridGanttDependencyValue,
): readonly DataGridGanttDependencyRef[] {
  return resolveDataGridGanttDependencies(value)
    .map(parseDataGridGanttDependencyRef)
    .filter((dependencyRef): dependencyRef is DataGridGanttDependencyRef => dependencyRef !== null)
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
    baselineStartKey: typeof input.baselineStartKey === "string" && input.baselineStartKey.length > 0
      ? input.baselineStartKey
      : DEFAULT_GANTT_OPTIONS.baselineStartKey,
    baselineEndKey: typeof input.baselineEndKey === "string" && input.baselineEndKey.length > 0
      ? input.baselineEndKey
      : DEFAULT_GANTT_OPTIONS.baselineEndKey,
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
    computedCriticalPath: input.computedCriticalPath === true,
    paneWidth: normalizeNumericOption(input.paneWidth, DEFAULT_GANTT_OPTIONS.paneWidth, 280),
    pixelsPerDay: normalizeNumericOption(
      input.pixelsPerDay,
      PIXELS_PER_DAY_BY_ZOOM[zoomLevel],
      1,
    ),
    zoomLevel,
    timelineStart: input.timelineStart ?? null,
    timelineEnd: input.timelineEnd ?? null,
    rangePaddingDays: normalizeNumericOption(
      input.rangePaddingDays,
      DEFAULT_GANTT_OPTIONS.rangePaddingDays,
      0,
    ),
    workingCalendar: resolveDataGridWorkingCalendar(input.workingCalendar),
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
  const readResolvedRow = createResolvedGanttRowSnapshotReader(options)
  const explicitStartMs = resolveDataGridGanttDateMs(options.timelineStart)
  const explicitEndMs = resolveDataGridGanttDateMs(options.timelineEnd)
  let minMs = explicitStartMs
  let maxMs = explicitEndMs

  if (explicitStartMs == null || explicitEndMs == null) {
    const count = rows.getCount()
    for (let index = 0; index < count; index += 1) {
      const row = rows.get(index)
      if (!row) {
        continue
      }
      const resolvedRow = readResolvedRow(row)
      const startMs = resolvedRow.startMs
      const endMs = resolvedRow.endMs
      if (startMs == null && endMs == null) {
        continue
      }
      const boundedStart = startMs ?? endMs
      const boundedEnd = endMs ?? startMs
      if (boundedStart == null || boundedEnd == null) {
        continue
      }
      if (explicitStartMs == null) {
        minMs = minMs == null ? boundedStart : Math.min(minMs, boundedStart)
      }
      if (explicitEndMs == null) {
        maxMs = maxMs == null ? boundedEnd : Math.max(maxMs, boundedEnd)
      }
    }
  }

  const range = resolveDataGridTimelineRange({
    minTaskDateMs: minMs,
    maxTaskDateMs: maxMs,
    pixelsPerDay: options.pixelsPerDay,
    rangePaddingDays: options.rangePaddingDays,
  })

  return {
    startMs: range.startMs,
    endMs: range.endMs,
    pixelsPerDay: options.pixelsPerDay,
    totalWidth: range.totalWidth,
    zoomLevel: options.zoomLevel,
  }
}

export function resolveDataGridGanttRangeFrame(
  range: DataGridGanttDragRange,
  timeline: DataGridGanttTimelineState,
  minBarWidth: number,
  milestoneWidth?: number,
): Pick<DataGridGanttBarFrame, "x" | "width"> {
  if (range.endMs <= range.startMs) {
    const width = Math.max(minBarWidth, milestoneWidth ?? minBarWidth)
    return {
      x: resolveDataGridTimelineDateToPixel(range.startMs, timeline) - (width / 2),
      width,
    }
  }
  return {
    x: resolveDataGridTimelineDateToPixel(range.startMs, timeline),
    width: Math.max(
      minBarWidth,
      resolveDataGridTimelineDateToPixel(range.endMs, timeline)
      - resolveDataGridTimelineDateToPixel(range.startMs, timeline),
    ),
  }
}

export function resolveDataGridGanttDateOffset(
  dateMs: number,
  timeline: DataGridGanttTimelineState,
): number {
  return resolveDataGridTimelineDateToPixel(dateMs, timeline)
}

export function clampDataGridGanttScrollLeft(
  scrollLeft: number,
  totalWidth: number,
  viewportWidth: number,
): number {
  return clampDataGridTimelineScrollLeft(scrollLeft, totalWidth, viewportWidth)
}

export function resolveDataGridGanttScrollLeftForDate(
  input: {
    dateMs: number
    timeline: DataGridGanttTimelineState
    viewportWidth: number
    align?: DataGridGanttHorizontalAlign
  },
): number {
  return resolveDataGridTimelineScrollLeftForDate({
    dateMs: input.dateMs,
    timeline: input.timeline,
    viewportWidth: input.viewportWidth,
    align: input.align,
  })
}

export function buildDataGridGanttVisibleBars<TRow>(
  input: BuildDataGridGanttVisibleBarsInput<TRow>,
): readonly DataGridGanttBarLayout<TRow>[] {
  const readResolvedRow = createResolvedGanttRowSnapshotReader(input.options)
  const bars: DataGridGanttBarLayout<TRow>[] = []
  const rowContexts: Array<{
    row: DataGridGanttBarLayout<TRow>["row"]
    rowIndex: number
    rowId: string
    rowUpdateId: string | number
    rowHeight: number
    y: number
    resolvedRow: DataGridResolvedGanttRowSnapshot
  }> = []
  let currentY = input.topSpacerHeight - input.scrollTop
  const rowBarHeight = input.options.rowBarHeight

  input.rows.forEach((row, rowOffset) => {
    const rowIndex = input.viewportRowStart + rowOffset
    const metric = input.rowMetrics?.[rowOffset]
    const rowHeight = Math.max(1, metric?.height ?? (input.resolveRowHeight(rowIndex) || input.baseRowHeight))
    const rowTop = metric?.top ?? currentY
    rowContexts.push({
      row,
      rowIndex,
      rowId: row.rowId == null ? String(rowIndex) : String(row.rowId),
      rowUpdateId: row.rowId == null ? rowIndex : row.rowId,
      rowHeight,
      y: (rowTop - input.scrollTop) + Math.max(0, (rowHeight - rowBarHeight) / 2),
      resolvedRow: readResolvedRow(row),
    })
    currentY = rowTop + rowHeight
  })

  const summaryRangesByRowId = new Map<string, { startMs: number; endMs: number }>()
  const activeGroups: Array<{ rowId: string; level: number; startMs: number | null; endMs: number | null }> = []

  function absorbRangeIntoActiveGroups(startMs: number, endMs: number): void {
    for (const group of activeGroups) {
      group.startMs = group.startMs == null ? startMs : Math.min(group.startMs, startMs)
      group.endMs = group.endMs == null ? endMs : Math.max(group.endMs, endMs)
    }
  }

  function closeGroupsAtLevel(level: number): void {
    while (activeGroups.length > 0) {
      const current = activeGroups[activeGroups.length - 1]
      if (!current || current.level < level) {
        break
      }
      activeGroups.pop()
      if (current.startMs != null && current.endMs != null && current.endMs >= current.startMs) {
        summaryRangesByRowId.set(current.rowId, {
          startMs: current.startMs,
          endMs: current.endMs,
        })
      }
    }
  }

  for (const context of rowContexts) {
    if (context.row.kind === "group") {
      const level = Math.max(0, Math.trunc(context.row.groupMeta?.level ?? 0))
      closeGroupsAtLevel(level)
      activeGroups.push({
        rowId: context.rowId,
        level,
        startMs: null,
        endMs: null,
      })
      const ownStartMs = context.resolvedRow.startMs
      const ownEndMs = context.resolvedRow.endMs
      if (ownStartMs != null && ownEndMs != null && ownEndMs >= ownStartMs) {
        absorbRangeIntoActiveGroups(ownStartMs, ownEndMs)
      }
      continue
    }

    const startMs = context.resolvedRow.startMs
    const endMs = context.resolvedRow.endMs
    if (startMs != null && endMs != null && endMs >= startMs) {
      absorbRangeIntoActiveGroups(startMs, endMs)
    }
  }
  closeGroupsAtLevel(0)

  for (const context of rowContexts) {
    const ownStartMs = context.resolvedRow.startMs
    const ownEndMs = context.resolvedRow.endMs
    const ownBaselineStartMs = context.resolvedRow.baselineStartMs
    const ownBaselineEndMs = context.resolvedRow.baselineEndMs
    const summaryRange = context.row.kind === "group"
      ? summaryRangesByRowId.get(context.rowId)
      : null
    const startMs = summaryRange?.startMs ?? ownStartMs
    const endMs = summaryRange?.endMs ?? ownEndMs

    if (startMs == null || endMs == null || endMs < startMs) {
      continue
    }

    const summary = context.row.kind === "group" && summaryRange != null
    const computedCritical = input.criticalTaskIds?.has(context.resolvedRow.taskId || context.rowId) ?? false
    const height = rowBarHeight
    const y = context.y
    if (y + height < 0 || y > input.viewportHeight) {
      continue
    }
    const milestone = !summary && endMs === startMs
    const frame = resolveDataGridGanttRangeFrame(
      { startMs, endMs },
      input.timeline,
      input.options.minBarWidth,
      milestone ? height : undefined,
    )
    bars.push({
      row: context.row,
      rowId: context.rowId,
      rowUpdateId: context.rowUpdateId,
      taskId: context.resolvedRow.taskId || context.rowId,
      rowIndex: context.rowIndex,
      label: context.resolvedRow.label,
      dependencies: summary ? [] : context.resolvedRow.dependencies,
      dependencyRefs: summary ? [] : context.resolvedRow.dependencyRefs,
      critical: summary ? false : (context.resolvedRow.critical || computedCritical),
      criticalSource: summary
        ? null
        : (context.resolvedRow.critical ? "manual" : (computedCritical ? "computed" : null)),
      milestone,
      summary,
      progress: summary ? 0 : context.resolvedRow.progress,
      startMs,
      endMs,
      baselineStartMs: summary || ownBaselineStartMs == null || ownBaselineEndMs == null || ownBaselineEndMs < ownBaselineStartMs
        ? null
        : ownBaselineStartMs,
      baselineEndMs: summary || ownBaselineStartMs == null || ownBaselineEndMs == null || ownBaselineEndMs < ownBaselineStartMs
        ? null
        : ownBaselineEndMs,
      x: frame.x,
      width: frame.width,
      y,
      height,
    })
  }

  return bars
}

export function resolveDataGridGanttCriticalTaskIds<TRow>(
  rows: DataGridGanttRowReader<TRow>,
  options: DataGridResolvedGanttOptions,
): ReadonlySet<string> {
  const readResolvedRow = createResolvedGanttRowSnapshotReader(options)
  const taskNodes = new Map<string, DataGridGanttCriticalTaskNode>()
  const taskIdByRowId = new Map<string, string>()
  const successorIdsByTaskId = new Map<string, string[]>()
  const predecessorIdsByTaskId = new Map<string, string[]>()
  const indegreeByTaskId = new Map<string, number>()

  for (let index = 0; index < rows.getCount(); index += 1) {
    const row = rows.get(index)
    if (!row || row.kind === "group") {
      continue
    }
    const resolvedRow = readResolvedRow(row)
    if (resolvedRow.startMs == null || resolvedRow.endMs == null || resolvedRow.endMs < resolvedRow.startMs) {
      continue
    }
    const taskId = resolvedRow.taskId || (row.rowId == null ? String(index) : String(row.rowId))
    const rowId = row.rowId == null ? String(index) : String(row.rowId)
      taskNodes.set(taskId, {
        taskId,
        rowId,
        startMs: resolvedRow.startMs,
        endMs: resolvedRow.endMs,
        dependencyRefs: resolvedRow.dependencyRefs,
      })
    taskIdByRowId.set(rowId, taskId)
    successorIdsByTaskId.set(taskId, [])
    predecessorIdsByTaskId.set(taskId, [])
    indegreeByTaskId.set(taskId, 0)
  }

  if (taskNodes.size === 0) {
    return new Set<string>()
  }

  for (const node of taskNodes.values()) {
    const predecessors = predecessorIdsByTaskId.get(node.taskId)
    const uniquePredecessors = new Set<string>()
    for (const dependency of node.dependencyRefs) {
      if (dependency.type !== "FS") {
        continue
      }
      const dependencyId = dependency.taskId
      const predecessorTaskId = taskNodes.has(dependencyId)
        ? dependencyId
        : (taskIdByRowId.get(dependencyId) ?? null)
      if (!predecessorTaskId || predecessorTaskId === node.taskId || uniquePredecessors.has(predecessorTaskId)) {
        continue
      }
      uniquePredecessors.add(predecessorTaskId)
      predecessors?.push(predecessorTaskId)
      successorIdsByTaskId.get(predecessorTaskId)?.push(node.taskId)
      indegreeByTaskId.set(node.taskId, (indegreeByTaskId.get(node.taskId) ?? 0) + 1)
    }
  }

  const queue = Array.from(taskNodes.keys()).filter(taskId => (indegreeByTaskId.get(taskId) ?? 0) === 0)
  const topologicalOrder: string[] = []
  for (let index = 0; index < queue.length; index += 1) {
    const taskId = queue[index]
    if (!taskId) {
      continue
    }
    topologicalOrder.push(taskId)
    for (const successorTaskId of successorIdsByTaskId.get(taskId) ?? []) {
      const nextIndegree = (indegreeByTaskId.get(successorTaskId) ?? 0) - 1
      indegreeByTaskId.set(successorTaskId, nextIndegree)
      if (nextIndegree === 0) {
        queue.push(successorTaskId)
      }
    }
  }

  if (topologicalOrder.length !== taskNodes.size) {
    return new Set<string>()
  }

  const earliestStartByTaskId = new Map<string, number>()
  const earliestFinishByTaskId = new Map<string, number>()
  let projectEndMs = Number.NEGATIVE_INFINITY

  for (const taskId of topologicalOrder) {
    const node = taskNodes.get(taskId)
    if (!node) {
      continue
    }
    const durationMs = Math.max(0, node.endMs - node.startMs)
    const predecessorFinishMs = (predecessorIdsByTaskId.get(taskId) ?? []).reduce((maxFinish, predecessorTaskId) => {
      return Math.max(maxFinish, earliestFinishByTaskId.get(predecessorTaskId) ?? Number.NEGATIVE_INFINITY)
    }, Number.NEGATIVE_INFINITY)
    const earliestStartMs = Math.max(
      node.startMs,
      Number.isFinite(predecessorFinishMs) ? predecessorFinishMs : node.startMs,
    )
    const earliestFinishMs = earliestStartMs + durationMs
    earliestStartByTaskId.set(taskId, earliestStartMs)
    earliestFinishByTaskId.set(taskId, earliestFinishMs)
    projectEndMs = Math.max(projectEndMs, earliestFinishMs, node.endMs)
  }

  if (!Number.isFinite(projectEndMs)) {
    return new Set<string>()
  }

  const latestStartByTaskId = new Map<string, number>()
  const latestFinishByTaskId = new Map<string, number>()

  for (let index = topologicalOrder.length - 1; index >= 0; index -= 1) {
    const taskId = topologicalOrder[index]
    const node = taskNodes.get(taskId)
    if (!node) {
      continue
    }
    const durationMs = Math.max(0, node.endMs - node.startMs)
    const successorStartMs = (successorIdsByTaskId.get(taskId) ?? []).reduce((minStart, successorTaskId) => {
      return Math.min(minStart, latestStartByTaskId.get(successorTaskId) ?? Number.POSITIVE_INFINITY)
    }, Number.POSITIVE_INFINITY)
    const latestFinishMs = Number.isFinite(successorStartMs) ? successorStartMs : projectEndMs
    const latestStartMs = latestFinishMs - durationMs
    latestFinishByTaskId.set(taskId, latestFinishMs)
    latestStartByTaskId.set(taskId, latestStartMs)
  }

  const criticalTaskIds = new Set<string>()
  const slackEpsilonMs = 60 * 1000

  for (const taskId of topologicalOrder) {
    const earliestStartMs = earliestStartByTaskId.get(taskId)
    const latestStartMs = latestStartByTaskId.get(taskId)
    if (earliestStartMs == null || latestStartMs == null) {
      continue
    }
    if (Math.abs(latestStartMs - earliestStartMs) <= slackEpsilonMs) {
      criticalTaskIds.add(taskId)
    }
  }

  return criticalTaskIds
}

export function buildDataGridGanttDependencyPaths<TRow>(
  input: BuildDataGridGanttDependencyPathsInput<TRow>,
): readonly DataGridGanttDependencyPath<TRow>[] {
  const barsByTaskId = new Map<string, DataGridGanttBarLayout<TRow>>()
  const barsByRowId = new Map<string, DataGridGanttBarLayout<TRow>>()
  for (const bar of input.bars) {
    const taskId = bar.taskId.trim()
    const rowId = bar.rowId.trim()
    if (taskId.length > 0) {
      barsByTaskId.set(taskId, bar)
    }
    if (rowId.length > 0) {
      barsByRowId.set(rowId, bar)
    }
  }

  const paths: DataGridGanttDependencyPath<TRow>[] = []
  const resolveFrame = input.resolveFrame ?? (bar => bar)
  const minBendPx = Math.max(0, input.minBendPx ?? 12)
  const portStubPx = Math.max(4, Math.min(8, Math.round(minBendPx / 2)))
  const compactGapThresholdPx = (portStubPx * 2) + minBendPx

  function resolveAnchorX(frame: DataGridGanttBarFrame, side: "start" | "end"): number {
    return side === "start" ? frame.x : frame.x + frame.width
  }

  function resolveLeadX(anchorX: number, side: "start" | "end"): number {
    return side === "start" ? anchorX - portStubPx : anchorX + portStubPx
  }

  for (const targetBar of input.bars) {
    const targetFrame = resolveFrame(targetBar)
    targetBar.dependencyRefs.forEach((dependency, dependencyIndex) => {
      const dependencyTaskId = dependency.taskId
      const sourceBar = barsByTaskId.get(dependencyTaskId) ?? barsByRowId.get(dependencyTaskId)
      if (!sourceBar) {
        return
      }
      const sourceFrame = resolveFrame(sourceBar)
      const sourceSide = dependency.type === "SS" || dependency.type === "SF" ? "start" : "end"
      const targetSide = dependency.type === "FS" || dependency.type === "SS" ? "start" : "end"
      const sourceX = resolveAnchorX(sourceFrame, sourceSide)
      const targetX = resolveAnchorX(targetFrame, targetSide)
      const sourceY = sourceFrame.y + (sourceFrame.height / 2)
      const targetY = targetFrame.y + (targetFrame.height / 2)
      const laneOffsetPx = minBendPx + ((dependencyIndex % 4) * 8)
      const sourceLeadX = resolveLeadX(sourceX, sourceSide)
      const targetApproachX = resolveLeadX(targetX, targetSide)
      const points = (() => {
        if (sourceSide === targetSide) {
          const laneX = sourceSide === "start"
            ? Math.min(sourceLeadX, targetApproachX) - laneOffsetPx
            : Math.max(sourceLeadX, targetApproachX) + laneOffsetPx
          return [
            { x: sourceX, y: sourceY },
            { x: sourceLeadX, y: sourceY },
            { x: laneX, y: sourceY },
            { x: laneX, y: targetY },
            { x: targetApproachX, y: targetY },
            { x: targetX, y: targetY },
          ]
        }

        if (sourceSide === "end" && targetSide === "start" && targetX >= sourceX) {
          const gapPx = targetX - sourceX
          const laneX = gapPx <= compactGapThresholdPx
            ? sourceLeadX
            : Math.max(
                sourceLeadX,
                sourceX + Math.max(
                  laneOffsetPx,
                  (targetApproachX - sourceX) / 2,
                ),
              )
          return [
            { x: sourceX, y: sourceY },
            { x: sourceLeadX, y: sourceY },
            { x: laneX, y: sourceY },
            { x: laneX, y: targetY },
            { x: targetApproachX, y: targetY },
            { x: targetX, y: targetY },
          ]
        }

        const detourX = sourceSide === "end"
          ? Math.max(sourceFrame.x + sourceFrame.width, targetFrame.x + targetFrame.width) + laneOffsetPx
          : Math.min(sourceFrame.x, targetFrame.x) - laneOffsetPx
        const laneY = sourceY + ((targetY - sourceY) / 2)
        return [
          { x: sourceX, y: sourceY },
          { x: sourceLeadX, y: sourceY },
          { x: detourX, y: sourceY },
          { x: detourX, y: laneY },
          { x: targetApproachX, y: laneY },
          { x: targetApproachX, y: targetY },
          { x: targetX, y: targetY },
        ]
      })()
      paths.push({
        dependencyTaskId,
        dependencyType: dependency.type,
        sourceBar,
        targetBar,
        points,
      })
    })
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
    if (bar.summary) {
      continue
    }
    if (bar.milestone) {
      return { bar, mode: "move" }
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
  zoomLevel: DataGridGanttZoomLevel = "day",
  workingCalendar?: DataGridResolvedGanttOptions["workingCalendar"],
): DataGridGanttDragRange {
  const snappedDayDelta = snapDataGridGanttDayDelta(dayDelta, zoomLevel)
  if (!Number.isFinite(snappedDayDelta) || snappedDayDelta === 0) {
    return range
  }
  if (workingCalendar && resolveDataGridGanttSnapDays(zoomLevel) === 1) {
    if (mode === "move") {
      return {
        startMs: addDataGridWorkingDays(range.startMs, snappedDayDelta, workingCalendar),
        endMs: addDataGridWorkingDays(range.endMs, snappedDayDelta, workingCalendar),
      }
    }
    if (mode === "resize-start") {
      const startMs = addDataGridWorkingDays(range.startMs, snappedDayDelta, workingCalendar)
      return {
        startMs: Math.min(startMs, addDataGridWorkingDays(range.endMs, -1, workingCalendar)),
        endMs: range.endMs,
      }
    }
    const endMs = addDataGridWorkingDays(range.endMs, snappedDayDelta, workingCalendar)
    return {
      startMs: range.startMs,
      endMs: Math.max(addDataGridWorkingDays(range.startMs, 1, workingCalendar), endMs),
    }
  }
  const deltaMs = snappedDayDelta * DAY_MS
  if (mode === "move") {
    const durationMs = Math.max(0, range.endMs - range.startMs)
    const startMs = snapDataGridGanttDateMs(range.startMs + deltaMs, zoomLevel, workingCalendar)
    return {
      startMs,
      endMs: startMs + durationMs,
    }
  }
  if (mode === "resize-start") {
    const startMs = snapDataGridGanttDateMs(range.startMs + deltaMs, zoomLevel, workingCalendar)
    return {
      startMs: Math.min(startMs, range.endMs - DAY_MS),
      endMs: range.endMs,
    }
  }
  const endMs = snapDataGridGanttDateMs(range.endMs + deltaMs, zoomLevel, workingCalendar)
  return {
    startMs: range.startMs,
    endMs: Math.max(range.startMs + DAY_MS, endMs),
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
