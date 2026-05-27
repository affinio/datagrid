# Affino DataGrid Mobile / Touch Scroll Audit

Date: 2026-05-16

## Concise Summary

Affino DataGrid already has strong desktop scroll foundations: scroll work is mostly rAF-batched, core viewport IO avoids broad DOM reads in hot paths, header and pinned panes have dedicated sync paths, and server-backed row models include cache and prefetch support.

The first mobile/touch quick wins are now implemented in the Vue app-stage path: the shared body scroll surface exposes native touch panning and native overscroll propagation, coarse-pointer mode suppresses hover work, touch-generated mouse gestures are ignored by desktop drag/fill/resize starts, app-stage row overscan is higher and adaptive on fast scroll, and stage scroll-state refs are batched through `requestAnimationFrame`.

The remaining mobile/touch gap is now primarily validation and performance-hardening work: real-device testing and server/data-source prefetch tuning from real velocity and latency traces. Interaction orchestration implementation slices are closed as of 2026-05-17, and selection enterprise slices are closed as of 2026-05-18. Automated Chromium desktop and touch-emulated interaction thresholds are hard-fail gates, while hardware-specific mobile risk is tracked as device execution and threshold review from real traces.

Current virtualization support status for touch/mobile, server-backed rows, and browser perf gates is summarized in `docs/datagrid-virtualization-support-matrix.md`.

## Implementation Status

