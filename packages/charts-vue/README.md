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

## Tooltip API

`tooltip` accepts `enabled`, `formatTime`, and `formatValue`. `tooltip-change` emits a timestamp plus every series value present at the selected timestamp. A custom renderer uses the public slot:

```vue
<AffinoTimeSeriesChart :series="series">
  <template #tooltip="{ tooltip }">
    <strong>{{ tooltip.formattedTimestamp }}</strong>
    <div v-for="entry in tooltip.entries" :key="entry.seriesId">
      {{ entry.seriesLabel }}: {{ entry.formattedValue }}
    </div>
  </template>
</AffinoTimeSeriesChart>
```

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
  }"
/>
```

Equivalent stable CSS custom properties are `--affino-chart-background`, `surface`, `border`, `grid`, `axis`, `text`, `muted-text`, `tooltip-background`, `tooltip-text`, `series-1` through `series-5`, `positive`, `negative`, `focus`, and `crosshair`. No internal selector or `!important` override is required.

## Responsive behavior and reactivity

`AffinoTimeSeriesChart` observes its own container by default, recalculating width-dependent geometry and tick density. Set `responsive="false"` for a fixed `width`. Changes to series data, series membership, visibility, formatting, theme, height, width, and container width are reactive.

## Additional components

The package continues to export `AffinoAreaChart`, `AffinoBarChart`, `AffinoChartFrame`, `AffinoChartLegend`, `AffinoHistogram`, `AffinoLineChart`, `AffinoMetricCard`, `AffinoPieChart`, and `AffinoScatterChart`.
