# DataGrid Selection Enterprise Audit

## Executive Summary

The DataGrid selection architecture is strong, but not yet enterprise-grade. It has a clear core snapshot shape, deterministic range helpers, multi-range support, virtual-selection metadata, row-selection APIs, keyboard routing, clipboard/fill/range-move plumbing, pinned-pane overlay support, and broad unit/contract coverage.

The gaps are mostly at enterprise boundaries: active cell, selection snapshot, DOM focus, and editing now have a documented cross-package ownership contract, but invariant tests still need to prove the contract; large virtual selections still rely on row-by-row loaded-row scans; summary/aggregate/clipboard paths can do cell-by-cell work over very large ranges; touch selection has no deliberate long-press/handle model; server-backed selection semantics are partial; and e2e coverage does not yet prove selection continuity across virtualization remounts, pinned panes, grouped/tree changes, and unloaded rows.

Current enterprise readiness: **7/10**.
Target enterprise readiness: **9/10** after hardening invariants, large-range/server semantics, touch UX, virtualization continuity, and performance gates.

## Current Architecture Summary

- `datagrid-core` owns pure selection geometry, row selection snapshots, selection summaries, virtual-selection metadata, and API facade methods.
- `datagrid-vue` owns app selection state, active-cell snapshot wiring, virtual-selection metadata creation, aggregates, clipboard, fill, range move, keyboard navigation, and focus restore helpers.
- `datagrid-vue-app` owns rendered selection state, row-selection UI, pinned-pane overlays, stage focus lookup, pointer routing, fill handles, and range-move hover affordances.
- `datagrid-orchestration` owns reusable interaction composables for keyboard commands, drag selection, pointer routing, range move, fill handle start, overlay generation, row selection, and clipboard mutation helpers.

This layering is mostly compatible with the project architecture. `docs/datagrid-sheets-user-interactions-and-integrator-api.md` and `docs/datagrid-architecture.md` now define the selection state-machine ownership contract. The remaining highest-risk issue is proving the contract with focused invariants for remount, edit blur, keyboard move, projection invalidation, and server placeholder replacement.

## Exact Files Reviewed

Documentation:

- `AGENTS.md`
- `docs/datagrid-sheets-user-interactions-and-integrator-api.md`
- `docs/datagrid-groupby-rowmodel-projection.md`
- `docs/MOBILE_TOUCH_SCROLL_AUDIT.md`
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
- Interaction benchmarks exist for selection drag and fill apply in `scripts/bench-datagrid-interactions.mjs`, and enterprise workload scripts include selection operations.

## Findings By Severity

### Blocker

1. **Large virtual selection is not enterprise-grade yet.**
   `virtualSelection.ts` explicitly documents that loaded coverage helpers scan row-by-row and should accept loaded intervals before use with very large virtual ranges. The helper caps scans at `DATA_GRID_VIRTUAL_SELECTION_MAX_SCAN_ROWS = 4096`, which is safe but means huge unloaded ranges are partial by design.

2. **Server-backed selection semantics are incomplete for enterprise operations.**
   Virtual metadata can decide whether copy/cut/delete/fill/range-move is materialized, server-delegated, or blocked, but the app path mainly blocks unloaded clipboard copy and has server fill-specific plumbing. There is no complete audited contract for server-delegated copy, cut, clear/delete, range move, aggregate summary, or selection export over unloaded rows.

3. **No deliberate touch selection model.**
   `docs/MOBILE_TOUCH_SCROLL_AUDIT.md` states that long-press selection and explicit touch handles remain open. Current touch safeguards protect native scroll and suppress touch-generated desktop gestures, but enterprise tablet behavior needs a designed long-press/handle mode for range selection, fill, and move.

### High

1. **Active cell ownership is split across selection snapshot, anchor ref, DOM focus, and editing state.**
   `snapshot.ts` stores `activeCell`; `useDataGridAppSelection.ts` stores `selectionAnchor`; `useDataGridAppActiveCellViewport.ts` and `useDataGridStageFocusRuntime.ts` restore DOM focus; `useDataGridAppInteractionController.ts` starts/commits/cancels editing. This is now documented as one cross-package state-machine contract, but still needs invariant coverage for remount, edit blur, keyboard move, and server placeholder replacement.

