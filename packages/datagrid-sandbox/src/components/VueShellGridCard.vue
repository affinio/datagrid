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
        <label v-if="props.mode === 'base'">
          Group by
          <select v-model="groupByField">
            <option value="">None</option>
            <option v-for="column in columns" :key="`group-by-${column.key}`" :value="column.key">
              {{ column.label ?? column.key }}
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
        <label v-if="props.mode === 'pivot' && pivotViewMode === 'pivot'">
          <input v-model="hideUnusedPivotSourceColumns" type="checkbox" />
          Hide unused source columns
        </label>
        <div v-if="props.mode === 'tree' || props.mode === 'pivot'" class="group-actions">
          <button type="button" @click="expandAllGroups">Expand all</button>
          <button type="button" @click="collapseAllGroups">Collapse all</button>
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
      <StatePanel
        :is-open="isStatePanelOpen"
        :import-text="stateImportText"
        :output-text="stateOutputText"
        @open="isStatePanelOpen = true"
        @close="isStatePanelOpen = false"
        @export-state="exportStatePayload"
        @migrate-state="migrateStatePayload"
        @apply-state="applyStatePayload"
        @update-import="stateImportText = $event"
      />
      <PivotAdvancedPanel
        v-if="props.mode === 'pivot'"
        :is-open="isPivotAdvancedPanelOpen"
        :import-text="pivotAdvancedImportText"
        :output-text="pivotAdvancedOutputText"
        @open="isPivotAdvancedPanelOpen = true"
        @close="isPivotAdvancedPanelOpen = false"
        @export-layout="exportPivotLayout"
        @export-interop="exportPivotInterop"
        @update-import="pivotAdvancedImportText = $event"
        @import-layout="importPivotLayout"
        @clear-import="pivotAdvancedImportText = ''"
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
        <span>Rows: {{ rows.length }}</span>
        <span>Columns: {{ columns.length }}</span>
        <span>{{ modeHint }}</span>
      </div>
    </header>

    <section class="grid-host">
      <DataGrid
        ref="gridRef"
        :rows="rows"
        :columns="columns"
        :client-row-model-options="clientRowModelOptions"
        :group-by="groupBy"
        :aggregation-model="aggregationModel"
        :pivot-model="pivotModel"
        :filter-model="filterModel"
        :pagination="pagination"
        :page-size="paginationPageSize"
        :current-page="Math.max(0, paginationPage - 1)"
        :column-state="effectiveColumnState"
        :virtualization="virtualization"
        :row-height-mode="rowHeightMode"
        :base-row-height="baseRowHeight"
        @cell-change="syncSelectionAggregatesLabel"
        @selection-change="syncSelectionAggregatesLabel"
        @update:column-state="handleColumnStateUpdate"
        @update:state="handleStateUpdate"
      />
    </section>

    <footer class="card__footer">
      Public app package demo: <code>import { DataGrid } from "@affino/datagrid-vue-app"</code>
      <span v-if="selectionAggregatesLabel"> {{ selectionAggregatesLabel }}</span>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { DataGrid } from "@affino/datagrid-vue-app"
import { useDataGridAppAdvancedFilterBuilder } from "@affino/datagrid-vue"
import type {
  DataGridAggregationModel,
  DataGridAdvancedFilterExpression,
  DataGridAppAdvancedFilterColumnOption,
  DataGridColumnDef,
  DataGridColumnPin,
  DataGridFilterSnapshot,
  DataGridPivotInteropSnapshot,
  DataGridPivotLayoutImportOptions,
  DataGridPivotLayoutSnapshot,
  DataGridPivotSpec,
  DataGridSelectionSummarySnapshot,
  DataGridUnifiedColumnState,
  DataGridUnifiedState,
} from "@affino/datagrid-vue"
import {
  buildVueColumns,
  buildVueRows,
  COLUMN_MODE_OPTIONS,
  ROW_MODE_OPTIONS,
  type VueTreeRow,
} from "../sandboxData"
import AdvancedFilterPanel from "./AdvancedFilterPanel.vue"
import ColumnLayoutPanel from "./ColumnLayoutPanel.vue"
import PivotAdvancedPanel from "./PivotAdvancedPanel.vue"
import StatePanel from "./StatePanel.vue"

type Mode = "base" | "tree" | "pivot"
type PivotLayoutId = "department-month-revenue" | "channel-status-deals" | "month-channel-margin"
type PivotViewMode = "pivot" | "table"