Completed in Phase 1:
- Native body/header viewport panning: `.grid-body-shared-vertical-scroll-shell`, `.grid-body-viewport`, and `.grid-header-viewport` use `touch-action: pan-x pan-y`; the body viewport keeps `-webkit-overflow-scrolling: touch`.
- Table-stage touch fallback routing removed: `DataGridTableStage.vue` no longer installs `installDataGridTouchPanGuard()`, so table-stage body/header touch pan is not translated through non-passive `touchmove` handlers.
- Native overscroll restored: table-stage body/header scrollports no longer set `overscroll-behavior: none`, allowing the browser/page to own boundary behavior instead of a grid workaround.
- Center body horizontal wheel ownership unified: horizontal wheel over the center body now uses the same managed horizontal path as linked pinned/header surfaces, while vertical body wheel remains native; this avoids macOS elastic drift against the separately rendered header.
- Native Gantt timeline horizontal wheel restored on real timeline scrollports; managed Gantt wheel remains limited to canvas fallback and vertical forwarding into the table viewport.
- Native Gantt horizontal overscroll restored: timeline scrollports no longer set `overscroll-behavior-x: contain`, leaving horizontal boundary behavior to the browser/page.
- Gantt touch fallback scoping: the remaining Gantt touch-pan guard is scoped to the timeline zone, so embedded table-pane touches stay with the table stage's native scroll owner.
- Header scroll sync cleanup: header scroll-left feedback now routes through `useDataGridStageViewportRuntime.ts`; the legacy header wheel path and DOM `data-*` skip flag were removed.
- Coarse-pointer detection: `DataGridTableStage.vue` and `useDataGridAppViewport.ts` track coarse pointers and use that state for touch-first behavior.
- Touch-generated mouse guards: cell mousedown, row/column resize, autosize double-click, row index drag, fill-handle drag, fill-handle double-click, and stage header drag paths now ignore touch-generated mouse events unless explicitly routed through a supported handle path.
- Touch tap edit guard: touch-generated clicks on select/date affordance zones route to normal cell selection instead of opening inline edit from a single tap; desktop affordance clicks still open edit.
- Touch long-press prep: touch-generated `contextmenu` events no longer open the desktop grid context menu, leaving long press available for the future touch selection model.
- Prevent-default cleanup: row resize handle clicks stop row-index selection without unconditionally preventing the click default.
- Header resize click guard: column resize handle gestures suppress the follow-up header click so resize release cannot trigger sorting.
- Scroll-time suppression: hover/range-edge hover and inline edit start are suppressed while the body viewport is scrolling.
- App-stage overscan: `useDataGridAppViewport.ts` increases row overscan on coarse pointers, scales touch overscan with viewport height using a larger bounded active window, and adds velocity-based adaptive row overscan with idle decay.
- Adaptive overscan cap: velocity-based row overscan is capped by the current viewport row count, with a bounded minimum and maximum, so programmatic jump-scroll stress does not inflate the rendered row window far beyond the visible viewport.
- Large touch viewport retention: coarse-pointer smooth scroll uses a larger viewport-relative retained row window plus fixed-row browser containment; when the retained buffer edge is crossed, the row window advances in bounded chunks instead of jumping by a full overscan block, reducing periodic renderer/layout churn and badge/style flicker while the finger remains down.
- Stage scroll batching: `useDataGridStageViewportRuntime.ts` batches body scroll refs and pinned-bottom scroll-left sync through a scroll frame.
- Pinned-pane vertical sync: the shared vertical scroll owner now hosts the inherited `--datagrid-body-scroll-top` CSS variable, so center and pinned sticky layers share one owner-level scroll-offset write instead of three per-pane writes. Reactive refs, pinned-bottom sync, and chrome redraw remain rAF-batched.
- Scroll-frame chrome redraw: body and pinned-bottom scroll handlers queue canvas chrome redraw mode and flush it from the stage scroll frame, not from the raw scroll event.
- Scroll-frame chrome redraw hardening: vertical body scroll now uses a body-only chrome redraw mode, reuses cached chrome theme styles during scroll redraws, and passes cached composite viewport dimensions into the app viewport adapter to avoid style/layout reads in active scroll frames.
- Center body chrome ownership: center-body row bands and dividers now render in a scroll-owned `grid-body-content` layer with content-local row coordinates, so horizontal touch momentum, vertical virtualization, and macOS boundary movement use the same compositor owner as cells and selection overlays; canvas chrome remains for header, pinned panes, and pinned bottom.
- Scroll-frame telemetry: when `dgPerfTrace` is enabled, the stage records `stageScrollFrame` samples with total rAF work, scroll offsets, pinned-bottom sync, and chrome redraw mode, plus `stageScrollPerf` samples with FPS, dropped-frame, and long-task counters.
- Stage scroll idle gate: `useDataGridStageViewportRuntime.ts` now exposes explicit body scroll active/idle refs plus a deferred idle callback hook backed by the shared scroll idle utility; anchor focus restoration uses that hook to avoid refocusing cells during active scroll.
- Scroll sampling cleanup: body scroll handling samples `scrollTop` / `scrollLeft` once per raw scroll event and reuses the captured state for owner-level vertical offset sync, pinned-bottom sync, and chrome redraw mode selection.
- Resize metric batching: window resize metric sync is rAF-batched so resize bursts do not run layout metric reads directly from the resize event.
- Header scroll ownership cleanup: the center body remains the horizontal owner; the header no longer forwards header-origin scroll events into the body, and horizontal header wheel intent routes through the linked-wheel path into the center owner.
- Center header horizontal sync: the center header is externally owned by the table stage and mirrors the center horizontal owner through native `scrollLeft` with native cell dividers; horizontal overscroll is contained on grid scroll surfaces to avoid macOS elastic drift and browser history navigation.

Still open:
- Real-device validation execution: the matrix is documented below, but still needs runs on iPad Safari/Chrome, Android Chrome, Surface/Windows touch, and macOS precision trackpad.
- Hardware threshold review for `stageScrollFrame`, `stageScrollPerf`, interaction-frame budgets, and server viewport loading ratio after the real-device matrix is executed.
- Server/data-source prefetch tuning from real touch velocity and backend latency traces.

