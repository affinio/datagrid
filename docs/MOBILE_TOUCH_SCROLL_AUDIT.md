# Affino DataGrid Mobile / Touch Scroll Audit

Date: 2026-05-16

## Concise Summary

Affino DataGrid already has strong desktop scroll foundations: scroll work is mostly rAF-batched, core viewport IO avoids broad DOM reads in hot paths, header and pinned panes have dedicated sync paths, and server-backed row models include cache and prefetch support.

The first mobile/touch quick wins are now implemented in the Vue app-stage path: the center body viewport exposes native touch panning, coarse-pointer mode suppresses hover work, touch-generated mouse gestures are ignored by desktop drag/fill/resize starts, app-stage row overscan is higher and adaptive on fast scroll, and stage scroll-state refs are batched through `requestAnimationFrame`.

The remaining mobile/touch gap is now primarily validation and performance-hardening work: touch hit targets need expansion, server-backed fast-scroll blanking needs measurement, and Playwright/device performance gates are still missing.

## Implementation Status

Completed in Phase 1:
- Native body/header viewport panning: `.grid-body-viewport` and `.grid-header-viewport` use `touch-action: pan-x pan-y`; the body viewport keeps `-webkit-overflow-scrolling: touch`.
- Table-stage touch fallback routing: `installDataGridTouchPanGuard()` is installed on `DataGridTableStage.vue` only to route touch pan from linked non-scroll surfaces (`.grid-body-pane`, `.grid-header-shell`) into the body viewport. It does not claim touch gestures that start inside the native body viewport.
- Lazy canceling touch listener: `dataGridTouchPanGuard.ts` installs the non-passive `touchmove` listener only after a handled target starts a gesture, instead of keeping the canceling listener active for the whole root.
- Coarse-pointer detection: `DataGridTableStage.vue` and `useDataGridAppViewport.ts` track coarse pointers and use that state for touch-first behavior.
- Touch-generated mouse guards: cell mousedown, row/column resize, autosize double-click, row index drag, fill-handle drag, fill-handle double-click, and stage header drag paths now ignore touch-generated mouse events unless explicitly routed through a supported handle path.
- Touch tap edit guard: touch-generated clicks on select/date affordance zones route to normal cell selection instead of opening inline edit from a single tap; desktop affordance clicks still open edit.
- Touch long-press prep: touch-generated `contextmenu` events no longer open the desktop grid context menu, leaving long press available for the future touch selection model.
- Prevent-default cleanup: row resize handle clicks stop row-index selection without unconditionally preventing the click default.
- Scroll-time suppression: hover/range-edge hover and inline edit start are suppressed while the body viewport is scrolling.
- App-stage overscan: `useDataGridAppViewport.ts` increases row overscan on coarse pointers and adds velocity-based adaptive row overscan with idle decay.
- Stage scroll batching: `useDataGridStageViewportRuntime.ts` batches body scroll refs and pinned-bottom scroll-left sync through a scroll frame.
- Scroll-frame chrome redraw: body and pinned-bottom scroll handlers queue canvas chrome redraw mode and flush it from the stage scroll frame, not from the raw scroll event.
- Scroll sampling cleanup: body scroll handling samples `scrollTop` / `scrollLeft` once per raw scroll event and reuses the captured state for linked pane sync, pinned-bottom sync, and chrome redraw mode selection.
- Resize metric batching: window resize metric sync is rAF-batched so resize bursts do not run layout metric reads directly from the resize event.
- Header scroll sampling cleanup: header-to-body scroll sync samples header `scrollLeft` once per event before updating the body viewport.

Still open:
- Server-backed Playwright blank/loading viewport gates and prefetch tuning from real touch velocity.
- Playwright/device validation gates for touch scroll, blanking, FPS, and accidental drag prevention.

