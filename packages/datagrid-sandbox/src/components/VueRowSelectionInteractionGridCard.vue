<template>
  <article ref="cardRootRef" class="card selection-card affino-datagrid-app-root">
    <header class="card__header">
      <div class="card__title-row">
        <div>
          <h2>Vue: Row Selection Interaction</h2>
          <p class="selection-card__subtitle">
            System row checkboxes and the header select-all control now ride the same <code>cellInteraction</code>
            contract used by authored interactive cells.
          </p>
        </div>
        <div class="mode-badge">Built-in checkbox semantics</div>
      </div>

      <div class="selection-card__filters" role="toolbar" aria-label="Visible row filters">
        <button
          v-for="option in filterOptions"
          :key="option.value"
          type="button"
          class="selection-card__filter"
          :class="{ 'selection-card__filter--active': activeFilter === option.value }"
          @click="activeFilter = option.value"
        >
          {{ option.label }}
        </button>
      </div>

      <div class="meta">
        <span>Visible rows: {{ visibleRows.length }} / {{ rows.length }}</span>
        <span>Selected visible: {{ selectedVisibleRowCount }}</span>
        <span>Total selected: {{ selectedRowIds.length }}</span>
        <span>Use the header checkbox after switching filters</span>
      </div>
    </header>

    <div class="selection-card__surface">
      <DataGrid
        :rows="visibleRows"
        :columns="columns"
        layout-mode="auto-height"
        :min-rows="6"
        :max-rows="9"
        :client-row-model-options="clientRowModelOptions"
        :theme="theme"
        :show-row-index="false"
        row-selection
        :aggregations="false"
        :base-row-height="35"
        row-height-mode="fixed"
        row-hover
        striped-rows
        @row-selection-change="syncSelectedRows"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from "vue"
import { applyGridTheme, industrialNeutralTheme, resolveGridThemeTokens } from "@affino/datagrid-theme"
import { DataGrid, type DataGridAppColumnInput } from "@affino/datagrid-vue-app"

type FilterMode = "all" | "submitted" | "approved" | "needs-action"

interface RowSelectionDemoRow {
  id: string
  employee: string
  team: string
  status: "Submitted" | "Approved" | "Needs action"
  reviewer: string
  hours: number
}

const rows = ref<readonly RowSelectionDemoRow[]>([
  { id: "ts-1001", employee: "Maya Patel", team: "Platform", status: "Submitted", reviewer: "Nora Singh", hours: 38.5 },
  { id: "ts-1002", employee: "Liam Chen", team: "Platform", status: "Approved", reviewer: "Nora Singh", hours: 40 },
  { id: "ts-1003", employee: "Ava Robinson", team: "Finance Ops", status: "Needs action", reviewer: "Elena Costa", hours: 35.5 },
  { id: "ts-1004", employee: "Noah Kim", team: "Finance Ops", status: "Submitted", reviewer: "Elena Costa", hours: 41 },
  { id: "ts-1005", employee: "Sophia Martin", team: "Field Enablement", status: "Approved", reviewer: "Jonas Berg", hours: 39 },
  { id: "ts-1006", employee: "Ethan Walker", team: "Field Enablement", status: "Needs action", reviewer: "Jonas Berg", hours: 33.5 },
])

const filterOptions: ReadonlyArray<{ value: FilterMode; label: string }> = [
  { value: "all", label: "All rows" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "needs-action", label: "Needs action" },
]

const activeFilter = ref<FilterMode>("all")
const selectedRowIds = ref<string[]>([])
const cardRootRef = ref<HTMLElement | null>(null)

const visibleRows = computed<readonly RowSelectionDemoRow[]>(() => {
  switch (activeFilter.value) {
    case "submitted":
      return rows.value.filter(row => row.status === "Submitted")
    case "approved":
      return rows.value.filter(row => row.status === "Approved")
    case "needs-action":
      return rows.value.filter(row => row.status === "Needs action")
    default:
      return rows.value
  }
})

const selectedVisibleRowCount = computed(() => {
  const selectedIds = new Set(selectedRowIds.value)
  return visibleRows.value.filter(row => selectedIds.has(row.id)).length
})

const columns = computed<readonly DataGridAppColumnInput<RowSelectionDemoRow>[]>(() => [
  {
    key: "employee",
    label: "Employee",
    minWidth: 180,
    flex: 1,
    capabilities: { editable: false },
  },
  {
    key: "team",
    label: "Team",
    minWidth: 180,
    flex: 0.9,
    capabilities: { editable: false },
  },
  {
    key: "status",
    label: "Status",
    minWidth: 150,
    flex: 0.8,
    capabilities: { editable: false },
  },
  {
    key: "reviewer",
    label: "Reviewer",
    minWidth: 160,
    flex: 0.9,
    capabilities: { editable: false },
  },
  {
    key: "hours",
    label: "Hours",
    dataType: "number",
    minWidth: 90,
    flex: 0.45,
    capabilities: { editable: false },
    presentation: {
      align: "right",
      headerAlign: "right",
      numberFormat: {
        locale: "en-GB",
        maximumFractionDigits: 1,
      },
    },
  },
])

const clientRowModelOptions = {
  resolveRowId: (row: RowSelectionDemoRow) => row.id,
}

const theme = industrialNeutralTheme
const sandboxThemeTokens = resolveGridThemeTokens(theme)

function syncSelectedRows(payload: {
  snapshot: {
    selectedRows: readonly (string | number)[]
  } | null
}): void {
  selectedRowIds.value = (payload.snapshot?.selectedRows ?? []).map(rowId => String(rowId))
}

watchEffect(() => {
  if (cardRootRef.value) {
    applyGridTheme(cardRootRef.value, sandboxThemeTokens)
  }
})
</script>

<style>
.selection-card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 640px;
}

.selection-card__subtitle {
  margin: 0.35rem 0 0;
  color: #53636c;
  font-size: 0.95rem;
  max-width: 68ch;
}

.selection-card__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 1rem;
}

.selection-card__filter {
  border: 1px solid rgba(123, 143, 156, 0.55);
  background: rgba(245, 247, 248, 0.92);
  color: #29414f;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
}

.selection-card__filter:hover {
  border-color: rgba(60, 99, 122, 0.65);
  background: rgba(235, 242, 246, 0.98);
}

.selection-card__filter--active {
  background: #15394b;
  border-color: #15394b;
  color: #f6fafc;
}

.selection-card__surface {
  min-height: 0;
  border-radius: 1rem;
  overflow: hidden;
}

.selection-card__surface :deep(.affino-datagrid-app-root),
.selection-card__surface :deep(.grid-root),
.selection-card__surface :deep(.grid-viewport),
.selection-card__surface :deep(.grid-pane),
.selection-card__surface :deep(.grid-body-viewport.table-wrap),
.selection-card__surface :deep(.table-wrap),
.selection-card__surface :deep(.grid-body-content),
.selection-card__surface :deep(.grid-pane-content) {
  min-height: 0;
}
</style>