import type {
  DataGridAggregationModel,
  DataGridClientComputeDiagnostics,
  DataGridClientRowPatch,
  DataGridClientRowPatchOptions,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridPaginationInput,
  DataGridPivotSpec,
  DataGridRowModel,
  DataGridRowModelListener,
  DataGridRowModelRefreshReason,
  DataGridRowModelSnapshot,
  DataGridRowNode,
  DataGridRowNodeInput,
  DataGridSortAndFilterModelInput,
  DataGridSortState,
  DataGridViewportRange,
} from "@affino/datagrid-core"
import type {
  DataGridWorkerMessageEvent,
  DataGridWorkerMessageSource,
  DataGridWorkerMessageTarget,
} from "./postMessageTransport.js"
import {
  createDataGridWorkerRowModelCommandMessage,
  isDataGridWorkerRowModelUpdateMessage,
  type DataGridWorkerRowModelCommand,
  type DataGridWorkerViewportCoalesceScope,
} from "./workerOwnedRowModelProtocol.js"

export interface DataGridWorkerOwnedRowModel<T = unknown> extends DataGridRowModel<T> {
  setRows: (rows: readonly DataGridRowNodeInput<T>[]) => void
  patchRows: (
    updates: readonly DataGridClientRowPatch<T>[],
    options?: DataGridClientRowPatchOptions,
  ) => void
  getComputeDiagnostics: () => DataGridClientComputeDiagnostics
  getWorkerProtocolDiagnostics: () => {
    updatesReceived: number
    updatesApplied: number
    updatesDroppedStale: number
    updatesDroppedInitialAfterApplied: number
    loadingSetCount: number
    loadingClearCount: number
  }
}

export interface CreateDataGridWorkerOwnedRowModelOptions<T = unknown> {
  source: DataGridWorkerMessageSource
  target: DataGridWorkerMessageTarget
  channel?: string | null
  initialSnapshot?: DataGridRowModelSnapshot<T> | null
  requestInitialSync?: boolean
  viewportCoalescingStrategy?: "split" | "simple"
}

function createDefaultSnapshot<T>(): DataGridRowModelSnapshot<T> {
  return {
    kind: "client",
    rowCount: 0,
    loading: false,
    error: null,
    viewportRange: { start: 0, end: 0 },
    pagination: {
      enabled: false,
      pageSize: 0,
      currentPage: 0,
      pageCount: 0,
      totalRowCount: 0,
      startIndex: 0,
      endIndex: 0,
    },
    sortModel: [],
    filterModel: null,
    groupBy: null,
    pivotModel: null,
    pivotColumns: [],
    groupExpansion: {
      expandedByDefault: false,
      toggledGroupKeys: [],
    },
  }
}

function cloneRowNode<T>(row: DataGridRowNode<T>): DataGridRowNode<T> {
  return {
    ...row,
    groupMeta: row.groupMeta
      ? {
        ...row.groupMeta,
        aggregates: row.groupMeta.aggregates
          ? { ...row.groupMeta.aggregates }
          : undefined,
      }
      : undefined,
    state: { ...row.state },
  }
}

function cloneSnapshot<T>(snapshot: DataGridRowModelSnapshot<T>): DataGridRowModelSnapshot<T> {
  return {
    ...snapshot,
    viewportRange: {
      start: snapshot.viewportRange.start,
      end: snapshot.viewportRange.end,
    },
    pagination: {
      ...snapshot.pagination,
    },
    sortModel: snapshot.sortModel.map(sort => ({ ...sort })),
    filterModel: snapshot.filterModel
      ? {
        columnFilters: { ...snapshot.filterModel.columnFilters },
        advancedFilters: { ...snapshot.filterModel.advancedFilters },
        advancedExpression: snapshot.filterModel.advancedExpression ?? null,
      }
      : null,
    groupBy: snapshot.groupBy
      ? {
        fields: [...snapshot.groupBy.fields],
        expandedByDefault: snapshot.groupBy.expandedByDefault,
      }
      : null,
    pivotModel: snapshot.pivotModel
      ? {
        rows: [...snapshot.pivotModel.rows],
        columns: [...snapshot.pivotModel.columns],
        values: snapshot.pivotModel.values.map(value => ({ ...value })),
        ...(snapshot.pivotModel.rowSubtotals ? { rowSubtotals: true } : {}),
        ...(snapshot.pivotModel.columnSubtotals ? { columnSubtotals: true } : {}),
        ...(snapshot.pivotModel.columnGrandTotal ? { columnGrandTotal: true } : {}),
        ...(snapshot.pivotModel.columnSubtotalPosition
          ? { columnSubtotalPosition: snapshot.pivotModel.columnSubtotalPosition }
          : {}),
        ...(snapshot.pivotModel.columnGrandTotalPosition
          ? { columnGrandTotalPosition: snapshot.pivotModel.columnGrandTotalPosition }
          : {}),
        ...(snapshot.pivotModel.grandTotal ? { grandTotal: true } : {}),
      }
      : null,
    pivotColumns: snapshot.pivotColumns
      ? snapshot.pivotColumns.map(column => ({
        ...column,
        columnPath: column.columnPath.map(segment => ({ ...segment })),
      }))
      : [],
    groupExpansion: {
      expandedByDefault: snapshot.groupExpansion.expandedByDefault,
      toggledGroupKeys: [...snapshot.groupExpansion.toggledGroupKeys],
    },
  }
}

