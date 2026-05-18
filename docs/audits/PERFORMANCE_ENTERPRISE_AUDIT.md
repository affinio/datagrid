# DataGrid Performance Enterprise Audit

## Executive Summary

The saved performance artifacts show a strong core foundation: viewport math, row models, copy/paste/fill, formula core, interaction model microbenchmarks, quick row-model operations, and several worker-pressure paths already pass the current budgets.

The current product is not yet enterprise-grade for a 2026 DataGrid/browser spreadsheet class experience. The main gaps are browser-frame stability under real scenarios, long main-thread tasks, server-backed virtualization under realistic latency, long-duration memory proof, grouped/tree/pivot interactivity, snapshot/export/restore payload size, quick-filter typing latency, worker-path consistency, and coverage for very wide tables.

Current enterprise performance readiness is **7/10**. A realistic target is **9/10** after converting the current observation-style browser and enterprise artifacts into hard gates, reducing long tasks in scroll/edit/sort/menu paths, adding realistic server latency/cache/placeholder tests, and extending the matrix to 1M rows, 1k+ columns, touch momentum, pinned panes, and custom renderers.

## Scope

This audit is based only on saved artifacts under `artifacts/performance`. Benchmarks were not rerun. Where multiple saved artifacts existed, the best passing current result was used as the current-state signal, while older failed artifacts were retained as stability and regression-risk evidence.

## Artifacts Reviewed

Core and enterprise workload summaries:

- `artifacts/performance/datagrid-benchmark-report.json`
- `artifacts/performance/bench-datagrid-enterprise-workloads.json`
- `artifacts/performance/bench-datagrid-enterprise-client-viewport-scroll.json`
- `artifacts/performance/bench-datagrid-enterprise-server-viewport-scroll.json`
- `artifacts/performance/bench-datagrid-enterprise-high-frequency-updates.json`
- `artifacts/performance/bench-datagrid-enterprise-sort-filter-combo.json`
- `artifacts/performance/bench-datagrid-enterprise-copy-paste-fill.json`
- `artifacts/performance/bench-datagrid-enterprise-pivot-tree-workload.json`
- `artifacts/performance/bench-datagrid-enterprise-memory-leak-soak.json`
- `artifacts/performance/bench-datagrid-enterprise-selection-operations.json`
- `artifacts/performance/bench-datagrid-enterprise-selection.assert.json`

Browser frame, scroll, worker, and position artifacts:

- `artifacts/performance/bench-datagrid-browser-frames.json`
- `artifacts/performance/bench-datagrid-enterprise-browser-frames.assert.json`
- `artifacts/performance/bench-datagrid-enterprise-browser-frames.touch.assert.json`
- `artifacts/performance/bench-datagrid-worker-browser-frames.json`
- `artifacts/performance/worker-frames-10k.json`
- `artifacts/performance/worker-frames-100k.json`
- `artifacts/performance/worker-frames-200k.json`
- `artifacts/performance/worker-verdict/frames-50k.json`
- `artifacts/performance/worker-verdict/frames-100k.json`
- `artifacts/performance/worker-verdict/frames-200k.json`
- `artifacts/performance/worker-verdict/ux-100k-noextra.json`
- `artifacts/performance/worker-verdict/ux-100k-stress.json`
- `artifacts/performance/worker-verdict/ux-200k-noextra.json`
- `artifacts/performance/worker-verdict/ux-200k-stress.json`
- `artifacts/performance/position-10k.json`
- `artifacts/performance/position-100k.json`
- `artifacts/performance/position-200k.json`
- `artifacts/performance/position-200k-after-memory.json`

Row model, cache, tree, pivot, quick-filter, and interaction artifacts:

