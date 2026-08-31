# @affino/charts-vue

Vue 3 SVG chart components backed by `@affino/charts-core`.

## Install and styles

```ts
import { AffinoBarChart, AffinoTimeSeriesChart } from "@affino/charts-vue"
import "@affino/charts-vue/styles.css"
```

`@affino/charts-vue/styles.css` is the stable public CSS entry. Do not import hashed `dist` assets. Component geometry and behavior are self-contained; the stylesheet supplies documented light/dark theme tokens.

## Balance and equity

```vue
<script setup lang="ts">
import { AffinoTimeSeriesChart } from "@affino/charts-vue"
import "@affino/charts-vue/styles.css"
import type { TimeSeries } from "@affino/charts-core"

const series: TimeSeries[] = [
  {
    id: "balance",
    label: "Balance",
    data: [
      { time: Date.UTC(2026, 0, 1), value: 10_000 },
      { time: Date.UTC(2026, 1, 1), value: 10_480 },
    ],
  },
  {
    id: "equity",
    label: "Equity",
    data: [
      { time: Date.UTC(2026, 0, 1), value: 9_940 },
      { time: Date.UTC(2026, 1, 1), value: 10_620 },
    ],
  },
]

const currency = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
}).format(value)
</script>

<template>
  <AffinoTimeSeriesChart
    :series="series"
    title="Balance and equity"
    :y-axis="{ format: currency }"
    :tooltip="{ formatValue: currency }"
  />
</template>
```

The component renders all series in one SVG plot. Its built-in legend identifies series and toggles visibility. Hover, keyboard focus, Left/Right/Home/End navigation, the default tooltip, the `tooltip` slot, `tooltip-change`, and the crosshair use public data only.

Chart accessibility uses the SVG aria-label and description. When an explicit accessible label is present, the package omits the browser-native SVG title popup so it does not compete with the chart tooltip.

## Drawdown

The package accepts supplied drawdown data and never calculates it.

```vue
<AffinoTimeSeriesChart
  :series="[{
    id: 'drawdown',
    label: 'Drawdown',
    presentation: { type: 'area' },
    data: [
      { time: Date.UTC(2026, 0, 1), value: 0 },
      { time: Date.UTC(2026, 1, 1), value: -0.084 },
    ],
  }]"
  :y-axis="{ includeZero: true, format: value => `${(value * 100).toFixed(1)}%` }"
  :tooltip="{ formatValue: value => `${(value * 100).toFixed(1)}%` }"
/>
```

## Periodic returns

```vue
<AffinoBarChart
  :rows="[
    { month: 'Jan', value: 0.032 },
    { month: 'Feb', value: -0.018 },
    { month: 'Mar', value: 0 },
  ]"
  category-field="month"
  value-field="value"
  :value-formatter="value => `${(value * 100).toFixed(1)}%`"
/>
```

Positive and negative bars use separate theme tokens, geometry includes zero, and a built-in hover/focus tooltip uses the same formatter.

## Declarative time-series interaction

Time-series interaction is declarative and enabled by default. The chart owns pointer capture, coordinate conversion, nearest-X resolution, crosshair rendering, tooltip positioning, and keyboard navigation:

~~~vue
<AffinoTimeSeriesChart
  :series="series"
  :interaction="{
    snap: 'nearest',
    tooltip: {
      followPointer: true,
      constrainToChart: true,
      offsetX: 12,
      offsetY: 12,
    },
    crosshair: { snap: 'nearest' },
  }"
/>
~~~

The interaction pipeline is pointer client coordinates → chart-local coordinates → plot X → UTC domain value → nearest actual domain timestamp → shared crosshair and tooltip state. Nearest lookup uses binary search over the sorted shared visible domain. A tie resolves to the earlier timestamp. Pointer Y is not used for X resolution.

The shared domain is the union of visible series timestamps. Each visible series contributes an exact value at the resolved timestamp; missing observations are omitted, never interpolated. Hidden legend series do not participate. Duplicate or unsorted timestamps are rejected by the existing time-series validator.