2. **Selection continuity across virtualization remounts is partially proven, not fully gated.**
   Logical selection uses absolute row indexes and row ids, and rendered cells are keyed by row id/column key in `DataGridTableStageCenterPane.vue`. However, e2e coverage does not yet prove focus, active cell, selected classes, overlay geometry, fill handle, and editor state across scroll-out/scroll-in remounts and server placeholder replacement.

3. **Large-range summaries and aggregate labels can do cell-by-cell work.**
   `selectionSummary.ts` iterates every selected loaded cell and tracks `seenCells`; `useDataGridAppSelection.ts` computes app aggregate labels by iterating selected rows and columns. This is acceptable for moderate ranges, but not enterprise-safe for 100k x wide selections without visible-only, sampled, server-delegated, or budgeted modes.

4. **Clipboard and local mutation paths are materialized-row oriented.**
   `useDataGridAppClipboard.ts` collects edits row-by-row and blocks copy when rows are missing. That is correct for local safety, but enterprise server-backed grids need explicit server operations for copy/export, clear, delete, paste, and range move over unloaded selections.

5. **Range move can be armed from selected cell body on desktop paths.**
   `useDataGridAppInteractionController.ts` has a pending range-move start when the pointer begins inside the selected editable range. The stage has mouse hover edge affordances, and touch-generated mouse events are guarded, but the enterprise interaction contract should require explicit handles for touch and clearly separate edge-drag from body-drag behavior.

6. **Pinned-pane selection is strong but still needs multi-range enterprise validation.**
   Overlay code handles panes and seam segments, and tests cover pinned overlay geometry. Multi-range additive selection is intentionally reduced to the active range for some overlay paths when `isAdditiveSelection` is true. Cell classes still reflect all ranges, but the visual overlay contract should explicitly state whether all ranges or only the active range get full bordered overlays.

### Medium

1. **Row selection and cell range selection are separate systems.**
   Row selection has a `focusedRow`, selected row ids, and all/excluded mode in `rowSelection.ts`. Cell selection has `activeCell` and ranges. This separation is good, but focus/selection precedence between checkbox row selection, row-index range selection, and cell selection needs a documented enterprise contract.

2. **Grouped/tree selection is implemented for flattened rows but not fully covered as an app interaction surface.**
   `docs/datagrid-groupby-rowmodel-projection.md` and core tests define flattened-row semantics and optional group-to-children behavior. App-stage keyboard, clipboard, fill, row selection, and server-backed grouped placeholder cases need stronger integration tests.

3. **Selection invalidation marks virtual metadata stale but does not reconcile all selection shapes.**
   `useDataGridAppSelection.ts` marks virtual selections stale on projection key changes. Row selection can reconcile against current rows. The remaining gap is a single policy for what happens to active cell, multi-ranges, row selection, clipboard pending ranges, fill previews, and move previews after sort/filter/group/pivot/cache replacement.

4. **Focus synchronization is retry-based rather than state-machine based.**
   `dataGridFocusRestore.ts` retries focus after `nextTick` and rAF, which is pragmatic. Enterprise readiness needs tests proving this is enough for virtualization remounts, pinned panes, editor mount, server placeholder replacement, and horizontal virtualization.

5. **Ctrl/Cmd additive selection exists for cells, but row/header parity needs explicit coverage.**
   Cell additive ranges are tested. Header documentation says Ctrl/Cmd adds column ranges, but the audited coverage was stronger for cell and row-selection paths than for column-header additive selection with pinned/hidden/reordered columns.

6. **Selection rendering work is bounded by rendered cells, but per-cell predicates scan ranges.**
   `useDataGridTableStageVisualSelection.ts` checks `selectionRanges` for each rendered cell. This is fine for small multi-range counts, but enterprise multi-range scenarios need either a range index, row-bucketed lookup, or a documented max range count.

