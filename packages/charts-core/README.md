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

## Indexed interaction lookup

Use `createTimeSeriesTooltipResolver(series)` when resolving more than one pointer/focus update. It builds the sorted union of visible timestamps once, resolves nearest X with binary search, and returns exact values for visible series at that X:

~~~ts
const resolver = createTimeSeriesTooltipResolver(series)
const tooltip = resolver.resolve(pointerTimestamp)
~~~

`resolveNearestTimeSeriesTimestamp()` uses actual timestamp distance. Exact matches win, bounds clamp to the first/last timestamp, and an equal-distance tie chooses the earlier timestamp. Missing series observations are omitted; no interpolation is performed.

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

## HLOC geometry

`createHlocChartGeometry()` accepts strictly timestamp-sorted `{ time, high, low, open, close }` points. It maps each point to a vertical high-low range with an open tick extending left and a close tick extending right; rising, falling, and flat directions are exposed for presentation. It does not calculate trading metrics or add trading semantics.

HLOC overlays use the same geometry and scales:

```ts
const geometry = createHlocChartGeometry({
  data: candles,
  overlays: [{
    id: "moving-average",
    label: "Moving average",
    data: [{ time: Date.UTC(2026, 0, 1), value: 12.4 }],
    presentation: { color: "#9333ea", lineWidth: 2 },
  }],
  markers: [{
    id: "entry-1",
    label: "Entry",
    time: Date.UTC(2026, 0, 1, 12),
    value: 12.1,
  }],
  size: { width: 800, height: 360 },
})
```

`HlocChartOptions.overlays` accepts the existing `TimeSeries` contract. Series and markers are validated for finite numeric values, non-empty ids/labels, unique ids, and strictly increasing series timestamps. Marker timestamps may repeat; their supplied order is preserved. The candle timestamps define the shared UTC time domain; overlay points and markers outside the first/last candle are omitted and do not expand either domain. Visible overlay values and in-range marker values participate in the shared price domain, so they are not clipped. Empty inputs are valid; hidden series do not participate in geometry. No interpolation or downsampling is performed.

## Package boundary

`@affino/charts-core` owns data validation, domains, scales, ticks, tooltip lookup, and geometry. `@affino/charts-vue` owns SVG/DOM rendering, interaction, responsive observation, accessibility, legends, tooltips, crosshair presentation, and themes.