Phase 2 status:
- Internal interaction mode seam: `DataGridTableStage.vue` now derives `interactionMode: desktop | touch` from internal `auto` mode plus coarse-pointer state, and stage pointer/fill-handle interactions receive that mode input without exposing a public API.
- Cell-body touch guard: `DataGridTableStage.vue` now checks the internal interaction mode before delegating cell mousedown into selection/range-move interaction state, so touch-generated mousedown keeps scroll priority while desktop mousedown still starts the existing selection path.
- Touch pan click suppression: the body shell passively tracks touch movement and suppresses the next synthetic touch click after a pan, preventing accidental cell selection after one-finger scroll without canceling native scrolling.
- Touch long-press selection prep: in touch mode, a stationary long press on a body cell selects/focuses that cell and suppresses the follow-up synthetic click/context menu; movement beyond the pan threshold cancels the long press.
- Touch selection anchor affordance: selected anchor cells now render a touch-only handle when no fill handle is present; the handle isolates touchstart/move/end, down, click, and context-menu events from cell-body selection and reserves the UI affordance for explicit touch selection drag.
- Explicit touch fill handle: fill handles now accept real touchstart/move/end on the handle itself and bridge those events into the existing fill drag mouse lifecycle, while touch-generated cell-body mousedown remains scroll-first.
- Explicit touch selection handle drag bridge: touchstart on the selection anchor handle starts the existing selection-extension lifecycle with scroll-safe handle isolation; touchmove/touchend are forwarded through the existing global mouse lifecycle.
- Explicit touch range-move handle drag bridge: touch mode now exposes a move-selection handle on the selected anchor cell and routes its touchstart/move/end through the existing range-move lifecycle instead of using cell-body touch drag.
- Touch hit targets: coarse-pointer mode expands fill, fill action, row resize, and column resize targets while preserving desktop marker visuals.

Phase 3 status:
- Touch scroll renderer stability: active touch scroll keeps visible custom cell/group renderers mounted instead of replacing them with resolved `displayValue`, avoiding viewport flicker for renderer-backed cells.
- Focused renderer/stage coverage verifies renderer retention during touch scroll while preserving cell shell ARIA and selection/focus ownership.

Interaction audit closure:
- Interaction orchestration slices 1-14 are complete as of 2026-05-17, and selection enterprise slices 1-15 are complete as of 2026-05-18. Browser e2e coverage and hard-fail Chromium frame profiles now cover desktop interaction races, interaction diagnostics, pointer preview, auto-scroll, focus restoration, pinned-pane drag-selection diagnostics, and scroll-sync drift. The open mobile work remains real-device execution and hardware threshold review.

## Current Mobile Capability

- One-finger body scrolling is native-first on the shared body scroll surface; table-stage touch pan is no longer manually routed through `touchmove` cancellation.
- Left/right pinned-pane touch starts participate in the shared native body scroll surface. Header touch pan is no longer emulated by the table stage and should be validated on real devices for expected page/grid boundary behavior.
- Single tap selects/focuses cells; stationary long press selects/focuses a body cell and suppresses the desktop context menu; movement before long press cancels selection intent.
- Double tap can open inline editing when the viewport is idle; scroll-active double tap is suppressed.
- Fill drag, selection extension, range move, and column resize are available from explicit touch handles only; body-cell touch drag remains scroll-first.
- Coarse-pointer mode expands fill, fill action, row resize, and column resize hit targets while keeping desktop visuals.
- During active touch scroll, visible custom cell/group renderers remain active; scroll savings come from native panning, native overscroll propagation, hover suppression, rAF batching, larger retained touch windows with bounded chunk shifts, fixed-row containment, and adaptive overscan.
- Remaining limits: no public `interactionMode` API yet, the real-device matrix is documented but not executed, and hardware traces may require threshold adjustments for scroll-frame, scroll-quality, and interaction-frame telemetry.

## Current Architecture Summary

