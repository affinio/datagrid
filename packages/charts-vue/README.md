# @affino/charts-vue

Reusable Vue rendering package for Affino chart experiences.

## Purpose

`@affino/charts-vue` owns Vue components, SVG rendering, styling, interaction, accessibility, and theme tokens for chart UI.

`@affino/charts-core` remains the headless calculation and geometry package. Vue rendering should consume core chart types, data access helpers, layout helpers, scale helpers, and chart geometry rather than duplicating those calculations.

## Current State

This package exposes the shared chart frame, initial chart-adjacent types, and reusable SVG chart components.

## Public API

```ts
import {
  AffinoAreaChart,
  AffinoBarChart,
  AffinoChartFrame,
  AffinoChartLegend,
  AffinoHistogram,
  AffinoLineChart,
  AffinoMetricCard,
  AffinoPieChart,
  AffinoScatterChart,
  createChartsVue,
} from "@affino/charts-vue"

const chartsVue = createChartsVue()
```

`AffinoChartFrame` provides the reusable SVG container for future chart components. It owns consistent sizing, title and description rendering, accessible SVG labels, and empty, loading, and error states. Chart content is passed through the default SVG slot.

## Bar Chart

`AffinoBarChart` renders vertical SVG bars using `createBarChartGeometry()` from `@affino/charts-core`. The Vue package owns rendering, styling, interaction, and accessibility; `@affino/charts-core` remains the geometry layer.

```vue
<script setup lang="ts">
import { AffinoBarChart } from "@affino/charts-vue"

const rows = [
  { name: "Alpha", revenue: 120 },
  { name: "Beta", revenue: 180 },
]
</script>

<template>
  <AffinoBarChart
    :rows="rows"
    category-field="name"
    value-field="revenue"
    title="Revenue"
    description="Revenue by segment"
    @bar-click="handleBarClick"
  />
</template>
```

Key props:

- `rows`, `categoryField`, `valueField`
- `width`, `height`, `margin`
- `title`, `description`, `emptyText`
- `maxBars`, `showAxes`, `showGrid`

Events:

- `bar-click`
- `bar-hover`
- `bar-leave`

Each bar event includes the core bar geometry as `item` and `bar`, source row, index, category, value, `clientPoint`, and `anchorRect`.

## Line Chart

`AffinoLineChart` renders a single-series SVG line using `createLineChartGeometry()` from `@affino/charts-core`. The core package owns point and path geometry while Vue owns rendering, styling, interaction, and accessibility.

```vue
<script setup lang="ts">
import { AffinoLineChart } from "@affino/charts-vue"

const rows = [
  { month: 1, revenue: 120 },
  { month: 2, revenue: 180 },
]
</script>

<template>
  <AffinoLineChart
    :rows="rows"
    x-field="month"
    y-field="revenue"
    x-scale-type="number"
    title="Revenue Trend"
    @point-click="handlePointClick"
  />
</template>
```

Key props:

- `rows`, `yField`, `xField`, `xScaleType`
- `width`, `height`, `margin`
- `title`, `description`, `emptyText`
- `includeZeroY`, `showAxes`, `showGrid`, `showPoints`

Events:

- `point-click`
- `point-hover`
- `point-leave`

Each point event includes the core point geometry as `item` and `point`, source row, index, `xValue`, `yValue`, `clientPoint`, and `anchorRect`.

## Area Chart

`AffinoAreaChart` renders a single-series SVG area chart using `createAreaChartGeometry()` from `@affino/charts-core`. The core package owns point, line, area, and baseline geometry while Vue owns rendering, styling, interaction, and accessibility.

```vue
<script setup lang="ts">
import { AffinoAreaChart } from "@affino/charts-vue"

const rows = [
  { week: 1, sessions: 1200 },
  { week: 2, sessions: 2350 },
]
</script>

<template>
  <AffinoAreaChart
    :rows="rows"
    x-field="week"
    y-field="sessions"
    x-scale-type="number"
    title="Cumulative Sessions"
    @point-click="handlePointClick"
  />
</template>
```

Key props:

- `rows`, `yField`, `xField`, `xScaleType`
- `width`, `height`, `margin`
- `title`, `description`, `emptyText`
- `includeZeroY`, `baselineValue`, `showAxes`, `showGrid`, `showPoints`

Events:

- `point-click`
- `point-hover`
- `point-leave`

Each area point event includes the core point geometry as `item` and `point`, source row, index, `xValue`, `yValue`, `clientPoint`, and `anchorRect`.

## Histogram

