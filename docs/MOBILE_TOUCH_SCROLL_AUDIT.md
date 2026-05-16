# Affino DataGrid Mobile / Touch Scroll Audit

Date: 2026-05-16

## Concise Summary

Affino DataGrid already has strong desktop scroll foundations: scroll work is mostly rAF-batched, core viewport IO avoids broad DOM reads in hot paths, header and pinned panes have dedicated sync paths, and server-backed row models include cache and prefetch support.

The mobile/touch gap is real. The current app-stage path disables native touch panning on the main grid viewport and replaces it with manual JavaScript pan handling. That is the biggest blocker to tablet-grade feel because it bypasses browser-native momentum scrolling and makes one-finger scroll compete with selection, fill, range move, hover, and header/body sync logic.

No broad rewrite is recommended yet. The next work should first move one-finger touch scrolling back to the browser, keep drag/fill/range/resize behind explicit handles or long-press mode, and add scroll-time gates so hover, decoration, and heavier row sync work do not run during momentum scroll.

## Current Architecture Summary

- `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue` composes header, center body viewport, pinned panes, pinned-bottom viewport, canvas chrome, overlays, fill action menu, focus, row hover, selection, fill, and range move state.
- `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue` owns the center scrollable viewport DOM and binds `@scroll`, `@wheel`, `@mousedown.prevent.stop`, `@mousemove`, `@mouseenter`, `@dblclick.stop.prevent`, and fill-handle mouse events.
- `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts` bridges the stage viewport to app scroll/runtime state, links pinned panes via transforms, wires managed wheel scrolling, installs the touch pan guard, and schedules canvas chrome redraws.
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

None found that makes desktop scrolling unusable or prevents incremental mobile improvements. The blocker-level risk is architectural for mobile UX: native one-finger scrolling is not currently the default behavior in the app-stage grid.

### High

#### 1. Native touch panning is disabled on the main grid viewport

Files/functions:
- `packages/datagrid-vue-app/src/theme/ensureDataGridAppStyles.ts` selectors `.grid-body-viewport`, `.grid-header-viewport`, `.datagrid-gantt-timeline__viewport`
- `packages/datagrid-vue-app/src/gestures/dataGridTouchPanGuard.ts` `installDataGridTouchPanGuard`
- `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts` `onMounted`

Problem:
- `.grid-body-viewport` uses `touch-action: none` while also setting `-webkit-overflow-scrolling: touch`.
- `installDataGridTouchPanGuard()` registers `touchmove` with `{ passive: false }`, calls `event.preventDefault()`, and manually writes `scrollTop` / `scrollLeft`.
- This conflicts with the enterprise target: one-finger scroll should feel native, include browser momentum, and stay on the compositor whenever possible.

Recommended fix:
- Change the default body viewport touch policy to native panning (`touch-action: auto` or `pan-x pan-y`) and keep `touch-action: none` only on explicit drag/fill/resize handles and custom canvases that truly need gesture ownership.
- Gate the legacy touch pan guard behind an opt-in fallback or future `interactionMode`.
- Keep the guard available for constrained embedded cases, but do not install it by default for normal grid scrolling.

#### 2. Touch gestures compete with cell selection and range move

Files/functions:
- `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue`
- `packages/datagrid-vue/src/app/useDataGridAppInteractionController.ts` `handleCellMouseDown`
- `packages/datagrid-orchestration/src/pointer/useDataGridCellPointerDownRouter.ts` `dispatchCellPointerDown`

Problem:
- Every body cell binds `@mousedown.prevent.stop`.
- Selection and range-move paths call `preventDefault()` on primary-button down.
- On touch devices, this mouse-first interaction model has no explicit coarse-pointer branch, no long-press selection mode, and no guaranteed "scroll wins" rule.

Recommended fix:
- Move cell gesture initiation to pointer-aware routing and treat `pointerType === "touch"` as scroll-first.
- Do not start drag selection or range move from a touch down unless the grid is already in touch selection mode, the user long-pressed, or the down occurred on an explicit handle.
- Keep existing mouse behavior behind `pointerType === "mouse"` / desktop mode.

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
- Add a long-press-to-selection-mode design before allowing touch drag selection or range move.

#### 4. Vue app vertical overscan is static in the primary app-stage path

