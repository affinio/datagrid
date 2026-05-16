# DataGrid Virtualization Enterprise Implementation Plan

This plan converts `docs/VIRTUALIZATION_ENTERPRISE_AUDIT.md` into small, separable implementation slices. The order is intentional: prove correctness first, then prevent blanking, then harden server-backed and interaction behavior, then broaden enterprise performance gates.

## Slice 1: Core Visible Range Invariants

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
- Validation command: `pnpm --filter @affino/datagrid-core test -- --runInBand overscan && pnpm --filter @affino/datagrid-vue test -- --runInBand viewport`
- Risk level: Medium
- Suggested commit message: `test(datagrid): align adaptive overscan contracts`

## Slice 6: Retained Rows During Cache Replacement

- Objective: prove and harden retained visible rows while datasource cache replacement or refresh is in progress.
- Affected packages/files:
  - `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
  - `packages/datagrid-core/src/models/server/rangeCache.ts`
  - `packages/datagrid-core/src/models/__tests__/dataSourceBackedRowModel.spec.ts`
  - `packages/datagrid-sandbox/src/components/VueServerDataSourceGridCard.vue`
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

- Objective: measure how long placeholder rows remain visible for server-backed virtualization.
- Affected packages/files:
  - `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
  - `packages/datagrid-orchestration/src/scrolling/useDataGridScrollPerfTelemetry.ts`
  - `packages/datagrid-sandbox/src/components/VueServerDataSourceGridCard.vue`
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

- Objective: make selection, copy, paste, and fill behavior explicit across unloaded, placeholder, and remounted rows.
- Affected packages/files:
  - `packages/datagrid-core/src/selection/virtualSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppCellSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-orchestration/src/clipboard/*`
- Expected behavior change: large virtual selections should either operate through documented loaded intervals/server materialization or fail with a clear blocked state.
- Tests to add/update:
  - Unit tests for loaded coverage intervals and placeholder blocking.
  - Component/e2e tests for copy/paste/fill across a range larger than the rendered window.
  - Server-backed tests for unloaded source and target rows.
- Validation command: `pnpm --filter @affino/datagrid-core test -- --runInBand virtualSelection && pnpm --filter @affino/datagrid-vue test -- --runInBand clipboard`
- Risk level: High
- Suggested commit message: `fix(datagrid): harden virtual selection operations`

## Slice 11: Edit Lifecycle Continuity

- Objective: define and test editor behavior when an edited cell is virtualized out and later remounted.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/stage/useDataGridTableStageRuntime.ts`
  - `e2e/sandbox-interactions.spec.ts`
- Expected behavior change: edit commit, cancel, blur, and remount behavior become deterministic and documented.
- Tests to add/update:
  - E2E for edit then scroll out of range.
  - E2E for edit then programmatic scroll-to-cell.
  - Component tests for placeholder replacement while edit state exists.
- Validation command: `pnpm e2e -- e2e/sandbox-interactions.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid): stabilize editing across virtualization`

## Slice 12: Wide Table Horizontal Virtualization Gate

- Objective: validate horizontal virtualization for enterprise-wide tables.
- Affected packages/files:
  - `packages/datagrid-core/src/virtualization/horizontalVirtualizer.ts`
  - `packages/datagrid-core/src/viewport/dataGridViewportHorizontalMeta.ts`
  - `packages/datagrid-core/src/viewport/dataGridViewportHorizontalUpdate.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
  - `packages/datagrid-core/src/viewport/__tests__/horizontalVirtualization.stress.contract.spec.ts`
  - `e2e/sandbox-grid.spec.ts`
- Expected behavior change: 1k and 10k column scenarios remain covered with stable pinned panes, no blank horizontal bands, and bounded rendered column counts.
- Tests to add/update:
  - Core stress tests for 1k and 10k columns.
  - E2E horizontal fast scroll with column virtualization enabled.
  - Column resize/reorder/hide/show while horizontally scrolled.
  - Pinned left/right columns near horizontal max scroll.
- Validation command: `pnpm --filter @affino/datagrid-core test -- --runInBand horizontalVirtualization && pnpm e2e -- e2e/sandbox-grid.spec.ts`
- Risk level: Medium
- Suggested commit message: `test(datagrid): gate wide horizontal virtualization`

## Slice 13: Grouped And Tree Row Virtualization Contract

