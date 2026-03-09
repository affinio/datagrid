<template>
  <article class="card">
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
        <label v-if="props.mode !== 'pivot'">
          Group by
          <select v-model="groupByField">
            <option value="">None</option>
            <option v-for="column in visibleColumns" :key="`group-by-${column.key}`" :value="column.key">
              {{ column.column.label ?? column.key }}
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
        <div v-if="props.mode === 'tree' || props.mode === 'pivot'" class="group-actions">
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

    <DataGridTableStageLoose v-bind="tableStagePropsForView" />

    <footer class="card__footer">
      Rendered {{ displayRows.length }} / {{ totalRows }} rows. {{ modeHint }}
      <span v-if="selectionAggregatesLabel"> {{ selectionAggregatesLabel }}</span>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import type {
  DataGridColumnSnapshot,
  DataGridAppAdvancedFilterColumnOption,
  DataGridPivotSpec,
  DataGridSelectionSnapshot,
  UseDataGridRuntimeResult,
} from "@affino/datagrid-vue"
import { DataGridTableStage, useDataGridTableStageRuntime } from "../../../datagrid-vue-app/src/internal"
import {
  useDataGridAppAdvancedFilterBuilder,
  useDataGridAppColumnLayoutPanel,
  useDataGridAppControls,
  useDataGridAppDiagnosticsPanel,
  useDataGridAppModeMeta,
  useDataGridAppRuntime,
  useDataGridAppSelection,
} from "@affino/datagrid-vue"
import {
  buildVueColumns,
  buildVueRows,
  COLUMN_MODE_OPTIONS,
  ROW_MODE_OPTIONS,
  toRowInputs,
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

const DataGridTableStageLoose = DataGridTableStage as unknown as new () => {
  $props: Record<string, unknown>
}

type Mode = "base" | "tree" | "pivot" | "worker"
type PivotLayoutId = "department-month-revenue" | "channel-status-deals" | "month-channel-margin"

const props = defineProps<{
  title: string
  mode: Mode
}>()

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

const rows = computed(() => buildVueRows(props.mode, rowCount.value, columnCount.value))
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
  runtimeServices,
  selectionAggregatesLabel,
  syncSelectionSnapshotFromRuntime,
} = useDataGridAppSelection<VueSandboxRow>({
  mode: computed(() => props.mode),
  resolveRuntime: () => (runtimeRef ? { api: runtimeRef.api } : null),
  visibleColumns,
  totalRows,
})

const {
  runtime,
  rowVersion,
} = useDataGridAppRuntime<VueSandboxRow>({
  mode: computed(() => props.mode),
  rows,
  columns,
  services: runtimeServices,
  treeData: {
    getDataPath: row => (row as VueTreeRow).path,
    filterMode: "include-descendants",
  },
  initialPivotModel: PIVOT_LAYOUTS["department-month-revenue"],
  worker: {
    resolveRowInputs: nextRows => toRowInputs(nextRows),
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
  applyGroupBy,
  applyPaginationSettings,
  applyRowHeightSettings,
  applyPivotConfiguration,
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
  readDiagnostics: () => runtime.api.diagnostics.getAll(),
})
const virtualization = computed(() => ({
  rows: rowRenderMode.value !== "pagination",
  columns: true,
  rowOverscan: 8,
  columnOverscan: 2,
}))
const {
  tableStageProps,
  syncViewportFromDom: syncViewportFromDomRuntime,
} = useDataGridTableStageRuntime<VueSandboxRow>({
  mode: computed(() => props.mode),
  rows,
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
  firstColumnKey,
  columnFilterTextByKey,
  virtualization,
  toggleSortForColumn,
  sortIndicator,
  setColumnFilterText,
  applyRowHeightSettings,
  cloneRowData,
})
syncViewportFromDom = syncViewportFromDomRuntime
const tableStagePropsForView = computed<Record<string, unknown>>(() => {
  return tableStageProps.value as unknown as Record<string, unknown>
})
const displayRows = computed(() => tableStageProps.value.displayRows)
const viewportRowStart = computed(() => tableStageProps.value.viewportRowStart)
const viewportRowEnd = computed(() => {
  const count = tableStageProps.value.displayRows.length
  if (count <= 0) {
    return tableStageProps.value.viewportRowStart
  }
  return tableStageProps.value.viewportRowStart + count - 1
})
</script>
