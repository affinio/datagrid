# DataGrid Selection Enterprise Implementation Plan

This plan converts `docs/audits/SELECTION_ENTERPRISE_AUDIT.md` into small, separable implementation slices. The order is intentional: lock the current selection/focus/editing ownership first, then harden invalidation and virtualization continuity, then define server-backed operation semantics, touch workflows, grouped/pinned behavior, accessibility, and enterprise performance gates.

## Slice 1: Selection State Machine Contract

- Status: Completed on 2026-05-17. Documented the cross-package selection state machine, including ownership for active cell, anchor, row selection, DOM focus, editing, pending clipboard ranges, fill preview, range-move preview, invalidation, and blocked/delegated virtual states.
- Objective: document one canonical state machine for cell selection, row selection, active cell, anchor, DOM focus, editing, clipboard ranges, fill preview, and range-move preview.
- Affected packages/files:
  - `docs/datagrid-sheets-user-interactions-and-integrator-api.md`
  - `docs/datagrid-architecture.md`
  - `docs/audits/SELECTION_ENTERPRISE_AUDIT.md`
  - `docs/plans/SELECTION_ENTERPRISE_PLAN.md`
  - `packages/datagrid-core/src/selection/snapshot.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridStageFocusRuntime.ts`
- Expected behavior change: no runtime behavior change; maintainers should have a single source of truth for ownership, transitions, invalidation rules, and blocked states.
- Tests to add/update:
  - No code tests required for the documentation slice.
  - Documentation should explicitly name the owner for active cell, anchor, focus, edit mode, row selection, pending clipboard, fill preview, and range move.
