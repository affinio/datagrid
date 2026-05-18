# DataGrid Selection Enterprise Audit

## Executive Summary

The DataGrid selection architecture is strong, but not yet enterprise-grade. It has a clear core snapshot shape, deterministic range helpers, multi-range support, virtual-selection metadata, row-selection APIs, keyboard routing, clipboard/fill/range-move plumbing, pinned-pane overlay support, and broad unit/contract coverage.

The implementation slices for this audit are closed as of 2026-05-18. The largest remaining gaps are enterprise boundary work: server-backed selection operation handlers are still partial; real-device touch validation is still pending; and broader browser coverage is still needed for browser-level editor remount state, browser-level server datasource placeholders, and unloaded rows. The completed slices documented the cross-package selection state machine, added focused focus/edit/virtualization/a11y contracts, made virtual coverage interval-aware, defined the server operation matrix, hardened grouped/touch/multi-range behavior, and added local performance gates for selection summaries, additive range lookup, overlays, clipboard planning, virtual coverage, and pinned-pane drag-selection diagnostics.

Current enterprise readiness: **8.2/10**.
Target enterprise readiness: **9/10** after hardening invariants, large-range/server semantics, real-device touch validation, virtualization continuity, and performance gates.

## Current Architecture Summary

- `datagrid-core` owns pure selection geometry, row selection snapshots, selection summaries, virtual-selection metadata, and API facade methods.
- `datagrid-vue` owns app selection state, active-cell snapshot wiring, virtual-selection metadata creation, aggregates, clipboard, fill, range move, keyboard navigation, and focus restore helpers.
- `datagrid-vue-app` owns rendered selection state, row-selection UI, pinned-pane overlays, additive header and row-index selection styling, stage focus lookup, pointer routing, fill handles, and range-move hover affordances.
- `datagrid-orchestration` owns reusable interaction composables for keyboard commands, drag selection, pointer routing, range move, fill handle start, overlay generation, row selection, and clipboard mutation helpers.

This layering is compatible with the project architecture. `docs/datagrid-sheets-user-interactions-and-integrator-api.md` and `docs/datagrid-architecture.md` now define the selection state-machine ownership contract, and focused contracts cover active-range anchor ownership, focus fallback with `preventScroll`, pointer-selection edit handoff, browser/component placeholder row materialization selection handoff, virtual stale marking, transient interaction cleanup on projection changes, a11y state, additive header/row-index parity, pinned vertical remount, browser/component horizontal remount, component-level editor remount, and performance gates. Remaining high-risk proof points are browser-level editor remount state, browser-level server datasource placeholder replacement, and real-device touch validation.

## Exact Files Reviewed

Documentation:

- `AGENTS.md`
- `docs/datagrid-sheets-user-interactions-and-integrator-api.md`
- `docs/datagrid-groupby-rowmodel-projection.md`
- `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md`
- `docs/datagrid-headless-a11y-contract.md`
- `docs/VIRTUALIZATION_ENTERPRISE_AUDIT.md`

Core selection:

- `packages/datagrid-core/src/selection/selectionState.ts`
- `packages/datagrid-core/src/selection/snapshot.ts`
- `packages/datagrid-core/src/selection/virtualSelection.ts`
- `packages/datagrid-core/src/selection/rowSelection.ts`
- `packages/datagrid-core/src/selection/selectionSummary.ts`
- `packages/datagrid-core/src/core/gridApiSelectionMethods.ts`
- `packages/datagrid-core/src/core/gridApiRowSelectionMethods.ts`

Vue app selection and interaction:

- `packages/datagrid-vue/src/app/useDataGridAppSelection.ts`
- `packages/datagrid-vue/src/app/useDataGridAppCellSelection.ts`
- `packages/datagrid-vue/src/app/useDataGridAppRowSelection.ts`
- `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
- `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
- `packages/datagrid-vue/src/app/useDataGridAppActiveCellViewport.ts`
- `packages/datagrid-vue/src/app/dataGridFocusRestore.ts`

Stage and orchestration:

- `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageHeader.vue`
- `packages/datagrid-vue-app/src/stage/useDataGridTableStageVisualSelection.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageCellState.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageFocusRuntime.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageOverlays.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStagePointerInteractions.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridTableStageRowSelection.ts`
- `packages/datagrid-orchestration/src/navigation/useDataGridCellNavigation.ts`
- `packages/datagrid-orchestration/src/navigation/useDataGridKeyboardCommandRouter.ts`
- `packages/datagrid-orchestration/src/pointer/useDataGridCellPointerDownRouter.ts`
- `packages/datagrid-orchestration/src/pointer/useDataGridDragPointerSelection.ts`
- `packages/datagrid-orchestration/src/pointer/useDataGridPointerModifierPolicy.ts`
- `packages/datagrid-orchestration/src/selection/useDataGridSelectionOverlayOrchestration.ts`
- `packages/datagrid-orchestration/src/selection/useDataGridRangeMoveStart.ts`
- `packages/datagrid-orchestration/src/selection/useDataGridRangeMoveLifecycle.ts`
- `packages/datagrid-orchestration/src/selection/useDataGridRowSelectionModel.ts`
- `packages/datagrid-orchestration/src/viewport/useDataGridVirtualRangeMetrics.ts`
- `packages/datagrid-orchestration/src/fill/useDataGridFillHandleStart.ts`

Tests and benchmarks sampled:

- `packages/datagrid-core/src/selection/__tests__/*`
- `packages/datagrid-vue/src/app/__tests__/*Selection*.spec.ts`
- `packages/datagrid-vue/src/app/__tests__/useDataGridAppClipboard.contract.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/*Selection*.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/*Clipboard*.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/*Fill*.spec.ts`
- `packages/datagrid-orchestration/src/__tests__/*Selection*.spec.ts`
- `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/*Selection*.spec.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/*Pointer*.spec.ts`
- `e2e/sandbox-interactions.spec.ts`
- `scripts/bench-datagrid-interactions.mjs`
- `scripts/bench-datagrid-enterprise-workloads.mjs`

## Strengths

- Core selection geometry is pure and deterministic. `selectionState.ts` clamps points, normalizes ranges, merges/removes ranges, resolves row ids, and has grouped projection contract tests.
- The snapshot contract supports multi-range selection through `ranges[]`, `activeRangeIndex`, and `activeCell`.
- Ctrl/Cmd additive selection is implemented in `useDataGridAppCellSelection.ts` and tested by `useDataGridAppCellSelection.contract.spec.ts`.
- Shift extension is implemented for pointer and keyboard paths through `applyCellSelectionByCoord`, `useDataGridCellNavigation.ts`, and `useDataGridCellPointerDownRouter.ts`.
- Virtual selection has explicit metadata in `virtualSelection.ts`: loaded coverage, missing intervals, projection identity, stale marking, and operation decisions for materialized, server, virtual, and blocked modes.
- `useDataGridAppSelection.ts` marks virtual selections stale when projection identity changes after row-model sort/filter/group/pivot state changes.
- Clipboard blocks local copy/cut when the selected range includes unloaded placeholder rows in `useDataGridAppClipboard.ts`.
- Fill and range move have separate lifecycle objects and stop each other before starting, reducing gesture conflicts.
- Pinned panes are first-class in stage overlay code. `useDataGridStageOverlays.ts` builds selection, fill-preview, and move-preview segments for left, center, right, pinned-bottom, and seam overlays.
- Grouped row semantics are documented: selection operates on flattened rows, group rows are selectable as rows, and optional group-to-children policy exists in core helpers.
- There is meaningful test coverage across core geometry, grouped ranges, virtual selection, app selection state, row selection, overlays, clipboard, fill, range move, and row-selection controlled state.
- Interaction benchmarks hard-gate selection drag, fill apply, multi-range rendered-cell lookup, and selection overlay planning in `scripts/bench-datagrid-interactions.mjs`; enterprise workload smoke gates cover selection summary planning, virtual coverage, clipboard planning, and overlay planning.

## Findings By Severity

### Blocker

1. **Large virtual selection coverage now has an interval path, but server operation semantics remain incomplete.**
   `virtualSelection.ts` can compute loaded coverage from row-model intervals, and `createDataSourceBackedRowModel` exposes `getLoadedRowIntervals(range)` from its range cache. The fallback row-by-row helper still has a scan cap for row models that do not provide interval metadata.