interface PublicDataGridExpose {
  getApi: () => unknown | null
  getColumnState: () => DataGridUnifiedColumnState | null
  getSelectionAggregatesLabel: () => string
  getSelectionSummary: () => DataGridSelectionSummarySnapshot | null
  applyColumnState: (columnState: DataGridUnifiedColumnState) => boolean
  getState: () => DataGridUnifiedState<unknown> | null
  migrateState: (state: unknown, options?: unknown) => DataGridUnifiedState<unknown> | null
  applyState: (state: DataGridUnifiedState<unknown>, options?: unknown) => boolean
  exportPivotLayout: () => DataGridPivotLayoutSnapshot<unknown> | null
  exportPivotInterop: () => DataGridPivotInteropSnapshot<unknown> | null
  importPivotLayout: (
    layout: DataGridPivotLayoutSnapshot<unknown>,
    options?: DataGridPivotLayoutImportOptions,
  ) => boolean
  expandAllGroups: () => void
  collapseAllGroups: () => void
}

interface ColumnLayoutDraft {
  order: string[]
  visibility: Record<string, boolean>
}

const props = defineProps<{
  title: string
  mode: Mode
}>()

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

function serializePretty(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function parseJson(value: string): unknown | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

function buildBaseColumnState(columns: readonly DataGridColumnDef[]): DataGridUnifiedColumnState {
  const visibility: Record<string, boolean> = {}
  const widths: Record<string, number | null> = {}
  const pins: Record<string, DataGridColumnPin> = {}

  for (const column of columns) {
    visibility[column.key] = true
    widths[column.key] = typeof column.width === "number" ? column.width : null
    pins[column.key] = "none"
  }

  return {
    order: columns.map(column => column.key),
    visibility,
    widths,
    pins,
  }
}

function normalizeColumnState(
  state: DataGridUnifiedColumnState | null | undefined,
  columns: readonly DataGridColumnDef[],
): DataGridUnifiedColumnState {
  const source = buildBaseColumnState(columns)
  const base = {
    order: [...source.order],
    visibility: { ...source.visibility },
    widths: { ...source.widths },
    pins: { ...source.pins },
  }
  if (!state) {
    return base
  }

  const knownKeys = new Set(base.order)
  const nextOrder = [
    ...state.order.filter(key => knownKeys.has(key)),
    ...base.order.filter(key => !state.order.includes(key)),
  ]

  for (const key of base.order) {
    if (state.visibility[key] !== undefined) {
      base.visibility[key] = state.visibility[key] ?? true
    }
    if (state.widths[key] !== undefined) {
      base.widths[key] = state.widths[key] ?? null
    }
    if (state.pins[key] !== undefined) {
      base.pins[key] = state.pins[key] ?? "none"
    }
  }

  base.order = nextOrder
  return base
}

const modeBadge = computed(() => {
  return props.mode === "tree"
    ? "Sugar / Tree"
    : props.mode === "pivot"
      ? "Sugar / Pivot"
      : "Sugar / Base"
})

const modeHint = computed(() => {
  return props.mode === "tree"
    ? "Public component with tree-data row model options."
    : props.mode === "pivot"
      ? "Public component with declarative pivot model."
      : "Public component with declarative rows, columns and view state."
})

const rowCount = ref<number>(10000)
const columnCount = ref<number>(16)
const groupByField = ref("")
const rowHeightMode = ref<"fixed" | "auto">("fixed")
const rowRenderMode = ref<"virtualization" | "pagination">("virtualization")
const paginationPageSize = ref(100)
const paginationPage = ref(1)
const baseRowHeight = ref(31)
const pivotViewMode = ref<PivotViewMode>("pivot")
const pivotLayout = ref<PivotLayoutId>("department-month-revenue")
const hideUnusedPivotSourceColumns = ref(true)
const gridRef = ref<PublicDataGridExpose | null>(null)

const isColumnLayoutPanelOpen = ref(false)
const columnLayoutDraft = ref<ColumnLayoutDraft | null>(null)
const isStatePanelOpen = ref(false)
const stateImportText = ref("")
const stateOutputText = ref("")
const isPivotAdvancedPanelOpen = ref(false)
const pivotAdvancedImportText = ref("")
const pivotAdvancedOutputText = ref("")
const columnState = ref<DataGridUnifiedColumnState | null>(null)
const stateModel = ref<DataGridUnifiedState<unknown> | null>(null)
const selectionAggregatesLabel = ref("")

const rows = computed(() => buildVueRows(props.mode, rowCount.value, columnCount.value))
const columns = computed(() => buildVueColumns(props.mode, columnCount.value))
const groupBy = computed(() => {
  if (props.mode !== "base" || !groupByField.value.trim()) {
    return null
  }
  return groupByField.value.trim()
})
const aggregationModel = computed<DataGridAggregationModel<unknown> | null>(() => {
  if (props.mode !== "base" || !groupBy.value) {
    return null
  }
  return {
    columns: [
      { key: "amount", op: "sum" },
      { key: "qty", op: "sum" },
    ],
    basis: "filtered",
  }
})
const pivotModel = computed(() => {
  return props.mode === "pivot" && pivotViewMode.value === "pivot"
    ? (PIVOT_LAYOUTS[pivotLayout.value] ?? null)
    : null
})
const pagination = computed<boolean>(() => {
  return props.mode === "base" && rowRenderMode.value === "pagination"
})
const clientRowModelOptions = computed(() => {
  if (props.mode !== "tree") {
    return undefined
  }
  return {
    initialTreeData: {
      mode: "path" as const,
      getDataPath: (row: unknown) => (row as VueTreeRow).path,
      expandedByDefault: true,
      filterMode: "include-descendants" as const,
    },
  }
})
const virtualization = computed(() => {
  return {
    rows: props.mode !== "base" || rowRenderMode.value !== "pagination",
    columns: true,
    rowOverscan: 8,
    columnOverscan: 2,
  }
})

const resolvedColumnState = computed(() => normalizeColumnState(columnState.value, columns.value))
const effectiveColumnState = computed<DataGridUnifiedColumnState>(() => {
  const base = normalizeColumnState(columnState.value, columns.value)
  const pins: Record<string, DataGridColumnPin> = { ...base.pins }
  const pinnedRightKey = props.mode === "pivot"
    ? "amount"
    : props.mode === "tree"
      ? "amount"
      : "updatedAt"
  if (pins[pinnedRightKey] !== "right") {
    pins[pinnedRightKey] = "right"
  }
  if (props.mode !== "pivot" || pivotViewMode.value !== "pivot" || !hideUnusedPivotSourceColumns.value) {
    return {
      order: [...base.order],
      visibility: { ...base.visibility },
      widths: { ...base.widths },
      pins,
    }
  }
  const order = [...base.order]
  const visibility: Record<string, boolean> = { ...base.visibility }
  const labelColumnKey = PIVOT_LAYOUTS[pivotLayout.value]?.rows[0] ?? columns.value[0]?.key ?? "name"
  for (const key of order) {
    visibility[key] = key === labelColumnKey
  }
  return {
    order,
    visibility,
    widths: { ...base.widths },
    pins,
  }
})
const resolvedColumnLayoutDraft = computed<ColumnLayoutDraft>(() => {
  if (columnLayoutDraft.value) {
    return columnLayoutDraft.value
  }
  return {
    order: [...effectiveColumnState.value.order],
    visibility: { ...effectiveColumnState.value.visibility },
  }
})

const columnLayoutPanelItems = computed(() => {
  return resolvedColumnLayoutDraft.value.order.map((key, index, order) => {
    const column = columns.value.find(entry => entry.key === key)
    return {
      key,
      label: column?.label ?? key,
      visible: resolvedColumnLayoutDraft.value.visibility[key] ?? true,
      canMoveUp: index > 0,
      canMoveDown: index < order.length - 1,
    }
  })
})

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
  resolveColumns: (): readonly DataGridAppAdvancedFilterColumnOption[] => {
    const visibleKeys = new Set(
      resolvedColumnState.value.order.filter(key => resolvedColumnState.value.visibility[key] ?? true),
    )
    return columns.value
      .filter(column => visibleKeys.has(column.key))
      .map(column => ({
        key: column.key,
        label: column.label ?? column.key,
      }))
  },
})

