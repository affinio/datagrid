# DataGrid Interaction Orchestration Audit

## Executive summary

DataGrid has a serious interaction orchestration foundation: scroll ownership is isolated, selection/fill/range-move/resize have explicit composables, pointer previews and auto-scroll are separated from mutation commits, active interaction ownership is observable, cancellation semantics are covered in the mounted app-stage path, and touch work has moved the primary body viewport back toward native scroll. Desktop behavior is broadly production-grade.

The system is not yet enterprise-grade for all interaction modes. The remaining gap is release confidence, not broad architectural unknowns: hard-fail Chromium desktop and emulated touch interaction profiles are in place, but real-device mobile validation still has to be executed on hardware. Touch policy is improved and handle-based for current selection/fill/range-move flows, but spreadsheet-class mobile claims still depend on validated device behavior and a product decision for any public touch interaction API.

Current enterprise readiness score: **8.7/10**.

Target score: **9/10** after real-device mobile validation and any public touch interaction model decision are complete.

## Current architecture summary

- Core viewport ownership stays in `@affino/datagrid-core`: viewport math, scroll IO, render sync, virtualization, and coordinate/selection primitives.
- Vue app-level ownership lives in `@affino/datagrid-vue`: `useDataGridAppViewport.ts`, `useDataGridAppInteractionController.ts`, `useDataGridAppHeaderResize.ts`, and cell/selection composables.
- Stage rendering and DOM event binding live in `@affino/datagrid-vue-app`: `DataGridTableStage.vue`, `DataGridTableStageCenterPane.vue`, pinned/header panes, row index, focus, overlays, and chrome canvas.
- Shared orchestration utilities live in `@affino/datagrid-orchestration`: pointer routers, fill/range move lifecycle, header resize, managed wheel/touch scroll, linked pane sync, keyboard command routing, viewport blur handling, and auto-scroll.

The primary app-stage path is mouse-first with touch guards. Cells bind `mousedown`, `click`, `mousemove`, `keydown`, and `dblclick`. The body viewport owns native scroll and passive scroll events. Header and pinned surfaces route scroll/wheel back to the body viewport. Global `mousemove`/`mouseup` complete resize, selection drag, fill, and range move.

## Implementation status

- Slice 1 completed on 2026-05-17: `packages/datagrid-vue/src/app/dataGridInteractionOwner.ts` now provides an internal owner snapshot for drag selection, fill, range move, column resize, and row resize. Focused contracts cover single-owner state and start-order transitions.
- Slice 2 completed on 2026-05-17: `docs/datagrid-sheets-user-interactions-and-integrator-api.md` and `docs/datagrid-architecture.md` now define the app-stage, Vue adapter, orchestration, and core ownership boundaries for scroll, selection, fill, range move, resize, keyboard, focus, context menu, and editing.
- Slice 3 completed on 2026-05-17: the mounted app-stage path now wires mouseup, pointerup, pointercancel, contextmenu capture, window blur, and unmount cleanup into interaction and resize cancellation.
- Slice 4 completed on 2026-05-17: mounted window pointer/mouse lifecycle listeners now attach only while the app-stage has a pending or active pointer interaction, or while column resize owns the gesture.
- Slice 5 completed on 2026-05-17: mouse-event prevent-default policy is explicit, linked-surface touch pan listener behavior is covered, and the user interaction doc now includes the prevent-default/passive listener matrix.
- Slice 6 completed on 2026-05-17: touch-mode regression gates now cover scroll-first body gestures and explicit fill, range-move, column-resize, and row-resize handles.
- Slice 7 completed on 2026-05-17: range-move start policy is regression-locked for desktop selected-cell body drag thresholds, touch-generated cell-body suppression, explicit touch handle coverage, and sandbox desktop body-drag e2e.
- Slice 8 completed on 2026-05-17: focus ownership is now guarded for active editor/fill/range owners, inline editor focus uses `preventScroll`, and deferred viewport blur cleanup is covered when focus returns to the viewport.
- Slice 9 completed on 2026-05-17: active inline editors now commit deterministically before selected-cell range move and fill-handle drag, while scroll-active edit suppression and cell IO/rendering contracts remain covered.
- Slice 10 completed on 2026-05-17: pointer preview work now has explicit sync/rAF lifecycle contracts, pointer auto-scroll layout reads are budgeted to one sample per metric per frame, and the performance gate doc records the direct-preview budget.
- Slice 11 completed on 2026-05-17: sandbox Playwright coverage now gates desktop interaction races for virtualized drag selection with pinned columns, fill auto-scroll cleanup, range-move auto-scroll Escape cancellation, contextmenu interruption/reopen, and adjacent resize controls.
- Slice 12 completed on 2026-05-17: optional `dgPerfTrace` diagnostics now emit interaction owner transitions, cancellation reasons, pointer preview timing, pointer auto-scroll frame timing, prevent-default samples, and focus restoration fallback reasons.
- Slice 13 completed on 2026-05-17: `scripts/bench-datagrid-enterprise-browser-frames.mjs` now runs warning-first interaction frame scenarios for drag selection, fill auto-scroll, range-move auto-scroll, resize drag, and context menu open/cleanup.
- Slice 14 completed on 2026-05-17: interaction audit status, mobile touch audit status, TODO ordering, and this implementation plan now separate closed implementation slices from remaining device calibration and follow-on audit work.
- Follow-up completed on 2026-05-17: the enterprise browser-frame benchmark now has hard-fail `desktop-ci`, `touch-tablet-ci`, and `touch-phone-ci` interaction profiles, plus root assert scripts and perf-contract locks for desktop and tablet/coarse-pointer gates.
- Remaining high-risk work: real-device mobile validation.

