<template>
  <article class="card analytics-charts-demo">
    <header class="card__header analytics-charts-demo__header">
      <div>
        <h2>Analytics Charts</h2>
        <p>Raw business rows flow through Affino DataGrid projection, analytics-core aggregation, and charts-vue rendering.</p>
      </div>
      <span class="analytics-charts-demo__badge">{{ chartSourceRows.length }} chart rows</span>
    </header>

    <section class="analytics-charts-demo__controls" aria-label="Analytics chart filters">
      <label>
        Region
        <select v-model="selectedRegion">
          <option value="">All regions</option>
          <option v-for="region in regionOptions" :key="region" :value="region">{{ region }}</option>
        </select>
      </label>
      <label>
        Channel
        <select v-model="selectedChannel">
          <option value="">All channels</option>
          <option v-for="channel in channelOptions" :key="channel" :value="channel">{{ channel }}</option>
        </select>
      </label>
      <button type="button" @click="resetFilters">Reset filters</button>
    </section>

    <section class="analytics-charts-demo__metrics" aria-label="Analytics metrics">
      <AffinoMetricCard
        v-bind="revenueMetric"
        @metric-click="recordMetricEvent($event)"
      />
      <div class="analytics-charts-demo__summary" aria-label="Dataset metadata">
        <span>Pipeline</span>
        <strong>raw rows -> Affino DataGrid projection -> analytics-core datasets -> charts-vue components</strong>
        <small>{{ chartSourceRows.length }} DataGrid rows, {{ regionRevenueDataset.meta.rowCount }} region groups, {{ monthlyRevenueDataset.meta.rowCount }} month groups</small>
      </div>
    </section>

    <section class="analytics-charts-demo__grid">
      <div class="analytics-charts-demo__chart-card">
        <AffinoBarChart
          :rows="regionRevenueRows"
          category-field="region"
          value-field="revenue"
          title="Revenue by Region"
          description="analytics-core sum(revenue), grouped by region"
          :height="300"
          :margin="revenueAxisMargin"
          @bar-click="recordBarEvent('click', $event)"
          @bar-hover="recordBarEvent('hover', $event)"
          @bar-leave="recordBarEvent('leave', $event)"
        />
      </div>

      <div class="analytics-charts-demo__chart-card">
        <AffinoLineChart
          :rows="monthlyRevenueRows"
          x-field="monthIndex"
          y-field="revenue"
          x-scale-type="number"
          title="Revenue by Month"
          description="analytics-core sum(revenue), sorted by monthIndex"
          :height="300"
          :margin="revenueAxisMargin"
          @point-click="recordLineEvent('click', $event)"
          @point-hover="recordLineEvent('hover', $event)"
          @point-leave="recordLineEvent('leave', $event)"
        />
      </div>

      <div class="analytics-charts-demo__chart-card">
        <AffinoPieChart
          :rows="channelOrderRows"
          category-field="channel"
          value-field="orders"
          title="Orders by Channel"
          description="analytics-core sum(orders), grouped by channel"
          :inner-radius-ratio="0.58"
          :width="640"
          :height="300"
          @slice-click="recordPieEvent('click', $event)"
          @slice-hover="recordPieEvent('hover', $event)"
          @slice-leave="recordPieEvent('leave', $event)"
        />
      </div>

      <div class="analytics-charts-demo__chart-card">
        <AffinoHistogram
          :rows="loadTimeRows"
          value-field="loadTimeMs"
          title="Load Time Distribution"
          description="Filtered analytics-core row dataset, binned by charts-core"
          :height="300"
          :bin-count="8"
          :value-min="0"
          :value-max="900"
          @bin-click="recordHistogramEvent('click', $event)"
          @bin-hover="recordHistogramEvent('hover', $event)"
          @bin-leave="recordHistogramEvent('leave', $event)"
        />
      </div>

      <div class="analytics-charts-demo__chart-card analytics-charts-demo__chart-card--wide">
        <AffinoScatterChart
          :rows="discountRevenueRows"
          x-field="discountPercent"
          y-field="revenue"
          radius-field="orders"
          title="Discount vs Revenue"
          description="Filtered analytics-core row dataset; radius represents orders"
          :height="320"
          :min-radius="4"
          :max-radius="16"
          :margin="revenueAxisMargin"
          show-grid
          @point-click="recordScatterEvent('click', $event)"
          @point-hover="recordScatterEvent('hover', $event)"
          @point-leave="recordScatterEvent('leave', $event)"
        />
      </div>

      <aside class="analytics-charts-demo__debug" aria-label="Chart interaction debug panel">
        <h3>Interaction Debug</h3>
        <dl>
          <div>
            <dt>Source</dt>
            <dd>{{ debugState.source }}</dd>
          </div>
          <div>
            <dt>Item</dt>
            <dd>{{ debugState.item }}</dd>
          </div>
          <div>
            <dt>Value</dt>
            <dd>{{ debugState.value }}</dd>
          </div>
          <div>
            <dt>Client point</dt>
            <dd>{{ debugState.clientPoint }}</dd>
          </div>
          <div>
            <dt>Anchor rect</dt>
            <dd>{{ debugState.anchorRect }}</dd>
          </div>
        </dl>
      </aside>
    </section>

    <section class="analytics-charts-demo__data-panel" aria-label="Filtered raw rows preview">
      <header>
        <div>
          <h3>Raw Rows DataGrid</h3>
          <p>Affino DataGrid drives the chart source rows with quick filter, column filters, resize, inline edits, and a formula column.</p>
        </div>
        <span>{{ filteredRows.length }} of {{ rawRows.length }} rows</span>
      </header>
      <div class="analytics-charts-demo__data-grid affino-datagrid-app-root">
        <AnalyticsPreviewDataGrid
          ref="previewGridRef"
          :rows="filteredRows"
          :columns="previewGridColumns"
          :client-row-model-options="previewGridRowModelOptions"
          :quick-filter="previewGridQuickFilter"
          column-menu
          column-layout
          column-reorder
          find-replace
          history
          fill-handle
          range-move
          row-hover
          striped-rows
          grid-lines="all"
          render-mode="virtualization"
          layout-mode="fill"
          :base-row-height="34"
          row-height-mode="fixed"
          @ready="syncChartRowsFromPreviewGrid"
          @cell-change="scheduleChartRowsFromPreviewGridSync"
          @cell-edit="handlePreviewCellEdit"
          @update:state="scheduleChartRowsFromPreviewGridSync"
        />
      </div>
    </section>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue"