### Low

1. **Selection summary supports only loaded/visible local semantics.**
   This is fine if documented. It should not be presented as a server-global aggregate over unloaded rows.

2. **`selectionSnapshotSignature` uses `JSON.stringify`.**
   This is acceptable for tests/simple equality but should not become a hot-path enterprise diff primitive for large multi-range snapshots.

3. **Some interaction docs are broader than tested behavior.**
   `docs/datagrid-sheets-user-interactions-and-integrator-api.md` describes a rich Sheets-like contract. The implementation is close, but enterprise docs should distinguish implemented, partial, and planned behavior for server-backed and touch scenarios.

## Focus Area Evaluation

| Area | Current Assessment | Enterprise Gap |
| --- | --- | --- |
| Active cell ownership | Functional but split across snapshot, anchor, focus runtime, and editing | Document one state machine and add remount/edit/server tests |
| Range selection | Strong core/app support | Need broader e2e around virtualization and grouped rows |
| Multi-range support | Supported for cell selection and clipboard ranges | Clarify visual overlay behavior and test pinned/header cases |
| Virtual selection over unloaded rows | Metadata and blocked/server decisions exist | Replace row-by-row huge scans with loaded intervals and server contracts |
| Virtualization remount continuity | Logical model is suitable | Needs browser tests for focus/classes/overlays/editors after remount |
| Keyboard navigation | Strong coverage through command and navigation routers | Need server/unloaded and pinned-pane e2e |
| Shift selection | Implemented for keyboard and pointer | Need grouped/tree, placeholder, and remount coverage |
| Ctrl/Cmd selection | Implemented for additive cell ranges | Need header/row parity and visual-overlay contract |
| Pinned panes | Strong overlay geometry support | Need multi-range and active-cell e2e across panes |
| Grouped/tree rows | Flattened-row semantics documented and tested in core | Need app interaction and server-backed grouped tests |
| Clipboard | Good local safety; blocks unloaded copy | Needs server-delegated copy/export/cut/clear/delete contract |
| Fill/range move conflicts | Dedicated lifecycles stop conflicting interactions | Need touch explicit-handle policy and server virtual range semantics |
| Touch selection | Scroll-first safeguards exist | Long-press/handle selection model is missing |
| Focus synchronization | Pragmatic focus restore exists | Needs invariant tests around remount and editing |
| Selection rendering performance | Good for rendered-window size | Needs multi-range lookup budget and large-range overlay benchmarks |
| Selection invalidation | Virtual stale marking and row selection reconcile exist | Need unified invalidation policy across all selection-related state |
| Large-range performance | Some benchmarks exist | Summary, aggregates, clipboard, virtual coverage need interval/server paths |
| Server-backed semantics | Partial and safety-biased | Need full operation matrix and backend delegation APIs |

## Correctness Risks

- Selection ranges use row indexes and optional row ids. After projection changes, row indexes can refer to different rows; virtual selections are marked stale, but non-virtual ranges need a documented rebase/clear/stale policy.
- Active cell and DOM focus can diverge if the selected cell is outside the rendered window, inside a pinned pane, or temporarily represented by a placeholder.
- Multi-range active index normalization exists, but additive range deletion/replacement semantics are limited. Duplicate range handling is simple exact-match detection.
- Group rows are treated as rows by default. That is correct per docs, but clipboard/fill/edit operations over group rows must remain blocked or explicitly delegated.
- Pending clipboard ranges, fill preview ranges, and range-move preview ranges can outlive projection changes unless all invalidation paths clear or stale-mark them consistently.

## Performance Risks

- `selectionSummary.ts` and app aggregate labels do selected-cell iteration. This can be expensive for wide, tall, or multi-range selections.
- `useDataGridAppClipboard.ts` builds local edit updates row-by-row. It is appropriate for materialized ranges but not for 100k-row server selections.
- Per-cell selection rendering checks every selected range against every rendered cell. Rendered windows keep this bounded, but many additive ranges can make it `renderedCells * ranges`.
- Overlay geometry is generally efficient because it works from visible metrics, but large additive range lists still need budgets and tests.
- Row selection reconciliation in `useDataGridAppRowSelection.ts` can scan all current rows. This is fine for client rows; server/global all-selection paths should use mode/exclusions instead of enumerating all rows.