## Files reviewed

Docs:

- `AGENTS.md`
- `docs/README.md`
- `docs/datagrid-architecture.md`
- `docs/MOBILE_TOUCH_SCROLL_AUDIT.md`
- `docs/datagrid-viewport-controller-decomposition.md`
- `docs/datagrid-viewport-math-engine.md`
- `docs/VIRTUALIZATION_ENTERPRISE_AUDIT.md`
- `docs/VIRTUALIZATION_ENTERPRISE_PLAN.md`
- `docs/datagrid-sheets-user-interactions-and-integrator-api.md`

Interaction and stage:

- `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
- `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
- `packages/datagrid-vue/src/app/useDataGridAppViewportLifecycle.ts`
- `packages/datagrid-vue/src/app/useDataGridAppHeaderResize.ts`
- `packages/datagrid-vue/src/app/useDataGridAppSelection.ts`
- `packages/datagrid-vue/src/app/useDataGridAppCellSelection.ts`
- `packages/datagrid-vue/src/app/dataGridMouseEventGuards.ts`
- `packages/datagrid-vue/src/app/dataGridFocusRestore.ts`
- `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStagePinnedPane.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageHeader.vue`
- `packages/datagrid-vue-app/src/stage/useDataGridTableStageRuntime.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridTableStageScrollSync.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStagePointerInteractions.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageFocusRuntime.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageRowIndex.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageFillAction.ts`
- `packages/datagrid-vue-app/src/gestures/dataGridTouchPanGuard.ts`

Orchestration package:

- `packages/datagrid-orchestration/src/pointer/useDataGridCellPointerDownRouter.ts`
- `packages/datagrid-orchestration/src/pointer/useDataGridDragPointerSelection.ts`
- `packages/datagrid-orchestration/src/pointer/useDataGridGlobalPointerLifecycle.ts`
- `packages/datagrid-orchestration/src/pointer/useDataGridPointerAutoScroll.ts`
- `packages/datagrid-orchestration/src/pointer/useDataGridPointerModifierPolicy.ts`
- `packages/datagrid-orchestration/src/fill/useDataGridFillHandleStart.ts`
- `packages/datagrid-orchestration/src/fill/useDataGridFillSelectionLifecycle.ts`
- `packages/datagrid-orchestration/src/selection/useDataGridRangeMoveStart.ts`
- `packages/datagrid-orchestration/src/selection/useDataGridRangeMoveLifecycle.ts`
- `packages/datagrid-orchestration/src/headers/useDataGridHeaderResizeOrchestration.ts`
- `packages/datagrid-orchestration/src/headers/useDataGridHeaderInteractionRouter.ts`
- `packages/datagrid-orchestration/src/headers/useDataGridResizeClickGuard.ts`
- `packages/datagrid-orchestration/src/navigation/useDataGridKeyboardCommandRouter.ts`
- `packages/datagrid-orchestration/src/editing/useDataGridInlineEditorFocus.ts`
- `packages/datagrid-orchestration/src/viewport/useDataGridViewportBlurHandler.ts`
- `packages/datagrid-orchestration/src/viewport/useDataGridViewportScrollLifecycle.ts`
- `packages/datagrid-orchestration/src/contextMenu/useDataGridViewportContextMenuRouter.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridManagedWheelScroll.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridManagedTouchScroll.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridLinkedPaneScrollSync.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridScrollIdleGate.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridScrollPerfTelemetry.ts`

