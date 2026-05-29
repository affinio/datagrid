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
- `artifacts/performance/bench-datagrid-enterprise-browser-frames.json`
- `artifacts/performance/bench-datagrid-enterprise-a11y-browser.assert.json`

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
  - `PERF_BUDGET_MAX_VARIANCE_PCT=90`
  - synthetic source cache cap: `BENCH_SERVER_CACHE_BLOCK_LIMIT=96` (bounded server block cache in benchmark to avoid unbounded heap growth noise)
- Interaction models (selection/fill under virtualization proxy):
  - `PERF_BUDGET_TOTAL_MS=3500`
  - `PERF_BUDGET_MAX_SELECTION_DRAG_P95_MS=5`
  - `PERF_BUDGET_MAX_SELECTION_DRAG_P99_MS=8`
  - `PERF_BUDGET_MAX_FILL_APPLY_P95_MS=8`
  - `PERF_BUDGET_MAX_FILL_APPLY_P99_MS=14`
  - `PERF_BUDGET_MAX_MULTI_RANGE_LOOKUP_P95_MS=1`
  - `PERF_BUDGET_MAX_MULTI_RANGE_LOOKUP_P99_MS=2`
  - `PERF_BUDGET_MAX_SELECTION_OVERLAY_P95_MS=4`
  - `PERF_BUDGET_MAX_SELECTION_OVERLAY_P99_MS=8`
- Selection rendering lookup:
  - Additive range cell predicates use row-bucketed lookup for ranges spanning up to `256` rows.
  - The lookup indexes up to `50,000` row buckets per selection snapshot; taller or overflow ranges remain in a fallback list.
  - The interaction benchmark includes `multi-range-lookup-proxy` with `BENCH_MULTI_RANGE_COUNT=2000` by default.
- Selection overlay planning:
  - The interaction benchmark includes `selection-overlay-proxy`, which builds active/additive range segments across left-pinned, center, and right-pinned panes.
  - CI gates p95 and p99 overlay planning with `PERF_BUDGET_MAX_SELECTION_OVERLAY_P95_MS` and `PERF_BUDGET_MAX_SELECTION_OVERLAY_P99_MS`.
- Selection summary and aggregate labels:
  - Local selected-cell summary work is capped at `50,000` processed cells per summary.
  - Virtual selections must use loaded/missing interval metadata when present instead of probing every unloaded row.
  - App aggregate labels must distinguish full selected count from loaded/local cells included in the aggregate and append `budgeted` when the local cap is reached.
  - Server-global summary over unloaded rows remains a datasource operation, not a local fallback.
- Enterprise selection operations:
  - `bench:datagrid:enterprise:selection:assert` runs the smoke enterprise workload with hard selection budgets for summary planning, virtual coverage, clipboard planning, and overlay planning.
  - The scenario artifact is `artifacts/performance/bench-datagrid-enterprise-selection-operations.json`; the combined assert artifact is `artifacts/performance/bench-datagrid-enterprise-selection.assert.json`.
  - `bench:datagrid:enterprise:clipboard:assert` runs the smoke enterprise workload with a larger materialized copy/paste shape and hard budgets for copy creation, TSV parser cost, paste payload creation, paste patch application, and total paste latency.
  - `bench:datagrid:enterprise:clipboard:browser:assert` runs a focused Chromium scenario with granted clipboard permissions and hard budgets for `navigator.clipboard.writeText`, `readText`, and round-trip latency.
  - Clipboard enterprise gates currently cover planning budgets, materialized copy/paste row-model budgets, TSV parser cost, browser clipboard read/write latency, app remount/status contract coverage, and the coarse-pointer long-press plus keyboard shortcut copy/paste path. Real-device mobile clipboard workflows remain planned gates.

## Pointer Preview Frame Budget

Current app-stage pointer previews use direct mousemove application for drag selection, fill, and range move, with auto-scroll running in `requestAnimationFrame`. This is acceptable only while the hot path stays bounded:

- Global pointer lifecycle must keep both explicit modes covered: `pointerPreviewApplyMode: "sync"` applies immediately and `"raf"` coalesces preview work to one callback per frame.
- Pointer auto-scroll may read each viewport layout/scroll metric at most once per animation frame before applying scroll deltas and active preview.
- App-stage pointer listeners should stay active only while a pending or active pointer owner exists.
- With `dgPerfTrace=1`, interaction diagnostics expose `interactionOwner`, `interactionCancel`, `interactionPreview`, `interactionAutoScroll`, `interactionPreventDefault`, and `stageFocusRestore` samples. `scripts/bench-datagrid-enterprise-browser-frames.mjs` consumes these scopes in profile-gated interaction scenarios for drag selection, pinned-pane drag selection, fill auto-scroll, range-move auto-scroll, resize drag, and context menu open/cleanup.
- Interaction frame budgets are profile-scoped through `BENCH_INTERACTION_DEVICE_PROFILE`. `desktop-ci` is the default hard-fail profile and uses `PERF_BUDGET_MAX_INTERACTION_PREVIEW_P95_MS=8`, `PERF_BUDGET_MAX_INTERACTION_AUTOSCROLL_P95_MS=12`, `PERF_BUDGET_MAX_INTERACTION_FOCUS_RESTORE_MAX_MS=4`, and `PERF_BUDGET_MAX_INTERACTION_SCROLL_DRIFT_PX=2`. `touch-tablet-ci` uses `12`, `18`, `6`, and `3`; `touch-phone-ci` uses `14`, `20`, `7`, and `4`. These are automated Chromium profile gates, not a substitute for hardware validation.
- `BENCH_INTERACTION_FAIL_ON_WARNINGS` defaults to `true` for the built-in profiles. Set it to `false` only for exploratory local observation runs.
- Hard-fail scripts: `pnpm run bench:datagrid:enterprise:browser-frames:assert` for desktop Chromium and `pnpm run bench:datagrid:enterprise:browser-frames:touch:assert` for tablet/coarse-pointer Chromium.
- Enterprise browser-frame assert scripts set `BENCH_BROWSER_RESOURCE_FAIL_ON_WARNINGS=true`, so frame p95/p99, dropped-frame percentage, long-task count, long-task total, max long task, and heap resource warnings are blocking in addition to interaction warnings.
- Focused scroll script: `pnpm run bench:datagrid:enterprise:scroll:assert` runs vertical, smooth vertical, horizontal, and combined browser scenarios with hard browser-resource budgets.
- Focused interaction-frame script: `pnpm run bench:datagrid:enterprise:interaction-frame:assert` runs sort, inline-edit burst, and context-menu scenarios with hard browser-resource, interaction, sort-diagnostic, and edit-burst diagnostic budgets. The artifact reports edit update/open/commit/paint/frame/mutation/long-task diagnostics so inline-edit cleanup can be targeted without broad runtime rewrites.
- CI `benchmark-gates` must run `pnpm exec playwright install --with-deps chromium` before `pnpm run bench:regression`; `quality:perf:datagrid` statically verifies this wiring so browser-frame gates do not start without the Chromium runtime.
- Browser-frame direct scroll scenarios write at most one scroll position per animation frame. `BENCH_BROWSER_STEP_DELAY_MS` adds delay above a frame, but must not busy-loop scroll writes faster than paint cadence because CI Chromium coalesces rAF and reports synthetic `150ms+` frame gaps that do not describe DataGrid render cost.
- Virtualization browser gates:
  - Current supported and partial virtualization guarantees are summarized in `docs/datagrid-virtualization-support-matrix.md`.
  - `bench:datagrid:enterprise:virtualization:assert` runs focused vertical, smooth vertical, horizontal, explicit `wide-table-1k-pinned-horizontal` and `wide-table-10k-pinned-horizontal`, and server placeholder browser scenarios. Vertical and placeholder scenarios run at `100k` rows; wide horizontal scenarios run with pinned panes and bounded rendered-column budgets.
  - The CI harness includes `enterprise-browser-frames` with the focused virtualization and rendering scenario sets plus row/column overrides.
  - `BENCH_BROWSER_SCENARIOS` can narrow enterprise browser scenarios for local or CI runs.
