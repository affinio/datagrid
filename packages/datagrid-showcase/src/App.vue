<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue"
import { DataGrid, type DataGridExposed } from "@affino/datagrid-vue-app"
import { createDataSourceBackedRowModel, type DataGridAggregationModel, type DataGridPivotSpec } from "@affino/datagrid-vue"
import {
  aggregationColumns,
  createBackendDataSource,
  forecastColumns,
  forecastRows,
  pivotColumns,
  planningColumns,
  planningRows,
  revenueColumns,
  revenueRows,
  scaleColumns,
  scaleRows,
  treeColumns,
  treeRows,
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
  {
    id: "aggregation",
    label: "Aggregation groups",
    eyebrow: "Aggregation",
    title: "Regional revenue rollup with grouped totals",
    description: "Grouped account data with aggregation-backed parent rows for revenue, margin, and portfolio review workflows.",
    primaryMetricLabel: "Groups",
    primaryMetric: "Region + stage",
    secondaryMetricLabel: "Measures",
    secondaryMetric: "ARR + margin",
    accent: "Aggregation",
  },
  {
    id: "pivot",
    label: "Pivot analysis",
    eyebrow: "Pivot",
    title: "Revenue pivot by owner and region",
    description: "Pivoted account data turns operational rows into an analytical matrix without leaving the DataGrid surface.",
    primaryMetricLabel: "Rows",
    primaryMetric: "Owner",
    secondaryMetricLabel: "Columns",
    secondaryMetric: "Region",
    accent: "Pivot",
  },
  {
    id: "tree",
    label: "Tree portfolio",
    eyebrow: "Tree view",
    title: "Hierarchical account portfolio",
    description: "Intrinsic hierarchy groups accounts by region, segment, owner, and account while preserving grid selection and filtering.",
    primaryMetricLabel: "Hierarchy",
    primaryMetric: "4 levels",
    secondaryMetricLabel: "Accounts",
    secondaryMetric: String(treeRows.length),
    accent: "Tree data",
  },
  {
    id: "gantt",
    label: "Gantt planning",
    eyebrow: "Planning",
    title: "Launch plan with dependencies and baselines",
    description: "A Gantt view over the same DataGrid app shell shows timelines, dependencies, progress, baselines, and critical-path work.",
    primaryMetricLabel: "Tasks",
    primaryMetric: String(planningRows.length),
    secondaryMetricLabel: "View",
    secondaryMetric: "Gantt",
    accent: "Gantt",
  },
]

const activeScenarioId = ref<ScenarioId>("scale")
const aggregationViewMode = ref<"table" | "aggregation">("aggregation")
const pivotViewMode = ref<"table" | "pivot">("pivot")
const gridRef = ref<DataGridExposed | null>(null)
const selectionSummary = ref("Select cells to see summary")
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
  if (activeScenarioId.value === "tree") {
    return treeRows
  }
  if (activeScenarioId.value === "gantt") {
    return planningRows
  }
  if (["filters", "aggregation", "pivot"].includes(activeScenarioId.value)) {
    return revenueRows
  }
  return scaleRows
})

const activeColumns = computed(() => {
  if (activeScenarioId.value === "spreadsheet") {
    return forecastColumns
  }
  if (activeScenarioId.value === "tree") {
    return treeColumns
  }
  if (activeScenarioId.value === "gantt") {
    return planningColumns
  }
  if (activeScenarioId.value === "aggregation") {
    return aggregationViewMode.value === "aggregation" ? aggregationColumns : revenueColumns
  }
  if (activeScenarioId.value === "pivot") {
    return pivotViewMode.value === "pivot" ? pivotColumns : revenueColumns
  }
  if (activeScenarioId.value === "filters") {
    return revenueColumns
  }
  return scaleColumns
})