Tests:

- `packages/datagrid-vue/src/app/__tests__/useDataGridAppInteractionController.contract.spec.ts`
- `packages/datagrid-vue/src/app/__tests__/useDataGridAppHeaderResize.contract.spec.ts`
- `packages/datagrid-vue/src/app/__tests__/useDataGridAppViewport.contract.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/useDataGridGlobalPointerLifecycle.contract.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/useDataGridCellPointerDownRouter.contract.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/useDataGridFillHandleStart.contract.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/useDataGridDragPointerSelection.contract.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/useDataGridPointerAutoScroll.contract.spec.ts`
- `packages/datagrid-vue/src/composables/__tests__/useDataGridViewportBlurHandler.contract.spec.ts`
- `packages/datagrid-orchestration/src/__tests__/useDataGridManagedTouchScroll.contract.spec.ts`
- `packages/datagrid-orchestration/src/__tests__/useDataGridManagedWheelScroll.contract.spec.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStageViewportRuntime.spec.ts`
- `packages/datagrid-vue-app/src/stage/__tests__/useDataGridStagePointerInteractions.spec.ts`
- `packages/datagrid-vue-app/src/__tests__/DataGrid.contract.spec.ts`

## Strengths

- Scroll has a clear primary owner in the body viewport. `DataGridTableStageCenterPane.vue` uses passive scroll, and `useDataGridStageViewportRuntime.ts` routes center, pinned-bottom, and linked wheel behavior back through the body viewport.
- Pinned panes are synchronized through `useDataGridLinkedPaneScrollSync`, which rAF-batches transforms and avoids repeated writes when scroll position has not changed.
- Viewport math and IO are split in core docs and implementation. `dataGridViewportMath.ts` is pure, and `dataGridViewportScrollIo.ts` owns DOM scroll IO.
- Selection, fill, range move, resize, keyboard, context menu, and blur behavior have dedicated orchestration utilities with contract tests.
- Fill handle and range move starts explicitly stop competing interactions. `useDataGridFillHandleStart` stops range move and drag selection; `useDataGridRangeMoveStart` stops drag selection and fill.
- Header resize stops fill and drag selection before taking ownership, and `useDataGridResizeClickGuard` blocks the synthetic post-resize click.
- Keyboard commands are centralized in `useDataGridKeyboardCommandRouter` for undo/redo, copy/paste/cut, select all, clear, context menu, and range-move cancellation.
- Touch scroll has a safer policy than before. The main body viewport remains native, while `installDataGridTouchPanGuard` only handles linked non-scroll surfaces and lazily installs the non-passive `touchmove` listener.
- Touch-generated mouse events are guarded in app interaction, fill handle, header resize, row/column drag, and context-menu paths.

## Findings by severity

### Blocker

None found for current desktop production behavior.

Enterprise blocker for mobile claims: the automated architecture and Chromium gates are in place, but hardware validation is not. Current code is scroll-first on touch, which is correct, and touch selection, fill, range move, and resize use explicit long-press or handle-owned flows in the current stage path.

### High

1. **Real-device mobile validation is still pending.**
   - Evidence: Playwright gates cover scroll-first touch behavior and explicit touch handles, but the mobile audit still requires iPad Safari/Chrome, Android Chrome, Surface/Windows touch, and macOS precision trackpad runs.
   - Impact: browser automation reduces regression risk, but it does not prove momentum feel, high-DPI handle targeting, and platform-specific gesture arbitration.
   - Required: execute and record the device matrix before claiming full mobile enterprise readiness.