import { createAnalyticsDataset } from "@affino/analytics-core"
import type { AnalyticsDataset, AnalyticsFilter, AnalyticsQuery, AnalyticsRow } from "@affino/analytics-core"
import {
  defineDataGridColumns,
  defineDataGridComponent,
  useDataGridRef,
} from "@affino/datagrid-vue-app"
import type {
  DataGridAppClientRowModelOptions,
  DataGridCellEditEvent,
  DataGridQuickFilterOptions,
} from "@affino/datagrid-vue-app"
import {
  AffinoBarChart,
  AffinoHistogram,
  AffinoLineChart,
  AffinoMetricCard,
  AffinoPieChart,
  AffinoScatterChart,
} from "@affino/charts-vue"
import type {
  AffinoBarChartBarEvent,
  AffinoHistogramBinEvent,
  AffinoLineChartPointEvent,
  AffinoPieChartSliceEvent,
  AffinoScatterChartPointEvent,
  ChartAnchorRect,
  ChartInteractionPoint,
} from "@affino/charts-vue"
import type { ChartDatum, ChartMargin, MetricFormat } from "@affino/charts-core"

interface BusinessRow extends AnalyticsRow {
  id: string
  region: string
  channel: string
  month: string
  monthIndex: number
  revenue: number
  orders: number
  loadTimeMs: number
  discountPercent: number
}

const AnalyticsPreviewDataGrid = defineDataGridComponent<BusinessRow>()

interface RevenueMetric {
  label: string
  value: number
  previousValue: number
  format: MetricFormat
  currency: string
  locale: string
  precision: number
  trend: number[]
  title: string
  description: string
  variant: "default" | "success" | "warning" | "danger" | "muted"
}