const useBackendModel = computed(() => activeScenarioId.value === "backend")
const showAdvancedFilter = computed(() => activeScenarioId.value === "filters" || activeScenarioId.value === "backend")
const showFormulaChrome = computed(() => activeScenarioId.value === "spreadsheet")
const showSelectionSummary = computed(() => activeScenarioId.value === "scale")
const showAggregationModeControl = computed(() => activeScenarioId.value === "aggregation")
const showPivotModeControl = computed(() => activeScenarioId.value === "pivot")
const showHeaderActions = computed(() => showAggregationModeControl.value || showPivotModeControl.value)
const gridUxLabel = computed(() => {
  if (showFormulaChrome.value) return "Formulas"
  if (showAdvancedFilter.value) return "Filters"
  if (activeScenarioId.value === "aggregation") return aggregationViewMode.value === "aggregation" ? "Rollups" : "Table"
  if (activeScenarioId.value === "pivot") return pivotViewMode.value === "pivot" ? "Pivot" : "Table"
  if (activeScenarioId.value === "tree") return "Tree"
  if (activeScenarioId.value === "gantt") return "Gantt"
  return "Virtual"
})
const groupBy = computed(() => {
  if (activeScenarioId.value === "aggregation" && aggregationViewMode.value === "aggregation") {
    return { fields: ["region", "stage"], expandedByDefault: true }
  }
  return null
})
const aggregationModel = computed<DataGridAggregationModel<Record<string, unknown>> | null>(() => {
  if (activeScenarioId.value === "aggregation" && aggregationViewMode.value === "aggregation") {
    return { columns: [{ key: "arr", op: "sum" }, { key: "margin", op: "avg" }], basis: "filtered" }
  }
  return null
})
const pivotModel = computed<DataGridPivotSpec | null>(() => {
  if (activeScenarioId.value === "pivot" && pivotViewMode.value === "pivot") {
    return { rows: ["owner"], columns: ["region"], values: [{ field: "arr", agg: "sum" }, { field: "arr", agg: "count" }] }
  }
  return null
})
const clientRowModelOptions = computed(() => {
  if (activeScenarioId.value !== "tree") {
    return undefined
  }
  return {
    initialTreeData: {
      mode: "path" as const,
      getDataPath: (row: unknown) => (row as { path?: string[] }).path ?? [],
      expandedByDefault: true,
      filterMode: "include-descendants" as const,
    },
  }
})
const viewMode = computed(() => activeScenarioId.value === "gantt" ? "gantt" : undefined)
const ganttOptions = computed(() => {
  if (activeScenarioId.value !== "gantt") {
    return undefined
  }
  return {
    idKey: "id",
    labelKey: "name",
    startKey: "start",
    endKey: "end",
    baselineStartKey: "baselineStart",
    baselineEndKey: "baselineEnd",
    progressKey: "progress",
    dependencyKey: "dependencies",
    criticalKey: "critical",
    computedCriticalPath: true,
    zoomLevel: "week" as const,
    paneWidth: 760,
    rangePaddingDays: 2,
  }
})

const gridKey = computed(() => `${activeScenarioId.value}:${aggregationViewMode.value}:${pivotViewMode.value}`)

function syncSelectionSummary() {
  selectionSummary.value = gridRef.value?.getSelectionAggregatesLabel?.() || "Select cells to see summary"
}
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
        <div v-if="showHeaderActions" class="showcase-header__actions">
          <label v-if="showAggregationModeControl" class="showcase-mode-select">
            <span>View</span>
            <select v-model="aggregationViewMode" aria-label="Aggregation view mode">
              <option value="table">Table</option>
              <option value="aggregation">Aggregation</option>
            </select>
          </label>
          <label v-if="showPivotModeControl" class="showcase-mode-select">
            <span>View</span>
            <select v-model="pivotViewMode" aria-label="Pivot view mode">
              <option value="table">Table</option>
              <option value="pivot">Pivot</option>
            </select>
          </label>
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
          <strong>{{ gridUxLabel }}</strong>
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
          ref="gridRef"
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
          @selection-change="syncSelectionSummary"
        />
        <DataGrid
          v-else
          :key="gridKey"
          ref="gridRef"
          :rows="activeRows"
          :columns="activeColumns"
          :client-row-model-options="clientRowModelOptions"
          :group-by="groupBy"
          :aggregation-model="aggregationModel"
          :pivot-model="pivotModel"
          :view-mode="viewMode"
          :gantt="ganttOptions"
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
          @selection-change="syncSelectionSummary"
        />
        <div v-if="showSelectionSummary" class="showcase-selection-summary">
          {{ selectionSummary }}
        </div>
      </section>
    </section>
  </main>
</template>