2. **Public touch interaction model is intentionally unexposed.**
   - Evidence: the current `interactionMode` remains internal, touch cell-body drag remains scroll-first, and handle-based touch flows are not exposed as a public API contract.
   - Impact: this is the right API-stability choice for now, but product/integrator expectations for mobile spreadsheet behavior need an explicit decision before documentation can present it as public behavior.
   - Required: propose and approve a public touch interaction API only if integrators need to control this behavior.

### Closed high-risk findings

1. **Main app-stage pointer lifecycle does not use the shared global pointer lifecycle.**
   - Evidence: `useDataGridGlobalPointerLifecycle.ts` supports mouseup, pointerup, pointercancel, contextmenu capture, window blur, and rAF preview modes. The main stage path uses `useDataGridAppViewportLifecycle.ts` window `mousemove`/`mouseup` listeners and `useDataGridTableStageScrollSync.ts`.
   - Impact: pointer cancellation, lost pointer capture, touch/stylus pointerup, and window blur semantics are not uniformly owned in the primary grid path.
   - Status: addressed for the mounted app-stage path. The path now covers mouseup, pointerup, pointercancel, contextmenu capture, window blur, unmount cleanup, active-only listener wiring, and warning-first interaction diagnostics.
   - Required: keep the lifecycle contracts aligned as pointer-event support evolves.

2. **Interaction ownership is explicit locally but fragmented globally.**
   - Evidence: active states live across `isPointerSelectingCells`, `isFillDragging`, `isRangeMoving`, `isColumnResizing`, pending drag/range-move refs, header resize state, and viewport scroll state.
   - Impact: each feature has guards, but there is no single interaction arbiter that can answer "what owns the gesture now?" for every subsystem.
   - Status: addressed for the implemented interaction owners. Internal owner snapshots, diagnostics, and cancellation samples cover drag selection, fill, range move, column resize, row resize, and app-stage cancellation reasons.
   - Required: extend diagnostics only when new interaction owners are added.

3. **Range move can still be armed from the selected cell body.**
   - Evidence: `useDataGridAppInteractionController.ts` sets `pendingRangeMove` when a primary-button mousedown starts inside the current selection range; edge hover is visual-only in `useDataGridStagePointerInteractions.ts`.
   - Impact: desktop behavior may be intentional, but touch and pen users need explicit handles or long-press mode to avoid scroll/selection ambiguity.
   - Status: addressed for the current app-stage path. Desktop selected-cell body drag remains threshold-gated; touch-generated cell-body mousedown does not arm range move; touch range move starts only from the explicit handle path.
   - Required: keep these gates current if the range-move handle model changes.

4. **Touch selection is not enterprise-complete until device validation is recorded.**
   - Evidence: `dataGridMouseEventGuards.ts` prioritizes native scroll for touch-generated mouse events, long-press selection prep is implemented, and the mobile audit keeps real-device execution and public touch API decisions open.
   - Impact: this avoids accidental drag, but it does not provide spreadsheet-class mobile selection handles, long-press arbitration, or touch range extension.
   - Status: partially addressed by scroll-first cell-body touch policy, stationary long press selection prep, explicit selection/fill/range handles, and touch handle e2e gates.
   - Required: validate on real devices and decide whether to expose a public touch interaction model.

5. **Window-level mouse listeners are broad.**
   - Evidence: `useDataGridAppViewportLifecycle.ts` always adds `mousemove` and `mouseup` handlers while mounted.
   - Impact: handlers are light when idle, but enterprise interaction systems usually attach global move/up listeners only while an interaction is active or use pointer capture.
   - Status: addressed for the mounted app-stage path; global pointer/mouse lifecycle listeners attach only while pending/active interaction state is true.
   - Required: keep e2e race coverage aligned as lifecycle wiring evolves.

### Medium

1. **Scroll ownership has two parallel implementations.**
   - Evidence: core has `dataGridViewportScrollIo.ts` and app stage uses `useDataGridAppViewport.ts` plus `useDataGridStageViewportRuntime.ts`.
   - Impact: current separation is understandable because the app stage renders a richer layout, but hidden drift can emerge between core viewport controller and app-stage policy.
   - Status: ownership boundaries are now documented in `docs/datagrid-architecture.md` and `docs/datagrid-sheets-user-interactions-and-integrator-api.md`.
   - Required: keep tests aligned as pointer lifecycle and listener wiring are changed.