- `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue` composes header, center body viewport, pinned panes, pinned-bottom viewport, canvas chrome, overlays, fill action menu, focus, row hover, selection, fill, and range move state.
- `packages/datagrid-vue-app/src/stage/DataGridTableStageCenterPane.vue` owns the center scrollable viewport DOM and binds `@scroll`, `@wheel`, cell mousedown/click/move, cell double-click, and fill-handle mouse events. Cell double-click now prevents default only after inline edit is allowed.
- `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts` bridges the stage viewport to app scroll/runtime state, keeps vertical wheel/overscroll and body horizontal wheel native on real scroll owners, wires horizontal linked-wheel fallback only for non-scroll surfaces, owns header scroll-left feedback, batches body scroll refs through rAF, exposes body scroll active/idle state, records opt-in scroll perf telemetry, and coordinates scroll-triggered canvas chrome redraws inside the stage scroll frame.
- `packages/datagrid-vue-app/src/perf/dataGridPerfTrace.ts` stores opt-in perf samples behind `?dgPerfTrace=1` / localStorage and now includes the stage scroll-frame budget scope.
- `packages/datagrid-vue-app/src/stage/useDataGridStageCellRendering.ts` resolves editor modes, select/date display values, and authored cell/group renderer calls; visible renderer output is preserved during touch scroll.
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

None found that makes desktop scrolling unusable or prevents incremental mobile improvements. The previous blocker-level mobile risk, non-native one-finger body scrolling, has been reduced by restoring native panning on the body viewport. The remaining blocker-level risk is release validation: Playwright coverage now protects the main touch contracts, but real tablet/mobile devices and CI performance thresholds are not finalized.

### High

#### 1. Native touch panning was disabled on the main grid viewport

Files/functions:
- `packages/datagrid-vue-app/src/theme/ensureDataGridAppStyles.ts` selectors `.grid-body-shared-vertical-scroll-shell`, `.grid-body-viewport`, `.grid-header-viewport`, `.datagrid-gantt-timeline__viewport`
- `packages/datagrid-vue-app/src/stage/DataGridTableStage.vue` shared vertical body scroll shell
- `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts` vertical wheel/touch ownership

Problem:
- This was the original highest-risk mobile issue: the body viewport used to rely on JavaScript touch panning instead of browser-native scroll.

Current state:
- `.grid-body-shared-vertical-scroll-shell`, `.grid-body-viewport`, and `.grid-header-viewport` now use `touch-action: pan-x pan-y`.
- `DataGridTableStage.vue` no longer installs the table-stage `installDataGridTouchPanGuard()` fallback for touch panning.
- Table-stage body/header scrollports no longer set `overscroll-behavior: none`; boundary behavior is left to the browser/page.

Recommended fix:
- Keep table-stage touch pan native/passive and verify on real devices.
- Do not reintroduce fake inertial touch routing; use explicit touch handles only for non-scroll gestures.
- Keep the current Playwright gates and verify header/pinned momentum feel on hardware.

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
- Touch long press now routes into the app selection path, focuses the cell with `preventScroll`, and suppresses the follow-up synthetic click/context menu; it no longer invokes the normal cell click action.
- Touch mode now exposes an event-isolated anchor handle affordance on selected cells that do not already show a fill handle; real touch events on the handle do not enter body long-press or cell-body selection paths, and explicit handle drag forwards through the existing selection-extension lifecycle.
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
- The adaptive overscan maximum is viewport-relative, so fast jump-scroll stress retains blanking protection without rendering the previous fixed 64-row lookahead on every viewport size.

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
- The raw body scroll handler now reads `scrollTop` and `scrollLeft` once per event and reuses the captured state for owner-level scroll-offset sync and all stage scroll-frame decisions.
- Grid chrome redraw mode is now queued by the body and pinned-bottom scroll handlers and flushed inside the stage scroll frame, so canvas draw work no longer starts from the raw scroll event.
- Stage scroll-frame rAF work now emits `stageScrollFrame` perf samples when tracing is enabled, giving future CI/device gates a direct budget signal.
- Stage scroll activity now feeds the shared scroll perf telemetry helper behind `dgPerfTrace`, producing `stageScrollPerf` samples for FPS, dropped-frame, and long-task monitoring.
- Window resize metric sync is now batched through `requestAnimationFrame`; resize events no longer call `syncBodyViewportMetrics()` directly.
- Header scroll sync now captures header `scrollLeft` once per event and delegates body viewport commit into the existing stage scroll-frame path.
- The old no-op linked pane scroll sync service is no longer part of the table-stage scroll runtime.
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
- Deterministic fake-datasource Playwright coverage now protects the loading-placeholder budget, but real-device and real-latency traces are still needed before claiming a strict "no visible blanking/loading during fast momentum scroll" target.

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
- `DataGridTableStage.vue` already consumes body scroll-active state.
- `useDataGridStageViewportRuntime.ts` now exposes both body scroll-active and body scroll-idle refs, plus `runWhenBodyViewportScrollIdle()` for non-critical work that should be delayed until scrolling settles.
- `useDataGridStageFocusRuntime.ts` defers anchor focus restoration through that idle hook while body scrolling is active and coalesces duplicate restore requests.
- Touch/coarse scroll now uses that state to defer non-critical focus work and suppress hover/edit starts while momentum scroll is active.
- Touch and desktop scrolling both keep authored cell/group renderer functions active for visible cells to avoid display flicker.

