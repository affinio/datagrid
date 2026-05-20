# DataGrid Performance Enterprise Implementation Plan

This plan converts `docs/audits/PERFORMANCE_ENTERPRISE_AUDIT.md` into small, separable implementation slices. The current architecture remains the baseline: core owns deterministic viewport/model contracts, Vue/app layers own browser materialization, orchestration owns reusable interaction lifecycles, and benchmark scripts own performance regression gates.

Current execution state:

- Slices 1-3b are implemented as of 2026-05-20.
- Browser-frame resource budgets now have an explicit hard-fail switch for assert runs.
- Scroll hot path now ignores redundant body scroll events whose sampled offsets did not change.
- Sort/edit/context-menu browser frame scenarios now have a focused hard-fail interaction-frame gate.
- Column-menu sort no longer races with large deferred value-histogram loading when the menu closes before the histogram starts.
- Remaining blockers are long-task reduction, server-backed latency proof, long memory soak, wide-table coverage, custom-renderer gates, and workload hardening.
- Do not change public API for performance work unless a focused proposal is approved first.

## Slice 1: Browser Frame Resource Hard Gates

- Status: Completed on 2026-05-20.
- Objective: make enterprise browser-frame assert runs fail on resource budget warnings, not only interaction warnings.
- Affected packages/files:
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `scripts/check-datagrid-perf-contracts.mjs`
  - `package.json`
  - `docs/perf/datagrid-performance-gates.md`
  - `docs/audits/PERFORMANCE_ENTERPRISE_AUDIT.md`
- Expected behavior change: benchmark assert scripts now treat frame p95/p99, dropped-frame percentage, long-task count, long-task total, long-task max, and heap resource budgets as hard failures when `BENCH_BROWSER_RESOURCE_FAIL_ON_WARNINGS=true`.
- Tests to add/update:
  - Static perf-contract check verifies desktop/touch browser-frame assert scripts include hard resource gating and finite budgets.
- Validation command: `pnpm run quality:perf:datagrid`
- Risk level: Low
- Suggested commit message: `test(datagrid): harden browser frame resource gates`

## Slice 2: Scroll Hot-Path Guard And Focused Gate

- Status: Completed on 2026-05-20.
- Objective: reduce avoidable main-thread work in body scroll handling and isolate vertical-scroll, smooth-scroll, horizontal-scroll, and combined browser scenarios behind a focused hard gate.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts`
  - `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageViewportRuntime.spec.ts`
  - `package.json`
  - `docs/perf/datagrid-performance-gates.md`
  - `docs/audits/PERFORMANCE_ENTERPRISE_AUDIT.md`
- Expected behavior change: redundant body scroll events with unchanged offsets no longer schedule app viewport commits, linked-pane sync, pinned-bottom sync, chrome redraws, or scroll-active state changes.
- Tests to add/update:
  - Stage viewport runtime contract for unchanged-offset scroll events.
  - Focused browser-frame scroll scenario gate for vertical, smooth vertical, horizontal, and combined scroll paths.
- Validation command: `pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/stage/__tests__/useDataGridStageViewportRuntime.spec.ts && pnpm run quality:perf:datagrid`
- Risk level: High
- Suggested commit message: `perf(datagrid): guard redundant scroll work`

## Slice 3: Sort/Edit/Context Menu Frame Gate

- Status: Completed on 2026-05-20.
- Objective: isolate sort, inline edit burst, and context-menu open/cleanup browser scenarios behind focused hard budgets before deeper runtime cleanup.
- Affected packages/files:
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `scripts/check-datagrid-perf-contracts.mjs`
  - `package.json`
  - `docs/perf/datagrid-performance-gates.md`
  - `docs/audits/PERFORMANCE_ENTERPRISE_AUDIT.md`
- Expected behavior change: no runtime grid behavior change; interaction-frame benchmark output now hard-fails resource, interaction, and sort-diagnostic budget warnings.
- Tests to add/update:
  - Scenario-specific browser-frame gate for `sort-only`, `inline-edit-burst-only`, and `interaction-context-menu`.
  - Static perf-contract check for finite interaction-frame budgets.
- Validation command: `pnpm run quality:perf:datagrid`
- Risk level: Low
- Suggested commit message: `test(datagrid): gate interaction frame scenarios`

## Slice 3b: Sort/Edit/Context Menu Frame Cleanup

- Status: Completed on 2026-05-20.
- Objective: reduce avoidable synchronous runtime work in the column-menu sort path before deeper projection/edit/context-menu cleanup.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/overlays/DataGridColumnMenu.vue`
  - `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
  - `docs/perf/datagrid-browser-performance-next-slices.md`
  - `docs/audits/PERFORMANCE_ENTERPRISE_AUDIT.md`
- Expected behavior change: large column-menu value histograms stay deferred longer after menu open and are canceled/invalidated when a sort action closes the menu before the histogram starts.
- Tests to add/update:
  - Contract coverage for deferred histogram loading and cancellation when sorting closes the menu first.
- Validation command: `pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/__tests__/DataGrid.contract.spec.ts --testNamePattern "columnMenu value histograms"`
- Risk level: Medium
- Suggested commit message: `perf(datagrid-vue-app): defer column menu histograms`

## Slice 3c: Sort/Edit/Context Menu Deep Runtime Cleanup

- Status: Pending.
- Objective: split remaining heavy synchronous runtime work in sort, inline edit bursts, and context-menu open/cleanup scenarios.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/*sort*`
  - `packages/datagrid-vue-app/src/stage/*editing*`
  - `packages/datagrid-orchestration/src/contextMenu/*`
