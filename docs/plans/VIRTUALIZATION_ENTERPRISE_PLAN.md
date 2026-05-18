# DataGrid Virtualization Enterprise Implementation Plan

This plan converts `docs/audits/VIRTUALIZATION_ENTERPRISE_AUDIT.md` into small, separable implementation slices. The order is intentional: prove correctness first, then prevent blanking, then harden server-backed and interaction behavior, then broaden enterprise performance gates.

Current execution state:

- Slice 1 is already completed and should be treated as the baseline.
- Slice 2 is completed and should be treated as the controller integration baseline.
- Slice 3 is completed and should be treated as the browser blank-viewport detection baseline.
- Slice 4 is runtime-fix-only work and is not warranted until Slice 3 or an equivalent regression exposes a blanking failure.
- Slice 5 is completed and should be treated as the adaptive overscan consistency baseline.
- Slice 6 is completed and should be treated as the datasource visible-row retention baseline.
- Slice 7 is completed and should be treated as the datasource placeholder telemetry baseline.
- Slice 8 is completed and should be treated as the datasource placeholder budget baseline.
- Slice 9 is completed and should be treated as the focus continuity baseline.
- Slice 10 is completed and should be treated as the selection/clipboard virtual-target guard baseline.
- Slice 11 is completed and should be treated as the edit lifecycle continuity baseline.
- Slice 12 is completed and should be treated as the wide horizontal virtualization baseline.
- Slice 13 is completed and should be treated as the grouped/tree row-model boundary baseline.
- Slice 14 is completed and should be treated as the resize/fractional viewport baseline.
- Slice 15 is completed and should be treated as the virtualized accessibility mapping baseline.
- Slice 16 is completed and should be treated as the virtualization telemetry extraction baseline.
- Slice 17 is the next implementation slice.
- `docs/audits/PERFORMANCE_ENTERPRISE_AUDIT.md` is a parent quality lens for this track, not the execution plan for the next slice. Pull in its browser-frame, server latency, placeholder exposure, wide-grid, and memory/churn expectations when they apply to a virtualization slice.
- Selection-specific continuity work that was closed in `docs/plans/SELECTION_ENTERPRISE_PLAN.md` should be reused as existing coverage; do not duplicate that work unless a virtualization slice exposes a separate viewport or rendering invariant.

## Slice 1: Core Visible Range Invariants

- Status: Completed. Core invariant coverage now lives in `packages/datagrid-core/src/viewport/__tests__/virtualizationRangeInvariants.contract.spec.ts`.
- Objective: establish deterministic row and column range invariants for the existing core virtualizers.
- Affected packages/files:
  - `packages/datagrid-core/src/virtualization/axisVirtualizer.ts`
  - `packages/datagrid-core/src/virtualization/verticalVirtualizer.ts`
  - `packages/datagrid-core/src/virtualization/horizontalVirtualizer.ts`
  - `packages/datagrid-core/src/viewport/dataGridViewportVirtualization.ts`
  - `packages/datagrid-core/src/viewport/__tests__/*virtual*.spec.ts`
- Expected behavior change: no runtime behavior change expected; tests should lock existing semantics for range start/end, overscan bounds, edge clamping, no duplicates, and no missing rendered indexes.
- Tests to add/update:
  - Unit tests for zero, one, exact-fit, partial-fit, start edge, end edge, reverse direction, large count, and overscan larger than viewport.
  - Assertions that returned ranges are monotonic, bounded, non-negative, and cover the visible viewport.
  - Regression cases for horizontal pinned-width math near max scroll.
- Validation command: `pnpm --filter @affino/datagrid-core test -- --runInBand virtualization`
- Risk level: Low
- Suggested commit message: `test(datagrid): cover virtualization range invariants`

## Slice 2: Viewport Controller Integration Invariants