- `artifacts/performance/bench-datagrid-rowmodels.json`
- `artifacts/performance/bench-datagrid-rowmodels.assert.json`
- `artifacts/performance/bench-datagrid-datasource-churn.json`
- `artifacts/performance/bench-datagrid-datasource-churn.assert.json`
- `artifacts/performance/bench-datagrid-derived-cache.json`
- `artifacts/performance/bench-datagrid-derived-cache.assert.json`
- `artifacts/performance/bench-datagrid-pivot-workload.json`
- `artifacts/performance/bench-datagrid-pivot-workload.assert.json`
- `artifacts/performance/bench-datagrid-pivot-workload.ci-audit-fresh.json`
- `artifacts/performance/bench-datagrid-pivot-server-interop.json`
- `artifacts/performance/bench-datagrid-tree-workload.json`
- `artifacts/performance/bench-datagrid-tree-workload-10000.json`
- `artifacts/performance/bench-datagrid-tree-workload-25000.json`
- `artifacts/performance/bench-datagrid-tree-workload-50000.json`
- `artifacts/performance/bench-datagrid-tree-workload-100000.json`
- `artifacts/performance/bench-datagrid-tree-workload-matrix.assert.json`
- `artifacts/performance/bench-datagrid-group-depth-explosion.json`
- `artifacts/performance/bench-datagrid-quick-filter.json`
- `artifacts/performance/bench-datagrid-quick-filter.assert.json`
- `artifacts/performance/bench-datagrid-interactions.json`
- `artifacts/performance/bench-datagrid-interactions.assert.json`
- `artifacts/performance/bench-datagrid-hardcore.assert.json`
- `artifacts/performance/bench-datagrid-hardcore.patch-focus.json`

Formula, spreadsheet, and protocol artifacts:

- `artifacts/performance/bench-datagrid-formula-engine.assert.json`
- `artifacts/performance/bench-datagrid-formula-engine.assert-13.json`
- `artifacts/performance/bench-datagrid-formula-engine-worker.assert.json`
- `artifacts/performance/bench-datagrid-formula-backends.assert.json`
- `artifacts/performance/bench-datagrid-formula-parser.json`
- `artifacts/performance/bench-datagrid-formula-relations.json`
- `artifacts/performance/bench-datagrid-spreadsheet-workbook.assert.json`
- `artifacts/performance/bench-datagrid-spreadsheet-workbook.assert-1.json`
- `artifacts/performance/bench-datagrid-spreadsheet-workbook.json`
- `artifacts/performance/bench-datagrid-spreadsheet-sheet.json`
- `artifacts/performance/bench-datagrid-dependency-graph.json`
- `artifacts/performance/bench-datagrid-worker-pressure.json`
- `artifacts/performance/bench-datagrid-worker-protocol.json`
- `artifacts/performance/bench-datagrid-worker-ux.json`
- `artifacts/performance/worker-pressure-matrix/*`
- `artifacts/performance/worker-pressure-matrix-scaled/*`

## Strengths

- Core row-model performance is strong in the current passing artifact. `bench-datagrid-rowmodels.json` passes with 1M window-shift proxy coverage and no budget errors.
- Client viewport math is cheap in the enterprise workload artifact. `bench-datagrid-enterprise-client-viewport-scroll.json` reports viewport calculation in sub-millisecond territory and no budget errors.
- Server viewport calculation is cheap in the current synthetic artifact. `bench-datagrid-enterprise-server-viewport-scroll.json` reports viewport latency `p95 ~1.08ms` with `100%` cache-hit ratio.
- Copy/paste/fill micro-workloads are fast for the current tested shape. `bench-datagrid-enterprise-copy-paste-fill.json` reports copy `~0.22ms`, paste `~1.01ms`, fill `~2.26ms`, and undo `~0.01ms`.
- Formula core throughput is strong in current passing artifacts. `bench-datagrid-formula-engine.assert*.json` and backend artifacts show high evaluation throughput without current budget errors.
- The worker-pressure matrix has passing entries across 10k to 200k rows, and worker verdict artifacts mostly stay around `16.8-22ms` frame p95 in saved passing runs.
- Existing artifacts already cover a broad performance surface: browser frames, worker frames, row models, datasource churn, derived cache, pivot/tree, quick filter, interactions, formula engine, workbook, memory soak, and protocol payloads.

## Findings By Severity

### Blocker

1. **Browser-frame stability is not enterprise-grade.**

   Current enterprise browser frame artifacts pass because they are in observation/assert mode with no budget errors, but the metrics are too weak for enterprise claims:

   - Desktop vertical scroll: `frameP95 ~66.7ms`, dropped frames `~58.7%`, long tasks `~11.2s total`.
   - Desktop combined: `frameP95 ~66.7ms`, dropped frames `~38.5%`, long tasks `~12.3s total`.
   - Touch vertical scroll: `frameP95 ~65.7ms`, dropped frames `~52.7%`.
   - Context menu: `frameP95 ~539-575ms`, with a single long task around `1s`.

   Required: make browser-frame budgets hard gates, reduce scroll/edit/sort/menu long tasks, and target `<16.7ms p95` for 60Hz with an explicit path toward lower budgets for high-refresh displays.

