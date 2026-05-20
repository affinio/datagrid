# DataGrid Performance Enterprise Implementation Plan

This plan converts `docs/audits/PERFORMANCE_ENTERPRISE_AUDIT.md` into small, separable implementation slices. The current architecture remains the baseline: core owns deterministic viewport/model contracts, Vue/app layers own browser materialization, orchestration owns reusable interaction lifecycles, and benchmark scripts own performance regression gates.

Current execution state:

- Slices 1-4 are implemented as of 2026-05-20.
- Browser-frame resource budgets now have an explicit hard-fail switch for assert runs.
- Scroll hot path now ignores redundant body scroll events whose sampled offsets did not change.
- Sort/edit/context-menu browser frame scenarios now have a focused hard-fail interaction-frame gate with sort and edit-burst diagnostics.
- Column-menu sort no longer races with large deferred value-histogram loading when the menu closes before the histogram starts.
- Current interaction-frame artifact shows context-menu open/cleanup is not the active blocker, local client sort still has synchronous projection/sort work after the single-column fast path, and frozen inline-edit patches no longer force a full body-row partition rebuild.
- Server-backed placeholder latency, viewport availability, cache miss, pull duration, retry, stale-retention, and browser placeholder diagnostics are now hard-gated.
- Remaining blockers are deeper sort execution policy, datasource churn reduction, long memory soak, wide-table coverage, custom-renderer gates, and workload hardening.
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

## Slice 3c: Interaction Frame Artifact Triage And Edit Diagnostics

- Status: Completed on 2026-05-20.
- Objective: use the focused interaction-frame artifact to split the remaining runtime cleanup into measured sort/edit targets before changing execution policy.
- Affected packages/files:
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `scripts/check-datagrid-perf-contracts.mjs`
  - `package.json`
  - `docs/perf/datagrid-performance-gates.md`
  - `docs/audits/PERFORMANCE_ENTERPRISE_AUDIT.md`
- Expected behavior change: no runtime grid behavior change; the interaction-frame artifact now reports inline-edit burst update/open/commit/frame/mutation/long-task diagnostics and hard-fails finite edit-burst budgets.
- Tests to add/update:
  - Static perf-contract check for finite edit-burst interaction-frame budgets.
- Validation command: `pnpm run bench:datagrid:enterprise:interaction-frame:assert`
- Risk level: Low
- Suggested commit message: `test(datagrid): gate edit burst frame diagnostics`

## Slice 3d: Single-Column Sort Projection Cleanup

- Status: Completed on 2026-05-20.
- Objective: reduce allocation and comparator overhead in the common single-column local sort path without changing public API.
- Affected packages/files:
  - `packages/datagrid-core/src/models/projection/clientRowProjectionPrimitives.ts`
  - `packages/datagrid-core/src/models/projection/clientRowProjectionBasicStages.ts`
  - `packages/datagrid-core/src/models/projection/clientRowProjectionAggregateStage.ts`
- Expected behavior change: single-column local sorts use scalar sort values instead of allocating one sort-value array per row; direction flips continue to reuse the sort-value cache.
- Tests to add/update:
  - Existing core sort-value cache and deterministic sort coverage.
- Validation command: `pnpm run bench:datagrid:enterprise:interaction-frame:assert`
- Risk level: High
- Suggested commit message: `perf(datagrid-core): optimize single column sort`

## Slice 3e: Inline Edit Burst Runtime Cleanup

- Status: Completed on 2026-05-20.
- Objective: reduce measured inline-edit commit burst long tasks without changing public API.
- Affected packages/files:
  - `packages/datagrid-vue/src/composables/useDataGridRuntime.ts`
  - `packages/datagrid-vue/src/composables/__tests__/useDataGridRuntime.contract.spec.ts`
- Expected behavior change: frozen app-level edit patches keep the current body-row partition structure and invalidate only cached body-row data, avoiding a full `api.rows.get()` scan on every committed inline edit while preserving validation, history, focus navigation, and controlled-state behavior.
- Tests to add/update:
  - Runtime contract coverage verifies frozen edit patches reuse the existing body-row partition and lazily refresh the patched row.