`AffinoHistogram` renders SVG histogram bins using `createHistogramGeometry()` from `@affino/charts-core`. The core package owns value filtering, binning, domains, and bin geometry while Vue owns rendering, styling, interaction, and accessibility.

```vue
<script setup lang="ts">
import { AffinoHistogram } from "@affino/charts-vue"

const rows = [
  { loadTimeMs: 120 },
  { loadTimeMs: 180 },
  { loadTimeMs: 220 },
]
</script>

<template>
  <AffinoHistogram
    :rows="rows"
    value-field="loadTimeMs"
    title="Load Time Distribution"
    :bin-count="8"
    @bin-click="handleBinClick"
  />
</template>
```

Key props:

- `rows`, `valueField`
- `width`, `height`, `margin`
- `title`, `description`, `emptyText`
- `binCount`, `valueMin`, `valueMax`, `includeOutOfRange`, `showAxes`, `showGrid`

Events:

- `bin-click`
- `bin-hover`
- `bin-leave`

Each bin event includes the core bin geometry as `item` and `bin`, index, min, max, count, values, `clientPoint`, and `anchorRect`.

## Scatter Chart

`AffinoScatterChart` renders SVG scatter and bubble charts using `createScatterChartGeometry()` from `@affino/charts-core`. The core package owns x/y/radius geometry while Vue owns rendering, styling, interaction, and accessibility.

```vue
<script setup lang="ts">
import { AffinoScatterChart } from "@affino/charts-vue"

const rows = [
  { discount: 4, value: 120, lotCount: 6 },
  { discount: 12, value: 180, lotCount: 16 },
]
</script>

<template>
  <AffinoScatterChart
    :rows="rows"
    x-field="discount"
    y-field="value"
    title="Discount vs Value"
    @point-click="handlePointClick"
  />
</template>
```

Use `radiusField` for bubble charts:

```vue
<AffinoScatterChart
  :rows="rows"
  x-field="discount"
  y-field="value"
  radius-field="lotCount"
  :min-radius="4"
  :max-radius="18"
/>
```

Key props:

- `rows`, `xField`, `yField`, `radiusField`
- `width`, `height`, `margin`
- `title`, `description`, `emptyText`
- `minRadius`, `maxRadius`, `includeZeroX`, `includeZeroY`, `showAxes`, `showGrid`

Events:

- `point-click`
- `point-hover`
- `point-leave`

Each scatter point event includes the core point geometry as `item` and `point`, source row, index, `xValue`, `yValue`, `radiusValue`, `clientPoint`, and `anchorRect`.

## Pie Chart

`AffinoPieChart` renders SVG pie and donut charts using `createPieChartGeometry()` from `@affino/charts-core`. The core package owns slice arc paths and percentages while Vue owns rendering, styling, interaction, accessibility, and the simple legend.

```vue
<script setup lang="ts">
import { AffinoPieChart } from "@affino/charts-vue"

const rows = [
  { segment: "Alpha", revenue: 120 },
  { segment: "Beta", revenue: 180 },
]
</script>

<template>
  <AffinoPieChart
    :rows="rows"
    category-field="segment"
    value-field="revenue"
    title="Revenue Share"
    @slice-click="handleSliceClick"
  />
</template>
```

Use `innerRadiusRatio` for donut charts:

```vue
<AffinoPieChart
  :rows="rows"
  category-field="segment"
  value-field="revenue"
  :inner-radius-ratio="0.55"
/>
```

Key props:

- `rows`, `categoryField`, `valueField`
- `width`, `height`, `margin`
- `title`, `description`, `emptyText`
- `innerRadiusRatio`, `startAngle`, `endAngle`, `showLegend`

Events:

- `slice-click`
- `slice-hover`
- `slice-leave`

Each slice event includes the core slice geometry as `item` and `slice`, source row, index, category, value, percentage, `clientPoint`, and `anchorRect`.

## Metric Card

`AffinoMetricCard` renders a KPI card using `createMetricModel()` from `@affino/charts-core`. The core package owns value formatting, delta direction, and trend filtering while Vue owns rendering, styling, interaction, and the small inline sparkline.

```vue
<script setup lang="ts">
import { AffinoMetricCard } from "@affino/charts-vue"
</script>

<template>
  <AffinoMetricCard
    label="Total Revenue"
    :value="684000"
    :previous-value="612000"
    format="currency"
    currency="USD"
    :precision="0"
    :trend="[520, 560, 590, 610, 640, 684]"
    unit="QTD"
    variant="success"
    @metric-click="handleMetricClick"
  />
</template>
```

Key props:

- `label`, `value`, `previousValue`
- `format`, `currency`, `locale`, `unit`, `precision`
- `trend`, `title`, `description`, `variant`
- `showDelta`, `showTrend`

Events:

- `metric-click`

The `metric-click` event includes the core `MetricModel`.

## Legend

`AffinoChartLegend` renders a semantic list of chart legend items. It can be used standalone or by chart components that need a shared legend surface.

```vue
<script setup lang="ts">
import { AffinoChartLegend } from "@affino/charts-vue"

const items = [
  { id: "alpha", label: "Alpha", value: "42%" },
  { id: "beta", label: "Beta", color: "#16a34a", value: "58%" },
]
</script>

<template>
  <AffinoChartLegend
    :items="items"
    orientation="vertical"
    interactive
    @item-click="handleLegendClick"
  />
</template>
```

Legend props:

- `items`
- `orientation`
- `interactive`
- `ariaLabel`

Legend events:

- `item-click`
- `item-hover`
- `item-leave`

## Interaction Payloads

Chart and legend interaction events include plain anchor data for external tooltips and popovers:

- `clientPoint`: center point of the interacted SVG or legend element
- `anchorRect`: plain `{ x, y, width, height }` copied from `getBoundingClientRect()`

Charts do not render or position tooltips. Consumers should pass `anchorRect` or `clientPoint` into their own floating UI primitives.

```vue
<script setup lang="ts">
import { ref } from "vue"
import { AffinoBarChart } from "@affino/charts-vue"
import type { AffinoBarChartBarEvent, ChartAnchorRect } from "@affino/charts-vue"

const tooltipAnchor = ref<ChartAnchorRect | null>(null)
const tooltipText = ref("")

function handleBarHover(event: AffinoBarChartBarEvent) {
  tooltipAnchor.value = event.anchorRect
  tooltipText.value = `${event.category}: ${event.value}`
}
</script>

<template>
  <AffinoBarChart
    :rows="rows"
    category-field="segment"
    value-field="revenue"
    @bar-hover="handleBarHover"
    @bar-leave="tooltipAnchor = null"
  />

  <!-- Render and position the app-owned tooltip/popover with tooltipAnchor. -->
</template>
```

## Theme Tokens

Consumers can override chart styling by setting CSS custom properties on `AffinoChartFrame` or a wrapping class:

- `--affino-chart-background`
- `--affino-chart-surface`
- `--affino-chart-border`
- `--affino-chart-text`
- `--affino-chart-muted-text`
- `--affino-chart-axis`
- `--affino-chart-grid`
- `--affino-chart-series-1`
- `--affino-chart-series-2`
- `--affino-chart-series-3`
- `--affino-chart-series-4`
- `--affino-chart-series-5`
- `--affino-chart-danger`
- `--affino-chart-warning`
- `--affino-chart-success`
- `--affino-chart-bar-fill`
- `--affino-chart-bar-hover-fill`
- `--affino-chart-line-stroke`
- `--affino-chart-line-point-fill`
- `--affino-chart-line-point-stroke`
- `--affino-chart-line-point-hover-fill`
- `--affino-chart-area-fill`
- `--affino-chart-area-stroke`
- `--affino-chart-area-point-fill`
- `--affino-chart-area-point-stroke`
- `--affino-chart-area-point-hover-fill`
- `--affino-chart-area-focus-stroke`
- `--affino-chart-histogram-bin-fill`
- `--affino-chart-histogram-bin-hover-fill`
- `--affino-chart-histogram-bin-stroke`
- `--affino-chart-histogram-bin-focus-stroke`
- `--affino-chart-scatter-fill`
- `--affino-chart-scatter-stroke`
- `--affino-chart-scatter-hover-fill`
- `--affino-chart-scatter-focus-stroke`
- `--affino-chart-pie-slice-stroke`
- `--affino-chart-pie-slice-hover-opacity`
- `--affino-chart-metric-background`
- `--affino-chart-metric-border`
- `--affino-chart-metric-label`
- `--affino-chart-metric-value`
- `--affino-chart-metric-unit`
- `--affino-chart-metric-delta-up`
- `--affino-chart-metric-delta-down`
- `--affino-chart-metric-delta-flat`
- `--affino-chart-metric-sparkline`

## Non-Goals

- No D3, Chart.js, Recharts, ECharts, or external chart rendering libraries.
- No `datagrid-sandbox` dependency.
- No `analytics-core` dependency.
- No stacked, grouped, horizontal, animated, smoothed, multi-series, advanced-label, nested, or sunburst charts yet.
