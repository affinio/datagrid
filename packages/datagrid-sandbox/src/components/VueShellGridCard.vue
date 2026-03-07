<template>
  <article class="card shell-card">
    <header class="card__header shell-card__header">
      <div class="card__title-row">
        <div>
          <h2>{{ title }}</h2>
          <p class="shell-card__subtitle">
            Clean Vue wrapper powered by <strong>useAffinoDataGridUi</strong> with built-in formulas.
          </p>
        </div>
        <div class="mode-badge">Shell · {{ modeBadge }}</div>
      </div>

      <div class="controls shell-card__controls">
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
          <input v-model.number="paginationPage" type="number" min="1" step="1" />
        </label>

        <label v-if="props.mode === 'base'">
          Group by
          <select v-model="groupByField">
            <option value="">None</option>
            <option v-for="column in groupableColumns" :key="column.key" :value="column.key">
              {{ column.label }}
            </option>
          </select>
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
            <option value="department-month-weighted">Department × Month</option>
            <option value="status-channel-count">Status × Channel</option>
            <option value="month-department-deals">Month × Department</option>
          </select>
        </label>
      </div>

      <div class="shell-card__toolbar">
        <button
          v-for="action in grid.ui.toolbarActions.value"
          :key="action.id"
          type="button"
          v-bind="grid.ui.bindToolbarAction(action.id)"
        >
          {{ action.label }}
        </button>
        <button type="button" @click="applySamplePatch">Patch sample rows</button>
        <button type="button" @click="recomputeFormulas">Recompute formulas</button>
        <button type="button" @click="resetDataset">Reset data</button>
        <button v-if="props.mode !== 'base'" type="button" @click="grid.api.rows.expandAllGroups()">Expand all</button>
        <button v-if="props.mode !== 'base'" type="button" @click="grid.api.rows.collapseAllGroups()">Collapse all</button>
      </div>

      <div class="meta shell-card__meta">
        <span>Visible rows: {{ rowSnapshot.rowCount }}</span>
        <span v-if="paginationSummary">{{ paginationSummary }}</span>
        <span>Formula fields: {{ grid.formulas.formulaFields.value.length }}</span>
        <span>Compute strategy: {{ grid.formulas.computeStage.value?.strategy ?? '—' }}</span>
        <span>Dirty nodes: {{ dirtyNodesLabel }}</span>
      </div>

      <div class="meta shell-card__meta">
        <span>Plan nodes: {{ grid.formulas.executionPlan.value?.order.length ?? 0 }}</span>
        <span>Levels: {{ grid.formulas.executionPlan.value?.levels.length ?? 0 }}</span>
        <span>Functions: {{ grid.formulas.functionNames.value.length }}</span>
        <span>Status: {{ grid.ui.status.value }}</span>
      </div>
    </header>

    <section class="grid-stage shell-card__stage">
      <component
        :is="grid.DataGrid"
        v-bind="grid.componentProps.value"
        :features="componentFeatures"
        :render-mode="resolvedRenderMode"
        theme="light"
      />
    </section>

    <footer class="card__footer shell-card__footer">
      End-user shell API now covers base, tree, pivot, and formula diagnostics on one clean wrapper.
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import type {
  DataGridColumnDef,
  DataGridFormulaFieldDefinition,
  DataGridPivotSpec,
} from "@affino/datagrid-vue"
import type { DataGridRowModelSnapshot } from "@affino/datagrid-core"
import { useAffinoDataGridUi } from "@affino/datagrid-vue"
import {
  buildVueColumns,
  buildVueRows,
  COLUMN_MODE_OPTIONS,
  ROW_MODE_OPTIONS,
  type VueSandboxRow,
  type VueTreeRow,
} from "../sandboxData"

type ShellMode = "base" | "tree" | "pivot"
type RowRenderMode = "virtualization" | "pagination"
type PivotLayoutKey = "department-month-weighted" | "status-channel-count" | "month-department-deals"

const props = defineProps<{
  title: string
  mode: ShellMode
}>()

const rowCount = ref<number>(10000)
const columnCount = ref<number>(16)
const datasetRevision = ref(0)
const patchRevision = ref(0)
const rowRenderMode = ref<RowRenderMode>("virtualization")
const paginationPageSize = ref<number>(100)
const paginationPage = ref<number>(1)
const groupByField = ref<string>("")
const pivotViewMode = ref<"pivot" | "table">("pivot")
const pivotLayout = ref<PivotLayoutKey>("department-month-weighted")