function cloneAggregationModel<T>(
  model: DataGridAggregationModel<T> | null | undefined,
): DataGridAggregationModel<T> | null {
  if (!model) {
    return null
  }
  return {
    columns: model.columns.map(column => ({
      ...column,
    })),
    ...(model.basis ? { basis: model.basis } : {}),
  }
}

export function createDataGridWorkerOwnedRowModel<T = unknown>(
  options: CreateDataGridWorkerOwnedRowModelOptions<T>,
): DataGridWorkerOwnedRowModel<T> {
  interface QueuedCommand {
    requestId: number
    payload: DataGridWorkerRowModelCommand<T>
    coalesceKey: string | null
  }

  const MAX_WINDOW_CACHE_SIZE = 8
  const INITIAL_SYNC_PREFETCH_MAX_ROWS = 25
  const viewportCoalescingStrategy = options.viewportCoalescingStrategy ?? "split"
  let disposed = false
  let nextRequestId = 1
  let lastAppliedRequestId = 0
  let initialWindowPrefetchResolved = false
  let loadingViewport = false
  let pendingViewportRequestId = 0
  let pendingViewportRange: DataGridViewportRange | null = null
  let requestedViewportRange: DataGridViewportRange | null = null
  let dispatchCount = 0
  let updatesReceived = 0
  let updatesApplied = 0
  let updatesDroppedStale = 0
  let updatesDroppedInitialAfterApplied = 0
  let loadingSetCount = 0
  let loadingClearCount = 0
  let snapshot = options.initialSnapshot
    ? cloneSnapshot(options.initialSnapshot)
    : createDefaultSnapshot<T>()
  let aggregationModel: DataGridAggregationModel<T> | null = null
  let visibleRange = {
    start: snapshot.viewportRange.start,
    end: snapshot.viewportRange.end,
  }
  let visibleRows: DataGridRowNode<T>[] = []
  const visibleWindowCache = new Map<string, readonly DataGridRowNode<T>[]>()
  const visibleWindowCacheOrder: string[] = []
  const queuedCommands: QueuedCommand[] = []
  const queuedCommandIndexByKey = new Map<string, number>()
  let flushScheduled = false
  const listeners = new Set<DataGridRowModelListener<T>>()

  const rangeKey = (range: DataGridViewportRange): string => `${range.start}:${range.end}`
  const rangeContains = (
    container: DataGridViewportRange | null,
    target: DataGridViewportRange,
  ): boolean => {
    if (!container) {
      return false
    }
    return container.start <= target.start && container.end >= target.end
  }
  const isSameRange = (left: DataGridViewportRange | null, right: DataGridViewportRange): boolean => {
    return Boolean(left) && left!.start === right.start && left!.end === right.end
  }
  const normalizeRequestedRange = (range: DataGridViewportRange): DataGridViewportRange => {
    if (range.start <= range.end) {
      return range
    }
    return {
      start: range.end,
      end: range.start,
    }
  }
  const normalizeDispatchViewportRange = (range: DataGridViewportRange): DataGridViewportRange => {
    const normalized = normalizeRequestedRange(range)
    const requestedSize = Math.max(1, normalized.end - normalized.start + 1)
    const prefetchPad = Math.max(24, Math.min(96, Math.ceil(requestedSize * 0.75)))
    const rowCount = Math.max(0, snapshot.rowCount)
    const expandedStart = Math.max(0, normalized.start - prefetchPad)
    const expandedEndRaw = normalized.end + prefetchPad
    const expandedEnd = rowCount > 0 ? Math.min(rowCount - 1, expandedEndRaw) : expandedEndRaw
    return {
      start: expandedStart,
      end: Math.max(expandedStart, expandedEnd),
    }
  }
  const isRangeCoveredByVisibleWindow = (range: DataGridViewportRange): boolean => {
    if (visibleRows.length <= 0) {
      return false
    }
    return rangeContains(visibleRange, range)
  }
  const clampRangeToRowCount = (range: DataGridViewportRange, rowCount: number): DataGridViewportRange => {
    const normalized = normalizeRequestedRange(range)
    if (rowCount <= 0) {
      return { start: 0, end: 0 }
    }
    const start = Math.max(0, Math.min(rowCount - 1, normalized.start))
    const end = Math.max(start, Math.min(rowCount - 1, normalized.end))
    return { start, end }
  }

  const buildPublicSnapshot = (): DataGridRowModelSnapshot<T> => {
    const nextSnapshot = cloneSnapshot(snapshot)
    if (loadingViewport) {
      nextSnapshot.loading = true
    }
    return nextSnapshot
  }

  const emit = (): void => {
    const nextSnapshot = buildPublicSnapshot()
    for (const listener of listeners) {
      listener(nextSnapshot)
    }
  }

  const getCoalesceKey = (payload: DataGridWorkerRowModelCommand<T>): string | null => {
    switch (payload.type) {
      case "set-rows":
        return payload.type
      case "set-viewport-range":
        if (viewportCoalescingStrategy === "simple") {
          return "set-viewport-range"
        }
        return `set-viewport-range:${payload.coalesceScope ?? "user"}`
      case "set-pagination":
      case "set-page-size":
      case "set-current-page":
      case "set-sort-model":
      case "set-filter-model":
      case "set-sort-and-filter-model":
      case "set-group-by":
      case "set-pivot-model":
      case "set-aggregation-model":
      case "set-group-expansion":
      case "refresh":
        return payload.type
      default:
        return null
    }
  }

  const cloneForTransport = <TValue>(value: TValue, context: string): TValue => {
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value)
      } catch {
        // Fallback below for reactive proxies and other non-structured values.
      }
    }
    try {
      return JSON.parse(JSON.stringify(value)) as TValue
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`[AffinoDataGrid worker] Unable to serialize ${context}: ${reason}`)
    }
  }

  const ensureAggregationModelSerializable = (
    model: DataGridAggregationModel<T> | null,
  ): void => {
    if (!model) {
      return
    }
    for (const column of model.columns) {
      if (
        typeof column.createState === "function"
        || typeof column.add === "function"
        || typeof column.remove === "function"
        || typeof column.finalize === "function"
        || typeof column.coerce === "function"
      ) {
        throw new Error(
          "[AffinoDataGrid worker] aggregationModel with function callbacks is not supported in worker-owned mode.",
        )
      }
    }
  }

  const normalizeCommandPayload = (
    payload: DataGridWorkerRowModelCommand<T>,
  ): DataGridWorkerRowModelCommand<T> => {
    if (payload.type === "set-aggregation-model") {
      ensureAggregationModelSerializable(payload.aggregationModel)
    }
    return cloneForTransport(payload, `command '${payload.type}'`)
  }

  const pushWindowCache = (
    range: DataGridViewportRange,
    rows: readonly DataGridRowNode<T>[],
    cloneRows = true,
  ): void => {
    const key = rangeKey(range)
    if (visibleWindowCache.has(key)) {
      const existingIndex = visibleWindowCacheOrder.indexOf(key)
      if (existingIndex >= 0) {
        visibleWindowCacheOrder.splice(existingIndex, 1)
      }
    }
    visibleWindowCache.set(key, cloneRows ? rows.map(cloneRowNode) : rows)
    visibleWindowCacheOrder.push(key)
    while (visibleWindowCacheOrder.length > MAX_WINDOW_CACHE_SIZE) {
      const oldestKey = visibleWindowCacheOrder.shift()
      if (!oldestKey) {
        break
      }
      visibleWindowCache.delete(oldestKey)
    }
  }

  const markViewportLoading = (range: DataGridViewportRange, requestId: number): void => {
    pendingViewportRequestId = Math.max(pendingViewportRequestId, requestId)
    pendingViewportRange = { start: range.start, end: range.end }
    if (loadingViewport) {
      return
    }
    loadingViewport = true
    loadingSetCount += 1
    emit()
  }

  const scheduleFlush = (): void => {
    if (flushScheduled || disposed) {
      return
    }
    flushScheduled = true
    queueMicrotask(() => {
      flushScheduled = false
      if (disposed || queuedCommands.length === 0) {
        return
      }
      const commands = queuedCommands.splice(0, queuedCommands.length)
      queuedCommandIndexByKey.clear()
      for (const command of commands) {
        try {
          const message = createDataGridWorkerRowModelCommandMessage(
            command.requestId,
            command.payload,
            options.channel,
          )
          dispatchCount += 1
          options.target.postMessage(message)
          if (command.payload.type === "set-viewport-range") {
            markViewportLoading(command.payload.range, command.requestId)
          }
        } catch (error) {
          loadingViewport = false
          pendingViewportRequestId = 0
          pendingViewportRange = null
          const reason = error instanceof Error ? error.message : String(error)
          snapshot = {
            ...snapshot,
            error: `[AffinoDataGrid worker] dispatch failed: ${reason}`,
          }
          emit()
        }
      }
    })
  }

  const dispatchCommand = (payload: DataGridWorkerRowModelCommand<T>): number => {
    if (disposed) {
      return 0
    }
    const normalizedPayload = normalizeCommandPayload(payload)
    const requestId = nextRequestId++
    const coalesceKey = getCoalesceKey(normalizedPayload)
    if (coalesceKey) {
      const existingIndex = queuedCommandIndexByKey.get(coalesceKey)
      if (typeof existingIndex === "number" && queuedCommands[existingIndex]) {
        queuedCommands[existingIndex] = {
          requestId,
          payload: normalizedPayload,
          coalesceKey,
        }
        scheduleFlush()
        return requestId
      }
    }
    const command: QueuedCommand = {
      requestId,
      payload: normalizedPayload,
      coalesceKey,
    }
    queuedCommands.push(command)
    if (coalesceKey) {
      queuedCommandIndexByKey.set(coalesceKey, queuedCommands.length - 1)
    }
    scheduleFlush()
    return requestId
  }

  const dispatchViewportRange = (
    range: DataGridViewportRange,
    coalesceScope: DataGridWorkerViewportCoalesceScope,
  ): number => {
    const normalizedRequestedRange = normalizeRequestedRange(range)
    const syncRequestedViewportSnapshot = (): void => {
      if (coalesceScope !== "user" || isSameRange(snapshot.viewportRange, normalizedRequestedRange)) {
        return
      }
      snapshot = {
        ...snapshot,
        viewportRange: { ...normalizedRequestedRange },
      }
      emit()
    }
    if (coalesceScope === "user") {
      requestedViewportRange = { ...normalizedRequestedRange }
    }
    if (
      isRangeCoveredByVisibleWindow(normalizedRequestedRange)
      || rangeContains(pendingViewportRange, normalizedRequestedRange)
    ) {
      syncRequestedViewportSnapshot()
      return 0
    }
    const dispatchRange = normalizeDispatchViewportRange(normalizedRequestedRange)
    if (
      isRangeCoveredByVisibleWindow(dispatchRange)
      || rangeContains(pendingViewportRange, dispatchRange)
    ) {
      syncRequestedViewportSnapshot()
      return 0
    }
    const normalizedScope: DataGridWorkerViewportCoalesceScope = viewportCoalescingStrategy === "simple"
      ? "user"
      : coalesceScope
    const requestId = dispatchCommand({
      type: "set-viewport-range",
      range: dispatchRange,
      coalesceScope: normalizedScope,
    })
    if (requestId > 0) {
      markViewportLoading(dispatchRange, requestId)
    }
    return requestId
  }

  const onMessage = (event: DataGridWorkerMessageEvent): void => {
    if (disposed) {
      return
    }
    if (!isDataGridWorkerRowModelUpdateMessage<T>(event.data, options.channel)) {
      return
    }
    updatesReceived += 1
    const requestId = event.data.requestId
    if (requestId === 0 && lastAppliedRequestId > 0) {
      updatesDroppedInitialAfterApplied += 1
      return
    }
    if (requestId > 0 && requestId < lastAppliedRequestId) {
      updatesDroppedStale += 1
      return
    }
    if (requestId > 0) {
      lastAppliedRequestId = requestId
    }
    const update = event.data.payload
    snapshot = cloneSnapshot(update.snapshot)
    if (requestedViewportRange) {
      snapshot = {
        ...snapshot,
        viewportRange: clampRangeToRowCount(requestedViewportRange, snapshot.rowCount),
      }
    }
    aggregationModel = cloneAggregationModel(update.aggregationModel)
    visibleRange = {
      start: update.visibleRange.start,
      end: update.visibleRange.end,
    }
    visibleRows = update.visibleRows.map(cloneRowNode)
    pushWindowCache(visibleRange, visibleRows, false)

    if (!initialWindowPrefetchResolved && requestId === 0) {
      const totalRows = snapshot.rowCount
      if (totalRows > 0 && totalRows <= INITIAL_SYNC_PREFETCH_MAX_ROWS) {
        const prefetchedRange: DataGridViewportRange = {
          start: 0,
          end: totalRows - 1,
        }
        const expectedCount = prefetchedRange.end - prefetchedRange.start + 1
        const hasFullInitialWindow = visibleRange.start === prefetchedRange.start
          && visibleRange.end === prefetchedRange.end
          && visibleRows.length >= expectedCount
        if (!hasFullInitialWindow && !isSameRange(pendingViewportRange, prefetchedRange)) {
          dispatchViewportRange(prefetchedRange, "prefetch")
        }
      }
      initialWindowPrefetchResolved = true
    }

    const matchesPendingRange = isSameRange(pendingViewportRange, visibleRange)
    if (loadingViewport && (requestId >= pendingViewportRequestId || matchesPendingRange)) {
      loadingViewport = false
      pendingViewportRequestId = 0
      pendingViewportRange = null
      loadingClearCount += 1
    }
    updatesApplied += 1
    emit()
  }

  options.source.addEventListener("message", onMessage)
  if (options.requestInitialSync !== false) {
    dispatchCommand({ type: "sync" })
  }

  const readVisibleRowByIndex = (index: number): DataGridRowNode<T> | undefined => {
    if (index < visibleRange.start || index > visibleRange.end) {
      return undefined
    }
    return visibleRows[index - visibleRange.start]
  }

  return {
    kind: "client",
    getSnapshot() {
      return buildPublicSnapshot()
    },
    getRowCount() {
      return snapshot.rowCount
    },
    getRow(index: number) {
      const row = readVisibleRowByIndex(index)
      if (row) {
        return cloneRowNode(row)
      }
      const requestedRange = { start: index, end: index }
      if (!isSameRange(pendingViewportRange, requestedRange)) {
        dispatchViewportRange(requestedRange, "user")
      }
      return undefined
    },
    getRowsInRange(range: DataGridViewportRange) {
      if (range.start !== visibleRange.start || range.end !== visibleRange.end) {
        if (!isSameRange(pendingViewportRange, range)) {
          dispatchViewportRange(range, "user")
        }
      }
      const key = rangeKey(range)
      const cachedRows = visibleWindowCache.get(key)
      if (cachedRows) {
        return cachedRows.map(cloneRowNode)
      }
      const rows: DataGridRowNode<T>[] = []
      for (let index = range.start; index <= range.end; index += 1) {
        const row = readVisibleRowByIndex(index)
        if (row) {
          rows.push(cloneRowNode(row))
        }
      }
      return rows
    },
    setViewportRange(range: DataGridViewportRange) {
      dispatchViewportRange(range, "user")
    },
    setPagination(pagination: DataGridPaginationInput | null) {
      dispatchCommand({ type: "set-pagination", pagination })
    },
    setPageSize(pageSize: number | null) {
      dispatchCommand({ type: "set-page-size", pageSize })
    },
    setCurrentPage(page: number) {
      dispatchCommand({ type: "set-current-page", page })
    },
    setSortModel(sortModel: readonly DataGridSortState[]) {
      dispatchCommand({ type: "set-sort-model", sortModel: sortModel.map(sort => ({ ...sort })) })
    },
    setFilterModel(filterModel: DataGridFilterSnapshot | null) {
      dispatchCommand({ type: "set-filter-model", filterModel })
    },
    setSortAndFilterModel(input: DataGridSortAndFilterModelInput) {
      dispatchCommand({
        type: "set-sort-and-filter-model",
        input: {
          sortModel: input.sortModel.map(sort => ({ ...sort })),
          filterModel: input.filterModel,
        },
      })
    },
    setGroupBy(groupBy: DataGridGroupBySpec | null) {
      dispatchCommand({ type: "set-group-by", groupBy })
    },
    setPivotModel(pivotModel: DataGridPivotSpec | null) {
      dispatchCommand({ type: "set-pivot-model", pivotModel })
    },
    getPivotModel() {
      if (!snapshot.pivotModel) {
        return null
      }
      return {
        rows: [...snapshot.pivotModel.rows],
        columns: [...snapshot.pivotModel.columns],
        values: snapshot.pivotModel.values.map(value => ({ ...value })),
        ...(snapshot.pivotModel.rowSubtotals ? { rowSubtotals: true } : {}),
        ...(snapshot.pivotModel.columnSubtotals ? { columnSubtotals: true } : {}),
        ...(snapshot.pivotModel.columnGrandTotal ? { columnGrandTotal: true } : {}),
        ...(snapshot.pivotModel.columnSubtotalPosition
          ? { columnSubtotalPosition: snapshot.pivotModel.columnSubtotalPosition }
          : {}),
        ...(snapshot.pivotModel.columnGrandTotalPosition
          ? { columnGrandTotalPosition: snapshot.pivotModel.columnGrandTotalPosition }
          : {}),
        ...(snapshot.pivotModel.grandTotal ? { grandTotal: true } : {}),
      }
    },
    setAggregationModel(nextAggregationModel: DataGridAggregationModel<T> | null) {
      const nextModel = cloneAggregationModel(nextAggregationModel)
      aggregationModel = nextModel
      dispatchCommand({ type: "set-aggregation-model", aggregationModel: nextModel })
    },
    getAggregationModel() {
      return cloneAggregationModel(aggregationModel)
    },
    setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null) {
      dispatchCommand({ type: "set-group-expansion", expansion })
    },
    toggleGroup(groupKey: string) {
      dispatchCommand({ type: "toggle-group", groupKey })
    },
    expandGroup(groupKey: string) {
      dispatchCommand({ type: "expand-group", groupKey })
    },
    collapseGroup(groupKey: string) {
      dispatchCommand({ type: "collapse-group", groupKey })
    },
    expandAllGroups() {
      dispatchCommand({ type: "expand-all-groups" })
    },
    collapseAllGroups() {
      dispatchCommand({ type: "collapse-all-groups" })
    },
    refresh(reason?: DataGridRowModelRefreshReason) {
      dispatchCommand({ type: "refresh", reason })
    },
    subscribe(listener: DataGridRowModelListener<T>) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setRows(rows: readonly DataGridRowNodeInput<T>[]) {
      dispatchCommand({ type: "set-rows", rows })
    },
    patchRows(
      updates: readonly DataGridClientRowPatch<T>[],
      options?: DataGridClientRowPatchOptions,
    ) {
      dispatchCommand({ type: "patch-rows", updates, options })
    },
    getComputeDiagnostics() {
      return {
        configuredMode: "worker",
        effectiveMode: "worker",
        transportKind: "custom",
        dispatchCount,
        fallbackCount: 0,
      }
    },
    getWorkerProtocolDiagnostics() {
      return {
        updatesReceived,
        updatesApplied,
        updatesDroppedStale,
        updatesDroppedInitialAfterApplied,
        loadingSetCount,
        loadingClearCount,
      }
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      options.source.removeEventListener("message", onMessage)
      listeners.clear()
      visibleRows = []
      visibleWindowCache.clear()
      visibleWindowCacheOrder.length = 0
      queuedCommands.length = 0
      queuedCommandIndexByKey.clear()
    },
  }
}
