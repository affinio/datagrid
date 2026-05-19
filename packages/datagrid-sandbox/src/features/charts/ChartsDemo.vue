<template>
  <article class="card charts-demo">
    <header class="card__header charts-demo__header">
      <div>
        <h2>Charts</h2>
        <p>Sandbox validation for the first reusable SVG chart components.</p>
      </div>
      <span class="charts-demo__badge">Theme tokens overridden</span>
    </header>

    <section class="charts-demo__theme">
      <section class="charts-demo__metrics" aria-label="Chart KPI metrics">
        <AffinoMetricCard
          v-for="metric in METRIC_CARDS"
          :key="metric.label"
          v-bind="metric"
          @metric-click="recordMetricEvent(metric.label, $event)"
        />
      </section>

      <section class="charts-demo__grid">
        <div class="charts-demo__chart-card charts-demo__chart-card--wide">
          <AffinoBarChart
            :rows="REGION_REVENUE"
            category-field="region"
            value-field="revenue"
            title="Revenue by Region"
            description="Quarterly revenue in thousands"
            :height="320"
            @bar-click="recordBarEvent('click', $event)"
            @bar-hover="recordBarEvent('hover', $event)"
            @bar-leave="recordBarEvent('leave', $event)"
          />
        </div>

        <div class="charts-demo__chart-card charts-demo__chart-card--wide">
          <AffinoLineChart
            :rows="MONTHLY_TREND"
            x-field="monthIndex"
            y-field="revenue"
            x-scale-type="number"
            title="Monthly Revenue Trend"
            description="Indexed revenue across the current year"
            :height="320"
            @point-click="recordLineEvent('click', $event)"
            @point-hover="recordLineEvent('hover', $event)"
            @point-leave="recordLineEvent('leave', $event)"
          />
        </div>

        <div class="charts-demo__chart-card charts-demo__chart-card--wide">
          <AffinoScatterChart
            :rows="DISCOUNT_VALUE"
            x-field="discount"
            y-field="value"
            radius-field="lotCount"
            title="Discount vs Deal Value"
            description="Bubble size represents lot count"
            :height="320"
            :min-radius="4"
            :max-radius="18"
            show-grid
            @point-click="recordScatterEvent('click', $event)"
            @point-hover="recordScatterEvent('hover', $event)"
            @point-leave="recordScatterEvent('leave', $event)"
          />
        </div>

        <div class="charts-demo__chart-card">
          <AffinoPieChart
            :rows="CHANNEL_USERS"
            category-field="channel"
            value-field="users"
            title="Users by Channel"
            description="Donut mode using shared legend"
            :inner-radius-ratio="0.56"
            :width="640"
            :height="320"
            @slice-click="recordPieEvent('click', $event)"
            @slice-hover="recordPieEvent('hover', $event)"
            @slice-leave="recordPieEvent('leave', $event)"
          />
        </div>

        <aside class="charts-demo__debug" aria-label="Chart interaction debug panel">
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

          <section class="charts-demo__legend-panel" aria-label="Interactive legend validation">
            <h4>Interactive Legend</h4>
            <AffinoChartLegend
              :items="LEGEND_ITEMS"
              orientation="vertical"
              interactive
              @item-click="recordLegendEvent('click', $event)"
              @item-hover="recordLegendEvent('hover', $event)"
              @item-leave="recordLegendEvent('leave', $event)"
            />
          </section>
        </aside>
      </section>
    </section>
  </article>
</template>

<script setup lang="ts">
import { reactive } from "vue"
import {
  AffinoBarChart,
  AffinoChartLegend,
  AffinoLineChart,
  AffinoMetricCard,
  AffinoPieChart,
  AffinoScatterChart,
} from "@affino/charts-vue"
import type {
  AffinoBarChartBarEvent,
  AffinoChartInteractionPayload,
  AffinoLineChartPointEvent,
  AffinoPieChartSliceEvent,
  AffinoScatterChartPointEvent,
  ChartAnchorRect,
  ChartInteractionPoint,
  ChartLegendItem,
} from "@affino/charts-vue"
import type { ChartDatum, MetricFormat, MetricModel } from "@affino/charts-core"