const RAW_ROWS: BusinessRow[] = [
  { id: "ord-001", region: "North", channel: "Direct", month: "Jan", monthIndex: 1, revenue: 48200, orders: 96, loadTimeMs: 112, discountPercent: 4 },
  { id: "ord-002", region: "South", channel: "Search", month: "Jan", monthIndex: 1, revenue: 39100, orders: 82, loadTimeMs: 184, discountPercent: 7 },
  { id: "ord-003", region: "East", channel: "Partner", month: "Jan", monthIndex: 1, revenue: 56600, orders: 104, loadTimeMs: 246, discountPercent: 9 },
  { id: "ord-004", region: "West", channel: "Social", month: "Jan", monthIndex: 1, revenue: 31800, orders: 61, loadTimeMs: 318, discountPercent: 13 },
  { id: "ord-005", region: "North", channel: "Search", month: "Feb", monthIndex: 2, revenue: 51800, orders: 101, loadTimeMs: 148, discountPercent: 6 },
  { id: "ord-006", region: "South", channel: "Partner", month: "Feb", monthIndex: 2, revenue: 44700, orders: 88, loadTimeMs: 228, discountPercent: 11 },
  { id: "ord-007", region: "East", channel: "Direct", month: "Feb", monthIndex: 2, revenue: 61200, orders: 118, loadTimeMs: 156, discountPercent: 5 },
  { id: "ord-008", region: "West", channel: "Social", month: "Feb", monthIndex: 2, revenue: 35400, orders: 66, loadTimeMs: 388, discountPercent: 16 },
  { id: "ord-009", region: "North", channel: "Partner", month: "Mar", monthIndex: 3, revenue: 57300, orders: 109, loadTimeMs: 276, discountPercent: 10 },
  { id: "ord-010", region: "South", channel: "Direct", month: "Mar", monthIndex: 3, revenue: 46200, orders: 91, loadTimeMs: 132, discountPercent: 3 },
  { id: "ord-011", region: "East", channel: "Search", month: "Mar", monthIndex: 3, revenue: 68400, orders: 127, loadTimeMs: 204, discountPercent: 8 },
  { id: "ord-012", region: "West", channel: "Partner", month: "Mar", monthIndex: 3, revenue: 40900, orders: 73, loadTimeMs: 336, discountPercent: 14 },
  { id: "ord-013", region: "North", channel: "Direct", month: "Apr", monthIndex: 4, revenue: 62900, orders: 121, loadTimeMs: 118, discountPercent: 4 },
  { id: "ord-014", region: "South", channel: "Social", month: "Apr", monthIndex: 4, revenue: 38800, orders: 76, loadTimeMs: 428, discountPercent: 18 },
  { id: "ord-015", region: "East", channel: "Partner", month: "Apr", monthIndex: 4, revenue: 72100, orders: 136, loadTimeMs: 268, discountPercent: 12 },
  { id: "ord-016", region: "West", channel: "Search", month: "Apr", monthIndex: 4, revenue: 45100, orders: 84, loadTimeMs: 196, discountPercent: 9 },
  { id: "ord-017", region: "North", channel: "Search", month: "May", monthIndex: 5, revenue: 66800, orders: 129, loadTimeMs: 174, discountPercent: 7 },
  { id: "ord-018", region: "South", channel: "Direct", month: "May", monthIndex: 5, revenue: 49300, orders: 98, loadTimeMs: 124, discountPercent: 4 },
  { id: "ord-019", region: "East", channel: "Social", month: "May", monthIndex: 5, revenue: 58600, orders: 112, loadTimeMs: 512, discountPercent: 19 },
  { id: "ord-020", region: "West", channel: "Partner", month: "May", monthIndex: 5, revenue: 47200, orders: 86, loadTimeMs: 348, discountPercent: 15 },
  { id: "ord-021", region: "North", channel: "Partner", month: "Jun", monthIndex: 6, revenue: 70400, orders: 132, loadTimeMs: 286, discountPercent: 11 },
  { id: "ord-022", region: "South", channel: "Search", month: "Jun", monthIndex: 6, revenue: 53600, orders: 104, loadTimeMs: 206, discountPercent: 8 },
  { id: "ord-023", region: "East", channel: "Direct", month: "Jun", monthIndex: 6, revenue: 78300, orders: 145, loadTimeMs: 142, discountPercent: 5 },
  { id: "ord-024", region: "West", channel: "Social", month: "Jun", monthIndex: 6, revenue: 42100, orders: 79, loadTimeMs: 604, discountPercent: 22 },
]