2. **Realistic server-backed virtualization is under-tested.**

   The current enterprise server viewport artifact is synthetic and optimistic: `rowCount=10000`, `deterministicLatencyMs=0`, and `cacheHitRatioPct=100`. It does not prove latency, jitter, failures, stale retention, placeholder exposure, or cache replacement continuity.

   Required: add latency-profiled server gates for 100k and 1M rows, placeholder exposure time, stale viewport retention, cache replacement without blank gaps, retry/error behavior, and cache churn under fast scroll.

3. **Long-duration memory proof is insufficient.**

   The latest enterprise memory soak artifact runs only `3s` and reports `heapDelta ~5.27MB` with a short-window slope around `104MB/min`. The older soak session runs about `125s` and reports `heapDelta ~21.8MB`. This is useful signal, but not enough for enterprise leak confidence.

   Required: add 30-60 minute soak gates with heap plateau checks, retained cache/listener/DOM diagnostics, and scenario-specific heap ceilings for scroll, edit, filter, server refresh, and custom renderer paths.

### High

1. **Sort, edit, and context-menu paths generate visible frame stalls.**

   The enterprise browser frame artifacts show:

   - Desktop `sort-only`: `frameP95 ~80ms`, dropped frames `~25.9%`.
   - Touch `sort-only`: `frameP95 ~72ms`, dropped frames `~25.9%`.
   - Desktop `inline-edit-burst-only`: `frameP95 ~70ms`.
   - Touch `inline-edit-burst-only`: `frameP95 ~63ms`.
   - Context menu: `~1s` long task in both desktop and touch artifacts.

   Required: profile and reduce synchronous projection/render/menu preparation, break large work into chunks, avoid heavy diagnostics in the interaction frame, and add interaction-specific frame gates.

2. **Grouped/tree/pivot workloads are not interactive enough at enterprise scale.**

   Saved artifacts show:

   - `bench-datagrid-group-depth-explosion.json`: depth 5, 20k rows, expand `p95 ~106.9ms`.
   - `bench-datagrid-tree-workload-100000.json`: workload elapsed `p95 ~4.78s`.
   - `bench-datagrid-pivot-server-interop.json`: elapsed `p95 ~17.5s`.

   Required: chunked expand/collapse, partial tree materialization, stronger structural indexes, and hard gates for interactive operations in the `<16-33ms` range where possible.

3. **Spreadsheet workbook restore and snapshot size remain enterprise risks.**

   The best current workbook assert artifact passes, but still reports:

   - export/restore `p95 ~399.7ms`.
   - snapshot size `~10.86MB`.

   The older failed workbook artifact reached `~47.9MB` snapshots, multi-second direct reference rewrites/restores, and heap budget failure around `592MB`.

   Required: reduce snapshot payload, add incremental restore/reference rewrite paths, enforce snapshot-size budgets, and keep the older failure mode covered by regression tests.

4. **Quick filter can exceed comfortable typing budgets at 100k rows.**

   `bench-datagrid-quick-filter.assert.json` passes, but reports aggregate `firstApply p99 ~91.8ms`, quick filter plus sort `p95 ~43.2ms`, and 100k rows with 5 searchable columns around `~38ms p95`.

   Required: indexed or incremental quick filter, typing-latency gates, debounce/chunking policy, and optional worker-backed filtering for large local datasets.

5. **Worker path has inconsistent artifact quality.**

   `bench-datagrid-worker-browser-frames.json` failed on total elapsed: `141.8s > 90s`. Newer worker verdict artifacts are better, but stress paths still show frame p95 around `21-22ms`, and scaled pressure artifacts include `~32.5ms` p95 cases.

   Required: cleanly separate obsolete artifacts from current gates, reduce payload size and protocol overhead, and define one canonical worker performance matrix.

### Medium

1. **Datasource churn is high even when passing.**

   `bench-datagrid-datasource-churn.json` passes, but scroll burst diagnostics show roughly `313k-319k` row cache evictions and around `6k` pull requests in the saved runs.

   Required: tune cache windows, coalescing, prefetch, and retention so enterprise server-backed scrolling does not create excessive churn.

2. **Derived-cache and row-model variance has historical failures.**

   Best current artifacts pass, but historical assert artifacts failed:

   - `bench-datagrid-derived-cache.assert.json`: invalidated-cache `p95 ~72.5ms` and seed `2026` invalidated-cache `p95 ~77.8ms` against a `40ms` budget.
   - `bench-datagrid-rowmodels.assert.json`: window-shift proxy `p99` coefficient of variation `~52%` against `45%`.

   Required: keep variance gates strict and investigate invalidated-cache tail latency rather than relying only on the best passing run.