2. **PreventDefault policy is mostly intentional but not centrally documented.**
   - Evidence: cell pointer down, fill handle, range move, header resize, managed wheel/touch scroll, context menu, and keyboard commands all call `preventDefault()` in feature-specific code.
   - Impact: this is correct in many cases, but broad enterprise behavior needs a shared policy for native scroll, text editing, context menu, and assistive tech.
   - Status: addressed in `docs/datagrid-sheets-user-interactions-and-integrator-api.md`, with focused mouse/touch guard coverage.
   - Required: keep the matrix current as touch workflow gates and editor/focus behavior evolve.

3. **Managed touch scroll exists but is not the main body path.**
   - Evidence: `useDataGridManagedTouchScroll.ts` has pointer/touch handlers and tests; stage uses native body scroll plus `dataGridTouchPanGuard.ts` for linked surfaces.
   - Impact: this is a good current policy, but duplicate touch scroll code can confuse future changes.
   - Required: document that managed touch scroll is for linked/custom surfaces, while body viewport remains native.

4. **Cancellation semantics are incomplete in the main stage path.**
   - Evidence: `useDataGridGlobalPointerLifecycle.ts` supports pointer cancel and blur, while app-stage lifecycle handles mouseup but not pointercancel/window blur for active grid interactions.
   - Impact: active drag/fill/range/resize can rely on mouseup fallback and blur handlers elsewhere, but cancellation is not single-owner.
   - Status: mounted app-stage lifecycle now covers pointerup, pointercancel, contextmenu capture, window blur, and unmount cleanup.
   - Required: continue with active-only listener wiring and broader e2e race coverage.

5. **Resize ownership is split between column and row paths.**
   - Evidence: column resize uses `useDataGridHeaderResizeOrchestration`; row resize uses `useDataGridAppRowSizing.ts` with its own window listeners.
   - Impact: both may be correct independently, but resize as a domain does not have one shared owner or active interaction diagnostics.
   - Status: row resize is now included in the interaction owner snapshot.
   - Required: add shared cancellation policy in the main mounted path.

6. **Focus ownership spans multiple layers.**
   - Evidence: app interaction focuses the viewport/cell with `preventScroll`; stage focus runtime resolves visible cells; inline editor focus has a separate helper; blur handling commits/cancels through another utility.
   - Impact: current behavior is pragmatic, but focus restoration across virtualization, context menus, editors, and range interactions is a high-risk enterprise edge.
   - Status: addressed for the current app-stage path. Stage anchor restoration now has an explicit guard for active editor/fill/range owners, inline editor focus uses `preventScroll`, viewport blur deferred cleanup is covered, and active editors commit before fill/range interactions take ownership.
   - Required: keep context-menu focus transitions covered as race e2e work expands.

7. **Pointer preview rAF batching is available but not consistently used.**
   - Evidence: `useDataGridGlobalPointerLifecycle` supports `pointerPreviewApplyMode: "raf"`, while `useDataGridAppInteractionController.ts` applies previews directly from window mousemove.
   - Impact: direct preview updates can be acceptable, but large selection/fill previews need frame-budget validation.
   - Status: addressed through a direct-preview budget. Sync and rAF lifecycle modes are covered, pointer auto-scroll samples each viewport metric once per frame, and `docs/perf/datagrid-performance-gates.md` records the gate expectations.
   - Required: keep benchmark thresholds current as race e2e/perf traces expand.

### Low

1. **`docs/INTERACTION_MODEL.md` is referenced by prior planning but does not exist in this checkout.**
   - Impact: Codex/maintainer preflight has no canonical interaction model doc.
   - Status: the interaction ownership model is now documented in `docs/datagrid-sheets-user-interactions-and-integrator-api.md` and `docs/datagrid-architecture.md`.
   - Required: create a dedicated model doc only if the interaction surface grows beyond those references.

2. **The orchestration package and Vue composable re-exports can obscure source ownership.**
   - Evidence: many `packages/datagrid-vue/src/composables/*` files re-export orchestration utilities.
   - Impact: harmless for package ergonomics, but audits should review `packages/datagrid-orchestration/src/*` as canonical implementation.

## Focus-area evaluation

