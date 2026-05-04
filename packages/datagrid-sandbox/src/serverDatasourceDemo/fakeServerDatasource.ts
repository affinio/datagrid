import {
  buildDataGridAdvancedFilterExpressionFromLegacyFilters,
  evaluateColumnPredicateFilter,
  evaluateDataGridAdvancedFilterExpression,
  serializeColumnValueToToken,
  type DataGridColumnHistogram,
  type DataGridColumnHistogramEntry,
  type DataGridFilterSnapshot,
  type DataGridGroupExpansionSnapshot,
  type DataGridSortState,
  type DataGridViewportRange,
} from "@affino/datagrid-vue"
import type {
  ServerDemoAggregationDiagnostics,
  ServerDemoCommitEditsRequest,
  ServerDemoCommitEditsResult,
  ServerDemoCommitDiagnostics,
  ServerDemoDatasourceHooks,
  ServerDemoDataSource,
  ServerDemoFillBoundaryRequest,
  ServerDemoFillBoundaryResult,
  ServerDemoFillDiagnostics,
  ServerDemoFillOperationRecord,
  ServerDemoFillOperationRequest,
  ServerDemoHistogramRequest,
  ServerDemoMutableState,
  ServerDemoPullDiagnostics,
  ServerDemoPullRequest,
  ServerDemoPullResult,
  ServerDemoRow,
  ServerDemoSampleDiagnostics,
  ServerDemoPushListener,
  ServerDemoUndoFillRequest,
} from "./types"
import {
  createServerDemoMutableState,
  SERVER_DEMO_LATENCY_MS,
  SERVER_DEMO_PAGE_SIZE,
  SERVER_DEMO_REGIONS,
  SERVER_DEMO_ROW_COUNT,
  SERVER_DEMO_SEGMENTS,
  SERVER_DEMO_STATUSES,
} from "./types"

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      globalThis.clearTimeout(timeout)
      reject(new DOMException("Aborted", "AbortError"))
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

function resolveRowId(index: number): string {
  return `srv-${index.toString().padStart(6, "0")}`
}

function normalizeViewportRange(range: unknown): DataGridViewportRange | null {
  if (!range || typeof range !== "object") {
    return null
  }
  const candidate = range as {
    startRow?: unknown
    endRow?: unknown
    start?: unknown
    end?: unknown
  }
  const start = Number.isFinite(candidate.startRow)
    ? Number(candidate.startRow)
    : Number.isFinite(candidate.start)
      ? Number(candidate.start)
      : NaN
  const end = Number.isFinite(candidate.endRow)
    ? Number(candidate.endRow)
    : Number.isFinite(candidate.end)
      ? Number(candidate.end)
      : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null
  }
  return {
    start: Math.max(0, Math.trunc(Math.min(start, end))),
    end: Math.max(0, Math.trunc(Math.max(start, end))),
  }
}

function formatViewportRange(range: DataGridViewportRange | null | undefined): string {
  if (!range) {
    return "none"
  }
  return `${range.start}..${range.end}`
}

function createEmptySampleDiagnostics(): ServerDemoSampleDiagnostics {
  return {
    sampleColumn: "none",
    sampleState: "none",
    sampleRow: "none",
    sampleBefore: "none",
    sampleAfter: "none",
    samplePullAfter: "none",
    sampleCachedAfter: "none",
    sampleRowIndex: "none",
    sampleVisibleIndex: "none",
    sampleLookupByIndex: "none",
    sampleLookupById: "none",
    sampleRowCache: "none",
    sampleCellReader: "none",
    sampleRendered: "none",
    visibleRowsPreview: "none",
    rowModelSnapshot: "none",
  }
}

function createEmptyFillDiagnostics(): ServerDemoFillDiagnostics {
  return {
    fillWarning: "none",
    fillBlocked: "no",
    fillApplied: "no",
    commitFillOperationCalled: "unknown",
    operationId: "none",
    affectedRows: "0",
    affectedRange: "none",
    visibleOverlap: "unknown",
    request: "none",
    mode: "none",
    fillColumns: "none",
    referenceColumns: "none",
    dispatchAttempted: "unknown",
    renderedViewport: "none",
    rawInvalidation: "none",
    invalidationRange: "none",
    normalizedInvalidation: "none",
    invalidationApplied: "unknown",
    runtimeRowModelInvalidateType: "none",
    invalidateCalled: "unknown",
    cacheRow1BeforeInvalidation: "unknown",
    cacheRow1AfterInvalidation: "unknown",
    syncInputRange: "none",
    latestRenderedViewport: "none",
    runtimeRenderedViewport: "none",
    displayRowsRenderedViewport: "none",
    selectedRenderedViewport: "none",
    refreshUsedStoredRendered: "unknown",
  }
}

function compareSortValue(left: unknown, right: unknown, direction: "asc" | "desc"): number {
  const multiplier = direction === "desc" ? -1 : 1
  if (left === right) {
    return 0
  }
  if (typeof left === "number" && typeof right === "number") {
    return left < right ? -1 * multiplier : 1 * multiplier
  }
  return String(left).localeCompare(String(right)) * multiplier
}

