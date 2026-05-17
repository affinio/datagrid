# DataGrid Interaction Orchestration Enterprise Implementation Plan

This plan converts `docs/audits/INTERACTION_ORCHESTRATION_AUDIT.md` into small, separable implementation slices. The order is intentional: lock existing desktop behavior first, then make active-owner and cancellation semantics explicit, then harden event policy, touch workflows, focus/edit continuity, and enterprise validation gates.

## Slice 1: Active Interaction Owner Invariants

- Status: Completed on 2026-05-17. Added the owner snapshot contract for drag selection, fill, range move, column resize, and row resize, with focused contract coverage for owner exclusivity and start-order transitions.
- Objective: add a diagnostic contract that can answer which interaction owns the current gesture without changing existing desktop behavior.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppHeaderResize.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppRowSizing.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridTableStageScrollSync.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridStagePointerInteractions.ts`
  - `packages/datagrid-vue/src/app/__tests__/useDataGridAppInteractionController.contract.spec.ts`
  - `packages/datagrid-vue/src/app/__tests__/useDataGridAppRowSizing.contract.spec.ts`
- Expected behavior change: no intentional user-facing behavior change; drag selection, fill, range move, column resize, row resize, and touch pan should expose mutually exclusive active-owner state for tests and diagnostics.
- Tests to add/update:
  - Contract tests asserting only one owner is active at a time.
  - Start-order tests for fill, range move, drag selection, column resize, row resize, and linked-surface touch pan.
  - Tests that rejected starts leave the previous owner unchanged.
- Validation command: `pnpm --filter @affino/datagrid-vue test:unit -- src/app/__tests__/dataGridInteractionOwner.spec.ts src/app/__tests__/useDataGridAppInteractionController.contract.spec.ts src/app/__tests__/useDataGridAppHeaderResize.contract.spec.ts src/app/__tests__/useDataGridAppRowSizing.contract.spec.ts && pnpm --filter @affino/datagrid-vue type-check`
- Risk level: Medium
- Suggested commit message: `test(datagrid): lock interaction owner invariants`

## Slice 2: App-Stage Interaction Boundary Documentation

- Status: Completed on 2026-05-17. Documented package and interaction ownership boundaries for scroll, selection, fill, range move, resize, keyboard, focus, context menu, and editing.
- Objective: document the app-stage, Vue adapter, orchestration, and core viewport ownership boundaries before moving lifecycle code.
- Affected packages/files:
  - `docs/datagrid-sheets-user-interactions-and-integrator-api.md`
  - `docs/datagrid-architecture.md`
  - `docs/audits/INTERACTION_ORCHESTRATION_AUDIT.md`
  - `docs/plans/INTERACTION_ORCHESTRATION_PLAN.md`
- Expected behavior change: no runtime behavior change; maintainers should have a canonical interaction ownership map.
- Tests to add/update:
  - No code tests required.
  - Documentation should name the owner for scroll, selection, fill, range move, resize, keyboard, focus, context menu, and editing.
- Validation command: `node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Low
- Suggested commit message: `docs(datagrid): define interaction ownership boundaries`

## Slice 3: Main Pointer Lifecycle Cancellation Contract

- Status: Completed on 2026-05-17. The mounted app-stage path now wires mouseup, pointerup, pointercancel, contextmenu capture, window blur, and unmount cleanup into interaction/resize cancellation.
- Objective: make the mounted app-stage path clean up active interactions on mouseup, pointerup, pointercancel, contextmenu capture, window blur, and unmount.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppViewportLifecycle.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-orchestration/src/pointer/useDataGridGlobalPointerLifecycle.ts`
  - `packages/datagrid-vue/src/composables/__tests__/useDataGridGlobalPointerLifecycle.contract.spec.ts`
  - `packages/datagrid-vue/src/app/__tests__/useDataGridAppInteractionController.contract.spec.ts`
  - `packages/datagrid-vue-app/src/__tests__/DataGridTableStage.contract.spec.ts`
- Expected behavior change: active drag/fill/range/resize state is cleared consistently when the pointer lifecycle is interrupted; normal desktop mouse interactions remain unchanged.
- Tests to add/update:
  - Cancellation tests for each active owner.
  - Window blur and unmount cleanup tests.
  - Contextmenu capture tests that block active drag/fill/range continuation.
- Validation command: `pnpm --filter @affino/datagrid-vue test:unit -- src/app/__tests__/useDataGridAppViewportLifecycle.contract.spec.ts src/app/__tests__/useDataGridAppInteractionController.contract.spec.ts src/composables/__tests__/useDataGridGlobalPointerLifecycle.contract.spec.ts && pnpm --dir packages/datagrid-vue-app exec vitest run --config vitest.config.ts --passWithNoTests src/stage/__tests__/useDataGridTableStageScrollSync.spec.ts && pnpm --filter @affino/datagrid-vue type-check && pnpm --filter @affino/datagrid-vue-app type-check`
- Risk level: High
- Suggested commit message: `fix(datagrid): cancel active interactions consistently`

## Slice 4: Active-Only Global Listener Wiring

- Status: Completed on 2026-05-17. Window pointer/mouse lifecycle listeners now attach only while the mounted app-stage has a pending or active interaction, while resize observation remains mounted.
- Objective: reduce idle global mouse/pointer listener exposure while preserving the existing interaction semantics.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppViewportLifecycle.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-orchestration/src/pointer/useDataGridGlobalPointerLifecycle.ts`
  - `packages/datagrid-vue/src/app/__tests__/useDataGridAppInteractionController.contract.spec.ts`