interface MetricCardDemo {
  label: string
  value: number
  previousValue: number
  format: MetricFormat
  currency?: string
  locale?: string
  unit?: string
  precision?: number
  trend: number[]
  title: string
  description: string
  variant: "default" | "success" | "warning" | "danger" | "muted"
}

const REGION_REVENUE: ChartDatum[] = [
  { region: "North", revenue: 142 },
  { region: "South", revenue: 96 },
  { region: "East", revenue: 188 },
  { region: "West", revenue: 124 },
  { region: "Central", revenue: 156 },
]

const MONTHLY_TREND: ChartDatum[] = [
  { month: "Jan", monthIndex: 1, revenue: 88 },
  { month: "Feb", monthIndex: 2, revenue: 92 },
  { month: "Mar", monthIndex: 3, revenue: 105 },
  { month: "Apr", monthIndex: 4, revenue: 101 },
  { month: "May", monthIndex: 5, revenue: 118 },
  { month: "Jun", monthIndex: 6, revenue: 136 },
  { month: "Jul", monthIndex: 7, revenue: 148 },
]

const CHANNEL_USERS: ChartDatum[] = [
  { channel: "Direct", users: 42 },
  { channel: "Search", users: 31 },
  { channel: "Partner", users: 18 },
  { channel: "Social", users: 9 },
]

const DISCOUNT_VALUE: ChartDatum[] = [
  { segment: "Core", discount: 4, value: 118, lotCount: 8 },
  { segment: "Growth", discount: 7, value: 142, lotCount: 12 },
  { segment: "Enterprise", discount: 12, value: 228, lotCount: 18 },
  { segment: "Renewal", discount: 16, value: 166, lotCount: 10 },
  { segment: "Expansion", discount: 22, value: 208, lotCount: 15 },
  { segment: "Pilot", discount: 28, value: 96, lotCount: 5 },
]

const LEGEND_ITEMS: ChartLegendItem[] = [
  { id: "planned", label: "Planned", value: "68%" },
  { id: "active", label: "Active", value: "24%" },
  { id: "at-risk", label: "At risk", value: "8%", color: "#dc2626" },
]

const METRIC_CARDS: MetricCardDemo[] = [
  {
    label: "Total Revenue",
    value: 684000,
    previousValue: 612000,
    format: "currency",
    currency: "USD",
    locale: "en-US",
    precision: 0,
    trend: [520, 560, 590, 610, 640, 684],
    title: "Quarter to date",
    description: "All regions",
    variant: "success",
  },
  {
    label: "Conversion",
    value: 0.128,
    previousValue: 0.119,
    format: "percent",
    precision: 1,
    trend: [0.108, 0.112, 0.116, 0.121, 0.128],
    title: "Signup funnel",
    description: "Visitors to activated users",
    variant: "default",
  },
  {
    label: "Active Users",
    value: 24800,
    previousValue: 23400,
    format: "compact",
    precision: 1,
    trend: [18200, 19100, 20600, 22400, 23600, 24800],
    title: "Weekly active",
    description: "Product usage",
    variant: "muted",
  },
  {
    label: "Error Rate",
    value: 0.024,
    previousValue: 0.019,
    format: "percent",
    precision: 2,
    trend: [0.012, 0.014, 0.016, 0.019, 0.024],
    title: "Risk monitor",
    description: "Failed requests",
    variant: "danger",
  },
]

const debugState = reactive({
  source: "none",
  item: "none",
  value: "none",
  clientPoint: "none",
  anchorRect: "none",
})

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
    item: `x=${payload.xValue}`,
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

function recordScatterEvent(action: string, payload: AffinoScatterChartPointEvent): void {
  setDebugState({
    source: `scatter:${action}`,
    item: String(payload.row.segment ?? `point ${payload.index + 1}`),
    value: `x=${payload.xValue}, y=${payload.yValue}, r=${payload.radiusValue ?? "none"}`,
    clientPoint: payload.clientPoint,
    anchorRect: payload.anchorRect,
  })
}

