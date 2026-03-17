<template>
  <article
    ref="cardRootRef"
    class="card affino-datagrid-app-root"
  >
    <header class="card__header">
      <div class="card__title-row">
        <h2>{{ title }}</h2>
        <div class="mode-badge">{{ modeBadge }}</div>
      </div>
      <div class="controls">
        <label>
          Rows
          <select v-model.number="rowCount">
            <option v-for="option in ROW_MODE_OPTIONS" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>
        <label>
          Cols
          <select v-model.number="columnCount">
            <option v-for="option in COLUMN_MODE_OPTIONS" :key="option" :value="option">{{ option }}</option>
          </select>
        </label>
        <label>
          Value filter
          <select v-model.number="valueFilterRowLimit">
            <option
              v-for="option in VALUE_FILTER_LIMIT_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
        <label v-if="props.mode === 'base'">
          Row mode
          <select v-model="rowHeightMode">
            <option value="fixed">Fixed</option>
            <option value="auto">Auto</option>
          </select>
        </label>
        <label v-if="props.mode === 'base'">
          Render
          <select v-model="rowRenderMode">
            <option value="virtualization">Virtualization</option>
            <option value="pagination">Pagination</option>
          </select>
        </label>
        <label v-if="props.mode === 'base' && rowRenderMode === 'pagination'">
          Page size
          <select v-model.number="paginationPageSize">
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
            <option :value="500">500</option>
          </select>
        </label>
        <label v-if="props.mode === 'base' && rowRenderMode === 'pagination'">
          Page
          <input
            v-model.number="paginationPage"
            type="number"
            min="1"
            step="1"
          />
        </label>
        <label v-if="props.mode === 'base'">
          Row size
          <input
            v-model.number="baseRowHeight"
            type="number"
            min="24"
            max="120"
            step="1"
          />
        </label>
        <label v-if="props.mode === 'pivot'">
          Pivot view
          <select v-model="pivotViewMode">
            <option value="pivot">Pivot</option>
            <option value="table">Table</option>
          </select>
        </label>
        <label v-if="props.mode === 'pivot' && pivotViewMode === 'pivot'">
          Pivot layout
          <select v-model="pivotLayout">
            <option value="department-month-revenue">Department × Month (Revenue Σ)</option>
            <option value="channel-status-deals">Channel × Status (Deals Σ)</option>
            <option value="month-channel-margin">Month × Channel (Margin Avg)</option>
          </select>
        </label>
        <div v-if="props.mode === 'tree' || props.mode === 'pivot' || (props.mode === 'base' && hasActiveGrouping)" class="group-actions">
          <button type="button" @click="runtime.api.rows.expandAllGroups()">Expand all</button>
          <button type="button" @click="runtime.api.rows.collapseAllGroups()">Collapse all</button>
        </div>
      </div>
      <ColumnLayoutPanel
        :is-open="isColumnLayoutPanelOpen"
        :items="columnLayoutPanelItems"
        @open="openColumnLayoutPanel"
        @toggle-visibility="updateColumnVisibility"
        @move-up="moveColumnUp"
        @move-down="moveColumnDown"
        @apply="applyColumnLayoutPanel"
        @cancel="cancelColumnLayoutPanel"
      />
      <DiagnosticsPanel
        :is-open="isDiagnosticsPanelOpen"
        :snapshot="diagnosticsSnapshot"
        @open="openDiagnosticsPanel"
        @refresh="refreshDiagnosticsPanel"
        @close="closeDiagnosticsPanel"
      />
      <StatePanel
        :is-open="isStatePanelOpen"
        :import-text="stateImportText"
        :output-text="stateOutputText"
        @open="openStatePanel"
        @close="closeStatePanel"
        @export-state="exportStatePayload"
        @migrate-state="migrateStatePayload"
        @apply-state="applyStatePayload"
        @update-import="stateImportText = $event"
      />
      <ComputePolicyPanel
        :is-open="isComputePolicyPanelOpen"
        :projection-mode="projectionMode"
        :compute-mode="computeMode"
        :compute-supported="computeSupported"
        :diagnostics-output="computeDiagnosticsOutput"
        @open="openComputePolicyPanel"
        @close="closeComputePolicyPanel"
        @update-projection-mode="projectionMode = $event"
        @update-compute-mode="computeMode = $event"
        @apply-projection="applyProjectionMode"
        @apply-compute="applyComputeMode"
        @refresh-diagnostics="refreshComputeDiagnostics"
      />
      <PivotAdvancedPanel
        v-if="props.mode === 'pivot'"
        :is-open="isPivotAdvancedPanelOpen"
        :import-text="pivotAdvancedImportText"
        :output-text="pivotAdvancedOutputText"
        @open="openPivotAdvancedPanel"
        @close="closePivotAdvancedPanel"
        @export-layout="exportPivotLayout"
        @export-interop="exportPivotInterop"
        @update-import="pivotAdvancedImportText = $event"
        @import-layout="importPivotLayout"
        @clear-import="pivotAdvancedImportText = ''"
      />
      <RefreshCellsPanel
        :is-open="isRefreshCellsPanelOpen"
        :row-keys="refreshRowKeysInput"
        :column-keys="refreshColumnKeysInput"
        @open="openRefreshCellsPanel"
        @close="closeRefreshCellsPanel"
        @refresh="refreshCellsByRowKeys"
        @update-row-keys="refreshRowKeysInput = $event"
        @update-column-keys="refreshColumnKeysInput = $event"
      />
      <AdvancedFilterPanel
        :is-open="isAdvancedFilterPanelOpen"
        :clauses="advancedFilterDraftClauses"
        :columns="advancedFilterColumns"
        :theme-tokens="sandboxThemeTokens"
        @open="openAdvancedFilterPanel"
        @add="addAdvancedFilterClause"
        @remove="removeAdvancedFilterClause"
        @update-clause="updateAdvancedFilterClause"
        @apply="applyAdvancedFilterPanel"
        @cancel="cancelAdvancedFilterPanel"
      />
      <div class="meta">
        <span>Rows in model: {{ totalRows }}</span>
        <span>Columns: {{ visibleColumns.length }}</span>
        <span>Viewport rows: {{ viewportRowStart }}..{{ viewportRowEnd }}</span>
        <span v-if="props.mode === 'pivot'">Pivot columns: {{ pivotColumnCount }}</span>
      </div>
    </header>

    <DataGridTableStageLoose ref="tableStageRef" v-bind="tableStagePropsForView" :stage-context="tableStageContextForView" />

    <footer class="card__footer">
      Rendered {{ displayRows.length }} / {{ totalRows }} rows. {{ modeHint }}
      <span v-if="selectionAggregatesLabel"> {{ selectionAggregatesLabel }}</span>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from "vue"