function resolveBaseRow(index: number): ServerDemoRow {
  const segment = SERVER_DEMO_SEGMENTS[index % SERVER_DEMO_SEGMENTS.length]!
  const status = SERVER_DEMO_STATUSES[(index * 5) % SERVER_DEMO_STATUSES.length]!
  const region = SERVER_DEMO_REGIONS[(index * 7) % SERVER_DEMO_REGIONS.length]!
  const value = (index * 97) % 100_000
  const minute = String(index % 60).padStart(2, "0")
  return {
    id: resolveRowId(index),
    index,
    name: `Account ${index.toString().padStart(5, "0")}`,
    segment,
    status,
    region,
    value,
    updatedAt: "2026-04-30T12:" + minute + ":00.000Z",
  }
}

function createRow(state: ServerDemoMutableState, index: number): ServerDemoRow {
  const baseRow = resolveBaseRow(index)
  const committed = state.committedOverrides.get(baseRow.id)
  const pending = state.pendingOverrides.get(baseRow.id)
  return committed || pending ? { ...baseRow, ...committed, ...pending } : baseRow
}

function resolveColumnValue(row: ServerDemoRow, columnKey: string): unknown {
  return row[columnKey as keyof ServerDemoRow]
}

function applyOverride(state: ServerDemoMutableState, rowId: string, columnKey: string, value: unknown): void {
  const next = { ...(state.committedOverrides.get(rowId) ?? {}) }
  next[columnKey as keyof ServerDemoRow] = value as never
  state.committedOverrides.set(rowId, next)
}

function clearOverride(state: ServerDemoMutableState, rowId: string, columnKey: string): void {
  const existing = state.committedOverrides.get(rowId)
  if (!existing) {
    return
  }
  const next = { ...existing }
  delete next[columnKey as keyof ServerDemoRow]
  if (Object.keys(next).length === 0) {
    state.committedOverrides.delete(rowId)
    return
  }
  state.committedOverrides.set(rowId, next)
}

function buildSeriesValue(seed: unknown, offset: number): unknown {
  if (typeof seed === "number") {
    return seed + offset
  }
  const text = String(seed ?? "")
  const match = text.match(/^(.*?)(-?\d+)$/)
  if (!match) {
    return text
  }
  const prefix = match[1] ?? ""
  const value = Number(match[2] ?? "0")
  return `${prefix}${value + offset}`
}

function isNonEmptyFillBoundaryValue(value: unknown): boolean {
  if (value == null) {
    return false
  }
  if (typeof value === "string") {
    return value.trim().length > 0
  }
  return true
}

function compareBySortModel(
  left: ServerDemoRow,
  right: ServerDemoRow,
  sortModel: readonly DataGridSortState[],
): number {
  for (const descriptor of sortModel) {
    const leftValue = left[descriptor.key as keyof ServerDemoRow]
    const rightValue = right[descriptor.key as keyof ServerDemoRow]
    const comparison = compareSortValue(leftValue, rightValue, descriptor.direction)
    if (comparison !== 0) {
      return comparison
    }
  }
  return left.index - right.index
}

function matchesColumnFilter(
  row: ServerDemoRow,
  columnKey: string,
  filterEntry: DataGridFilterSnapshot["columnFilters"][string],
): boolean {
  if (!filterEntry) {
    return true
  }
  const candidate = row[columnKey as keyof ServerDemoRow]
  if (Array.isArray(filterEntry)) {
    const normalizedCandidate = serializeColumnValueToToken(candidate).toLowerCase()
    return filterEntry.some(token => String(token ?? "").toLowerCase() === normalizedCandidate)
  }
  if (filterEntry.kind === "valueSet") {
    const normalizedCandidate = serializeColumnValueToToken(candidate).toLowerCase()
    return (filterEntry.tokens ?? []).some(token => String(token ?? "").toLowerCase() === normalizedCandidate)
  }
  if (filterEntry.kind === "predicate") {
    return evaluateColumnPredicateFilter(filterEntry, candidate)
  }
  return true
}