const FORMULA_COLUMNS_BY_MODE: Record<ShellMode, readonly DataGridColumnDef[]> = {
  base: [
    { key: "lineTotal", label: "Line total" },
    { key: "priorityScore", label: "Priority score" },
  ],
  tree: [
    { key: "loadScore", label: "Load score" },
    { key: "slaRisk", label: "SLA risk" },
  ],
  pivot: [
    { key: "weightedRevenue", label: "Weighted revenue" },
    { key: "revenuePerDeal", label: "Revenue / deal" },
  ],
}

const FORMULAS_BY_MODE: Record<ShellMode, readonly DataGridFormulaFieldDefinition[]> = {
  base: [
    { name: "lineTotal", formula: "amount * qty" },
    { name: "priorityScore", formula: "IF(status == 'done', lineTotal, lineTotal + qty * 10)" },
  ],
  tree: [
    { name: "loadScore", formula: "amount * 2" },
    { name: "slaRisk", formula: "IF(severity == 'S1', loadScore * 2, IF(severity == 'S2', loadScore * 1.5, loadScore))" },
  ],
  pivot: [
    { name: "weightedRevenue", formula: "IF(status == 'done', amount, amount * 0.8)" },
    { name: "revenuePerDeal", formula: "amount / deals" },
  ],
}

const PIVOT_LAYOUTS: Record<PivotLayoutKey, DataGridPivotSpec> = {
  "department-month-weighted": {
    rows: ["department"],
    columns: ["month"],
    values: [{ field: "weightedRevenue", agg: "sum" }],
  },
  "status-channel-count": {
    rows: ["status"],
    columns: ["channel"],
    values: [{ field: "id", agg: "count" }],
  },
  "month-department-deals": {
    rows: ["month"],
    columns: ["department"],
    values: [{ field: "deals", agg: "sum" }],
  },
}

const rows = computed<readonly VueSandboxRow[]>(() => {
  datasetRevision.value
  return buildVueRows(props.mode, rowCount.value, columnCount.value)
})

const columns = computed<readonly DataGridColumnDef[]>(() => [
  ...buildVueColumns(props.mode, columnCount.value),
  ...FORMULA_COLUMNS_BY_MODE[props.mode],
])

const grid = useAffinoDataGridUi<VueSandboxRow>({
  rows,
  columns,
  clientRowModelOptions: {
    ...(props.mode === "tree"
      ? {
        initialTreeData: {
          mode: "path" as const,
          getDataPath: (row: VueSandboxRow) => (row as VueTreeRow).path,
          filterMode: "include-descendants" as const,
        },
      }
      : {}),
    ...(props.mode === "pivot"
      ? {
        initialPivotModel: PIVOT_LAYOUTS[pivotLayout.value],
      }
      : {}),
    initialFormulaFields: FORMULAS_BY_MODE[props.mode],
  },
  features: {
    interactions: true,
    headerFilters: true,
    feedback: true,
    statusBar: true,
    selection: true,
    clipboard: true,
    editing: {
      enabled: true,
      mode: "cell",
    },
    tree: {
      enabled: true,
    },
    rowHeight: props.mode === "base"
      ? {
        enabled: true,
        mode: "fixed",
        base: 31,
      }
      : false,
  },
  initialStatus: `Shell ready: ${props.mode}`,
})

const rowSnapshot = ref<DataGridRowModelSnapshot<VueSandboxRow>>(grid.rowModel.getSnapshot())
const unsubscribeRowModel = grid.rowModel.subscribe(snapshot => {
  rowSnapshot.value = snapshot
  if (snapshot.pagination.enabled) {
    paginationPage.value = snapshot.pagination.currentPage + 1
  }
})

onBeforeUnmount(() => {
  unsubscribeRowModel()
})

const componentFeatures = [
  "selection",
  "clipboard",
  "fill",
  "navigation",
  "history",
  "rangeMove",
  "pointerPreview",
  "autoScroll",
  "resize",
] as const

const modeBadge = computed(() => {
  if (props.mode === "tree") {
    return "Tree"
  }
  if (props.mode === "pivot") {
    return "Pivot"
  }
  return "Base"
})

const groupableColumns = computed(() => columns.value
  .filter(column => !FORMULA_COLUMNS_BY_MODE[props.mode].some(formulaColumn => formulaColumn.key === column.key))
  .map(column => ({ key: column.key, label: column.label ?? column.key })))