- `pnpm run bench:datagrid:enterprise:browser-frames:compare -- <baseline.json> <candidate.json> [scenario ...]` compares artifacts with the same frame, long-task, flush, churn, text-mutation, and blank-viewport fields used during local before/after perf slices.
  - Hard virtualization budgets use `BENCH_VIRTUALIZATION_FAIL_ON_WARNINGS=true` and cover `PERF_BUDGET_MAX_VIRTUALIZATION_VIEWPORT_UPDATE_P95_MS=180`, `PERF_BUDGET_MAX_VIRTUALIZATION_RANGE_RESOLVE_P95_MS=10`, `PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_ROWS_P95=180`, `PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_COLUMNS_P95=160`, `PERF_BUDGET_MAX_VIRTUALIZATION_BLANK_VIEWPORTS=0`, and `PERF_BUDGET_MAX_VIRTUALIZATION_PLACEHOLDER_ROWS=220`. Browser-resource budgets such as `PERF_BUDGET_MAX_FRAME_P95_MS`, dropped-frame percentage, long-task count, and heap delta remain reported as warnings unless `BENCH_BROWSER_RESOURCE_FAIL_ON_WARNINGS=true` is set.
  - The same hard-fail profile records render churn under `churnTelemetry` and gates per-scroll-write row/cell mounts and unmounts through `PERF_BUDGET_MAX_RENDER_ROW_MOUNTS_PER_SCROLL_WRITE=220`, `PERF_BUDGET_MAX_RENDER_ROW_UNMOUNTS_PER_SCROLL_WRITE=220`, `PERF_BUDGET_MAX_RENDER_CELL_MOUNTS_PER_SCROLL_WRITE=30000`, and `PERF_BUDGET_MAX_RENDER_CELL_UNMOUNTS_PER_SCROLL_WRITE=30000`.
- Accessibility browser gate:
  - `bench:datagrid:enterprise:a11y:browser:assert` runs the `a11y-large-grid-scroll` Chromium scenario at `50k` rows and `64` columns with vertical and horizontal scroll.
  - The gate reuses virtualization and resource budgets, sets `BENCH_A11Y_FAIL_ON_WARNINGS=true`, and writes `artifacts/performance/bench-datagrid-enterprise-a11y-browser.assert.json`.
  - A11Y diagnostics assert the stage-native normal-mode tab-stop invariant, absence of app-stage `aria-activedescendant`, resolvable ARIA id references, no duplicate mounted ids, stable header/body ids, matching rendered row/column indexes, and bounded rendered ARIA node/attribute counts.
- Benchmark gates remain `PERF_BUDGET_MAX_SELECTION_DRAG_P95_MS=5` and `PERF_BUDGET_MAX_SELECTION_DRAG_P99_MS=8`; broaden these only with benchmark evidence.
- Rendering contracts and future gates:
  - Public `cellRenderer` and `groupCellRenderer` callbacks run synchronously inside the Vue render pass for rendered center and pinned cells.
  - Renderer authoring expectations are documented in `packages/datagrid-vue-app/README.md`: pure output, no grid-state mutation during render, no synchronous layout reads, stable child VNode keys, bounded per-cell work, and placeholder-aware `surface.kind` handling.
  - Throwing authored renderers fall back to the resolved display value for the affected cell; with `dgPerfTrace=1`, failed renderer samples include `rendererError: 1`.
  - With `dgPerfTrace=1`, the app stage records `stageRenderWindow`, `cellRenderer`, and `groupCellRenderer` samples; `scripts/bench-datagrid-enterprise-browser-frames.mjs` extracts render-window and renderer-duration aggregates under `renderTelemetry`.
  - Browser-frame vertical and horizontal diagnostics extract MutationObserver row/cell mount and unmount counts under `churnTelemetry`, so churn can be reviewed beside `renderTelemetry`.
  - Browser-frame vertical diagnostics classify `stageWindowFlush` samples under `stageWindowFlushTelemetry`, separating large row-window jumps, single-step window shifts, row-identity replacements, row-count changes, spacer-only changes, and unchanged flushes for follow-up architecture slices.