`tooltip` also accepts `enabled`, `formatTime`, `formatValue`, `followPointer`, `constrainToChart`, `offsetX`, and `offsetY`. The tooltip follows the raw pointer while its values and crosshair use the resolved domain X. The measured tooltip is placed inside the chart root with a preferred right/below placement, horizontal/vertical flipping, and final clamping. The overlay has `pointer-events: none`, so crossing it does not cause hover flicker.

The `tooltip-change` payload is typed and includes `timestamp`, `domainValue`, formatted entries, `anchor` (plot/SVG coordinates), `pointer` (client, chart-root, and plot coordinates), and `placement`. A custom slot owns presentation only:

~~~vue
<AffinoTimeSeriesChart :series="series">
  <template #tooltip="{ tooltip }">
    <strong>{{ tooltip.formattedTimestamp }}</strong>
    <div v-for="entry in tooltip.entries" :key="entry.seriesId">
      {{ entry.seriesLabel }}: {{ entry.formattedValue }}
    </div>
  </template>
</AffinoTimeSeriesChart>
~~~

When focused, the chart initially selects the middle timestamp. Left/Right move through the shared domain; Home/End select the first/last timestamp. Pointer and keyboard input update the same active state. Pointer leave and blur clear the transient interaction.

## Time and numeric axes

`timeAxis` accepts `locale`, `targetTickCount`, `minTickSpacing`, `format`, and `formatOptions`. Timestamps are UTC Unix milliseconds and are never converted through local calendar parsing. `yAxis.includeZero` and `yAxis.format` control the generic numeric axis for positive, negative, zero, decimal, currency, and percentage values.

## Themes

Use `theme="light"`, `theme="dark"`, or a reactive theme object. Data does not need to be recreated when themes change.

```vue
<AffinoTimeSeriesChart
  :series="series"
  :theme="{
    mode: 'dark',
    background: 'var(--app-surface)',
    grid: 'var(--app-border)',
    axis: 'var(--app-muted)',
    text: 'var(--app-text)',
    tooltipBackground: 'var(--app-overlay)',
    tooltipText: 'var(--app-overlay-text)',
    seriesColors: ['var(--app-accent)', 'var(--app-success)'],
    positive: 'var(--app-positive)',
    negative: 'var(--app-negative)',
    focus: 'var(--app-focus)',
    crosshair: 'var(--app-muted)',
    crosshairWidth: 1,
    crosshairDash: "4 3",
    crosshairOpacity: 0.85,
    tooltipSecondaryText: "var(--app-muted)",
    tooltipBorder: "var(--app-border)",
  }"
/>
```

Equivalent stable CSS custom properties include `--affino-chart-background`, `--affino-chart-surface`, `--affino-chart-border`, `--affino-chart-grid`, `--affino-chart-axis`, `--affino-chart-text`, `--affino-chart-muted-text`, `--affino-chart-tooltip-background`, `--affino-chart-tooltip-text`, `--affino-chart-tooltip-secondary-text`, `--affino-chart-tooltip-border`, `--affino-chart-tooltip-shadow`, `--affino-chart-series-1` through `--affino-chart-series-5`, `--affino-chart-positive`, `--affino-chart-negative`, `--affino-chart-focus`, `--affino-chart-crosshair`, `--affino-chart-crosshair-width`, `--affino-chart-crosshair-dash`, and `--affino-chart-crosshair-opacity`. No internal selector or `!important` override is required.

## Responsive behavior and reactivity

`AffinoTimeSeriesChart` observes its own container by default, recalculating width-dependent geometry and tick density. Set `responsive="false"` for a fixed `width`. Changes to series data, series membership, visibility, formatting, theme, height, width, and container width are reactive.

## Additional components

The package continues to export `AffinoAreaChart`, `AffinoBarChart`, `AffinoChartFrame`, `AffinoChartLegend`, `AffinoHistogram`, `AffinoLineChart`, `AffinoMetricCard`, `AffinoPieChart`, and `AffinoScatterChart`.
