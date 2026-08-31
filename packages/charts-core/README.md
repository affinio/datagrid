# @affino/charts-core

Headless, renderer-independent chart geometry and public data contracts for Affino charts. The package has no runtime dependencies and does not calculate financial metrics.

## Time-series API

```ts
import {
  createTimeSeriesChartGeometry,
  resolveTimeSeriesTooltip,
  type TimeSeries,
  type TimeSeriesChartOptions,
  type TimeSeriesPoint,
} from "@affino/charts-core"

const series: TimeSeries[] = [
  {
    id: "balance",
    label: "Balance",
    data: [{ time: Date.UTC(2026, 0, 1), value: 10_000 }],
  },
  {
    id: "equity",
    label: "Equity",
    data: [{ time: Date.UTC(2026, 0, 1), value: 9_940 }],
  },
]

const options: TimeSeriesChartOptions = {
  series,
  size: { width: 800, height: 360 },
  timeAxis: { locale: "en-GB" },
  yAxis: { format: value => value.toFixed(2) },
}

const geometry = createTimeSeriesChartGeometry(options)
const tooltip = resolveTimeSeriesTooltip(series, Date.UTC(2026, 0, 1))
```

`TimeSeriesPoint.time` is a UTC Unix timestamp in milliseconds. Formatting always uses `Intl.DateTimeFormat` with `timeZone: "UTC"`; applications can provide `timeAxis.format(timestamp)` or UTC-safe `formatOptions`. Tick intervals and counts respond to plot width and cover intraday through multi-year spans.

All visible series share one time domain, numeric value domain, plot area, and tick model. `presentation.type` supports `"line"` and `"area"`. Area geometry uses zero as its baseline and naturally supports an underwater/drawdown presentation.

## Input contract

- Empty series and single-point series are supported.
- Values and timestamps must be finite numbers. `NaN`, `Infinity`, and `null` are rejected.
- Each series must be strictly timestamp-sorted; duplicate and unsorted timestamps are rejected.
- Series ids must be unique and labels must be non-empty.
- Missing points are represented by omission. Nullable points are not supported in V1.
- Input arrays and points are never mutated.
- No downsampling or decimation is performed. Geometry contains every supplied point.

`validateTimeSeries()` exposes the same validation used by geometry and tooltip helpers.

## Other public geometry

The package also exports generic bar, line, area, histogram, pie, scatter, band-scale, numeric-scale, layout, and metric-model helpers. `createBarChartGeometry()` includes zero by default and places positive and negative bars around the baseline. Histogram geometry is already public and remains a binned numeric-data primitive, not a financial calculation API.

## Package boundary

`@affino/charts-core` owns data validation, domains, scales, ticks, tooltip lookup, and geometry. `@affino/charts-vue` owns SVG/DOM rendering, interaction, responsive observation, accessibility, legends, tooltips, crosshair presentation, and themes.