- Status: Completed. Controller integration coverage now includes retained row identity across resize/reversal/model refresh, adaptive overscan direction on reversal, and stable logical cell identity through horizontal width/order/visibility changes.
- Objective: prove the core viewport controller preserves range and row identity through scroll, resize, row model updates, and horizontal layout changes.
- Affected packages/files:
  - `packages/datagrid-core/src/viewport/dataGridViewportController.ts`
  - `packages/datagrid-core/src/viewport/dataGridViewportScrollIo.ts`
  - `packages/datagrid-core/src/viewport/dataGridViewportHorizontalUpdate.ts`
  - `packages/datagrid-core/src/viewport/dataGridViewportModelBridgeService.ts`
  - `packages/datagrid-core/src/viewport/__tests__/scrollResizeDeterminism.contract.spec.ts`
  - `packages/datagrid-core/src/viewport/__tests__/integrationSnapshot.contract.spec.ts`
- Expected behavior change: no intentional behavior change; controller behavior becomes locked around deterministic snapshots and non-invalidating viewport-only updates.
- Tests to add/update:
  - Resize while scrolled vertically and horizontally.
  - Scroll direction reversal with adaptive overscan.
  - Model refresh while viewport range is active.
  - Column resize/reorder/hide/show with horizontal virtualization enabled.
  - Assertions that row identity and cell identity remain stable for retained indexes.
- Validation command: `pnpm --filter @affino/datagrid-core test -- --runInBand viewport`
- Risk level: Low
- Suggested commit message: `test(datagrid): lock viewport controller invariants`

## Slice 3: Blank Viewport Detection Harness

- Status: Completed. `e2e/sandbox-grid.spec.ts` now includes fast vertical and horizontal browser detectors for rendered viewport coverage, duplicate visual indexes, and uncovered viewport bands in the Vue base grid path.
- Objective: add an automated browser detector that fails when the rendered viewport has visible blank gaps during scroll.
- Affected packages/files:
  - `e2e/sandbox-grid.spec.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-sandbox/src/components/VueGridCard.vue`
  - `packages/datagrid-sandbox/src/components/VueServerDataSourceGridCard.vue`
- Expected behavior change: no user-facing behavior change unless the slice exposes a real blanking bug; e2e should detect empty viewport bands, missing row coverage, and duplicated visual rows.
- Tests to add/update:
  - Playwright fast vertical scroll detector for local row model.
  - Playwright fast horizontal scroll detector with column virtualization enabled.
  - Detector assertions for rendered row count, row top/bottom coverage, no duplicate visual indexes, and no uncovered viewport band.
- Validation command: `pnpm e2e -- e2e/sandbox-grid.spec.ts`
- Risk level: Medium
- Suggested commit message: `test(datagrid): detect blank virtual viewports`

## Slice 4: Blank Viewport Prevention Fixes

- Status: Deferred. This slice should only make runtime fixes for failures proven by Slice 3 or by an equivalent focused regression; no runtime fix was warranted by the completed Slice 3 detector baseline.
- Objective: fix any blank viewport failures found by Slice 3 without changing the public virtualization API.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts`
  - `packages/datagrid-core/src/viewport/dataGridViewportVirtualization.ts`
  - `packages/datagrid-core/src/viewport/dataGridViewportScrollIo.ts`
- Expected behavior change: fast scroll should keep the viewport covered by either real rows or placeholders under normal local-data conditions.
- Tests to add/update:
  - Extend the Slice 3 e2e cases with the failing scenario before fixing.
  - Add component/unit coverage if the root cause is range math, retained windows, scroll sampling, or transform sync.
- Validation command: `pnpm e2e -- e2e/sandbox-grid.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid): keep virtual viewport covered during fast scroll`

## Slice 5: Adaptive Overscan Consistency Contract

- Status: Completed. The Vue app row adaptive overscan path now consumes the core vertical overscan controller through the internal core surface, and focused core/Vue tests cover burst, jump, idle reset, disabled, horizontal edge clamping, and app-profile overscan behavior.
- Objective: make adaptive overscan decisions consistent across core and Vue app paths without replacing the current architecture.
- Affected packages/files:
  - `packages/datagrid-core/src/virtualization/dynamicOverscan.ts`
  - `packages/datagrid-core/src/viewport/dataGridViewportHorizontalUpdate.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
  - `packages/datagrid-core/src/viewport/__tests__/verticalOverscan.contract.spec.ts`