const rawRows = ref<BusinessRow[]>(RAW_ROWS.map(row => ({ ...row })))
const selectedRegion = ref("")
const selectedChannel = ref("")
const previewGridRef = useDataGridRef<BusinessRow>()
const dataGridProjectedRows = ref<BusinessRow[]>([])

const regionOptions = computed(() => [...new Set(rawRows.value.map((row) => row.region))].sort())
const channelOptions = computed(() => [...new Set(rawRows.value.map((row) => row.channel))].sort())
const revenueAxisMargin = {
  top: 16,
  right: 20,
  bottom: 36,
  left: 86,
} satisfies Partial<ChartMargin>
const previewGridColumns = defineDataGridColumns<BusinessRow>()([
  {
    key: "id",
    label: "ID",
    initialState: { width: 96 },
    capabilities: { sortable: true, filterable: true },
  },
  {
    key: "region",
    label: "Region",
    initialState: { width: 112 },
    capabilities: { sortable: true, filterable: true, editable: true },
  },
  {
    key: "channel",
    label: "Channel",
    initialState: { width: 116 },
    capabilities: { sortable: true, filterable: true, editable: true },
  },
  {
    key: "month",
    label: "Month",
    initialState: { width: 88 },
    capabilities: { sortable: true, filterable: true, editable: true },
  },
  {
    key: "monthIndex",
    label: "Month #",
    dataType: "number",
    initialState: { width: 94 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true, editable: true },
  },
  {
    key: "revenue",
    label: "Revenue",
    dataType: "currency",
    initialState: { width: 128 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true, editable: true, aggregatable: true },
    constraints: { min: 0 },
  },
  {
    key: "orders",
    label: "Orders",
    dataType: "number",
    initialState: { width: 98 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true, editable: true, aggregatable: true },
    constraints: { min: 0 },
  },
  {
    key: "loadTimeMs",
    label: "Load ms",
    dataType: "number",
    initialState: { width: 104 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true, editable: true, aggregatable: true },
    constraints: { min: 0 },
  },
  {
    key: "discountPercent",
    label: "Discount %",
    dataType: "number",
    initialState: { width: 118 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true, editable: true, aggregatable: true },
    constraints: { min: 0 },
  },
  {
    key: "averageOrderValue",
    label: "AOV",
    dataType: "currency",
    initialState: { width: 112 },
    presentation: { align: "right", headerAlign: "right" },
    capabilities: { sortable: true, filterable: true, aggregatable: true },
    formula: "IFERROR(revenue / orders, 0)",
  },
] as const)
const previewGridRowModelOptions = {
  resolveRowId: row => row.id,
} satisfies DataGridAppClientRowModelOptions<BusinessRow>
const previewGridQuickFilter = {
  placeholder: "Search raw rows",
  columns: ["id", "region", "channel", "month"],
  mode: "tokens",
} satisfies DataGridQuickFilterOptions

const analyticsFilters = computed<AnalyticsFilter[]>(() => {
  const filters: AnalyticsFilter[] = []

  if (selectedRegion.value !== "") {
    filters.push({ field: "region", op: "equals", value: selectedRegion.value })
  }

  if (selectedChannel.value !== "") {
    filters.push({ field: "channel", op: "equals", value: selectedChannel.value })
  }

  return filters
})

const filteredRowsDataset = computed(() => createTypedDataset(rawRows.value, {
  dimensions: [
    { field: "id" },
    { field: "region" },
    { field: "channel" },
    { field: "month" },
    { field: "monthIndex" },
    { field: "revenue" },
    { field: "orders" },
    { field: "loadTimeMs" },
    { field: "discountPercent" },
  ],
  filters: analyticsFilters.value,
  sort: [{ field: "monthIndex" }, { field: "id" }],
}))

