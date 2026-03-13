import type {
  BuildDataGridTimelineModelInput,
  BuildDataGridTimelineRenderModelsInput,
  DataGridGanttTimelineState,
  DataGridGanttZoomLevel,
  DataGridTimelineHorizontalAlign,
  DataGridTimelineLine,
  DataGridTimelineModel,
  DataGridTimelineRange,
  DataGridTimelineRenderModels,
  DataGridTimelineSegment,
  DataGridTimelineSpan,
  DataGridTimelineViewport,
  ResolveDataGridTimelineRangeInput,
} from "./contracts.js"
import {
  buildDataGridNonWorkingDaySpans,
  resolveDataGridWorkingCalendar,
  startOfUtcDay,
  startOfUtcWeek,
} from "./calendar.js"

export const DAY_MS = 24 * 60 * 60 * 1000

const DEFAULT_TIMELINE_BUFFER_PX = 160
const MAX_TIMELINE_SEGMENTS = 10_000

type TimelineUnit = "day" | "week" | "month" | "year"

interface TimelineBandConfig {
  unit: TimelineUnit
  resolveLabel: (ms: number) => string
}

interface TimelineZoomConfig {
  primary: TimelineBandConfig
  secondary: TimelineBandConfig
}

function ceilToUtcDay(ms: number): number {
  const dayStartMs = startOfUtcDay(ms)
  if (dayStartMs === ms) {
    return ms
  }
  return dayStartMs + DAY_MS
}

function startOfUtcMonth(ms: number): number {
  const date = new Date(ms)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
}

function startOfUtcYear(ms: number): number {
  const date = new Date(ms)
  return Date.UTC(date.getUTCFullYear(), 0, 1)
}

function addUtcDays(ms: number, days: number): number {
  return ms + (days * DAY_MS)
}

function addUtcWeeks(ms: number, weeks: number): number {
  return addUtcDays(ms, weeks * 7)
}

function addUtcMonths(ms: number, months: number): number {
  const date = new Date(ms)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
}

function addUtcYears(ms: number, years: number): number {
  const date = new Date(ms)
  return Date.UTC(date.getUTCFullYear() + years, 0, 1)
}

function formatUtcDate(ms: number, options: Intl.DateTimeFormatOptions): string {
  return new Date(ms).toLocaleDateString(undefined, {
    ...options,
    timeZone: "UTC",
  })
}

function resolveWeekOfMonth(ms: number): number {
  const labelAnchorMs = addUtcDays(startOfUtcWeek(ms), 4)
  const monthStartMs = startOfUtcMonth(labelAnchorMs)
  const monthFirstWeekStartMs = startOfUtcWeek(monthStartMs)
  return Math.floor((startOfUtcWeek(labelAnchorMs) - monthFirstWeekStartMs) / (7 * DAY_MS)) + 1
}

function resolveTimelinePrimaryLabel(ms: number, zoomLevel: DataGridGanttZoomLevel): string {
  if (zoomLevel === "month") {
    return formatUtcDate(ms, { year: "numeric" })
  }
  return formatUtcDate(ms, {
    month: "long",
    year: "numeric",
  })
}

function resolveTimelineSecondaryLabel(ms: number, zoomLevel: DataGridGanttZoomLevel): string {
  if (zoomLevel === "week") {
    return `W${resolveWeekOfMonth(ms)}`
  }
  if (zoomLevel === "month") {
    return formatUtcDate(ms, { month: "short" })
  }
  return formatUtcDate(ms, { day: "numeric" })
}

function resolveTimelineUnitStart(ms: number, unit: TimelineUnit): number {
  if (unit === "week") {
    return startOfUtcWeek(ms)
  }
  if (unit === "month") {
    return startOfUtcMonth(ms)
  }
  if (unit === "year") {
    return startOfUtcYear(ms)
  }
  return startOfUtcDay(ms)
}

function addTimelineUnits(ms: number, count: number, unit: TimelineUnit): number {
  if (unit === "week") {
    return addUtcWeeks(ms, count)
  }
  if (unit === "month") {
    return addUtcMonths(ms, count)
  }
  if (unit === "year") {
    return addUtcYears(ms, count)
  }
  return addUtcDays(ms, count)
}

const ZOOM_CONFIG: Readonly<Record<DataGridGanttZoomLevel, TimelineZoomConfig>> = {
  day: {
    primary: {
      unit: "month",
      resolveLabel: ms => resolveTimelinePrimaryLabel(ms, "day"),
    },
    secondary: {
      unit: "day",
      resolveLabel: ms => resolveTimelineSecondaryLabel(ms, "day"),
    },
  },
  week: {
    primary: {
      unit: "month",
      resolveLabel: ms => resolveTimelinePrimaryLabel(ms, "week"),
    },
    secondary: {
      unit: "week",
      resolveLabel: ms => resolveTimelineSecondaryLabel(ms, "week"),
    },
  },
  month: {
    primary: {
      unit: "year",
      resolveLabel: ms => resolveTimelinePrimaryLabel(ms, "month"),
    },
    secondary: {
      unit: "month",
      resolveLabel: ms => resolveTimelineSecondaryLabel(ms, "month"),
    },
  },
}