3. **Very wide table coverage is not strong enough.**

   Enterprise browser frame artifacts use `32` columns. Enterprise workload artifacts commonly use `50` or `100` columns. This is not enough to claim 1k or 10k column behavior.

   Required: add horizontal virtualization gates for `1k+` columns, pinned left/right columns, resize/reorder/hide/show, high-DPI/fractional scroll positions, and custom renderers.

4. **Custom renderer performance is not proven by artifacts.**

   The current artifacts mostly validate built-in rendering paths. They do not prove slow custom renderer isolation, renderer mount churn, render error isolation, or scroll-time lightweight fallback.

   Required: add custom-renderer frame gates and renderer duration/churn telemetry.

5. **Performance gates still allow observation-mode gaps.**

   `bench-datagrid-enterprise-workloads.json` explicitly marks observation mode for enterprise workloads and notes that hard drift thresholds are not enforced until local/CI baselines are captured.

   Required: graduate enterprise workloads from observation to hard local/CI budgets after collecting stable baselines.

### Low

1. **Some passing artifacts are too synthetic to represent user experience.**

   Core microbenchmarks are useful but do not replace browser-device gates. Keep them, but avoid presenting them as proof of end-user smoothness.

2. **Artifact history contains old failures that need triage labels.**

   Failed artifacts are valuable, but they should be labeled as obsolete, regression fixture, or current blocker so future audits do not confuse old failed runs with current state.

3. **Generated benchmark artifacts need a clearer "best saved run" policy.**

   This audit used the best current passing saved result where duplicates existed. The artifact directory should encode canonical/current/baseline runs explicitly.

## Correctness And UX Risks

- Blank viewport prevention is not proven under realistic server latency, cache refresh, touch momentum, resize, zoom, and wide horizontal scroll.
- Selection/edit continuity may be fast in microbenchmarks, but browser-frame artifacts show edit-related stalls that can affect perceived correctness.
- Context-menu long tasks can make the grid feel frozen even when the underlying operation is correct.
- Server-backed placeholder behavior is not yet measured as user-visible exposure time.
- Snapshot/export/restore bloat can make saved views, workbook restore, and debug captures feel unreliable at large scale.

## Performance Risks

- Main-thread long tasks are the top risk. They appear in scroll, combined, sort, edit, and context-menu browser scenarios.
- DOM/render churn is not measured directly as a first-class budget.
- Cache churn is visible in datasource artifacts and can become network/backend load in real deployments.
- Memory proof is too short to catch slow leaks or retained renderer/cache state.
- High-cardinality grouped/tree/pivot operations can exceed interactive latency.
- Quick filter tail latency can exceed typing comfort thresholds.
- Worker payloads and total elapsed time need canonical gates.

## Server-Backed Performance Risks

- Current server viewport artifacts use zero latency and small row counts compared with enterprise usage.
- Cache-hit ratios in synthetic runs do not prove cold scroll, fast jump, direction reversal, retry, or stale-data behavior.
- Placeholder exposure time is not a hard gate.
- Large cache eviction counts suggest room to improve retained windows and prefetch policy.
- Server-backed sorting/filtering/grouping/pivoting need performance proof beyond local model microbenchmarks.

## Touch And Mobile Performance Risks

- Touch vertical scroll has `frameP95 ~65.7ms` and dropped frames over `50%` in the saved enterprise touch artifact.
- Touch sort/edit/context-menu paths show the same long-task shape as desktop.
- Touch momentum, virtual keyboard resize, coarse pointer interactions, and mobile custom renderer costs are not covered enough for enterprise claims.
- Device-scale-factor testing exists in the touch artifact, but not enough matrix coverage for real devices.

## Enterprise Readiness Score

Current score: **7/10**.

Target score: **9/10**.

What blocks the target:

- Browser-frame and long-task metrics are not within enterprise UX targets.
- Enterprise workloads are still partly observation-mode rather than hard-gated.
- Server-backed latency, placeholder, stale retention, and failure paths are under-tested.
- Long memory soak evidence is insufficient.
- Wide-table, pinned-pane, custom-renderer, touch momentum, and high-DPI coverage is incomplete.
- Snapshot/restore and grouped/tree/pivot paths still have large-tail latency risks.

## Recommended Implementation Slices

1. **Browser frame hard gates**
   - Convert enterprise browser-frame desktop and touch metrics into hard budgets.
   - Track `frameP95`, `frameP99`, dropped frame percentage, long task count, total long task time, and max long task.