- Validation command: `pnpm run bench:datagrid:enterprise:interaction-frame:assert`
- Risk level: Medium
- Suggested commit message: `perf(datagrid-vue): avoid body partition rebuilds for frozen edits`

## Slice 4: Server-Backed Latency And Placeholder Gates

- Status: Completed on 2026-05-20.
- Objective: prove server-backed virtualization under latency, jitter, failures, stale retention, and cache replacement.
- Affected packages/files:
  - `scripts/bench-datagrid-datasource-churn.mjs`
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `scripts/check-datagrid-perf-contracts.mjs`
  - `package.json`
  - `docs/perf/datagrid-performance-gates.md`
- Expected behavior change: no runtime grid behavior change; datasource/server-placeholder assert runs now hard-fail latency, cache, retry, stale-retention, and browser placeholder diagnostics.
- Tests to add/update:
  - Hard placeholder exposure, viewport availability, cache-hit/miss, pull duration, retry, stale-retention, and browser server-placeholder gates.
- Validation command: `pnpm run bench:datagrid:datasource-churn:assert && pnpm run bench:datagrid:enterprise:virtualization:assert`
- Risk level: Medium
- Suggested commit message: `perf(datagrid): gate server placeholder latency`

## Slice 5: Datasource Churn Reduction

- Status: Completed on 2026-05-20.
- Objective: reduce excessive pull counts and cache evictions during fast server-backed scroll.
- Affected packages/files:
  - `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
  - `scripts/bench-datagrid-datasource-churn.mjs`
  - `scripts/check-datagrid-perf-contracts.mjs`
  - `package.json`
  - `docs/perf/datagrid-performance-gates.md`
- Expected behavior change: `refresh("viewport-change")` now drains the pending critical viewport queue and skips a duplicate refresh pull when the current viewport is already cached; the assert benchmark hard-fails pull-count, abort, dropped-pull, and row-cache eviction regressions without increasing blank viewport exposure.
- Tests to add/update:
  - Pull count, abort, dropped-pull, eviction, coalescing, deferred pull, cache replacement, and stale coverage budgets.
- Validation command: `pnpm run bench:datagrid:datasource-churn:assert`
- Risk level: Medium
- Suggested commit message: `perf(datagrid): reduce datasource scroll churn`

## Slice 6: Long Memory Soak

- Status: Completed on 2026-05-20.
- Objective: add long-duration leak confidence for scroll, edit, filter, server refresh, and renderer paths.
- Affected packages/files:
  - `scripts/bench-datagrid-soak-session.mjs`
  - `docs/perf/datagrid-performance-gates.md`
  - `scripts/check-datagrid-perf-contracts.mjs`
  - `package.json`
- Expected behavior change: no runtime grid behavior change; the soak benchmark now has CI and 30-minute long profiles with heap plateau, peak heap, server row-cache, renderer-cache, listener, DOM-node, and scenario-specific latency gates.
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
5. Slice 3c: Interaction Frame Artifact Triage And Edit Diagnostics (completed 2026-05-20)
6. Slice 3d: Single-Column Sort Projection Cleanup (completed 2026-05-20)
7. Slice 3e: Inline Edit Burst Runtime Cleanup (completed 2026-05-20)
8. Slice 4: Server-Backed Latency And Placeholder Gates (completed 2026-05-20)
9. Slice 5: Datasource Churn Reduction
10. Slice 6: Long Memory Soak
11. Slice 10: Wide-Table Horizontal Virtualization Matrix
12. Slice 11: Custom Renderer Performance Contract
13. Slice 9: Quick-Filter Typing Latency
14. Slice 7: Grouped/Tree/Pivot Interactivity
15. Slice 8: Workbook Snapshot And Restore Slimming
16. Slice 12: Worker Benchmark Canonicalization

## Execution Notes

- Keep browser UX benchmarks separate from core microbenchmarks.
- Do not loosen budgets without attaching current artifact evidence and updating `docs/perf/datagrid-performance-gates.md`.
- Prefer making existing browser/frame gates harder before adding parallel benchmark harnesses.
- Runtime changes that affect scrolling, rendering, virtualization, selection, editing, or layout require focused visual verification.
