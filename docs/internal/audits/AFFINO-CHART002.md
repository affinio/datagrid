# AFFINO-CHART002 — Package Health and V1 Financial Time-Series API

## package_health_before

`@affino/charts-core@0.1.0` and `@affino/charts-vue@0.1.0` are sourced from `packages/charts-core` and `packages/charts-vue` in the pnpm 10 workspace. Core uses TypeScript `tsc`; Vue uses Vite library mode plus `vue-tsc`; both use Vitest. Before this slice, a clean packed consumer failed normal Node ESM import with `ERR_MODULE_NOT_FOUND` for `dist/data`.

## package_health_after

Core runtime imports use explicit `.js` relative specifiers. Both packages build, type-check, and test. Repository-native `pnpm pack` npm artifacts install in a clean project; public Node ESM imports, Vue declaration resolution, the public CSS subpath, and a Vite production build pass without flags or source imports.

## esm_failure_root_cause

The TypeScript core build emitted source-authored extensionless relative specifiers such as `./data`. Node ESM does not append file extensions. The failure was package output, not a consumer configuration issue.

## exports_contract

- `@affino/charts-core`: `.` maps ESM runtime to `dist/index.js` and types to `dist/index.d.ts`.
- `@affino/charts-vue`: `.` maps ESM runtime and types equivalently; Vue stays a peer dependency.
- `@affino/charts-vue/styles.css`: stable public CSS export to `dist/styles.css`.
- The pnpm release pack rewrites Vue.s `workspace:*` core dependency to the published numeric version; the tarball does not leak a workspace protocol.
- No internal subpaths were exported.

## public_api_v1

Core exports `TimeSeriesPoint`, `TimeSeries`, `TimeSeriesChartOptions`, geometry/tick/tooltip types, `validateTimeSeries`, `createTimeSeriesChartGeometry`, `createTimeAxisTicks`, `formatTimeAxisTick`, and `resolveTimeSeriesTooltip`. Vue exports `AffinoTimeSeriesChart`, theme types, tooltip types, and visibility events.

## time_series_contract

A point is `{ time, value }`, where `time` is a UTC Unix timestamp in milliseconds and both fields are finite numbers. A series has a unique `id`, non-empty `label`, ordered `data`, optional `visible`, and generic line/area presentation. Empty and single-point series are supported. Null points are not supported; missing observations are omitted.

## multi_series_contract

All visible series share one X domain, Y domain, plot area, axis model, tooltip lookup, crosshair, and legend. Each supplied point is retained. Balance/Equity does not stack chart instances.

## time_axis_contract

UTC is explicit. Formatting forces `timeZone: "UTC"`, accepts locale/options or a formatter callback, and never parses local date strings. Responsive tick selection covers seconds through multi-year calendar intervals and accepts target count/minimum spacing controls.

## tooltip_contract

Hover and keyboard focus resolve the nearest public timestamp and return every visible series value present at it. Consumers can use the built-in renderer, public formatting callbacks, `tooltip-change`, or the typed `tooltip` slot without inspecting renderer state.

## legend_contract

The built-in legend exposes series label and color. Keyboard/click activation toggles visibility and emits `series-visibility-change`.

## theme_contract

Reactive light/dark modes and a typed theme object cover background, surface, border, grid, axis, text, muted text, tooltip, series colors, positive, negative, focus, and crosshair. Values map to documented CSS custom properties.

## css_public_contract

Consumers import `@affino/charts-vue/styles.css`. Hashed `dist` paths and internal selectors are not part of the contract.

## balance_equity_example

`packages/charts-vue/examples/FinancialTimeSeriesExamples.vue` renders synthetic Balance and Equity data in one responsive chart with legend, tooltip, shared UTC axis, and reactive light/dark switching.

## drawdown_example

The same fixture supplies negative and zero drawdown values to a generic area series with percentage axis and tooltip formatting. The package does not calculate drawdown.

## returns_example

The fixture supplies monthly return values to `AffinoBarChart`. Positive/negative tokens, zero baseline, keyboard/hover tooltip, and percentage formatting are native.

## performance_baseline

Node v22.23.2, five iterations, two series, core SVG geometry/path generation only; browser paint is not included. Reproduce with `pnpm run bench:charts:time-series`. Raw results are in `artifacts/performance/charts-time-series-baseline.json`.

| Points/series | Rendered points | Initial median | Update median | Retained heap delta |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 2,000 | 1.13 ms | 0.53 ms | 0.60 MB |
| 10,000 | 20,000 | 4.76 ms | 5.20 ms | 5.17 MB |
| 50,000 | 100,000 | 30.37 ms | 39.54 ms | 25.82 MB |

These are local baseline measurements, not cross-device performance claims.

## ohlc_audit

`OHLC_RENDERER_EXTENSION_REQUIRED`. Shared domains, UTC ticks, tooltip lookup, theme, legend, and responsive ownership are reusable. Candlestick-specific typed OHLC validation and wick/body geometry/rendering are not present and should be a later bounded renderer extension.

## histogram_audit

Generic histogram geometry and `AffinoHistogram` already exist. No financial calculation semantics were added. Histogram did not block V1.

## annotation_marker_audit

Point, vertical-line, horizontal-line, and range annotation geometry/rendering are not yet public. Adding them would broaden hit testing, layering, accessibility, and label collision scope, so annotations are deferred rather than exposed as incomplete V1 APIs.

## crosshair_decision

A generic vertical crosshair is implemented as a documented `showCrosshair` Vue prop and follows public tooltip state. It has a stable theme token.

## renderer_decision

The existing headless geometry plus Vue SVG renderer cleanly supports the required multi-series, area, signed-bar, tooltip, legend, crosshair, and responsive contracts. No renderer rewrite or parallel manager was required.

## consumer_readiness

FxLab can implement Balance/Equity, supplied Drawdown, and supplied Periodic Returns with normal public imports. It does not need private imports, package patches, DOM mutation, multiple stacked charts, a custom time axis, custom tooltip engine, custom legend engine, or undocumented renderer state. An application wrapper may still compose layout/defaults and map semantic tokens.

## remaining_debt

- Annotation/marker primitives are deferred.
- OHLC needs a bounded renderer extension.
- Browser paint/frame benchmarks at 50,000 points are not yet a CI gate; the current baseline measures geometry/path creation.
- Arbitrary IANA display zones are not in V1; the time axis deliberately formats UTC only.

## conclusions

The required V1 use cases and package-health gates pass. Because optional annotations/OHLC and a browser-render performance gate remain, classification is `AFFINO_CHART_V1_PUBLIC_API_READY_WITH_LIMITATIONS`. Recommend `0.2.0` for both packages under the current pre-1.0 policy; do not publish automatically.