function buildTimelineSegments(
  input: {
    timeline: DataGridGanttTimelineState
    scrollLeft: number
    viewportEndMs: number
    rangeStartMs: number
    unit: TimelineUnit
    resolveLabel: (ms: number) => string
  },
): readonly DataGridTimelineSegment[] {
  const segments: DataGridTimelineSegment[] = []
  let cursorMs = input.rangeStartMs
  let segmentCount = 0

  while (cursorMs < input.viewportEndMs && segmentCount < MAX_TIMELINE_SEGMENTS) {
    const segmentStartX = resolveDataGridTimelineDateToPixel(cursorMs, input.timeline)
    const segmentEndMs = addTimelineUnits(cursorMs, 1, input.unit)
    const segmentEndX = resolveDataGridTimelineDateToPixel(segmentEndMs, input.timeline)
    const x = segmentStartX - input.scrollLeft
    const width = segmentEndX - segmentStartX
    segments.push({
      key: `${cursorMs}:${segmentEndMs}`,
      startMs: cursorMs,
      endMs: segmentEndMs,
      x,
      width,
      label: input.resolveLabel(cursorMs),
    })
    if (segmentEndMs <= cursorMs) {
      break
    }
    cursorMs = segmentEndMs
    segmentCount += 1
  }

  return segments
}

function buildTimelineLines(
  segments: readonly DataGridTimelineSegment[],
  suffix: string,
): readonly DataGridTimelineLine[] {
  return segments.map(segment => ({
    key: `${suffix}:${segment.startMs}`,
    dateMs: segment.startMs,
    x: segment.x,
  }))
}

function buildTimelineNonWorkingSpans(
  input: {
    timeline: DataGridGanttTimelineState
    scrollLeft: number
    viewportStartMs: number
    viewportEndMs: number
    workingCalendar: NonNullable<BuildDataGridTimelineModelInput["workingCalendar"]>
  },
): readonly DataGridTimelineSpan[] {
  return buildDataGridNonWorkingDaySpans({
    startMs: input.viewportStartMs,
    endMs: input.viewportEndMs,
    calendar: input.workingCalendar,
  }).map(span => ({
    key: `non-working:${span.startMs}`,
    startMs: span.startMs,
    endMs: span.endMs,
    x: resolveDataGridTimelineDateToPixel(span.startMs, input.timeline) - input.scrollLeft,
    width: resolveDataGridTimelineDateToPixel(span.endMs, input.timeline)
      - resolveDataGridTimelineDateToPixel(span.startMs, input.timeline),
  }))
}

export function resolveDataGridTimelineDateToPixel(
  dateMs: number,
  timeline: DataGridGanttTimelineState,
): number {
  return ((dateMs - timeline.startMs) / DAY_MS) * timeline.pixelsPerDay
}

export function resolveDataGridTimelineRange(
  input: ResolveDataGridTimelineRangeInput,
): DataGridTimelineRange {
  const minTaskDateMs = Number.isFinite(input.minTaskDateMs) ? Number(input.minTaskDateMs) : null
  const maxTaskDateMs = Number.isFinite(input.maxTaskDateMs) ? Number(input.maxTaskDateMs) : null
  const pixelsPerDay = Number.isFinite(input.pixelsPerDay) ? Math.max(1, Number(input.pixelsPerDay)) : 1
  const rangePaddingDays = Number.isFinite(input.rangePaddingDays)
    ? Math.max(0, Math.trunc(input.rangePaddingDays ?? 0))
    : 0
  const fallbackDurationDays = Number.isFinite(input.fallbackDurationDays)
    ? Math.max(1, Math.trunc(input.fallbackDurationDays ?? 14))
    : 14
  const fallbackDateMs = Number.isFinite(input.fallbackDateMs)
    ? Number(input.fallbackDateMs)
    : Date.now()
  const baseStartMs = startOfUtcDay(minTaskDateMs ?? fallbackDateMs)
  const startMs = startOfUtcDay(baseStartMs - (rangePaddingDays * DAY_MS))
  const baseEndMs = maxTaskDateMs ?? (baseStartMs + (fallbackDurationDays * DAY_MS))
  const rawEndMs = baseEndMs + (rangePaddingDays * DAY_MS)
  const endMs = Math.max(startMs + DAY_MS, ceilToUtcDay(rawEndMs))

  return {
    startMs,
    endMs,
    totalWidth: Math.max(1, ((endMs - startMs) / DAY_MS) * pixelsPerDay),
  }
}

export function resolveDataGridTimelinePixelToDate(
  pixel: number,
  timeline: DataGridGanttTimelineState,
): number {
  return Math.floor(
    timeline.startMs + ((pixel / timeline.pixelsPerDay) * DAY_MS),
  )
}