Files/functions:
- `packages/datagrid-vue-app/src/config/dataGridVirtualization.ts` `resolveDataGridVirtualization`
- `packages/datagrid-vue/src/app/useDataGridAppViewport.ts` `rowOverscan`, `resolveViewportRangeFromSnapshot`
- `packages/datagrid-core/src/viewport/dataGridViewportVirtualization.ts` `createDataGridViewportVirtualization`

Problem:
- The Vue app viewport defaults to `rowOverscan: 8`.
- Core viewport virtualization has adaptive velocity overscan, but the app-stage path computes row ranges with static overscan.
- Fast tablet momentum scroll can outrun a fixed 8-row buffer, especially with custom renderers, auto-height rows, server-backed rows, or high refresh-rate devices.

Recommended fix:
- Introduce adaptive row overscan in `useDataGridAppViewport`.
- Start conservatively: increase overscan on coarse pointers and while scroll velocity is high.
- Later, unify the app-stage row-window policy with the core dynamic overscan controller.

#### 5. Scroll handlers still do synchronous DOM writes and reactive updates during the scroll event

Files/functions:
- `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts` `handleCenterViewportScroll`
- `packages/datagrid-vue/src/app/useDataGridAppViewport.ts` `handleViewportScroll`, `commitViewportSnapshot`
- `packages/datagrid-vue-app/src/stage/useDataGridStageChromeCanvas.ts` `flushGridChromeRedraw`, `scheduleGridChromeRedraw`

Problem:
- The app viewport correctly batches the main visible row commit through rAF.
- However, the stage scroll handler also immediately syncs linked pane transforms, updates several Vue refs (`bodyViewportScrollTop`, `bodyViewportScrollLeft`, dimensions), writes pinned-bottom `scrollLeft`, and can synchronously flush center chrome redraw on horizontal-only scroll.
- This is acceptable for desktop but too much for touch momentum scroll where the browser may fire many events while trying to preserve frame budget.

Recommended fix:
- Make scroll event handlers sampling-only where possible.
- Move header/pinned/canvas updates to a single latest-value rAF pass.
- Avoid `flushGridChromeRedraw()` from inside scroll handlers except for verified correctness cases.

#### 6. Server/data-source row models can display loading rows in the viewport during fast scroll

Files/functions:
- `packages/datagrid-core/src/models/dataSourceBackedRowModel.ts` `getRowsInRange`, `setViewportRange`, `resolveVelocityAwareSourceRange`
- `packages/datagrid-core/src/models/server/velocityOverscan.ts`
- `packages/datagrid-core/src/models/serverBackedRowModel.ts` `setViewportRange`, `warmViewportRange`

Problem:
- Data-source rows use placeholder loading row nodes when a requested row is not cached.
- There is velocity-aware prefetch, cache diagnostics, and critical/background pull separation, which is good.
- The behavior is not yet validated against a "no visible blanking/loading during fast momentum scroll" target.

Recommended fix:
- Add a blank/loading viewport budget and measure it in Playwright.
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

Recommended fix:
- Detect coarse pointers and disable row hover/range-edge hover updates.
- Add `isScrolling`/scroll idle state and suppress hover/decoration updates while scroll is active.

#### 8. Scroll idle utilities exist but are not integrated into the main app-stage scroll path

Files/functions:
- `packages/datagrid-orchestration/src/scrolling/useDataGridScrollIdleGate.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridScrollPerfTelemetry.ts`
- `packages/datagrid-vue/src/app/useDataGridAppViewport.ts`

Problem:
- The repo already has a scroll idle gate and scroll perf telemetry helper.
- Search found no production integration of `useDataGridScrollIdleGate` in the app-stage scroll/render path.
- This leaves non-critical effects with no central "defer until scroll idle" policy.

Recommended fix:
- Add `isScrolling` and `scrollIdle` to the viewport runtime.
- Use it to defer hover, focus restoration attempts, expensive overlay recalculation, and optional cell renderer work.

#### 9. Fill, resize, and row resize hit targets are too small for touch