import { applyGridTheme, industrialNeutralTheme, resolveGridThemeTokens } from "@affino/datagrid-theme"
import type {
  DataGridColumnSnapshot,
  DataGridAppAdvancedFilterColumnOption,
  DataGridPivotSpec,
  UseDataGridRuntimeResult,
} from "@affino/datagrid-vue"
import {
  DataGridTableStage,
  createDataGridTableStageContext,
  useDataGridTableStageRuntime,
} from "@affino/datagrid-vue-app/internal"
import {
  useDataGridAppAdvancedFilterBuilder,
  useDataGridAppColumnLayoutPanel,
  useDataGridAppControls,
  useDataGridAppDiagnosticsPanel,
  useDataGridAppModeMeta,
  useDataGridAppRowSelection,
  useDataGridAppRuntime,
  useDataGridAppSelection,
} from "@affino/datagrid-vue"
import {
  buildVueColumns,
  buildVueRows,
  buildWorkerRowInputs,
  COLUMN_MODE_OPTIONS,
  ROW_MODE_OPTIONS,
  type VueSandboxRow,
  type VueTreeRow,
} from "../sandboxData"
import AdvancedFilterPanel from "./AdvancedFilterPanel.vue"
import ColumnLayoutPanel from "./ColumnLayoutPanel.vue"
import DiagnosticsPanel from "./DiagnosticsPanel.vue"
import PivotAdvancedPanel from "./PivotAdvancedPanel.vue"
import RefreshCellsPanel from "./RefreshCellsPanel.vue"
import StatePanel from "./StatePanel.vue"
import ComputePolicyPanel from "./ComputePolicyPanel.vue"
import DataGridRowModelHostWorker from "../workers/datagridRowModelHost.worker.ts?worker"