2. **Server-backed selection semantics are documented but not fully implemented.**
   `docs/server-datasource/selection-operations.md` defines the operation matrix for materialized, server, blocked, and virtual modes across copy/export, cut, clear/delete, paste, fill, range move, summary, and row selection. Clipboard, paste target, clear/delete, and local range-move paths now block stale or unloaded virtual work before local materialized mutation, and unloaded virtual ranges remain blocked without a configured server delegate. Server fill has dedicated plumbing; implementation remains for broader delegated copy/export, cut, clear/delete, paste, range move, and summary operations.

3. **Touch selection has browser coverage, but real-device validation remains open.**
   `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md` now documents the scroll-first touch model: stationary long press selects/focuses, body-cell touch drag remains native-scroll-first, and explicit touch handles own selection extension, fill, range move, and resize starts. Playwright covers these contracts, but the enterprise tablet matrix and hardware thresholds still need real-device validation.

### High

1. **Active cell ownership is documented, but remount/server proof remains incomplete.**
   `snapshot.ts` stores `activeCell`; `useDataGridAppSelection.ts` stores `selectionAnchor`; `useDataGridAppActiveCellViewport.ts` and `useDataGridStageFocusRuntime.ts` restore DOM focus; `useDataGridAppInteractionController.ts` starts/commits/cancels editing. This is now documented as one cross-package state-machine contract with focused active-range, focus fallback, edit-handoff coverage, browser/component placeholder materialization selection handoff, vertical remount focus restoration, right-pinned vertical remount coverage, browser/component horizontal remount coverage, component-level editor remount coverage, and stage a11y state coverage. It still needs browser-level editor remount, broader keyboard move, and browser-level server datasource placeholder replacement coverage.

2. **Selection continuity across virtualization remounts is partially proven, not fully gated.**
   Logical selection uses absolute row indexes and row ids, and rendered cells are keyed by row id/column key in `DataGridTableStageCenterPane.vue`. `DataGridTableStage.vue` now preserves grid focus ownership through virtualized cell unmount/remount and restores the visible selection anchor after scroll idle. E2E coverage proves vertical scroll-out/scroll-in preserves the anchor class, overlay segment, fill handle, and keyboard focus, covers a right-pinned selected cell remounting with its overlay/fill handle after vertical virtualization, proves horizontally virtualized editable selected cells restore anchor, fill handle, and overlay after remount, and proves shell placeholder-tail materialization moves selection anchor/fill affordances to the created row after inline edit commit. Component coverage proves horizontally virtualized selected columns restore anchor and fill-handle affordances when remounted, inline text editor draft state remounts with the edited cell after horizontal virtualization, and placeholder materialization moves selection anchor/fill affordances to the created row after inline edit commit. Browser-level editor state and browser-level server datasource placeholder replacement coverage remain open.

3. **Large-range summaries and aggregate labels are locally budgeted, but server summary delegation remains open.**
   `selectionSummary.ts` and `useDataGridAppSelection.ts` now cap local selected-cell summary work at 50,000 processed cells and use virtual missing-interval metadata to avoid probing unloaded rows. This protects app-local labels and summaries, but server-global summary over unloaded selections still needs datasource delegation.

4. **Clipboard and local mutation paths are materialized-row oriented.**
   `useDataGridAppClipboard.ts` collects edits row-by-row and blocks copy when rows are missing. It now also checks virtual selection metadata for stale projections before staging clipboard state, and paste targets containing unloaded or placeholder rows are blocked before local mutation. Clear/delete and local range move perform the same stale virtual guard before mutating rows. That is correct for local safety, but enterprise server-backed grids still need explicit server operations for copy/export, clear, delete, paste, and range move over unloaded selections.

5. **Range move can be armed from selected cell body on desktop paths.**
   `useDataGridAppInteractionController.ts` has a pending range-move start when the pointer begins inside the selected editable range. The stage has mouse hover edge affordances, and touch-generated mouse events are guarded, but the enterprise interaction contract should require explicit handles for touch and clearly separate edge-drag from body-drag behavior.