Phase 2 started:
- Internal interaction mode seam: `DataGridTableStage.vue` now derives `interactionMode: desktop | touch` from internal `auto` mode plus coarse-pointer state, and stage pointer/fill-handle interactions receive that mode input without exposing a public API.
- Cell-body touch guard: `DataGridTableStage.vue` now checks the internal interaction mode before delegating cell mousedown into selection/range-move interaction state, so touch-generated mousedown keeps scroll priority while desktop mousedown still starts the existing selection path.
- Touch pan click suppression: the body shell passively tracks touch movement and suppresses the next synthetic touch click after a pan, preventing accidental cell selection after one-finger scroll without canceling native scrolling.
- Touch long-press selection prep: in touch mode, a stationary long press on a body cell selects/focuses that cell and suppresses the follow-up synthetic click/context menu; movement beyond the pan threshold cancels the long press.
- Touch selection anchor affordance: selected anchor cells now render a touch-only handle when no fill handle is present; the handle isolates touchstart/move/end, down, click, and context-menu events from cell-body selection and reserves the UI affordance for explicit touch selection drag.
- Explicit touch fill handle: fill handles now accept real touchstart/move/end on the handle itself and bridge those events into the existing fill drag mouse lifecycle, while touch-generated cell-body mousedown remains scroll-first.
- Explicit touch selection handle drag bridge: touchstart on the selection anchor handle starts the existing selection-extension lifecycle with scroll-safe handle isolation; touchmove/touchend are forwarded through the existing global mouse lifecycle.
- Explicit touch range-move handle drag bridge: touch mode now exposes a move-selection handle on the selected anchor cell and routes its touchstart/move/end through the existing range-move lifecycle instead of using cell-body touch drag.
- Touch hit targets: coarse-pointer mode expands fill, fill action, row resize, and column resize targets while preserving desktop marker visuals.

Phase 3 started:
- Touch scroll lightweight rendering: while the stage is in touch mode and the body viewport is actively scrolling, custom cell/group renderer functions are bypassed and cells render their resolved `displayValue`; desktop renderer behavior is unchanged.

## Current Architecture Summary

- `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue` composes header, center body viewport, pinned panes, pinned-bottom viewport, canvas chrome, overlays, fill action menu, focus, row hover, selection, fill, and range move state.
- `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue` owns the center scrollable viewport DOM and binds `@scroll`, `@wheel`, cell mousedown/click/move, cell double-click, and fill-handle mouse events. Cell double-click now prevents default only after inline edit is allowed.
- `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts` bridges the stage viewport to app scroll/runtime state, links pinned panes via transforms, wires managed wheel scrolling, batches body scroll refs through rAF, and coordinates scroll-triggered canvas chrome redraws inside the stage scroll frame.
- `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts` resolves editor modes, select/date display values, and authored cell/group renderer calls; the stage can request lightweight display-value rendering during touch scroll.
- `packages/datagrid-vue/src/app/useDataGridAppViewport.ts` is the main Vue app virtualization path. It reads `scrollTop` / `scrollLeft` on scroll, syncs header `scrollLeft`, batches viewport commits in `requestAnimationFrame`, computes visible row and column windows, and assigns `displayRows`.
- `packages/datagrid-core/src/viewport/dataGridViewportScrollIo.ts` is a lower-level viewport controller path with rAF scroll sync, drift correction, heavy-update thresholds, and resize observer integration.
- `packages/datagrid-core/src/viewport/dataGridViewportVirtualization.ts` plus `packages/datagrid-core/src/virtualization/dynamicOverscan.ts` provide adaptive vertical overscan in the core viewport path.
- `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts` provides server/data-source viewport loading, placeholder rows for uncached rows, row cache limits, range cache state, critical/background pulls, and velocity-aware prefetch.
- `packages/datagrid-core/src/models/serverBackedRowModel.ts` provides a simpler server-backed row model with viewport warmup, LRU row-node cache, and range cache reuse.

## Exact Files Reviewed