function matchesFilterModel(row: ServerDemoRow, filterModel: DataGridFilterSnapshot | null): boolean {
  if (!filterModel) {
    return true
  }
  for (const [columnKey, filterEntry] of Object.entries(filterModel.columnFilters ?? {})) {
    if (!matchesColumnFilter(row, columnKey, filterEntry)) {
      return false
    }
  }
  const expression = filterModel.advancedExpression
    ?? buildDataGridAdvancedFilterExpressionFromLegacyFilters(filterModel.advancedFilters)
  if (!expression) {
    return true
  }
  if (expression.kind === "condition") {
    const key = String(expression.key ?? expression.field ?? "")
    if (!key) {
      return false
    }
    const candidate = row[key as keyof ServerDemoRow]
    const candidateText = String(candidate ?? "").toLowerCase()
    const expectedText = String(expression.value ?? "").toLowerCase()
    const operator = String(expression.operator ?? "contains").toLowerCase()
    if (operator === "contains") {
      return candidateText.includes(expectedText)
    }
    if (operator === "notcontains" || operator === "not-contains") {
      return !candidateText.includes(expectedText)
    }
    if (operator === "equals") {
      return candidateText === expectedText
    }
    if (operator === "startswith" || operator === "starts-with") {
      return candidateText.startsWith(expectedText)
    }
    if (operator === "endswith" || operator === "ends-with") {
      return candidateText.endsWith(expectedText)
    }
    return evaluateColumnPredicateFilter({
      kind: "predicate",
      operator: expression.operator as never,
      value: expression.value,
      value2: expression.value2,
    }, candidate)
  }
  return evaluateDataGridAdvancedFilterExpression(expression, condition => {
    const key = String(condition.key ?? condition.field ?? "")
    if (!key) {
      return false
    }
    const value = row[key as keyof ServerDemoRow]
    return evaluateColumnPredicateFilter({
      kind: "predicate",
      operator: String(condition.operator ?? "contains") as never,
      value: condition.value,
      value2: condition.value2,
    }, value)
  })
}

function buildFilteredRows(state: ServerDemoMutableState, filterModel: DataGridFilterSnapshot | null): readonly ServerDemoRow[] {
  const rows = Array.from({ length: SERVER_DEMO_ROW_COUNT }, (_unused, index) => createRow(state, index))
  if (!filterModel) {
    return rows
  }
  return rows.filter(row => matchesFilterModel(row, filterModel))
}

function buildProjectedRows(
  state: ServerDemoMutableState,
  sortModel: readonly DataGridSortState[],
  filterModel: DataGridFilterSnapshot | null,
): readonly ServerDemoRow[] {
  const filteredRows = buildFilteredRows(state, filterModel)
  if (sortModel.length === 0) {
    return filteredRows
  }
  return [...filteredRows].sort((left, right) => compareBySortModel(left, right, sortModel))
}

function createRegionGroupKey(region: string): string {
  return `group:region:${region}`
}

function isGroupExpandedLocal(expansion: DataGridGroupExpansionSnapshot, groupKey: string): boolean {
  const toggled = new Set(expansion.toggledGroupKeys)
  return expansion.expandedByDefault ? !toggled.has(groupKey) : toggled.has(groupKey)
}

function createRegionGroupRow(
  region: string,
  childCount: number,
  index: number,
  expanded: boolean,
): { index: number; rowId: string; kind: "group"; state: { expanded: boolean }; groupMeta: { groupKey: string; groupField: string; groupValue: string; level: number; childrenCount: number }; row: ServerDemoRow } {
  const groupKey = createRegionGroupKey(region)
  return {
    index,
    rowId: groupKey,
    kind: "group",
    state: {
      expanded,
    },
    groupMeta: {
      groupKey,
      groupField: "region",
      groupValue: region,
      level: 0,
      childrenCount: childCount,
    },
    row: {
      id: groupKey,
      index,
      name: `Region: ${region}`,
      segment: "Group",
      status: "Grouped",
      region,
      value: childCount,
      updatedAt: "grouped",
    },
  }
}

function buildRegionGroupedRows(
  rows: readonly ServerDemoRow[],
  expansion: DataGridGroupExpansionSnapshot,
): readonly { index: number; row: ServerDemoRow; rowId?: string; kind?: "group" | "leaf"; state?: { expanded?: boolean }; groupMeta?: { groupKey: string; groupField: string; groupValue: string; level: number; childrenCount: number } }[] {
  const buckets = new Map<string, ServerDemoRow[]>()
  for (const region of SERVER_DEMO_REGIONS) {
    buckets.set(region, [])
  }
  for (const row of rows) {
    const bucket = buckets.get(row.region) ?? []
    bucket.push(row)
    buckets.set(row.region, bucket)
  }

  const groupedRows: { index: number; row: ServerDemoRow; rowId?: string; kind?: "group" | "leaf"; state?: { expanded?: boolean }; groupMeta?: { groupKey: string; groupField: string; groupValue: string; level: number; childrenCount: number } }[] = []
  for (const region of SERVER_DEMO_REGIONS) {
    const children = buckets.get(region) ?? []
    if (children.length === 0) {
      continue
    }
    const groupKey = createRegionGroupKey(region)
    const expanded = isGroupExpandedLocal(expansion, groupKey)
    groupedRows.push(createRegionGroupRow(region, children.length, groupedRows.length, expanded))
    if (!expanded) {
      continue
    }
    for (const row of children) {
      groupedRows.push({
        index: groupedRows.length,
        row,
        rowId: row.id,
        kind: "leaf",
      })
    }
  }
  return groupedRows
}

function createRegionAggregateRow(
  region: string,
  childCount: number,
  valueSum: number,
  index: number,
): { index: number; rowId: string; kind: "leaf"; row: ServerDemoRow } {
  const rowId = `aggregate:region:${region}`
  return {
    index,
    rowId,
    kind: "leaf",
    row: {
      id: rowId,
      index,
      name: `Aggregate: ${region}`,
      segment: "Aggregate",
      status: `Count ${childCount}`,
      region,
      value: valueSum,
      updatedAt: "aggregated",
    },
  }
}

