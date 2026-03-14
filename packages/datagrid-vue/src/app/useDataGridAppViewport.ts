import { computed, ref, shallowRef, type Ref } from "vue"
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

export interface UseDataGridAppViewportOptions<TRow> {
  runtime: Pick<UseDataGridRuntimeResult<TRow>, "syncRowsInRange" | "virtualWindow" | "api">
  mode: MaybeRef<DataGridAppMode>
  rowRenderMode: MaybeRef<DataGridAppRowRenderMode>
  rowVirtualizationEnabled?: MaybeRef<boolean>
  columnVirtualizationEnabled?: MaybeRef<boolean>
  totalRows: Ref<number>
  visibleColumns: Ref<readonly DataGridColumnSnapshot[]>
  normalizedBaseRowHeight: Ref<number>
  columnWidths?: Ref<Record<string, number>>
  resolveColumnWidth?: (column: DataGridColumnSnapshot) => number
  defaultColumnWidth?: number
  indexColumnWidth?: number
  rowOverscan?: MaybeRef<number>
  columnOverscan?: MaybeRef<number>
  measureVisibleRowHeights?: () => void
  resolveRowHeight?: (rowIndex: number) => number
  resolveRowOffset?: (rowIndex: number) => number
  resolveRowIndexAtOffset?: (offset: number) => number
  resolveTotalRowHeight?: () => number
}