Recommended fix:
- Continue using the explicit idle callback hook for future expensive overlay recalculation and other optional renderer work.

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
- This is still needed for desktop header/pinned linked-surface synchronization, but should not run on real body horizontal scroll owners.
- Precision touchpads can feel closer to touch scrolling than mouse wheels, so this should be reviewed separately from classic wheel behavior.

Current state:
- Body horizontal wheel over the center and pinned-bottom horizontal scroll owners is native.
- Gantt timeline horizontal wheel over header/body timeline scrollports is native; wheel over the canvas still uses the managed fallback because the canvas is not a scroll owner.
- Gantt timeline horizontal boundary behavior is native; the timeline CSS no longer contains `overscroll-behavior-x: contain`.
- The remaining Gantt touch-pan fallback is timeline-scoped and no longer claims touch starts in the embedded table pane.
- Managed wheel remains limited to linked/header/pinned surfaces that are not themselves horizontal scroll owners.

Recommended fix:
- Keep managed wheel only for horizontal linked/header synchronization where needed.
- Keep vertical wheel and overscroll boundary behavior native unless hardware traces prove a specific regression.

#### 11. Header, pinned pane, and canvas chrome sync are stable but need scroll-time budget limits

Files/functions:
- `packages/datagrid-vue-app/src/stage/useDataGridStageViewportRuntime.ts`
- `packages/datagrid-vue-app/src/stage/useDataGridStageChromeCanvas.ts`
- `packages/datagrid-orchestration/src/scrolling/useDataGridLinkedPaneScrollSync.ts`

Problem:
- Pinned panes use `translate3d`, which is the right general direction.
- Canvas chrome redraws, header feedback, and pinned-bottom scroll-left sync are routed through the stage scroll frame for table-stage scroll paths.
- CSS has `will-change: transform` on `.grid-pane-content`, but not a complete contain/layer policy around the viewport.

Recommended fix:
- Keep owner-level scroll offset, header, pinned-bottom, and chrome updates coalesced or owner-scoped so raw scroll work stays minimal.
- Keep fixed-row containment targeted to body/pane rows and exclude auto-height rows; validate overlays/focus rings visually.

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
- The repo now has focused Chromium Playwright gates for native scroll priority, accidental drag prevention, blank/loading viewport detection, scroll telemetry, and hard-fail interaction frame profiles. The remaining gap is broad hardware coverage and threshold review from real devices.

## Recommended Fixes

1. Keep native one-finger touch scroll as the default on the shared body scroll surface.
2. Keep table-stage touch pan free of non-passive JavaScript routing; explicit handles remain the only touch gestures that may cancel their own events.
3. Complete the internal interaction mode policy before exposing public API.
4. Keep hover and range-edge hover suppressed while coarse pointer or scroll-active.
5. Tune touch/adaptive overscan using real device traces.
6. Continue batching remaining header, pinned, and chrome sync into rAF scroll frames.
7. Require explicit touch handles or long-press mode for selection drag, fill, range move, and resize.
8. Continue moving non-critical decoration work onto the existing `isScrolling` / `scrollIdle` stage runtime hook.
9. Keep the current Playwright/perf telemetry gates running in CI and revise thresholds only with stable hardware evidence.
10. Keep deeper architectural changes behind measured evidence from `stageScrollFrame`, `stageScrollPerf`, and loading-ratio traces.