const DataGridTableStageLoose = DataGridTableStage as unknown as new () => {
  $props: Record<string, unknown>
}

interface DataGridTableStageExpose {
  getStageRootElement: () => HTMLElement | null
  getBodyViewportElement: () => HTMLElement | null
}

interface SandboxGridPerfTelemetrySnapshot {
  viewport: {
    scrollTop: number
    scrollLeft: number
    width: number
    height: number
  }
  dom: {
    rootNodes: number
    stageNodes: number
  }
  memory: {
    usedJSHeapMB: number | null
    totalJSHeapMB: number | null
    heapLimitMB: number | null
  }
  rendered: {
    totalRows: number
    visibleRows: number
    renderedColumns: number
    viewportRowStart: number
    viewportRowEnd: number
  }
  scrolling: {
    active: boolean
    sessionCount: number
    totalWindowShifts: number
    lastSession: null | {
      durationMs: number
      scrollEvents: number
      frameCount: number
      averageFrameMs: number
      maxFrameMs: number
      slowFrameCount: number
      windowShifts: number
      travelPx: number
    }
  }
}

function createSandboxGridPerfTelemetry(options: {
  resolveViewport: () => HTMLElement | null
  resolveRoot: () => HTMLElement | null
  resolveStageRoot: () => HTMLElement | null
  resolveTotalRows: () => number
  resolveVisibleRows: () => number
  resolveRenderedColumns: () => number
  resolveViewportRowStart: () => number
  resolveViewportRowEnd: () => number
}) {
  let activeViewport: HTMLElement | null = null
  let viewportScrollListener: ((event: Event) => void) | null = null
  let activeSession: null | {
    startedAt: number
    lastScrollAt: number
    lastFrameAt: number
    lastScrollTop: number
    lastScrollLeft: number
    frameCount: number
    frameDurationTotal: number
    maxFrameMs: number
    slowFrameCount: number
    scrollEvents: number
    windowShifts: number
    travelPx: number
  } = null
  let lastSession: SandboxGridPerfTelemetrySnapshot["scrolling"]["lastSession"] = null
  let sessionCount = 0
  let totalWindowShifts = 0
  let frameHandle = 0

  const stopFrameLoop = (): void => {
    if (frameHandle === 0 || typeof window === "undefined") {
      return
    }
    window.cancelAnimationFrame(frameHandle)
    frameHandle = 0
  }

  const finishSession = (endedAt: number): void => {
    if (!activeSession) {
      return
    }
    const effectiveFrameCount = Math.max(0, activeSession.frameCount - 1)
    lastSession = {
      durationMs: Math.max(0, Math.round(endedAt - activeSession.startedAt)),
      scrollEvents: activeSession.scrollEvents,
      frameCount: effectiveFrameCount,
      averageFrameMs: effectiveFrameCount > 0
        ? Number((activeSession.frameDurationTotal / effectiveFrameCount).toFixed(2))
        : 0,
      maxFrameMs: Number(activeSession.maxFrameMs.toFixed(2)),
      slowFrameCount: activeSession.slowFrameCount,
      windowShifts: activeSession.windowShifts,
      travelPx: Math.round(activeSession.travelPx),
    }
    activeSession = null
    stopFrameLoop()
  }

  const tickFrame = (now: number): void => {
    if (!activeSession) {
      frameHandle = 0
      return
    }
    if (activeSession.lastFrameAt > 0) {
      const delta = now - activeSession.lastFrameAt
      activeSession.frameDurationTotal += delta
      activeSession.maxFrameMs = Math.max(activeSession.maxFrameMs, delta)
      if (delta >= 20) {
        activeSession.slowFrameCount += 1
      }
    }
    activeSession.lastFrameAt = now
    activeSession.frameCount += 1

    if (now - activeSession.lastScrollAt >= 140) {
      finishSession(now)
      return
    }

    if (typeof window === "undefined") {
      frameHandle = 0
      return
    }
    frameHandle = window.requestAnimationFrame(tickFrame)
  }

  const ensureFrameLoop = (): void => {
    if (frameHandle !== 0 || typeof window === "undefined") {
      return
    }
    frameHandle = window.requestAnimationFrame(tickFrame)
  }

  const handleViewportScroll = (event: Event): void => {
    const viewport = event.target as HTMLElement | null
    if (!viewport || typeof performance === "undefined") {
      return
    }
    const now = performance.now()
    if (!activeSession) {
      sessionCount += 1
      activeSession = {
        startedAt: now,
        lastScrollAt: now,
        lastFrameAt: 0,
        lastScrollTop: viewport.scrollTop,
        lastScrollLeft: viewport.scrollLeft,
        frameCount: 0,
        frameDurationTotal: 0,
        maxFrameMs: 0,
        slowFrameCount: 0,
        scrollEvents: 0,
        windowShifts: 0,
        travelPx: 0,
      }
    }
    activeSession.scrollEvents += 1
    activeSession.lastScrollAt = now
    activeSession.travelPx += Math.abs(viewport.scrollTop - activeSession.lastScrollTop)
      + Math.abs(viewport.scrollLeft - activeSession.lastScrollLeft)
    activeSession.lastScrollTop = viewport.scrollTop
    activeSession.lastScrollLeft = viewport.scrollLeft
    ensureFrameLoop()
  }

  const detachViewport = (): void => {
    if (activeViewport && viewportScrollListener) {
      activeViewport.removeEventListener("scroll", viewportScrollListener)
    }
    activeViewport = null
    viewportScrollListener = null
  }

  const syncViewport = (): void => {
    const nextViewport = options.resolveViewport()
    if (nextViewport === activeViewport) {
      return
    }
    detachViewport()
    if (!nextViewport) {
      return
    }
    viewportScrollListener = handleViewportScroll
    nextViewport.addEventListener("scroll", viewportScrollListener, { passive: true })
    activeViewport = nextViewport
  }

  const noteViewportWindowShift = (): void => {
    totalWindowShifts += 1
    if (activeSession) {
      activeSession.windowShifts += 1
    }
  }

  const read = (): SandboxGridPerfTelemetrySnapshot => {
    syncViewport()
    const root = options.resolveRoot()
    const stageRoot = options.resolveStageRoot()
    const performanceWithMemory = performance as Performance & {
      memory?: {
        usedJSHeapSize?: number
        totalJSHeapSize?: number
        jsHeapSizeLimit?: number
      }
    }
    const usedJSHeapSize = performanceWithMemory.memory?.usedJSHeapSize
    const totalJSHeapSize = performanceWithMemory.memory?.totalJSHeapSize
    const jsHeapSizeLimit = performanceWithMemory.memory?.jsHeapSizeLimit
    return {
      viewport: {
        scrollTop: activeViewport?.scrollTop ?? 0,
        scrollLeft: activeViewport?.scrollLeft ?? 0,
        width: activeViewport?.clientWidth ?? 0,
        height: activeViewport?.clientHeight ?? 0,
      },
      dom: {
        rootNodes: root ? root.querySelectorAll("*").length : 0,
        stageNodes: stageRoot ? stageRoot.querySelectorAll("*").length : 0,
      },
      memory: {
        usedJSHeapMB: typeof usedJSHeapSize === "number"
          ? Number((usedJSHeapSize / (1024 * 1024)).toFixed(2))
          : null,
        totalJSHeapMB: typeof totalJSHeapSize === "number"
          ? Number((totalJSHeapSize / (1024 * 1024)).toFixed(2))
          : null,
        heapLimitMB: typeof jsHeapSizeLimit === "number"
          ? Number((jsHeapSizeLimit / (1024 * 1024)).toFixed(2))
          : null,
      },
      rendered: {
        totalRows: options.resolveTotalRows(),
        visibleRows: options.resolveVisibleRows(),
        renderedColumns: options.resolveRenderedColumns(),
        viewportRowStart: options.resolveViewportRowStart(),
        viewportRowEnd: options.resolveViewportRowEnd(),
      },
      scrolling: {
        active: activeSession != null,
        sessionCount,
        totalWindowShifts,
        lastSession,
      },
    }
  }

  const dispose = (): void => {
    finishSession(typeof performance === "undefined" ? 0 : performance.now())
    detachViewport()
    stopFrameLoop()
  }

  return {
    syncViewport,
    noteViewportWindowShift,
    read,
    dispose,
  }
}

