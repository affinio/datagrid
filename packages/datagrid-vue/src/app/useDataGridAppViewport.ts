import { computed, getCurrentInstance, onBeforeUnmount, ref, shallowRef, type Ref } from "vue"
import type { DataGridColumnSnapshot, DataGridRowNode, DataGridViewportRange } from "@affino/datagrid-core"
import { resolveDataGridHeaderScrollSyncLeft } from "@affino/datagrid-orchestration"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import type { DataGridAppMode, DataGridAppRowRenderMode } from "./useDataGridAppControls"

type MaybeRef<T> = T | Ref<T>

const DATA_GRID_PERF_TRACE_QUERY_PARAM = "dgPerfTrace"
const DATA_GRID_PERF_TRACE_STORAGE_KEY = "affino-datagrid-perf-trace"
const DATA_GRID_PERF_STORE_KEY = "__AFFINO_DATAGRID_PERF__"
const DATA_GRID_PERF_SAMPLE_LIMIT = 400
const DATA_GRID_HORIZONTAL_SCROLL_IDLE_MS = 120
const DATA_GRID_ACTIVE_HORIZONTAL_OVERSCAN_MULTIPLIER = 3

type DataGridPerfSample = {
  scope: string
  ts: number
  totalMs: number
  [key: string]: string | number
}

type DataGridPerfStore = {
  samples: DataGridPerfSample[]
  push: (sample: DataGridPerfSample) => void
  clear: () => void
  latest: (scope?: string) => DataGridPerfSample | null
  summary: () => Array<{ scope: string; count: number; meanMs: number; p95Ms: number; maxMs: number }>
}

function parseDataGridBooleanToken(value: string | null): boolean | null {
  if (!value) {
    return null
  }
  const normalizedValue = value.trim().toLowerCase()
  if (normalizedValue === "1" || normalizedValue === "true" || normalizedValue === "on") {
    return true
  }
  if (normalizedValue === "0" || normalizedValue === "false" || normalizedValue === "off") {
    return false
  }
  return null
}

function resolveDataGridPerfTraceEnabled(): boolean {
  if (typeof window === "undefined") {
    return false
  }
  const queryFlag = parseDataGridBooleanToken(
    new URLSearchParams(window.location.search).get(DATA_GRID_PERF_TRACE_QUERY_PARAM),
  )
  if (queryFlag != null) {
    return queryFlag
  }
  try {
    const storedFlag = parseDataGridBooleanToken(
      window.localStorage?.getItem(DATA_GRID_PERF_TRACE_STORAGE_KEY) ?? null,
    )
    return storedFlag ?? false
  }
  catch {
    return false
  }
}

function resolveDataGridPerfNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now()
  }
  return Date.now()
}

function createDataGridPerfStore(): DataGridPerfStore {
  const samples: DataGridPerfSample[] = []
  return {
    samples,
    push(sample) {
      samples.push(sample)
      if (samples.length > DATA_GRID_PERF_SAMPLE_LIMIT) {
        samples.splice(0, samples.length - DATA_GRID_PERF_SAMPLE_LIMIT)
      }
    },
    clear() {
      samples.length = 0
    },
    latest(scope) {
      if (!scope) {
        return samples.length > 0 ? (samples[samples.length - 1] ?? null) : null
      }
      for (let index = samples.length - 1; index >= 0; index -= 1) {
        if (samples[index]?.scope === scope) {
          return samples[index] ?? null
        }
      }
      return null
    },
    summary() {
      const grouped = new Map<string, number[]>()
      for (const sample of samples) {
        const bucket = grouped.get(sample.scope) ?? []
        bucket.push(sample.totalMs)
        grouped.set(sample.scope, bucket)
      }
      return Array.from(grouped.entries()).map(([scope, values]) => {
        const sortedValues = [...values].sort((left, right) => left - right)
        const total = sortedValues.reduce((sum, value) => sum + value, 0)
        const p95Index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * 0.95) - 1))
        return {
          scope,
          count: sortedValues.length,
          meanMs: total / Math.max(1, sortedValues.length),
          p95Ms: sortedValues[p95Index] ?? 0,
          maxMs: sortedValues.length > 0 ? (sortedValues[sortedValues.length - 1] ?? 0) : 0,
        }
      })
    },
  }
}

function resolveDataGridPerfStore(): DataGridPerfStore | null {
  if (typeof window === "undefined") {
    return null
  }
  const perfWindow = window as typeof window & { [DATA_GRID_PERF_STORE_KEY]?: DataGridPerfStore }
  if (!perfWindow[DATA_GRID_PERF_STORE_KEY]) {
    perfWindow[DATA_GRID_PERF_STORE_KEY] = createDataGridPerfStore()
  }
  return perfWindow[DATA_GRID_PERF_STORE_KEY] ?? null
}

function recordDataGridPerfSample(sample: DataGridPerfSample): void {
  resolveDataGridPerfStore()?.push(sample)
}

function resolveMaybeRef<T>(value: MaybeRef<T>): T {
  if (typeof value === "object" && value !== null && "value" in value) {
    return value.value as T
  }
  return value
}

export type DataGridAppBodyViewportRuntime<TRow> = Pick<
  UseDataGridRuntimeResult<TRow>,
  "virtualWindow" | "syncBodyRowsInRange" | "rowPartition"
> & {
  setViewportRange?: UseDataGridRuntimeResult<TRow>["setViewportRange"]
  setVirtualWindowRange?: UseDataGridRuntimeResult<TRow>["setVirtualWindowRange"]
  getBodyRowAtIndex?: (rowIndex: number) => DataGridRowNode<TRow> | null
}