## Phased Enterprise Roadmap

### Phase 1 - Audit And Quick Wins

- Done: change default body/header viewport CSS from `touch-action: none` to native panning.
- Done: keep `touch-action: none` on explicit fill, resize, splitter, overlay drag, and custom canvas handles only.
- Done: limit touch pan guard to linked non-scroll surfaces and lazy-install its canceling `touchmove` listener.
- Done: add coarse-pointer detection.
- Done: disable hover and range-edge hover on coarse pointers and while scrolling.
- Done: add touch-specific and velocity-adaptive row overscan in `useDataGridAppViewport`.
- Done: cap velocity-adaptive row overscan by viewport size to reduce DOM bursts during jump-scroll stress while preserving a bounded lookahead floor.
- Done: expand fill, row resize, and column resize hit targets for coarse pointers.
- Done: move app viewport header `scrollLeft` synchronization out of the raw body scroll event and into the rAF viewport commit.
- Done: skip pinned-bottom `scrollLeft` sync work for vertical-only body scroll frames.
- Done: remove body viewport dimension reads from the stage raw scroll sampling path.
- Done: reuse a single captured body `scrollTop` / `scrollLeft` sample across stage scroll-frame scheduling decisions.
- Done: move live vertical row movement to an owner-level inherited CSS var so pinned/center content does not require per-pane style writes during raw body scroll.
- Done: move body and pinned-bottom scroll-triggered grid chrome redraw into the stage scroll frame.
- Done: batch window resize metric sync through rAF.
- Done: final residual review for header scroll sync before Phase 2.

### Phase 2 - Touch Interaction Model

- Done internally: introduce `interactionMode: desktop | touch | auto`; the stage now derives effective mode from coarse-pointer state and passes it into pointer/fill-handle guards without exposing a public API.
- Done: make one-finger scroll highest priority in `touch` and coarse `auto` modes.
- Done for the current stage path: add long-press selection prep; stationary long press now selects/focuses a cell without starting drag, movement cancels it, and touch-only anchor affordances are visible where they do not conflict with fill handles.
- Done for the current stage path: touch drag selection, fill, and range move start only from explicit handles.
- Done: expand resize/fill hit targets for touch while preserving desktop visuals.
- Done for the current stage path: gesture cancellation rules prevent selection or drag when movement is dominantly scroll before long press.

### Phase 3 - Scroll Performance Architecture

- Done: add adaptive vertical overscan based on velocity in the app-stage path.
- Done: add `isScrolling` and `scrollIdle` state to the stage viewport runtime, with a deferred idle callback hook.
- Done: defer anchor focus restoration until body scroll idle and coalesce duplicate restore requests.
- Done for touch mode: keep visible custom renderers active while scrolling, with focused unit/component coverage for renderer retention, editor predicates, placeholder surfaces, and cell shell ARIA.
- Mostly done for the stage path: minimize reactive writes during scroll events; keep final residual audits focused on newly added scroll work.
- Mostly done for the stage path: consolidate header/body/pinned/canvas sync into one scroll-frame coordinator; keep future work behind `stageScrollFrame` evidence.
- In progress: improve server/data-source prefetch windows using real velocity and latency metrics; core sparse diagnostics now expose viewport loading ratio for measurement.

### Phase 4 - Enterprise Validation