type Mode = "base" | "tree" | "pivot" | "worker"
type PivotLayoutId = "department-month-revenue" | "channel-status-deals" | "month-channel-margin"

const props = defineProps<{
  title: string
  mode: Mode
}>()

const cardRootRef = ref<HTMLElement | null>(null)
const tableStageRef = ref<DataGridTableStageExpose | null>(null)
const sandboxThemeTokens = resolveGridThemeTokens(industrialNeutralTheme)

watchEffect(() => {
  if (!cardRootRef.value) {
    return
  }
  applyGridTheme(cardRootRef.value, sandboxThemeTokens)
})

function resolveNearestOption(target: number, options: readonly number[]): number {
  if (!options.length) {
    return target
  }
  let nearest = options[0] ?? target
  let bestDistance = Math.abs(nearest - target)
  for (const option of options) {
    const distance = Math.abs(option - target)
    if (distance < bestDistance) {
      nearest = option
      bestDistance = distance
    }
  }
  return nearest
}

function resolveInitialRowCount(): number {
  if (typeof window === "undefined") {
    return 10000
  }
  const raw = window.location.search ? new URLSearchParams(window.location.search).get("rows") : null
  const parsed = raw == null ? Number.NaN : Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10000
  }
  return resolveNearestOption(parsed, ROW_MODE_OPTIONS)
}