6. **Pinned-pane selection is strong but still needs broader enterprise validation.**
   Overlay code handles panes and seam segments, and tests cover pinned overlay geometry. The multi-range visual contract is now explicit: all additive ranges keep selected-cell highlighting, while active overlay lanes, pinned seams, fill handles, range-move edge hover, clipboard target, and keyboard extension belong to the active range. Unit tests cover active-range-only overlay lanes across left, center, right, and pinned-bottom panes, additive cell classes are now locked against projected pinned/reordered visible column indexes when hidden columns are omitted, and row-index/header selected states now honor additive full-row/full-column ranges. Horizontally virtualized browser cases remain open.

### Medium

1. **Row selection and cell range selection are separate systems.**
   Row selection has a `focusedRow`, selected row ids, and all/excluded mode in `rowSelection.ts`. Cell selection has `activeCell` and ranges. This separation is now documented in the selection state-machine contract; remaining work is server-backed row-selection projection changes.

2. **Grouped/tree selection is covered as a flattened-row app interaction surface.**
   `docs/datagrid-groupby-rowmodel-projection.md` and core tests define flattened-row semantics and optional group-to-children behavior. App clipboard copy/cut, paste targets, clear/delete, and fill source/target ranges now block ranges that include grouped/tree projection rows, avoiding partial leaf-only mutations. App contracts cover keyboard shift-extension through grouped rows, additive cell ranges that include group rows, row-selection reconciliation preserving visible group row ids, fill blocking over group rows, virtual selection stale-marking after group expansion changes, row-selection reconciliation after collapsed projections hide descendants, and server-backed grouped placeholder rows blocking as group rows for copy, delete, and fill. E2E coverage proves hidden fill-handle affordance on selected group rows and group anchor continuity across collapse/expand.

3. **Selection invalidation now covers virtual stale marking and transient interaction cleanup, but still needs remount/server proof.**
   `useDataGridAppSelection.ts` marks virtual selections stale on projection key changes, row selection can reconcile against current rows, and `useDataGridAppInteractionController.ts` clears transient fill, range-move, drag-selection, and pending clipboard state when projection identity changes. The remaining gap is proving active cell, multi-ranges, row selection, and server placeholder replacement across browser remount flows.

4. **Focus synchronization is retry-based rather than state-machine based.**
   `dataGridFocusRestore.ts` retries focus after `nextTick` and rAF, which is pragmatic. Enterprise readiness needs tests proving this is enough for virtualization remounts, pinned panes, editor mount, server placeholder replacement, and horizontal virtualization.

5. **Ctrl/Cmd additive selection has row/header parity coverage, with browser gaps remaining.**
   Cell additive ranges are tested, including pinned/reordered visible column indexes with hidden columns omitted. Header and row-index selected states now have additive full-column/full-row parity coverage; remaining browser coverage is still stronger for cell paths than for horizontally virtualized header/row-index cases.

6. **Selection rendering and overlay planning now have local performance gates.**
   `useDataGridTableStageVisualSelection.ts` indexes sparse additive ranges by row for rendered-cell predicates and keeps tall/overflow ranges in a bounded fallback path. Interaction benchmarks gate multi-range lookup and selection overlay planning across pinned/center panes. Future server-delegated operation latency gates still depend on backend handlers.

### Low

1. **Selection summary supports only loaded/local semantics.**
   This is documented and locally budgeted. It should not be presented as a server-global aggregate over unloaded rows until datasource summary delegation is implemented.

2. **`selectionSnapshotSignature` uses `JSON.stringify`.**
   This is acceptable for tests/simple equality but should not become a hot-path enterprise diff primitive for large multi-range snapshots.

3. **Some interaction docs are broader than tested behavior.**
   `docs/datagrid-sheets-user-interactions-and-integrator-api.md` describes a rich Sheets-like contract. The implementation is close, but enterprise docs should distinguish implemented, partial, and planned behavior for server-backed and touch scenarios.

## Focus Area Evaluation