- Expected behavior change: global move/up listeners should be attached only while an interaction is active or be proven equivalent through the shared lifecycle owner.
- Tests to add/update:
  - Listener install/remove tests for idle, drag selection, fill, range move, resize, and unmount.
  - Regression tests for mouseup outside the viewport.
  - Tests that active auto-scroll still receives pointer movement while outside the grid.
- Validation command: `pnpm --filter @affino/datagrid-vue test:unit -- src/app/__tests__/useDataGridAppViewportLifecycle.contract.spec.ts src/app/__tests__/useDataGridAppInteractionController.contract.spec.ts && pnpm --dir packages/datagrid-vue-app exec vitest run --config vitest.config.ts --passWithNoTests src/stage/__tests__/useDataGridTableStageScrollSync.spec.ts && pnpm --filter @affino/datagrid-vue type-check && pnpm --filter @affino/datagrid-vue-app type-check`
- Risk level: Medium
- Suggested commit message: `fix(datagrid): scope global interaction listeners`

## Slice 5: Prevent-Default And Passive Listener Policy

- Status: Completed on 2026-05-17. Added an explicit mouse-event policy helper, focused guard coverage, touch pan listener cleanup coverage, and documented the prevent-default/passive listener matrix.
- Objective: centralize the event policy for when the grid may call `preventDefault()` or install non-passive listeners.
- Affected packages/files:
  - `docs/datagrid-sheets-user-interactions-and-integrator-api.md`
  - `packages/datagrid-vue/src/app/dataGridMouseEventGuards.ts`
  - `packages/datagrid-vue-app/src/stage/dataGridMouseEventGuards.ts`
  - `packages/datagrid-vue-app/src/gestures/dataGridTouchPanGuard.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/__tests__/dataGridTouchPanGuard.spec.ts`
  - `packages/datagrid-vue/src/app/__tests__/dataGridMouseEventGuards.spec.ts`
- Expected behavior change: no broad behavior change; event cancellation remains feature-specific but follows a documented matrix for native scroll, text editing, context menu, keyboard commands, selection, fill, range move, resize, and touch handles.
- Tests to add/update:
  - Unit tests for touch-generated mouse guard coverage.
  - Tests that body viewport scroll remains native/passive.
  - Tests that linked-surface touch pan installs non-passive move only after a routed touch start.
- Validation command: `pnpm --filter @affino/datagrid-vue test:unit -- src/app/__tests__/dataGridMouseEventGuards.spec.ts && pnpm --dir packages/datagrid-vue-app exec vitest run --config vitest.config.ts --passWithNoTests src/stage/__tests__/dataGridMouseEventGuards.spec.ts src/__tests__/dataGridTouchPanGuard.spec.ts && pnpm --filter @affino/datagrid-vue type-check && pnpm --filter @affino/datagrid-vue-app type-check && node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Medium
- Suggested commit message: `docs(datagrid): define interaction event policy`

## Slice 6: Touch Interaction Mode Regression Gate

- Objective: lock the current touch-mode behavior so future interaction work does not regress native scroll priority or explicit-handle workflows.
- Affected packages/files:
  - `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStagePinnedPane.vue`
  - `packages/datagrid-vue-app/src/stage/useDataGridStagePointerInteractions.ts`
  - `packages/datagrid-vue-app/src/__tests__/DataGridTableStage.contract.spec.ts`
  - `e2e/sandbox-grid.spec.ts`
- Expected behavior change: no intentional behavior change; one-finger body scroll remains native, touch cell-body drag stays scroll-first, and selection extension, range move, fill, and resize remain explicit-handle workflows.
- Tests to add/update:
  - E2E for touch one-finger body scroll over cells without selection/fill/range/resize start.
  - E2E for touch selection handle drag.
  - E2E for touch range-move handle drag.
  - E2E for touch fill handle drag and column/row resize handles.
- Status: Completed on 2026-05-17. Existing touch gates cover native body scroll, body-cell drag prevention, long press, fill handle, range-move handle, column resize, linked-surface routing, scroll sync, telemetry, and server loading; this slice added row-resize touch handle bridging plus component/e2e coverage for explicit row-resize handles.
- Validation command: `pnpm run test:e2e -- e2e/sandbox-grid.spec.ts --grep "touch (row resize drag starts|column resize drag starts|fill drag starts|range move drag starts|body cell touch drag|one-finger touch pan)"`
- Risk level: High
- Suggested commit message: `test(datagrid): gate touch interaction mode`

## Slice 7: Range Move Start Policy

- Objective: make range move start rules explicit across desktop and touch without changing the approved desktop path.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-orchestration/src/selection/useDataGridRangeMoveStart.ts`
  - `packages/datagrid-orchestration/src/selection/useDataGridRangeMoveLifecycle.ts`
  - `packages/datagrid-vue/src/composables/__tests__/useDataGridRangeMoveStart.contract.spec.ts`
  - `packages/datagrid-vue/src/composables/__tests__/useDataGridRangeMoveLifecycle.contract.spec.ts`
  - `e2e/sandbox-interactions.spec.ts`
