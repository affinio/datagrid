# DataGrid Rendering Pipeline Enterprise Implementation Plan

This plan converts `docs/audits/RENDERING_PIPELINE_AUDIT.md` into small, separable implementation slices. The order is intentional: remove avoidable hot-path work first, then add renderer contracts and telemetry, then promote browser gates for custom renderers, pinned panes, overlays, auto-height rows, and wide windows.

Current execution state:

- Slice 1 is completed and should be treated as the center-pane diagnostics guard baseline.
- Slice 2 is completed and should be treated as the renderer contract documentation baseline.
- Slice 3 is the next implementation slice.
- `docs/plans/VIRTUALIZATION_ENTERPRISE_PLAN.md` is closed as of 2026-05-18. Rendering slices should reuse the virtualization telemetry and browser-frame harness where useful instead of creating a parallel performance track.
- Selection and interaction slices already closed important overlay, active-cell, edit, and pointer ownership behavior. Do not duplicate those unless a rendering slice exposes a separate DOM/render invariant.

## Slice 1: Center Pane Diagnostics Guard

- Status: Completed. Center-pane diagnostics now avoid body/value sampling when no diagnostics callback is provided, and regression coverage proves disabled diagnostics do not add custom renderer calls.
- Objective: remove avoidable diagnostics sampling from normal rendering.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/__tests__/DataGridTableStage.contract.spec.ts`
  - `docs/audits/RENDERING_PIPELINE_AUDIT.md`
- Expected behavior change: no public behavior change; diagnostic payloads remain available when the callback is provided.
- Tests added/covered:
  - Component regression that disabled center-pane diagnostics do not call the custom cell renderer beyond normal DOM rendering.
- Validation command: `pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/__tests__/DataGridTableStage.contract.spec.ts --testNamePattern "center-pane diagnostics"`
- Risk level: Low
- Suggested commit message: `fix(datagrid-vue-app): guard center pane diagnostics`

## Slice 2: Renderer Contract Documentation

- Status: Completed. Public renderer documentation now names renderer purity, synchronous layout-read avoidance, no grid-state mutation during render, stable child VNode keys, bounded per-cell work, placeholder-aware `surface.kind`, and scroll-time cost expectations.
- Objective: document public renderer expectations before adding stricter isolation or fallback behavior.
- Affected packages/files:
  - `packages/datagrid-vue-app/README.md`
  - `docs/audits/RENDERING_PIPELINE_AUDIT.md`
  - `docs/perf/datagrid-performance-gates.md`
- Expected behavior change: no runtime behavior change; user-facing docs describe renderer purity, layout-read avoidance, stable VNode keys, placeholder surface context, and scroll-time cost expectations.
- Tests added/covered:
  - Docs validation only.
- Validation command: `node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Low
- Suggested commit message: `docs(datagrid-vue-app): document renderer contracts`

## Slice 3: Render Telemetry Counters

- Status: Planned.
- Objective: add opt-in render telemetry behind existing perf tracing for renderer invocation counts, DOM node counts, and render-window composition.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStagePinnedPane.vue`
  - `packages/datagrid-vue-app/src/stage/dataGridPerfTrace.ts`
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
- Expected behavior change: `dgPerfTrace=1` can observe render counts without adding default production overhead.
- Tests to add/update:
  - Unit/component tests for disabled-by-default telemetry.
  - Browser benchmark extraction for render counts where practical.
- Validation command: `pnpm --filter @affino/datagrid-vue-app test:unit -- dataGridPerfTrace useDataGridStageCellRendering`
- Risk level: Medium
- Suggested commit message: `feat(datagrid-vue-app): report render telemetry`

## Slice 4: Custom Renderer Error Fallback

- Status: Planned.
- Objective: isolate public renderer failures with a safe fallback path that preserves cell text, selection/focus state, and placeholder semantics.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridCellContentRenderer.ts`
  - `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageCellRendering.spec.ts`
- Expected behavior change: a throwing custom renderer does not break the whole grid render tree.
- Tests to add/update:
  - Renderer throw fallback for leaf and group rows.
  - Placeholder row fallback context.
- Validation command: `pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/stage/__tests__/useDataGridStageCellRendering.spec.ts`
- Risk level: Medium
- Suggested commit message: `fix(datagrid-vue-app): isolate renderer failures`