- Objective: define supported behavior for grouped/tree rows under virtualization before adding broad behavior.
- Affected packages/files:
  - `packages/datagrid-core/src/models/*`
  - `packages/datagrid-core/src/selection/virtualSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
  - `docs/datagrid-viewport-rowmodel-boundary.md`
  - `docs/VIRTUALIZATION_ENTERPRISE_AUDIT.md`
- Expected behavior change: grouped/tree expansion behavior is either implemented as a tested virtual row-model contract or documented as unsupported/partial.
- Tests to add/update:
  - Unit tests for expand/collapse invalidating ranges around the viewport.
  - Selection/focus tests when expansion changes row indexes.
  - Placeholder tests if grouped rows are server-backed.
- Validation command: `pnpm --filter @affino/datagrid-core test -- --runInBand rowModel`
- Risk level: High
- Suggested commit message: `docs(datagrid): define grouped virtualization contract`

## Slice 14: Resize, Zoom, And Fractional Pixel Cases

- Objective: harden range math and rendering under container resize, browser zoom, fractional pixels, and high-DPI device scale factors.
- Affected packages/files:
  - `packages/datagrid-core/src/virtualization/verticalVirtualizer.ts`
  - `packages/datagrid-core/src/virtualization/horizontalVirtualizer.ts`
  - `packages/datagrid-core/src/viewport/dataGridViewportController.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
  - `e2e/sandbox-grid.spec.ts`
- Expected behavior change: no visible gaps, duplicate rows, or horizontal drift under fractional dimensions and resize.
- Tests to add/update:
  - Unit tests for fractional row heights, fractional column widths, and scroll positions near max.
  - Playwright tests with device scale factor and viewport resize.
  - E2E resize while scrolled and while server rows are loading.
- Validation command: `pnpm --filter @affino/datagrid-core test -- --runInBand viewport && pnpm e2e -- e2e/sandbox-grid.spec.ts`
- Risk level: Medium
- Suggested commit message: `test(datagrid): cover fractional viewport edge cases`

## Slice 15: Virtualized Accessibility Mapping

- Objective: verify virtualized rows and cells expose correct accessibility metadata.
- Affected packages/files:
  - `docs/datagrid-headless-a11y-contract.md`
  - `packages/datagrid-vue/src/adapters/a11yAttributesAdapter.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `e2e/sandbox-interactions.spec.ts`
- Expected behavior change: virtualized DOM exposes stable row/column counts and row/column indexes where supported.
- Tests to add/update:
  - Component tests for `aria-rowcount`, `aria-colcount`, `aria-rowindex`, and `aria-colindex`.
  - E2E focus navigation with screen-reader-relevant attributes present after scroll.
  - Placeholder row accessibility assertions.
- Validation command: `pnpm --filter @affino/datagrid-vue test -- --runInBand a11y && pnpm e2e -- e2e/sandbox-interactions.spec.ts`
- Risk level: Medium
- Suggested commit message: `fix(datagrid): expose virtualized a11y indexes`

## Slice 16: Telemetry Events For Virtualization

- Objective: add low-overhead telemetry for range calculation, rendered counts, overscan, blank detection, placeholder exposure, and churn.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
  - `packages/datagrid-orchestration/src/scrolling/useDataGridScrollPerfTelemetry.ts`
  - `packages/datagrid-core/src/viewport/dataGridViewportController.ts`
  - `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
- Expected behavior change: optional perf tracing exposes enterprise virtualization metrics without changing default rendering behavior.
- Tests to add/update:
  - Unit tests for telemetry event shape and disabled-by-default behavior.
  - Browser benchmark extraction of rendered row/column count, overscan decision, blank viewport events, placeholder exposure, and long tasks.
  - Regression test that telemetry does not add reactive scroll writes when disabled.
- Validation command: `pnpm --filter @affino/datagrid-vue test -- --runInBand perf && node scripts/bench-datagrid-enterprise-browser-frames.mjs`
- Risk level: Medium
- Suggested commit message: `feat(datagrid): report virtualization telemetry`

## Slice 17: Perf Gates For Enterprise Virtualization

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

- Objective: keep enterprise virtualization behavior, limitations, and validation expectations explicit.
- Affected packages/files:
  - `docs/VIRTUALIZATION_ENTERPRISE_AUDIT.md`
  - `docs/VIRTUALIZATION_ENTERPRISE_PLAN.md`
  - `docs/datagrid-viewport-rowmodel-boundary.md`
  - `docs/perf/datagrid-performance-gates.md`
  - `docs/MOBILE_TOUCH_SCROLL_AUDIT.md`
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
10. Slice 10: Selection And Clipboard Continuity
11. Slice 11: Edit Lifecycle Continuity
12. Slice 12: Wide Table Horizontal Virtualization Gate
13. Slice 13: Grouped And Tree Row Virtualization Contract
14. Slice 14: Resize, Zoom, And Fractional Pixel Cases
15. Slice 15: Virtualized Accessibility Mapping
16. Slice 16: Telemetry Events For Virtualization
17. Slice 17: Perf Gates For Enterprise Virtualization
18. Slice 18: Documentation And Support Matrix