- Browser-frame vertical diagnostics also aggregate per-scroll-write frame attribution under `scrollFrameAttribution`, correlating each scroll write window with slow frame count, long tasks, mutation callbacks, row/cell mount churn, and opt-in text-node mutation counts (`BENCH_BROWSER_OBSERVE_CHARACTER_DATA=true`) so jump-scroll frame regressions can be reviewed without masking telemetry.
  - Chrome canvas draw work is sampled as `chromeDraw` and extracted under `chromeTelemetry`; overlay segment/lane computation is sampled as `overlayCompute` and extracted under `overlayTelemetry`.
  - The enterprise browser-frame benchmark includes rendering scenarios for `rendering-plain-100k`, `rendering-slow-custom-renderers`, `rendering-wide-pinned-horizontal`, `rendering-auto-height-custom-renderers`, and `rendering-overlay-heavy-selection-fill`.
  - The rendering scenarios cover a 100k-row plain baseline, 100k-row slow custom renderers, 1000-column pinned horizontal scroll, auto-height custom renderers, and overlay-heavy custom overlays. Selection and fill pointer preview costs are covered by the interaction browser scenarios.
  - CI harness mode sets `BENCH_RENDERING_FAIL_ON_WARNINGS=true`; missing render-window, chrome draw, renderer invocation, pinned-column, overlay telemetry, or renderer-duration budgets fails the enterprise browser-frame task.
  - Renderer duration budgets are controlled by `PERF_BUDGET_MAX_CELL_RENDERER_P95_MS` and `PERF_BUDGET_MAX_GROUP_CELL_RENDERER_P95_MS`.
  - The sandbox benchmark route accepts perf-only query profiles (`renderProfile=slow-custom-renderers|overlay-heavy`, `pinnedProfile=wide-pinned`) so the gates exercise production DataGrid rendering paths without adding a separate benchmark app.
- Datasource churn (range pull churn + invalidation pressure):
  - `PERF_BUDGET_TOTAL_MS=9000`
  - `PERF_BUDGET_MAX_SCROLL_BURST_P95_MS=20`
  - `PERF_BUDGET_MAX_SCROLL_BURST_P99_MS=35`
  - `PERF_BUDGET_MAX_FILTER_BURST_P95_MS=22`
  - `PERF_BUDGET_MAX_FILTER_BURST_P99_MS=40`
  - `PERF_BUDGET_MIN_PULL_COALESCED=1`
  - `PERF_BUDGET_MIN_PULL_DEFERRED=1`
  - `PERF_BUDGET_MAX_SCROLL_PULL_REQUESTED=3800`
  - `PERF_BUDGET_MAX_SCROLL_PULL_ABORTED=1300`
  - `PERF_BUDGET_MAX_SCROLL_PULL_DROPPED=1300`
  - `PERF_BUDGET_MAX_SCROLL_ROW_CACHE_EVICTED=330000`
  - `PERF_BUDGET_MAX_FILTER_PULL_REQUESTED=3500`
  - `PERF_BUDGET_MAX_FILTER_PULL_ABORTED=1450`
  - `PERF_BUDGET_MAX_FILTER_PULL_DROPPED=750`
  - `PERF_BUDGET_MAX_FILTER_ROW_CACHE_EVICTED=60000`
  - `BENCH_DS_CHURN_PLACEHOLDER_LATENCY_MS=4`
  - `BENCH_DS_CHURN_PLACEHOLDER_ITERATIONS=12`
  - `PERF_BUDGET_MAX_PLACEHOLDER_EXPOSURE_MAX_MS=80`
  - `PERF_BUDGET_MAX_VIEWPORT_DATA_AVAILABILITY_MAX_MS=100`
  - `PERF_BUDGET_MIN_PLACEHOLDER_EXPOSURE_EVENTS=1`
  - `PERF_BUDGET_MAX_PLACEHOLDER_BLANK_VIEWPORT_EVENTS=2500`
  - `PERF_BUDGET_MIN_VIEWPORT_CACHE_HIT_RATIO=0.65`
  - `PERF_BUDGET_MAX_VIEWPORT_CACHE_MISS_ROWS=240`
  - `PERF_BUDGET_MAX_PULL_DURATION_MAX_MS=80`
  - `PERF_BUDGET_MIN_PLACEHOLDER_RETRY_SUCCESSES=12`
  - `PERF_BUDGET_MIN_STALE_RETAINED_ROWS=1900`
  - `PERF_BUDGET_PLACEHOLDER_FAIL_ON_WARNINGS=true`
  - Pull request, abort, dropped-pull, row-cache eviction, placeholder exposure, viewport availability, cache-hit/miss, pull-duration, retry, and stale-retention budgets are hard failures in `bench:datagrid:datasource-churn:assert`.
  - Heap drift is sampled with `--expose-gc` and post-GC ticks so the gate tracks retained datasource churn instead of nursery collection timing.
  - Server datasource browser artifacts include placeholder exposure, viewport data availability, blank viewport events, viewport cache hit/miss ratio, and pull duration. `bench:datagrid:enterprise:virtualization:assert` hard-fails the server placeholder subset with `PERF_BUDGET_MAX_SERVER_PLACEHOLDER_EXPOSURE_MS=450`, `PERF_BUDGET_MAX_SERVER_VIEWPORT_AVAILABILITY_MS=550`, `PERF_BUDGET_MAX_SERVER_BLANK_VIEWPORT_EVENTS=4`, `PERF_BUDGET_MAX_SERVER_CACHE_MISS_ROWS=600`, and `PERF_BUDGET_MAX_SERVER_PULL_DURATION_MS=550`.
  - The controlled-latency placeholder scenario covers cold scroll, warm scroll, direction reversal, jump scroll, and retry after a failed pull.
