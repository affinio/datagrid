<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue"
import { DataGrid } from "@affino/datagrid-vue-app"
import { createDataSourceBackedRowModel } from "@affino/datagrid-vue"
import {
  createBackendDataSource,
  forecastColumns,
  forecastRows,
  revenueColumns,
  revenueRows,
  scaleColumns,
  scaleRows,
  type ScenarioId,
} from "./showcaseData"

const scenarios: Array<{
  id: ScenarioId
  label: string
  eyebrow: string
  title: string
  description: string
  primaryMetricLabel: string
  primaryMetric: string
  secondaryMetricLabel: string
  secondaryMetric: string
  accent: string
}> = [
  {
    id: "scale",
    label: "Huge operations table",
    eyebrow: "Performance",
    title: "100k-row service operations grid",
    description: "Virtualized local data for high-density operational screens with pinned columns, menus, quick filter, fill, range move, and row selection.",
    primaryMetricLabel: "Rows",
    primaryMetric: "100,000",
    secondaryMetricLabel: "Columns",
    secondaryMetric: String(scaleColumns.length),
    accent: "Virtualized",
  },
  {
    id: "backend",
    label: "Backend-owned model",
    eyebrow: "Server datasource",
    title: "250k-row backend datasource workbench",
    description: "A sparse server-owned row model pulls only the viewport window and column-menu histograms instead of loading the full dataset into the browser.",
    primaryMetricLabel: "Server rows",
    primaryMetric: "250,000",
    secondaryMetricLabel: "Pull mode",
    secondaryMetric: "Viewport",
    accent: "Backend-owned",
  },
  {
    id: "spreadsheet",
    label: "Spreadsheet formulas",
    eyebrow: "Spreadsheet workflow",
    title: "Revenue forecast sheet with formulas",
    description: "Editable inputs drive computed subtotal, tax, total, margin, and margin percent columns using the formula runtime inside a product grid.",
    primaryMetricLabel: "Formula columns",
    primaryMetric: "5",
    secondaryMetricLabel: "Editable inputs",
    secondaryMetric: "5",
    accent: "Formula runtime",
  },
  {
    id: "filters",
    label: "Advanced filter review",
    eyebrow: "Decision workflow",
    title: "Renewal risk review with advanced filters",
    description: "A realistic account-review table with advanced filter, column menus, quick filter, selection, and stateful grid UX enabled together.",
    primaryMetricLabel: "Accounts",
    primaryMetric: "1,200",
    secondaryMetricLabel: "Risk cases",
    secondaryMetric: String(revenueRows.filter(row => row.risk !== "Low").length),
    accent: "Advanced filters",
  },
]

const activeScenarioId = ref<ScenarioId>("scale")
const fallbackScenario = scenarios[0]!
const activeScenario = computed(() => scenarios.find(scenario => scenario.id === activeScenarioId.value) ?? fallbackScenario)

const backendRowModel = createDataSourceBackedRowModel({
  dataSource: createBackendDataSource(),
  initialTotal: 250_000,
  prefetch: { enabled: true },
})

onBeforeUnmount(() => {
  backendRowModel.dispose()
})

const activeRows = computed(() => {
  if (activeScenarioId.value === "spreadsheet") {
    return forecastRows
  }
  if (activeScenarioId.value === "filters") {
    return revenueRows
  }
  return scaleRows
})

const activeColumns = computed(() => {
  if (activeScenarioId.value === "spreadsheet") {
    return forecastColumns
  }
  if (activeScenarioId.value === "filters") {
    return revenueColumns
  }
  return scaleColumns
})

const useBackendModel = computed(() => activeScenarioId.value === "backend")
const showAdvancedFilter = computed(() => activeScenarioId.value === "filters" || activeScenarioId.value === "backend")
const showFormulaChrome = computed(() => activeScenarioId.value === "spreadsheet")

const gridKey = computed(() => activeScenarioId.value)
</script>

<template>
  <main class="showcase-shell">
    <aside class="showcase-sidebar" aria-label="Workspace navigation">
      <div class="showcase-brand">
        <span class="showcase-brand__mark">A</span>
        <div>
          <strong>Affino Grid</strong>
          <span>Product showcase</span>
        </div>
      </div>

      <nav class="showcase-nav" aria-label="Showcase scenarios">
        <button
          v-for="scenario in scenarios"
          :key="scenario.id"
          :class="{ active: activeScenarioId === scenario.id }"
          type="button"
          @click="activeScenarioId = scenario.id"
        >
          <span>{{ scenario.accent }}</span>
          {{ scenario.label }}
        </button>
      </nav>
    </aside>

    <section class="showcase-main" aria-labelledby="showcase-title">
      <header class="showcase-header">
        <div>
          <p>{{ activeScenario.eyebrow }}</p>
          <h1 id="showcase-title">{{ activeScenario.title }}</h1>
          <span>{{ activeScenario.description }}</span>
        </div>
        <div class="showcase-header__actions">
          <button type="button">Export view</button>
          <button class="primary" type="button">Review changes</button>
        </div>
      </header>

      <section class="showcase-metrics" aria-label="Scenario summary">
        <article>
          <span>{{ activeScenario.primaryMetricLabel }}</span>
          <strong>{{ activeScenario.primaryMetric }}</strong>
        </article>
        <article>
          <span>{{ activeScenario.secondaryMetricLabel }}</span>
          <strong>{{ activeScenario.secondaryMetric }}</strong>
        </article>
        <article>
          <span>Grid UX</span>
          <strong>{{ showFormulaChrome ? "Formulas" : showAdvancedFilter ? "Filters" : "Virtual" }}</strong>
        </article>
        <article>
          <span>Data ownership</span>
          <strong>{{ useBackendModel ? "Server" : "Client" }}</strong>
        </article>
      </section>

      <section class="showcase-grid-panel" aria-label="Affino DataGrid showcase">
        <DataGrid
          v-if="useBackendModel"
          :key="gridKey"
          :row-model="backendRowModel"
          :columns="scaleColumns"
          virtualization
          column-menu
          quick-filter
          :advanced-filter="showAdvancedFilter"
          row-selection
          row-hover
          striped-rows
          grid-lines="rows"
          theme="default"
        />
        <DataGrid
          v-else
          :key="gridKey"
          :rows="activeRows"
          :columns="activeColumns"
          virtualization
          column-menu
          quick-filter
          :advanced-filter="showAdvancedFilter"
          fill-handle
          range-move
          row-selection
          row-hover
          striped-rows
          grid-lines="rows"
          theme="default"
        />
      </section>
    </section>
  </main>
</template>