- Expected behavior change: remaining sort/edit/menu interaction stalls are reduced after reviewing `bench:datagrid:enterprise:interaction-frame:assert` artifacts.
- Tests to add/update:
  - Runtime-specific tests based on the hottest failing diagnostics from the interaction-frame artifact.
- Validation command: `pnpm run bench:datagrid:enterprise:interaction-frame:assert`
- Risk level: High
- Suggested commit message: `perf(datagrid): reduce interaction frame stalls`

## Slice 4: Server-Backed Latency And Placeholder Gates

- Status: Pending.
- Objective: prove server-backed virtualization under latency, jitter, failures, stale retention, and cache replacement.
- Affected packages/files:
  - `scripts/bench-datagrid-datasource-churn.mjs`
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `packages/datagrid-core/src/datasource/*`
  - `packages/datagrid-vue/src/app/*datasource*`
- Expected behavior change: server-backed fast scroll keeps visible continuity without blank viewport gaps.
- Tests to add/update:
  - Hard placeholder exposure, viewport availability, cache-hit/miss, pull duration, retry, and stale-retention gates.
- Validation command: `pnpm run bench:datagrid:datasource-churn:assert && pnpm run bench:datagrid:enterprise:virtualization:assert`
- Risk level: High
- Suggested commit message: `perf(datagrid): gate server placeholder latency`

## Slice 5: Datasource Churn Reduction

- Status: Pending.
- Objective: reduce excessive pull counts and cache evictions during fast server-backed scroll.
- Affected packages/files:
  - `packages/datagrid-core/src/datasource/*`
  - `packages/datagrid-server-client/src/*`
  - `scripts/bench-datagrid-datasource-churn.mjs`
- Expected behavior change: fewer redundant datasource pulls and evictions without increasing blank viewport exposure.
- Tests to add/update:
  - Pull count, eviction, coalescing, deferred pull, cache replacement, and stale coverage budgets.
- Validation command: `pnpm run bench:datagrid:datasource-churn:assert`
- Risk level: Medium
- Suggested commit message: `perf(datagrid): reduce datasource scroll churn`

## Slice 6: Long Memory Soak

- Status: Pending.
- Objective: add long-duration leak confidence for scroll, edit, filter, server refresh, and renderer paths.
- Affected packages/files:
  - `scripts/bench-datagrid-soak-session.mjs`
  - `docs/perf/datagrid-performance-gates.md`
- Expected behavior change: no runtime behavior change; long soak becomes a release-confidence artifact.
- Tests to add/update:
  - 30-60 minute soak profile with heap slope, plateau, cache/listener/DOM diagnostics, and scenario-specific ceilings.
- Validation command: `pnpm run bench:datagrid:soak:assert`
- Risk level: Medium
- Suggested commit message: `test(datagrid): add long memory soak gate`

## Slice 7: Grouped/Tree/Pivot Interactivity

- Status: Pending.
- Objective: move high-cardinality group/tree/pivot operations toward interactive budgets.
- Affected packages/files:
  - `packages/datagrid-core/src/projection/*`
  - `scripts/bench-datagrid-tree-workload.mjs`
  - `scripts/bench-datagrid-pivot-workload.mjs`
- Expected behavior change: expand/collapse, filter/sort, and pivot rebuild paths avoid multi-second synchronous stalls where possible.
- Tests to add/update:
  - Depth-5 group expand, 100k tree, and pivot server-interop gates.
- Validation command: `pnpm run bench:datagrid:tree:matrix:assert:ci && pnpm run bench:datagrid:pivot:assert`
- Risk level: High
- Suggested commit message: `perf(datagrid): improve grouped tree pivot latency`

## Slice 8: Workbook Snapshot And Restore Slimming

- Status: Pending.
- Objective: reduce workbook snapshot size and restore/reference rewrite latency.
- Affected packages/files:
  - `packages/datagrid-core/src/spreadsheet/*`
  - `scripts/bench-datagrid-spreadsheet-workbook.mjs`