export interface UseDataGridAppViewportOptions<TRow> {
  runtime: DataGridAppBodyViewportRuntime<TRow>
  mode: MaybeRef<DataGridAppMode>
  rowRenderMode: MaybeRef<DataGridAppRowRenderMode>
  rowVirtualizationEnabled?: MaybeRef<boolean>
  columnVirtualizationEnabled?: MaybeRef<boolean>
  totalRows?: Ref<number>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  normalizedBaseRowHeight: Ref<number>
  columnWidths?: Ref<Record<string, number>>
  resolveColumnWidth?: (column: DataGridColumnSnapshot) => number
  defaultColumnWidth?: number
  indexColumnWidth?: number
  sizingColumns?: Ref<readonly DataGridColumnSnapshot[]>
  flexFillOffsetWidth?: number
  rowOverscan?: MaybeRef<number>
  columnOverscan?: MaybeRef<number>
  measureVisibleRowHeights?: () => void
  resolveRowHeight?: (rowIndex: number) => number
  resolveRowOffset?: (rowIndex: number) => number
  resolveRowIndexAtOffset?: (offset: number) => number
  resolveTotalRowHeight?: () => number
  requestAnimationFrame?: (callback: FrameRequestCallback) => number
  cancelAnimationFrame?: (handle: number) => void
}

export interface UseDataGridAppViewportResult<TRow> {
  headerViewportRef: Ref<HTMLElement | null>
  bodyViewportRef: Ref<HTMLElement | null>
  viewportScrollTop: Ref<number>
  displayRows: Ref<readonly DataGridRowNode<TRow>[]>
  displayRowsRevision: Ref<number>
  pinnedBottomRows: Ref<readonly DataGridRowNode<TRow>[]>
  renderedColumns: Ref<readonly DataGridColumnSnapshot[]>
  renderedViewportRange: Ref<DataGridViewportRange | null>
  viewportRowStart: Ref<number>
  viewportRowEnd: Ref<number>
  viewportColumnStart: Ref<number>
  viewportColumnEnd: Ref<number>
  topSpacerHeight: Ref<number>
  bottomSpacerHeight: Ref<number>
  leftColumnSpacerWidth: Ref<number>
  rightColumnSpacerWidth: Ref<number>
  mainTrackWidth: Ref<number>
  gridContentStyle: Ref<Record<string, string>>
  mainTrackStyle: Ref<Record<string, string>>
  indexColumnStyle: Ref<Record<string, string>>
  columnStyle: (key: string) => Record<string, string>
  syncRenderedRowsInRange: (range: DataGridViewportRange) => void
  handleViewportScroll: (event: Event) => void
  syncViewportFromDom: () => void
  scheduleViewportSync: () => void
  cancelScheduledViewportSync: () => void
}