const chartSourceRows = computed(() => dataGridProjectedRows.value)

const revenueDataset = computed(() => createTypedDataset(chartSourceRows.value, {
  measures: [{ field: "revenue", op: "sum", as: "revenue" }],
}))

const regionRevenueDataset = computed(() => createTypedDataset(chartSourceRows.value, {
  dimensions: [{ field: "region" }],
  measures: [{ field: "revenue", op: "sum", as: "revenue" }],
  sort: [{ field: "revenue", direction: "desc" }],
}))

const channelOrdersDataset = computed(() => createTypedDataset(chartSourceRows.value, {
  dimensions: [{ field: "channel" }],
  measures: [{ field: "orders", op: "sum", as: "orders" }],
  sort: [{ field: "orders", direction: "desc" }],
}))

const monthlyRevenueDataset = computed(() => createTypedDataset(chartSourceRows.value, {
  dimensions: [{ field: "monthIndex" }, { field: "month" }],
  measures: [{ field: "revenue", op: "sum", as: "revenue" }],
  sort: [{ field: "monthIndex" }],
}))

const loadTimeDataset = computed(() => createTypedDataset(chartSourceRows.value, {
  dimensions: [{ field: "id" }, { field: "loadTimeMs" }],
  sort: [{ field: "loadTimeMs" }],
}))

const discountRevenueDataset = computed(() => createTypedDataset(chartSourceRows.value, {
  dimensions: [
    { field: "id" },
    { field: "region" },
    { field: "channel" },
    { field: "discountPercent" },
    { field: "revenue" },
    { field: "orders" },
  ],
  sort: [{ field: "discountPercent" }],
}))

const filteredRows = computed(() => filteredRowsDataset.value.rows as BusinessRow[])
const totalRevenue = computed(() => readNumber(revenueDataset.value.rows[0]?.revenue))
const regionRevenueRows = computed(() => regionRevenueDataset.value.rows as ChartDatum[])
const channelOrderRows = computed(() => channelOrdersDataset.value.rows as ChartDatum[])
const monthlyRevenueRows = computed(() => monthlyRevenueDataset.value.rows as ChartDatum[])
const loadTimeRows = computed(() => loadTimeDataset.value.rows as ChartDatum[])
const discountRevenueRows = computed(() => discountRevenueDataset.value.rows as ChartDatum[])

const revenueMetric = computed<RevenueMetric>(() => ({
  label: "Total Revenue",
  value: totalRevenue.value,
  previousValue: 892000,
  format: "currency",
  currency: "USD",
  locale: "en-US",
  precision: 0,
  trend: monthlyRevenueRows.value.map((row) => readNumber(row.revenue)),
  title: "Filtered revenue",
  description: selectedRegion.value || selectedChannel.value
    ? "Current analytics filters"
    : "All regions and channels",
  variant: totalRevenue.value >= 892000 ? "success" : "default",
}))

const debugState = reactive({
  source: "none",
  item: "none",
  value: "none",
  clientPoint: "none",
  anchorRect: "none",
})

watch(filteredRows, (rows) => {
  dataGridProjectedRows.value = rows.map(cloneBusinessRow)
  scheduleChartRowsFromPreviewGridSync()
}, { immediate: true })

function createTypedDataset(rows: readonly BusinessRow[], query: AnalyticsQuery): AnalyticsDataset {
  return createAnalyticsDataset([...rows], query)
}

function resetFilters(): void {
  selectedRegion.value = ""
  selectedChannel.value = ""
}