- Expected behavior change: large workbook export/restore uses less memory and completes faster.
- Tests to add/update:
  - Snapshot byte-size, restore duration, reference rewrite, and heap gates.
- Validation command: `pnpm run bench:datagrid:spreadsheet-workbook:assert`
- Risk level: High
- Suggested commit message: `perf(datagrid): slim workbook snapshots`

## Slice 9: Quick-Filter Typing Latency

- Status: Pending.
- Objective: keep 100k-row quick-filter typing within comfortable latency budgets.
- Affected packages/files:
  - `packages/datagrid-core/src/filtering/*`
  - `packages/datagrid-vue-app/src/features/quick-filter/*`
  - `scripts/bench-datagrid-quick-filter.mjs`
- Expected behavior change: quick-filter query changes avoid large synchronous tail latency.
- Tests to add/update:
  - Typing-focused gates by row count and searchable column count.
- Validation command: `pnpm run bench:datagrid:quick-filter:assert`
- Risk level: Medium
- Suggested commit message: `perf(datagrid): bound quick filter typing latency`

## Slice 10: Wide-Table Horizontal Virtualization Matrix

- Status: Pending.
- Objective: prove 1k+ column behavior with pinned panes, resize/reorder/hide/show, fractional scroll, and high-DPI.
- Affected packages/files:
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `packages/datagrid-vue/src/app/*viewport*`
  - `packages/datagrid-vue-app/src/stage/*`
- Expected behavior change: wide-table horizontal scroll and pinned pane sync remain smooth and blank-free.
- Tests to add/update:
  - 1k and 10k column browser-frame matrix with pinned left/right columns and custom renderer variants.
- Validation command: `pnpm run bench:datagrid:enterprise:virtualization:assert`
- Risk level: High
- Suggested commit message: `test(datagrid): expand wide table perf matrix`

## Slice 11: Custom Renderer Performance Contract

- Status: Pending.
- Objective: make custom renderer duration and mount/unmount churn first-class gates.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts`
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `docs/datagrid-renderer-lifecycle.md`
- Expected behavior change: custom renderer hot paths become measurable and bounded.
- Tests to add/update:
  - Slow custom renderer, auto-height renderer, renderer error, and overlay-heavy renderer gates.
- Validation command: `pnpm run bench:datagrid:enterprise:browser-frames:assert`
- Risk level: Medium
- Suggested commit message: `perf(datagrid): gate custom renderer cost`

## Slice 12: Worker Benchmark Canonicalization

- Status: Pending.
- Objective: define one canonical worker performance matrix and label obsolete artifacts.
- Affected packages/files:
  - `scripts/bench-datagrid-worker-*.mjs`
  - `docs/perf/datagrid-performance-gates.md`
  - `docs/audits/PERFORMANCE_ENTERPRISE_AUDIT.md`
- Expected behavior change: no runtime behavior change; worker performance evidence becomes release-reviewable.
- Tests to add/update:
  - Payload size, protocol overhead, total elapsed, and browser-frame worker update budgets.
- Validation command: `pnpm run quality:perf:datagrid`
- Risk level: Medium
- Suggested commit message: `docs(datagrid): canonicalize worker perf gates`

## Recommended Execution Order

1. Slice 1: Browser Frame Resource Hard Gates (completed 2026-05-20)
2. Slice 2: Scroll Hot-Path Guard And Focused Gate (completed 2026-05-20)
3. Slice 3: Sort/Edit/Context Menu Frame Gate (completed 2026-05-20)
4. Slice 3b: Sort/Edit/Context Menu Frame Cleanup (completed 2026-05-20)
5. Slice 3c: Sort/Edit/Context Menu Deep Runtime Cleanup
6. Slice 4: Server-Backed Latency And Placeholder Gates
7. Slice 5: Datasource Churn Reduction
8. Slice 6: Long Memory Soak
9. Slice 10: Wide-Table Horizontal Virtualization Matrix
10. Slice 11: Custom Renderer Performance Contract
11. Slice 9: Quick-Filter Typing Latency
12. Slice 7: Grouped/Tree/Pivot Interactivity
13. Slice 8: Workbook Snapshot And Restore Slimming
14. Slice 12: Worker Benchmark Canonicalization

## Execution Notes

- Keep browser UX benchmarks separate from core microbenchmarks.
- Do not loosen budgets without attaching current artifact evidence and updating `docs/perf/datagrid-performance-gates.md`.
- Prefer making existing browser/frame gates harder before adding parallel benchmark harnesses.
- Runtime changes that affect scrolling, rendering, virtualization, selection, editing, or layout require focused visual verification.