const filterModel = computed<DataGridFilterSnapshot | null>(() => {
  const advancedExpression = appliedAdvancedFilterExpression.value as DataGridAdvancedFilterExpression | null
  if (!advancedExpression) {
    return null
  }
  return {
    columnFilters: {},
    advancedFilters: {},
    advancedExpression,
  }
})

watch(columns, nextColumns => {
  columnState.value = normalizeColumnState(columnState.value, nextColumns)
  if (groupByField.value && !nextColumns.some(column => column.key === groupByField.value)) {
    groupByField.value = ""
  }
  selectionAggregatesLabel.value = ""
}, { immediate: true })

const handleColumnStateUpdate = (nextState: DataGridUnifiedColumnState): void => {
  columnState.value = normalizeColumnState(nextState, columns.value)
}

const handleStateUpdate = (nextState: DataGridUnifiedState<unknown>): void => {
  stateModel.value = nextState
}

const syncSelectionAggregatesLabel = (): void => {
  selectionAggregatesLabel.value = gridRef.value?.getSelectionAggregatesLabel() ?? ""
}

const openColumnLayoutPanel = (): void => {
  columnLayoutDraft.value = {
    order: [...resolvedColumnState.value.order],
    visibility: { ...resolvedColumnState.value.visibility },
  }
  isColumnLayoutPanelOpen.value = true
}

