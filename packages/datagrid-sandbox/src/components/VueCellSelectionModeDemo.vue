<template>
  <article ref="cardRootRef" class="card cell-selection-demo affino-datagrid-app-root">
    <header class="card__header">
      <div class="card__title-row">
        <div>
          <h2>Vue: Cell Selection Mode</h2>
          <p class="cell-selection-demo__subtitle">
            Compare cell range selection on and off through the public DataGrid prop.
          </p>
        </div>
        <div class="mode-badge">Public Vue API</div>
      </div>

      <div class="cell-selection-demo__controls">
        <label>
          <input v-model="enableCellSelection" type="checkbox">
          Enable cell selection
        </label>
        <span role="status" aria-live="polite">
          {{ enableCellSelection ? "Cell selection is enabled" : "Cell selection is disabled; keyboard focus remains available" }}
        </span>
      </div>
      <p class="cell-selection-demo__help">
        With selection enabled, click or drag across cells, use Shift+Arrow, or press Ctrl/Cmd+A.
        Turn it off to clear the range and highlight the active row, then try sorting, keyboard navigation, and text selection.
      </p>
    </header>

    <section class="cell-selection-demo__grid" aria-label="Cell selection example grid">
      <TypedDataGrid
        :rows="rows"
        :columns="columns"
        :enable-cell-selection="enableCellSelection"
        :row-selection="false"
        :show-row-index="false"
        layout-mode="auto-height"
        :min-rows="8"
        :max-rows="8"
        :base-row-height="38"
        row-height-mode="fixed"
      />
    </section>
  </article>
</template>

<script setup lang="ts">
import { ref, watchEffect } from "vue"
import { applyGridTheme, industrialNeutralTheme, resolveGridThemeTokens } from "@affino/datagrid-theme"
import { defineDataGridColumns, defineDataGridComponent } from "@affino/datagrid-vue"

interface CellSelectionDemoRow {
  rowId: string
  item: string
  region: string
  owner: string
  status: string
  units: number
  revenue: number
}

const TypedDataGrid = defineDataGridComponent<CellSelectionDemoRow>()
const enableCellSelection = ref(true)
const cardRootRef = ref<HTMLElement | null>(null)
const rows: readonly CellSelectionDemoRow[] = [
  { rowId: "d-101", item: "Aster Desk Lamp", region: "North", owner: "Maya Patel", status: "In stock", units: 84, revenue: 12600 },
  { rowId: "d-102", item: "Birch Monitor Stand", region: "West", owner: "Liam Chen", status: "Low stock", units: 17, revenue: 4930 },
  { rowId: "d-103", item: "Cedar Notebook Set", region: "East", owner: "Ava Robinson", status: "In stock", units: 132, revenue: 2640 },
  { rowId: "d-104", item: "Dune Travel Mug", region: "South", owner: "Noah Kim", status: "Back order", units: 0, revenue: 0 },
  { rowId: "d-105", item: "Elm Wireless Mouse", region: "North", owner: "Sophia Martin", status: "In stock", units: 61, revenue: 5490 },
  { rowId: "d-106", item: "Flint USB Hub", region: "West", owner: "Ethan Walker", status: "In stock", units: 45, revenue: 3825 },
  { rowId: "d-107", item: "Grove Task Chair", region: "East", owner: "Nora Singh", status: "Low stock", units: 9, revenue: 3591 },
  { rowId: "d-108", item: "Harbor Keyboard", region: "South", owner: "Elena Costa", status: "In stock", units: 73, revenue: 8760 },
]

const columns = defineDataGridColumns<CellSelectionDemoRow>()([
  { key: "item", label: "Item", field: "item", minWidth: 180, flex: 1 },
  { key: "region", label: "Region", field: "region", minWidth: 110, flex: 0.6 },
  { key: "owner", label: "Owner", field: "owner", minWidth: 145, flex: 0.8 },
  { key: "status", label: "Status", field: "status", minWidth: 120, flex: 0.65 },
  { key: "units", label: "Units", field: "units", dataType: "number", minWidth: 90, flex: 0.45 },
  { key: "revenue", label: "Revenue", field: "revenue", dataType: "number", minWidth: 110, flex: 0.55 },
] as const)

const themeTokens = resolveGridThemeTokens(industrialNeutralTheme)
watchEffect(() => {
  if (cardRootRef.value) applyGridTheme(cardRootRef.value, themeTokens)
})
</script>

<style>
.cell-selection-demo {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 640px;
}

.cell-selection-demo__subtitle,
.cell-selection-demo__help {
  margin: 0.35rem 0 0;
  color: var(--datagrid-muted-text-color, #53636c);
  font-size: 0.9rem;
  line-height: 1.45;
}

.cell-selection-demo__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-top: 0.9rem;
  font-size: 0.9rem;
}

.cell-selection-demo__controls label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 600;
}

.cell-selection-demo__grid {
  min-height: 0;
  margin-top: 1rem;
}
</style>