## Slice 5: Lightweight Scroll Rendering Policy

- Status: Planned.
- Objective: make scroll-active lightweight rendering explicit for expensive custom renderers without hiding editors, active cell/focus, selection affordances, placeholders, or a11y labels.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStagePinnedPane.vue`
  - `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md`
- Expected behavior change: expensive authored renderers can be bypassed during active scroll according to a documented policy.
- Tests to add/update:
  - Scroll-active rendering preserves display values.
  - Active editors and placeholder/a11y metadata are not degraded.
- Validation command: `pnpm --filter @affino/datagrid-vue-app test:unit -- useDataGridStageCellRendering DataGridTableStage`
- Risk level: High
- Suggested commit message: `perf(datagrid-vue-app): lighten cell rendering while scrolling`

## Slice 6: Mount And Unmount Churn Benchmark

- Status: Planned.
- Objective: convert row/cell mount and unmount churn into a repeatable benchmark signal for vertical and horizontal virtual scroll.
- Affected packages/files:
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `scripts/bench-datagrid-harness.mjs`
  - `docs/perf/datagrid-performance-gates.md`
- Expected behavior change: local and CI benchmark artifacts can report warning or hard budgets for row/cell churn.
- Tests to add/update:
  - Vertical virtual scroll churn scenario.
  - Horizontal virtual scroll churn scenario with pinned panes.
- Validation command: `pnpm run bench:datagrid:enterprise:virtualization:assert`
- Risk level: Medium
- Suggested commit message: `test(datagrid): gate render churn during scroll`

## Slice 7: Chrome And Overlay Duration Telemetry

- Status: Planned.
- Objective: measure chrome draw duration, redraw mode, overlay compute duration, and overlay segment counts.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/useDataGridStageChromeCanvas.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridStageOverlays.ts`
  - `packages/datagrid-vue-app/src/stage/dataGridPerfTrace.ts`
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
- Expected behavior change: perf tracing exposes chrome and overlay work that shares the scroll frame.
- Tests to add/update:
  - Disabled-by-default telemetry tests.
  - Overlay segment count extraction tests.
- Validation command: `pnpm --filter @affino/datagrid-vue-app test:unit -- useDataGridStageChromeCanvas useDataGridStageOverlays dataGridPerfTrace`
- Risk level: Medium
- Suggested commit message: `feat(datagrid-vue-app): trace chrome and overlay render cost`

## Slice 8: Enterprise Rendering Browser Gates

- Status: Planned.
- Objective: add browser-frame scenarios for custom renderers, auto-height rows, pinned panes, overlays, and wide horizontal rendering.
- Affected packages/files:
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `scripts/bench-datagrid-harness.mjs`
  - `docs/perf/datagrid-performance-gates.md`
- Expected behavior change: rendering-heavy grids have repeatable local/CI performance gates.
- Tests to add/update:
  - 100k-row plain rendering baseline.
  - 100k-row slow custom renderer scenario.
  - 1k-column pinned-pane scenario.
  - Auto-height custom renderer scenario.
  - Overlay-heavy selection/fill scenario.
- Validation command: `node scripts/bench-datagrid-harness.mjs`
- Risk level: High
- Suggested commit message: `test(datagrid): add enterprise rendering browser gates`

## Recommended Execution Order

1. Slice 1: Center Pane Diagnostics Guard (completed)
2. Slice 2: Renderer Contract Documentation (completed)
3. Slice 3: Render Telemetry Counters (next)
4. Slice 4: Custom Renderer Error Fallback
5. Slice 5: Lightweight Scroll Rendering Policy
6. Slice 6: Mount And Unmount Churn Benchmark
7. Slice 7: Chrome And Overlay Duration Telemetry
8. Slice 8: Enterprise Rendering Browser Gates

## Execution Notes

- Do not introduce a parallel renderer runtime.
- Keep public renderer behavior compatible until contracts and warnings are documented.
- Keep telemetry opt-in or perf-mode scoped.
- Preserve desktop scroll, selection, editing, a11y, and placeholder behavior while changing render paths.
- Delay center/pinned template deduplication until renderer behavior is covered by tests.