function recordLegendEvent(action: string, payload: AffinoChartInteractionPayload<ChartLegendItem>): void {
  setDebugState({
    source: `legend:${action}`,
    item: payload.item.label,
    value: payload.item.value ?? "none",
    clientPoint: payload.clientPoint,
    anchorRect: payload.anchorRect,
  })
}

function recordMetricEvent(label: string, payload: { model: MetricModel }): void {
  debugState.source = "metric:click"
  debugState.item = label
  debugState.value = payload.model.displayValue
  debugState.clientPoint = "none"
  debugState.anchorRect = "none"
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

function formatPoint(point: ChartInteractionPoint): string {
  return `${Math.round(point.x)}, ${Math.round(point.y)}`
}

function formatRect(rect: ChartAnchorRect): string {
  return `${Math.round(rect.x)}, ${Math.round(rect.y)} / ${Math.round(rect.width)}x${Math.round(rect.height)}`
}

function formatPercent(value: number): string {
  return `${Number.parseFloat((value * 100).toFixed(1))}%`
}
</script>

<style scoped>
.charts-demo {
  overflow: auto;
  gap: 12px;
}

.charts-demo__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.charts-demo__header p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
}

.charts-demo__badge {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 8px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  color: #1d4ed8;
  background: #eff6ff;
  font-size: 12px;
  white-space: nowrap;
}

.charts-demo__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(320px, 1fr));
  align-items: start;
  gap: 14px;
}

.charts-demo__theme {
  --charts-demo-series-1: #0f766e;
  --charts-demo-series-2: #2563eb;
  --charts-demo-series-3: #f59e0b;
  --charts-demo-bar-hover: #115e59;
  --charts-demo-line: #7c3aed;
  --charts-demo-scatter: #be123c;

  display: grid;
  gap: 14px;
}

.charts-demo__theme :deep(.affino-chart-frame),
.charts-demo__theme :deep(.affino-pie-chart),
.charts-demo__theme :deep(.affino-chart-legend),
.charts-demo__theme :deep(.affino-metric-card) {
  --affino-chart-series-1: #0f766e;
  --affino-chart-series-2: #2563eb;
  --affino-chart-series-3: #f59e0b;
  --affino-chart-bar-fill: var(--charts-demo-series-1);
  --affino-chart-bar-hover-fill: var(--charts-demo-bar-hover);
  --affino-chart-line-stroke: var(--charts-demo-line);
  --affino-chart-line-point-stroke: var(--charts-demo-line);
  --affino-chart-scatter-fill: color-mix(in srgb, var(--charts-demo-scatter) 24%, transparent);
  --affino-chart-scatter-stroke: var(--charts-demo-scatter);
  --affino-chart-scatter-hover-fill: color-mix(in srgb, var(--charts-demo-scatter) 72%, transparent);
}

.charts-demo__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 12px;
}

.charts-demo__chart-card,
.charts-demo__debug {
  min-width: 0;
}

.charts-demo__chart-card {
  display: grid;
}

.charts-demo__chart-card--wide {
  grid-column: span 1;
}

.charts-demo__debug {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.charts-demo__debug h3,
.charts-demo__legend-panel h4 {
  margin: 0;
  color: #0f172a;
  font-size: 14px;
}

.charts-demo__debug dl {
  display: grid;
  gap: 8px;
  margin: 0;
}

.charts-demo__debug dl div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 8px;
}

.charts-demo__debug dt {
  color: #64748b;
  font-size: 12px;
}

.charts-demo__debug dd {
  min-width: 0;
  margin: 0;
  color: #0f172a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.charts-demo__legend-panel {
  display: grid;
  gap: 8px;
}

@media (max-width: 980px) {
  .charts-demo__grid {
    grid-template-columns: 1fr;
  }

  .charts-demo__metrics {
    grid-template-columns: repeat(2, minmax(180px, 1fr));
  }
}

@media (max-width: 560px) {
  .charts-demo__metrics {
    grid-template-columns: 1fr;
  }
}
</style>