- Done as a documented plan, execution pending: add mobile/tablet test matrix for iPad Safari, iPad Chrome, Android Chrome, Surface/Windows touch, macOS trackpad, and mouse wheel.
- In progress: add Playwright touch tests for native scroll, drag prevention, long press, double tap, fill handle, range move handle, resize handles, pinned/header sync, linked-surface routing, perf telemetry, and server-backed loading; one-finger body viewport touch pan now has a Chromium scroll-first gate for touch CSS, scrollability, accidental selection prevention, and non-prevented body touchmove ownership, body-cell touch drag has an accidental-drag prevention gate, left/right pinned-pane and header-shell touch pan have body-viewport routing gates, horizontal pinned-left/right and header-shell touch pan have X-scroll routing gates, stationary long press now has a gate for cell selection plus context-menu suppression, touch double tap now has an idle-vs-scroll-active edit gate, explicit fill-handle touch drag now has a preview/no-body-scroll gate, explicit range-move handle drag now has a preview/no-body-scroll gate, explicit column-resize handle drag now has a width-change/no-body-scroll gate, explicit row-resize handle drag now has a height-change/no-body-scroll gate, body scroll now has header/pinned-left plus dynamically pinned-right sync gates, `dgPerfTrace=1` now has stage scroll-frame latest/p95/max plus active/idle scroll-quality telemetry smoke gates, and the fake server datasource route now has a touch-mode loading-ratio gate.
- Done for the server datasource sandbox: add blank/loading viewport detection during fast scroll using sparse row-model loading metrics.
- Done at the stage level behind `dgPerfTrace`: add scroll FPS and long-task monitoring via `stageScrollPerf`.
- Done for automated Chromium profiles: enterprise browser frame assert scripts hard-fail interaction preview, auto-scroll, focus restore, and scroll-sync drift budgets for desktop and tablet/coarse-pointer profiles.
- Next: execute the real-device matrix and revise thresholds only if hardware traces show stable variance outside the Chromium profile envelopes.

## Test Plan

- Unit tests:
  - touch mode does not call `preventDefault()` for body one-finger scroll.
  - touch mode ignores cell-body drag selection before long press.
  - touch mode starts fill/range/resize only from explicit handles.
  - coarse pointer disables hover and range-edge hover updates.
  - adaptive overscan increases with scroll velocity and decays after idle.
  - stage viewport runtime exposes scroll-active/idle state and runs deferred callbacks only after idle.
  - stage focus runtime defers anchor focus restoration until body scroll idle.
- Component tests:
  - body viewport CSS exposes native touch panning.
  - touch hit targets expand in coarse-pointer media mode.
  - header, pinned panes, and overlays remain aligned after vertical and horizontal scroll.
- Playwright tests:
  - Done for `/vue/base-grid`: one-finger touch pan keeps the body viewport scroll-first and does not change selection.
  - Done for `/vue/base-grid`: touchmove that starts inside the native body viewport is not prevented by linked-surface routing.
  - Done for `/vue/base-grid`: body-cell touch drag does not start selection drag, fill, range move, resize, or preview overlays.
  - Done for `/vue/base-grid`: body scroll keeps header `scrollLeft` and pinned-left pane vertical transform synchronized.
  - Done for `/vue/base-grid`: after pinning a column right, body scroll keeps the pinned-right pane vertical transform synchronized.
  - Done for `/vue/base-grid`: touch pan that starts on the pinned-left pane routes into the body viewport without changing selection.
  - Done for `/vue/base-grid`: horizontal touch pan that starts on the pinned-left pane routes into body horizontal scroll.
  - Done for `/vue/base-grid`: after pinning a column right, touch pan that starts on the pinned-right pane routes into the body viewport without changing selection.
  - Done for `/vue/base-grid`: after pinning a column right, horizontal touch pan that starts on the pinned-right pane routes into body horizontal scroll.
  - Done for `/vue/base-grid`: touch pan that starts on the header shell routes into the body viewport without changing selection.
  - Done for `/vue/base-grid`: horizontal touch pan that starts on the header shell routes into body horizontal scroll.
  - Done for `/vue/base-grid?dgPerfTrace=1`: touch scroll records `stageScrollFrame` and `stageScrollPerf` telemetry samples, enforces non-device-specific latest/p95/max smoke thresholds for stage scroll-frame work, and verifies `stageScrollPerf` returns to idle.
  - Done for `/vue/server-data-source-grid`: in touch mode, fast scroll settles below the viewport loading placeholder budget.
  - Done for `/vue/base-grid`: stationary long press selects/focuses a body cell and suppresses the desktop context menu.
  - Done for `/vue/base-grid`: touch-generated double tap opens inline editing only when the viewport is idle, not while scroll-active.
  - Done for `/vue/base-grid`: touch fill drag starts from the explicit fill handle, renders fill preview, and does not scroll the body viewport.
  - Done for `/vue/base-grid`: touch range move drag starts from the explicit range-move handle, renders move preview, and does not scroll the body viewport.
  - Done for `/vue/base-grid`: touch column resize drag starts from the explicit resize handle, changes header width, and does not scroll the body viewport.
  - Done for `/vue/base-grid`: touch row resize drag starts from the explicit resize handle, changes row height, and does not scroll the body viewport.
  - Done for `/vue/server-data-source-grid`: desktop-sized and touch-mode fast scroll settle below the viewport loading placeholder budget.