- Validation command: `node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Low
- Suggested commit message: `docs(datagrid): define selection state machine`

## Slice 2: Active Cell, Focus, And Editing Invariants

- Status: Completed on 2026-05-17. Added focused contracts for multi-range active anchor ownership, active-cell focus fallback with `preventScroll`, stage anchor fallback after virtualization, and pointer-selection edit handoff without restoring the previous editor focus.
- Objective: prove that logical active cell, selection snapshot, DOM focus, and inline editing stay synchronized through keyboard moves, pointer selection, edit commit/cancel, blur, and focus restoration.
- Affected packages/files:
  - `packages/datagrid-core/src/selection/snapshot.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppActiveCellViewport.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-vue/src/app/dataGridFocusRestore.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridStageFocusRuntime.ts`
  - `packages/datagrid-vue/src/app/__tests__/*Selection*.spec.ts`
  - `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageFocusRuntime.spec.ts`
- Expected behavior change: active cell and focus restoration should become predictable when selection changes, editing starts or ends, and focus temporarily leaves the grid.
- Tests to add/update:
  - Contract tests for keyboard selection move, pointer selection, edit commit, edit cancel, blur, and restore.
  - Tests that active editors are not interrupted by selection focus restoration.
  - `preventScroll` assertions where focus restoration must not move the viewport.
- Validation command: `pnpm --filter @affino/datagrid-vue test:unit -- selection focus inline && pnpm --filter @affino/datagrid-vue-app test:unit -- focus && pnpm --filter @affino/datagrid-vue type-check && pnpm --filter @affino/datagrid-vue-app type-check`
- Risk level: High
- Suggested commit message: `test(datagrid): lock selection focus invariants`

## Slice 3: Projection Invalidation Policy

- Status: Completed on 2026-05-17. Virtual selections are already stale-marked on projection identity changes, and the app interaction controller now clears transient drag selection, fill preview, range-move preview, restartable fill state, and pending clipboard state when the row-model projection key changes.
- Objective: make selection invalidation deterministic after sort, filter, group, pivot, tree expansion, datasource cache replacement, and placeholder replacement.
- Affected packages/files:
  - `packages/datagrid-core/src/selection/selectionState.ts`
  - `packages/datagrid-core/src/selection/virtualSelection.ts`
  - `packages/datagrid-core/src/selection/rowSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppRowSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-core/src/selection/__tests__/*`
  - `packages/datagrid-vue/src/app/__tests__/*Selection*.spec.ts`
- Expected behavior change: selection-related state should be rebased, preserved, cleared, or marked stale by an explicit policy instead of implicit side effects.
- Tests to add/update:
  - Invalidation tests for single-range, multi-range, row selection, virtual metadata, active cell, clipboard pending ranges, fill preview, and range-move preview.
  - Projection identity tests for sort, filter, group, pivot, tree expansion, cache refresh, and placeholder replacement.
  - Regression tests that stale virtual selections block local operations with a clear decision.
- Validation command: `pnpm --filter @affino/datagrid-core test -- --runInBand selection && pnpm --filter @affino/datagrid-vue test:unit -- selection clipboard interaction`
- Risk level: High
- Suggested commit message: `fix(datagrid): make selection invalidation deterministic`

## Slice 4: Virtual Selection Loaded Intervals

- Status: Completed on 2026-05-17. `collectDataGridSelectionLoadedCoverage` now accepts loaded row intervals, range cache exposes loaded intervals from cached rows, datasource row models expose `getLoadedRowIntervals(range)`, and app/stage virtual-selection coverage uses the interval path when available.
- Objective: replace huge virtual-selection row-by-row coverage scans with loaded interval metadata from row models or datasource cache state.
- Affected packages/files:
  - `packages/datagrid-core/src/selection/virtualSelection.ts`
  - `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
  - `packages/datagrid-core/src/models/server/rangeCache.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppSelection.ts`
  - `packages/datagrid-core/src/selection/__tests__/virtualSelection*.spec.ts`
  - `packages/datagrid-core/src/models/__tests__/dataSourceBackedRowModel.spec.ts`
- Expected behavior change: large virtual selections should compute loaded coverage from intervals and avoid bounded row-by-row scans for enterprise-scale ranges.
- Tests to add/update:
  - Unit tests for contiguous loaded intervals, sparse intervals, missing intervals, full coverage, no coverage, and stale projection identity.
  - Stress cases above the current scan cap.
  - Tests that operation decisions remain stable for materialized, virtual, server-delegated, and blocked selections.
- Validation command: `pnpm --filter @affino/datagrid-core test -- --runInBand "virtualSelection|dataSourceBackedRowModel"`
- Risk level: High
- Suggested commit message: `perf(datagrid): use intervals for virtual selection coverage`

## Slice 5: Server Selection Operation Contract

- Status: Completed on 2026-05-17. Added `docs/server-datasource/selection-operations.md` with the materialized/server/blocked/virtual operation matrix for loaded rows, unloaded rows, placeholders, grouped rows, stale projections, and all-row selection; linked it from protocol, integration map, datasource protocol, user interaction docs, and audit status.
- Objective: define the server-backed operation matrix before adding or changing public APIs for copy/export, cut, clear/delete, fill, range move, summary, and all-row selection.
- Affected packages/files:
  - `docs/server-datasource/integration-docs-map.md`
  - `docs/server-datasource/*`
  - `docs/datagrid-data-source-protocol.md`
  - `docs/datagrid-sheets-user-interactions-and-integrator-api.md`
  - `docs/audits/SELECTION_ENTERPRISE_AUDIT.md`
  - `packages/datagrid-core/src/selection/virtualSelection.ts`
  - `packages/datagrid-core/src/selection/rowSelection.ts`
- Expected behavior change: no runtime behavior change; the approved contract should distinguish local materialized operations, server-delegated operations, blocked operations, and planned API work.
- Tests to add/update:
  - No code tests required for the contract slice.
  - Documentation should include operation decisions for loaded rows, unloaded rows, placeholders, grouped rows, all-row mode, and stale projections.
- Validation command: `node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Medium
- Suggested commit message: `docs(datagrid): define server selection operations`

## Slice 6: Server-Backed Clipboard And Mutation Delegation

- Status: Partially completed on 2026-05-18. Clipboard, clear/delete, and local range-move paths now consult virtual selection metadata before local materialized work; stale virtual selections are blocked with an explicit message, unloaded virtual ranges remain blocked when no server delegation handler is configured, and paste targets containing unloaded or placeholder rows now block instead of partially mutating loaded rows. Full server-delegated copy/export, cut, clear/delete, paste, range move, and summary endpoints remain planned contract work.
- Objective: implement the approved server operation decisions for clipboard, clear/delete, fill, and range move without making local materialized paths unsafe.
- Affected packages/files:
  - `packages/datagrid-core/src/selection/virtualSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridTableStageRuntime.ts`
  - `packages/datagrid-orchestration/src/clipboard/*`
  - `packages/datagrid-orchestration/src/fill/useDataGridFillHandleStart.ts`
  - `packages/datagrid-orchestration/src/selection/useDataGridRangeMoveLifecycle.ts`
  - `packages/datagrid-sandbox/src/components/VueServerDataSourceGridCard.vue`
  - `packages/datagrid-vue/src/app/__tests__/useDataGridAppClipboard.contract.spec.ts`
  - `packages/datagrid-vue/src/app/__tests__/useDataGridAppInteractionController.contract.spec.ts`
- Expected behavior change: operations over unloaded selections should either delegate to the server according to the approved contract or return a clear blocked state; local copy/cut/delete/fill/range-move must remain limited to materialized safe ranges.
- Tests to add/update:
  - Clipboard tests for unloaded source rows, unloaded target rows, placeholders, stale selections, and server-delegated copy/export.
  - Fill and range-move tests for virtual source and target ranges.
  - Sandbox/server demo coverage for delegated operation responses and failure states.
- Validation command: `pnpm --filter @affino/datagrid-vue test:unit -- clipboard interaction fill && pnpm --filter @affino/datagrid-core test -- --runInBand virtualSelection`
- Risk level: High
- Suggested commit message: `fix(datagrid): route virtual selection operations safely`

## Slice 7: Virtualization Remount Continuity

- Status: Partially completed on 2026-05-18. The stage now tracks grid focus ownership across virtualized cell unmount/remount and restores the visible selection anchor after scroll idle, so keyboard navigation resumes from the remounted active selection. E2E coverage now proves vertical scroll-out/scroll-in remount preserves anchor class, overlay segment, fill handle, and keyboard focus, including a right-pinned selected cell remounting after vertical virtualization, proves horizontally virtualized editable selected cells restore anchor, fill handle, and overlay after remount, proves browser-level inline editor drafts commit before an attempted virtualization scroll, and proves shell placeholder-tail materialization moves the active selection anchor/fill affordance onto the created real row after inline edit commit. Component coverage also proves horizontally virtualized selected columns restore anchor/fill-handle affordances when remounted, inline text editor draft state remounts with the edited cell after horizontal virtualization, and placeholder row materialization moves the active selection anchor/fill affordance onto the created real row after inline edit commit. Browser-level server datasource placeholder replacement coverage remains planned.
- Objective: prove selection continuity across scroll-out/scroll-in remounts, pinned panes, horizontal virtualization, and server placeholder replacement.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppActiveCellViewport.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/stage/useDataGridTableStageVisualSelection.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridStageOverlays.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridStageFocusRuntime.ts`
  - `e2e/sandbox-interactions.spec.ts`
  - `e2e/sandbox-grid.spec.ts`
- Expected behavior change: active cell, selected cell classes, overlays, fill handle, and editor/focus state should remain correct when rows or columns remount.
- Tests to add/update:
  - E2E for selected range scroll-out/scroll-in with active cell restore.
  - E2E for pinned left/right panes and horizontal virtualization.
  - E2E for server placeholders replaced under an active selection.
  - Assertions for selected classes, overlay geometry, fill handle position, focus target, and editor state.
- Validation command: `pnpm run test:e2e -- e2e/sandbox-interactions.spec.ts e2e/sandbox-grid.spec.ts`
- Risk level: High
- Suggested commit message: `test(datagrid): cover selection remount continuity`

## Slice 8: Multi-Range And Pinned Overlay Contract

- Status: Completed on 2026-05-18. Additive multi-range rendering now has an explicit contract: all selected rendered cells stay highlighted, while active overlay lanes, pinned seam overlays, fill handle placement, range-move edge hover, clipboard target, and keyboard extension are owned by the active range. Unit coverage locks active-range-only overlay lanes across left, center, right, and pinned-bottom panes, verifies inactive additive ranges do not expose active edge affordances, proves additive cell classes stay mapped to projected pinned/reordered visible column indexes when hidden columns are omitted, and covers additive full-row/full-column parity for row-index and column-header selected states. Browser coverage proves Ctrl-additive selected cells, the active anchor, and the fill handle remount correctly after horizontal virtualization.
- Objective: make multi-range rendering semantics explicit for active range overlays, inactive range classes, fill handles, pinned panes, hidden/reordered columns, and header/row selection parity.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/useDataGridTableStageVisualSelection.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridStageOverlays.ts`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageHeader.vue`
  - `packages/datagrid-vue/src/app/useDataGridAppCellSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppRowSelection.ts`
  - `packages/datagrid-vue-app/src/stage/__tests__/*Selection*.spec.ts`
  - `packages/datagrid-vue/src/app/__tests__/*Selection*.spec.ts`
- Expected behavior change: all selected ranges should have documented visual treatment, while the active range owns active border/fill-handle behavior unless explicitly changed.
- Tests to add/update:
  - Multi-range pinned-pane overlay tests for left, center, right, and pinned-bottom panes.
  - Ctrl/Cmd additive selection tests for cells, column headers, and row-index/header paths.
  - Tests for hidden, reordered, pinned, and horizontally virtualized columns.
- Validation command: `pnpm --filter @affino/datagrid-vue-app test:unit -- selection overlay && pnpm --filter @affino/datagrid-vue test:unit -- selection`
- Risk level: Medium
- Suggested commit message: `test(datagrid): lock multi-range selection overlays`

## Slice 9: Grouped And Tree Selection Interactions

- Status: Completed on 2026-05-17. Clipboard copy/cut, paste targets, clear/delete, and fill source/target ranges now block grouped/tree projection rows instead of copying group display values or partially mutating only leaf rows. GroupBy and TreeData docs now state flattened selection semantics and local mutation blocking rules. App contracts now cover keyboard shift-extension through grouped rows, additive cell ranges that include group rows, row-selection reconciliation preserving visible group row ids, fill blocking over group rows, virtual selection stale-marking after group expansion changes, row-selection reconciliation after collapsed projections hide descendants, and server-backed grouped placeholder rows blocking as group rows for copy, delete, and fill. E2E coverage now proves hidden fill-handle affordance on selected group rows and group anchor continuity across collapse/expand.
- Objective: extend flattened-row selection semantics into app-stage interactions for grouped rows, tree rows, keyboard navigation, clipboard, fill, row selection, and server placeholders.
- Affected packages/files:
  - `docs/datagrid-groupby-rowmodel-projection.md`
  - `docs/datagrid-tree-data.md`
  - `packages/datagrid-core/src/selection/selectionState.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppCellSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppRowSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
  - `packages/datagrid-orchestration/src/navigation/useDataGridCellNavigation.ts`
  - `packages/datagrid-vue/src/app/__tests__/*Selection*.spec.ts`
  - `e2e/sandbox-tree-pivot.spec.ts`
- Expected behavior change: grouped/tree selection should preserve current flattened-row semantics, and operations over non-editable group rows should be blocked or delegated explicitly.
- Tests to add/update:
  - App interaction tests for shift selection, Ctrl/Cmd additive selection, keyboard navigation, row selection, clipboard, and fill over grouped/tree rows.
  - Tests for collapsed/expanded state changes after selection.
  - Server-backed grouped placeholder tests where rows are unloaded or stale.
- Validation command: `pnpm --filter @affino/datagrid-core test -- --runInBand selection && pnpm --filter @affino/datagrid-vue test:unit -- selection clipboard && pnpm run test:e2e -- e2e/sandbox-tree-pivot.spec.ts`
- Risk level: High
- Suggested commit message: `test(datagrid): cover grouped selection workflows`

## Slice 10: Touch Selection Mode

- Status: Completed on 2026-05-17. Touch body-cell gestures remain scroll-first; stationary long press selects/focuses without opening the desktop context menu; explicit touch handles own selection extension, fill, range move, and resize starts. E2E coverage now proves one-finger touch scroll, touch pan routing over body/header/pinned panes, accidental body-cell drag prevention, long-press selection, idle-only double-tap edit, explicit fill handle drag, explicit selection handle drag, explicit range-move handle drag, and explicit resize handles. Real-device matrix execution remains tracked in `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md`.
- Objective: design and implement a deliberate touch selection model with long press and explicit handles while preserving native one-finger body scroll.
- Affected packages/files:
  - `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md`
  - `docs/datagrid-sheets-user-interactions-and-integrator-api.md`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/stage/useDataGridStagePointerInteractions.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
  - `e2e/sandbox-grid.spec.ts`
  - `e2e/sandbox-interactions.spec.ts`
- Expected behavior change: touch body-cell gestures remain scroll-first; long press or explicit touch handles may enter selection extension, fill, or range-move mode according to the documented contract.
- Tests to add/update:
  - E2E for one-finger scroll over selected and unselected cells without accidental drag selection.
  - E2E for long-press selection mode and explicit selection handle drag.
  - E2E for touch fill/range-move handles and cancellation.
  - Tests for context menu and edit gestures coexisting with touch selection.
- Validation command: `pnpm run test:e2e -- e2e/sandbox-grid.spec.ts e2e/sandbox-interactions.spec.ts --grep "touch|long press|selection handle|fill|range move"`
- Risk level: High
- Suggested commit message: `feat(datagrid): add touch selection mode`

## Slice 11: Selection Summary And Aggregate Budgets

- Status: Completed on 2026-05-17. Core selection summaries now skip unloaded virtual rows via missing-interval metadata and cap local selected-cell summary work at 50,000 processed cells. App aggregate labels apply the same local cap, keep the full selected count visible, report the loaded/local cells included in the aggregate, and append `budgeted` when the cap is reached. Docs now state that summaries are local/materialized and server-global summaries over unloaded rows require datasource delegation.
- Objective: make selected-cell summaries and app aggregate labels budgeted for large selections and explicit about loaded/local versus server-global semantics.
- Affected packages/files:
  - `packages/datagrid-core/src/selection/selectionSummary.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppSelection.ts`
  - `packages/datagrid-core/src/selection/__tests__/selectionSummary*.spec.ts`
  - `packages/datagrid-vue/src/app/__tests__/*Selection*.spec.ts`
  - `docs/datagrid-sheets-user-interactions-and-integrator-api.md`
  - `docs/perf/datagrid-performance-gates.md`
- Expected behavior change: summaries and aggregate labels should either compute within a documented local budget, sample visible/materialized data, or delegate to a server summary contract.
- Tests to add/update:
  - Unit tests for large tall, wide, and multi-range selections.
  - Tests for loaded-only labels, stale/blocked labels, and server-delegated summary decisions.
  - Performance tests or benchmarks that fail or warn when summary work exceeds the documented budget.
- Validation command: `pnpm --filter @affino/datagrid-core test -- --runInBand selectionSummary && pnpm --filter @affino/datagrid-vue test:unit -- selection && node scripts/bench-datagrid-interactions.mjs`
- Risk level: Medium
- Suggested commit message: `perf(datagrid): budget selection summaries`

## Slice 12: Selection Rendering Lookup Budget

- Status: Completed on 2026-05-18. Rendered-cell additive selection predicates now use a row-bucketed lookup for sparse/many-range selection snapshots, indexing ranges up to a bounded row-entry budget and keeping tall/overflow ranges in a fallback list. Unit coverage now locks many additive ranges plus an overflow range, and the interaction benchmark includes a `multi-range-lookup-proxy` scenario with p95/p99 budget wiring in package scripts, harness, and perf-contract checks.
- Objective: keep rendered-cell selection checks bounded when many additive ranges are present.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/useDataGridTableStageVisualSelection.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridStageCellState.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridStageOverlays.ts`
  - `packages/datagrid-vue-app/src/stage/__tests__/*Selection*.spec.ts`
  - `scripts/bench-datagrid-interactions.mjs`
  - `docs/perf/datagrid-performance-gates.md`
- Expected behavior change: rendered selection lookup should remain proportional to the rendered window with a documented range-count budget or an indexed lookup path.
- Tests to add/update:
  - Unit tests for many additive ranges with pinned and horizontally virtualized columns.
  - Benchmark scenario for multi-range rendered-cell predicates and overlay generation.
  - Documentation for the supported additive range count or lookup budget.
- Validation command: `pnpm --filter @affino/datagrid-vue-app test:unit -- selection && node scripts/bench-datagrid-interactions.mjs`
- Risk level: Medium
- Suggested commit message: `perf(datagrid): bound multi-range selection rendering`

## Slice 13: Selection Accessibility Contract

- Status: Completed on 2026-05-18. Stage cells now expose deterministic `aria-selected` for active and additive selected ranges, non-materializable placeholder cells expose `aria-disabled`, row-selection checkbox ARIA remains covered, and focused component/unit contracts verify remount-safe selected state.
- Objective: define and test selection-specific accessibility behavior for active cell, selected ranges, row selection, multi-range state, placeholder rows, and virtualized remounts.
- Affected packages/files:
  - `docs/datagrid-headless-a11y-contract.md`
  - `docs/datagrid-sheets-user-interactions-and-integrator-api.md`
  - `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
  - `packages/datagrid-vue-app/src/stage/useDataGridStageCellState.ts`
  - `packages/datagrid-vue-app/src/stage/useDataGridTableStageRowSelection.ts`
  - `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
- Expected behavior change: keyboard-only users and assistive technologies should receive stable active/selected/disabled/placeholder state across virtualized rendering.
- Tests to add/update:
  - Component tests for aria-selected, aria-activedescendant or equivalent active-cell state, row-selection checked states, and placeholder disabled state.
  - Keyboard-only tests for range extension, row selection, and multi-range selection.
  - Remount tests that verify accessible state returns with the cell.
- Validation command: `pnpm --filter @affino/datagrid-vue-app test:unit -- "DataGrid.contract|a11y|selection"`
- Risk level: Medium
- Suggested commit message: `test(datagrid): cover selection accessibility`

## Slice 14: Selection Enterprise Performance Gate

- Status: Completed on 2026-05-18. Interaction benchmarks now hard-gate selection overlay planning alongside drag/fill/multi-range lookup, enterprise smoke workloads gate summary/virtual coverage/clipboard/overlay planning, browser-frame diagnostics include pinned-pane drag selection, and perf-contract checks lock the budget wiring.
- Objective: convert selection benchmarks into warning-first and then hard-fail enterprise gates for drag selection, multi-range rendering, clipboard planning, summaries, overlays, and virtual coverage decisions.
- Affected packages/files:
  - `docs/perf/datagrid-performance-gates.md`
  - `scripts/bench-datagrid-interactions.mjs`
  - `scripts/bench-datagrid-enterprise-workloads.mjs`
  - `scripts/bench-datagrid-enterprise-browser-frames.mjs`
  - `packages/datagrid-vue-app/src/perf/dataGridPerfTrace.ts`
  - `e2e/sandbox-interactions.spec.ts`
- Expected behavior change: no runtime behavior change; validation should warn or fail when selection work exceeds documented enterprise budgets.
- Tests to add/update:
  - Benchmark scenarios for large drag selection, many additive ranges, pinned-pane overlays, virtual selection coverage, summary labels, and clipboard mutation planning.
  - Browser frame scenarios for drag selection across virtualization and pinned panes.
  - Perf-contract checks for selection budget wiring.
- Validation command: `node scripts/bench-datagrid-interactions.mjs && node scripts/bench-datagrid-enterprise-workloads.mjs && node scripts/bench-datagrid-enterprise-browser-frames.mjs`
- Risk level: Medium
- Suggested commit message: `test(datagrid): gate selection performance budgets`

## Slice 15: Selection Audit Status Closure

- Status: Completed on 2026-05-18. Audit, TODO, mobile touch, server datasource, interaction, and performance docs now distinguish closed selection slices from remaining server-delegation, real-device, and remount validation work.
- Objective: keep the audit, plan, interaction docs, server datasource docs, mobile touch audit, and performance gates aligned after implementation slices land.
- Affected packages/files:
  - `docs/audits/SELECTION_ENTERPRISE_AUDIT.md`
  - `docs/audits/TODO.md`
  - `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md`
  - `docs/plans/SELECTION_ENTERPRISE_PLAN.md`
  - `docs/datagrid-sheets-user-interactions-and-integrator-api.md`
  - `docs/perf/datagrid-performance-gates.md`
- Expected behavior change: no runtime behavior change; documentation should distinguish completed work, remaining risks, planned work, and validation expectations.
- Tests to add/update:
  - No code tests required.
  - Documentation review should verify claims against implemented code and test results.
- Validation command: `node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Low
- Suggested commit message: `docs(datagrid): close selection audit slices`

## Execution Notes

- Preserve existing desktop behavior unless a slice explicitly changes it.
- Do not change public APIs for server-backed selection operations until the server operation contract is approved.
- Keep core selection geometry pure and framework-agnostic.
- Keep app-layer selection, focus, editing, clipboard, fill, and range move transitions explicit; do not add a second interaction manager.
- Keep touch body-cell gestures scroll-first; touch selection, fill, and range move must start from a documented mode transition or explicit affordance.
- Treat unloaded rows, placeholders, grouped rows, and stale projection identity as first-class blocked/delegated states.
- Keep large-range operations interval-based, server-delegated, sampled, or covered by documented budgets.
