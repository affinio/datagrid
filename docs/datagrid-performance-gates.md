# Datagrid Performance Gates (AG Grid Target Track)

Date: `2026-02-07`  
Scope: `@affino/datagrid-core` + `@affino/datagrid-vue`

## Target SLA

The datagrid pipeline is gated by the following performance SLA targets:

- Scroll latency (`p95`): `<= 16ms` budget envelope (`target <= 12ms`).
- Selection drag smoothness: `>= 55 FPS` sustained under critical interactions.
- Overlay open/close reaction: `<= 2ms` synthetic controller/open-close proxy.
- Memory churn (heap delta) during benchmark run: `<= 80MB`.
- Variance control (`CV%`) for benchmark metrics: `<= 25%`.

These thresholds are set as fail-fast CI gates for benchmark and quality stages.

## Repeatable Benchmark Harness

Single entry-point harness:

- Local (exploratory):
  - `pnpm run bench:datagrid:harness`
- CI (gated):
  - `pnpm run bench:regression`

Harness script:
- `scripts/bench-datagrid-harness.mjs`

Per-benchmark outputs (JSON):
- `artifacts/performance/bench-vue-adapters.json`
- `artifacts/performance/bench-livewire-morph.json`
- `artifacts/performance/bench-datagrid-interactions.json`
- `artifacts/performance/bench-datagrid-datasource-churn.json`
- `artifacts/performance/bench-datagrid-derived-cache.json`
- `artifacts/performance/bench-datagrid-pivot-workload.json`
- `artifacts/performance/bench-datagrid-dependency-graph.json` (targeted dense dependency graph benchmark)
- `artifacts/performance/bench-datagrid-tree-workload.json`
- `artifacts/performance/bench-datagrid-tree-workload-matrix.json`
- `artifacts/performance/bench-datagrid-rowmodels.json`

Harness summary:
- `artifacts/performance/datagrid-benchmark-report.json`

Runtime report gate summary:
- `artifacts/quality/datagrid-benchmark-gates-report.json`
Baseline lock:
- `docs/perf/datagrid-benchmark-baseline.json`

## Budgets and Fail-Fast Rules

CI harness (`DATAGRID_BENCH_MODE=ci`) applies:

- `BENCH_SEEDS=1337,7331,2026`
- Vue adapters:
  - `PERF_BUDGET_TOTAL_MS=1400`
  - `PERF_BUDGET_MAX_BOOTSTRAP_MS=8`
  - `PERF_BUDGET_MAX_CONTROLLER_MS=30`
  - `PERF_BUDGET_MAX_RELAYOUT_MS=6`
- Laravel morph:
  - `ROOTS_PER_KIND=120`
  - `ITERATIONS=560`
  - `PERF_BUDGET_TOTAL_MS=9000`
  - `PERF_BUDGET_MAX_HYDRATE_RATE_PCT=25`
  - `PERF_BUDGET_MAX_OPEN_CLOSE_MS=2`
  - `PERF_BUDGET_OPEN_CLOSE_EXCLUDE_PACKAGES=treeview` (open/close proxy is overlay-oriented; treeview expansion is covered by tree workload gates)
- Row models (client/server/window-shift proxy):
  - `PERF_BUDGET_TOTAL_MS=9000`
  - `PERF_BUDGET_MAX_CLIENT_RANGE_P95_MS=5`
  - `PERF_BUDGET_MAX_CLIENT_RANGE_P99_MS=8`
  - `PERF_BUDGET_MAX_SERVER_RANGE_P95_MS=35`
  - `PERF_BUDGET_MAX_SERVER_RANGE_P99_MS=55`
  - `PERF_BUDGET_MAX_WINDOW_SHIFT_P95_MS=10`
  - `PERF_BUDGET_MAX_WINDOW_SHIFT_P99_MS=16`
  - synthetic source cache cap: `BENCH_SERVER_CACHE_BLOCK_LIMIT=96` (bounded server block cache in benchmark to avoid unbounded heap growth noise)
- Interaction models (selection/fill under virtualization proxy):
  - `PERF_BUDGET_TOTAL_MS=3500`
  - `PERF_BUDGET_MAX_SELECTION_DRAG_P95_MS=5`
  - `PERF_BUDGET_MAX_SELECTION_DRAG_P99_MS=8`
  - `PERF_BUDGET_MAX_FILL_APPLY_P95_MS=8`
  - `PERF_BUDGET_MAX_FILL_APPLY_P99_MS=14`