- Derived cache (stable cache + invalidation pressure):
  - `BENCH_DERIVED_CACHE_ROW_COUNT=50000`
  - `BENCH_DERIVED_CACHE_STABLE_ITERATIONS=180`
  - `BENCH_DERIVED_CACHE_INVALIDATED_ITERATIONS=90`
  - `BENCH_DERIVED_CACHE_MEASUREMENT_BATCH_SIZE=2`
  - `BENCH_DERIVED_CACHE_WARMUP_BATCHES=0`
  - `PERF_BUDGET_TOTAL_MS=9000`
  - `PERF_BUDGET_MAX_STABLE_P95_MS=22`
  - `PERF_BUDGET_MAX_INVALIDATED_P95_MS=40`
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
  - `PERF_BUDGET_MAX_PIVOT_PATCH_FROZEN_P95_MS=12`
  - `PERF_BUDGET_MAX_PIVOT_PATCH_FROZEN_P99_MS=14`
  - `PERF_BUDGET_MAX_PIVOT_PATCH_REAPPLY_P95_MS=30`
  - `PERF_BUDGET_MAX_PIVOT_PATCH_REAPPLY_P99_MS=35`
  - `PERF_BUDGET_MIN_PIVOT_COLUMNS=2`
- Pivot server interop (server pivot pull + export/import/drilldown pressure):
  - `pnpm run bench:datagrid:pivot:server-interop:assert`
  - `BENCH_SERVER_PIVOT_ROW_COUNT=30000`
  - `BENCH_SERVER_PIVOT_ITERATIONS=80`
  - `PERF_BUDGET_MAX_SERVER_PIVOT_PULL_P95_MS=500`
  - `PERF_BUDGET_MAX_EXPORT_INTEROP_P95_MS=400`
  - `PERF_BUDGET_MAX_IMPORT_LAYOUT_P95_MS=280`
  - `PERF_BUDGET_MAX_DRILLDOWN_P95_MS=160`
  - `PERF_BUDGET_MIN_INTEROP_ROWS=5`
  - `PERF_BUDGET_MIN_PIVOT_COLUMNS=20`
- Formula engine:
  - `pnpm run bench:datagrid:formula-engine:assert`
  - `pnpm run bench:datagrid:formula-engine:worker:assert`
  - `pnpm run bench:datagrid:formula-backends:assert`
  - Formula asserts cover small/medium/large DAGs, full recompute, incremental patch recompute, compile iterations, heap delta, worker-owned parity, and backend comparisons.
  - Async formulas, automatic volatile invalidation, and server-backed formula execution are not benchmarked as shipped behavior because they are unsupported until a public contract is approved.