- `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageHeader.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStagePinnedPane.vue`
- `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridTableStageRuntime.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridTableStageScrollSync.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageChromeCanvas.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageChromeModel.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStagePointerInteractions.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageRowIndex.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageCellState.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageFocusRuntime.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageFillAction.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridTableStagePlaceholderRows.ts`
- `packages/datagrid-vue-app/src/gestures/dataGridTouchPanGuard.ts`
- `packages/datagrid-vue-app/src/theme/ensureDataGridAppStyles.ts`
- `packages/datagrid-vue-app/src/config/dataGridVirtualization.ts`
- `packages/datagrid-vue-app/src/host/DataGridDefaultRenderer.ts`
- `packages/datagrid-vue-app/src/gantt/DataGridGanttStage.vue`
- `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
- `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts`
- `packages/datagrid-vue/src/app/useDataGridAppViewportLifecycle.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridManagedTouchScroll.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridManagedWheelScroll.ts`
- `packages/datagrid-orchestration/src/scrolling/dataGridManagedScrollPipeline.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridLinkedPaneScrollSync.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridScrollIdleGate.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridScrollPerfTelemetry.ts`
- `packages/datagrid-orchestration/src/viewport/useDataGridViewportScrollLifecycle.ts`
- `packages/datagrid-orchestration/src/viewport/useDataGridVisibleRowsSyncScheduler.ts`
- `packages/datagrid-orchestration/src/pointer/useDataGridCellPointerDownRouter.ts`
- `packages/datagrid-orchestration/src/pointer/useDataGridDragPointerSelection.ts`
- `packages/datagrid-orchestration/src/pointer/useDataGridGlobalPointerLifecycle.ts`
- `packages/datagrid-orchestration/src/pointer/useDataGridPointerAutoScroll.ts`
- `packages/datagrid-orchestration/src/fill/useDataGridFillHandleStart.ts`
- `packages/datagrid-orchestration/src/selection/useDataGridRangeMoveStart.ts`
- `packages/datagrid-orchestration/src/headers/useDataGridHeaderResizeOrchestration.ts`
- `packages/datagrid-orchestration/src/headers/useDataGridResizeClickGuard.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportScrollIo.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportVirtualization.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportConstants.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportController.ts`
- `packages/datagrid-core/src/virtualization/axisVirtualizer.ts`
- `packages/datagrid-core/src/virtualization/verticalVirtualizer.ts`
- `packages/datagrid-core/src/virtualization/dynamicOverscan.ts`
- `packages/datagrid-core/src/virtualization/overscan.ts`
- `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts`
- `packages/datagrid-core/src/models/serverBackedRowModel.ts`
- `packages/datagrid-core/src/models/server/rangeCache.ts`
- `packages/datagrid-core/src/models/server/velocityOverscan.ts`
- `e2e/sandbox-grid.spec.ts`
- `e2e/sandbox-interactions.spec.ts`

## Findings By Severity

### Blocker

None found that makes desktop scrolling unusable or prevents incremental mobile improvements. The previous blocker-level mobile risk, non-native one-finger body scrolling, has been reduced by restoring native panning on the body viewport. The remaining blocker-level risk is validation: tablet/mobile fast-scroll behavior is not yet protected by Playwright or device performance gates.

### High

#### 1. Native touch panning was disabled on the main grid viewport

Files/functions:
- `packages/datagrid-vue-app/src/theme/ensureDataGridAppStyles.ts` selectors `.grid-body-viewport`, `.grid-header-viewport`, `.datagrid-gantt-timeline__viewport`
- `packages/datagrid-vue-app/src/gestures/dataGridTouchPanGuard.ts` `installDataGridTouchPanGuard`
- `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue` `shouldRouteTableTouchPan`

Problem:
- This was the original highest-risk mobile issue: the body viewport used to rely on JavaScript touch panning instead of browser-native scroll.

Current state:
- `.grid-body-viewport` and `.grid-header-viewport` now use `touch-action: pan-x pan-y`.
- `installDataGridTouchPanGuard()` now lazily installs the non-passive `touchmove` listener only for handled linked surfaces.
- `DataGridTableStage.vue` routes touch pan that starts on `.grid-body-pane` or `.grid-header-shell` into the central body viewport, but lets body-viewport gestures stay native.

Recommended fix:
- Keep the current policy and verify on real devices.
- Do not broaden the fallback touch guard to native body viewport gestures.
- Add Playwright/device tests that assert body gestures are not prevented and pinned/header gestures scroll the body viewport.

#### 2. Touch gestures compete with cell selection and range move

Files/functions:
- `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
- `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts` `handleCellMouseDown`
- `packages/datagrid-orchestration/src/pointer/useDataGridCellPointerDownRouter.ts` `dispatchCellPointerDown`