## Server-Backed Selection Risks

- `rowSelection.ts` has an enterprise-friendly all-selection shape with `mode: "all"` and `excludedRows`.
- `useDataGridTableStageRowSelection.ts` uses all/excluded mode for server row selection, which is the right direction.
- Cell-range virtual selection has operation decisions, but the app does not yet expose complete server-delegated handlers for all enterprise operations.
- Local copy blocks unloaded rows and tells the user to load rows or use server export. This is safe, not complete.
- Server fill has dedicated boundary and commit plumbing in `useDataGridAppInteractionController.ts`, but server copy/cut/clear/delete/range-move equivalents need a consistent contract.

## Touch And Mobile Risks

- Current behavior prioritizes native scroll and suppresses touch-generated desktop drag/fill/resize starts, matching `docs/MOBILE_TOUCH_SCROLL_AUDIT.md`.
- There is no long-press selection mode, touch selection handles, or touch-specific fill/range-move affordance contract.
- Touch selection should not reuse desktop hover or edge-drag assumptions.
- Enterprise mobile validation should include accidental drag prevention, long-press selection, handle drag, native scroll continuity, and server placeholder behavior.

## Accessibility Risks

- Stage cells expose roles, labels, checked/pressed/disabled states for interactive cells.
- The broader virtualized grid a11y contract requires row/column count and indexes. This audit did not verify a complete selection-specific a11y story for active descendant, selected ranges, multi-range announcements, or placeholder rows.
- Row-selection checkbox cells have aria checked coverage in component tests.
- Enterprise readiness needs keyboard-only and screen-reader-oriented tests for active cell, selected range, row selection, multi-range, and virtualized remount.

## Enterprise Readiness Score

- Current score: **7/10**
- Target score: **9/10**

Blocks to target:

- Huge virtual selection uses bounded row-by-row scans instead of loaded intervals/server range descriptors.
- Server-backed operation semantics are incomplete for copy/export, cut, clear/delete, range move, and summary.
- Active cell/focus/edit ownership is not specified as one state machine.
- Touch selection lacks a long-press/handle model.
- Large-range performance lacks enforced budgets for summary, aggregates, clipboard, overlays, and multi-range rendering.
- Browser/e2e coverage does not fully prove virtualization remount, pinned panes, grouped/tree changes, placeholders, and focus continuity.

## Recommended Next Work

1. Add invariant tests for active cell, focus, editing, and selection ownership transitions.
2. Add invariant tests for selection invalidation after sort/filter/group/pivot/cache replacement.
3. Replace huge virtual-selection row scans with loaded interval metadata from row models.
4. Define server-backed operation contracts for copy/export, cut, clear/delete, fill, range move, summary, and all-row selection.
5. Add e2e tests for selection continuity across virtualization remounts and pinned panes.
6. Add grouped/tree app interaction tests for selection, keyboard, clipboard, and row selection.
7. Add a touch selection design with long press and explicit handles.
8. Add large-range performance gates for summary, aggregates, clipboard mutation planning, multi-range rendering, and selection drag.

## Validation Expectations

Recommended validation for future implementation slices:

- Core selection: `pnpm --filter @affino/datagrid-core test -- --runInBand selection`
- Vue app selection/clipboard: `pnpm --filter @affino/datagrid-vue test -- --runInBand selection clipboard`
- Stage selection/overlays: `pnpm --filter @affino/datagrid-vue-app test -- --runInBand selection`
- Browser interaction: `pnpm e2e -- e2e/sandbox-interactions.spec.ts`
- Performance: `node scripts/bench-datagrid-interactions.mjs`
- Docs: `node ./scripts/check-datagrid-docs-framework-track.mjs`