- Expected behavior change: desktop range move keeps current body/edge behavior; touch range move is allowed only from the explicit touch handle.
- Tests to add/update:
  - Desktop selected-cell body start and movement-threshold tests.
  - Mouse edge hover/start tests where supported.
  - Touch-generated cell-body events must not arm range move.
  - Touch handle starts and cancellation paths.
- Validation command: `pnpm --filter @affino/datagrid-vue test -- --runInBand rangeMove && pnpm e2e -- e2e/sandbox-interactions.spec.ts`
- Risk level: Medium
- Suggested commit message: `test(datagrid): lock range move start policy`

## Slice 8: Focus Ownership And Restoration Contract

- Objective: define one active-cell/focus owner across selection, scroll, context menu, inline edit, and virtual remounts.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/useDataGridStageFocusRuntime.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-orchestration/src/viewport/useDataGridViewportBlurHandler.ts`
  - `packages/datagrid-orchestration/src/editing/useDataGridInlineEditorFocus.ts`
  - `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageFocusRuntime.spec.ts`
  - `packages/datagrid-vue/src/composables/__tests__/useDataGridViewportBlurHandler.contract.spec.ts`
  - `packages/datagrid-vue/src/composables/__tests__/useDataGridInlineEditorFocus.contract.spec.ts`
- Expected behavior change: focus restoration uses predictable fallbacks and does not steal focus during active scroll, edit, menu, fill, range move, or virtualization remount.
- Tests to add/update:
  - Focus after selection, fill, range move, resize, context menu close, and edit commit/cancel.
  - Focus restoration after active cell scrolls out and remounts.
  - `preventScroll` assertions where focus should not move the viewport.
- Validation command: `pnpm --filter @affino/datagrid-vue-app test -- --runInBand focus && pnpm --filter @affino/datagrid-vue test -- --runInBand focus blur`
- Risk level: High
- Suggested commit message: `fix(datagrid): stabilize grid focus ownership`

## Slice 9: Editing Lifecycle During Interaction And Scroll

- Objective: make inline editing transitions deterministic when scroll, virtualization, context menus, and active interactions occur.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/stage/useDataGridTableStageCellIo.ts`
  - `packages/datagrid-orchestration/src/editing/useDataGridInlineEditorFocus.ts`
  - `packages/datagrid-vue-app/src/stage/__tests__/useDataGridTableStageCellIo.spec.ts`
  - `e2e/sandbox-interactions.spec.ts`
- Expected behavior change: edit commit, cancel, blur, remount, and scroll-active suppression become tested and deterministic.
- Tests to add/update:
  - Edit then scroll out of range.
  - Edit then context menu open/close.
  - Edit then start fill/range/selection/resize.
  - Touch double-tap edit only when viewport is idle.
- Validation command: `pnpm --filter @affino/datagrid-vue-app test -- --runInBand cellIo && pnpm e2e -- e2e/sandbox-interactions.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid): stabilize editing interaction lifecycle`

## Slice 10: Pointer Preview Frame Budget

- Objective: ensure drag selection, fill, range move, and auto-scroll previews do not do unbounded synchronous work in pointer move paths.
- Affected packages/files:
  - `packages/datagrid-orchestration/src/pointer/useDataGridGlobalPointerLifecycle.ts`
  - `packages/datagrid-orchestration/src/pointer/useDataGridPointerAutoScroll.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridStagePointerInteractions.ts`
  - `packages/datagrid-vue/src/composables/__tests__/useDataGridPointerAutoScroll.contract.spec.ts`
  - `docs/perf/datagrid-performance-gates.md`
- Expected behavior change: previews are either rAF-applied in the main path or covered by a documented frame budget proving direct updates are acceptable.
- Tests to add/update:
  - Contract tests for rAF preview mode and immediate preview mode.
  - Auto-scroll layout-read count tests where feasible.
  - Performance-gate documentation for pointer preview budgets.