function handlePreviewCellEdit(event: DataGridCellEditEvent<BusinessRow>): void {
  debugState.source = "grid:cell-edit"
  debugState.item = `${String(event.rowId)}:${event.columnKey}`
  debugState.clientPoint = "none"
  debugState.anchorRect = "none"

  const rowId = String(event.rowId)
  rawRows.value = rawRows.value.map(row => row.id === rowId
    ? normalizeBusinessRow({ ...row, ...event.patch.data })
    : row)
  dataGridProjectedRows.value = dataGridProjectedRows.value.map(row => row.id === rowId
    ? normalizeBusinessRow({ ...row, ...event.patch.data })
    : row)
  debugState.value = String(event.newValue ?? "")
  scheduleChartRowsFromPreviewGridSync()
}

function scheduleChartRowsFromPreviewGridSync(): void {
  void nextTick(() => {
    syncChartRowsFromPreviewGrid()
  })
}

function syncChartRowsFromPreviewGrid(): void {
  const api = previewGridRef.value?.getApi()
  if (api === null || api === undefined) {
    dataGridProjectedRows.value = filteredRows.value.map(cloneBusinessRow)
    return
  }

  const rows: BusinessRow[] = []
  for (let index = 0; index < api.rows.getCount(); index += 1) {
    const row = api.rows.get(index)?.data
    if (isBusinessRow(row)) {
      rows.push(cloneBusinessRow(row))
    }
  }
  dataGridProjectedRows.value = rows
}

function normalizeBusinessRow(row: BusinessRow): BusinessRow {
  return {
    ...row,
    monthIndex: normalizeNumber(row.monthIndex),
    revenue: normalizeNumber(row.revenue),
    orders: normalizeNumber(row.orders),
    loadTimeMs: normalizeNumber(row.loadTimeMs),
    discountPercent: normalizeNumber(row.discountPercent),
  }
}

function cloneBusinessRow(row: BusinessRow): BusinessRow {
  return normalizeBusinessRow({ ...row })
}

function isBusinessRow(value: unknown): value is BusinessRow {
  return typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<BusinessRow>).id === "string" &&
    typeof (value as Partial<BusinessRow>).region === "string" &&
    typeof (value as Partial<BusinessRow>).channel === "string"
}

function normalizeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function recordMetricEvent(payload: { model: { displayValue: string } }): void {
  debugState.source = "metric:click"
  debugState.item = "Total Revenue"
  debugState.value = payload.model.displayValue
  debugState.clientPoint = "none"
  debugState.anchorRect = "none"
}

function recordBarEvent(action: string, payload: AffinoBarChartBarEvent): void {
  setDebugState({
    source: `bar:${action}`,
    item: payload.category,
    value: payload.value,
    clientPoint: payload.clientPoint,
    anchorRect: payload.anchorRect,
  })
}

function recordLineEvent(action: string, payload: AffinoLineChartPointEvent): void {
  setDebugState({
    source: `line:${action}`,
    item: String(payload.row.month ?? `month ${payload.xValue}`),
    value: payload.yValue,
    clientPoint: payload.clientPoint,
    anchorRect: payload.anchorRect,
  })
}

function recordPieEvent(action: string, payload: AffinoPieChartSliceEvent): void {
  setDebugState({
    source: `pie:${action}`,
    item: payload.category,
    value: `${payload.value} (${formatPercent(payload.percentage)})`,
    clientPoint: payload.clientPoint,
    anchorRect: payload.anchorRect,
  })
}

function recordHistogramEvent(action: string, payload: AffinoHistogramBinEvent): void {
  setDebugState({
    source: `histogram:${action}`,
    item: `${formatNumber(payload.min)}-${formatNumber(payload.max)} ms`,
    value: `${payload.count} rows`,
    clientPoint: payload.clientPoint,
    anchorRect: payload.anchorRect,
  })
}

function recordScatterEvent(action: string, payload: AffinoScatterChartPointEvent): void {
  setDebugState({
    source: `scatter:${action}`,
    item: String(payload.row.id ?? `point ${payload.index + 1}`),
    value: `discount=${payload.xValue}%, revenue=${formatCurrency(payload.yValue)}, orders=${payload.radiusValue ?? "none"}`,
    clientPoint: payload.clientPoint,
    anchorRect: payload.anchorRect,
  })
}