- Manual device checks:
  - Execute the matrix below before claiming enterprise mobile readiness.
  - Capture device/browser/OS, grid route, visible row count, renderer mix, network profile, and whether `dgPerfTrace=1` was enabled.
  - Record failures with a short reproduction path and whether the issue is scroll ownership, blank/loading exposure, pinned/header sync, gesture affordance, or render latency.

### Manual Mobile / Touch Device Matrix

| Device / browser | Primary input | Routes | Required checks | Pass criteria |
| --- | --- | --- | --- | --- |
| iPadOS Safari | direct touch | `/vue/base-grid`, `/vue/server-data-source-grid` | one-finger vertical/horizontal body scroll, pinned-left/right pan routing, header pan routing, long press, double tap edit, fill/range/resize handles, fast server-backed scroll | Native momentum is preserved; body gestures are not stolen; no sustained blank/loading viewport; pinned/header layers stay aligned. |
| iPadOS Chrome | direct touch | `/vue/base-grid`, `/vue/server-data-source-grid` | same as iPadOS Safari, with focus on browser-specific click/contextmenu synthesis | Same behavior as Safari, with no accidental selection/edit after scroll. |
| Android Chrome tablet | direct touch | `/vue/base-grid`, `/vue/server-data-source-grid` | body scroll, linked-surface routing, explicit handles, fast fling, overscroll/chaining behavior | Smooth fling, no visible desync, no unexpected page scroll while interacting with the grid. |
| Surface / Windows Edge | touch + pen + precision touchpad | `/vue/base-grid` | touch scroll, touchpad scroll over body/header/pinned surfaces, resize hit targets, double tap/click edit separation | Touch and touchpad both work over linked zones; resize remains reachable without stealing scroll. |
| macOS Chrome/Safari | precision trackpad + mouse | `/vue/base-grid`, `/vue/server-data-source-grid` | regression pass for desktop wheel/trackpad scroll, header/body sync, pinned sync, editing and selection | Desktop behavior remains unchanged; trackpad momentum does not regress. |

For each matrix run, collect:
- `stageScrollFrame` p95/max total time from `dgPerfTrace=1`.
- `stageScrollPerf` FPS, dropped-frame count, and long-task count.
- Server-backed viewport loading/placeholder ratio during repeated fast flings.
- A short screen recording when a failure is visual or gesture-related.

## Benchmarks / Performance Checks To Add

- `scrollFrameBudget`: record per-scroll rAF total time, p95, max, dropped frame ratio.
- `stageScrollFrame`: available behind `dgPerfTrace`; a Chromium smoke gate now enforces finite latest/p95/max total time and should be tightened after device calibration.
- `stageScrollPerf`: available behind `dgPerfTrace`; a Chromium smoke gate now enforces sane frame/drop/long-task counters and should be tightened after device calibration.
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
   - Keep `interactionMode` internal until naming and behavior are validated on real devices.
   - Validate long-press selection and explicit handle-only touch drag/fill/range/resize on device matrix.
2. Scroll-frame coordinator completion:
   - Audit newly added scroll work against the sampling-only rule.
   - Use `stageScrollFrame` to justify any additional coordinator changes.
3. Enterprise validation:
   - Convert Playwright touch tests, blank viewport detection, and scroll performance telemetry into CI gates.
4. Server-backed fast-scroll tuning:
   - Measure placeholder exposure during fast touch scroll on real devices and realistic latency.
   - Tune velocity prefetch/cache windows from real device traces.