- Validation command: `pnpm --filter @affino/datagrid-vue test -- --runInBand pointerAutoScroll globalPointerLifecycle`
- Risk level: Medium
- Suggested commit message: `test(datagrid): budget pointer preview work`

## Slice 11: Interaction Race E2E Harness

- Objective: add browser-level regressions for the interaction races that unit tests cannot fully model.
- Affected packages/files:
  - `e2e/sandbox-interactions.spec.ts`
  - `e2e/sandbox-grid.spec.ts`
  - `packages/datagrid-sandbox/src/components/VueGridCard.vue`
  - `packages/datagrid-sandbox/src/components/VueServerDataSourceGridCard.vue`
- Expected behavior change: no intentional behavior change unless the harness exposes real defects; e2e should fail on active-owner conflicts, stuck previews, missed cleanup, or scroll/selection drift.
- Tests to add/update:
  - Desktop drag selection across virtualized rows and pinned columns.
  - Fill drag with auto-scroll and mouseup outside the viewport.
  - Range move with auto-scroll and Escape cancel.
  - Column and row resize near adjacent header/row-index controls.
  - Context menu during and after active interactions.
- Validation command: `pnpm e2e -- e2e/sandbox-interactions.spec.ts e2e/sandbox-grid.spec.ts`
- Risk level: High
- Suggested commit message: `test(datagrid): cover interaction race flows`

## Slice 12: Interaction Telemetry Diagnostics

- Objective: add optional diagnostics for active owner transitions, cancellation reasons, preview timing, auto-scroll timing, prevent-default counts, and focus fallback reasons.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-vue-app/src/perf/dataGridPerfTrace.ts`
  - `packages/datagrid-orchestration/src/scrolling/useDataGridScrollPerfTelemetry.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridStageFocusRuntime.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridStagePointerInteractions.ts`
  - `packages/datagrid-sandbox/src/components/VueGridCard.vue`
- Expected behavior change: optional diagnostics become available behind existing trace/debug mechanisms; normal production behavior and public API remain unchanged unless a public diagnostics API is approved separately.
- Tests to add/update:
  - Unit tests for transition/cancel reason emission.
  - Trace opt-in tests that verify no samples are emitted when tracing is disabled.
  - Sandbox smoke assertions for diagnostic presence when enabled.
- Validation command: `pnpm --filter @affino/datagrid-vue test -- --runInBand interaction && pnpm --filter @affino/datagrid-vue-app test -- --runInBand perfTrace`
- Risk level: Medium
- Suggested commit message: `feat(datagrid): trace interaction lifecycle diagnostics`

## Slice 13: Interaction Performance Gate

- Objective: convert interaction telemetry and e2e traces into warning-first enterprise performance gates.
- Affected packages/files:
  - `docs/perf/datagrid-performance-gates.md`
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `packages/datagrid-vue-app/src/perf/dataGridPerfTrace.ts`
  - `e2e/sandbox-interactions.spec.ts`
- Expected behavior change: validation reports warn or fail when pointer preview, auto-scroll, focus restoration, or scroll-sync drift exceeds documented budgets under controlled scenarios.
- Tests to add/update:
  - Benchmark scenarios for drag selection, fill auto-scroll, range move auto-scroll, resize drag, and context menu open/close.
  - Device/profile thresholds that start warning-only until baseline variance is known.
  - Documentation for interpreting interaction frame-budget results.
- Validation command: `node scripts/bench-datagrid-enterprise-browser-frames.mjs`
- Risk level: Medium
- Suggested commit message: `test(datagrid): gate interaction frame budgets`

## Slice 14: Interaction Audit Status Closure

- Objective: keep the audit, mobile touch audit, and plan aligned after implementation slices land.
- Affected packages/files:
  - `docs/audits/INTERACTION_ORCHESTRATION_AUDIT.md`
  - `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md`
  - `docs/audits/TODO.md`
  - `docs/plans/INTERACTION_ORCHESTRATION_PLAN.md`
- Expected behavior change: no runtime behavior change; audit status should distinguish completed work, remaining risks, and validation expectations.
- Tests to add/update:
  - No code tests required.
  - Documentation review should verify claims against implemented code and test results.
- Validation command: `node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Low
- Suggested commit message: `docs(datagrid): close interaction audit slices`

## Execution Notes

- Preserve existing desktop behavior unless a slice explicitly changes it.
- Do not introduce public interaction APIs without a separately approved API proposal.
- Keep body viewport touch scroll native/passive; linked-surface touch routing must remain scoped.
- Prefer extending `@affino/datagrid-orchestration` utilities and wiring them into the mounted app-stage path over adding parallel managers.
- Keep scroll-time and pointer-move work rAF-batched or covered by a documented frame budget.