Problem:
- Body cells previously bound `@mousedown.prevent.stop`; this has been reduced so touch-generated mouse events are ignored by the interaction controller before desktop selection/drag logic starts.
- Selection and range-move paths call `preventDefault()` on primary-button down.
- On touch devices, this mouse-first interaction model still needs a full long-press selection mode, but single-tap edit affordances no longer bypass the scroll-first/tap-select policy for select/date cells.

Current state:
- Touch-generated single taps are guarded from opening select/date editors.
- Touch-generated double-click/double-tap events still open inline edit, preserving a deliberate touch editing path while keeping one-finger scroll and single tap selection first.
- Touch-generated cell-body mousedown is now filtered at the stage boundary before it reaches desktop selection/range-move logic; mouse/trackpad desktop mousedown still follows the existing path.
- Touch movement beyond the pan threshold suppresses the next touch-generated cell click, while stationary taps still select/focus cells.
- Touch long press now establishes a cell selection without starting drag/range move; this is the foundation for explicit touch selection mode and handles.
- Touch mode now exposes an event-isolated anchor handle affordance on selected cells that do not already show a fill handle; real touch events on the handle do not enter body long-press or cell-body selection paths, and drag semantics remain disabled until explicit touch handle behavior is implemented.
- Fill drag can now start from the explicit fill handle with real touch events; touchmove/touchend are isolated to the handle and forwarded to the existing fill preview/finalization pipeline.
- Touch selection drag now starts only from the explicit selection anchor handle; body-cell touch gestures still prioritize native scroll.
- Touch range move now starts only from the explicit move-selection handle; the previous cell-body touch path remains disabled.

Recommended fix:
- Continue moving cell gesture initiation toward pointer-aware routing and treat `pointerType === "touch"` as scroll-first.
- Do not start drag selection or range move from touch unless the grid is already in touch selection mode, the user long-pressed, or the down occurred on an explicit handle.
- Keep existing mouse behavior behind `pointerType === "mouse"` / desktop mode.
- Keep touch single tap as selection/focus; use double tap, long press mode, or explicit editor controls for editing.
- Do not route touch long press through the desktop context menu; reserve it for the future touch selection model.

#### 3. Range move can start from the selected cell body, not only an explicit handle

Files/functions:
- `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts` `handleCellMouseDown`, `activatePendingRangeMove`
- `packages/datagrid-vue-app/src/stage/useDataGridStagePointerInteractions.ts` `isNearRangeMoveSelectionEdge`
- `packages/datagrid-orchestration/src/selection/useDataGridRangeMoveStart.ts`

Problem:
- Range move can be armed from inside a selected editable range and activated after movement threshold.
- The hover edge cue is mouse-only, but the start path is still cell-body based.
- On touch, this is likely to steal scroll gestures or make the first scroll movement feel sticky.

Recommended fix:
- Require an explicit range-move handle for touch.
- On desktop, keep edge-drag if desired, but put it behind `interactionMode: desktop | auto` and disable it for coarse pointers.
- Build on the current long-press cell selection by adding visible touch selection handles before allowing touch drag selection or range move.

#### 4. Vue app vertical overscan needed touch and velocity adaptation

Files/functions:
- `packages/datagrid-vue-app/src/config/dataGridVirtualization.ts` `resolveDataGridVirtualization`
- `packages/datagrid-vue/src/app/useDataGridAppViewport.ts` `rowOverscan`, `resolveViewportRangeFromSnapshot`
- `packages/datagrid-core/src/viewport/dataGridViewportVirtualization.ts` `createDataGridViewportVirtualization`

Problem:
- The Vue app viewport originally used static row overscan in the primary app-stage path.
- Fast tablet momentum scroll can outrun small fixed buffers, especially with custom renderers, auto-height rows, server-backed rows, or high refresh-rate devices.

Current state:
- `useDataGridAppViewport.ts` now applies a larger minimum overscan for coarse pointers.
- It also tracks scroll velocity and temporarily increases effective row overscan, then decays it after vertical scroll idle.

Recommended fix:
- Add benchmarks/telemetry around adaptive overscan hit rate, row count, and blank viewport risk.
- Later, consider unifying the app-stage row-window policy with the core dynamic overscan controller.

#### 5. Scroll handlers still do synchronous DOM writes and reactive updates during the scroll event