- Spreadsheet workbook snapshot/restore:
  - `pnpm run bench:datagrid:spreadsheet-workbook:assert`
  - `BENCH_SPREADSHEET_ORDERS_ROW_COUNT=16000`
  - `BENCH_SPREADSHEET_CUSTOMER_COUNT=4000`
  - `BENCH_SPREADSHEET_JOIN_FANOUT=3`
  - `PERF_BUDGET_MAX_EXPORT_P95_MS=50`
  - `PERF_BUDGET_MAX_RESTORE_P95_MS=425`
  - `PERF_BUDGET_MAX_SNAPSHOT_BYTES=12500000`
  - `PERF_BUDGET_MAX_SHEET_STATE_BYTES=12500000`
  - Same-shape restore reuses the existing workbook structure and applies in-place cell input patches; structural restores still fall back to full rebuild.
- Dependency graph (dense graph register/expand pressure; standalone assert command):
  - `PERF_BUDGET_MAX_REGISTER_MS=2500`
  - `PERF_BUDGET_MAX_STRUCTURAL_EXPAND_P95_MS=20`
  - `PERF_BUDGET_MAX_COMPUTED_EXPAND_P95_MS=20`
  - `PERF_BUDGET_MIN_STRUCTURAL_AFFECTED_MEAN=120`
  - `PERF_BUDGET_MIN_COMPUTED_AFFECTED_MEAN=160`
- Tree workload (deep hierarchy expand/filter/sort pressure):
  - `PERF_BUDGET_TOTAL_MS=9000`
  - `PERF_BUDGET_MAX_EXPAND_BURST_P95_MS=35`
  - `PERF_BUDGET_MAX_EXPAND_BURST_P99_MS=60`
  - `PERF_BUDGET_MAX_FILTER_SORT_BURST_P95_MS=50`
  - `PERF_BUDGET_MAX_FILTER_SORT_BURST_P99_MS=65`
  - Tree value-only patches use dependency fields to avoid structural cache invalidation. When changed row ids are known, path and parent tree caches patch only the affected cached row entries and dirty aggregate ancestors instead of walking every branch.
  - Pivot patching has an incremental same-bucket tier: patches that touch pivot axis fields may still use the incremental path when normalized row/column bucket keys stay stable; bucket-changing patches fall back to full rebuild.
- Shared:
  - `PERF_BUDGET_MAX_VARIANCE_PCT=60`
  - `PERF_BUDGET_MAX_HEAP_DELTA_MB=140`

Tree workload matrix profiles:
- CI blocking profile:
  - `pnpm run bench:datagrid:tree:matrix:assert:ci`
  - row scales: `10k, 25k, 100k`
  - 100k budgets: expand p95/p99 `12/35ms`, filter/sort p95/p99 `110/120ms`
- Nightly/stress profile:
  - `pnpm run bench:datagrid:tree:matrix:assert:nightly`
  - row scales: `10k, 25k, 50k, 100k`

Quick-filter typing gate:
- `pnpm run bench:datagrid:quick-filter:assert`
- The assert profile covers `10k`, `50k`, and `100k` rows with one and five searchable columns.
- Aggregate budgets cover first apply, query change, clear, quick-filter plus sort, quick-filter plus column-filter, variance, and heap.
- Typing-specific budgets hard-cover `100k/1col` and `100k/5col` first-apply and query-change p95 through `PERF_BUDGET_MAX_QUICK_FILTER_100K_*`.

Worker canonical gate:
- `pnpm run bench:datagrid:worker:canonical:assert`
- Canonical release evidence is protocol correctness/payload timing, worker pressure, and worker browser frame parity via `bench:datagrid:worker:protocol:assert`, `bench:datagrid:worker:pressure:assert`, and `bench:datagrid:worker:frames:assert`.
- Older worker artifact files remain historical references only; release review should use the canonical assert outputs unless a slice explicitly targets a retired artifact.