const resolvedRenderMode = computed<RowRenderMode>(() => (
  props.mode === "base" ? rowRenderMode.value : "virtualization"
))

const paginationSummary = computed(() => {
  const snapshot = rowSnapshot.value.pagination
  if (!snapshot.enabled) {
    return null
  }
  return `Page ${snapshot.currentPage + 1}/${snapshot.pageCount} · size ${snapshot.pageSize}`
})

const dirtyNodesLabel = computed(() => {
  const dirtyNodes = grid.formulas.computeStage.value?.dirtyNodes ?? []
  if (dirtyNodes.length === 0) {
    return "—"
  }
  return dirtyNodes.slice(0, 4).join(", ") + (dirtyNodes.length > 4 ? ` +${dirtyNodes.length - 4}` : "")
})

watch(groupByField, nextField => {
  if (props.mode !== "base") {
    return
  }
  grid.features.tree.setGroupBy(nextField
    ? { fields: [nextField], expandedByDefault: true }
    : null)
}, { immediate: true })

watch([rowRenderMode, paginationPageSize, paginationPage], () => {
  if (props.mode !== "base") {
    grid.pagination.set(null)
    return
  }
  if (rowRenderMode.value === "pagination") {
    const nextPageSize = Math.max(1, Math.trunc(paginationPageSize.value || 1))
    const nextPage = Math.max(1, Math.trunc(paginationPage.value || 1))
    paginationPageSize.value = nextPageSize
    paginationPage.value = nextPage
    grid.pagination.set({
      pageSize: nextPageSize,
      currentPage: nextPage - 1,
    })
    return
  }
  grid.pagination.set(null)
}, { immediate: true })

watch([pivotLayout, pivotViewMode], () => {
  if (props.mode !== "pivot") {
    return
  }
  grid.setPivotModel(
    pivotViewMode.value === "pivot"
      ? PIVOT_LAYOUTS[pivotLayout.value]
      : null,
  )
  grid.api.rows.expandAllGroups()
}, { immediate: true })

const applySamplePatch = (): void => {
  patchRevision.value += 1
  const patchSize = Math.min(24, rows.value.length)
  const updates = rows.value.slice(0, patchSize).map((row, index) => {
    const amount = Number(row.amount ?? 0)
    const qty = Number((row as Record<string, unknown>).qty ?? 1)
    const deals = Number((row as Record<string, unknown>).deals ?? 1)
    return {
      rowId: row.rowId,
      data: {
        amount: amount + patchRevision.value * 5 + index,
        qty: qty + ((patchRevision.value + index) % 3),
        deals: Math.max(1, deals + ((patchRevision.value + index) % 2)),
      } as Partial<VueSandboxRow>,
    }
  })
  grid.patchRows(updates, {
    recomputeSort: false,
    recomputeFilter: false,
    recomputeGroup: false,
  })
  grid.ui.setStatus(`Patched ${updates.length} rows in shell mode`)
}

const recomputeFormulas = (): void => {
  const changed = grid.formulas.recompute()
  grid.ui.setStatus(`Formula recompute touched ${changed} rows`)
}

const resetDataset = (): void => {
  datasetRevision.value += 1
  patchRevision.value = 0
  paginationPage.value = 1
  groupByField.value = ""
  grid.features.tree.clearGroupBy()
  if (props.mode === "pivot") {
    grid.setPivotModel(pivotViewMode.value === "pivot" ? PIVOT_LAYOUTS[pivotLayout.value] : null)
  }
  grid.ui.setStatus(`Dataset reset for ${props.mode} shell`) 
}
</script>

<style scoped>
.shell-card__header {
  gap: 0.9rem;
}

.shell-card__subtitle {
  margin: 0.35rem 0 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.92rem;
}

.shell-card__controls {
  flex-wrap: wrap;
}

.shell-card__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.shell-card__toolbar button {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  border-radius: 10px;
  padding: 0.45rem 0.75rem;
  cursor: pointer;
}

.shell-card__toolbar button:hover {
  background: rgba(255, 255, 255, 0.12);
}

.shell-card__meta {
  flex-wrap: wrap;
  gap: 0.85rem;
}

.shell-card__stage {
  min-height: 720px;
}

.shell-card__footer {
  opacity: 0.8;
}
</style>