| Area | Current Assessment | Enterprise Gap |
| --- | --- | --- |
| Active cell ownership | Documented across snapshot, anchor, focus runtime, and editing with focused contracts | Add browser-level editor remount and browser-level server datasource placeholder tests |
| Range selection | Strong core/app support with grouped/tree and vertical remount coverage | Need broader e2e around pinned/horizontal virtualization and server placeholders |
| Multi-range support | Supported for cell selection and clipboard ranges; active-range visual affordance contract documented; projected pinned/reordered cell-class mapping and additive header/row-index parity covered | Need horizontally virtualized browser cases |
| Virtual selection over unloaded rows | Metadata and blocked/server decisions exist; datasource row models expose loaded intervals | Complete server operation contracts |
| Virtualization remount continuity | Logical model is suitable; vertical, right-pinned vertical, horizontal selected-cell remounts, and shell placeholder materialization are browser-covered; horizontal selected-column remount, editor draft remount, and placeholder materialization selection handoff are component-covered | Needs browser tests for editors and server datasource placeholders after remount |
| Keyboard navigation | Strong coverage through command and navigation routers | Need server/unloaded and pinned-pane e2e |
| Shift selection | Implemented for keyboard and pointer; grouped/tree app contract covers flattened group rows | Need placeholder and remount coverage |
| Ctrl/Cmd selection | Implemented for additive cell ranges | Need header/row parity and visual-overlay contract |
| Pinned panes | Strong overlay geometry support with active-range-only multi-range overlay coverage | Need active-cell e2e across panes |
| Grouped/tree rows | Flattened-row semantics documented and tested in core; clipboard/paste/clear/fill block group rows; app contracts and e2e cover keyboard shift, additive cell ranges, row-selection reconciliation, fill blocking, collapse/expand invalidation/reconcile paths, and server-backed grouped placeholders for group row ids | Watch future server-defined group-row operation semantics |
| Clipboard | Good local safety; blocks unloaded copy | Needs server-delegated copy/export/cut/clear/delete contract |
| Fill/range move conflicts | Dedicated lifecycles stop conflicting interactions, and touch paths are explicit-handle only | Need server virtual range semantics |
| Touch selection | Scroll-first long-press and explicit-handle model is implemented with browser e2e coverage | Need real-device matrix and hardware-threshold validation |
| Focus synchronization | Pragmatic focus restore exists with active/focus/edit handoff coverage | Needs invariant tests around pinned/horizontal remount, editor mount, and server placeholders |
| Selection rendering performance | Rendered-cell additive range predicates and overlay planning have benchmark budgets | Need server-delegated operation latency gates after handlers exist |
| Selection invalidation | Virtual stale marking and row selection reconcile exist | Need unified invalidation policy across all selection-related state |
| Large-range performance | Summary, aggregate, clipboard planning, virtual coverage, additive lookup, and overlay planning have local/smoke gates | Server-global operations need delegated handlers and latency budgets |
| Server-backed semantics | Operation matrix documented; implementation remains partial and safety-biased | Need backend delegation APIs for non-fill operations |

## Correctness Risks

- Selection ranges use row indexes and optional row ids. After projection changes, row indexes can refer to different rows; virtual selections are marked stale, but non-virtual ranges need a documented rebase/clear/stale policy.
- Active cell and DOM focus can diverge if the selected cell is outside the rendered window, inside a pinned pane, or temporarily represented by a placeholder.
- Multi-range active index normalization exists, but additive range deletion/replacement semantics are limited. Duplicate range handling is simple exact-match detection.
- Group rows are treated as rows by default. That is correct per docs, but clipboard/fill/edit operations over group rows must remain blocked or explicitly delegated.
- Pending clipboard ranges, fill preview ranges, and range-move preview ranges can outlive projection changes unless all invalidation paths clear or stale-mark them consistently.

## Performance Risks

- `selectionSummary.ts` and app aggregate labels now cap local selected-cell iteration at 50,000 processed cells and use virtual missing-interval metadata when present. Server-global summaries over unloaded rows still need delegated backend operations.
- `useDataGridAppClipboard.ts` builds local edit updates row-by-row. It is appropriate for materialized ranges but not for 100k-row server selections.
- Rendered-cell selection predicates now use row-bucketed lookup for sparse additive ranges, with tall/overflow ranges kept in a fallback list and benchmark p95/p99 budgets.
- Overlay geometry is generally efficient because it works from visible metrics, and selection overlay planning now has interaction benchmark p95/p99 budgets.
- Row selection reconciliation in `useDataGridAppRowSelection.ts` can scan all current rows. This is fine for client rows; server/global all-selection paths should use mode/exclusions instead of enumerating all rows.

## Server-Backed Selection Risks