- Expected behavior change: equivalent scroll velocity and direction inputs should produce documented, bounded overscan decisions across both paths.
- Tests to add/update:
  - Unit tests for wheel, touch, jump scroll, direction reversal, idle reset, and disabled adaptive overscan.
  - Contract tests comparing core and app overscan outputs where shared inputs exist.
  - Regression tests for overscan clamping near first and last row/column.
- Validation command: `pnpm --filter @affino/datagrid-core test -- --runInBand overscan && pnpm --filter @affino/datagrid-vue type-check && pnpm --filter @affino/datagrid-vue exec vitest run --config vitest.config.ts --testNamePattern viewport`
- Risk level: Medium
- Suggested commit message: `test(datagrid): align adaptive overscan contracts`

## Slice 6: Retained Rows During Cache Replacement

- Status: Completed. Core datasource coverage now proves visible-row retention through partial cache replacement, direction reversal, failed replacement reload, manual refresh failure, and retry. `e2e/sandbox-grid.spec.ts` also covers the server datasource visible-refresh path with the blank-viewport detector.
- Objective: prove and harden retained visible rows while datasource cache replacement or refresh is in progress.
- Affected packages/files:
  - `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
  - `packages/datagrid-core/src/models/server/rangeCache.ts`
  - `packages/datagrid-core/src/models/__tests__/dataSourceBackedRowModel.spec.ts`
  - `packages/datagrid-sandbox/src/components/VueServerDataSourceGridCard.vue`
  - `e2e/sandbox-grid.spec.ts`
- Expected behavior change: visible rows should remain stable during cache replacement until replacement data or placeholders are available.
- Tests to add/update:
  - Unit tests for `replaceCacheWithRows` while the viewport intersects stale rows.
  - Tests for direction reversal during replacement.
  - Tests for partial refresh, failed refresh, and retry while visible rows are retained.
  - Sandbox/e2e coverage that verifies no blank viewport during datasource refresh.
- Validation command: `pnpm --filter @affino/datagrid-core test -- --runInBand dataSourceBackedRowModel`
- Risk level: High
- Suggested commit message: `fix(datagrid): retain visible rows during datasource refresh`

## Slice 7: Server Placeholder Exposure Telemetry

- Status: Completed. Datasource diagnostics now expose placeholder exposure counts/durations and viewport data availability timing; the server datasource sandbox surfaces those values as diagnostics data attributes, and the datasource churn benchmark reports them in scenario output and aggregate JSON.
- Objective: measure how long placeholder rows remain visible for server-backed virtualization.
- Affected packages/files:
  - `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
  - `packages/datagrid-core/src/models/rowModel.ts`
  - `packages/datagrid-core/src/models/server/dataSourceProtocol.ts`
  - `packages/datagrid-sandbox/src/components/VueServerDataSourceGridCard.vue`
  - `e2e/sandbox-grid.spec.ts`
  - `scripts/bench-datagrid-datasource-churn.mjs`
- Expected behavior change: optional telemetry reports placeholder exposure duration, placeholder counts, and time from viewport request to row availability.
- Tests to add/update:
  - Unit tests for placeholder exposure start/stop events.
  - Benchmark assertions or snapshot output for datasource latency profiles.
  - E2E assertions that placeholder exposure is observable but bounded in demo scenarios.
- Validation command: `pnpm --filter @affino/datagrid-core test -- --runInBand dataSourceBackedRowModel && node scripts/bench-datagrid-datasource-churn.mjs`
- Risk level: Medium
- Suggested commit message: `feat(datagrid): track datasource placeholder exposure`

## Slice 8: Server Placeholder Exposure Budget

- Status: Completed. `scripts/bench-datagrid-datasource-churn.mjs` now includes a controlled-latency placeholder scenario for cold scroll, warm scroll, direction reversal, jump scroll, and retry, plus warning-only placeholder exposure and viewport data availability budgets. Harness/package budget wiring and `docs/perf/datagrid-performance-gates.md` document the thresholds and promotion flag.
- Objective: convert placeholder telemetry into enforceable warning or failure budgets for enterprise scenarios.
- Affected packages/files:
  - `docs/perf/datagrid-performance-gates.md`
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `scripts/bench-datagrid-datasource-churn.mjs`
  - `packages/datagrid-sandbox/src/serverDatasourceDemo/*`