- Datasource churn (range pull churn + invalidation pressure):
  - `PERF_BUDGET_TOTAL_MS=9000`
  - `PERF_BUDGET_MAX_SCROLL_BURST_P95_MS=20`
  - `PERF_BUDGET_MAX_SCROLL_BURST_P99_MS=35`
  - `PERF_BUDGET_MAX_FILTER_BURST_P95_MS=22`
  - `PERF_BUDGET_MAX_FILTER_BURST_P99_MS=40`
  - `PERF_BUDGET_MIN_PULL_COALESCED=1`
  - `PERF_BUDGET_MIN_PULL_DEFERRED=1`
- Derived cache (stable cache + invalidation pressure):
  - `BENCH_DERIVED_CACHE_ROW_COUNT=50000`
  - `BENCH_DERIVED_CACHE_STABLE_ITERATIONS=180`
  - `BENCH_DERIVED_CACHE_INVALIDATED_ITERATIONS=90`
  - `BENCH_DERIVED_CACHE_MEASUREMENT_BATCH_SIZE=2`
  - `BENCH_DERIVED_CACHE_WARMUP_BATCHES=0`
  - `PERF_BUDGET_TOTAL_MS=9000`
  - `PERF_BUDGET_MAX_STABLE_P95_MS=9.5`
  - `PERF_BUDGET_MAX_INVALIDATED_P95_MS=18`
  - `PERF_BUDGET_MIN_STABLE_FILTER_HIT_RATE_PCT=80`
  - `PERF_BUDGET_MIN_STABLE_SORT_HIT_RATE_PCT=90`
  - `PERF_BUDGET_MIN_STABLE_GROUP_HIT_RATE_PCT=70`
  - `PERF_BUDGET_MIN_INVALIDATED_FILTER_MISSES=10`
- Pivot workload (pivot stage rebuild + patch frozen/reapply pressure):
  - `BENCH_PIVOT_ROW_COUNT=20000`
  - `BENCH_PIVOT_REBUILD_ITERATIONS=100`
  - `BENCH_PIVOT_PATCH_FROZEN_ITERATIONS=140`
  - `BENCH_PIVOT_PATCH_REAPPLY_ITERATIONS=80`
  - `BENCH_PIVOT_MEASUREMENT_BATCH_SIZE=2`
  - `BENCH_PIVOT_WARMUP_BATCHES=0`
  - `PERF_BUDGET_TOTAL_MS=9000`
  - `PERF_BUDGET_MAX_PIVOT_REBUILD_P95_MS=30`
  - `PERF_BUDGET_MAX_PIVOT_REBUILD_P99_MS=45`
  - `PERF_BUDGET_MAX_PIVOT_PATCH_FROZEN_P95_MS=8`
  - `PERF_BUDGET_MAX_PIVOT_PATCH_FROZEN_P99_MS=14`
  - `PERF_BUDGET_MAX_PIVOT_PATCH_REAPPLY_P95_MS=20`
  - `PERF_BUDGET_MAX_PIVOT_PATCH_REAPPLY_P99_MS=35`
  - `PERF_BUDGET_MIN_PIVOT_COLUMNS=2`
- Dependency graph (dense graph register/expand pressure; standalone assert command):
  - `PERF_BUDGET_MAX_REGISTER_MS=2500`
  - `PERF_BUDGET_MAX_STRUCTURAL_EXPAND_P95_MS=20`
  - `PERF_BUDGET_MAX_COMPUTED_EXPAND_P95_MS=20`
  - `PERF_BUDGET_MIN_STRUCTURAL_AFFECTED_MEAN=120`
  - `PERF_BUDGET_MIN_COMPUTED_AFFECTED_MEAN=160`
- Tree workload (deep hierarchy expand/filter/sort pressure):
  - `PERF_BUDGET_TOTAL_MS=9000`
  - `PERF_BUDGET_MAX_EXPAND_BURST_P95_MS=25`
  - `PERF_BUDGET_MAX_EXPAND_BURST_P99_MS=40`
  - `PERF_BUDGET_MAX_FILTER_SORT_BURST_P95_MS=18`
  - `PERF_BUDGET_MAX_FILTER_SORT_BURST_P99_MS=30`
- Shared:
  - `PERF_BUDGET_MAX_VARIANCE_PCT=25`
  - `PERF_BUDGET_MAX_HEAP_DELTA_MB=80`