const rowCount = ref<number>(resolveInitialRowCount())
const columnCount = ref<number>(16)
const VALUE_FILTER_LIMIT_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 10_000, label: "Up to 10k" },
  { value: 50_000, label: "Up to 50k" },
  { value: 100_000, label: "Up to 100k" },
  { value: 200_000, label: "Up to 200k" },
  { value: Number.MAX_SAFE_INTEGER, label: "Never disable" },
] as const
const valueFilterRowLimit = ref<number>(100_000)

const PIVOT_LAYOUTS: Record<PivotLayoutId, DataGridPivotSpec> = {
  "department-month-revenue": {
    rows: ["department"],
    columns: ["month"],
    values: [{ field: "amount", agg: "sum" }],
  },
  "channel-status-deals": {
    rows: ["channel"],
    columns: ["status"],
    values: [{ field: "deals", agg: "sum" }],
  },
  "month-channel-margin": {
    rows: ["month"],
    columns: ["channel"],
    values: [{ field: "marginPct", agg: "avg" }],
  },
}

const rows = computed(() => {
  if (props.mode === "worker") {
    return buildWorkerRowInputs(Math.min(rowCount.value, 512), columnCount.value)
      .map(entry => entry.row) as VueSandboxRow[]
  }
  return buildVueRows(props.mode, rowCount.value, columnCount.value)
})
const columns = computed(() => buildVueColumns(props.mode, columnCount.value))
let syncViewportFromDom = (): void => {}

const cloneRowData = <TRow,>(row: TRow): TRow => {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(row)
  }
  if (row && typeof row === "object") {
    return { ...(row as Record<string, unknown>) } as TRow
  }
  return row
}

let runtimeRef: Pick<UseDataGridRuntimeResult<VueSandboxRow>, "api" | "columnSnapshot"> | null = null
const visibleColumns = computed<readonly DataGridColumnSnapshot[]>(() => runtimeRef?.columnSnapshot.value.visibleColumns ?? [])
const totalRows = computed(() => {
  void rowVersion.value
  return runtimeRef?.api.rows.getCount() ?? 0
})
const {
  selectionSnapshot,
  selectionAnchor,
  selectionService,
  selectionAggregatesLabel,
  syncSelectionSnapshotFromRuntime,
} = useDataGridAppSelection<VueSandboxRow>({
  mode: computed(() => props.mode),
  resolveRuntime: () => (runtimeRef ? { api: runtimeRef.api } : null),
  visibleColumns,
  totalRows,
})
const {
  rowSelectionSnapshot,
  selectionService: rowSelectionService,
  syncRowSelectionSnapshotFromRuntime,
} = useDataGridAppRowSelection<VueSandboxRow>({
  resolveRuntime: () => (runtimeRef ? { api: runtimeRef.api } : null),
})
const runtimeServices = {
  selection: {
    ...selectionService,
    ...rowSelectionService,
  },
}