Perf-contract fail-fast gate:
- `pnpm run quality:perf:datagrid`
- Script: `scripts/check-datagrid-perf-contracts.mjs`
- Report: `artifacts/quality/datagrid-perf-contracts-report.json`
- Includes static guard for benchmark harness task matrix (`vue-adapters`, `laravel-morph`, `interaction-models`, `datasource-churn`, `derived-cache`, `pivot-workload`, `tree-workload`, `enterprise-browser-frames`, `row-models`) and mode-scoped budget wiring.

Fail-fast behavior:
- Harness exits non-zero when any benchmark fails budget checks.
- Runtime report gate (`scripts/check-datagrid-benchmark-report.mjs`) validates:
  - report freshness,
  - required suites presence (`vue-adapters`, `laravel-morph`, `interaction-models`, `datasource-churn`, `derived-cache`, `row-models`, `enterprise-browser-frames`),
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
- Focused selection benchmark gates were executed locally for the latest selection slice: `bench:datagrid:interactions:assert` and `bench:datagrid:enterprise:selection:assert`.
- Browser-frame selection gates still require the sandbox app/browser benchmark environment and remain configured for CI/profile-gated runs.

Runtime perf-by-design contract reference:
- `docs/perf/datagrid-perf-by-design-runtime.md`

## Long Memory Soak

Soak scripts:

- CI/release smoke: `pnpm run bench:datagrid:soak:assert`
- 30-minute release-confidence profile: `pnpm run bench:datagrid:soak:long:assert`

The soak gate covers mixed scroll, edit patching, sort/filter/group/pivot reapply, server-backed viewport refresh, renderer-cache churn, listener churn, and retained DOM-node counters in one long-lived model session.

Hard budgets in `bench:datagrid:soak:assert`:

- `PERF_BUDGET_MAX_OPERATION_P95_MS=160`
- `PERF_BUDGET_MAX_SCROLL_P95_MS=2`
- `PERF_BUDGET_MAX_EDIT_P95_MS=80`
- `PERF_BUDGET_MAX_FILTER_P95_MS=190`
- `PERF_BUDGET_MAX_SERVER_REFRESH_P95_MS=5`
- `PERF_BUDGET_MAX_RENDERER_P95_MS=2`
- `PERF_BUDGET_MAX_HEAP_DELTA_MB=40`
- `PERF_BUDGET_MAX_HEAP_GROWTH_PER_1K_OPS_MB=6.5`
- `PERF_BUDGET_MAX_HEAP_PLATEAU_DRIFT_MB=45`
- `PERF_BUDGET_MAX_PEAK_HEAP_MB=140`
- `PERF_BUDGET_MAX_SERVER_ROW_CACHE_ENTRIES=2048`
- `PERF_BUDGET_MAX_RENDERER_CACHE_ENTRIES=1024`
- `PERF_BUDGET_MAX_LISTENER_COUNT=3`
- `PERF_BUDGET_MAX_DOM_NODE_COUNT=0`
- `PERF_BUDGET_MIN_SCENARIO_OPS=50`

## Optional Hardcore Stress Suite (Non-blocking)

For deep local stress runs (not part of CI blocking harness by default):

- `pnpm run bench:datagrid:hardcore`
- `pnpm run bench:datagrid:hardcore:assert`
- `pnpm run bench:datagrid:soak`
- `pnpm run bench:datagrid:soak:assert`
- `pnpm run bench:datagrid:soak:long`
- `pnpm run bench:datagrid:soak:long:assert`
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
- `recordVirtualizationEvent(...)` is disabled by default and records bounded virtualized viewport events only when `virtualizationTelemetryEnabled` is explicitly set.
- With `dgPerfTrace=1`, the Vue app viewport records `viewportRaf` samples containing rendered row/column counts, row/column ranges, range resolve time, row/column overscan, placeholder row count, and blank-viewport flags.
- Scroll-driven runtime viewport-position persistence stays out of the active scroll rAF; position snapshots are written on scroll idle so `setViewportPosition` does not duplicate viewport-range traffic per frame.
- `scripts/bench-datagrid-enterprise-browser-frames.mjs` extracts those samples into `virtualizationTelemetry` summaries for vertical diagnostics scenarios, alongside long-task and datasource placeholder/cache/pull-latency diagnostics.
- Intended for local quality diagnostics and interaction tuning (not a replacement for CI benchmark gates).