Files/functions:
- `packages/datagrid-vue-app/src/theme/ensureDataGridAppStyles.ts` `.cell-fill-handle`, `.col-resize`, `.row-resize-handle`
- `packages/datagrid-orchestration/src/headers/useDataGridHeaderResizeOrchestration.ts`
- `packages/datagrid-orchestration/src/fill/useDataGridFillHandleStart.ts`

Problem:
- Fill handle is 9px square.
- Column resize target is 10px wide.
- Row resize target is 10px high.
- These are desktop-sized targets and do not meet tablet ergonomics.

Recommended fix:
- Add coarse-pointer CSS to expand invisible hit targets to roughly 24px-32px while preserving visual size.
- Keep `touch-action: none` only on these handles so drag gestures are explicit.

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

1. Make native one-finger touch scroll the default on `.grid-body-viewport`.
2. Gate the current JavaScript touch pan guard behind an explicit fallback.
3. Add coarse-pointer detection and an internal interaction mode policy before exposing public API.
4. Suppress hover and range-edge hover while coarse pointer or scroll-active.
5. Increase touch overscan in the Vue app-stage path.
6. Batch header, pinned, and chrome sync into one rAF scroll frame.
7. Require explicit touch handles or long-press mode for selection drag, fill, range move, and resize.
8. Add `isScrolling` / `scrollIdle` to the app viewport runtime and use it to defer non-critical decoration work.
9. Add adaptive vertical overscan in `useDataGridAppViewport`.
10. Add Playwright touch tests and performance gates before deeper architectural changes.

## Phased Enterprise Roadmap

### Phase 1 - Audit And Quick Wins

- Change default body viewport CSS from `touch-action: none` to native panning.
- Keep `touch-action: none` on explicit fill, resize, splitter, overlay drag, and custom canvas handles only.
- Make the touch pan guard opt-in or fallback-only.
- Keep `touchmove` listeners passive unless they are on explicit handles that must own the gesture.
- Add coarse-pointer detection.
- Disable hover and range-edge hover on coarse pointers.
- Add touch-specific row overscan bump in `useDataGridAppViewport`.
- Move synchronous canvas/header/pinned scroll work behind rAF where safe.

### Phase 2 - Touch Interaction Model

- Introduce internal `interactionMode: desktop | touch | auto`.
- Make one-finger scroll highest priority in `touch` and coarse `auto` modes.
- Add long-press selection mode.
- Start drag selection, fill, and range move only from explicit handles in touch mode.
- Expand resize/fill hit targets for touch while preserving desktop visuals.
- Add gesture cancellation rules: if movement is dominantly scroll before long press, do not start selection or drag.

### Phase 3 - Scroll Performance Architecture

- Add adaptive vertical overscan based on velocity in the app-stage path.
- Add `isScrolling` and `scrollIdle` state to the stage viewport runtime.
- Add lightweight cell rendering while scrolling for expensive custom renderers.
- Minimize reactive writes during scroll events.
- Consolidate header/body/pinned/canvas sync into one scroll-frame coordinator.
- Improve server/data-source prefetch windows using real velocity and latency metrics.

### Phase 4 - Enterprise Validation

- Add mobile/tablet test matrix: iPad Safari, iPad Chrome, Android Chrome, Surface/Windows touch, macOS trackpad, mouse wheel.
- Add Playwright touch tests for native scroll, drag prevention, long press, fill handle, range move handle, and resize handles.
- Add blank/loading viewport detection during fast scroll.
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
  - fast fling does not show blank content or excessive loading placeholders.
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

1. Native body touch scroll quick win:
   - Update viewport CSS and touch guard installation policy.
   - Add tests proving body touch scroll is not prevented by default.
2. Coarse pointer guard:
   - Add internal coarse-pointer detection.
   - Disable hover/range-edge hover and increase touch overscan.
3. Scroll-frame coordinator:
   - Move header/pinned/canvas scroll sync into one rAF batch.
   - Keep the scroll event itself sampling-only.
4. Touch interaction model:
   - Add internal `interactionMode`.
   - Add long-press selection mode and explicit handle-only touch drag/fill/range/resize.
5. Adaptive app-stage overscan:
   - Port or reuse core dynamic overscan in `useDataGridAppViewport`.
   - Add velocity decay and touch-specific minimums.
6. Enterprise validation:
   - Add Playwright touch tests, blank viewport detection, and scroll performance telemetry gates.