- Expected behavior change: validation reports fail or warn when placeholder exposure exceeds the documented budget under controlled latency.
- Tests to add/update:
  - Benchmark scenario with cold scroll, warm scroll, direction reversal, jump scroll, and retry.
  - CI-friendly thresholds that start warning-only if baseline variance is unknown.
  - Docs update for placeholder exposure budget and interpretation.
- Validation command: `node scripts/bench-datagrid-datasource-churn.mjs`
- Risk level: Medium
- Suggested commit message: `test(datagrid): gate datasource placeholder exposure`

## Slice 9: Focus Continuity Across Virtual Unmounts

- Status: Completed. Existing selection remount coverage is now extended with active-cell DOM focus assertions after vertical unmount/remount, keyboard navigation beyond the rendered range, and contract coverage for unmounted active-cell visibility with variable row heights and horizontal virtualization. No runtime fix was required by this slice.
- Objective: preserve active-cell and keyboard focus semantics when rows or cells leave and re-enter the virtual window.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppActiveCellViewport.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-orchestration/src/cells/useDataGridCellVisibilityScroller.ts`
  - `e2e/sandbox-interactions.spec.ts`
- Expected behavior change: active cell, DOM focus target, and keyboard navigation remain predictable across virtual remounts.
- Tests to add/update:
  - E2E for keyboard navigation beyond the rendered range.
  - E2E for scroll away and back to the active cell.
  - Unit/component tests for `ensureActiveCellVisible` with variable row heights and horizontal virtualization.
- Validation command: `pnpm e2e -- e2e/sandbox-interactions.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid): preserve focus across virtual remounts`

## Slice 10: Selection And Clipboard Continuity

- Status: Completed. Selection plan slices already closed core selection continuity; this slice added paste-target guarding through virtual selection metadata so unloaded or stale virtual target ranges are blocked before local clipboard edits run. Existing loaded-interval coverage and placeholder copy/paste blocking remain the baseline for source ranges.
- Objective: make selection, copy, paste, and fill behavior explicit across unloaded, placeholder, and remounted rows.
- Affected packages/files:
  - `packages/datagrid-core/src/selection/virtualSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppCellSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-orchestration/src/clipboard/*`
- Expected behavior change: large virtual selections either operate through documented loaded intervals/server materialization or fail with a clear blocked state; paste targets now honor virtual selection coverage before applying edits.
- Tests to add/update:
  - Unit tests for loaded coverage intervals and placeholder blocking.
  - Component/e2e tests for copy/paste/fill across a range larger than the rendered window.
  - Server-backed tests for unloaded source and target rows.
- Validation command: `pnpm --filter @affino/datagrid-core exec vitest run --config vitest.config.ts src/selection/__tests__/virtualSelection.spec.ts && pnpm --filter @affino/datagrid-vue exec vitest run --config vitest.config.ts src/app/__tests__/useDataGridAppClipboard.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid): harden virtual selection operations`

## Slice 11: Edit Lifecycle Continuity

- Status: Completed. Active inline edits now commit when their rendered row or rendered column leaves the virtual window, covering vertical row unmounts and horizontal column unmounts without relying on DOM blur ordering. Existing placeholder-tail materialization coverage continues to validate edit-driven placeholder replacement.
- Objective: define and test editor behavior when an edited cell is virtualized out and later remounted.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/stage/useDataGridTableStageRuntime.ts`
  - `e2e/sandbox-interactions.spec.ts`
- Expected behavior change: edit commit, cancel, blur, and remount behavior are deterministic; virtualization unmount commits the draft once without forcing focus or scroll restoration.
- Tests added/covered:
  - E2E for edit then scroll out of the rendered row window.
  - Existing E2E for placeholder-tail edit materialization.
  - Server datasource placeholder replacement e2e stabilized with a rowId-anchored loading-cell locator.
- Validation command: `pnpm exec playwright test e2e/sandbox-interactions.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid): stabilize editing across virtualization`

## Slice 12: Wide Table Horizontal Virtualization Gate

- Status: Completed. Core horizontal stress coverage now includes 1k and 10k column windows with pinned panes and mutation while horizontally scrolled; the Vue sandbox path exposes a 1000-column mode and has browser coverage for blank horizontal bands with a bounded rendered column window.
- Objective: validate horizontal virtualization for enterprise-wide tables.
- Affected packages/files:
  - `packages/datagrid-core/src/virtualization/horizontalVirtualizer.ts`
  - `packages/datagrid-core/src/viewport/dataGridViewportHorizontalMeta.ts`
  - `packages/datagrid-core/src/viewport/dataGridViewportHorizontalUpdate.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
  - `packages/datagrid-core/src/viewport/__tests__/horizontalVirtualization.stress.contract.spec.ts`
  - `e2e/sandbox-grid.spec.ts`
- Expected behavior change: 1k and 10k column scenarios remain covered with stable pinned panes, no blank horizontal bands, and bounded rendered column counts.
- Tests added/covered:
  - Core stress tests for 1k and 10k columns.
  - E2E horizontal fast scroll with column virtualization enabled on a 1000-column Vue base grid.
  - Column resize/reorder/hide/show while horizontally scrolled.
  - Pinned left/right columns near horizontal max scroll.
- Validation command: `pnpm --filter @affino/datagrid-core exec vitest run --config vitest.config.ts src/viewport/__tests__/horizontalVirtualization.stress.contract.spec.ts && pnpm exec playwright test e2e/sandbox-grid.spec.ts`
- Risk level: Medium
- Suggested commit message: `test(datagrid): gate wide horizontal virtualization`

## Slice 13: Grouped And Tree Row Virtualization Contract

- Status: Completed. The viewport row-model boundary now documents grouped/tree flattened projection ownership, expansion/collapse invalidation, selection policy boundaries, and server/data-source limitations. Core viewport coverage now verifies grouped collapse and parent-tree collapse/re-expand while the active viewport is near affected rows; the controller also treats row-count changes as structural invalidations instead of scroll-only fast-path updates.
- Objective: define supported behavior for grouped/tree rows under virtualization before adding broad behavior.
- Affected packages/files:
  - `packages/datagrid-core/src/models/*`
  - `packages/datagrid-core/src/selection/virtualSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
  - `docs/datagrid-viewport-rowmodel-boundary.md`
  - `docs/audits/VIRTUALIZATION_ENTERPRISE_AUDIT.md`
- Expected behavior change: grouped/tree expansion behavior is implemented as a tested flattened row-model contract for client projections, with server/data-source grouped placeholders documented as partial until datasource metadata coverage is added.
- Tests added/covered:
  - Viewport row-model boundary tests for grouped collapse invalidating ranges around the viewport.
  - Viewport row-model boundary tests for parent-tree collapse/re-expand near the active viewport.
  - Existing grouped selection policy tests continue to cover collapsed flattened rows and descendant selection expansion.
- Validation command: `pnpm --filter @affino/datagrid-core exec vitest run --config vitest.config.ts src/viewport/__tests__/rowModelBoundary.contract.spec.ts src/selection/__tests__/selectionState.grouped.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid): clamp grouped viewport ranges`

## Slice 14: Resize, Zoom, And Fractional Pixel Cases

- Status: Completed. Core range invariants now cover fractional row heights, fractional column widths, zoom, and near-max horizontal scroll. Browser coverage now exercises high-DPI viewport resize while scrolled on the Vue base grid and server datasource resize while loading.
- Objective: harden range math and rendering under container resize, browser zoom, fractional pixels, and high-DPI device scale factors.
- Affected packages/files:
  - `packages/datagrid-core/src/virtualization/verticalVirtualizer.ts`
  - `packages/datagrid-core/src/virtualization/horizontalVirtualizer.ts`
  - `packages/datagrid-core/src/viewport/dataGridViewportController.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
  - `e2e/sandbox-grid.spec.ts`
- Expected behavior change: no visible gaps, duplicate rows, or horizontal drift under fractional dimensions and resize.
- Tests added/covered:
  - Unit tests for fractional row heights, fractional column widths, and scroll positions near max.
  - Playwright tests with device scale factor and viewport resize.
  - E2E resize while scrolled and while server rows are loading.
- Validation command: `pnpm --filter @affino/datagrid-core exec vitest run --config vitest.config.ts src/viewport/__tests__/virtualizationRangeInvariants.contract.spec.ts src/viewport/__tests__/horizontalVirtualWindowMath.contract.spec.ts src/viewport/__tests__/scrollResizeDeterminism.contract.spec.ts && pnpm exec playwright test e2e/sandbox-grid.spec.ts --grep "high-DPI|resized during loading"`
- Risk level: Medium
- Suggested commit message: `test(datagrid): cover fractional viewport edge cases`

## Slice 15: Virtualized Accessibility Mapping

- Status: Completed. The Vue app stage now exposes grid-level row/column counts, one-based row and column indexes on virtualized rows/cells, deterministic selected state after remount, and placeholder `aria-disabled` metadata. Vue adapter, app component, and Playwright coverage verify the mapping after scroll and keyboard navigation.
- Objective: verify virtualized rows and cells expose correct accessibility metadata.
- Affected packages/files:
  - `docs/datagrid-headless-a11y-contract.md`
  - `packages/datagrid-vue/src/adapters/a11yAttributesAdapter.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStagePinnedPane.vue`
  - `e2e/sandbox-interactions.spec.ts`
- Expected behavior change: virtualized DOM exposes stable row/column counts and row/column indexes where supported.
- Tests added/covered:
  - Component tests for `aria-rowcount`, `aria-colcount`, `aria-rowindex`, and `aria-colindex`.
  - E2E focus navigation with screen-reader-relevant attributes present after scroll.
  - Placeholder row accessibility assertions.
- Validation command: `pnpm --filter @affino/datagrid-vue exec vitest run --config vitest.config.ts src/adapters/__tests__/a11yAttributesAdapter.contract.spec.ts && pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/__tests__/DataGrid.contract.spec.ts --testNamePattern "aria indexes|selection aria" && pnpm exec playwright test e2e/sandbox-interactions.spec.ts`
- Risk level: Medium
- Suggested commit message: `fix(datagrid): expose virtualized a11y indexes`

## Slice 16: Telemetry Events For Virtualization

- Status: Completed. Optional scroll/virtualization telemetry now records bounded event payloads only when enabled, and `dgPerfTrace=1` viewport samples include rendered row/column counts, range resolve timing, row/column overscan, placeholder rows, blank-viewport flags, and benchmark extraction summaries.
- Objective: add low-overhead telemetry for range calculation, rendered counts, overscan, blank detection, placeholder exposure, and churn.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
  - `packages/datagrid-orchestration/src/scrolling/useDataGridScrollPerfTelemetry.ts`
  - `packages/datagrid-core/src/viewport/dataGridViewportController.ts`
  - `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
- Expected behavior change: optional perf tracing exposes enterprise virtualization metrics without changing default rendering behavior.
- Tests added/covered:
  - Unit tests for telemetry event shape and disabled-by-default behavior.
  - Browser benchmark extraction of rendered row/column count, overscan decision, blank viewport events, placeholder exposure, and long tasks.
  - Regression test that telemetry does not add reactive scroll writes when disabled.
- Validation command: `pnpm --filter @affino/datagrid-orchestration exec vitest run --config vitest.config.ts src/__tests__/useDataGridScrollPerfTelemetry.contract.spec.ts && pnpm --filter @affino/datagrid-vue exec vitest run --config vitest.config.ts src/app/__tests__/useDataGridAppViewport.contract.spec.ts --testNamePattern "telemetry|overscan|coalesces" && node scripts/bench-datagrid-enterprise-browser-frames.mjs`
- Risk level: Medium
- Suggested commit message: `feat(datagrid): report virtualization telemetry`

## Slice 17: Perf Gates For Enterprise Virtualization

- Status: Planned. This slice should consume telemetry/benchmarks from earlier slices instead of introducing a separate performance track.
- Objective: turn telemetry and benchmarks into repeatable gates for large and wide grids.
- Affected packages/files:
  - `docs/perf/datagrid-performance-gates.md`
  - `scripts/bench-datagrid-browser-frames.mjs`
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `scripts/bench-datagrid-harness.mjs`
  - `scripts/bench-datagrid-rowmodels.mjs`
  - `scripts/bench-datagrid-interactions.mjs`
- Expected behavior change: CI or local validation can report pass/fail or warning-only budgets for frame time, long tasks, rendered counts, churn, placeholder exposure, and heap growth.
- Tests to add/update:
  - 10k, 100k, and 1M row benchmark scenarios.
  - 100, 1k, and 10k column benchmark scenarios.
  - Custom renderer benchmark scenario.
  - Server latency benchmark scenario.
- Validation command: `node scripts/bench-datagrid-harness.mjs`
- Risk level: Medium
- Suggested commit message: `test(datagrid): add enterprise virtualization perf gates`

## Slice 18: Documentation And Support Matrix

- Status: Planned.
- Objective: keep enterprise virtualization behavior, limitations, and validation expectations explicit.
- Affected packages/files:
  - `docs/audits/VIRTUALIZATION_ENTERPRISE_AUDIT.md`
  - `docs/plans/VIRTUALIZATION_ENTERPRISE_PLAN.md`
  - `docs/datagrid-viewport-rowmodel-boundary.md`
  - `docs/perf/datagrid-performance-gates.md`
  - `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md`
- Expected behavior change: documentation names supported, partial, and unsupported virtualization behavior without implying unverified enterprise guarantees.
- Tests to add/update:
  - Markdown/docs validation only.
  - Link/reference validation if available.
- Validation command: `node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Low
- Suggested commit message: `docs(datagrid): document virtualization support matrix`

## Recommended Execution Order

1. Slice 1: Core Visible Range Invariants
2. Slice 2: Viewport Controller Integration Invariants
3. Slice 3: Blank Viewport Detection Harness
4. Slice 4: Blank Viewport Prevention Fixes
5. Slice 5: Adaptive Overscan Consistency Contract
6. Slice 6: Retained Rows During Cache Replacement
7. Slice 7: Server Placeholder Exposure Telemetry
8. Slice 8: Server Placeholder Exposure Budget
9. Slice 9: Focus Continuity Across Virtual Unmounts
10. Slice 10: Selection And Clipboard Continuity (completed)
11. Slice 11: Edit Lifecycle Continuity (completed)
12. Slice 12: Wide Table Horizontal Virtualization Gate (completed)
13. Slice 13: Grouped And Tree Row Virtualization Contract (completed)
14. Slice 14: Resize, Zoom, And Fractional Pixel Cases (completed)
15. Slice 15: Virtualized Accessibility Mapping (completed)
16. Slice 16: Telemetry Events For Virtualization (completed)
17. Slice 17: Perf Gates For Enterprise Virtualization (next)
18. Slice 18: Documentation And Support Matrix

## Execution Notes

- Preserve existing desktop behavior unless a slice explicitly targets a proven virtualization defect.
- Keep `datagrid-core` responsible for deterministic viewport math and reusable virtualizer contracts.
- Keep `datagrid-vue` and `datagrid-vue-app` responsible for renderer integration, retained windows, DOM focus, pane synchronization, and user-visible placeholder behavior.
- Do not introduce a parallel virtualization manager. Extend existing viewport, row-model, stage, telemetry, and benchmark paths.
- Avoid public API changes unless a slice explicitly identifies and approves the API first.
- Treat blank viewport prevention, placeholder exposure, stable row/cell identity, pinned pane synchronization, and frame-budget impact as first-class acceptance criteria.
- Keep scroll-time work latency-sensitive: avoid reactive writes in hot paths, avoid layout read/write thrash, and prefer rAF-batched synchronization.
- Keep docs and audit status aligned when a slice is completed.
