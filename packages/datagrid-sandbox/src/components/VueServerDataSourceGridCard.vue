<template>
  <article class="card affino-datagrid-app-root sandbox-server-data-source-grid">
    <header class="card__header">
      <div class="card__title-row">
        <div>
          <h2>{{ title }}</h2>
          <p class="server-grid__subtitle">
            100k deterministic rows pulled through a server-style data source with async range loading.
          </p>
        </div>
        <div class="mode-badge">Data Source</div>
      </div>
      <div class="server-grid__toolbar">
        <button type="button" class="server-grid__button" @click="refreshVisibleRange">Refresh visible range</button>
        <button type="button" class="server-grid__button" :disabled="!canUndoHistory" @click="runHistoryAction('undo')">Undo</button>
        <button type="button" class="server-grid__button" :disabled="!canRedoHistory" @click="runHistoryAction('redo')">Redo</button>
        <button type="button" class="server-grid__button" @click="simulateErrorOnce">Simulate one error</button>
        <button type="button" class="server-grid__button" @click="simulateCommitFailure">Simulate commit failure</button>
      </div>
      <div class="server-grid__meta">
        <span>Rows: {{ totalRowsLabel }}</span>
        <span>Viewport: {{ viewportLabel }}</span>
        <span>Loaded: {{ loadedRowsLabel }}</span>
        <span>Pending: {{ pendingRequestsLabel }}</span>
        <span>Last batch rows: {{ lastBatchRowsLabel }}</span>
        <span>Skipped rows: {{ lastSkippedRowsLabel }}</span>
        <span>Fill warning: {{ fillWarningLabel }}</span>
        <span>Fill boundary: {{ fillBoundaryLabel }}</span>
        <span>Left: {{ fillBoundaryLeftLabel }}</span>
        <span>Right: {{ fillBoundaryRightLabel }}</span>
        <span>Fill blocked: {{ fillBlockedLabel }}</span>
        <span>Fill applied: {{ fillAppliedLabel }}</span>
        <span>Plumbing: {{ plumbingLabel }}</span>
        <span>Branch: {{ branchLabel }}</span>
        <span>Sort: {{ sortModelLabel }}</span>
        <span>Filter: {{ filterModelLabel }}</span>
      </div>
    </header>

    <section class="server-grid__surface">
      <DataGrid
        ref="gridRef"
        :key="gridKey"
        :columns="columns"
        :row-model="rowModel"
        :is-cell-editable="isCellEditable"
        theme="industrial-neutral"
        virtualization
        :show-row-index="true"
        :row-selection="false"
        :column-menu="columnMenu"
        advanced-filter
        fill-handle
        range-move
      :history="true"
      layout-mode="auto-height"
      :min-rows="8"
      :max-rows="16"
      :report-fill-warning="handleFillWarning"
      :report-fill-plumbing-state="reportFillPlumbingState"
      @update:state="handleStateUpdate"
      @cell-edit="handleCellEdit"
    />
    </section>

    <aside class="server-grid__diagnostics">
  <h3>Loading diagnostics</h3>
      <dl class="server-grid__diagnostics-list">
        <div class="server-grid__diagnostics-card">
          <dt>Status</dt>
          <dd>{{ loadingLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Error</dt>
          <dd>{{ errorLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Loaded rows</dt>
          <dd>{{ loadedRowsLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Edited rows</dt>
          <dd>{{ editedRowsLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Last edit</dt>
          <dd>{{ lastEditLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Can undo</dt>
          <dd>{{ canUndoLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Can redo</dt>
          <dd>{{ canRedoLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>History action</dt>
          <dd>{{ lastHistoryActionLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Edit history</dt>
          <dd>{{ lastEditRecordedLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Cached rows</dt>
          <dd>{{ rowCacheLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Commit mode</dt>
          <dd>{{ commitModeLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Commit msg</dt>
          <dd>{{ commitMessageLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Commit detail</dt>
          <dd>{{ commitDetailsLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Last batch rows</dt>
          <dd>{{ lastBatchRowsLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Skipped rows</dt>
          <dd>{{ lastSkippedRowsLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Fill warning</dt>
          <dd>{{ fillWarningLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Fill boundary</dt>
          <dd>{{ fillBoundaryLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Boundary L</dt>
          <dd>{{ fillBoundaryLeftLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Boundary R</dt>
          <dd>{{ fillBoundaryRightLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Fill blocked</dt>
          <dd>{{ fillBlockedLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Fill applied</dt>
          <dd>{{ fillAppliedLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Plumbing</dt>
          <dd>{{ plumbingLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Branch</dt>
          <dd>{{ branchLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>In flight</dt>
          <dd>{{ diagnostics.inFlight ? "yes" : "no" }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Prefetch</dt>
          <dd>{{ diagnostics.prefetchStarted }} started / {{ diagnostics.prefetchCompleted }} completed</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Sort</dt>
          <dd>{{ sortModelLabel }}</dd>
        </div>
        <div class="server-grid__diagnostics-card">
          <dt>Filter</dt>
          <dd>{{ filterModelLabel }}</dd>
        </div>
      </dl>
    </aside>
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import {
  buildDataGridAdvancedFilterExpressionFromLegacyFilters,
  createDataSourceBackedRowModel,
  evaluateColumnPredicateFilter,
  evaluateDataGridAdvancedFilterExpression,
  serializeColumnValueToToken,
  type DataGridColumnHistogram,
  type DataGridColumnHistogramEntry,
  type DataGridDataSource,
  type DataGridDataSourceInvalidation,
  type DataGridDataSourcePullRequest,
  type DataGridDataSourcePullResult,
  type DataGridDataSourcePushListener,
  type DataGridFilterSnapshot,
  type DataGridSortState,
} from "@affino/datagrid-vue"
import { type DataGridAppColumnInput } from "@affino/datagrid-vue-app"
import { DataGrid } from "@affino/datagrid-vue-app"

interface ServerDemoRow {
  id: string
  index: number
  name: string
  segment: string
  status: string
  region: string
  value: number
  updatedAt: string
}

const ROW_COUNT = 100_000
const PAGE_SIZE = 300
const LATENCY_MS = 140

const props = defineProps<{
  title: string
}>()

const gridKey = ref(0)
const gridRef = ref<{
  history: {
    canUndo: () => boolean
    canRedo: () => boolean
    runHistoryAction: (direction: "undo" | "redo") => Promise<string | null>
  }
} | null>(null)
const failureMode = ref(false)
const commitFailureMode = ref(false)
const lastViewportRange = ref<{ start: number; end: number }>({ start: 0, end: 0 })
const committedOverrides = ref(new Map<string, Partial<ServerDemoRow>>())
const pendingOverrides = ref(new Map<string, Partial<ServerDemoRow>>())
const totalRows = ref(0)
const loadedRows = ref(0)
const pendingRequests = ref(0)
const loading = ref(true)
const error = ref<Error | null>(null)
const sortModelText = ref("none")
const filterModelText = ref("none")
const commitModeText = ref("ok")
const commitMessageText = ref("none")
const commitDetailsText = ref("none")
const lastEditText = ref("none")
const lastHistoryActionText = ref("none")
const lastEditRecordedText = ref("unknown")
const lastBatchRowsText = ref("0")
const lastSkippedRowsText = ref("0")
const fillWarningText = ref("none")
const fillBoundaryText = ref("none")
const fillBoundaryLeftText = ref("none")
const fillBoundaryRightText = ref("none")
const fillBlockedText = ref("no")
const fillAppliedText = ref("no")
const plumbingState = ref<Record<string, boolean>>({})
const branchState = ref("none")
const lastSelectionRange = ref<{ startRow: number; endRow: number } | null>(null)

const segments = ["Core", "Growth", "Enterprise", "SMB"] as const
const statuses = ["Active", "Paused", "Closed"] as const
const regions = ["AMER", "EMEA", "APAC", "LATAM"] as const
const columnMenu = {
  enabled: true,
  valueFilterEnabled: true,
  valueFilterRowLimit: ROW_COUNT,
  maxFilterValues: 250,
} as const

type ServerDemoHistogramRequest = Parameters<NonNullable<DataGridDataSource<ServerDemoRow>["getColumnHistogram"]>>[0]
type ServerDemoCommitEditsRequest = Parameters<NonNullable<DataGridDataSource<ServerDemoRow>["commitEdits"]>>[0]

function resolveRowId(index: number): string {
  return `srv-${index.toString().padStart(6, "0")}`
}

function captureFillBoundary(result: {
  endRowIndex: number | null
  boundaryKind: string
  scannedRowCount?: number
  truncated?: boolean
} | null): void {
  fillBoundaryText.value = result
    ? `${result.boundaryKind} @ ${result.endRowIndex ?? "null"} (${result.scannedRowCount ?? 0} scanned${result.truncated ? ", truncated" : ""})`
    : "none"
}

function captureFillBoundarySide(side: "left" | "right", result: {
  endRowIndex: number | null
  endRowId?: string | number | null
  boundaryKind: string
  scannedRowCount?: number
  truncated?: boolean
} | null): void {
  const text = result
    ? `end=${result.endRowIndex ?? "null"} id=${result.endRowId ?? "null"} kind=${result.boundaryKind} scanned=${result.scannedRowCount ?? 0}${result.truncated ? " truncated" : ""}`
    : "null"
  if (side === "left") {
    fillBoundaryLeftText.value = text
  } else {
    fillBoundaryRightText.value = text
  }
}

function resolveBaseRow(index: number): ServerDemoRow {
  const segment = segments[index % segments.length]!
  const status = statuses[(index * 5) % statuses.length]!
  const region = regions[(index * 7) % regions.length]!
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
    updatedAt: `2026-04-30T12:${minute}:00.000Z`,
  }
}

function createRow(index: number): ServerDemoRow {
  const baseRow = resolveBaseRow(index)
  const committed = committedOverrides.value.get(baseRow.id)
  const pending = pendingOverrides.value.get(baseRow.id)
  return committed || pending ? { ...baseRow, ...committed, ...pending } : baseRow
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

function buildFilteredRows(filterModel: DataGridFilterSnapshot | null): readonly ServerDemoRow[] {
  const rows = Array.from({ length: ROW_COUNT }, (_unused, index) => createRow(index))
  if (!filterModel) {
    return rows
  }
  return rows.filter(row => matchesFilterModel(row, filterModel))
}

function buildProjectedRows(
  sortModel: readonly DataGridSortState[],
  filterModel: DataGridFilterSnapshot | null,
): readonly ServerDemoRow[] {
  const filteredRows = buildFilteredRows(filterModel)
  if (sortModel.length === 0) {
    return filteredRows
  }
  return [...filteredRows].sort((left, right) => compareBySortModel(left, right, sortModel))
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

function buildColumnHistogram(
  request: ServerDemoHistogramRequest,
): DataGridColumnHistogram {
  const rows = buildFilteredRows(
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

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      window.clearTimeout(timeout)
      reject(new DOMException("Aborted", "AbortError"))
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

const listeners = new Set<DataGridDataSourcePushListener<ServerDemoRow>>()

const dataSource: DataGridDataSource<ServerDemoRow> = {
  async pull(request: DataGridDataSourcePullRequest): Promise<DataGridDataSourcePullResult<ServerDemoRow>> {
    pendingRequests.value += 1
    loading.value = true
    error.value = null
    lastViewportRange.value = request.range
    try {
      await wait(LATENCY_MS, request.signal)
      if (failureMode.value) {
        failureMode.value = false
        throw new Error("Simulated backend failure")
      }
      const filteredRows = buildFilteredRows(request.filterModel)
      const sortedRows = request.sortModel.length > 0
        ? [...filteredRows].sort((left, right) => compareBySortModel(left, right, request.sortModel))
        : filteredRows
      const start = Math.max(0, Math.trunc(request.range.start))
      const end = Math.max(start, Math.trunc(request.range.end))
      const limit = Math.max(1, Math.min(PAGE_SIZE, end - start + 1))
      const rows = sortedRows.slice(start, start + limit).map((row, offset) => ({
        index: start + offset,
        row,
        rowId: row.id,
      }))
      totalRows.value = filteredRows.length
      loadedRows.value = Math.min(filteredRows.length, Math.max(loadedRows.value, end + 1))
      return {
        rows,
        total: filteredRows.length,
      }
    } catch (caught) {
      const candidate = caught as Error
      if (candidate?.name === "AbortError") {
        throw caught
      }
      error.value = candidate instanceof Error ? candidate : new Error(String(caught))
      throw error.value
    } finally {
      pendingRequests.value = Math.max(0, pendingRequests.value - 1)
      loading.value = pendingRequests.value > 0
    }
  },
  subscribe(listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  invalidate(invalidation: DataGridDataSourceInvalidation) {
    for (const listener of listeners) {
      listener({ type: "invalidate", invalidation })
    }
  },
  async getColumnHistogram(request: ServerDemoHistogramRequest): Promise<DataGridColumnHistogram> {
    return buildColumnHistogram(request)
  },
  async resolveFillBoundary(request) {
    const projectedRows = buildProjectedRows(request.projection.sortModel, request.projection.filterModel)
    fillBlockedText.value = "no"
    const baseRange = request.baseRange as unknown as { start?: number; end?: number; startRow?: number; endRow?: number }
    const rawEndRow = baseRange.endRow ?? baseRange.end ?? 0
    const baseEndRow = Math.max(0, Math.trunc(rawEndRow))
    const startIndex = Math.max(0, Math.trunc(baseEndRow + 1))
    const limit = Number.isFinite(request.limit)
      ? Math.max(0, Math.trunc(request.limit ?? 0))
      : projectedRows.length
    if (startIndex >= projectedRows.length) {
      const result: {
        endRowIndex: number | null
        endRowId: string | null
        boundaryKind: "data-end" | "gap" | "cache-boundary" | "projection-end" | "unresolved"
        scannedRowCount: number
        truncated: boolean
      } = {
        endRowIndex: projectedRows.length > 0 ? projectedRows.length - 1 : null,
        endRowId: projectedRows[projectedRows.length - 1]?.id ?? null,
        boundaryKind: "data-end",
        scannedRowCount: 0,
        truncated: false,
      }
      captureFillBoundary(result)
      captureFillBoundarySide(request.direction === "left" ? "left" : "right", result)
      return result
    }
    let endRowIndex = baseEndRow
    let boundaryKind: "data-end" | "gap" | "cache-boundary" | "projection-end" | "unresolved" = "data-end"
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
    const result: {
      endRowIndex: number | null
      endRowId: string | null
      boundaryKind: "data-end" | "gap" | "cache-boundary" | "projection-end" | "unresolved"
      scannedRowCount: number
      truncated: boolean
    } = {
      endRowIndex: endRowIndex >= 0 ? endRowIndex : null,
      endRowId,
      boundaryKind,
      scannedRowCount: scanned,
      truncated: boundaryKind === "cache-boundary",
    }
    captureFillBoundary(result)
    captureFillBoundarySide(request.direction === "left" ? "left" : "right", result)
    return result
  },
  async commitEdits(request: ServerDemoCommitEditsRequest) {
    return applyCommitEdits(request)
  },
}

const rowModel = createDataSourceBackedRowModel<ServerDemoRow>({
  dataSource,
  initialTotal: ROW_COUNT,
  rowCacheLimit: 8_000,
  prefetch: {
    enabled: true,
    triggerViewportFactor: 0.8,
    windowViewportFactor: 3,
    minBatchSize: 150,
    maxBatchSize: 600,
    directionalBias: "scroll-direction",
  },
  resolveRowId: row => row.id,
})

const safeEditableColumns = new Set(["name", "segment", "status", "region", "value"])

const columns = [
  { key: "id", label: "Row ID", minWidth: 120, flex: 1, capabilities: { sortable: true } },
  { key: "name", label: "Account", minWidth: 180, flex: 1.2, capabilities: { sortable: true, editable: true } },
  { key: "segment", label: "Segment", minWidth: 120, flex: 0.9, capabilities: { sortable: true, editable: true } },
  { key: "status", label: "Status", minWidth: 120, flex: 0.8, capabilities: { sortable: true, editable: true } },
  { key: "region", label: "Region", minWidth: 100, flex: 0.8, capabilities: { sortable: true, editable: true } },
  { key: "value", label: "Value", minWidth: 110, flex: 0.8, capabilities: { sortable: true, editable: true } },
  { key: "updatedAt", label: "Updated", minWidth: 180, flex: 1.1, capabilities: { sortable: true } },
] satisfies readonly DataGridAppColumnInput<ServerDemoRow>[]

const diagnostics = ref(rowModel.getBackpressureDiagnostics())
const sortModelLabel = computed(() => {
  return sortModelText.value
})
const filterModelLabel = computed(() => {
  return filterModelText.value
})
const editedRowsLabel = computed(() => String(committedOverrides.value.size))
const lastEditLabel = computed(() => lastEditText.value)
const rowCacheLabel = computed(() => `${diagnostics.value.rowCacheSize} / ${diagnostics.value.rowCacheLimit}`)
const commitModeLabel = computed(() => commitModeText.value)
const commitMessageLabel = computed(() => commitMessageText.value)
const commitDetailsLabel = computed(() => commitDetailsText.value)
const lastBatchRowsLabel = computed(() => lastBatchRowsText.value)
const lastSkippedRowsLabel = computed(() => lastSkippedRowsText.value)
const fillWarningLabel = computed(() => fillWarningText.value)
const fillBoundaryLabel = computed(() => fillBoundaryText.value)
const fillBoundaryLeftLabel = computed(() => fillBoundaryLeftText.value)
const fillBoundaryRightLabel = computed(() => fillBoundaryRightText.value)
const fillBlockedLabel = computed(() => fillBlockedText.value)
const fillAppliedLabel = computed(() => fillAppliedText.value)
const plumbingLabel = computed(() => {
  const entries = Object.entries(plumbingState.value).map(([layer, present]) => `${layer}:${present ? "yes" : "no"}`)
  return entries.length > 0 ? entries.join(", ") : "none"
})
const branchLabel = computed(() => branchState.value)
const canUndoHistory = computed(() => gridRef.value?.history.canUndo() ?? false)
const canRedoHistory = computed(() => gridRef.value?.history.canRedo() ?? false)
const canUndoLabel = computed(() => gridRef.value?.history.canUndo() ? "yes" : "no")
const canRedoLabel = computed(() => gridRef.value?.history.canRedo() ? "yes" : "no")
const lastHistoryActionLabel = computed(() => lastHistoryActionText.value)
const lastEditRecordedLabel = computed(() => lastEditRecordedText.value)
const loadingLabel = computed(() => {
  if (error.value) return "error"
  if (pendingRequests.value > 0 || loading.value) return "loading"
  return "idle"
})
const errorLabel = computed(() => error.value?.message ?? "none")
const totalRowsLabel = computed(() => totalRows.value.toLocaleString())
const viewportLabel = computed(() => `${lastViewportRange.value.start}..${lastViewportRange.value.end}`)
const loadedRowsLabel = computed(() => loadedRows.value.toLocaleString())
const pendingRequestsLabel = computed(() => String(pendingRequests.value))

function refreshVisibleRange(): void {
  void rowModel.refresh("manual")
}

function handleStateUpdate(state: unknown): void {
  const parsedState = state as {
    rows?: { snapshot?: { sortModel?: readonly DataGridSortState[]; filterModel?: DataGridFilterSnapshot | null } }
    selection?: {
      ranges?: readonly { startRow: number; endRow: number }[]
      activeRangeIndex?: number
    } | null
  } | null
  const snapshot = parsedState?.rows?.snapshot
  const sortModel = snapshot?.sortModel ?? []
  const filterModel = snapshot?.filterModel ?? null
  const activeRange = parsedState?.selection?.ranges?.[parsedState.selection.activeRangeIndex ?? 0] ?? parsedState?.selection?.ranges?.[0] ?? null
  lastSelectionRange.value = activeRange ? {
    startRow: Math.min(activeRange.startRow, activeRange.endRow),
    endRow: Math.max(activeRange.startRow, activeRange.endRow),
  } : null
  filterModelText.value = filterModel
    ? [
        ...Object.keys(filterModel.columnFilters ?? {}),
        ...(filterModel.advancedExpression ? ["advanced"] : []),
        ...(Object.keys(filterModel.advancedFilters ?? {}).length > 0 ? ["legacy-advanced"] : []),
      ].join(", ") || "active"
    : "none"
  sortModelText.value = sortModel.length > 0
    ? sortModel.map(entry => `${entry.key}:${entry.direction}`).join(", ")
    : "none"
  diagnostics.value = rowModel.getBackpressureDiagnostics()
}

function updateFillDiagnostics(batchRowCount: number, warnings: string[]): void {
  fillAppliedText.value = batchRowCount > 0 ? "yes" : "no"
  lastBatchRowsText.value = String(batchRowCount)
  const expectedRows = lastSelectionRange.value
    ? Math.max(0, lastSelectionRange.value.endRow - lastSelectionRange.value.startRow + 1)
    : batchRowCount
  const skippedRows = Math.max(0, expectedRows - batchRowCount)
  lastSkippedRowsText.value = String(skippedRows)
  const derivedWarnings = [...warnings]
  if (skippedRows > 0 && loadedRows.value < totalRows.value) {
    derivedWarnings.push("likely stopped at cache boundary")
  }
  fillWarningText.value = derivedWarnings.length > 0 ? derivedWarnings.join("; ") : "none"
}

function handleFillWarning(message: string): void {
  fillWarningText.value = message
  fillBlockedText.value = "yes"
}

function reportFillPlumbingState(layer: string, present: boolean): void {
  plumbingState.value = {
    ...plumbingState.value,
    [layer]: present,
  }
  if (layer === "double_click_handler" && present) {
    branchState.value = "double-click"
  } else if (layer === "double_click_resolved_server_branch" && present) {
    branchState.value = "server-resolved"
  } else if (layer === "double_click_blocked_large" && present) {
    branchState.value = "server-blocked-large"
  } else if (layer === "double_click_blocked_unloaded" && present) {
    branchState.value = "server-blocked-unloaded"
  } else if (layer === "double_click_batch_commit_path" && present) {
    branchState.value = "batch-commit"
  }
}

function isCellEditable(ctx: { rowId: string | number; columnKey: string }): boolean {
  return safeEditableColumns.has(ctx.columnKey) && ctx.rowId != null
}

function handleCellEdit(payload: {
  rowId: string | number
  columnKey: string
  oldValue: unknown
  newValue: unknown
  patch: {
    rowId: string | number
    data: Partial<ServerDemoRow>
  }
}): void {
  lastEditText.value = `${payload.columnKey} ${String(payload.oldValue ?? "")} → ${String(payload.newValue ?? "")}`
  updateFillDiagnostics(1, [])
  lastEditRecordedText.value = "pending"
  void Promise.resolve().then(() => {
    lastEditRecordedText.value = gridRef.value?.history.canUndo() ? "yes" : "no"
  })
}

async function runHistoryAction(direction: "undo" | "redo"): Promise<void> {
  const result = await gridRef.value?.history.runHistoryAction(direction) ?? null
  lastHistoryActionText.value = result ?? `${direction}:none`
  lastEditRecordedText.value = gridRef.value?.history.canUndo() ? "yes" : "no"
}

function shouldRejectCommittedRow(rowId: string | number): boolean {
  if (!commitFailureMode.value) {
    return false
  }
  const numeric = Number(String(rowId).replace(/^srv-/, ""))
  return Number.isFinite(numeric) && numeric % 2 === 0
}

function applyCommitEdits(request: ServerDemoCommitEditsRequest): Promise<{
  committed?: readonly { rowId: string | number }[]
  rejected?: readonly { rowId: string | number; reason?: string }[]
}> {
  try {
    const committedRows: Array<{ rowId: string | number }> = []
    const rejectedRows: Array<{ rowId: string | number; reason?: string }> = []
    const nextCommittedOverrides = new Map(committedOverrides.value)
    const nextPendingOverrides = new Map(pendingOverrides.value)
    for (const edit of request.edits) {
      const rowId = String(edit.rowId)
      const pending = pendingOverrides.value.get(rowId) ?? {}
      if (shouldRejectCommittedRow(rowId)) {
        nextPendingOverrides.delete(rowId)
        nextCommittedOverrides.delete(rowId)
        rejectedRows.push({
          rowId: edit.rowId,
          reason: "simulated failure",
        })
        continue
      }
      const committed = committedOverrides.value.get(rowId) ?? {}
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
    committedOverrides.value = nextCommittedOverrides
    pendingOverrides.value = nextPendingOverrides
    if (rejectedRows.length > 0) {
      commitModeText.value = "failed"
      commitMessageText.value = `partial rejection: ${rejectedRows.length} row${rejectedRows.length === 1 ? "" : "s"}`
      commitDetailsText.value = rejectedRows.map(entry => String(entry.rowId)).join(", ")
      updateFillDiagnostics(committedRows.length, [
        "partial rejection suppressed refresh",
        committedRows.length > 1 ? "batch commit path used" : "single-row commit path used",
      ])
      diagnostics.value = rowModel.getBackpressureDiagnostics()
      void rowModel.refresh("manual")
      commitFailureMode.value = false
      return Promise.resolve({
        committed: committedRows,
        rejected: rejectedRows,
      })
    }
    commitModeText.value = "ok"
    commitMessageText.value = "committed"
    commitDetailsText.value = committedRows.length > 0
      ? committedRows.map(entry => String(entry.rowId)).join(", ")
      : "none"
    updateFillDiagnostics(committedRows.length, committedRows.length > 1
      ? ["batch commit path used"]
      : [])
    diagnostics.value = rowModel.getBackpressureDiagnostics()
    return Promise.resolve({
      committed: committedRows,
    })
  } catch (caught) {
    commitModeText.value = "failed"
    commitMessageText.value = `error: ${caught instanceof Error ? caught.message : String(caught)}`
    commitDetailsText.value = "rollback"
    for (const edit of request.edits) {
      const rowId = String(edit.rowId)
      const nextPending = new Map(pendingOverrides.value)
      nextPending.delete(rowId)
      pendingOverrides.value = nextPending
      const nextCommitted = new Map(committedOverrides.value)
      nextCommitted.delete(rowId)
      committedOverrides.value = nextCommitted
    }
    diagnostics.value = rowModel.getBackpressureDiagnostics()
    void rowModel.refresh("manual")
    updateFillDiagnostics(0, ["commit failed", "refresh suppressed until rollback recovery"])
    return Promise.resolve({
      rejected: request.edits.map((edit) => ({
        rowId: edit.rowId,
        reason: caught instanceof Error ? caught.message : String(caught),
      })),
    })
  }
}

function simulateErrorOnce(): void {
  failureMode.value = true
  void Promise.resolve(rowModel.refresh("manual")).catch(() => {})
}

function simulateCommitFailure(): void {
  commitFailureMode.value = true
}

onMounted(() => {
  totalRows.value = ROW_COUNT
  handleStateUpdate(rowModel.getSnapshot())
  void rowModel.refresh("mount")
  lastEditRecordedText.value = "no"
})

onBeforeUnmount(() => {
  rowModel.dispose()
})
</script>

<style scoped>
.server-grid__surface {
  margin-top: 0.75rem;
}

.server-grid__diagnostics {
  margin-top: 1rem;
  padding: 0.9rem 1rem 1rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(35, 42, 48, 0.12);
  min-width: 0;
  max-height: min(42rem, 55vh);
  overflow: auto;
}

.server-grid__diagnostics h3 {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
}

.server-grid__diagnostics-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 0.75rem;
  margin: 0;
  min-width: 0;
  align-items: start;
}

.server-grid__diagnostics-card {
  display: grid;
  grid-template-columns: minmax(4.5rem, 6.5rem) minmax(0, 1fr);
  gap: 0.75rem;
  align-items: start;
  min-width: 0;
  padding: 0.65rem 0.75rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.48);
  border: 1px solid rgba(35, 42, 48, 0.08);
  overflow: hidden;
}

.server-grid__diagnostics-card dt,
.server-grid__diagnostics-card dd {
  margin: 0;
  line-height: 1.35;
}

.server-grid__diagnostics-card dt {
  font-weight: 600;
  color: rgba(35, 42, 48, 0.72);
}

.server-grid__diagnostics-card dd {
  color: rgba(35, 42, 48, 0.98);
  word-break: break-word;
  min-width: 0;
}
</style>
