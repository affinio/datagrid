# @affino/charts-core

Headless chart geometry and model helpers for Affino chart features.

`@affino/charts-core` turns chart-ready rows into plain TypeScript data structures: plot areas, scales, SVG path strings, chart geometry, and KPI models. It does not render anything and does not depend on Vue, React, the DOM, SVG components, Canvas, WebGL, D3, Chart.js, Recharts, ECharts, or application packages.

`@affino/charts-vue` uses this package as its calculation layer and owns Vue rendering, interaction, styling, accessibility, and component state.

## Package Boundaries

- `@affino/analytics-core` prepares, filters, groups, and aggregates datasets.
- `@affino/charts-core` expects chart-ready rows and converts them into geometry or models.
- Rendering packages, such as `@affino/charts-vue`, should consume these geometry/model outputs and render them for a specific UI framework.

Current non-goals:

- No Vue, React, DOM, Canvas, WebGL, or renderer components.
- No D3, Chart.js, Recharts, ECharts, or external chart dependencies.
- No dependency on `@affino/analytics-core`.
- No dependency on `@affino/datagrid-sandbox`.
- No multi-series charts yet.
- No stacked or grouped bars yet.
- No date/time scale yet.
- No legends, labels, tooltips, smoothing, clustering, or trendlines yet.

## Public API Overview

Base types:

- `ChartDatum`
- `ChartSize`
- `ChartMargin`
- `ChartRect`
- `ChartPoint`
- `ChartNumericDomain`

Data access helpers:

- `isFiniteChartNumber(value)`
- `getChartStringValue(row, field)`
- `getChartNumberValue(row, field)`

Layout helpers:

- `DEFAULT_CHART_MARGIN`
- `resolveChartMargin(margin)`
- `resolveChartPlotArea(size, margin)`

Scale helpers:

- `computeChartNumericDomain(values, options)`
- `normalizeChartValue(value, domain)`
- `createChartLinearScale(domain, range)`
- `createChartBandScale(options)`

Geometry and model helpers:

- `createBarChartGeometry(options)`
- `createLineChartGeometry(options)`
- `createPieChartGeometry(options)`
- `createScatterChartGeometry(options)`
- `createAreaChartGeometry(options)`
- `createHistogramGeometry(options)`
- `createMetricModel(options)`

## Examples

### Bar Geometry

```ts
import { createBarChartGeometry } from "@affino/charts-core"

const geometry = createBarChartGeometry({
  rows: [
    { region: "UK", revenue: 120 },
    { region: "EU", revenue: 180 },
  ],
  categoryField: "region",
  valueField: "revenue",
  size: { width: 640, height: 360 },
})

console.log(geometry.bars)
```

### Line Geometry

```ts
import { createLineChartGeometry } from "@affino/charts-core"

const geometry = createLineChartGeometry({
  rows: [
    { monthIndex: 0, revenue: 120 },
    { monthIndex: 1, revenue: 180 },
    { monthIndex: 2, revenue: 160 },
  ],
  xField: "monthIndex",
  yField: "revenue",
  xScaleType: "number",
  size: { width: 640, height: 360 },
})

console.log(geometry.path)
```

### Pie Or Donut Geometry

```ts
import { createPieChartGeometry } from "@affino/charts-core"

const geometry = createPieChartGeometry({
  rows: [
    { channel: "Direct", users: 240 },
    { channel: "Search", users: 360 },
  ],
  categoryField: "channel",
  valueField: "users",
  innerRadiusRatio: 0.55,
  size: { width: 360, height: 360 },
})

console.log(geometry.slices.map((slice) => slice.path))
```

### Metric Model

```ts
import { createMetricModel } from "@affino/charts-core"

const metric = createMetricModel({
  label: "Conversion",
  value: 0.125,
  previousValue: 0.1,
  format: "percent",
  precision: 1,
})

console.log(metric.displayValue, metric.delta)
```

### Histogram Geometry

```ts
import { createHistogramGeometry } from "@affino/charts-core"

const geometry = createHistogramGeometry({
  rows: [
    { loadTimeMs: 120 },
    { loadTimeMs: 180 },
    { loadTimeMs: 240 },
  ],
  valueField: "loadTimeMs",
  binCount: 8,
  size: { width: 640, height: 360 },
})

console.log(geometry.bins)
```

## Boundary Audit

Current package state:

- Runtime dependencies: none.
- Dev dependencies: `vitest` only.
- Public exports are chart-generic types, helpers, geometry generators, and KPI model helpers.
- No source imports from Vue, DOM APIs, D3, Chart.js, Recharts, ECharts, `@affino/datagrid-sandbox`, or `@affino/analytics-core`.
- Package output is ESM with `dist` and type exports.

Validation expected for changes:

```sh
pnpm --filter @affino/charts-core type-check
pnpm --filter @affino/charts-core test
pnpm --filter @affino/charts-core build
git diff --check
```