const {
  runtime,
  rowVersion,
} = useDataGridAppRuntime<VueSandboxRow>({
  mode: computed(() => props.mode),
  rows,
  columns,
  clientRowModelOptions: {
    isolateInputRows: false,
  },
  services: runtimeServices,
  treeData: {
    getDataPath: row => (row as VueTreeRow).path,
    filterMode: "include-descendants",
  },
  initialPivotModel: PIVOT_LAYOUTS["department-month-revenue"],
  worker: {
    resolveRowInputsOnDemand: () => buildWorkerRowInputs(rowCount.value, columnCount.value),
    rowInputsUpdateKey: computed(() => `${rowCount.value}:${columnCount.value}`),
    createHostWorker: () => new DataGridRowModelHostWorker(),
  },
})
runtimeRef = runtime

const {
  isAdvancedFilterPanelOpen,
  advancedFilterDraftClauses,
  advancedFilterColumns,
  appliedAdvancedFilterExpression,
  openAdvancedFilterPanel,
  addAdvancedFilterClause,
  removeAdvancedFilterClause,
  updateAdvancedFilterClause,
  cancelAdvancedFilterPanel,
  applyAdvancedFilterPanel,
} = useDataGridAppAdvancedFilterBuilder({
  resolveColumns: (): readonly DataGridAppAdvancedFilterColumnOption[] => visibleColumns.value.map(column => ({
    key: column.key,
    label: column.column.label ?? column.key,
  })),
})
const {
  columnFilterTextByKey,
  groupByField,
  sortState,
  rowHeightMode,
  rowRenderMode,
  paginationPageSize,
  paginationPage,
  baseRowHeight,
  normalizedBaseRowHeight,
  pivotViewMode,
  pivotLayout,
  pivotColumnCount,
  isRefreshCellsPanelOpen,
  refreshRowKeysInput,
  refreshColumnKeysInput,
  isStatePanelOpen,
  stateImportText,
  stateOutputText,
  isComputePolicyPanelOpen,
  projectionMode,
  computeMode,
  computeDiagnosticsOutput,
  computeSupported,
  isPivotAdvancedPanelOpen,
  pivotAdvancedImportText,
  pivotAdvancedOutputText,
  setColumnFilterText,
  toggleSortForColumn,
  sortIndicator,
  applySortAndFilter,
  applyRowHeightSettings,
  openRefreshCellsPanel,
  closeRefreshCellsPanel,
  refreshCellsByRowKeys,
  openStatePanel,
  closeStatePanel,
  exportStatePayload,
  migrateStatePayload,
  applyStatePayload,
  openComputePolicyPanel,
  closeComputePolicyPanel,
  refreshComputeDiagnostics,
  applyProjectionMode,
  applyComputeMode,
  openPivotAdvancedPanel,
  closePivotAdvancedPanel,
  exportPivotLayout,
  exportPivotInterop,
  importPivotLayout,
} = useDataGridAppControls<VueSandboxRow, PivotLayoutId>({
  mode: computed(() => props.mode),
  runtime,
  appliedAdvancedFilterExpression,
  pivotLayouts: PIVOT_LAYOUTS,
  initialPivotLayout: "department-month-revenue",
  syncViewport: () => {
    syncViewportFromDom()
  },
})
const {
  isColumnLayoutPanelOpen,
  columnLayoutPanelItems,
  openColumnLayoutPanel,
  cancelColumnLayoutPanel,
  applyColumnLayoutPanel,
  moveColumnUp,
  moveColumnDown,
  updateColumnVisibility,
} = useDataGridAppColumnLayoutPanel({
  resolveColumns: () => {
    const snapshot = runtime.api.columns.getSnapshot()
    return snapshot.columns.map(column => ({
      key: column.key,
      label: column.column.label ?? column.key,
      visible: column.visible,
    }))
  },
  applyColumnLayout: payload => {
    runtime.api.columns.setOrder(payload.order)
    for (const [key, visible] of Object.entries(payload.visibilityByKey)) {
      runtime.api.columns.setVisibility(key, visible)
    }
    syncViewportFromDom()
  },
})

