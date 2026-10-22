<template>
  <article ref="cardRootRef" class="card column-selection-card affino-datagrid-app-root">
    <header class="column-selection-card__header">
      <div class="column-selection-card__title-row">
        <div>
          <h2>Vue: Column Selection API</h2>
          <p>
            Use the Vue grid API to keep a separate selection of columns by stable key. This example drives that state
            from application controls; it does not turn the selection into cell ranges.
          </p>
        </div>
        <div class="mode-badge">Core API via Vue</div>
      </div>

      <div class="column-selection-card__controls" role="group" aria-label="Selected columns">
        <label v-for="column in selectableColumns" :key="column.key" class="column-selection-card__option">
          <input
            type="checkbox"
            :data-testid="`column-selection-${column.key}`"
            :checked="selectedColumnKeys.includes(column.key)"
            @change="setColumnSelected(column.key, ($event.target as HTMLInputElement).checked)"
          >
          <span>{{ column.label }}</span>
        </label>
        <button type="button" data-testid="column-selection-preset" @click="selectPreset">
          Select status + owner
        </button>
        <button type="button" data-testid="column-selection-clear" @click="clearSelection">
          Clear
        </button>
      </div>

      <p class="column-selection-card__result" aria-live="polite" data-testid="column-selection-result">
        Selected column keys: {{ selectedColumnKeys.length ? selectedColumnKeys.join(", ") : "none" }}
      </p>
    </header>

    <div class="column-selection-card__surface">
      <TypedDataGrid
        ref="gridRef"
        :rows="rows"
        :columns="columns"
        layout-mode="auto-height"
        :min-rows="5"
        :max-rows="8"
        :client-row-model-options="clientRowModelOptions"
        :theme="theme"
        :aggregations="false"
        :base-row-height="35"
        row-height-mode="fixed"
        row-hover
        striped-rows
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watchEffect } from "vue"
import { applyGridTheme, industrialNeutralTheme, resolveGridThemeTokens } from "@affino/datagrid-theme"
import {
  defineDataGridColumns,
  defineDataGridComponent,
  useDataGridRef,
  type DataGridAppClientRowModelOptions,
} from "@affino/datagrid-vue"

interface ColumnSelectionDemoRow {
  id: string
  employee: string
  team: string
  status: "Ready" | "Review" | "Blocked"
  owner: string
  amount: number
}

const TypedDataGrid = defineDataGridComponent<ColumnSelectionDemoRow>()
const gridRef = useDataGridRef<ColumnSelectionDemoRow>()
const cardRootRef = ref<HTMLElement | null>(null)
const selectedColumnKeys = ref<string[]>([])
const selectableColumns = [
  { key: "employee", label: "Employee" },
  { key: "team", label: "Team" },
  { key: "status", label: "Status" },
  { key: "owner", label: "Owner" },
  { key: "amount", label: "Amount" },
] as const

const rows: readonly ColumnSelectionDemoRow[] = [
  { id: "cs-1001", employee: "Maya Patel", team: "Platform", status: "Ready", owner: "Nora Singh", amount: 1280 },
  { id: "cs-1002", employee: "Liam Chen", team: "Platform", status: "Review", owner: "Nora Singh", amount: 940 },
  { id: "cs-1003", employee: "Ava Robinson", team: "Finance", status: "Blocked", owner: "Elena Costa", amount: 2120 },
  { id: "cs-1004", employee: "Noah Kim", team: "Finance", status: "Ready", owner: "Elena Costa", amount: 1575 },
  { id: "cs-1005", employee: "Sophia Martin", team: "Operations", status: "Review", owner: "Jonas Berg", amount: 860 },
  { id: "cs-1006", employee: "Ethan Walker", team: "Operations", status: "Ready", owner: "Jonas Berg", amount: 1930 },
]

const columns = defineDataGridColumns<ColumnSelectionDemoRow>()([
  { key: "employee", label: "Employee", minWidth: 175, flex: 1.2 },
  { key: "team", label: "Team", minWidth: 140, flex: 0.9 },
  { key: "status", label: "Status", minWidth: 125, flex: 0.8 },
  { key: "owner", label: "Owner", minWidth: 150, flex: 0.95 },
  {
    key: "amount",
    label: "Amount",
    dataType: "number",
    minWidth: 110,
    flex: 0.7,
    presentation: { align: "right", headerAlign: "right", numberFormat: { style: "currency", currency: "USD", maximumFractionDigits: 0 } },
  },
] as const)

const clientRowModelOptions = {
  resolveRowId: row => row.id,
} satisfies DataGridAppClientRowModelOptions<ColumnSelectionDemoRow>

const theme = industrialNeutralTheme
const themeTokens = resolveGridThemeTokens(theme)
let unsubscribeColumnSelection: (() => void) | undefined

function syncSelectedColumns(): void {
  const api = gridRef.value?.getApi()
  if (!api?.columnSelection.hasSupport()) {
    selectedColumnKeys.value = []
    return
  }
  selectedColumnKeys.value = [...api.columnSelection.getSelectedColumns()]
}

function setColumnSelected(columnKey: string, selected: boolean): void {
  gridRef.value?.getApi()?.columnSelection.setSelected(columnKey, selected, { origin: "sandbox-column-picker" })
  syncSelectedColumns()
}

function selectPreset(): void {
  gridRef.value?.getApi()?.columnSelection.selectColumns(["status", "owner"], { origin: "sandbox-column-picker" })
  syncSelectedColumns()
}

function clearSelection(): void {
  gridRef.value?.getApi()?.columnSelection.clear({ origin: "sandbox-column-picker" })
  syncSelectedColumns()
}

onMounted(() => {
  const api = gridRef.value?.getApi()
  if (api?.columnSelection.hasSupport()) {
    unsubscribeColumnSelection = api.events.on("column-selection:changed", event => {
      selectedColumnKeys.value = [...(event.snapshot?.selectedColumnKeys ?? [])]
    })
    syncSelectedColumns()
  }
})

onBeforeUnmount(() => unsubscribeColumnSelection?.())

watchEffect(() => {
  if (cardRootRef.value) applyGridTheme(cardRootRef.value, themeTokens)
})
</script>

<style scoped>
.column-selection-card { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 640px; }
.column-selection-card__title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.column-selection-card__title-row h2 { margin: 0; }
.column-selection-card__title-row p { max-width: 75ch; margin: 8px 0 0; color: #53636c; }
.column-selection-card__controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 18px; }
.column-selection-card__option { display: inline-flex; align-items: center; gap: 6px; }
.column-selection-card__controls button { border: 1px solid rgba(123, 143, 156, 0.55); border-radius: 6px; background: rgba(245, 247, 248, 0.92); color: #29414f; padding: 6px 10px; font: inherit; cursor: pointer; }
.column-selection-card__controls button:hover { background: rgba(235, 242, 246, 0.98); }
.column-selection-card__result { margin: 12px 0 16px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.column-selection-card__surface { min-height: 0; }
.column-selection-card__surface :deep(.affino-datagrid-app-root),
.column-selection-card__surface :deep(.grid-root),
.column-selection-card__surface :deep(.grid-viewport),
.column-selection-card__surface :deep(.grid-body-viewport.table-wrap) { min-height: 0; }
</style>