export interface UseDataGridAppViewportResult<TRow> {
  headerViewportRef: Ref<HTMLElement | null>
  bodyViewportRef: Ref<HTMLElement | null>
  viewportScrollTop: Ref<number>
  displayRows: Ref<readonly DataGridRowNode<TRow>[]>
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
  const snapshotColumnWidths = computed<Record<string, number>>(() => {
    return Object.fromEntries(
      options.visibleColumns.value.map(column => [column.key, column.width ?? defaultColumnWidth]),
    )
  })
  const resolveColumnWidth = (column: DataGridColumnSnapshot | undefined): number => {
    if (!column) {
      return defaultColumnWidth
    }
    const resolvedWidth = options.resolveColumnWidth?.(column)
    if (typeof resolvedWidth === "number" && Number.isFinite(resolvedWidth)) {
      return resolvedWidth
    }
    return options.columnWidths?.value[column.key] ?? snapshotColumnWidths.value[column.key] ?? defaultColumnWidth
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
  const viewportSyncRafHandle = ref<number | null>(null)
  let lastViewportScrollTop = 0
  const isPaginationMode = computed<boolean>(() => {
    return resolveMaybeRef(options.mode) === "base" && resolveMaybeRef(options.rowRenderMode) === "pagination"
  })

  const viewportRowStart = computed<number>(() => {
    if (isPaginationMode.value) {
      return 0
    }
    return options.runtime.virtualWindow.value?.rowStart ?? 0
  })
  const viewportRowEnd = computed<number>(() => {
    if (isPaginationMode.value) {
      return Math.max(0, displayRows.value.length - 1)
    }
    return options.runtime.virtualWindow.value?.rowEnd ?? Math.max(0, options.totalRows.value - 1)
  })
  const renderedRowEnd = computed<number>(() => {
    if (isPaginationMode.value) {
      return Math.max(0, displayRows.value.length - 1)
    }
    if (!resolveMaybeRef(options.rowVirtualizationEnabled)) {
      return Math.max(0, options.totalRows.value - 1)
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
    const total = options.totalRows.value
    if (total <= 0) {
      return 0
    }
    if (
      typeof options.resolveRowOffset === "function"
      && typeof options.resolveTotalRowHeight === "function"
    ) {
      const renderedBottom = options.resolveRowOffset(renderedRowEnd.value + 1)
      return Math.max(0, options.resolveTotalRowHeight() - renderedBottom)
    }
    const afterCount = Math.max(0, total - (renderedRowEnd.value + 1))
    return afterCount * options.normalizedBaseRowHeight.value
  })

  const mainTrackWidth = computed<number>(() => {
    return options.visibleColumns.value.reduce((sum, column) => {
      return sum + resolveColumnWidth(column)
    }, 0)
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

    let runningWidth = 0
    let visibleStart = 0
    while (
      visibleStart < columns.length
      && runningWidth + resolveColumnWidth(columns[visibleStart]) <= viewportStartPx
    ) {
      runningWidth += resolveColumnWidth(columns[visibleStart])
      visibleStart += 1
    }

    if (visibleStart >= columns.length) {
      const lastIndex = columns.length - 1
      let leftSpacerWidth = 0
      for (let index = 0; index < lastIndex; index += 1) {
        leftSpacerWidth += resolveColumnWidth(columns[index])
      }
      return {
        start: lastIndex,
        end: lastIndex,
        renderedColumns: columns.slice(lastIndex, lastIndex + 1),
        leftSpacerWidth,
        rightSpacerWidth: 0,
      }
    }

    let visibleEnd = visibleStart
    let coveredWidth = runningWidth
    while (visibleEnd < columns.length) {
      coveredWidth += resolveColumnWidth(columns[visibleEnd])
      if (coveredWidth >= viewportEndPx) {
        break
      }
      visibleEnd += 1
    }

    const start = Math.max(0, visibleStart - columnOverscan.value)
    const end = Math.min(columns.length - 1, visibleEnd + columnOverscan.value)

    let leftSpacerWidth = 0
    for (let index = 0; index < start; index += 1) {
      leftSpacerWidth += resolveColumnWidth(columns[index])
    }

    let renderedWidth = 0
    for (let index = start; index <= end; index += 1) {
      renderedWidth += resolveColumnWidth(columns[index])
    }

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
    const column = options.visibleColumns.value.find(candidate => candidate.key === key)
    const width = resolveColumnWidth(column)
    const px = `${width}px`
    return {
      width: px,
      minWidth: px,
      maxWidth: px,
    }
  }

  const resolveViewportRangeFromElement = (element: HTMLElement): DataGridViewportRange => {
    const total = options.runtime.api.rows.getCount()
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
      const start = Math.max(0, options.resolveRowIndexAtOffset(element.scrollTop) - rowOverscan.value)
      const visibleBottomOffset = Math.max(0, element.scrollTop + Math.max(1, element.clientHeight) - 1)
      const end = Math.min(
        total - 1,
        options.resolveRowIndexAtOffset(visibleBottomOffset) + rowOverscan.value,
      )
      return { start, end }
    }

    const estimatedRowHeight = options.normalizedBaseRowHeight.value
    const start = Math.max(0, Math.floor(element.scrollTop / estimatedRowHeight) - rowOverscan.value)
    const visibleCount = Math.ceil(Math.max(1, element.clientHeight) / estimatedRowHeight) + rowOverscan.value * 2
    const end = Math.min(total - 1, start + visibleCount - 1)
    return { start, end }
  }

  const syncVisibleRows = (range: DataGridViewportRange): void => {
    displayRows.value = options.runtime.syncRowsInRange(range)
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

  const handleViewportScroll = (event: Event): void => {
    const element = event.target as HTMLElement
    viewportScrollLeft.value = element.scrollLeft
    viewportScrollTop.value = element.scrollTop
    viewportClientWidth.value = element.clientWidth
    syncHeaderScrollLeftFromBody(element.scrollLeft)
    if (element.scrollTop === lastViewportScrollTop) {
      return
    }
    lastViewportScrollTop = element.scrollTop
    syncVisibleRows(resolveViewportRangeFromElement(element))
  }

  const syncViewportFromDom = (): void => {
    const element = bodyViewportRef.value
    if (!element) {
      return
    }
    lastViewportScrollTop = element.scrollTop
    viewportScrollLeft.value = element.scrollLeft
    viewportScrollTop.value = element.scrollTop
    viewportClientWidth.value = element.clientWidth
    syncHeaderScrollLeftFromBody(element.scrollLeft)
    syncVisibleRows(resolveViewportRangeFromElement(element))
    options.measureVisibleRowHeights?.()
  }

  const scheduleViewportSync = (): void => {
    if (viewportSyncRafHandle.value != null) {
      return
    }
    viewportSyncRafHandle.value = window.requestAnimationFrame(() => {
      viewportSyncRafHandle.value = null
      syncViewportFromDom()
    })
  }

  const cancelScheduledViewportSync = (): void => {
    if (viewportSyncRafHandle.value == null) {
      return
    }
    window.cancelAnimationFrame(viewportSyncRafHandle.value)
    viewportSyncRafHandle.value = null
  }

  return {
    headerViewportRef,
    bodyViewportRef,
    viewportScrollTop,
    displayRows,
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