const firstColumnKey = computed<string>(() => visibleColumns.value[0]?.key ?? "name")
const {
  modeBadge,
  modeHint,
} = useDataGridAppModeMeta({
  mode: computed(() => props.mode),
})
const {
  isDiagnosticsPanelOpen,
  diagnosticsSnapshot,
  openDiagnosticsPanel,
  closeDiagnosticsPanel,
  refreshDiagnosticsPanel,
} = useDataGridAppDiagnosticsPanel({
  readDiagnostics: () => {
    const runtimeDiagnostics = runtime.api.diagnostics.getAll()
    return {
      ...(runtimeDiagnostics && typeof runtimeDiagnostics === "object"
        ? runtimeDiagnostics as unknown as Record<string, unknown>
        : { runtimeDiagnostics }),
      sandboxPolicy: {
        rowCount: rowCount.value,
        columnCount: columnCount.value,
        valueFilterRowLimit: valueFilterRowLimit.value,
        valueFilterEnabled: columnMenuValueFilterEnabled.value,
        stageSourceRowsEnabled: columnMenuValueFilterEnabled.value,
      },
      sandboxPerf: sandboxPerfTelemetry.read(),
    }
  },
})
const virtualization = computed(() => ({
  rows: rowRenderMode.value !== "pagination",
  columns: true,
  rowOverscan: props.mode === "worker" ? 3 : 8,
  columnOverscan: props.mode === "worker" ? 1 : 2,
}))
const columnMenuValueFilterEnabled = computed(() => {
  return props.mode !== "worker"
    && valueFilterRowLimit.value > 0
    && rowCount.value <= valueFilterRowLimit.value
})
const stageSourceRows = computed<readonly VueSandboxRow[]>(() => (
  columnMenuValueFilterEnabled.value ? rows.value : []
))
const activeGroupBy = computed(() => {
  void rowVersion.value
  return runtime.api.rows.getSnapshot().groupBy ?? null
})
const hasActiveGrouping = computed(() => (activeGroupBy.value?.fields.length ?? 0) > 0)
const {
  tableStageProps,
  syncViewportFromDom: syncViewportFromDomRuntime,
} = useDataGridTableStageRuntime<VueSandboxRow>({
  mode: computed(() => props.mode),
  rows,
  sourceRows: stageSourceRows,
  runtime,
  rowVersion,
  totalRows,
  visibleColumns,
  rowRenderMode,
  rowHeightMode,
  normalizedBaseRowHeight,
  selectionSnapshot,
  selectionAnchor,
  syncSelectionSnapshotFromRuntime,
  rowSelectionSnapshot,
  syncRowSelectionSnapshotFromRuntime,
  firstColumnKey,
  columnFilterTextByKey,
  virtualization,
  toggleSortForColumn,
  sortIndicator,
  setColumnFilterText,
  columnMenuValueFilterEnabled,
  columnMenuValueFilterRowLimit: valueFilterRowLimit,
  applyRowHeightSettings,
  cloneRowData,
})
syncViewportFromDom = syncViewportFromDomRuntime

const resolveColumnMenuSortDirection = (columnKey: string): "asc" | "desc" | null => {
  return sortState.value.find(entry => entry.key === columnKey)?.direction ?? null
}

const isColumnFilterActive = (columnKey: string): boolean => {
  return String(columnFilterTextByKey.value[columnKey] ?? "").trim().length > 0
}

const resolveColumnGroupOrder = (columnKey: string): number | null => {
  const index = activeGroupBy.value?.fields.findIndex(field => field === columnKey) ?? -1
  return index >= 0 ? index : null
}

const isColumnGrouped = (columnKey: string): boolean => {
  return resolveColumnGroupOrder(columnKey) !== null
}

const applyColumnMenuSort = (columnKey: string, direction: "asc" | "desc" | null): void => {
  sortState.value = direction === null
    ? sortState.value.filter(entry => entry.key !== columnKey)
    : [{ key: columnKey, direction }]
  applySortAndFilter()
}