- `rowSelection.ts` has an enterprise-friendly all-selection shape with `mode: "all"` and `excludedRows`.
- `useDataGridTableStageRowSelection.ts` uses all/excluded mode for server row selection, which is the right direction.
- Cell-range virtual selection has operation decisions, but the app does not yet expose complete server-delegated handlers for all enterprise operations.
- Local copy blocks unloaded rows and tells the user to load rows or use server export. This is safe, not complete.
- Server fill has dedicated boundary and commit plumbing in `useDataGridAppInteractionController.ts`; stale virtual guards now protect clipboard, clear/delete, and local range move, but server copy/cut/clear/delete/range-move equivalents still need runtime handlers.

## Touch And Mobile Risks

- Current behavior prioritizes native scroll and suppresses touch-generated desktop drag/fill/resize starts, matching `docs/audits/MOBILE_TOUCH_SCROLL_AUDIT.md`.
- Stationary long press selects/focuses; explicit touch handles own selection extension, fill, range move, column resize, and row resize starts.
- Touch selection does not reuse desktop hover or edge-drag assumptions.
- Enterprise mobile validation should include accidental drag prevention, long-press selection, handle drag, native scroll continuity, and server placeholder behavior.

## Accessibility Risks

- Stage cells expose roles, labels, checked/pressed/disabled states for interactive cells, and now expose deterministic `aria-selected` for anchor cells, selected cells, additive ranges, and unselected rendered cells.
- Non-materializable placeholder cells expose `aria-disabled`, and row-selection checkbox cells keep `aria-checked` coverage in component tests.
- The broader virtualized grid a11y contract still requires row/column count and index coverage across the app stage.
- Enterprise readiness still needs screen-reader-oriented validation for announcements across active cell, row selection, multi-range changes, and virtualized remount flows.

## Enterprise Readiness Score

- Current score: **8.2/10**
- Target score: **9/10**

Blocks to target:

- Huge virtual selection coverage has an interval path for summary/aggregate labels, but other large-range operations still need interval/server range descriptors.
- Server-backed operation handlers are incomplete for copy/export, cut, clear/delete, range move, and summary.
- Active/focus/edit ownership is specified as one state machine, but browser-level editor remount and browser-level server datasource placeholder proof are still incomplete.
- Touch selection has browser-covered long-press and explicit-handle behavior, but still needs real-device validation.
- Large-range selection performance now has hard gates for overlay planning, enterprise smoke gates for clipboard planning, summary planning, and virtual coverage, and browser-frame coverage for pinned-pane drag selection. Server-delegated operation latency budgets remain future work until those handlers exist.
- Browser/e2e coverage now proves vertical selection remount focus continuity, right-pinned vertical remount continuity, horizontal selected-cell remount continuity, shell placeholder materialization handoff, and grouped/tree selection workflows, while component coverage proves horizontal selected-column remount affordances, inline editor draft remount, and placeholder materialization selection handoff. Browser-level server datasource placeholders and browser-level editor remount state remain open.

## Recommended Next Work

1. Implement server-backed copy/export, cut, clear/delete, paste, range move, and summary handlers according to the documented operation matrix.
2. Add e2e tests for server datasource placeholders and browser-level editor remount state.
3. Execute the real-device touch selection matrix and tune hardware thresholds if the Chromium budgets do not match device traces.
4. Add server-delegated operation latency gates after copy/export, cut, clear/delete, paste, range move, and summary handlers are implemented.

## Validation Expectations

Recommended validation for future implementation slices:

- Core selection: `pnpm --filter @affino/datagrid-core test -- --runInBand selection`
- Vue app selection/clipboard: `pnpm --filter @affino/datagrid-vue test -- --runInBand selection clipboard`
- Stage selection/overlays: `pnpm --filter @affino/datagrid-vue-app test -- --runInBand selection`
- Browser interaction: `pnpm e2e -- e2e/sandbox-interactions.spec.ts`
- Performance: `node scripts/bench-datagrid-interactions.mjs`
- Enterprise selection performance: `pnpm run bench:datagrid:interactions:assert && pnpm run bench:datagrid:enterprise:selection:assert`
- Perf contracts: `node ./scripts/check-datagrid-perf-contracts.mjs`
- Docs: `node ./scripts/check-datagrid-docs-framework-track.mjs`