Files/functions:
- `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts` `handleCenterViewportScroll`
- `packages/datagrid-vue/src/app/useDataGridAppViewport.ts` `handleViewportScroll`, `commitViewportSnapshot`
- `packages/datagrid-vue-app/src/stage/useDataGridStageChromeCanvas.ts` `flushGridChromeRedraw`, `scheduleGridChromeRedraw`

Problem:
- The app viewport correctly batches the main visible row commit through rAF.
- The stage scroll handler previously updated body scroll refs and pinned-bottom `scrollLeft` sync directly in the scroll event.
- Center chrome redraw is still a sensitive path and needs a scroll-time budget.

Current state:
- `useDataGridStageViewportRuntime.ts` now batches body scroll refs and pinned-bottom scroll-left sync through a scroll frame.
- Pinned-bottom `scrollLeft` sync is now only scheduled when the body `scrollLeft` actually changes, so vertical-only scroll frames avoid that extra sync call.
- Stage body-scroll sampling now captures only `scrollTop` / `scrollLeft`; viewport dimensions stay on the resize/metrics path instead of being read during every scroll event.
- The raw body scroll handler now reads `scrollTop` and `scrollLeft` once per event and reuses the captured state for all stage scroll-frame decisions.
- Grid chrome redraw mode is now queued by the body and pinned-bottom scroll handlers and flushed inside the stage scroll frame, so canvas draw work no longer starts from the raw scroll event.
- Window resize metric sync is now batched through `requestAnimationFrame`; resize events no longer call `syncBodyViewportMetrics()` directly.
- Header scroll sync now captures header `scrollLeft` once per event and delegates body viewport commit into the existing stage scroll-frame path.
- Linked pinned pane transforms are already scheduled through the linked pane scroll sync rAF loop.
- `useDataGridAppViewport.ts` now syncs header `scrollLeft` from the viewport rAF commit instead of writing it directly inside the body scroll event.

Recommended fix:
- Keep making scroll event handlers sampling-only where possible.
- Continue moving any remaining header/pinned/canvas work to latest-value rAF passes.
- Avoid `flushGridChromeRedraw()` from raw scroll handlers; keep scroll-triggered flushes inside the stage scroll frame.

#### 6. Server/data-source row models can display loading rows in the viewport during fast scroll

Files/functions:
- `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts` `getRowsInRange`, `setViewportRange`, `resolveVelocityAwareSourceRange`
- `packages/datagrid-core/src/models/server/velocityOverscan.ts`
- `packages/datagrid-core/src/models/serverBackedRowModel.ts` `setViewportRange`, `warmViewportRange`

Problem:
- Data-source rows use placeholder loading row nodes when a requested row is not cached.
- There is velocity-aware prefetch, cache diagnostics, and critical/background pull separation, which is good.
- The behavior is not yet validated by browser/device gates against a "no visible blanking/loading during fast momentum scroll" target.

Current state:
- Core model coverage now asserts that scrolling into a resolved prefetch buffer returns real rows with no loading placeholders and schedules the next background prefetch before the edge.
- `DataSourceBackedRowModel.getSparseRowModelDiagnostics()` now reports current viewport row count, loaded row count, loading placeholder count, and loading placeholder ratio so fast-scroll blanking can be measured without DOM heuristics.
- The server datasource sandbox exposes that loading ratio through a stable DOM diagnostic, and Playwright now asserts the deterministic fake datasource route settles below a 5% viewport loading budget after a fast scroll session.

Recommended fix:
- Tune velocity prefetch and cache windows using real tablet scroll traces.
- Keep placeholders for correctness, but make the normal fast-scroll path prefetch enough rows that placeholders are rare.

### Medium

#### 7. Hover and range-move hover work can update while pointer movement is active

