<template>
  <article class="card">
    <header class="card__header">
      <div class="card__title-row">
        <h2>Vue: Base Grid (Factory)</h2>
        <div class="mode-badge">Base</div>
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
          Render
          <select v-model="appSchema.grid.renderMode">
            <option value="virtualization">Virtualization</option>
            <option value="pagination">Pagination</option>
          </select>
        </label>

        <label>
          Page size
          <input
            v-model.number="appSchema.grid.pagination.pageSize"
            type="number"
            min="1"
            step="1"
          />
        </label>

        <label>
          Page
          <input
            v-model.number="appSchema.grid.pagination.currentPage"
            type="number"
            min="1"
            step="1"
          />
        </label>

        <div>
          <span>Navigate</span>
          <button
            type="button"
            :disabled="appSchema.grid.pagination.currentPage <= 1"
            @click="goToPreviousPage"
          >
            Prev
          </button>
          <button
            type="button"
            @click="goToNextPage"
          >
            Next
          </button>
        </div>
      </div>

      <ColumnLayoutPanel
        v-if="appSchema.panels.columnVisibility"
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
        v-if="appSchema.panels.diagnostics"
        :is-open="isDiagnosticsPanelOpen"
        :snapshot="diagnosticsSnapshot"
        @open="openDiagnosticsPanel"
        @refresh="refreshDiagnosticsPanel"
        @close="closeDiagnosticsPanel"
      />

      <AdvancedFilterPanel
        v-if="appSchema.panels.advancedFilter"
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
        <span>Rows in model: {{ rows.length }}</span>
        <span>Columns: {{ columns.length }}</span>
        <span>Last event: {{ lastEvent }}</span>
      </div>
    </header>

    <section class="grid-stage">
      <DataGrid
        :rows="rows"
        :columns="columns"
        :features="appSchema.grid.features"
        :render-mode="appSchema.grid.renderMode"
        :pagination="appSchema.grid.pagination"
        :column-policies="appSchema.grid.columnPolicies"
        theme="light"
        @cell-change="handleCellChange"
        @selection-change="handleSelectionChange"
        @row-select="handleRowSelect"
        ref="dataGridRef"
      />
    </section>

    <footer class="card__footer">
      Factory mode: same base dataset with new DataGrid component plugin setup.
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import DataGrid from "@affino/datagrid-vue/components/DataGrid.vue"
import type { DataGridApi } from "@affino/datagrid-core"
import {
  buildVueColumns,
  buildVueRows,
  COLUMN_MODE_OPTIONS,
  ROW_MODE_OPTIONS,
} from "../sandboxData"
import AdvancedFilterPanel from "./AdvancedFilterPanel.vue"
import ColumnLayoutPanel from "./ColumnLayoutPanel.vue"
import DiagnosticsPanel from "./DiagnosticsPanel.vue"
import { useAdvancedFilterBuilder } from "../composables/useAdvancedFilterBuilder"
import { useColumnLayoutPanel } from "../composables/useColumnLayoutPanel"
import { useDiagnosticsPanel } from "../composables/useDiagnosticsPanel"

type DataGridFeatureName =
  | "selection"
  | "clipboard"
  | "fill"
  | "navigation"
  | "history"
  | "rangeMove"
  | "pointerPreview"
  | "autoScroll"
  | "resize"

interface DataGridExpose {
  api: DataGridApi<unknown>
}

const rowCount = ref<number>(10000)
const columnCount = ref<number>(16)
const lastEvent = ref<string>("—")
const dataGridRef = ref<DataGridExpose | null>(null)

const appSchema = ref<{
  grid: {
    renderMode: "virtualization" | "pagination"
    features: readonly DataGridFeatureName[]
    pagination: {
      pageSize: number
      currentPage: number
    }
    columnPolicies: Readonly<Record<string, {
      readOnly?: boolean
      maxWidth?: number
      type?: "text" | "number" | "date" | "boolean"
    }>>
  }
  panels: {
    columnVisibility: boolean
    diagnostics: boolean
    advancedFilter: boolean
  }
}>({
  grid: {
    renderMode: "virtualization",
    features: [
      "selection",
      "clipboard",
      "fill",
      "navigation",
      "history",
      "rangeMove",
      "pointerPreview",
      "autoScroll",
      "resize",
    ],
    pagination: {
      pageSize: 200,
      currentPage: 1,
    },
    columnPolicies: {
      id: {
        readOnly: true,
        maxWidth: 96,
      },
    },
  },
  panels: {
    columnVisibility: true,
    diagnostics: true,
    advancedFilter: true,
  },
})

watch(
  () => appSchema.value.grid.pagination.pageSize,
  nextValue => {
    const normalized = Number.isFinite(nextValue) ? Math.max(1, Math.trunc(nextValue)) : 1
    if (normalized !== nextValue) {
      appSchema.value.grid.pagination.pageSize = normalized
    }
  },
)

watch(
  () => appSchema.value.grid.pagination.currentPage,
  nextValue => {
    const normalized = Number.isFinite(nextValue) ? Math.max(1, Math.trunc(nextValue)) : 1
    if (normalized !== nextValue) {
      appSchema.value.grid.pagination.currentPage = normalized
    }
  },
)

const rows = computed(() => buildVueRows("base", rowCount.value, columnCount.value))
const columns = computed(() => buildVueColumns("base", columnCount.value))

const runtimeApi = computed<DataGridApi<unknown> | null>(() => dataGridRef.value?.api ?? null)

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
} = useAdvancedFilterBuilder({
  resolveColumns: () => {
    const snapshot = runtimeApi.value?.columns.getSnapshot()
    return (snapshot?.visibleColumns ?? []).map(column => ({
      key: column.key,
      label: column.column.label ?? column.key,
    }))
  },
})

watch(appliedAdvancedFilterExpression, nextExpression => {
  const api = runtimeApi.value
  if (!api) {
    return
  }

  api.rows.setSortAndFilterModel({
    sortModel: [],
    filterModel: nextExpression
      ? {
          columnFilters: {},
          advancedFilters: {},
          advancedExpression: nextExpression,
        }
      : null,
  })
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
} = useColumnLayoutPanel({
  resolveColumns: () => {
    const snapshot = runtimeApi.value?.columns.getSnapshot()
    if (!snapshot) {
      return []
    }
    return snapshot.columns.map(column => ({
      key: column.key,
      label: column.column.label ?? column.key,
      visible: column.visible,
    }))
  },
  applyColumnLayout: payload => {
    const api = runtimeApi.value
    if (!api) {
      return
    }
    api.columns.setOrder(payload.order)
    for (const [key, visible] of Object.entries(payload.visibilityByKey)) {
      api.columns.setVisibility(key, visible)
    }
  },
})

const {
  isDiagnosticsPanelOpen,
  diagnosticsSnapshot,
  openDiagnosticsPanel,
  closeDiagnosticsPanel,
  refreshDiagnosticsPanel,
} = useDiagnosticsPanel({
  readDiagnostics: () => runtimeApi.value?.diagnostics.getAll() ?? null,
})

const handleCellChange = (): void => {
  lastEvent.value = "cell-change"
}

const handleSelectionChange = (): void => {
  lastEvent.value = "selection-change"
}

const handleRowSelect = (): void => {
  lastEvent.value = "row-select"
}

const goToPreviousPage = (): void => {
  appSchema.value.grid.pagination.currentPage = Math.max(1, appSchema.value.grid.pagination.currentPage - 1)
}

const goToNextPage = (): void => {
  appSchema.value.grid.pagination.currentPage += 1
}
</script>
