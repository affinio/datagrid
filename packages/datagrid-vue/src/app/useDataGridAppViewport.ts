import { computed, getCurrentInstance, onBeforeUnmount, ref, shallowRef, type Ref } from "vue"
import type { DataGridColumnSnapshot, DataGridRowNode, DataGridViewportRange } from "@affino/datagrid-core"
import { resolveDataGridHeaderScrollSyncLeft } from "@affino/datagrid-orchestration"
import type { UseDataGridRuntimeResult } from "../composables/useDataGridRuntime"
import type { DataGridAppMode, DataGridAppRowRenderMode } from "./useDataGridAppControls"

type MaybeRef<T> = T | Ref<T>

function resolveMaybeRef<T>(value: MaybeRef<T>): T {
  if (typeof value === "object" && value !== null && "value" in value) {
    return value.value as T
  }
  return value
}

export type DataGridAppBodyViewportRuntime<TRow> = Pick<
  UseDataGridRuntimeResult<TRow>,
  "virtualWindow" | "syncBodyRowsInRange" | "rowPartition"
>

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
  pinnedBottomRows: Ref<readonly DataGridRowNode<TRow>[]>
  renderedColumns: Ref<readonly DataGridColumnSnapshot[]>
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
  handleViewportScroll: (event: Event) => void
  syncViewportFromDom: () => void
  scheduleViewportSync: () => void
  cancelScheduledViewportSync: () => void
}

export function useDataGridAppViewport<TRow>(
  options: UseDataGridAppViewportOptions<TRow>,
): UseDataGridAppViewportResult<TRow> {
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
  const viewportScrollLeft = ref(0)
  const viewportClientWidth = ref(0)
  const viewportShellClientWidth = ref(0)
  let lastSyncedRange: DataGridViewportRange | null = null
  let lastViewportScrollTop = 0
  let viewportSyncRafHandle: number | null = null
  let pendingViewportSyncForce = false
  let pendingViewportSyncMeasureVisibleRowHeights = false
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

  interface ViewportSnapshot {
    scrollTop: number
    scrollLeft: number
    clientWidth: number
    clientHeight: number
    shellClientWidth: number
  }

  const captureViewportSnapshot = (element: HTMLElement): ViewportSnapshot => ({
    scrollTop: element.scrollTop,
    scrollLeft: element.scrollLeft,
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight,
    shellClientWidth: Math.max(element.parentElement?.clientWidth ?? 0, element.clientWidth),
  })

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
      prefix[i + 1] = prefix[i] + resolveColumnWidth(columns[i])
    }
    return prefix
  })

  const mainTrackWidth = computed<number>(() => {
    const prefix = columnPrefixWidths.value
    return prefix[prefix.length - 1] ?? 0
  })

  const viewportColumnMetrics = computed(() => {
    const columns = options.visibleColumns.value
    const totalWidth = mainTrackWidth.value
    if (!resolveMaybeRef(options.columnVirtualizationEnabled) || columns.length <= 0) {
      return {
        start: 0,
        end: Math.max(0, columns.length - 1),
        renderedColumns: columns,
        leftSpacerWidth: 0,
        rightSpacerWidth: 0,
      }
    }

    const availableWidth = Math.max(0, viewportClientWidth.value - indexColumnWidth)
    if (availableWidth <= 0) {
      return {
        start: 0,
        end: Math.max(0, columns.length - 1),
        renderedColumns: columns,
        leftSpacerWidth: 0,
        rightSpacerWidth: 0,
      }
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
      if (prefix[mid + 1] <= viewportStartPx) lo = mid + 1
      else hi = mid
    }
    const visibleStart = lo

    if (visibleStart >= columns.length) {
      const lastIndex = columns.length - 1
      return {
        start: lastIndex,
        end: lastIndex,
        renderedColumns: columns.slice(lastIndex, lastIndex + 1),
        leftSpacerWidth: prefix[lastIndex], // O(1) via prefix sums
        rightSpacerWidth: 0,
      }
    }

    // Binary search: last column whose left edge (prefix[i]) < viewportEndPx.
    lo = visibleStart
    hi = columns.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (prefix[mid] < viewportEndPx) lo = mid
      else hi = mid - 1
    }
    const visibleEnd = lo

    const start = Math.max(0, visibleStart - columnOverscan.value)
    const end = Math.min(columns.length - 1, visibleEnd + columnOverscan.value)

    const leftSpacerWidth = prefix[start] // O(1)
    const renderedWidth = prefix[end + 1] - prefix[start] // O(1)
    const rightSpacerWidth = Math.max(0, totalWidth - leftSpacerWidth - renderedWidth)

    return {
      start,
      end,
      renderedColumns: columns.slice(start, end + 1),
      leftSpacerWidth,
      rightSpacerWidth,
    }
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

  const syncVisibleRows = (range: DataGridViewportRange, force = false): void => {
    if (
      !force
      && lastSyncedRange
      && lastSyncedRange.start === range.start
      && lastSyncedRange.end === range.end
    ) {
      return
    }
    displayRows.value = options.runtime.syncBodyRowsInRange(range)
    lastSyncedRange = {
      start: range.start,
      end: range.end,
    }
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
    viewportScrollLeft.value = snapshot.scrollLeft
    viewportScrollTop.value = snapshot.scrollTop
    viewportClientWidth.value = snapshot.clientWidth
    viewportShellClientWidth.value = snapshot.shellClientWidth
    syncHeaderScrollLeftFromBody(snapshot.scrollLeft)

    if (commitOptions.forceVisibleRows || snapshot.scrollTop !== lastViewportScrollTop) {
      lastViewportScrollTop = snapshot.scrollTop
      syncVisibleRows(resolveViewportRangeFromSnapshot({
        scrollTop: snapshot.scrollTop,
        clientHeight: snapshot.clientHeight,
      }), commitOptions.forceVisibleRows)
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
    commitViewportSnapshot(captureViewportSnapshot(element), {
      forceVisibleRows: shouldForceVisibleRows,
      measureVisibleRowHeights: shouldMeasureVisibleRowHeights,
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
    syncHeaderScrollLeftFromBody(element.scrollLeft)
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
    })
  }

  return {
    headerViewportRef,
    bodyViewportRef,
    viewportScrollTop,
    displayRows,
    pinnedBottomRows: computed(() => options.runtime.rowPartition.value.pinnedBottomRows),
    renderedColumns: computed(() => viewportColumnMetrics.value.renderedColumns),
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
    handleViewportScroll,
    syncViewportFromDom,
    scheduleViewportSync,
    cancelScheduledViewportSync,
  }
}