Tree workload matrix profiles:
- CI blocking profile:
  - `pnpm run bench:datagrid:tree:matrix:assert:ci`
  - row scales: `10k, 25k`
- Nightly/stress profile:
  - `pnpm run bench:datagrid:tree:matrix:assert:nightly`
  - row scales: `10k, 25k, 50k, 100k`

Perf-contract fail-fast gate:
- `pnpm run quality:perf:datagrid`
- Script: `scripts/check-datagrid-perf-contracts.mjs`
- Report: `artifacts/quality/datagrid-perf-contracts-report.json`
- Includes static guard for benchmark harness task matrix (`vue-adapters`, `laravel-morph`, `interaction-models`, `datasource-churn`, `derived-cache`, `pivot-workload`, `tree-workload`, `row-models`) and mode-scoped budget wiring.

Fail-fast behavior:
- Harness exits non-zero when any benchmark fails budget checks.
- Runtime report gate (`scripts/check-datagrid-benchmark-report.mjs`) validates:
  - report freshness,
  - required suites presence (`vue-adapters`, `laravel-morph`, `interaction-models`, `datasource-churn`, `derived-cache`, `row-models`),
  - tree workload stress suite presence in harness report (`tree-workload`) with CI fail-fast through harness `ok` status,
  - harness report consistency (no duplicate task ids, valid durations, status/ok consistency),
  - presence and completeness of `budgets.byTask` map for required suites,
  - `ok=true` for harness summary and each required suite,
  - JSON artifact integrity for each suite,
  - per-suite artifact freshness,
  - finite CI variance/heap budgets in harness + per-suite artifacts,
  - no `Infinity` literals in CI budget payloads (shared + per-suite),
  - aggregate variance/heap envelopes against declared budgets,
  - baseline drift lock for per-task runtime/elapsed/heap envelopes (`docs/perf/datagrid-benchmark-baseline.json`).
- CI `quality-gates` parity lock run is blocking for merge readiness.

## CI Integration

Workflow:
- `.github/workflows/ci.yml`

Jobs:
- `quality-gates`: `quality:lock:datagrid:parity` (architecture acceptance + contracts + coverage + critical interaction checks + benchmark regression + parity e2e).

## Latest Result Status

Source of truth:
- CI artifact bundle `datagrid-quality-gates` from the latest pipeline run.

Status in this local environment:
- Benchmarks were not executed locally because `node/npm` are unavailable.
- Threshold enforcement is configured and active in CI.

Runtime perf-by-design contract reference:
- `docs/datagrid-perf-by-design-runtime.md`

## Optional Hardcore Stress Suite (Non-blocking)

For deep local stress runs (not part of CI blocking harness by default):

- `pnpm run bench:datagrid:hardcore`
- `pnpm run bench:datagrid:hardcore:assert`
- `pnpm run bench:datagrid:soak`
- `pnpm run bench:datagrid:soak:assert`
- `pnpm run bench:datagrid:group-depth`
- `pnpm run bench:datagrid:group-depth:assert`
- `pnpm run bench:datagrid:pivot:server-interop`
- `pnpm run bench:datagrid:pivot:server-interop:assert`
- `pnpm run bench:datagrid:browser-frames`
- `pnpm run bench:datagrid:browser-frames:assert`

Hardcore suite covers:

- cold start bootstrap envelopes (`10k/50k/100k`)
- massive sort stress
- filter profile stress (`30%`, `1%`, `0%` match)
- patch storm throughput + manual reapply latency
- determinism hash lock (same seed + same operation sequence => same output hash)

Additional optional suites cover:

- long-session soak/leak trends under mixed mutation + projection operations
- deep groupBy explosion scenarios (5+ levels, expand/collapse pressure)
- server-backed pivot pull path + pivot interop/export/import + drilldown latency
- browser frame pacing (`fps`, dropped frames, long-task frames) in real viewport scrolling

## Runtime Scroll Telemetry (Demo Layer)

The demo runtime now includes an adapter-level telemetry primitive:

- `useDataGridScrollPerfTelemetry` (`@affino/datagrid-orchestration`)
- Emits active-scroll snapshot metrics: `fps`, `avgFrameMs`, `droppedFrames`, `longTaskFrames`, and quality (`unknown` | `good` | `degraded`).
- Intended for local quality diagnostics and interaction tuning (not a replacement for CI benchmark gates).
