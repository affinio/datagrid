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
        <button type="button" class="server-grid__button" @click="simulateErrorOnce">Simulate one error</button>
      </div>
      <div class="server-grid__meta">
        <span>Rows: {{ totalRowsLabel }}</span>
        <span>Viewport: {{ viewportLabel }}</span>
        <span>Loaded: {{ loadedRowsLabel }}</span>
        <span>Pending: {{ pendingRequestsLabel }}</span>
        <span>Sort: {{ sortModelLabel }}</span>
      </div>
    </header>

    <section class="server-grid__surface">
      <DataGrid
        :key="gridKey"
        :columns="columns"
        :row-model="rowModel"
        theme="industrial-neutral"
        virtualization
        :show-row-index="true"
        :row-selection="false"
        layout-mode="auto-height"
        :min-rows="8"
        :max-rows="16"
        @update:state="handleStateUpdate"
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
          <dt>Cached rows</dt>
          <dd>{{ rowCacheLabel }}</dd>
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
      </dl>
    </aside>
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { createDataSourceBackedRowModel, type DataGridDataSource, type DataGridDataSourcePullRequest, type DataGridDataSourcePullResult, type DataGridDataSourcePushListener, type DataGridDataSourceInvalidation, type DataGridSortState } from "@affino/datagrid-vue"
import { type DataGridAppColumnInput } from "@affino/datagrid-vue-app"
import { DataGrid } from "@affino/datagrid-vue-app"

interface ServerDemoRow {
  id: string
  index: number
  name: string
  segment: string
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
const failureMode = ref(false)
const lastViewportRange = ref<{ start: number; end: number }>({ start: 0, end: 0 })
const totalRows = ref(0)
const loadedRows = ref(0)
const pendingRequests = ref(0)
const loading = ref(true)
const error = ref<Error | null>(null)
const sortModelText = ref("none")

const segments = ["Core", "Growth", "Enterprise", "SMB"] as const
const regions = ["AMER", "EMEA", "APAC", "LATAM"] as const

function createRow(index: number): ServerDemoRow {
  const segment = segments[index % segments.length]!
  const region = regions[(index * 7) % regions.length]!
  const value = (index * 97) % 100_000
  const minute = String(index % 60).padStart(2, "0")
  return {
    id: `srv-${index.toString().padStart(6, "0")}`,
    index,
    name: `Account ${index.toString().padStart(5, "0")}`,
    segment,
    region,
    value,
    updatedAt: `2026-04-30T12:${minute}:00.000Z`,
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

function buildSortedRows(sortModel: readonly DataGridSortState[]): readonly ServerDemoRow[] {
  const rows = Array.from({ length: ROW_COUNT }, (_unused, index) => createRow(index))
  if (sortModel.length === 0) {
    return rows
  }
  // Demo-only: full-table sort is acceptable at 100k rows here, but a real service
  // should replace this with indexed or backend-native sorting.
  return rows.sort((left, right) => compareBySortModel(left, right, sortModel))
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
      const sortedRows = buildSortedRows(request.sortModel)
      const start = Math.max(0, Math.trunc(request.range.start))
      const end = Math.max(start, Math.trunc(request.range.end))
      const limit = Math.max(1, Math.min(PAGE_SIZE, end - start + 1))
      const rows = sortedRows.slice(start, start + limit).map((row, offset) => ({
        index: start + offset,
        row,
        rowId: row.id,
      }))
      totalRows.value = ROW_COUNT
      loadedRows.value = Math.min(ROW_COUNT, Math.max(loadedRows.value, end + 1))
      return {
        rows,
        total: ROW_COUNT,
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

const columns = [
  { key: "id", label: "Row ID", minWidth: 120, flex: 1, capabilities: { sortable: true } },
  { key: "name", label: "Account", minWidth: 180, flex: 1.2, capabilities: { sortable: true } },
  { key: "segment", label: "Segment", minWidth: 120, flex: 0.9, capabilities: { sortable: true } },
  { key: "region", label: "Region", minWidth: 100, flex: 0.8, capabilities: { sortable: true } },
  { key: "value", label: "Value", minWidth: 110, flex: 0.8, capabilities: { sortable: true } },
  { key: "updatedAt", label: "Updated", minWidth: 180, flex: 1.1, capabilities: { sortable: true } },
] satisfies readonly DataGridAppColumnInput<ServerDemoRow>[]

const diagnostics = ref(rowModel.getBackpressureDiagnostics())
const sortModelLabel = computed(() => {
  return sortModelText.value
})
const rowCacheLabel = computed(() => `${diagnostics.value.rowCacheSize} / ${diagnostics.value.rowCacheLimit}`)
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
  const sortModel = (state as { rows?: { snapshot?: { sortModel?: readonly DataGridSortState[] } } } | null)
    ?.rows?.snapshot?.sortModel ?? []
  sortModelText.value = sortModel.length > 0
    ? sortModel.map(entry => `${entry.key}:${entry.direction}`).join(", ")
    : "none"
  diagnostics.value = rowModel.getBackpressureDiagnostics()
}

function simulateErrorOnce(): void {
  failureMode.value = true
  void Promise.resolve(rowModel.refresh("manual")).catch(() => {})
}

onMounted(() => {
  totalRows.value = ROW_COUNT
  handleStateUpdate(rowModel.getSnapshot())
  void rowModel.refresh("mount")
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
  overflow: visible;
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