2. **Scroll and combined scenario long-task reduction**
   - Profile vertical-scroll and combined scenarios.
   - Remove heavy synchronous work from scroll frames and batch non-visible updates.

3. **Sort/edit/context-menu frame cleanup**
   - Split projection/render/menu work so one interaction cannot create `60-1000ms` frame stalls.
   - Add focused browser-frame gates for sort, inline edit burst, and context menu.

4. **Server-backed latency and placeholder gates**
   - Add latency/jitter/error profiles.
   - Measure placeholder exposure time, stale row retention, cache replacement gaps, and request churn.

5. **Datasource churn reduction**
   - Tune cache retention and coalescing.
   - Add budgets for pull count, evictions, deferred/coalesced operations, and stale viewport coverage.

6. **Long memory soak**
   - Add 30-60 minute soak profiles.
   - Track heap slope, plateau, retained DOM nodes, renderer caches, row caches, event listeners, and datasource cache growth.

7. **Grouped/tree/pivot interactivity**
   - Add chunked expand/collapse and partial materialization where needed.
   - Gate depth-5 group expand and 100k tree workloads against interactive budgets.

8. **Workbook snapshot and restore slimming**
   - Reduce snapshot payload size.
   - Add incremental restore/reference rewrite paths and strict snapshot-size budgets.

9. **Quick-filter typing latency**
   - Add typing-focused quick-filter gates at 100k rows and multiple searchable column counts.
   - Evaluate incremental/indexed/worker-backed filtering.

10. **Wide-table horizontal virtualization matrix**
    - Add 1k and 10k column artifacts with pinned columns, resize/reorder/hide/show, fractional scroll, and high-DPI.

11. **Custom renderer performance contract**
    - Add renderer duration and mount/unmount churn telemetry.
    - Define slow renderer behavior and scroll-time lightweight mode.

12. **Worker benchmark canonicalization**
    - Pick canonical worker verdict artifacts.
    - Retire or label obsolete failed worker artifacts.
    - Add protocol payload and total elapsed budgets.

## Recommended Tests And Gates

Unit and contract tests:

- Viewport range and blank-coverage invariants for fast scroll, resize, zoom, and cache replacement.
- Derived-cache invalidation tail-latency regression tests.
- Datasource cache retention, coalescing, eviction, and stale viewport contracts.
- Snapshot-size and restore-time contract tests for workbook/state payloads.

Component and browser tests:

- Desktop and touch browser-frame tests for vertical scroll, smooth scroll, horizontal scroll, sort, edit burst, context menu, and combined scenarios.
- Pinned panes plus wide horizontal virtualization with 1k+ columns.
- Custom renderer slow-path and mount/unmount churn tests.
- Server-backed placeholder exposure and stale-row replacement visual continuity tests.

Performance and soak tests:

- 30-60 minute memory soak.
- 100k/1M row server-backed latency matrix.
- 1k/10k column horizontal matrix.
- Quick-filter typing latency at 100k rows.
- Group/tree/pivot interactive operation gates.

## Recommended Telemetry

- `frameP95Ms`, `frameP99Ms`, dropped frame percentage.
- Long task count, total long task time, max long task time.
- Visible row/column count and materialized cell count.
- Row/cell mount and unmount churn.
- Blank viewport detection.
- Placeholder exposure time.
- Server request count, coalesced/deferred/dropped pulls, cache evictions.
- Stale viewport retained rows during refresh.
- Snapshot bytes and restore duration.
- Quick-filter first apply, query change, clear, filter+sort latency.
- Renderer invocation count and slow-renderer duration samples.
- Worker payload bytes and main-thread frame time during worker updates.

## Risks And Migration Notes

- Do not replace the current architecture only because browser metrics are weak. The artifacts point to hot-path cleanup, gating, and realistic workload coverage rather than a new grid architecture.
- Keep core microbenchmarks and browser UX benchmarks separate. Core speed does not imply smooth browser frames.
- Avoid public API changes for performance gates unless a renderer/server contract must be formalized first.
- Treat old failed artifacts as regression evidence, but label them clearly once a newer canonical artifact supersedes them.
- Introduce hard gates gradually after collecting stable local and CI baselines, otherwise variance can create noisy failures.

## Action Needed

Action is needed now for browser-frame gates, long-task reduction, server-backed latency/placeholder proof, and long memory soak. The remaining slices can follow once those top risks are measurable and enforced.