export function clampDataGridTimelineScrollLeft(
  scrollLeft: number,
  totalWidth: number,
  viewportWidth: number,
): number {
  if (!Number.isFinite(scrollLeft)) {
    return 0
  }
  const maxScrollLeft = Math.max(0, totalWidth - Math.max(0, viewportWidth))
  return Math.min(Math.max(0, scrollLeft), maxScrollLeft)
}

export function resolveDataGridTimelineScrollLeftForDate(
  input: {
    dateMs: number
    timeline: DataGridGanttTimelineState
    viewportWidth: number
    align?: DataGridTimelineHorizontalAlign
  },
): number {
  const anchorX = resolveDataGridTimelineDateToPixel(input.dateMs, input.timeline)
  const viewportWidth = Math.max(0, input.viewportWidth)
  let nextScrollLeft = anchorX
  if (input.align === "center" || input.align == null) {
    nextScrollLeft = anchorX - (viewportWidth / 2)
  } else if (input.align === "end") {
    nextScrollLeft = anchorX - viewportWidth
  }
  return clampDataGridTimelineScrollLeft(
    nextScrollLeft,
    input.timeline.totalWidth,
    viewportWidth,
  )
}

export function resolveDataGridTimelineViewport(
  input: BuildDataGridTimelineModelInput,
): DataGridTimelineViewport {
  const viewportWidth = Math.max(0, input.viewportWidth)
  const scrollLeft = clampDataGridTimelineScrollLeft(
    input.scrollLeft,
    input.timeline.totalWidth,
    viewportWidth,
  )
  const bufferPx = Math.max(0, input.bufferPx ?? DEFAULT_TIMELINE_BUFFER_PX)
  const startX = Math.max(0, scrollLeft - bufferPx)
  const endX = Math.min(input.timeline.totalWidth, scrollLeft + viewportWidth + bufferPx)

  return {
    scrollLeft,
    viewportWidth,
    startX,
    endX,
    startMs: startOfUtcDay(resolveDataGridTimelinePixelToDate(startX, input.timeline)),
    endMs: Math.max(
      startOfUtcDay(resolveDataGridTimelinePixelToDate(startX, input.timeline)) + DAY_MS,
      ceilToUtcDay(resolveDataGridTimelinePixelToDate(endX, input.timeline)),
    ),
  }
}

export function buildDataGridTimelineModel(
  input: BuildDataGridTimelineModelInput,
): DataGridTimelineModel {
  const workingCalendar = input.workingCalendar ?? resolveDataGridWorkingCalendar(null)
  const viewport = resolveDataGridTimelineViewport(input)
  const zoomConfig = ZOOM_CONFIG[input.timeline.zoomLevel]
  const secondarySegments = buildTimelineSegments({
    timeline: input.timeline,
    scrollLeft: viewport.scrollLeft,
    viewportEndMs: viewport.endMs,
    rangeStartMs: resolveTimelineUnitStart(viewport.startMs, zoomConfig.secondary.unit),
    unit: zoomConfig.secondary.unit,
    resolveLabel: zoomConfig.secondary.resolveLabel,
  })
  const primarySegments = buildTimelineSegments({
    timeline: input.timeline,
    scrollLeft: viewport.scrollLeft,
    viewportEndMs: viewport.endMs,
    rangeStartMs: resolveTimelineUnitStart(viewport.startMs, zoomConfig.primary.unit),
    unit: zoomConfig.primary.unit,
    resolveLabel: zoomConfig.primary.resolveLabel,
  })

  return {
    viewport,
    primarySegments,
    secondarySegments,
    primaryLines: buildTimelineLines(primarySegments, "primary"),
    secondaryLines: buildTimelineLines(secondarySegments, "secondary"),
    nonWorkingSpans: buildTimelineNonWorkingSpans({
      timeline: input.timeline,
      scrollLeft: viewport.scrollLeft,
      viewportStartMs: viewport.startMs,
      viewportEndMs: viewport.endMs,
      workingCalendar,
    }),
  }
}

export function buildDataGridTimelineRenderModels(
  input: BuildDataGridTimelineRenderModelsInput,
): DataGridTimelineRenderModels {
  return {
    header: buildDataGridTimelineModel({
      timeline: input.timeline,
      scrollLeft: input.scrollLeft,
      viewportWidth: input.viewportWidth,
      workingCalendar: input.workingCalendar ?? resolveDataGridWorkingCalendar(null),
      bufferPx: Math.max(0, input.headerBufferPx ?? 0),
    }),
    body: buildDataGridTimelineModel({
      timeline: input.timeline,
      scrollLeft: input.scrollLeft,
      viewportWidth: input.viewportWidth,
      workingCalendar: input.workingCalendar ?? resolveDataGridWorkingCalendar(null),
      bufferPx: input.bodyBufferPx,
    }),
  }
}