Files/functions:
- `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
- `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue` `setHoveredRow`, `clearHoveredRow`
- `packages/datagrid-vue-app/src/stage/useDataGridStagePointerInteractions.ts` `handleCellMouseMove`

Problem:
- Rows use `@mouseenter` for hover state.
- Cells use `@mousemove` to update range-move hover state.
- Touch does not need hover, and emulated/stylus hover should not trigger reactive decorations while the user is scrolling.

Current state:
- `DataGridTableStage.vue` tracks coarse pointer state and body scroll-active state.
- Row hover and range-edge hover are suppressed while coarse pointer is active or the body viewport is scrolling.

Recommended fix:
- Keep coarse/scroll suppression in place.
- Extend the same scroll-active policy to any newly added hover-only affordances.

#### 8. Scroll idle utilities exist but are not integrated into the main app-stage scroll path

Files/functions:
- `packages/datagrid-orchestration/src/scrolling/useDataGridScrollIdleGate.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridScrollPerfTelemetry.ts`
- `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts`

Problem:
- The repo already has a scroll idle gate and scroll perf telemetry helper.
- Search found no production integration of `useDataGridScrollIdleGate` in the app-stage scroll/render path.
- This leaves non-critical effects with no central "defer until scroll idle" policy.

Current state:
- `DataGridTableStage.vue` already exposes body scroll-active state.
- Touch/coarse scroll now uses that state to bypass authored cell/group renderer functions and render resolved display values while momentum scroll is active.
- Desktop scrolling still uses authored renderer functions to avoid changing mouse/trackpad behavior.

Recommended fix:
- Add `isScrolling` and `scrollIdle` to the viewport runtime.
- Use it to defer hover, focus restoration attempts, expensive overlay recalculation, and any future optional renderer work.

#### 9. Fill, resize, and row resize hit targets are too small for touch

Files/functions:
- `packages/datagrid-vue-app/src/theme/ensureDataGridAppStyles.ts` `.cell-fill-handle`, `.col-resize`, `.row-resize-handle`
- `packages/datagrid-orchestration/src/headers/useDataGridHeaderResizeOrchestration.ts`
- `packages/datagrid-orchestration/src/fill/useDataGridFillHandleStart.ts`

Problem:
- Desktop fill handle is 9px square, column resize target is 10px wide, and row resize target is 10px high.
- Those desktop-sized targets do not meet tablet ergonomics when reused unchanged.

Current state:
- Coarse-pointer CSS expands fill, fill action, row resize, and column resize hit targets to 28px.
- The same sizing is available through the runtime `.grid-stage--coarse-pointer` class and the `(hover: none) and (pointer: coarse)` media query.
- Fill handle keeps the small visual marker through `::after` while exposing a larger invisible touch target.
- Resize handles remain transparent and keep `touch-action: none` because they explicitly own drag gestures.

Recommended fix:
- Verify hit target sizing on iPad/Android/Surface devices.
- Keep `touch-action: none` limited to these explicit handles.

#### 10. Managed wheel behavior is desktop-oriented and intentionally prevents default

Files/functions:
- `packages/datagrid-orchestration/src/scrolling/useDataGridManagedWheelScroll.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts`
- `packages/datagrid-vue-app/src/stage/DataGridTableStageHeader.vue`

Problem:
- Managed wheel calls `preventDefault()` when it owns a wheel gesture.
- This is probably correct for desktop header/pinned synchronization, but it means body/header wheel listeners cannot be passive.
- Precision touchpads can feel closer to touch scrolling than mouse wheels, so this should be reviewed separately from classic wheel behavior.

Recommended fix:
- Keep managed wheel for desktop where needed.
- Add a native wheel mode for coarse-pointer/touchpad-heavy environments if testing shows preventDefault harms momentum-like wheel input.

#### 11. Header, pinned pane, and canvas chrome sync are stable but need scroll-time budget limits

Files/functions:
- `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageChromeCanvas.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridLinkedPaneScrollSync.ts`

Problem:
- Pinned panes use `translate3d`, which is the right general direction.
- Canvas chrome redraws are rAF-scheduled in many paths, but horizontal-only scroll can flush synchronously.
- CSS has `will-change: transform` on `.grid-pane-content`, but not a complete contain/layer policy around the viewport.

Recommended fix:
- Coalesce all linked pane, header, pinned-bottom, and chrome updates in one scroll rAF.
- Add targeted `contain` only after visual regression checks; do not blindly apply it where overlays/focus rings can escape.

### Low

#### 12. Core viewport scroll IO is already close to the enterprise pattern

Files/functions:
- `packages/datagrid-core/src/viewport/dataGridViewportScrollIo.ts`
- `packages/datagrid-core/src/viewport/dataGridViewportVirtualization.ts`
- `packages/datagrid-core/src/virtualization/dynamicOverscan.ts`

What is good:
- Scroll listener samples native scroll and defers sync work through the scheduler.
- Heavy updates are thresholded.
- Adaptive overscan exists in the core path.
- Layout metrics are mostly observer/cached rather than read broadly in every scroll event.

Recommended follow-up:
- Reuse these patterns in the Vue app-stage path instead of maintaining a separate static overscan policy indefinitely.

#### 13. Existing tests cover pieces, but not mobile scroll UX

Files/functions:
- `e2e/sandbox-grid.spec.ts`
- `e2e/sandbox-interactions.spec.ts`
- `packages/datagrid-vue-app/src/__tests__/dataGridTouchPanGuard.spec.ts`
- `packages/datagrid-orchestration/src/__tests__/useDataGridManagedTouchScroll.contract.spec.ts`

What is good:
- There are existing virtualization, scroll, interaction, resize, wheel, and touch-pan unit/contract tests.

Gap:
- There is no enterprise-grade touch test matrix for native momentum, accidental drag prevention, blank viewport detection, and scroll FPS / long-task monitoring.

## Recommended Fixes

1. Keep native one-finger touch scroll as the default on `.grid-body-viewport`.
2. Keep JavaScript touch pan limited to linked non-scroll surfaces that need routing into the body viewport.
3. Complete the internal interaction mode policy before exposing public API.
4. Keep hover and range-edge hover suppressed while coarse pointer or scroll-active.
5. Measure and tune touch/adaptive overscan in the Vue app-stage path.
6. Continue batching remaining header, pinned, and chrome sync into rAF scroll frames.
7. Require explicit touch handles or long-press mode for selection drag, fill, range move, and resize.
8. Add `isScrolling` / `scrollIdle` to the app viewport runtime and use it to defer non-critical decoration work.
9. Add adaptive vertical overscan in `useDataGridAppViewport`.
10. Add Playwright touch tests and performance gates before deeper architectural changes.

## Phased Enterprise Roadmap

### Phase 1 - Audit And Quick Wins

- Done: change default body/header viewport CSS from `touch-action: none` to native panning.
- Done: keep `touch-action: none` on explicit fill, resize, splitter, overlay drag, and custom canvas handles only.
- Done: limit touch pan guard to linked non-scroll surfaces and lazy-install its canceling `touchmove` listener.
- Done: add coarse-pointer detection.
- Done: disable hover and range-edge hover on coarse pointers and while scrolling.
- Done: add touch-specific and velocity-adaptive row overscan in `useDataGridAppViewport`.
- Done: expand fill, row resize, and column resize hit targets for coarse pointers.
- Done: move app viewport header `scrollLeft` synchronization out of the raw body scroll event and into the rAF viewport commit.
- Done: skip pinned-bottom `scrollLeft` sync work for vertical-only body scroll frames.
- Done: remove body viewport dimension reads from the stage raw scroll sampling path.
- Done: reuse a single captured body `scrollTop` / `scrollLeft` sample across stage scroll-frame scheduling decisions.
- Done: move body and pinned-bottom scroll-triggered grid chrome redraw into the stage scroll frame.
- Done: batch window resize metric sync through rAF.
- Done: final residual review for header scroll sync before Phase 2.

### Phase 2 - Touch Interaction Model

- In progress: introduce internal `interactionMode: desktop | touch | auto`; the stage now derives effective mode from coarse-pointer state and passes it into pointer/fill-handle guards.
- Make one-finger scroll highest priority in `touch` and coarse `auto` modes.
- In progress: add long-press selection mode; stationary long press now selects/focuses a cell without starting drag, and touch-only anchor affordances are visible where they do not conflict with fill handles.
- Done for the current stage path: touch drag selection, fill, and range move start only from explicit handles.
- Done: expand resize/fill hit targets for touch while preserving desktop visuals.
- Add gesture cancellation rules: if movement is dominantly scroll before long press, do not start selection or drag.

### Phase 3 - Scroll Performance Architecture

- Done: add adaptive vertical overscan based on velocity in the app-stage path.
- In progress: add `isScrolling` and `scrollIdle` state to the stage viewport runtime.
- Done for touch mode: add lightweight display-value cell rendering while scrolling for expensive custom renderers.
- In progress: minimize reactive writes during scroll events.
- In progress: consolidate header/body/pinned/canvas sync into one scroll-frame coordinator.
- In progress: improve server/data-source prefetch windows using real velocity and latency metrics; core sparse diagnostics now expose viewport loading ratio for measurement.

### Phase 4 - Enterprise Validation

- Add mobile/tablet test matrix: iPad Safari, iPad Chrome, Android Chrome, Surface/Windows touch, macOS trackpad, mouse wheel.
- Add Playwright touch tests for native scroll, drag prevention, long press, fill handle, range move handle, and resize handles.
- Done for the server datasource sandbox: add blank/loading viewport detection during fast scroll using sparse row-model loading metrics.
- Add scroll FPS and long-task monitoring.
- Add regression gates for scroll rAF budget, visible placeholder rows during fast scroll, and accidental touch drag.

## Test Plan

- Unit tests:
  - touch mode does not call `preventDefault()` for body one-finger scroll.
  - touch mode ignores cell-body drag selection before long press.
  - touch mode starts fill/range/resize only from explicit handles.
  - coarse pointer disables hover and range-edge hover updates.
  - adaptive overscan increases with scroll velocity and decays after idle.
- Component tests:
  - body viewport CSS exposes native touch panning.
  - touch hit targets expand in coarse-pointer media mode.
  - header, pinned panes, and overlays remain aligned after vertical and horizontal scroll.
- Playwright tests:
  - one-finger touch scroll changes `scrollTop` without selection changes.
  - Done for `/vue/server-data-source-grid`: fast scroll settles below the viewport loading placeholder budget.
  - double tap edits only when not scrolling.
  - long press enters selection mode.
  - fill/range/resize drag from handles works and body drag scrolls.
- Manual device checks:
  - iPad Safari and Chrome.
  - Android Chrome.
  - Windows tablet / Surface Edge.
  - macOS precision trackpad.

## Benchmarks / Performance Checks To Add

- `scrollFrameBudget`: record per-scroll rAF total time, p95, max, dropped frame ratio.
- `visibleRowsSync`: record visible row sync time, changed row count, retained-range hits, and runtime sync time.
- `blankViewport`: during fast scroll, assert visible row count covers viewport height and loading-placeholder ratio stays below a threshold.
- `serverPrefetch`: measure time from viewport range request to data availability and placeholder exposure duration.
- `touchGestureOwnership`: count prevented touch events on body viewport; expected default should be zero for normal one-finger scroll.
- `longTaskDuringScroll`: capture long tasks over 50ms while scroll-active.

## Risks And Migration Notes

- Changing `touch-action` can expose latent assumptions in the JavaScript touch pan guard, especially in embedded layouts that relied on retained scroll ownership.
- Restoring native touch scroll can change nested scroll chaining behavior. Use `overscroll-behavior` deliberately after testing modals and app shells.
- Making touch selection explicit may feel like a behavior change for users who already adapted to current touch drag behavior, but it is the right enterprise direction.
- Larger overscan improves perceived continuity but increases DOM and renderer cost. Tune separately for plain cells, custom renderers, auto-height rows, and server rows.
- `contain` and layer promotion can improve paint isolation but may break overlays, focus rings, sticky/pinned visuals, or measurement. Add it only with screenshot regression coverage.
- Public API should not change in Phase 1. Keep `interactionMode` internal until the behavior and naming are validated.

## Prioritized Implementation Plan

1. Touch interaction model:
   - Add internal `interactionMode`.
   - Add long-press selection mode and explicit handle-only touch drag/fill/range/resize.
2. Scroll-frame coordinator completion:
   - Move remaining header/pinned/canvas scroll sync into rAF batches where safe.
   - Keep the scroll event itself sampling-only.
3. Enterprise validation:
   - Add Playwright touch tests, blank viewport detection, and scroll performance telemetry gates.
4. Server-backed fast-scroll tuning:
   - Measure placeholder exposure during fast touch scroll.
   - Tune velocity prefetch/cache windows from real device traces.