function setDebugState(nextState: {
  source: string
  item: string
  value: string | number
  clientPoint: ChartInteractionPoint
  anchorRect: ChartAnchorRect
}): void {
  debugState.source = nextState.source
  debugState.item = nextState.item
  debugState.value = String(nextState.value)
  debugState.clientPoint = formatPoint(nextState.clientPoint)
  debugState.anchorRect = formatRect(nextState.anchorRect)
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPoint(point: ChartInteractionPoint): string {
  return `${Math.round(point.x)}, ${Math.round(point.y)}`
}

function formatRect(rect: ChartAnchorRect): string {
  return `${Math.round(rect.x)}, ${Math.round(rect.y)} / ${Math.round(rect.width)}x${Math.round(rect.height)}`
}

function formatPercent(value: number): string {
  return `${Number.parseFloat((value * 100).toFixed(1))}%`
}

function formatNumber(value: number): string {
  return Number.parseFloat(value.toFixed(1)).toString()
}
</script>

<style scoped>
.analytics-charts-demo {
  gap: 12px;
  overflow: auto;
}

.analytics-charts-demo__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.analytics-charts-demo__header p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
}

.analytics-charts-demo__badge {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 8px;
  border: 1px solid #bbf7d0;
  border-radius: 999px;
  color: #166534;
  background: #f0fdf4;
  font-size: 12px;
  white-space: nowrap;
}

.analytics-charts-demo__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.analytics-charts-demo__controls label {
  display: grid;
  gap: 4px;
  color: #475569;
  font-size: 12px;
}

.analytics-charts-demo__controls select,
.analytics-charts-demo__controls button {
  height: 32px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  color: #0f172a;
  font: inherit;
  font-size: 13px;
}

.analytics-charts-demo__controls select {
  min-width: 160px;
  padding: 0 30px 0 8px;
}

.analytics-charts-demo__controls button {
  padding: 0 10px;
  cursor: pointer;
}

.analytics-charts-demo__metrics {
  display: grid;
  grid-template-columns: minmax(260px, 360px) minmax(260px, 1fr);
  gap: 12px;
}

.analytics-charts-demo__summary {
  display: grid;
  align-content: center;
  gap: 6px;
  min-width: 0;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.analytics-charts-demo__summary span,
.analytics-charts-demo__summary small {
  color: #64748b;
  font-size: 12px;
}

.analytics-charts-demo__summary strong {
  color: #0f172a;
  font-size: 15px;
  overflow-wrap: anywhere;
}

.analytics-charts-demo__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(320px, 1fr));
  align-items: start;
  gap: 14px;
}

.analytics-charts-demo__chart-card,
.analytics-charts-demo__debug {
  min-width: 0;
}

.analytics-charts-demo__chart-card {
  display: grid;
}

.analytics-charts-demo__chart-card--wide {
  grid-column: span 1;
}

.analytics-charts-demo__debug {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.analytics-charts-demo__debug h3,
.analytics-charts-demo__table-panel h3 {
  margin: 0;
  color: #0f172a;
  font-size: 14px;
}

.analytics-charts-demo__debug dl {
  display: grid;
  gap: 8px;
  margin: 0;
}

.analytics-charts-demo__debug dl div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 8px;
}

.analytics-charts-demo__debug dt {
  color: #64748b;
  font-size: 12px;
}

.analytics-charts-demo__debug dd {
  min-width: 0;
  margin: 0;
  color: #0f172a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.analytics-charts-demo__data-panel {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.analytics-charts-demo__data-panel header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.analytics-charts-demo__data-panel header p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
}

.analytics-charts-demo__data-panel header span {
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
}

.analytics-charts-demo__data-grid {
  min-width: 0;
  height: 430px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

@media (max-width: 980px) {
  .analytics-charts-demo__grid,
  .analytics-charts-demo__metrics {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .analytics-charts-demo__header,
  .analytics-charts-demo__data-panel header {
    align-items: flex-start;
    flex-direction: column;
  }

  .analytics-charts-demo__controls {
    align-items: stretch;
  }

  .analytics-charts-demo__controls label,
  .analytics-charts-demo__controls select,
  .analytics-charts-demo__controls button {
    width: 100%;
  }
}
</style>