| Area | Assessment |
| --- | --- |
| Scroll ownership | Strong for body viewport and pinned sync; parallel app/core implementations need documented boundaries. |
| Selection ownership | Functional and tested, but cell selection, drag selection, range move, and row selection share app-controller state. |
| Resize ownership | Column resize is well isolated; row resize is separate and should join active-owner diagnostics. |
| Drag ownership | Header/row drag guards exist; drag selection is mouse-first and depends on window mousemove/up. |
| Fill ownership | Good explicit fill lifecycle, server-aware fill paths, and cancellation guards; touch fill requires handle policy. |
| Keyboard ownership | Strong command router for global grid commands; cell navigation/editing remains app-controller heavy. |
| Focus ownership | Good use of `preventScroll`; needs stronger virtualization/remount contracts. |
| Gesture arbitration | Local arbitration is good; internal owner snapshot exists for the main pointer-driven owners; mounted cancellation remains open. |
| Pointer lifecycle | Shared lifecycle utility is strong but not the primary stage owner. |
| Touch vs desktop policy | Improved scroll-first touch policy; touch selection/range/fill not complete. |
| Event routing | Clear template-to-composable routing, but mouse-first paths dominate. |
| Passive listeners | Body scroll is passive; touch pan guard uses lazy non-passive move only after handled touch start. |
| PreventDefault usage | Scoped policy is documented and covered for mouse/touch-generated mouse guards plus linked-surface touch pan. |
| Scroll synchronization | rAF-backed for linked panes and stage scroll refs; header/pinned sync tests exist. |
| State machines | Feature-level state machines exist; owner snapshot now covers active app owners, but cancellation is not yet unified. |
| Cancellation semantics | Mounted main path now covers pointerup, pointercancel, contextmenu capture, window blur, unmount cleanup, and active-only pointer listener wiring. |

## Correctness risks

- A pending range move can revert to selection on mouseup, while actual range move commits through a separate lifecycle. This is correct today but should be covered by owner-state tests.
- Drag selection, fill, range move, and column resize all share one global `mousemove` path; the precedence order in `useDataGridTableStageScrollSync.ts` and `useDataGridAppInteractionController.ts` is an implicit contract.
- Touch-generated mouse guards prevent accidental starts, but future pointer-event additions could bypass those guards unless pointer type is part of the shared router contract.
- Context menu routing can change selection before opening the menu, which is standard spreadsheet behavior but must not fire during active drag/fill/range interactions.
- Focus restoration queries visible DOM; virtualization remount can fall back to viewport focus when the anchor cell is not mounted.

## Performance risks

- Mousemove-driven drag/fill/range previews can update selection/overlay state synchronously.
- Pointer auto-scroll reads `getBoundingClientRect()` each frame while an interaction is active. This is reasonable but should be budgeted.
- Hover/range edge detection calls `getBoundingClientRect()` on mousemove. Coarse pointer and scroll suppression reduce risk.
- Global mousemove listeners are now active-only in the mounted app-stage path.
- Canvas chrome redraw and pinned sync have been rAF-batched; browser traces now cover the automated Chromium profiles, and hardware traces remain pending.

## Touch/mobile risks

- Native one-finger body scroll is the right default, but touch selection handles and long-press mode are not implemented.
- Range move and fill should be handle-only on touch.
- Touch context menu is suppressed for long-press reservation, but the replacement touch menu/selection workflow is not defined.
- Managed touch scroll and native body scroll coexist; future changes must not route native body pan through non-passive handlers.
- Device-level momentum scroll validation is still needed.

## Enterprise readiness score

Current score: **8.7/10**.

Target score: **9/10**.

What blocks target score:

- Real-device mobile validation is still needed for iPad Safari/Chrome, Android Chrome, Surface/Windows touch, and macOS precision trackpad.
- Public touch interaction/API behavior remains intentionally unexposed until a product decision requires it.

## Recommended tests

Unit/contract tests:

- Active owner invariant: only one of drag selection, fill, range move, column resize, row resize, or scroll-managed gesture can be active.
- Main stage cancellation: mouseup, pointerup, pointercancel, contextmenu capture, window blur, and unmount all clean up active interaction state.
- Touch-generated mouse events do not start cell drag selection, range move, fill, row resize, column resize, header drag, or row reorder.
- Range move is desktop cell-body/edge behavior only; touch requires the explicit handle path.
- `preventDefault()` expectations by owner and event type.
- Focus restoration after selection, fill, range move, inline edit commit/cancel, context menu close, and virtualization remount.

Component tests:

- Header resize cancels active fill/drag and blocks post-resize click.
- Fill start cancels range move and drag selection.
- Range move start cancels fill and drag selection.
- Context menu does not open during active interactions.
- Pinned panes, center viewport, header viewport, and pinned-bottom viewport remain scroll-synchronized.

Playwright/e2e tests:

- Desktop drag selection across virtualized rows and pinned columns is covered in `e2e/sandbox-interactions.spec.ts`.
- Desktop fill drag with auto-scroll and mouseup outside viewport is covered in `e2e/sandbox-interactions.spec.ts`.
- Range move with auto-scroll and Escape cancel is covered in `e2e/sandbox-interactions.spec.ts`.
- Column and row resize near adjacent header/row-index controls are covered in `e2e/sandbox-interactions.spec.ts`.
- Context menu interruption and reopen after active interaction cleanup is covered in `e2e/sandbox-interactions.spec.ts`.
- Touch one-finger scroll over body cells does not start selection/fill/range/resize.
- Touch long-press selection plus explicit handle workflows for fill, range move, column resize, and row resize.
- Browser zoom/high-DPI pointer thresholds for range move, fill handle, and resize handles.

Performance tests:

- Mousemove preview budget for drag selection, fill, and range move.
- Pointer auto-scroll frame budget and layout-read count are covered by contract tests and hard-fail browser interaction profiles.
- Scroll frame budget with pinned panes, header, overlays, and canvas chrome enabled.
- Hover/range-edge detection overhead with large rendered windows remains benchmark-only until device thresholds are calibrated.

## Recommended telemetry

- Active interaction owner and transition history is available as `interactionOwner` samples behind `dgPerfTrace`.
- Interaction cancel reason is available as `interactionCancel` samples behind `dgPerfTrace`.
- Pointer preview apply time is available as `interactionPreview` samples behind `dgPerfTrace`.
- Auto-scroll frame time and delta are available as `interactionAutoScroll` samples behind `dgPerfTrace`.
- Prevent-default count by event type and owner is available as `interactionPreventDefault` samples behind `dgPerfTrace`.
- Global listener active/idle state.
- Scroll synchronization drift between body, header, pinned panes, and pinned-bottom viewport.
- Focus restoration target and fallback reason is available as `stageFocusRestore` samples behind `dgPerfTrace`.
- Touch gesture classification: native scroll, linked-surface pan, long press, handle drag, canceled.

## Prioritized roadmap

### Phase 1: owner invariants

- Add an active interaction owner snapshot in the app-stage path.
- Assert one-interaction-one-owner for drag selection, fill, range move, column resize, row resize, and touch pan.
- Document app-stage versus core viewport ownership.

### Phase 2: pointer lifecycle unification

- Route the main mounted path through `useDataGridGlobalPointerLifecycle` or adapt its cancellation semantics into `useDataGridAppViewportLifecycle`.
- Add pointerup, pointercancel, contextmenu capture, window blur, and unmount cleanup tests.
- Keep desktop mouse behavior unchanged.

### Phase 3: prevent-default and listener policy

- Create an interaction event policy table covering scroll, selection, fill, range move, resize, keyboard, context menu, and editors.
- Keep body scroll passive/native.
- Attach global move/up listeners only while needed if validation shows idle overhead or lifecycle risk.

### Phase 4: touch interaction model

- Define touch selection mode, long press, explicit handles, scroll cancellation, and editor/context-menu interaction.
- Keep range move and fill handle-only on touch.
- Add device/e2e coverage before enabling touch drag selection.

### Phase 5: enterprise validation

- Keep Playwright interaction-race tests aligned with owner/lifecycle changes.
- Keep hard-fail Chromium desktop and emulated touch performance gates for pointer preview, auto-scroll, focus restore, and scroll sync drift aligned with `dgPerfTrace` diagnostics.
- Record the real-device mobile matrix before claiming full mobile enterprise readiness.
- Revisit thresholds after collecting real hardware traces.

## Migration notes

- Do not replace the current orchestration package. Extend existing utilities and wire them more consistently into the main stage path.
- Preserve desktop behavior while adding touch-specific policies.
- Avoid public API changes unless a new touch interaction mode or public interaction diagnostics API is explicitly approved.
- Keep scroll-time code rAF-batched and sampling-only where possible.