function buildRegionAggregateRows(rows: readonly ServerDemoRow[]) {
  const buckets = new Map<string, { count: number; valueSum: number }>()
  for (const region of SERVER_DEMO_REGIONS) {
    buckets.set(region, { count: 0, valueSum: 0 })
  }
  for (const row of rows) {
    const bucket = buckets.get(row.region) ?? { count: 0, valueSum: 0 }
    bucket.count += 1
    bucket.valueSum += row.value
    buckets.set(row.region, bucket)
  }
  const aggregateRows = []
  for (const region of SERVER_DEMO_REGIONS) {
    const bucket = buckets.get(region)
    if (!bucket || bucket.count === 0) {
      continue
    }
    aggregateRows.push(createRegionAggregateRow(region, bucket.count, bucket.valueSum, aggregateRows.length))
  }
  return aggregateRows
}

function normalizeHistogramSearch(search: string | undefined): string {
  return String(search ?? "").trim().toLowerCase()
}

function resolveHistogramValue(row: ServerDemoRow, columnId: string): unknown {
  switch (columnId) {
    case "region":
      return row.region
    case "segment":
      return row.segment
    case "status":
      return row.status
    case "value":
      return row.value
    default:
      return row[columnId as keyof ServerDemoRow]
  }
}

function compareHistogramEntries(left: DataGridColumnHistogramEntry, right: DataGridColumnHistogramEntry): number {
  if (left.count !== right.count) {
    return right.count - left.count
  }
  return String(left.text ?? left.value ?? left.token).localeCompare(String(right.text ?? right.value ?? right.token), undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

function cloneFilterModelExcludingColumn(
  filterModel: DataGridFilterSnapshot | null,
  columnKey: string,
): DataGridFilterSnapshot | null {
  if (!filterModel) {
    return null
  }
  const normalizedKey = columnKey.trim()
  const columnFilters: NonNullable<DataGridFilterSnapshot["columnFilters"]> = {}
  for (const [key, entry] of Object.entries(filterModel.columnFilters ?? {})) {
    if (key.trim() !== normalizedKey) {
      columnFilters[key] = entry
    }
  }
  return {
    ...filterModel,
    columnFilters,
  }
}

function buildColumnHistogram(
  state: ServerDemoMutableState,
  request: ServerDemoHistogramRequest,
): DataGridColumnHistogram {
  const rows = buildFilteredRows(
    state,
    request.options.ignoreSelfFilter === true
      ? cloneFilterModelExcludingColumn(request.filterModel, request.columnId)
      : request.filterModel,
  )
  const search = normalizeHistogramSearch(request.options.search)
  const histogram = new Map<string, DataGridColumnHistogramEntry>()
  for (const row of rows) {
    const value = resolveHistogramValue(row, request.columnId)
    if (value == null) {
      continue
    }
    const token = serializeColumnValueToToken(value)
    const existing = histogram.get(token)
    if (existing) {
      existing.count += 1
      continue
    }
    histogram.set(token, {
      token,
      value,
      text: String(value),
      count: 1,
    })
  }
  let entries = Array.from(histogram.values())
  if (search.length > 0) {
    entries = entries.filter(entry => {
      const text = String(entry.text ?? entry.value ?? entry.token).toLowerCase()
      return text.includes(search) || String(entry.token).toLowerCase().includes(search)
    })
  }
  if (request.options.orderBy === "valueAsc") {
    entries.sort((left, right) => String(left.text ?? left.value ?? left.token).localeCompare(String(right.text ?? right.value ?? right.token), undefined, {
      numeric: true,
      sensitivity: "base",
    }))
  } else {
    entries.sort(compareHistogramEntries)
  }
  const limit = Number.isFinite(request.options.limit)
    ? Math.max(0, Math.trunc(request.options.limit as number))
    : entries.length
  return entries.slice(0, limit)
}

function resolveFillBoundary(
  state: ServerDemoMutableState,
  request: ServerDemoFillBoundaryRequest,
): ServerDemoFillBoundaryResult {
  const projectedRows = buildProjectedRows(state, request.projection.sortModel, request.projection.filterModel)
  const baseRange = request.baseRange as unknown as { start?: number; end?: number; startRow?: number; endRow?: number }
  const rawEndRow = baseRange.endRow ?? baseRange.end ?? 0
  const baseEndRow = Math.max(0, Math.trunc(rawEndRow))
  const startIndex = Math.max(0, Math.trunc(baseEndRow + 1))
  const limit = Number.isFinite(request.limit)
    ? Math.max(0, Math.trunc(request.limit ?? 0))
    : projectedRows.length
  if (startIndex >= projectedRows.length) {
    return {
      endRowIndex: projectedRows.length > 0 ? projectedRows.length - 1 : null,
      endRowId: projectedRows[projectedRows.length - 1]?.id ?? null,
      boundaryKind: "data-end",
      scannedRowCount: 0,
      truncated: false,
    }
  }
  let endRowIndex = baseEndRow
  let boundaryKind: ServerDemoFillBoundaryResult["boundaryKind"] = "data-end"
  let scanned = 0
  for (let projectedIndex = startIndex; projectedIndex < projectedRows.length; projectedIndex += 1) {
    if (scanned >= limit) {
      boundaryKind = "cache-boundary"
      break
    }
    const row = projectedRows[projectedIndex]
    if (!row) {
      boundaryKind = "unresolved"
      break
    }
    scanned += 1
    const hasAdjacentData = request.referenceColumns.some(columnKey => {
      const candidate = row[columnKey as keyof ServerDemoRow]
      return isNonEmptyFillBoundaryValue(candidate)
    })
    if (!hasAdjacentData) {
      boundaryKind = projectedIndex >= projectedRows.length - 1 ? "data-end" : "gap"
      break
    }
    endRowIndex = projectedIndex
  }
  const endRowId = endRowIndex >= 0 ? projectedRows[endRowIndex]?.id ?? null : null
  return {
    endRowIndex: endRowIndex >= 0 ? endRowIndex : null,
    endRowId,
    boundaryKind,
    scannedRowCount: scanned,
    truncated: boundaryKind === "cache-boundary",
  }
}

function applyFillOperation(
  state: ServerDemoMutableState,
  request: ServerDemoFillOperationRequest,
): ServerDemoFillOperationRecord {
  const normalizedSourceRange = normalizeViewportRange(request.sourceRange)
  const normalizedTargetRange = normalizeViewportRange(request.targetRange)
  if (!normalizedSourceRange || !normalizedTargetRange || request.fillColumns.length === 0) {
    throw new Error("invalid server fill range")
  }
  const operationId = request.operationId && request.operationId.trim().length > 0
    ? request.operationId
    : `fill-${++state.fillRevision}`
  const changes: ServerDemoFillOperationRecord["changes"] = []
  const sourceHeight = Math.max(1, normalizedSourceRange.end - normalizedSourceRange.start + 1)
  for (let rowIndex = normalizedTargetRange.start; rowIndex <= normalizedTargetRange.end; rowIndex += 1) {
    const sourceRowIndex = normalizedSourceRange.start + ((rowIndex - normalizedTargetRange.start) % sourceHeight)
    const sourceRow = createRow(state, sourceRowIndex)
    const targetRow = createRow(state, rowIndex)
    for (const columnKey of request.fillColumns) {
      const before = resolveColumnValue(targetRow, columnKey)
      const sourceValue = resolveColumnValue(sourceRow, columnKey)
      const after = request.mode === "series"
        ? buildSeriesValue(sourceValue, rowIndex - normalizedTargetRange.start)
        : sourceValue
      changes.push({
        rowId: targetRow.id,
        columnKey,
        before,
        after,
      })
      applyOverride(state, targetRow.id, columnKey, after)
    }
  }
  const record: ServerDemoFillOperationRecord = {
    operationId,
    revision: ++state.fillRevision,
    sourceRange: normalizedSourceRange,
    targetRange: normalizedTargetRange,
    mode: request.mode,
    changes,
    applied: true,
  }
  return record
}

function toggleFillOperation(
  state: ServerDemoMutableState,
  operationId: string,
  apply: boolean,
): ServerDemoFillOperationRecord | null {
  const record = state.fillOperations.get(operationId)
  if (!record) {
    return null
  }
  for (const change of record.changes) {
    if (apply) {
      applyOverride(state, change.rowId, change.columnKey, change.after)
    } else if (typeof change.before === "undefined") {
      clearOverride(state, change.rowId, change.columnKey)
    } else {
      applyOverride(state, change.rowId, change.columnKey, change.before)
    }
  }
  record.applied = apply
  record.revision = ++state.fillRevision
  return record
}

function applyCommitEdits(
  state: ServerDemoMutableState,
  request: ServerDemoCommitEditsRequest,
  shouldRejectCommittedRow: (rowId: string) => boolean,
): ServerDemoCommitEditsResult {
  const committedRows: Array<{ rowId: string | number }> = []
  const rejectedRows: Array<{ rowId: string | number; reason?: string }> = []
  const nextCommittedOverrides = new Map(state.committedOverrides)
  const nextPendingOverrides = new Map(state.pendingOverrides)
  for (const edit of request.edits) {
    const rowId = String(edit.rowId)
    const pending = state.pendingOverrides.get(rowId) ?? {}
    if (shouldRejectCommittedRow(rowId)) {
      nextPendingOverrides.delete(rowId)
      nextCommittedOverrides.delete(rowId)
      rejectedRows.push({
        rowId: edit.rowId,
        reason: "simulated failure",
      })
      continue
    }
    const committed = state.committedOverrides.get(rowId) ?? {}
    const nextData = { ...pending, ...edit.data }
    if ("value" in nextData) {
      const numericValue = Number(nextData.value)
      if (Number.isFinite(numericValue)) {
        nextData.value = numericValue
      }
    }
    nextPendingOverrides.delete(rowId)
    nextCommittedOverrides.set(rowId, {
      ...committed,
      ...nextData,
    })
    committedRows.push({ rowId: edit.rowId })
  }
  state.committedOverrides = nextCommittedOverrides
  state.pendingOverrides = nextPendingOverrides
  if (rejectedRows.length > 0) {
    return {
      committed: committedRows,
      rejected: rejectedRows,
    }
  }
  return {
    committed: committedRows,
  }
}

function createSampleDiagnostics(): ServerDemoSampleDiagnostics {
  return createEmptySampleDiagnostics()
}

function createFillDiagnostics(): ServerDemoFillDiagnostics {
  return createEmptyFillDiagnostics()
}

function createCommitDiagnostics(): ServerDemoCommitDiagnostics {
  return {
    commitMode: "ok",
    commitMessage: "none",
    commitDetails: "none",
    clientBatchApplied: "no",
    clientBatchWarning: "none",
    lastBatchRows: "0",
    lastSkippedRows: "0",
  }
}

export function createFakeServerDatasource(hooks: ServerDemoDatasourceHooks = {}) {
  const state = createServerDemoMutableState()
  const listeners = new Set<ServerDemoPushListener>()
  const fillDiagnostics = createFillDiagnostics()
  const sampleDiagnostics = createSampleDiagnostics()
  const commitDiagnostics = createCommitDiagnostics()
  const pullDiagnostics: ServerDemoPullDiagnostics = {
    pendingRequests: 0,
    loading: true,
    error: null,
    lastViewportRange: { start: 0, end: 0 },
    totalRows: 0,
    loadedRows: 0,
  }
  const aggregationDiagnostics: ServerDemoAggregationDiagnostics = {
    lastAggregationRequest: "none",
    aggregateResponseRows: "0",
    aggregatePreviewRows: "none",
  }

  function emitPullDiagnostics(): void {
    hooks.onPullDiagnostics?.({ ...pullDiagnostics })
  }

  function emitAggregationDiagnostics(): void {
    hooks.onAggregationDiagnostics?.({ ...aggregationDiagnostics })
  }

  function emitFillDiagnostics(next: Partial<ServerDemoFillDiagnostics>): void {
    Object.assign(fillDiagnostics, next)
    hooks.onFillDiagnostics?.({ ...fillDiagnostics })
  }

  function emitSampleDiagnostics(next: Partial<ServerDemoSampleDiagnostics>): void {
    Object.assign(sampleDiagnostics, next)
    hooks.onSampleDiagnostics?.({ ...sampleDiagnostics })
  }

  function emitCommitDiagnostics(next: Partial<ServerDemoCommitDiagnostics>): void {
    Object.assign(commitDiagnostics, next)
    hooks.onCommitDiagnostics?.({ ...commitDiagnostics })
  }

  const dataSource: ServerDemoDataSource = {
    async pull(request: ServerDemoPullRequest): Promise<ServerDemoPullResult> {
      pullDiagnostics.pendingRequests += 1
      pullDiagnostics.loading = true
      pullDiagnostics.error = null
      pullDiagnostics.lastViewportRange = request.range
      emitPullDiagnostics()
      try {
        await wait(SERVER_DEMO_LATENCY_MS, request.signal)
        if (hooks.shouldSimulatePullFailure?.() === true) {
          throw new Error("Simulated backend failure")
        }
        const filteredRows = buildFilteredRows(state, request.filterModel)
        const sortedRows = request.sortModel.length > 0
          ? [...filteredRows].sort((left, right) => compareBySortModel(left, right, request.sortModel))
          : filteredRows
        const start = Math.max(0, Math.trunc(request.range.start))
        const end = Math.max(start, Math.trunc(request.range.end))
        const limit = Math.max(1, Math.min(SERVER_DEMO_PAGE_SIZE, end - start + 1))
        const aggregationModel = request.pivot?.aggregationModel ?? null
        const aggregationColumns = aggregationModel?.columns ?? []
        const aggregatedByRegion = aggregationColumns.length > 0
        aggregationDiagnostics.lastAggregationRequest = aggregatedByRegion
          ? `${aggregationModel?.basis ?? "filtered"}:${aggregationColumns.map(column => `${column.key}:${column.op}`).join(",")}`
          : "none"
        const groupedByRegion = request.groupBy?.fields.includes("region") === true
        const projectedRows = aggregatedByRegion
          ? buildRegionAggregateRows(sortedRows)
          : groupedByRegion
            ? buildRegionGroupedRows(sortedRows, request.groupExpansion)
            : sortedRows.map((row, index) => ({
                index,
                row,
                rowId: row.id,
                kind: "leaf" as const,
              }))
        if (aggregatedByRegion) {
          aggregationDiagnostics.aggregateResponseRows = String(projectedRows.length)
          aggregationDiagnostics.aggregatePreviewRows = projectedRows
            .slice(0, 4)
            .map(entry => {
              const row = entry.row
              return `${String(entry.rowId)} count=${row.status.replace(/^Count /, "")} sum=${row.value}`
            })
            .join("; ") || "none"
        } else {
          aggregationDiagnostics.aggregateResponseRows = "0"
          aggregationDiagnostics.aggregatePreviewRows = "none"
        }
        emitAggregationDiagnostics()
        const rows = projectedRows.slice(start, start + limit)
        const sampleRowIndex = Number(String(sampleDiagnostics.sampleRow).replace(/^srv-0*/, ""))
        const sampleRow = Number.isFinite(sampleRowIndex)
          ? rows.find(entry => entry.index === sampleRowIndex)
          : null
        if (sampleRow) {
          const sampleColumnKey = sampleDiagnostics.sampleColumn !== "none" ? sampleDiagnostics.sampleColumn : "value"
          emitSampleDiagnostics({
            samplePullAfter: String(resolveColumnValue(sampleRow.row, sampleColumnKey)),
          })
          hooks.scheduleRenderedSampleDiagnostics?.()
        }
        pullDiagnostics.totalRows = projectedRows.length
        pullDiagnostics.loadedRows = Math.min(projectedRows.length, Math.max(pullDiagnostics.loadedRows, end + 1))
        emitPullDiagnostics()
        return {
          rows,
          total: projectedRows.length,
        }
      } catch (caught) {
        const candidate = caught as Error
        if (candidate?.name === "AbortError") {
          throw caught
        }
        pullDiagnostics.error = candidate instanceof Error ? candidate : new Error(String(caught))
        emitPullDiagnostics()
        throw pullDiagnostics.error
      } finally {
        pullDiagnostics.pendingRequests = Math.max(0, pullDiagnostics.pendingRequests - 1)
        pullDiagnostics.loading = pullDiagnostics.pendingRequests > 0
        emitPullDiagnostics()
      }
    },
    subscribe(listener) {
      listeners.add(listener as never)
      return () => {
        listeners.delete(listener as never)
      }
    },
    invalidate(invalidation) {
      if (invalidation.reason === "model-range" || invalidation.reason === "model-all") {
        return
      }
      for (const listener of listeners) {
        listener({ type: "invalidate", invalidation } as never)
      }
    },
    async getColumnHistogram(request: ServerDemoHistogramRequest): Promise<DataGridColumnHistogram> {
      return buildColumnHistogram(state, request)
    },
    async resolveFillBoundary(request) {
      const result = resolveFillBoundary(state, request)
      hooks.captureFillBoundary?.(result)
      hooks.captureFillBoundarySide?.(request.direction === "left" ? "left" : "right", result)
      return result
    },
    async commitEdits(request: ServerDemoCommitEditsRequest) {
      const result = applyCommitEdits(state, request, rowId => hooks.shouldRejectCommittedRow?.(rowId) === true)
      const committedRows = result.committed ?? []
      const rejectedRows = result.rejected ?? []
      const rejectedCount = rejectedRows.length
      const committedCount = committedRows.length
      commitDiagnostics.commitMode = rejectedCount > 0 ? "failed" : "ok"
      commitDiagnostics.commitMessage = rejectedCount > 0
        ? `partial rejection: ${rejectedCount} row${rejectedCount === 1 ? "" : "s"}`
        : "committed"
      commitDiagnostics.commitDetails = committedRows.length > 0
        ? committedRows.map((entry: { rowId: string | number }) => String(entry.rowId)).join(", ")
        : "none"
      commitDiagnostics.clientBatchApplied = committedCount > 0 ? "yes" : "no"
      commitDiagnostics.clientBatchWarning = rejectedCount > 0
        ? rejectedRows.map((entry: { reason?: string }) => String(entry.reason ?? "rejected")).join("; ")
        : "none"
      commitDiagnostics.lastBatchRows = String(committedCount)
      commitDiagnostics.lastSkippedRows = String(Math.max(0, request.edits.length - committedCount))
      emitCommitDiagnostics({})
      return result
    },
    async commitFillOperation(request: ServerDemoFillOperationRequest) {
      try {
        const record = applyFillOperation(state, request)
        state.fillOperations.set(record.operationId, record)
        emitFillDiagnostics({
          fillWarning: "none",
          fillBlocked: "no",
          fillApplied: "yes",
          commitFillOperationCalled: "yes",
          operationId: record.operationId,
          affectedRows: String(record.changes.filter(change => change.before !== change.after).length),
          affectedRange: `normalized=${formatViewportRange(record.targetRange)}`,
          visibleOverlap: "unknown",
          request: `source=${JSON.stringify(record.sourceRange)} target=${JSON.stringify(record.targetRange)}`,
          mode: record.mode,
          fillColumns: String(request.fillColumns.join(", ")),
          referenceColumns: String(request.referenceColumns.join(", ")),
          dispatchAttempted: "yes",
          renderedViewport: fillDiagnostics.renderedViewport,
          rawInvalidation: fillDiagnostics.rawInvalidation,
          invalidationRange: fillDiagnostics.invalidationRange,
          normalizedInvalidation: fillDiagnostics.normalizedInvalidation,
          invalidationApplied: "yes",
          runtimeRowModelInvalidateType: fillDiagnostics.runtimeRowModelInvalidateType,
          invalidateCalled: "yes",
          cacheRow1BeforeInvalidation: fillDiagnostics.cacheRow1BeforeInvalidation,
          cacheRow1AfterInvalidation: fillDiagnostics.cacheRow1AfterInvalidation,
          syncInputRange: fillDiagnostics.syncInputRange,
          latestRenderedViewport: fillDiagnostics.latestRenderedViewport,
          runtimeRenderedViewport: fillDiagnostics.runtimeRenderedViewport,
          displayRowsRenderedViewport: fillDiagnostics.displayRowsRenderedViewport,
          selectedRenderedViewport: fillDiagnostics.selectedRenderedViewport,
          refreshUsedStoredRendered: fillDiagnostics.refreshUsedStoredRendered,
        })
        hooks.reportFillPlumbingState?.("commitFillOperation_called", true)
        hooks.reportFillPlumbingState?.("server_fill_operationId", true)
        hooks.reportFillPlumbingState?.("server_fill_affectedRowCount", true)
        hooks.onHistoryAction?.("server-commit")
        return {
          operationId: record.operationId,
          revision: record.revision,
          affectedRowCount: record.changes.filter(change => change.before !== change.after).length,
          affectedCellCount: record.changes.filter(change => change.before !== change.after).length,
          invalidation: { kind: "range", range: record.targetRange, reason: "server-fill" },
          undoToken: record.operationId,
          redoToken: record.operationId,
          warnings: [],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        emitFillDiagnostics({
          fillWarning: `server fill rejected: ${message}`,
          fillBlocked: "yes",
          fillApplied: "no",
          commitFillOperationCalled: "yes",
          operationId: request.operationId ?? "none",
          affectedRows: "0",
          affectedRange: "none",
          visibleOverlap: "unknown",
          request: `source=${JSON.stringify(request.sourceRange)} target=${JSON.stringify(request.targetRange)}`,
          mode: request.mode,
          fillColumns: request.fillColumns.join(", "),
          referenceColumns: request.referenceColumns.join(", "),
          dispatchAttempted: "yes",
          renderedViewport: fillDiagnostics.renderedViewport,
          rawInvalidation: fillDiagnostics.rawInvalidation,
          invalidationRange: fillDiagnostics.invalidationRange,
          normalizedInvalidation: fillDiagnostics.normalizedInvalidation,
          invalidationApplied: "no",
          runtimeRowModelInvalidateType: fillDiagnostics.runtimeRowModelInvalidateType,
          invalidateCalled: "no",
          cacheRow1BeforeInvalidation: fillDiagnostics.cacheRow1BeforeInvalidation,
          cacheRow1AfterInvalidation: fillDiagnostics.cacheRow1AfterInvalidation,
          syncInputRange: fillDiagnostics.syncInputRange,
          latestRenderedViewport: fillDiagnostics.latestRenderedViewport,
          runtimeRenderedViewport: fillDiagnostics.runtimeRenderedViewport,
          displayRowsRenderedViewport: fillDiagnostics.displayRowsRenderedViewport,
          selectedRenderedViewport: fillDiagnostics.selectedRenderedViewport,
          refreshUsedStoredRendered: fillDiagnostics.refreshUsedStoredRendered,
        })
        hooks.reportFillPlumbingState?.("commitFillOperation_called", true)
        hooks.reportFillPlumbingState?.("server_fill_operationId", true)
        return {
          operationId: request.operationId ?? `fill-${++state.fillRevision}`,
          revision: state.fillRevision,
          affectedRowCount: 0,
          affectedCellCount: 0,
          invalidation: null,
          warnings: [message],
        }
      }
    },
    async undoFillOperation(request: ServerDemoUndoFillRequest) {
      const record = toggleFillOperation(state, request.operationId, false)
      if (!record) {
        return { operationId: request.operationId, revision: state.fillRevision, warnings: ["missing-operation"] }
      }
      hooks.onHistoryAction?.("server-undo")
      return {
        operationId: record.operationId,
        revision: record.revision,
        invalidation: { kind: "range", range: record.targetRange, reason: "server-fill-undo" },
        warnings: [],
      }
    },
    async redoFillOperation(request: ServerDemoUndoFillRequest) {
      const record = toggleFillOperation(state, request.operationId, true)
      if (!record) {
        return { operationId: request.operationId, revision: state.fillRevision, warnings: ["missing-operation"] }
      }
      hooks.onHistoryAction?.("server-redo")
      return {
        operationId: record.operationId,
        revision: record.revision,
        invalidation: { kind: "range", range: record.targetRange, reason: "server-fill-redo" },
        warnings: [],
      }
    },
  }

  return {
    dataSource,
    state,
    getEditedRowCount(): number {
      return state.committedOverrides.size
    },
    getFillOperationCount(): number {
      return state.fillOperations.size
    },
  }
}