const applyColumnMenuPin = (columnKey: string, pin: "left" | "right" | "none"): void => {
  runtime.api.columns.setPin(columnKey, pin)
  syncViewportFromDom()
}

const applyColumnMenuGroupBy = (columnKey: string, grouped: boolean): void => {
  const nextFields = grouped
    ? Array.from(new Set([...(activeGroupBy.value?.fields ?? []), columnKey]))
    : (activeGroupBy.value?.fields ?? []).filter(field => field !== columnKey)
  runtime.api.rows.setGroupBy(nextFields.length > 0
    ? {
        fields: nextFields,
        expandedByDefault: activeGroupBy.value?.expandedByDefault ?? true,
      }
    : null)
  groupByField.value = nextFields[0] ?? ""
  syncViewportFromDom()
}

const applyColumnMenuFilter = (_columnKey: string, _tokens: readonly string[]): void => {
  // Adapter demo currently exposes text filters through the legacy control flow only.
}

const clearColumnMenuFilter = (columnKey: string): void => {
  setColumnFilterText(columnKey, "")
}

const tableStageColumnsForView = computed(() => ({
  ...tableStageProps.value.columns,
  columnMenuEnabled: true,
  columnMenuValueFilterEnabled: columnMenuValueFilterEnabled.value,
  columnMenuValueFilterRowLimit: valueFilterRowLimit.value,
  columnMenuMaxFilterValues: 250,
  isColumnFilterActive,
  isColumnGrouped,
  resolveColumnGroupOrder,
  resolveColumnMenuSortDirection,
  resolveColumnMenuSelectedTokens: () => [],
  applyColumnMenuSort,
  applyColumnMenuPin,
  applyColumnMenuGroupBy,
  applyColumnMenuFilter,
  clearColumnMenuFilter,
}))

const tableStageRowsForView = computed(() => ({
  ...tableStageProps.value.rows,
  sourceRows: stageSourceRows.value,
}))

const tableStagePropsForView = computed(() => ({
  ...tableStageProps.value,
  columns: tableStageColumnsForView.value,
  rows: tableStageRowsForView.value,
}))

const tableStageContextForView = createDataGridTableStageContext<VueSandboxRow>({
  mode: computed(() => tableStagePropsForView.value.mode),
  rowHeightMode: computed(() => tableStagePropsForView.value.rowHeightMode),
  layout: computed(() => tableStagePropsForView.value.layout),
  viewport: computed(() => tableStagePropsForView.value.viewport),
  columns: tableStageColumnsForView,
  rows: tableStageRowsForView,
  selection: computed(() => tableStagePropsForView.value.selection),
  editing: computed(() => tableStagePropsForView.value.editing),
  cells: computed(() => tableStagePropsForView.value.cells),
  interaction: computed(() => tableStagePropsForView.value.interaction),
})

const displayRows = computed(() => tableStagePropsForView.value.rows.displayRows)
const viewportRowStart = computed(() => tableStagePropsForView.value.viewport.viewportRowStart)
const viewportRowEnd = computed(() => {
  const count = displayRows.value.length
  if (count <= 0) {
    return viewportRowStart.value
  }
  return viewportRowStart.value + count - 1
})

const sandboxPerfTelemetry = createSandboxGridPerfTelemetry({
  resolveViewport: () => tableStageRef.value?.getBodyViewportElement() ?? null,
  resolveRoot: () => cardRootRef.value,
  resolveStageRoot: () => tableStageRef.value?.getStageRootElement() ?? null,
  resolveTotalRows: () => totalRows.value,
  resolveVisibleRows: () => displayRows.value.length,
  resolveRenderedColumns: () => tableStagePropsForView.value.columns.renderedColumns.length,
  resolveViewportRowStart: () => viewportRowStart.value,
  resolveViewportRowEnd: () => viewportRowEnd.value,
})

watch(viewportRowStart, (nextValue, previousValue) => {
  if (previousValue !== nextValue) {
    sandboxPerfTelemetry.noteViewportWindowShift()
  }
})

onMounted(() => {
  void nextTick(() => {
    sandboxPerfTelemetry.syncViewport()
  })
})

onBeforeUnmount(() => {
  sandboxPerfTelemetry.dispose()
})
</script>