const cancelColumnLayoutPanel = (): void => {
  columnLayoutDraft.value = null
  isColumnLayoutPanelOpen.value = false
}

const updateColumnVisibility = (payload: { key: string; visible: boolean }): void => {
  if (!columnLayoutDraft.value) {
    openColumnLayoutPanel()
  }
  if (!columnLayoutDraft.value) {
    return
  }
  columnLayoutDraft.value = {
    ...columnLayoutDraft.value,
    visibility: {
      ...columnLayoutDraft.value.visibility,
      [payload.key]: payload.visible,
    },
  }
}

const moveColumn = (key: string, direction: -1 | 1): void => {
  if (!columnLayoutDraft.value) {
    openColumnLayoutPanel()
  }
  const draft = columnLayoutDraft.value
  if (!draft) {
    return
  }
  const currentIndex = draft.order.indexOf(key)
  if (currentIndex < 0) {
    return
  }
  const nextIndex = currentIndex + direction
  if (nextIndex < 0 || nextIndex >= draft.order.length) {
    return
  }
  const nextOrder = [...draft.order]
  const [moved] = nextOrder.splice(currentIndex, 1)
  if (typeof moved !== "string") {
    return
  }
  nextOrder.splice(nextIndex, 0, moved)
  columnLayoutDraft.value = {
    ...draft,
    order: nextOrder,
  }
}

const moveColumnUp = (key: string): void => {
  moveColumn(key, -1)
}

const moveColumnDown = (key: string): void => {
  moveColumn(key, 1)
}

const applyColumnLayoutPanel = (): void => {
  const draft = columnLayoutDraft.value
  if (!draft) {
    return
  }
  const nextState = normalizeColumnState(columnState.value, columns.value)
  nextState.order = [...draft.order]
  nextState.visibility = { ...nextState.visibility, ...draft.visibility }
  columnState.value = nextState
  gridRef.value?.applyColumnState(nextState)
  cancelColumnLayoutPanel()
}

const exportStatePayload = (): void => {
  stateOutputText.value = serializePretty(gridRef.value?.getState() ?? stateModel.value)
}

const migrateStatePayload = (): void => {
  const parsed = parseJson(stateImportText.value)
  if (!parsed) {
    return
  }
  const migrated = gridRef.value?.migrateState(parsed) ?? null
  if (!migrated) {
    return
  }
  stateOutputText.value = serializePretty(migrated)
}

const applyStatePayload = (): void => {
  const parsed = parseJson(stateImportText.value)
  if (!parsed) {
    return
  }
  const migrated = gridRef.value?.migrateState(parsed) ?? null
  if (!migrated) {
    return
  }
  if (gridRef.value?.applyState(migrated)) {
    stateModel.value = migrated
    stateOutputText.value = serializePretty(migrated)
  }
}

const exportPivotLayout = (): void => {
  pivotAdvancedOutputText.value = serializePretty(gridRef.value?.exportPivotLayout() ?? null)
}

const exportPivotInterop = (): void => {
  pivotAdvancedOutputText.value = serializePretty(gridRef.value?.exportPivotInterop() ?? null)
}

const importPivotLayout = (): void => {
  const parsed = parseJson(pivotAdvancedImportText.value)
  if (!parsed) {
    return
  }
  gridRef.value?.importPivotLayout(parsed as DataGridPivotLayoutSnapshot<unknown>)
}

const expandAllGroups = (): void => {
  gridRef.value?.expandAllGroups()
}

const collapseAllGroups = (): void => {
  gridRef.value?.collapseAllGroups()
}
</script>

<style scoped>
.grid-host {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}
</style>