export function useDataGridAppViewport<TRow>(
  options: UseDataGridAppViewportOptions<TRow>,
): UseDataGridAppViewportResult<TRow> {
  interface ViewportSnapshot {
    scrollTop: number
    scrollLeft: number
    clientWidth: number
    clientHeight: number
    shellClientWidth: number
  }

  interface ViewportDimensions {
    clientWidth: number
    clientHeight: number
    shellClientWidth: number
  }

  interface ViewportColumnMetrics {
    start: number
    end: number
    renderedColumns: readonly DataGridColumnSnapshot[]
    leftSpacerWidth: number
    rightSpacerWidth: number
  }

  const perfTraceEnabled = resolveDataGridPerfTraceEnabled()
  if (perfTraceEnabled) {
    resolveDataGridPerfStore()
  }

  const defaultColumnWidth = options.defaultColumnWidth ?? 140
  const indexColumnWidth = options.indexColumnWidth ?? 72
  const flexFillOffsetWidth = options.flexFillOffsetWidth ?? indexColumnWidth
  const sizingColumns = computed(() => options.sizingColumns?.value ?? options.visibleColumns.value)
  const sizingColumnMap = computed<Map<string, DataGridColumnSnapshot>>(() => {
    const map = new Map<string, DataGridColumnSnapshot>()
    for (const col of sizingColumns.value) {
      map.set(col.key, col)
    }
    return map
  })
  const snapshotColumnWidths = computed<Record<string, number>>(() => {
    const result: Record<string, number> = {}
    for (const column of sizingColumns.value) {
      result[column.key] = column.width ?? defaultColumnWidth
    }
    return result
  })
  const resolveBaseColumnWidth = (column: DataGridColumnSnapshot | undefined): number => {
    if (!column) {
      return defaultColumnWidth
    }
    const resolvedWidth = options.resolveColumnWidth?.(column)
    if (typeof resolvedWidth === "number" && Number.isFinite(resolvedWidth)) {
      return resolvedWidth
    }
    return options.columnWidths?.value[column.key] ?? snapshotColumnWidths.value[column.key] ?? defaultColumnWidth
  }
  const resolveColumnFlex = (column: DataGridColumnSnapshot | undefined): number => {
    if (!column) {
      return 0
    }
    const value = column.column?.flex
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0
  }
  const effectiveColumnWidths = computed<Record<string, number>>(() => {
    const columns = sizingColumns.value
    const widths: Record<string, number> = {}
    if (columns.length === 0) {
      return widths
    }

    const fillTargetWidth = Math.max(
      0,
      (viewportShellClientWidth.value > 0 ? viewportShellClientWidth.value : viewportClientWidth.value) - flexFillOffsetWidth,
    )
    let fixedWidthTotal = 0
    let flexBaseWidthTotal = 0
    let flexWeightTotal = 0
    const flexColumns: DataGridColumnSnapshot[] = []

    for (const column of columns) {
      const baseWidth = resolveBaseColumnWidth(column)
      const flex = resolveColumnFlex(column)
      if (flex > 0) {
        flexColumns.push(column)
        flexBaseWidthTotal += baseWidth
        flexWeightTotal += flex
        continue
      }
      fixedWidthTotal += baseWidth
      widths[column.key] = baseWidth
    }

    if (flexColumns.length === 0 || fillTargetWidth <= 0) {
      for (const column of flexColumns) {
        widths[column.key] = resolveBaseColumnWidth(column)
      }
      return widths
    }

    const extraWidth = Math.max(0, fillTargetWidth - fixedWidthTotal - flexBaseWidthTotal)
    let assignedExtraWidth = 0
    let processedFlexWeight = 0

    flexColumns.forEach((column, index) => {
      const baseWidth = resolveBaseColumnWidth(column)
      const flex = resolveColumnFlex(column)
      processedFlexWeight += flex
      const extraShare = index === flexColumns.length - 1
        ? Math.max(0, extraWidth - assignedExtraWidth)
        : Math.max(0, Math.floor((extraWidth * processedFlexWeight) / flexWeightTotal) - assignedExtraWidth)
      assignedExtraWidth += extraShare
      widths[column.key] = baseWidth + extraShare
    })

    return widths
  })
  const resolveColumnWidth = (column: DataGridColumnSnapshot | undefined): number => {
    if (!column) {
      return defaultColumnWidth
    }
    return effectiveColumnWidths.value[column.key] ?? resolveBaseColumnWidth(column)
  }
  const rowOverscan = computed(() => {
    const value = options.rowOverscan == null ? 8 : resolveMaybeRef(options.rowOverscan)
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 8
  })
  const columnOverscan = computed(() => {
    const value = options.columnOverscan == null ? 2 : resolveMaybeRef(options.columnOverscan)
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 2
  })

  const headerViewportRef = ref<HTMLElement | null>(null)
  const bodyViewportRef = ref<HTMLElement | null>(null)
  const viewportScrollTop = ref(0)
  const displayRows = shallowRef<readonly DataGridRowNode<TRow>[]>([])
  const displayRowsRevision = ref(0)
  const renderedViewportRange = ref<DataGridViewportRange | null>(null)
  const viewportScrollLeft = ref(0)
  const viewportClientWidth = ref(0)
  const viewportShellClientWidth = ref(0)
  let lastSyncedRange: DataGridViewportRange | null = null
  let lastViewportScrollTop = 0
  let viewportSyncRafHandle: number | null = null
  let pendingViewportSyncForce = false
  let pendingViewportSyncMeasureVisibleRowHeights = false
  let lastVisibleRowSyncPerf:
    | {
      mode: string
      totalMs: number
      incrementalResolveMs: number
      runtimeSyncMs: number
      setViewportRangeMs: number
      displayRowsAssignMs: number
      viewportCommitMs: number
      rangeShiftStart: number
      rangeShiftEnd: number
      changedRowCount: number
    }
    | null = null
  let pendingViewportScrollTop = 0
  let pendingViewportScrollLeft = 0
  let horizontalScrollIdleTimer: ReturnType<typeof globalThis.setTimeout> | null = null
  let horizontalScrollActive = false
  let forceNextColumnWindowSync = false
  const horizontalScrollIdleRevision = ref(0)
  let cachedViewportElement: HTMLElement | null = null
  let cachedViewportDimensions: ViewportDimensions | null = null
  let lastSyncedColumnRange:
    | {
      columns: readonly DataGridColumnSnapshot[]
      prefix: readonly number[]
      totalWidth: number
      overscan: number
      start: number
      end: number
    }
    | null = null
  let lastViewportColumnMetrics: {
    columns: readonly DataGridColumnSnapshot[]
    start: number
    end: number
    leftSpacerWidth: number
    rightSpacerWidth: number
    value: ViewportColumnMetrics
  } | null = null
  const isPaginationMode = computed<boolean>(() => {
    return resolveMaybeRef(options.mode) === "base" && resolveMaybeRef(options.rowRenderMode) === "pagination"
  })

  const requestViewportAnimationFrame = (callback: FrameRequestCallback): number => {
    if (typeof options.requestAnimationFrame === "function") {
      return options.requestAnimationFrame(callback)
    }
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      return window.requestAnimationFrame(callback)
    }
    return globalThis.setTimeout(() => callback(Date.now()), 16) as unknown as number
  }

  const cancelViewportAnimationFrame = (handle: number): void => {
    if (typeof options.cancelAnimationFrame === "function") {
      options.cancelAnimationFrame(handle)
      return
    }
    if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(handle)
      return
    }
    globalThis.clearTimeout(handle)
  }

  const clearHorizontalScrollIdleTimer = (): void => {
    if (horizontalScrollIdleTimer == null) {
      return
    }
    globalThis.clearTimeout(horizontalScrollIdleTimer)
    horizontalScrollIdleTimer = null
  }

  const forcePreciseHorizontalColumnWindow = (): void => {
    clearHorizontalScrollIdleTimer()
    horizontalScrollActive = false
    forceNextColumnWindowSync = true
    horizontalScrollIdleRevision.value += 1
  }

  const scheduleHorizontalScrollIdleSync = (): void => {
    clearHorizontalScrollIdleTimer()
    horizontalScrollActive = true
    horizontalScrollIdleTimer = globalThis.setTimeout(() => {
      horizontalScrollIdleTimer = null
      horizontalScrollActive = false
      forceNextColumnWindowSync = true
      horizontalScrollIdleRevision.value += 1
    }, DATA_GRID_HORIZONTAL_SCROLL_IDLE_MS)
    const maybeNodeTimer = horizontalScrollIdleTimer as { unref?: () => void }
    maybeNodeTimer.unref?.()
  }

  const captureViewportDimensions = (element: HTMLElement): ViewportDimensions => ({
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight,
    shellClientWidth: Math.max(element.parentElement?.clientWidth ?? 0, element.clientWidth),
  })

  const cacheViewportDimensions = (element: HTMLElement, dimensions: ViewportDimensions): void => {
    cachedViewportElement = element
    cachedViewportDimensions = dimensions
  }

  const captureViewportSnapshot = (element: HTMLElement): ViewportSnapshot => {
    const dimensions = captureViewportDimensions(element)
    cacheViewportDimensions(element, dimensions)
    pendingViewportScrollTop = element.scrollTop
    pendingViewportScrollLeft = element.scrollLeft
    return {
      scrollTop: pendingViewportScrollTop,
      scrollLeft: pendingViewportScrollLeft,
      ...dimensions,
    }
  }

  const resolveQueuedViewportSnapshot = (
    element: HTMLElement,
    commitOptions: { forceVisibleRows: boolean; measureVisibleRowHeights: boolean },
  ): ViewportSnapshot => {
    if (
      commitOptions.forceVisibleRows
      || commitOptions.measureVisibleRowHeights
      || cachedViewportDimensions == null
      || cachedViewportElement !== element
    ) {
      return captureViewportSnapshot(element)
    }
    return {
      scrollTop: pendingViewportScrollTop,
      scrollLeft: pendingViewportScrollLeft,
      ...cachedViewportDimensions,
    }
  }

  const resolveScrollableBodyRowCount = (): number => {
    return Math.max(0, options.runtime.rowPartition.value.bodyRowCount)
  }

  const viewportRowStart = computed<number>(() => {
    if (isPaginationMode.value) {
      return 0
    }
    const maxStart = Math.max(0, resolveScrollableBodyRowCount() - 1)
    return Math.min(options.runtime.virtualWindow.value?.rowStart ?? 0, maxStart)
  })
  const viewportRowEnd = computed<number>(() => {
    if (isPaginationMode.value) {
      return Math.max(0, displayRows.value.length - 1)
    }
    const maxEnd = Math.max(0, resolveScrollableBodyRowCount() - 1)
    return Math.min(options.runtime.virtualWindow.value?.rowEnd ?? maxEnd, maxEnd)
  })
  const renderedRowEnd = computed<number>(() => {
    if (isPaginationMode.value) {
      return Math.max(0, displayRows.value.length - 1)
    }
    if (!resolveMaybeRef(options.rowVirtualizationEnabled)) {
      return Math.max(0, resolveScrollableBodyRowCount() - 1)
    }
    const actualCount = displayRows.value.length
    if (actualCount <= 0) {
      return viewportRowStart.value - 1
    }
    return viewportRowStart.value + actualCount - 1
  })

  const topSpacerHeight = computed<number>(() => {
    if (isPaginationMode.value) {
      return 0
    }
    if (typeof options.resolveRowOffset === "function") {
      return Math.max(0, options.resolveRowOffset(viewportRowStart.value))
    }
    return Math.max(0, viewportRowStart.value * options.normalizedBaseRowHeight.value)
  })

  const bottomSpacerHeight = computed<number>(() => {
    if (isPaginationMode.value) {
      return 0
    }
    const bodyRowCount = resolveScrollableBodyRowCount()
    if (bodyRowCount <= 0) {
      return 0
    }
    if (
      typeof options.resolveRowOffset === "function"
      && typeof options.resolveTotalRowHeight === "function"
    ) {
      const renderedBottom = options.resolveRowOffset(renderedRowEnd.value + 1)
      return Math.max(0, options.resolveTotalRowHeight() - renderedBottom)
    }
    const afterCount = Math.max(0, bodyRowCount - (renderedRowEnd.value + 1))
    return afterCount * options.normalizedBaseRowHeight.value
  })

  // Prefix sum array: columnPrefixWidths[i] = left edge (px) of column i.
  // columnPrefixWidths[columns.length] = total track width.
  // Computed once per column-layout change; used by viewportColumnMetrics and mainTrackWidth.
  const columnPrefixWidths = computed<readonly number[]>(() => {
    const columns = options.visibleColumns.value
    const prefix = new Array<number>(columns.length + 1)
    prefix[0] = 0
    for (let i = 0; i < columns.length; i++) {
      const previousWidth = prefix[i] ?? 0
      const column = columns[i]
      prefix[i + 1] = previousWidth + (column ? resolveColumnWidth(column) : 0)
    }
    return prefix
  })

  const mainTrackWidth = computed<number>(() => {
    const prefix = columnPrefixWidths.value
    return prefix[prefix.length - 1] ?? 0
  })

  const resolveViewportColumnMetricsResult = (
    columns: readonly DataGridColumnSnapshot[],
    start: number,
    end: number,
    leftSpacerWidth: number,
    rightSpacerWidth: number,
  ): ViewportColumnMetrics => {
    if (
      lastViewportColumnMetrics
      && lastViewportColumnMetrics.columns === columns
      && lastViewportColumnMetrics.start === start
      && lastViewportColumnMetrics.end === end
      && lastViewportColumnMetrics.leftSpacerWidth === leftSpacerWidth
      && lastViewportColumnMetrics.rightSpacerWidth === rightSpacerWidth
    ) {
      return lastViewportColumnMetrics.value
    }
    const renderedColumns =
      start === 0 && end === Math.max(0, columns.length - 1) && leftSpacerWidth === 0 && rightSpacerWidth === 0
        ? columns
        : columns.slice(start, end + 1)
    const value: ViewportColumnMetrics = {
      start,
      end,
      renderedColumns,
      leftSpacerWidth,
      rightSpacerWidth,
    }
    lastViewportColumnMetrics = {
      columns,
      start,
      end,
      leftSpacerWidth,
      rightSpacerWidth,
      value,
    }
    return value
  }

  const resolveBufferedViewportColumnMetrics = (
    columns: readonly DataGridColumnSnapshot[],
    visibleStart: number,
    visibleEnd: number,
    prefix: readonly number[],
    totalWidth: number,
    retainMode: "precise" | "active",
    forcePrecise: boolean,
  ): ViewportColumnMetrics => {
    const overscan = columnOverscan.value
    const previousRange = lastSyncedColumnRange?.columns === columns
      && lastSyncedColumnRange.prefix === prefix
      && lastSyncedColumnRange.totalWidth === totalWidth
      && lastSyncedColumnRange.overscan === overscan
      ? lastSyncedColumnRange
      : null
    const hysteresis = retainMode === "active" ? 0 : Math.max(1, Math.floor(overscan / 2))
    const retainPreviousRange = !forcePrecise
      && previousRange != null
      && visibleStart >= previousRange.start + hysteresis
      && visibleEnd <= previousRange.end - hysteresis
    const activeOverscan = retainMode === "active"
      ? Math.max(overscan, Math.ceil(overscan * DATA_GRID_ACTIVE_HORIZONTAL_OVERSCAN_MULTIPLIER))
      : overscan

    const start = retainPreviousRange
      ? previousRange.start
      : Math.max(0, visibleStart - activeOverscan)
    const end = retainPreviousRange
      ? previousRange.end
      : Math.min(columns.length - 1, visibleEnd + activeOverscan)
    const leftSpacerWidth = prefix[start] ?? 0
    const renderedWidth = (prefix[end + 1] ?? totalWidth) - leftSpacerWidth
    const rightSpacerWidth = Math.max(0, totalWidth - leftSpacerWidth - renderedWidth)

    lastSyncedColumnRange = {
      columns,
      prefix,
      totalWidth,
      overscan,
      start,
      end,
    }

    return resolveViewportColumnMetricsResult(columns, start, end, leftSpacerWidth, rightSpacerWidth)
  }

  const viewportColumnMetrics = computed(() => {
    horizontalScrollIdleRevision.value
    const forcePrecise = forceNextColumnWindowSync
    forceNextColumnWindowSync = false
    const columns = options.visibleColumns.value
    const totalWidth = mainTrackWidth.value
    if (!resolveMaybeRef(options.columnVirtualizationEnabled) || columns.length <= 0) {
      lastSyncedColumnRange = columns.length > 0
        ? {
          columns,
          prefix: columnPrefixWidths.value,
          totalWidth,
          overscan: columnOverscan.value,
          start: 0,
          end: Math.max(0, columns.length - 1),
        }
        : null
      return resolveViewportColumnMetricsResult(columns, 0, Math.max(0, columns.length - 1), 0, 0)
    }

    const availableWidth = Math.max(0, viewportClientWidth.value - indexColumnWidth)
    if (availableWidth <= 0) {
      lastSyncedColumnRange = {
        columns,
        prefix: columnPrefixWidths.value,
        totalWidth,
        overscan: columnOverscan.value,
        start: 0,
        end: Math.max(0, columns.length - 1),
      }
      return resolveViewportColumnMetricsResult(columns, 0, Math.max(0, columns.length - 1), 0, 0)
    }

    const scrollLeft = Math.max(0, viewportScrollLeft.value)
    const viewportStartPx = scrollLeft
    const viewportEndPx = scrollLeft + availableWidth
    const prefix = columnPrefixWidths.value

    // Binary search: first column whose right edge (prefix[i+1]) > viewportStartPx.
    let lo = 0
    let hi = columns.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      const rightEdge = prefix[mid + 1] ?? totalWidth
      if (rightEdge <= viewportStartPx) lo = mid + 1
      else hi = mid
    }
    const visibleStart = lo

    if (visibleStart >= columns.length) {
      const lastIndex = columns.length - 1
      return resolveBufferedViewportColumnMetrics(
        columns,
        lastIndex,
        lastIndex,
        prefix,
        totalWidth,
        horizontalScrollActive ? "active" : "precise",
        forcePrecise,
      )
    }

    // Binary search: last column whose left edge (prefix[i]) < viewportEndPx.
    lo = visibleStart
    hi = columns.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      const leftEdge = prefix[mid] ?? 0
      if (leftEdge < viewportEndPx) lo = mid
      else hi = mid - 1
    }
    const visibleEnd = lo

    return resolveBufferedViewportColumnMetrics(
      columns,
      visibleStart,
      visibleEnd,
      prefix,
      totalWidth,
      horizontalScrollActive ? "active" : "precise",
      forcePrecise,
    )
  })

  const gridContentStyle = computed<Record<string, string>>(() => {
    const width = indexColumnWidth + mainTrackWidth.value
    const px = `${width}px`
    return {
      width: px,
      minWidth: px,
    }
  })

  const mainTrackStyle = computed<Record<string, string>>(() => {
    const px = `${mainTrackWidth.value}px`
    return {
      width: px,
      minWidth: px,
    }
  })

  const indexColumnStyle = computed<Record<string, string>>(() => {
    const px = `${indexColumnWidth}px`
    return {
      width: px,
      minWidth: px,
      maxWidth: px,
      left: "0px",
    }
  })

  const columnStyle = (key: string): Record<string, string> => {
    // O(1): check the pre-built effectiveColumnWidths record first; fall back to
    // resolveBaseColumnWidth only for the rare case where sizingColumns ≠ visibleColumns.
    const width = effectiveColumnWidths.value[key] ?? resolveBaseColumnWidth(sizingColumnMap.value.get(key))
    const px = `${width}px`
    return {
      width: px,
      minWidth: px,
      maxWidth: px,
    }
  }

  const resolveViewportRangeFromSnapshot = (
    snapshot: Pick<ViewportSnapshot, "scrollTop" | "clientHeight">,
  ): DataGridViewportRange => {
    const total = resolveScrollableBodyRowCount()
    if (total <= 0) {
      return { start: 0, end: 0 }
    }
    if (resolveMaybeRef(options.mode) === "base" && resolveMaybeRef(options.rowRenderMode) === "pagination") {
      return { start: 0, end: total - 1 }
    }
    if (!resolveMaybeRef(options.rowVirtualizationEnabled)) {
      return { start: 0, end: total - 1 }
    }

    if (typeof options.resolveRowIndexAtOffset === "function") {
      const start = Math.max(0, options.resolveRowIndexAtOffset(snapshot.scrollTop) - rowOverscan.value)
      const visibleBottomOffset = Math.max(0, snapshot.scrollTop + Math.max(1, snapshot.clientHeight) - 1)
      const end = Math.min(
        total - 1,
        options.resolveRowIndexAtOffset(visibleBottomOffset) + rowOverscan.value,
      )
      return { start, end }
    }

    const estimatedRowHeight = options.normalizedBaseRowHeight.value
    const start = Math.max(0, Math.floor(snapshot.scrollTop / estimatedRowHeight) - rowOverscan.value)
    const visibleCount = Math.ceil(Math.max(1, snapshot.clientHeight) / estimatedRowHeight) + rowOverscan.value * 2
    const end = Math.min(total - 1, start + visibleCount - 1)
    return { start, end }
  }

  const resolveVisibleRowRangeFromSnapshot = (
    snapshot: Pick<ViewportSnapshot, "scrollTop" | "clientHeight">,
  ): DataGridViewportRange => {
    const total = resolveScrollableBodyRowCount()
    if (total <= 0) {
      return { start: 0, end: 0 }
    }
    if (resolveMaybeRef(options.mode) === "base" && resolveMaybeRef(options.rowRenderMode) === "pagination") {
      return { start: 0, end: total - 1 }
    }
    if (!resolveMaybeRef(options.rowVirtualizationEnabled)) {
      return { start: 0, end: total - 1 }
    }

    if (typeof options.resolveRowIndexAtOffset === "function") {
      const start = Math.max(0, options.resolveRowIndexAtOffset(snapshot.scrollTop))
      const visibleBottomOffset = Math.max(0, snapshot.scrollTop + Math.max(1, snapshot.clientHeight) - 1)
      const end = Math.min(total - 1, options.resolveRowIndexAtOffset(visibleBottomOffset))
      return { start, end }
    }

    const estimatedRowHeight = options.normalizedBaseRowHeight.value
    const start = Math.max(0, Math.floor(snapshot.scrollTop / estimatedRowHeight))
    const visibleCount = Math.ceil(Math.max(1, snapshot.clientHeight) / estimatedRowHeight)
    const end = Math.min(total - 1, start + visibleCount - 1)
    return { start, end }
  }

  const canRetainLastSyncedRange = (visibleRange: DataGridViewportRange): boolean => {
    if (!lastSyncedRange) {
      return false
    }
    const hysteresis = Math.max(1, Math.floor(rowOverscan.value / 2))
    return visibleRange.start >= lastSyncedRange.start + hysteresis
      && visibleRange.end <= lastSyncedRange.end - hysteresis
  }

  const resolveIndexedVisibleRows = (
    range: DataGridViewportRange,
  ): { rows: readonly DataGridRowNode<TRow>[]; mode: "indexed" | "incremental" } | null => {
    const getBodyRowAtIndex = options.runtime.getBodyRowAtIndex
    if (typeof getBodyRowAtIndex !== "function" || !lastSyncedRange) {
      return null
    }
    const previousRange = lastSyncedRange
    const previousRows = displayRows.value
    const previousLength = previousRange.end >= previousRange.start
      ? previousRange.end - previousRange.start + 1
      : 0
    const overlapStart = Math.max(previousRange.start, range.start)
    const overlapEnd = Math.min(previousRange.end, range.end)
    const canReuseOverlap = previousRows.length === previousLength && overlapEnd >= overlapStart

    if (!canReuseOverlap) {
      const rows: DataGridRowNode<TRow>[] = []
      for (let rowIndex = range.start; rowIndex <= range.end; rowIndex += 1) {
        const row = getBodyRowAtIndex(rowIndex)
        if (!row) {
          return null
        }
        rows.push(row)
      }
      return { rows, mode: "indexed" }
    }

    const nextRows: DataGridRowNode<TRow>[] = []
    for (let rowIndex = range.start; rowIndex < overlapStart; rowIndex += 1) {
      const row = getBodyRowAtIndex(rowIndex)
      if (!row) {
        return null
      }
      nextRows.push(row)
    }

    const overlapOffset = overlapStart - previousRange.start
    const overlapLength = overlapEnd - overlapStart + 1
    for (let index = 0; index < overlapLength; index += 1) {
      const row = previousRows[overlapOffset + index]
      if (!row) {
        return null
      }
      nextRows.push(row)
    }

    for (let rowIndex = overlapEnd + 1; rowIndex <= range.end; rowIndex += 1) {
      const row = getBodyRowAtIndex(rowIndex)
      if (!row) {
        return null
      }
      nextRows.push(row)
    }

    return { rows: nextRows, mode: "incremental" }
  }

  const updateRenderedViewportRange = (rows: readonly DataGridRowNode<TRow>[]): void => {
    if (rows.length === 0) {
      renderedViewportRange.value = null
      return
    }
    const first = rows[0]
    const last = rows[rows.length - 1]
    const start = first && Number.isFinite(first.displayIndex)
      ? Math.max(0, Math.trunc(first.displayIndex))
      : null
    const end = last && Number.isFinite(last.displayIndex)
      ? Math.max(0, Math.trunc(last.displayIndex))
      : null
    if (start == null || end == null) {
      renderedViewportRange.value = null
      return
    }
    renderedViewportRange.value = {
      start,
      end: Math.max(start, end),
    }
  }

  const commitDisplayRows = (rows: readonly DataGridRowNode<TRow>[]): void => {
    displayRows.value = rows
    displayRowsRevision.value += 1
    updateRenderedViewportRange(rows)
  }

  const syncVisibleRows = (range: DataGridViewportRange, force = false): void => {
    if (
      !force
      && lastSyncedRange
      && lastSyncedRange.start === range.start
        && lastSyncedRange.end === range.end
    ) {
      if (perfTraceEnabled) {
        lastVisibleRowSyncPerf = {
          mode: "skipped",
          totalMs: 0,
          incrementalResolveMs: 0,
          runtimeSyncMs: 0,
          setViewportRangeMs: 0,
          displayRowsAssignMs: 0,
          viewportCommitMs: 0,
          rangeShiftStart: 0,
          rangeShiftEnd: 0,
          changedRowCount: 0,
        }
      }
      return
    }
    const previousRange = lastSyncedRange
    const visibleRowsPerfStart = perfTraceEnabled ? resolveDataGridPerfNow() : 0
    let incrementalResolveMs = 0
    let runtimeSyncMs = 0
    let setViewportRangeMs = 0
    let displayRowsAssignMs = 0
    let viewportCommitMs = 0
    const indexedRows = force
      ? null
      : (() => {
        if (!perfTraceEnabled) {
          return resolveIndexedVisibleRows(range)
        }
        const incrementalStart = resolveDataGridPerfNow()
        const rows = resolveIndexedVisibleRows(range)
        incrementalResolveMs = resolveDataGridPerfNow() - incrementalStart
        return rows
      })()
    if (indexedRows) {
      const setWindowRange = options.runtime.setVirtualWindowRange ?? options.runtime.setViewportRange
      if (typeof setWindowRange === "function") {
        const commitStart = perfTraceEnabled ? resolveDataGridPerfNow() : 0
        if (perfTraceEnabled) {
          const setViewportRangeStart = resolveDataGridPerfNow()
          setWindowRange(range)
          setViewportRangeMs = resolveDataGridPerfNow() - setViewportRangeStart
          const displayRowsAssignStart = resolveDataGridPerfNow()
          commitDisplayRows(indexedRows.rows)
          displayRowsAssignMs = resolveDataGridPerfNow() - displayRowsAssignStart
        }
        else {
          setWindowRange(range)
          commitDisplayRows(indexedRows.rows)
        }
        if (perfTraceEnabled) {
          viewportCommitMs = resolveDataGridPerfNow() - commitStart
        }
      }
      else {
        const syncStart = perfTraceEnabled ? resolveDataGridPerfNow() : 0
        commitDisplayRows(options.runtime.syncBodyRowsInRange(range))
        if (perfTraceEnabled) {
          runtimeSyncMs = resolveDataGridPerfNow() - syncStart
        }
      }
    }
    else {
      const syncStart = perfTraceEnabled ? resolveDataGridPerfNow() : 0
      commitDisplayRows(options.runtime.syncBodyRowsInRange(range))
      if (perfTraceEnabled) {
        runtimeSyncMs = resolveDataGridPerfNow() - syncStart
      }
    }
    lastSyncedRange = {
      start: range.start,
      end: range.end,
    }
    if (perfTraceEnabled) {
      lastVisibleRowSyncPerf = {
        mode: indexedRows
          ? ((typeof options.runtime.setVirtualWindowRange === "function" || typeof options.runtime.setViewportRange === "function")
              ? indexedRows.mode
              : "incremental-runtime-fallback")
          : "runtime",
        totalMs: resolveDataGridPerfNow() - visibleRowsPerfStart,
        incrementalResolveMs,
        runtimeSyncMs,
        setViewportRangeMs,
        displayRowsAssignMs,
        viewportCommitMs,
        rangeShiftStart: previousRange ? range.start - previousRange.start : 0,
        rangeShiftEnd: previousRange ? range.end - previousRange.end : 0,
        changedRowCount: previousRange
          ? Math.max(Math.abs(range.start - previousRange.start), Math.abs(range.end - previousRange.end))
          : Math.max(0, range.end - range.start + 1),
      }
    }
  }

  const syncRenderedRowsInRange = (range: DataGridViewportRange): void => {
    syncVisibleRows(range, true)
  }

  const syncHeaderScrollLeftFromBody = (bodyScrollLeft: number): void => {
    const headerViewport = headerViewportRef.value
    if (!headerViewport) {
      return
    }
    const nextHeaderScrollLeft = resolveDataGridHeaderScrollSyncLeft(headerViewport.scrollLeft, bodyScrollLeft)
    if (headerViewport.scrollLeft !== nextHeaderScrollLeft) {
      headerViewport.scrollLeft = nextHeaderScrollLeft
    }
  }

  const commitViewportSnapshot = (
    snapshot: ViewportSnapshot,
    commitOptions: { forceVisibleRows: boolean; measureVisibleRowHeights: boolean },
  ): void => {
    const previousScrollLeft = viewportScrollLeft.value
    const shouldForceColumnWindow = commitOptions.forceVisibleRows || commitOptions.measureVisibleRowHeights
    if (shouldForceColumnWindow) {
      forcePreciseHorizontalColumnWindow()
    }
    else if (snapshot.scrollLeft !== previousScrollLeft) {
      scheduleHorizontalScrollIdleSync()
    }
    viewportScrollLeft.value = snapshot.scrollLeft
    viewportScrollTop.value = snapshot.scrollTop
    viewportClientWidth.value = snapshot.clientWidth
    viewportShellClientWidth.value = snapshot.shellClientWidth
    syncHeaderScrollLeftFromBody(snapshot.scrollLeft)

    if (commitOptions.forceVisibleRows || snapshot.scrollTop !== lastViewportScrollTop) {
      lastViewportScrollTop = snapshot.scrollTop
      const nextViewportSnapshot = {
        scrollTop: snapshot.scrollTop,
        clientHeight: snapshot.clientHeight,
      }
      if (!commitOptions.forceVisibleRows && canRetainLastSyncedRange(resolveVisibleRowRangeFromSnapshot(nextViewportSnapshot))) {
        if (perfTraceEnabled) {
          lastVisibleRowSyncPerf = {
            mode: "retained",
            totalMs: 0,
            incrementalResolveMs: 0,
            runtimeSyncMs: 0,
            setViewportRangeMs: 0,
            displayRowsAssignMs: 0,
            viewportCommitMs: 0,
            rangeShiftStart: 0,
            rangeShiftEnd: 0,
            changedRowCount: 0,
          }
        }
      }
      else {
        syncVisibleRows(resolveViewportRangeFromSnapshot(nextViewportSnapshot), commitOptions.forceVisibleRows)
      }
    }

    if (commitOptions.measureVisibleRowHeights) {
      options.measureVisibleRowHeights?.()
    }
  }

  const flushPendingViewportSync = (): void => {
    viewportSyncRafHandle = null
    const element = bodyViewportRef.value
    const shouldForceVisibleRows = pendingViewportSyncForce
    const shouldMeasureVisibleRowHeights = pendingViewportSyncMeasureVisibleRowHeights
    pendingViewportSyncForce = false
    pendingViewportSyncMeasureVisibleRowHeights = false
    if (!element) {
      return
    }
    if (!perfTraceEnabled) {
      commitViewportSnapshot(resolveQueuedViewportSnapshot(element, {
        forceVisibleRows: shouldForceVisibleRows,
        measureVisibleRowHeights: shouldMeasureVisibleRowHeights,
      }), {
        forceVisibleRows: shouldForceVisibleRows,
        measureVisibleRowHeights: shouldMeasureVisibleRowHeights,
      })
      return
    }
    const rafStart = resolveDataGridPerfNow()
    const snapshotStart = rafStart
    const snapshot = resolveQueuedViewportSnapshot(element, {
      forceVisibleRows: shouldForceVisibleRows,
      measureVisibleRowHeights: shouldMeasureVisibleRowHeights,
    })
    const snapshotMs = resolveDataGridPerfNow() - snapshotStart
    const commitStart = resolveDataGridPerfNow()
    commitViewportSnapshot(snapshot, {
      forceVisibleRows: shouldForceVisibleRows,
      measureVisibleRowHeights: shouldMeasureVisibleRowHeights,
    })
    const commitMs = resolveDataGridPerfNow() - commitStart
    const visibleRowsPerf = lastVisibleRowSyncPerf
    recordDataGridPerfSample({
      scope: "viewportRaf",
      ts: Date.now(),
      totalMs: resolveDataGridPerfNow() - rafStart,
      snapshotMs,
      commitMs,
      rowCount: displayRows.value.length,
      forceVisibleRows: shouldForceVisibleRows ? 1 : 0,
      measureVisibleRowHeights: shouldMeasureVisibleRowHeights ? 1 : 0,
      visibleRowsMs: visibleRowsPerf?.totalMs ?? 0,
      visibleRowsMode: visibleRowsPerf?.mode ?? "none",
      visibleRowsIncrementalResolveMs: visibleRowsPerf?.incrementalResolveMs ?? 0,
      visibleRowsRuntimeSyncMs: visibleRowsPerf?.runtimeSyncMs ?? 0,
      visibleRowsSetViewportRangeMs: visibleRowsPerf?.setViewportRangeMs ?? 0,
      visibleRowsDisplayRowsAssignMs: visibleRowsPerf?.displayRowsAssignMs ?? 0,
      visibleRowsViewportCommitMs: visibleRowsPerf?.viewportCommitMs ?? 0,
      visibleRowsRangeShiftStart: visibleRowsPerf?.rangeShiftStart ?? 0,
      visibleRowsRangeShiftEnd: visibleRowsPerf?.rangeShiftEnd ?? 0,
      visibleRowsChangedRowCount: visibleRowsPerf?.changedRowCount ?? 0,
    })
  }

  const scheduleViewportCommit = (nextOptions: { forceVisibleRows: boolean; measureVisibleRowHeights: boolean }): void => {
    // Keep native scroll IO light and collapse reactive viewport work into one frame commit.
    pendingViewportSyncForce = pendingViewportSyncForce || nextOptions.forceVisibleRows
    pendingViewportSyncMeasureVisibleRowHeights = pendingViewportSyncMeasureVisibleRowHeights || nextOptions.measureVisibleRowHeights
    if (viewportSyncRafHandle !== null) {
      return
    }
    viewportSyncRafHandle = requestViewportAnimationFrame(() => {
      flushPendingViewportSync()
    })
  }

  const handleViewportScroll = (event: Event): void => {
    const element = event.target as HTMLElement
    pendingViewportScrollTop = element.scrollTop
    pendingViewportScrollLeft = element.scrollLeft
    const shouldRefreshDimensions = cachedViewportElement !== element
      || cachedViewportDimensions == null
      || cachedViewportDimensions.clientWidth <= 0
      || cachedViewportDimensions.clientHeight <= 0
      || cachedViewportDimensions.shellClientWidth <= 0

    if (shouldRefreshDimensions) {
      const dimensions = captureViewportDimensions(element)
      if (viewportClientWidth.value !== dimensions.clientWidth) {
        viewportClientWidth.value = dimensions.clientWidth
      }
      if (viewportShellClientWidth.value !== dimensions.shellClientWidth) {
        viewportShellClientWidth.value = dimensions.shellClientWidth
      }
      cacheViewportDimensions(element, dimensions)
    }
    syncHeaderScrollLeftFromBody(pendingViewportScrollLeft)
    scheduleViewportCommit({
      forceVisibleRows: false,
      measureVisibleRowHeights: false,
    })
  }

  const syncViewportFromDom = (): void => {
    const element = bodyViewportRef.value
    if (!element) {
      return
    }
    cancelScheduledViewportSync()
    commitViewportSnapshot(captureViewportSnapshot(element), {
      forceVisibleRows: true,
      measureVisibleRowHeights: true,
    })
  }

  const scheduleViewportSync = (): void => {
    scheduleViewportCommit({
      forceVisibleRows: true,
      measureVisibleRowHeights: true,
    })
  }

  const cancelScheduledViewportSync = (): void => {
    pendingViewportSyncForce = false
    pendingViewportSyncMeasureVisibleRowHeights = false
    clearHorizontalScrollIdleTimer()
    horizontalScrollActive = false
    if (viewportSyncRafHandle == null) {
      return
    }
    cancelViewportAnimationFrame(viewportSyncRafHandle)
    viewportSyncRafHandle = null
  }

  // Guard: onBeforeUnmount requires an active component instance.
  // When this composable is used outside a component context (e.g. unit tests) the
  // cleanup is handled by the caller via cancelScheduledViewportSync().
  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      if (viewportSyncRafHandle !== null) {
        cancelViewportAnimationFrame(viewportSyncRafHandle)
        viewportSyncRafHandle = null
      }
      cachedViewportElement = null
      cachedViewportDimensions = null
      clearHorizontalScrollIdleTimer()
      horizontalScrollActive = false
    })
  }

  return {
    headerViewportRef,
    bodyViewportRef,
    viewportScrollTop,
    displayRows,
    displayRowsRevision,
    pinnedBottomRows: computed(() => options.runtime.rowPartition.value.pinnedBottomRows),
    renderedColumns: computed(() => viewportColumnMetrics.value.renderedColumns),
    renderedViewportRange,
    viewportRowStart,
    viewportRowEnd,
    viewportColumnStart: computed(() => viewportColumnMetrics.value.start),
    viewportColumnEnd: computed(() => viewportColumnMetrics.value.end),
    topSpacerHeight,
    bottomSpacerHeight,
    leftColumnSpacerWidth: computed(() => viewportColumnMetrics.value.leftSpacerWidth),
    rightColumnSpacerWidth: computed(() => viewportColumnMetrics.value.rightSpacerWidth),
    mainTrackWidth,
    gridContentStyle,
    mainTrackStyle,
    indexColumnStyle,
    columnStyle,
    syncRenderedRowsInRange,
    handleViewportScroll,
    syncViewportFromDom,
    scheduleViewportSync,
    cancelScheduledViewportSync,
  }
}
